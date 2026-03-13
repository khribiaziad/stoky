from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import httpx
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/meta", tags=["meta"])

META_API_BASE = "https://graph.facebook.com/v19.0"

OBJECTIVES = [
    "OUTCOME_AWARENESS",
    "OUTCOME_TRAFFIC",
    "OUTCOME_ENGAGEMENT",
    "OUTCOME_LEADS",
    "OUTCOME_APP_PROMOTION",
    "OUTCOME_SALES",
]


class MetaConnect(BaseModel):
    access_token: str
    ad_account_id: str  # with or without "act_" prefix


class CreateCampaignData(BaseModel):
    name: str
    objective: str = "OUTCOME_SALES"
    daily_budget: Optional[float] = None   # USD
    lifetime_budget: Optional[float] = None  # USD
    start_time: Optional[str] = None
    stop_time: Optional[str] = None
    status: str = "PAUSED"


def _get_credentials(user: models.User, db: Session):
    token = db.query(models.AppSettings).filter(
        models.AppSettings.key == "meta_access_token",
        models.AppSettings.user_id == user.id,
    ).first()
    account = db.query(models.AppSettings).filter(
        models.AppSettings.key == "meta_ad_account_id",
        models.AppSettings.user_id == user.id,
    ).first()
    if not token or not account:
        raise HTTPException(status_code=400, detail="Meta account not connected")
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
def connect_meta(data: MetaConnect, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    account_id = data.ad_account_id if data.ad_account_id.startswith("act_") else f"act_{data.ad_account_id}"
    resp = httpx.get(
        f"{META_API_BASE}/{account_id}",
        params={"access_token": data.access_token, "fields": "name,currency,account_status"},
        timeout=10,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Invalid token or account ID")
        raise HTTPException(status_code=400, detail=msg)
    info = resp.json()
    _save_setting(db, user.id, "meta_access_token", data.access_token)
    _save_setting(db, user.id, "meta_ad_account_id", account_id)
    db.commit()
    return {
        "success": True,
        "account_name": info.get("name"),
        "currency": info.get("currency"),
        "account_id": account_id,
    }


@router.get("/status")
def meta_status(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token_s = db.query(models.AppSettings).filter(
        models.AppSettings.key == "meta_access_token", models.AppSettings.user_id == user.id
    ).first()
    account_s = db.query(models.AppSettings).filter(
        models.AppSettings.key == "meta_ad_account_id", models.AppSettings.user_id == user.id
    ).first()
    if not token_s or not account_s:
        return {"connected": False}
    resp = httpx.get(
        f"{META_API_BASE}/{account_s.value}",
        params={"access_token": token_s.value, "fields": "name,currency"},
        timeout=10,
    )
    if resp.status_code != 200:
        return {"connected": False, "error": "Token expired or invalid"}
    info = resp.json()
    return {
        "connected": True,
        "account_name": info.get("name"),
        "currency": info.get("currency"),
        "account_id": account_s.value,
    }


@router.delete("/disconnect")
def disconnect_meta(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    for key in ["meta_access_token", "meta_ad_account_id"]:
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
    token, account_id = _get_credentials(user, db)
    resp = httpx.get(
        f"{META_API_BASE}/{account_id}/campaigns",
        params={
            "access_token": token,
            "fields": "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,insights{spend}",
            "limit": 100,
        },
        timeout=15,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Failed to fetch campaigns")
        raise HTTPException(status_code=400, detail=msg)
    campaigns = []
    for c in resp.json().get("data", []):
        insights_data = c.get("insights", {}).get("data", [])
        spend = float(insights_data[0].get("spend", 0)) if insights_data else 0.0
        campaigns.append({
            "id": c["id"],
            "name": c["name"],
            "status": c["status"],
            "objective": c.get("objective", ""),
            "daily_budget_usd": round(int(c["daily_budget"]) / 100, 2) if c.get("daily_budget") else None,
            "lifetime_budget_usd": round(int(c["lifetime_budget"]) / 100, 2) if c.get("lifetime_budget") else None,
            "start_time": c.get("start_time"),
            "stop_time": c.get("stop_time"),
            "spend_all_time_usd": round(spend, 2),
        })
    return campaigns


@router.post("/campaigns/{campaign_id}/pause")
def pause_campaign(campaign_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, _ = _get_credentials(user, db)
    resp = httpx.post(
        f"{META_API_BASE}/{campaign_id}",
        params={"access_token": token},
        data={"status": "PAUSED"},
        timeout=10,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Failed to pause campaign")
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True}


@router.post("/campaigns/{campaign_id}/resume")
def resume_campaign(campaign_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, _ = _get_credentials(user, db)
    resp = httpx.post(
        f"{META_API_BASE}/{campaign_id}",
        params={"access_token": token},
        data={"status": "ACTIVE"},
        timeout=10,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Failed to resume campaign")
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True}


@router.post("/campaigns")
def create_campaign(data: CreateCampaignData, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, account_id = _get_credentials(user, db)
    if data.objective not in OBJECTIVES:
        raise HTTPException(status_code=400, detail=f"Invalid objective. Must be one of: {', '.join(OBJECTIVES)}")
    if not data.daily_budget and not data.lifetime_budget:
        raise HTTPException(status_code=400, detail="Either daily_budget or lifetime_budget is required")
    payload = {
        "name": data.name,
        "objective": data.objective,
        "status": data.status,
        "special_ad_categories": "[]",
    }
    if data.daily_budget:
        payload["daily_budget"] = str(int(data.daily_budget * 100))
    if data.lifetime_budget:
        payload["lifetime_budget"] = str(int(data.lifetime_budget * 100))
    if data.start_time:
        payload["start_time"] = data.start_time
    if data.stop_time:
        payload["stop_time"] = data.stop_time
    resp = httpx.post(
        f"{META_API_BASE}/{account_id}/campaigns",
        params={"access_token": token},
        data=payload,
        timeout=15,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Failed to create campaign")
        raise HTTPException(status_code=400, detail=msg)
    return resp.json()


# ── Spend / Insights ────────────────────────────────────────

@router.get("/spend")
def get_spend(start: str, end: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get real ad spend from Meta for a date range."""
    token, account_id = _get_credentials(user, db)
    resp = httpx.get(
        f"{META_API_BASE}/{account_id}/insights",
        params={
            "access_token": token,
            "fields": "spend,campaign_name,campaign_id",
            "time_range": f'{{"since":"{start}","until":"{end}"}}',
            "level": "campaign",
            "limit": 100,
        },
        timeout=15,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Failed to fetch spend data")
        raise HTTPException(status_code=400, detail=msg)
    data = resp.json().get("data", [])
    total = sum(float(d.get("spend", 0)) for d in data)
    breakdown = [
        {"campaign": d.get("campaign_name"), "spend_usd": round(float(d.get("spend", 0)), 2)}
        for d in data if float(d.get("spend", 0)) > 0
    ]
    return {"total_spend_usd": round(total, 2), "breakdown": breakdown, "start": start, "end": end}
