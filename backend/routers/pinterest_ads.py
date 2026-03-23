from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import httpx
import json
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/pinterest", tags=["pinterest"])

PINTEREST_API_BASE = "https://api.pinterest.com/v5"


class PinterestConnect(BaseModel):
    access_token: str
    ad_account_id: str


def _get_credentials(user: models.User, db: Session):
    token = db.query(models.AppSettings).filter(
        models.AppSettings.key == "pinterest_access_token",
        models.AppSettings.user_id == user.id,
    ).first()
    account = db.query(models.AppSettings).filter(
        models.AppSettings.key == "pinterest_ad_account_id",
        models.AppSettings.user_id == user.id,
    ).first()
    if not token or not account:
        raise HTTPException(status_code=400, detail="Pinterest account not connected")
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
def connect_pinterest(data: PinterestConnect, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    resp = httpx.get(
        f"{PINTEREST_API_BASE}/ad_accounts/{data.ad_account_id}",
        headers={"Authorization": f"Bearer {data.access_token}"},
        timeout=15,
    )
    if resp.status_code != 200:
        body = resp.json()
        msg = body.get("message", "Invalid token or ad account ID")
        raise HTTPException(status_code=400, detail=msg)
    info = resp.json()
    _save_setting(db, user.id, "pinterest_access_token", data.access_token)
    _save_setting(db, user.id, "pinterest_ad_account_id", data.ad_account_id)
    db.commit()
    return {
        "success": True,
        "account_name": info.get("name"),
        "currency": info.get("currency"),
        "ad_account_id": data.ad_account_id,
    }


@router.get("/status")
def pinterest_status(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token_s = db.query(models.AppSettings).filter(
        models.AppSettings.key == "pinterest_access_token", models.AppSettings.user_id == user.id
    ).first()
    account_s = db.query(models.AppSettings).filter(
        models.AppSettings.key == "pinterest_ad_account_id", models.AppSettings.user_id == user.id
    ).first()
    if not token_s or not account_s:
        return {"connected": False}
    resp = httpx.get(
        f"{PINTEREST_API_BASE}/ad_accounts/{account_s.value}",
        headers={"Authorization": f"Bearer {token_s.value}"},
        timeout=15,
    )
    if resp.status_code != 200:
        return {"connected": False, "error": "Token expired or invalid"}
    info = resp.json()
    return {
        "connected": True,
        "account_name": info.get("name"),
        "currency": info.get("currency"),
        "ad_account_id": account_s.value,
    }


@router.delete("/disconnect")
def disconnect_pinterest(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    for key in ["pinterest_access_token", "pinterest_ad_account_id"]:
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
        f"{PINTEREST_API_BASE}/ad_accounts/{ad_account_id}/campaigns",
        headers={"Authorization": f"Bearer {token}"},
        params={"page_size": 100},
        timeout=15,
    )
    if resp.status_code != 200:
        body = resp.json()
        msg = body.get("message", "Failed to fetch campaigns")
        raise HTTPException(status_code=400, detail=msg)
    campaigns = []
    for c in resp.json().get("items", []):
        daily_spend_cap = c.get("daily_spend_cap")
        lifetime_spend_cap = c.get("lifetime_spend_cap")
        campaigns.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "status": c.get("status"),
            "daily_spend_cap_usd": round(daily_spend_cap / 1_000_000, 2) if daily_spend_cap is not None else None,
            "lifetime_spend_cap_usd": round(lifetime_spend_cap / 1_000_000, 2) if lifetime_spend_cap is not None else None,
            "objective_type": c.get("objective_type"),
            "start_time": c.get("start_time"),
            "end_time": c.get("end_time"),
        })
    return campaigns


@router.post("/campaigns/{campaign_id}/pause")
def pause_campaign(campaign_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, ad_account_id = _get_credentials(user, db)
    resp = httpx.patch(
        f"{PINTEREST_API_BASE}/ad_accounts/{ad_account_id}/campaigns",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=[{"id": campaign_id, "status": "PAUSED"}],
        timeout=15,
    )
    if resp.status_code != 200:
        body = resp.json()
        msg = body.get("message", "Failed to pause campaign")
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True}


@router.post("/campaigns/{campaign_id}/resume")
def resume_campaign(campaign_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, ad_account_id = _get_credentials(user, db)
    resp = httpx.patch(
        f"{PINTEREST_API_BASE}/ad_accounts/{ad_account_id}/campaigns",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=[{"id": campaign_id, "status": "ACTIVE"}],
        timeout=15,
    )
    if resp.status_code != 200:
        body = resp.json()
        msg = body.get("message", "Failed to resume campaign")
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True}


# ── Spend / Analytics ────────────────────────────────────────

@router.get("/spend")
def get_spend(start: str, end: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get ad spend from Pinterest for a date range, broken down by campaign."""
    token, ad_account_id = _get_credentials(user, db)

    # Fetch campaigns to get IDs and names
    camps_resp = httpx.get(
        f"{PINTEREST_API_BASE}/ad_accounts/{ad_account_id}/campaigns",
        headers={"Authorization": f"Bearer {token}"},
        params={"page_size": 100},
        timeout=15,
    )
    if camps_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch campaigns for spend")
    campaigns = {
        c.get("id"): c.get("name", "")
        for c in camps_resp.json().get("items", [])
        if c.get("id")
    }
    if not campaigns:
        return {"total_spend_usd": 0.0, "breakdown": [], "start": start, "end": end}

    resp = httpx.get(
        f"{PINTEREST_API_BASE}/ad_accounts/{ad_account_id}/campaigns/analytics",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "campaign_ids": list(campaigns.keys()),
            "start_date": start,
            "end_date": end,
            "columns": "SPEND_IN_DOLLAR",
            "granularity": "TOTAL",
        },
        timeout=15,
    )
    if resp.status_code != 200:
        body = resp.json()
        msg = body.get("message", "Failed to fetch campaign spend data")
        raise HTTPException(status_code=400, detail=msg)
    rows = resp.json()
    total = 0.0
    breakdown = []
    for row in rows if isinstance(rows, list) else []:
        camp_id = str(row.get("CAMPAIGN_ID", "") or "")
        spend = float(row.get("SPEND_IN_DOLLAR", 0) or 0)
        total += spend
        if spend > 0:
            breakdown.append({
                "campaign_id": camp_id,
                "campaign": campaigns.get(camp_id, ""),
                "spend_usd": round(spend, 2),
            })
    return {"total_spend_usd": round(total, 2), "breakdown": breakdown, "start": start, "end": end}
