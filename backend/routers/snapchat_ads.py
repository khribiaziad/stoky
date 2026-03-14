from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import httpx
import json
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/snapchat", tags=["snapchat"])

SNAPCHAT_API_BASE = "https://adsapi.snapchat.com/v1"


class SnapchatConnect(BaseModel):
    access_token: str
    ad_account_id: str


def _get_credentials(user: models.User, db: Session):
    token = db.query(models.AppSettings).filter(
        models.AppSettings.key == "snapchat_access_token",
        models.AppSettings.user_id == user.id,
    ).first()
    account = db.query(models.AppSettings).filter(
        models.AppSettings.key == "snapchat_ad_account_id",
        models.AppSettings.user_id == user.id,
    ).first()
    if not token or not account:
        raise HTTPException(status_code=400, detail="Snapchat account not connected")
    return token.value, account.value


def _save_setting(db: Session, user_id: int, key: str, value: str):
    s = db.query(models.AppSettings).filter(
        models.AppSettings.key == key, models.AppSettings.user_id == user_id
    ).first()
    if s:
        s.value = value
    else:
        db.add(models.AppSettings(key=key, value=value, user_id=user_id))


# ── Connect / Status / Disconnect ───────────────────────────

@router.post("/connect")
def connect_snapchat(data: SnapchatConnect, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    resp = httpx.get(
        f"{SNAPCHAT_API_BASE}/adaccounts/{data.ad_account_id}",
        headers={"Authorization": f"Bearer {data.access_token}"},
        timeout=15,
    )
    if resp.status_code != 200:
        body = resp.json()
        msg = (
            body.get("request_status")
            or body.get("debug_message")
            or "Invalid token or ad account ID"
        )
        raise HTTPException(status_code=400, detail=msg)
    body = resp.json()
    adaccounts = body.get("adaccounts", [])
    info = adaccounts[0].get("adaccount", {}) if adaccounts else {}
    _save_setting(db, user.id, "snapchat_access_token", data.access_token)
    _save_setting(db, user.id, "snapchat_ad_account_id", data.ad_account_id)
    db.commit()
    return {
        "success": True,
        "account_name": info.get("name"),
        "currency": info.get("currency"),
        "ad_account_id": data.ad_account_id,
    }


@router.get("/status")
def snapchat_status(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token_s = db.query(models.AppSettings).filter(
        models.AppSettings.key == "snapchat_access_token", models.AppSettings.user_id == user.id
    ).first()
    account_s = db.query(models.AppSettings).filter(
        models.AppSettings.key == "snapchat_ad_account_id", models.AppSettings.user_id == user.id
    ).first()
    if not token_s or not account_s:
        return {"connected": False}
    resp = httpx.get(
        f"{SNAPCHAT_API_BASE}/adaccounts/{account_s.value}",
        headers={"Authorization": f"Bearer {token_s.value}"},
        timeout=15,
    )
    if resp.status_code != 200:
        return {"connected": False, "error": "Token expired or invalid"}
    body = resp.json()
    adaccounts = body.get("adaccounts", [])
    info = adaccounts[0].get("adaccount", {}) if adaccounts else {}
    return {
        "connected": True,
        "account_name": info.get("name"),
        "currency": info.get("currency"),
        "ad_account_id": account_s.value,
    }


@router.delete("/disconnect")
def disconnect_snapchat(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    for key in ["snapchat_access_token", "snapchat_ad_account_id"]:
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
    token, ad_account_id = _get_credentials(user, db)
    resp = httpx.get(
        f"{SNAPCHAT_API_BASE}/adaccounts/{ad_account_id}/campaigns",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    if resp.status_code != 200:
        body = resp.json()
        msg = body.get("debug_message", "Failed to fetch campaigns")
        raise HTTPException(status_code=400, detail=msg)
    campaigns = []
    for item in resp.json().get("campaigns", []):
        c = item.get("campaign", {})
        daily_budget_micro = c.get("daily_budget_micro")
        campaigns.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "status": c.get("status"),
            "daily_budget_usd": round(daily_budget_micro / 1_000_000, 2) if daily_budget_micro is not None else None,
            "objective": c.get("objective"),
            "start_time": c.get("start_time"),
            "end_time": c.get("end_time"),
        })
    return campaigns


@router.post("/campaigns/{campaign_id}/pause")
def pause_campaign(campaign_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, _ = _get_credentials(user, db)
    resp = httpx.put(
        f"{SNAPCHAT_API_BASE}/campaigns/{campaign_id}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"campaigns": [{"id": campaign_id, "status": "PAUSED"}]},
        timeout=15,
    )
    if resp.status_code != 200:
        body = resp.json()
        msg = body.get("debug_message", "Failed to pause campaign")
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True}


@router.post("/campaigns/{campaign_id}/resume")
def resume_campaign(campaign_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, _ = _get_credentials(user, db)
    resp = httpx.put(
        f"{SNAPCHAT_API_BASE}/campaigns/{campaign_id}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"campaigns": [{"id": campaign_id, "status": "ACTIVE"}]},
        timeout=15,
    )
    if resp.status_code != 200:
        body = resp.json()
        msg = body.get("debug_message", "Failed to resume campaign")
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True}


# ── Spend / Stats ─────────────────────────────────────────────

@router.get("/spend")
def get_spend(start: str, end: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get ad spend from Snapchat for a date range (YYYY-MM-DD)."""
    token, ad_account_id = _get_credentials(user, db)
    # Snapchat expects ISO 8601 datetime strings
    start_time = f"{start}T00:00:00.000-0000"
    end_time = f"{end}T23:59:59.999-0000"
    resp = httpx.get(
        f"{SNAPCHAT_API_BASE}/adaccounts/{ad_account_id}/stats",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "granularity": "DAY",
            "fields": "spend",
            "start_time": start_time,
            "end_time": end_time,
        },
        timeout=15,
    )
    if resp.status_code != 200:
        body = resp.json()
        msg = body.get("debug_message", "Failed to fetch spend data")
        raise HTTPException(status_code=400, detail=msg)
    body = resp.json()
    timeseries = body.get("timeseries_stats", [])
    rows = []
    total_micro = 0
    for item in timeseries:
        ts = item.get("timeseries_stat", {})
        for entry in ts.get("timeseries", []):
            spend_micro = entry.get("stats", {}).get("spend", 0) or 0
            total_micro += spend_micro
            rows.append({
                "date": entry.get("start_time", "")[:10],
                "spend_usd": round(spend_micro / 1_000_000, 2),
            })
    return {
        "total_spend_usd": round(total_micro / 1_000_000, 2),
        "breakdown": rows,
        "start": start,
        "end": end,
    }
