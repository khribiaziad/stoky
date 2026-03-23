from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import httpx
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/google", tags=["google"])

GOOGLE_ADS_API_BASE = "https://googleads.googleapis.com/v17"


class GoogleConnect(BaseModel):
    access_token: str
    customer_id: str      # format: 123-456-7890 or 1234567890
    developer_token: str


def _get_credentials(user: models.User, db: Session):
    token = db.query(models.AppSettings).filter(
        models.AppSettings.key == "google_access_token",
        models.AppSettings.user_id == user.id,
    ).first()
    customer = db.query(models.AppSettings).filter(
        models.AppSettings.key == "google_customer_id",
        models.AppSettings.user_id == user.id,
    ).first()
    dev_token = db.query(models.AppSettings).filter(
        models.AppSettings.key == "google_developer_token",
        models.AppSettings.user_id == user.id,
    ).first()
    if not token or not customer or not dev_token:
        raise HTTPException(status_code=400, detail="Google Ads account not connected")
    return token.value, customer.value, dev_token.value


def _save_setting(db: Session, user_id: int, key: str, value: str):
    s = db.query(models.AppSettings).filter(
        models.AppSettings.key == key, models.AppSettings.user_id == user_id
    ).first()
    if s:
        s.value = value
    else:
        db.add(models.AppSettings(key=key, value=value, user_id=user_id))


def _clean_customer_id(cid: str) -> str:
    """Remove dashes from customer ID: 123-456-7890 -> 1234567890"""
    return cid.replace("-", "")


def _headers(token: str, dev_token: str, customer_id: str = None) -> dict:
    h = {
        "Authorization": f"Bearer {token}",
        "developer-token": dev_token,
        "Content-Type": "application/json",
    }
    if customer_id:
        h["login-customer-id"] = _clean_customer_id(customer_id)
    return h


# ── Connect / Status / Disconnect ───────────────────────────

