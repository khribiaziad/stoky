"""Aggregated ad spend summary across all connected platforms."""
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/ads", tags=["ads"])

META_GRAPH_URL    = "https://graph.facebook.com/v19.0"
TIKTOK_API_BASE   = "https://business-api.tiktok.com/open_api/v1.3"
SNAPCHAT_API_BASE = "https://adsapi.snapchat.com/v1"
PINTEREST_API_BASE = "https://api.pinterest.com/v5"
GOOGLE_ADS_API_BASE = "https://googleads.googleapis.com/v17"


def _setting(db: Session, user_id: int, key: str):
    r = db.query(models.AppSettings).filter(
        models.AppSettings.key == key,
        models.AppSettings.user_id == user_id,
    ).first()
    return r.value if (r and r.value) else None


def _usd_rate(db: Session, user_id: int) -> float:
    v = _setting(db, user_id, "usd_rate")
    try:
        return float(v) if v else 10.0
    except Exception:
        return 10.0


def _meta_spend_usd(db: Session, user_id: int, start: str, end: str) -> float:
    token = _setting(db, user_id, "meta_access_token")
    account_id = _setting(db, user_id, "meta_ad_account_id")
    if not token or not account_id:
        return 0.0
    if not account_id.startswith("act_"):
        account_id = f"act_{account_id}"
    r = httpx.get(
        f"{META_GRAPH_URL}/{account_id}/insights",
        params={
            "access_token": token,
            "fields": "spend",
            "time_range": f'{{"since":"{start}","until":"{end}"}}',
            "level": "account",
        },
        timeout=15,
    )
    if r.status_code != 200:
        return 0.0
    return sum(float(e.get("spend") or 0) for e in r.json().get("data", []))


def _tiktok_spend_usd(db: Session, user_id: int, start: str, end: str) -> float:
    token = _setting(db, user_id, "tiktok_access_token")
    advertiser_id = _setting(db, user_id, "tiktok_advertiser_id")
    if not token or not advertiser_id:
        return 0.0
    r = httpx.post(
        f"{TIKTOK_API_BASE}/report/integrated/get/",
        headers={"Access-Token": token, "Content-Type": "application/json"},
        json={
            "advertiser_id": advertiser_id,
            "report_type": "BASIC",
            "dimensions": ["campaign_id"],
            "metrics": ["spend"],
            "start_date": start,
            "end_date": end,
            "page_size": 100,
        },
        timeout=15,
    )
    if r.status_code != 200 or r.json().get("code", -1) != 0:
        return 0.0
    rows = r.json().get("data", {}).get("list", [])
    return sum(float(row.get("metrics", {}).get("spend", 0)) for row in rows)


def _snapchat_spend_usd(db: Session, user_id: int, start: str, end: str) -> float:
    token = _setting(db, user_id, "snapchat_access_token")
    account_id = _setting(db, user_id, "snapchat_ad_account_id")
    if not token or not account_id:
        return 0.0
    camps_r = httpx.get(
        f"{SNAPCHAT_API_BASE}/adaccounts/{account_id}/campaigns",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    if camps_r.status_code != 200:
        return 0.0
    camp_ids = [
        item["campaign"]["id"]
        for item in camps_r.json().get("campaigns", [])
        if item.get("campaign", {}).get("id")
    ]
    total_micro = 0
    for camp_id in camp_ids:
        stats_r = httpx.get(
            f"{SNAPCHAT_API_BASE}/campaigns/{camp_id}/stats",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "granularity": "TOTAL",
                "fields": "spend",
                "start_time": f"{start}T00:00:00.000-0000",
                "end_time": f"{end}T23:59:59.999-0000",
            },
            timeout=15,
        )
        if stats_r.status_code != 200:
            continue
        for item in stats_r.json().get("timeseries_stats", []):
            for entry in item.get("timeseries_stat", {}).get("timeseries", []):
                total_micro += entry.get("stats", {}).get("spend", 0) or 0
    return total_micro / 1_000_000


