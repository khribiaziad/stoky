from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json

import models
from database import get_db
from auth import get_current_user

try:
    import httpx
    _httpx = True
except ImportError:
    _httpx = False

try:
    import requests as _requests
    _req = True
except ImportError:
    _req = False

router = APIRouter(prefix="/meta", tags=["meta"])

META_API_VERSION = "v21.0"
META_BASE = f"https://graph.facebook.com/{META_API_VERSION}"


def _get_setting(db, user_id, key):
    s = db.query(models.AppSettings).filter(
        models.AppSettings.key == key,
        models.AppSettings.user_id == user_id,
    ).first()
    return s.value if s else None


def _set_setting(db, user_id, key, value):
    s = db.query(models.AppSettings).filter(
        models.AppSettings.key == key,
        models.AppSettings.user_id == user_id,
    ).first()
    if s:
        s.value = value
    else:
        s = models.AppSettings(key=key, value=str(value), user_id=user_id)
        db.add(s)
    db.commit()


def _call_meta(url, params):
    """Call Meta Graph API. Returns (data, error_str)."""
    if _httpx:
        try:
            r = httpx.get(url, params=params, timeout=15)
            return r.json(), None
        except Exception as e:
            return None, str(e)
    elif _req:
        try:
            r = _requests.get(url, params=params, timeout=15)
            return r.json(), None
        except Exception as e:
            return None, str(e)
    return None, "No HTTP library available (httpx or requests required)"


class MetaConnectRequest(BaseModel):
    access_token: str
    ad_account_id: str  # e.g. "act_123456789" or "123456789"


@router.post("/connect")
def connect_meta(
    data: MetaConnectRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    account_id = data.ad_account_id.strip()
    if not account_id.startswith("act_"):
        account_id = f"act_{account_id}"

    # Verify token works by fetching account name
    body, err = _call_meta(
        f"{META_BASE}/{account_id}",
        {"fields": "name,currency", "access_token": data.access_token.strip()},
    )
    if err or "error" in (body or {}):
        detail = err or body.get("error", {}).get("message", "Invalid token or account ID")
        raise HTTPException(status_code=400, detail=detail)

    _set_setting(db, user.id, "meta_access_token", data.access_token.strip())
    _set_setting(db, user.id, "meta_ad_account_id", account_id)
    _set_setting(db, user.id, "meta_account_name", body.get("name", account_id))
    _set_setting(db, user.id, "meta_currency", body.get("currency", "USD"))

    return {
        "success": True,
        "account_name": body.get("name", account_id),
        "currency": body.get("currency", "USD"),
    }


@router.delete("/disconnect")
def disconnect_meta(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    for key in ["meta_access_token", "meta_ad_account_id", "meta_account_name", "meta_currency"]:
        s = db.query(models.AppSettings).filter(
            models.AppSettings.key == key,
            models.AppSettings.user_id == user.id,
        ).first()
        if s:
            db.delete(s)
    db.commit()
    return {"success": True}


@router.get("/status")
def meta_status(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    token = _get_setting(db, user.id, "meta_access_token")
    account_id = _get_setting(db, user.id, "meta_ad_account_id")
    account_name = _get_setting(db, user.id, "meta_account_name")
    currency = _get_setting(db, user.id, "meta_currency")
    if not token or not account_id:
        return {"connected": False}
    # Mask token: show first 10 + last 4 chars
    masked = token[:10] + "…" + token[-4:] if len(token) > 14 else "***"
    return {
        "connected": True,
        "account_id": account_id,
        "account_name": account_name or account_id,
        "currency": currency or "USD",
        "masked_token": masked,
    }


@router.get("/sync")
def sync_meta(
    start: str = Query(...),
    end: str = Query(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    token = _get_setting(db, user.id, "meta_access_token")
    account_id = _get_setting(db, user.id, "meta_ad_account_id")
    currency = _get_setting(db, user.id, "meta_currency") or "USD"

    if not token or not account_id:
        raise HTTPException(status_code=400, detail="Meta Ads API not connected")

    time_range = json.dumps({"since": start, "until": end})
    body, err = _call_meta(
        f"{META_BASE}/{account_id}/insights",
        {
            "fields": "campaign_name,spend,impressions,clicks",
            "level": "campaign",
            "time_range": time_range,
            "time_increment": "all_days",
            "access_token": token,
            "limit": 200,
        },
    )

    if err:
        raise HTTPException(status_code=502, detail=f"Meta API error: {err}")
    if "error" in (body or {}):
        msg = body["error"].get("message", "Unknown Meta API error")
        raise HTTPException(status_code=400, detail=msg)

    rows = body.get("data", [])
    campaigns = []
    total_spend = 0.0
    total_impressions = 0
    total_clicks = 0

    for row in rows:
        spend = float(row.get("spend", 0) or 0)
        impressions = int(row.get("impressions", 0) or 0)
        clicks = int(row.get("clicks", 0) or 0)
        total_spend += spend
        total_impressions += impressions
        total_clicks += clicks
        campaigns.append({
            "name": row.get("campaign_name", "Unknown"),
            "spend": round(spend, 2),
            "impressions": impressions,
            "clicks": clicks,
        })

    # Sort by spend descending
    campaigns.sort(key=lambda x: x["spend"], reverse=True)

    return {
        "total_spend": round(total_spend, 2),
        "currency": currency,
        "total_impressions": total_impressions,
        "total_clicks": total_clicks,
        "campaigns": campaigns,
        "date_start": start,
        "date_stop": end,
    }