@router.post("/connect")
def connect_google(data: GoogleConnect, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    cid = _clean_customer_id(data.customer_id)
    resp = httpx.get(
        f"{GOOGLE_ADS_API_BASE}/customers/{cid}",
        headers=_headers(data.access_token, data.developer_token, cid),
        timeout=15,
    )
    if resp.status_code != 200:
        err = resp.json()
        msg = err.get("error", {}).get("message") or err.get("error", {}).get("details", [{}])[0].get("errors", [{}])[0].get("message", "Invalid token or customer ID")
        raise HTTPException(status_code=400, detail=msg)
    info = resp.json()
    resource_name = info.get("resourceName", "")
    account_name = info.get("descriptiveName") or info.get("id") or cid

    _save_setting(db, user.id, "google_access_token", data.access_token)
    _save_setting(db, user.id, "google_customer_id", cid)
    _save_setting(db, user.id, "google_developer_token", data.developer_token)
    db.commit()
    return {"success": True, "account_name": account_name, "customer_id": cid}


@router.get("/status")
def google_status(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token_s = db.query(models.AppSettings).filter(
        models.AppSettings.key == "google_access_token", models.AppSettings.user_id == user.id
    ).first()
    customer_s = db.query(models.AppSettings).filter(
        models.AppSettings.key == "google_customer_id", models.AppSettings.user_id == user.id
    ).first()
    dev_s = db.query(models.AppSettings).filter(
        models.AppSettings.key == "google_developer_token", models.AppSettings.user_id == user.id
    ).first()
    if not token_s or not customer_s or not dev_s:
        return {"connected": False}
    resp = httpx.get(
        f"{GOOGLE_ADS_API_BASE}/customers/{customer_s.value}",
        headers=_headers(token_s.value, dev_s.value, customer_s.value),
        timeout=10,
    )
    if resp.status_code != 200:
        return {"connected": False, "error": "Token expired or invalid"}
    info = resp.json()
    return {
        "connected": True,
        "account_name": info.get("descriptiveName") or customer_s.value,
        "customer_id": customer_s.value,
    }


@router.delete("/disconnect")
def disconnect_google(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    for key in ["google_access_token", "google_customer_id", "google_developer_token"]:
        s = db.query(models.AppSettings).filter(
            models.AppSettings.key == key, models.AppSettings.user_id == user.id
        ).first()
        if s:
            db.delete(s)
    db.commit()
    return {"success": True}


# ── Campaigns ────────────────────────────────────────────────

@router.get("/campaigns")
def list_campaigns(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, customer_id, dev_token = _get_credentials(user, db)
    query = """
        SELECT campaign.id, campaign.name, campaign.status,
               campaign.advertising_channel_type,
               campaign_budget.amount_micros,
               metrics.cost_micros
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name
        LIMIT 100
    """
    resp = httpx.post(
        f"{GOOGLE_ADS_API_BASE}/customers/{customer_id}/googleAds:searchStream",
        headers=_headers(token, dev_token, customer_id),
        json={"query": query},
        timeout=15,
    )
    if resp.status_code != 200:
        err = resp.json()
        msg = err.get("error", {}).get("message", "Failed to fetch campaigns")
        raise HTTPException(status_code=400, detail=msg)

    campaigns = []
    for batch in resp.json():
        for row in batch.get("results", []):
            c = row.get("campaign", {})
            budget = row.get("campaignBudget", {})
            metrics = row.get("metrics", {})
            budget_usd = int(budget.get("amountMicros", 0)) / 1_000_000
            spend_usd = int(metrics.get("costMicros", 0)) / 1_000_000
            campaigns.append({
                "id": c.get("id"),
                "name": c.get("name"),
                "status": c.get("status"),
                "channel_type": c.get("advertisingChannelType"),
                "daily_budget_usd": round(budget_usd, 2) if budget_usd else None,
                "spend_all_time_usd": round(spend_usd, 2),
            })
    return campaigns


@router.post("/campaigns/{campaign_id}/pause")
def pause_campaign(campaign_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, customer_id, dev_token = _get_credentials(user, db)
    resp = httpx.post(
        f"{GOOGLE_ADS_API_BASE}/customers/{customer_id}/campaigns:mutate",
        headers=_headers(token, dev_token, customer_id),
        json={"operations": [{"update": {"resourceName": f"customers/{customer_id}/campaigns/{campaign_id}", "status": "PAUSED"}, "updateMask": "status"}]},
        timeout=15,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Failed to pause campaign")
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True}


@router.post("/campaigns/{campaign_id}/resume")
def resume_campaign(campaign_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, customer_id, dev_token = _get_credentials(user, db)
    resp = httpx.post(
        f"{GOOGLE_ADS_API_BASE}/customers/{customer_id}/campaigns:mutate",
        headers=_headers(token, dev_token, customer_id),
        json={"operations": [{"update": {"resourceName": f"customers/{customer_id}/campaigns/{campaign_id}", "status": "ENABLED"}, "updateMask": "status"}]},
        timeout=15,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Failed to resume campaign")
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True}


# ── Spend ────────────────────────────────────────────────────

@router.get("/spend")
def get_spend(start: str, end: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, customer_id, dev_token = _get_credentials(user, db)
    query = f"""
        SELECT campaign.id, campaign.name, metrics.cost_micros
        FROM campaign
        WHERE segments.date BETWEEN '{start}' AND '{end}'
          AND campaign.status != 'REMOVED'
    """
    resp = httpx.post(
        f"{GOOGLE_ADS_API_BASE}/customers/{customer_id}/googleAds:searchStream",
        headers=_headers(token, dev_token, customer_id),
        json={"query": query},
        timeout=15,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Failed to fetch spend")
        raise HTTPException(status_code=400, detail=msg)

    total = 0.0
    breakdown = []
    for batch in resp.json():
        for row in batch.get("results", []):
            spend = int(row.get("metrics", {}).get("costMicros", 0)) / 1_000_000
            name = row.get("campaign", {}).get("name", "Unknown")
            if spend > 0:
                total += spend
                breakdown.append({"campaign_id": str(row.get("campaign", {}).get("id", "")), "campaign": name, "spend_usd": round(spend, 2)})
    return {"total_spend_usd": round(total, 2), "breakdown": breakdown, "start": start, "end": end}
