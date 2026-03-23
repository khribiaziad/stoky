from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import httpx
import json
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/tiktok", tags=["tiktok"])

TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3"


class TikTokConnect(BaseModel):
    access_token: str
    advertiser_id: str


def _get_credentials(user: models.User, db: Session):
    token = db.query(models.AppSettings).filter(
        models.AppSettings.key == "tiktok_access_token",
        models.AppSettings.user_id == user.id,
    ).first()
    advertiser = db.query(models.AppSettings).filter(
        models.AppSettings.key == "tiktok_advertiser_id",
        models.AppSettings.user_id == user.id,
    ).first()
    if not token or not advertiser:
        raise HTTPException(status_code=400, detail="TikTok account not connected")
    return token.value, advertiser.value


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
def connect_tiktok(data: TikTokConnect, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    resp = httpx.get(
        f"{TIKTOK_API_BASE}/advertiser/info/",
        params={"advertiser_ids": json.dumps([data.advertiser_id])},
        headers={"Access-Token": data.access_token},
        timeout=15,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to reach TikTok API")
    body = resp.json()
    code = body.get("code", -1)
    if code != 0:
        msg = body.get("message", "Invalid token or advertiser ID")
        raise HTTPException(status_code=400, detail=msg)
    advertiser_list = body.get("data", {}).get("list", [])
    if not advertiser_list:
        raise HTTPException(status_code=400, detail="Advertiser not found")
    info = advertiser_list[0]
    _save_setting(db, user.id, "tiktok_access_token", data.access_token)
    _save_setting(db, user.id, "tiktok_advertiser_id", data.advertiser_id)
    db.commit()
    return {
        "success": True,
        "account_name": info.get("advertiser_name"),
        "currency": info.get("currency"),
        "advertiser_id": data.advertiser_id,
    }


@router.get("/status")
def tiktok_status(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token_s = db.query(models.AppSettings).filter(
        models.AppSettings.key == "tiktok_access_token", models.AppSettings.user_id == user.id
    ).first()
    advertiser_s = db.query(models.AppSettings).filter(
        models.AppSettings.key == "tiktok_advertiser_id", models.AppSettings.user_id == user.id
    ).first()
    if not token_s or not advertiser_s:
        return {"connected": False}
    resp = httpx.get(
        f"{TIKTOK_API_BASE}/advertiser/info/",
        params={"advertiser_ids": json.dumps([advertiser_s.value])},
        headers={"Access-Token": token_s.value},
        timeout=15,
    )
    if resp.status_code != 200 or resp.json().get("code", -1) != 0:
        return {"connected": False, "error": "Token expired or invalid"}
    advertiser_list = resp.json().get("data", {}).get("list", [])
    info = advertiser_list[0] if advertiser_list else {}
    return {
        "connected": True,
        "account_name": info.get("advertiser_name"),
        "currency": info.get("currency"),
        "advertiser_id": advertiser_s.value,
    }


@router.delete("/disconnect")
def disconnect_tiktok(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    for key in ["tiktok_access_token", "tiktok_advertiser_id"]:
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
    token, advertiser_id = _get_credentials(user, db)
    resp = httpx.get(
        f"{TIKTOK_API_BASE}/campaign/get/",
        params={
            "advertiser_id": advertiser_id,
            "fields": json.dumps([
                "campaign_id", "campaign_name", "status",
                "budget", "budget_mode", "objective_type", "create_time",
            ]),
            "page_size": 100,
        },
        headers={"Access-Token": token},
        timeout=15,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to reach TikTok API")
    body = resp.json()
    if body.get("code", -1) != 0:
        raise HTTPException(status_code=400, detail=body.get("message", "Failed to fetch campaigns"))
    campaigns = []
    for c in body.get("data", {}).get("list", []):
        campaigns.append({
            "id": c.get("campaign_id"),
            "name": c.get("campaign_name"),
            "status": c.get("status"),
            "budget": c.get("budget"),
            "budget_mode": c.get("budget_mode"),
            "objective_type": c.get("objective_type"),
            "create_time": c.get("create_time"),
        })
    return campaigns


@router.post("/campaigns/{campaign_id}/pause")
def pause_campaign(campaign_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, advertiser_id = _get_credentials(user, db)
    resp = httpx.post(
        f"{TIKTOK_API_BASE}/campaign/status/update/",
        headers={"Access-Token": token, "Content-Type": "application/json"},
        json={
            "advertiser_id": advertiser_id,
            "campaign_ids": [campaign_id],
            "operation_status": "DISABLE",
        },
        timeout=15,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to reach TikTok API")
    body = resp.json()
    if body.get("code", -1) != 0:
        raise HTTPException(status_code=400, detail=body.get("message", "Failed to pause campaign"))
    return {"success": True}


@router.post("/campaigns/{campaign_id}/resume")
def resume_campaign(campaign_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    token, advertiser_id = _get_credentials(user, db)
    resp = httpx.post(
        f"{TIKTOK_API_BASE}/campaign/status/update/",
        headers={"Access-Token": token, "Content-Type": "application/json"},
        json={
            "advertiser_id": advertiser_id,
            "campaign_ids": [campaign_id],
            "operation_status": "ENABLE",
        },
        timeout=15,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to reach TikTok API")
    body = resp.json()
    if body.get("code", -1) != 0:
        raise HTTPException(status_code=400, detail=body.get("message", "Failed to resume campaign"))
    return {"success": True}


# ── Spend / Reporting ────────────────────────────────────────

@router.get("/spend")
def get_spend(start: str, end: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get ad spend from TikTok for a date range (YYYY-MM-DD)."""
    token, advertiser_id = _get_credentials(user, db)
    resp = httpx.post(
        f"{TIKTOK_API_BASE}/report/integrated/get/",
        headers={"Access-Token": token, "Content-Type": "application/json"},
        json={
            "advertiser_id": advertiser_id,
            "report_type": "BASIC",
            "dimensions": ["campaign_id", "campaign_name"],
            "metrics": ["spend"],
            "start_date": start,
            "end_date": end,
            "page_size": 100,
        },
        timeout=15,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to reach TikTok API")
    body = resp.json()
    if body.get("code", -1) != 0:
        raise HTTPException(status_code=400, detail=body.get("message", "Failed to fetch spend data"))
    rows = body.get("data", {}).get("list", [])
    total = sum(float(r.get("metrics", {}).get("spend", 0)) for r in rows)
    breakdown = [
        {
            "campaign_id": r.get("dimensions", {}).get("campaign_id"),
            "campaign": r.get("dimensions", {}).get("campaign_name"),
            "spend_usd": round(float(r.get("metrics", {}).get("spend", 0)), 2),
        }
        for r in rows
        if float(r.get("metrics", {}).get("spend", 0)) > 0
    ]
    return {"total_spend_usd": round(total, 2), "breakdown": breakdown, "start": start, "end": end}
