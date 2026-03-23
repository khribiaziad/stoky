from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import httpx
import json
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
    daily_budget: Optional[float] = None
    lifetime_budget: Optional[float] = None
    start_time: Optional[str] = None
    stop_time: Optional[str] = None
    status: str = "PAUSED"


class TargetingData(BaseModel):
    countries: List[str] = ["MA"]
    age_min: int = 18
    age_max: int = 65
    genders: List[int] = []  # empty=all, 1=male, 2=female
    interests: List[dict] = []  # [{"id": "...", "name": "..."}]
    placements: List[str] = ["facebook_feed", "instagram_feed"]  # facebook_feed, facebook_story, instagram_feed, instagram_story, instagram_reels


class CreativeData(BaseModel):
    page_id: str
    headline: str = ""
    body: str = ""
    cta: str = "SHOP_NOW"  # SHOP_NOW, LEARN_MORE, CONTACT_US, WHATSAPP_MESSAGE, SIGN_UP
    url: str = ""
    whatsapp_number: str = ""
    image_hash: str = ""        # from uploaded image
    image_url: str = ""         # external image URL
    video_id: str = ""          # from uploaded video/reel
    existing_post_id: str = ""  # use an existing page post/reel


class FullCampaignCreate(BaseModel):
    # Step 1 — Campaign
    campaign_name: str
    objective: str = "OUTCOME_SALES"
    budget_type: str = "daily"   # daily | lifetime
    budget_usd: float
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    # Step 2 — Audience
    targeting: TargetingData = TargetingData()
    # Step 3+4 — Creative
    adset_name: str = ""
    ad_name: str = ""
    creative: CreativeData
    status: str = "PAUSED"


# Optimization goal per objective
OPTIM_GOAL = {
    "OUTCOME_SALES":       "LINK_CLICKS",
    "OUTCOME_TRAFFIC":     "LINK_CLICKS",
    "OUTCOME_LEADS":       "LEAD_GENERATION",
    "OUTCOME_AWARENESS":   "REACH",
    "OUTCOME_ENGAGEMENT":  "POST_ENGAGEMENT",
    "OUTCOME_APP_PROMOTION": "APP_INSTALLS",
}


def _build_targeting(t: TargetingData) -> dict:
    targeting = {
        "geo_locations": {"countries": t.countries},
        "age_min": t.age_min,
        "age_max": t.age_max,
    }
    if t.genders:
        targeting["genders"] = t.genders
    if t.interests:
        targeting["flexible_spec"] = [{"interests": t.interests}]

    publisher_platforms = set()
    facebook_positions = []
    instagram_positions = []

    for p in t.placements:
        if p == "facebook_feed":
            publisher_platforms.add("facebook")
            facebook_positions.append("feed")
        elif p == "facebook_story":
            publisher_platforms.add("facebook")
            facebook_positions.append("story")
        elif p == "instagram_feed":
            publisher_platforms.add("instagram")
            instagram_positions.append("stream")
        elif p == "instagram_story":
            publisher_platforms.add("instagram")
            instagram_positions.append("story")
        elif p == "instagram_reels":
            publisher_platforms.add("instagram")
            instagram_positions.append("reels")

    if publisher_platforms:
        targeting["publisher_platforms"] = list(publisher_platforms)
    if facebook_positions:
        targeting["facebook_positions"] = list(set(facebook_positions))
    if instagram_positions:
        targeting["instagram_positions"] = list(set(instagram_positions))

    return targeting


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


# ── Ad Accounts list (for connect flow) ─────────────────────