def _pinterest_spend_usd(db: Session, user_id: int, start: str, end: str) -> float:
    token = _setting(db, user_id, "pinterest_access_token")
    account_id = _setting(db, user_id, "pinterest_ad_account_id")
    if not token or not account_id:
        return 0.0
    camps_r = httpx.get(
        f"{PINTEREST_API_BASE}/ad_accounts/{account_id}/campaigns",
        headers={"Authorization": f"Bearer {token}"},
        params={"page_size": 100},
        timeout=15,
    )
    if camps_r.status_code != 200:
        return 0.0
    campaign_ids = [c.get("id") for c in camps_r.json().get("items", []) if c.get("id")]
    if not campaign_ids:
        return 0.0
    r = httpx.get(
        f"{PINTEREST_API_BASE}/ad_accounts/{account_id}/campaigns/analytics",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "campaign_ids": campaign_ids,
            "start_date": start,
            "end_date": end,
            "columns": "SPEND_IN_DOLLAR",
            "granularity": "TOTAL",
        },
        timeout=15,
    )
    if r.status_code != 200:
        return 0.0
    rows = r.json()
    return sum(float(row.get("SPEND_IN_DOLLAR", 0) or 0) for row in (rows if isinstance(rows, list) else []))


def _google_spend_usd(db: Session, user_id: int, start: str, end: str) -> float:
    token = _setting(db, user_id, "google_access_token")
    customer_id = _setting(db, user_id, "google_customer_id")
    dev_token = _setting(db, user_id, "google_developer_token")
    if not token or not customer_id or not dev_token:
        return 0.0
    cid = customer_id.replace("-", "")
    query = f"""
        SELECT metrics.cost_micros
        FROM campaign
        WHERE segments.date BETWEEN '{start}' AND '{end}'
          AND campaign.status != 'REMOVED'
    """
    r = httpx.post(
        f"{GOOGLE_ADS_API_BASE}/customers/{cid}/googleAds:searchStream",
        headers={
            "Authorization": f"Bearer {token}",
            "developer-token": dev_token,
            "login-customer-id": cid,
        },
        json={"query": query},
        timeout=15,
    )
    if r.status_code != 200:
        return 0.0
    total = 0.0
    for batch in r.json():
        for row in batch.get("results", []):
            total += int(row.get("metrics", {}).get("costMicros", 0)) / 1_000_000
    return total


_PLATFORMS = [
    {"key": "meta",      "label": "Meta (Facebook/Instagram)", "color": "#1877f2", "token_key": "meta_access_token",      "fetch": _meta_spend_usd},
    {"key": "tiktok",    "label": "TikTok",                    "color": "#010101", "token_key": "tiktok_access_token",     "fetch": _tiktok_spend_usd},
    {"key": "snapchat",  "label": "Snapchat",                  "color": "#FFFC00", "token_key": "snapchat_access_token",   "fetch": _snapchat_spend_usd},
    {"key": "pinterest", "label": "Pinterest",                 "color": "#E60023", "token_key": "pinterest_access_token",  "fetch": _pinterest_spend_usd},
    {"key": "google",    "label": "Google Ads",                "color": "#4285f4", "token_key": "google_access_token",     "fetch": _google_spend_usd},
]


@router.get("/spend-summary")
def ads_spend_summary(
    start: str,
    end: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Aggregate real ad spend across all connected platforms for a date range."""
    usd_rate = _usd_rate(db, user.id)
    result = []
    total_mad = 0.0

    for p in _PLATFORMS:
        connected = bool(_setting(db, user.id, p["token_key"]))
        spend_usd = 0.0
        error = None
        if connected:
            try:
                spend_usd = p["fetch"](db, user.id, start, end)
            except Exception as e:
                error = str(e)
        spend_mad = round(spend_usd * usd_rate, 2)
        total_mad += spend_mad
        result.append({
            "platform": p["key"],
            "label": p["label"],
            "color": p["color"],
            "connected": connected,
            "spend_usd": round(spend_usd, 2),
            "spend_mad": spend_mad,
            "error": error,
        })

    return {
        "platforms": result,
        "total_mad": round(total_mad, 2),
        "usd_rate": usd_rate,
        "start": start,
        "end": end,
    }