@router.get("/adaccounts")
def get_ad_accounts(token: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Fetch all ad accounts accessible to a given token."""
    resp = httpx.get(
        f"{META_API_BASE}/me/adaccounts",
        params={"access_token": token, "fields": "id,name,account_status,currency", "limit": 50},
        timeout=10,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Invalid token")
        raise HTTPException(status_code=400, detail=msg)
    return resp.json().get("data", [])


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
        {"campaign_id": d.get("campaign_id"), "campaign": d.get("campaign_name"), "spend_usd": round(float(d.get("spend", 0)), 2)}
        for d in data if float(d.get("spend", 0)) > 0
    ]
    return {"total_spend_usd": round(total, 2), "breakdown": breakdown, "start": start, "end": end}


# ── Pages ────────────────────────────────────────────────────

@router.get("/pages")
def get_pages(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get user's Facebook Pages."""
    token, _ = _get_credentials(user, db)
    resp = httpx.get(
        f"{META_API_BASE}/me/accounts",
        params={"access_token": token, "fields": "id,name,picture"},
        timeout=10,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Failed to fetch pages")
        raise HTTPException(status_code=400, detail=msg)
    return resp.json().get("data", [])


# ── Interest search ──────────────────────────────────────────

@router.get("/interests")
def search_interests(q: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Search Meta interest targeting options."""
    token, _ = _get_credentials(user, db)
    resp = httpx.get(
        f"{META_API_BASE}/search",
        params={"access_token": token, "type": "adinterest", "q": q, "limit": 20},
        timeout=10,
    )
    if resp.status_code != 200:
        return []
    return resp.json().get("data", [])


# ── Image upload ─────────────────────────────────────────────

@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Upload an image to Meta Ad Images."""
    token, account_id = _get_credentials(user, db)
    contents = await file.read()
    resp = httpx.post(
        f"{META_API_BASE}/{account_id}/adimages",
        params={"access_token": token},
        files={"filename": (file.filename, contents, file.content_type)},
        timeout=30,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Failed to upload image")
        raise HTTPException(status_code=400, detail=msg)
    images = resp.json().get("images", {})
    first = list(images.values())[0] if images else {}
    return {"hash": first.get("hash"), "url": first.get("url")}


# ── Video upload ─────────────────────────────────────────────

@router.post("/upload-video")
async def upload_video(file: UploadFile = File(...), db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Upload a video to Meta Ad Videos."""
    token, account_id = _get_credentials(user, db)
    contents = await file.read()
    resp = httpx.post(
        f"{META_API_BASE}/{account_id}/advideos",
        params={"access_token": token},
        files={"source": (file.filename, contents, file.content_type)},
        timeout=120,
    )
    if resp.status_code != 200:
        msg = resp.json().get("error", {}).get("message", "Failed to upload video")
        raise HTTPException(status_code=400, detail=msg)
    data = resp.json()
    return {"video_id": data.get("id")}


# ── Full campaign wizard ─────────────────────────────────────

@router.post("/full-campaign")
def create_full_campaign(data: FullCampaignCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Create a full campaign: Campaign → Ad Set → Ad Creative → Ad."""
    token, account_id = _get_credentials(user, db)

    # ── 1. Campaign ──────────────────────────────────────────
    campaign_payload = {
        "name": data.campaign_name,
        "objective": data.objective,
        "status": data.status,
        "special_ad_categories": "[]",
    }
    if data.budget_type == "daily":
        campaign_payload["daily_budget"] = str(int(data.budget_usd * 100))
    else:
        campaign_payload["lifetime_budget"] = str(int(data.budget_usd * 100))
    if data.start_time:
        campaign_payload["start_time"] = data.start_time
    if data.end_time:
        campaign_payload["stop_time"] = data.end_time

    r = httpx.post(f"{META_API_BASE}/{account_id}/campaigns", params={"access_token": token}, data=campaign_payload, timeout=15)
    if r.status_code != 200:
        err = r.json().get("error", {})
        raise HTTPException(status_code=400, detail=f"Campaign: {err.get('error_user_msg') or err.get('message', 'Failed to create campaign')}")
    campaign_id = r.json()["id"]

    # ── 2. Ad Set ────────────────────────────────────────────
    targeting_spec = _build_targeting(data.targeting)
    adset_payload = {
        "name": data.adset_name or f"{data.campaign_name} - Ad Set",
        "campaign_id": campaign_id,
        "targeting": json.dumps(targeting_spec),
        "optimization_goal": OPTIM_GOAL.get(data.objective, "LINK_CLICKS"),
        "billing_event": "IMPRESSIONS",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "status": data.status,
    }
    if data.budget_type == "daily":
        adset_payload["daily_budget"] = str(int(data.budget_usd * 100))
    else:
        adset_payload["lifetime_budget"] = str(int(data.budget_usd * 100))
        if data.end_time:
            adset_payload["end_time"] = data.end_time
    if data.start_time:
        adset_payload["start_time"] = data.start_time

    r = httpx.post(f"{META_API_BASE}/{account_id}/adsets", params={"access_token": token}, data=adset_payload, timeout=15)
    if r.status_code != 200:
        err = r.json().get("error", {})
        raise HTTPException(status_code=400, detail=f"Ad Set: {err.get('error_user_msg') or err.get('message', 'Failed to create ad set')}")
    adset_id = r.json()["id"]

    # ── 3. Ad Creative ───────────────────────────────────────
    creative_payload = {"name": f"{data.campaign_name} - Creative"}

    if data.creative.existing_post_id:
        # Use an existing page post or Reel — user provides full PAGE_ID_POST_ID
        creative_payload["object_story_id"] = data.creative.existing_post_id
    elif data.creative.video_id:
        # Video / Reel creative
        video_data = {
            "video_id": data.creative.video_id,
            "message": data.creative.body,
            "title": data.creative.headline,
        }
        if data.creative.cta == "WHATSAPP_MESSAGE" and data.creative.whatsapp_number:
            video_data["call_to_action"] = json.dumps({
                "type": "WHATSAPP_MESSAGE",
                "value": {"app_destination": "WHATSAPP", "whatsapp_number": data.creative.whatsapp_number},
            })
        elif data.creative.cta and data.creative.url:
            video_data["call_to_action"] = json.dumps({
                "type": data.creative.cta,
                "value": {"link": data.creative.url},
            })
        creative_payload["object_story_spec"] = json.dumps({"page_id": data.creative.page_id, "video_data": video_data})
    else:
        link_data = {
            "message": data.creative.body,
            "name": data.creative.headline,
            "link": data.creative.url or "https://www.facebook.com",
        }
        if data.creative.image_hash:
            link_data["image_hash"] = data.creative.image_hash
        elif data.creative.image_url:
            link_data["picture"] = data.creative.image_url

        if data.creative.cta == "WHATSAPP_MESSAGE" and data.creative.whatsapp_number:
            wa_number = data.creative.whatsapp_number.lstrip("+")
            link_data["call_to_action"] = json.dumps({
                "type": "WHATSAPP_MESSAGE",
                "value": {"app_destination": "WHATSAPP", "whatsapp_number": wa_number},
            })
        elif data.creative.cta and data.creative.url:
            link_data["call_to_action"] = json.dumps({
                "type": data.creative.cta,
                "value": {"link": data.creative.url},
            })

        creative_payload["object_story_spec"] = json.dumps({"page_id": data.creative.page_id, "link_data": link_data})
    r = httpx.post(f"{META_API_BASE}/{account_id}/adcreatives", params={"access_token": token}, data=creative_payload, timeout=15)
    if r.status_code != 200:
        err = r.json().get("error", {})
        raise HTTPException(status_code=400, detail=f"Creative: {err.get('error_user_msg') or err.get('message', 'Failed to create ad creative')}")
    creative_id = r.json()["id"]

    # ── 4. Ad ────────────────────────────────────────────────
    ad_payload = {
        "name": data.ad_name or f"{data.campaign_name} - Ad",
        "adset_id": adset_id,
        "creative": json.dumps({"creative_id": creative_id}),
        "status": data.status,
    }
    r = httpx.post(f"{META_API_BASE}/{account_id}/ads", params={"access_token": token}, data=ad_payload, timeout=15)
    if r.status_code != 200:
        err = r.json().get("error", {})
        raise HTTPException(status_code=400, detail=f"Ad: {err.get('error_user_msg') or err.get('message', 'Failed to create ad')}")

    return {
        "success": True,
        "campaign_id": campaign_id,
        "adset_id": adset_id,
        "creative_id": creative_id,
        "ad_id": r.json()["id"],
    }
