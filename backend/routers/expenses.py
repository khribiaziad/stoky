from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/expenses", tags=["expenses"])


VALID_TYPES = ("monthly", "annual", "per_order", "one_time")
VALID_CATEGORIES = ("operations", "packaging", "platform", "software", "equipment", "legal", "marketing", "other")

class FixedExpenseCreate(BaseModel):
    name: str
    type: str
    category: str = "other"
    amount: float
    description: Optional[str] = None
    start_date: Optional[str] = None


class AdPlatformCreate(BaseModel):
    name: str    # slug: facebook, tiktok, google, snapchat, etc.
    label: str   # display name
    color: str = "#1877f2"


class AdCampaignCreate(BaseModel):
    platform_id: int
    daily_rate_usd: float
    start_date: str
    end_date: Optional[str] = None


class WithdrawalCreate(BaseModel):
    amount: float
    description: Optional[str] = None
    date: Optional[str] = None


# ── Fixed Expenses ──────────────────────────────────────────

@router.get("/fixed")
def list_fixed_expenses(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    expenses = db.query(models.FixedExpense).filter(models.FixedExpense.user_id == user.id).order_by(models.FixedExpense.category, models.FixedExpense.name).all()
    return [
        {
            "id": e.id, "name": e.name, "type": e.type,
            "category": e.category or "other",
            "amount": e.amount, "description": e.description,
            "start_date": e.start_date.isoformat() if e.start_date else None,
            "is_active": e.is_active,
        }
        for e in expenses
    ]


@router.post("/fixed")
def create_fixed_expense(data: FixedExpenseCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if data.type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of: {', '.join(VALID_TYPES)}")
    expense = models.FixedExpense(
        user_id=user.id,
        name=data.name, type=data.type, category=data.category,
        amount=data.amount, description=data.description,
        start_date=datetime.fromisoformat(data.start_date) if data.start_date else datetime.now(),
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return {"id": expense.id}


@router.put("/fixed/{expense_id}")
def update_fixed_expense(expense_id: int, data: FixedExpenseCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    expense = db.query(models.FixedExpense).filter(models.FixedExpense.id == expense_id, models.FixedExpense.user_id == user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if data.type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of: {', '.join(VALID_TYPES)}")
    expense.name = data.name
    expense.type = data.type
    expense.category = data.category
    expense.amount = data.amount
    expense.description = data.description
    expense.start_date = datetime.fromisoformat(data.start_date) if data.start_date else expense.start_date
    db.commit()
    return {"success": True}


@router.patch("/fixed/{expense_id}/toggle")
def toggle_fixed_expense(expense_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    expense = db.query(models.FixedExpense).filter(models.FixedExpense.id == expense_id, models.FixedExpense.user_id == user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    expense.is_active = not expense.is_active
    db.commit()
    return {"is_active": expense.is_active}


@router.delete("/fixed/{expense_id}")
def delete_fixed_expense(expense_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    expense = db.query(models.FixedExpense).filter(models.FixedExpense.id == expense_id, models.FixedExpense.user_id == user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
    return {"success": True}


# ── Ad Platforms ────────────────────────────────────────────

@router.get("/platforms")
def list_platforms(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    platforms = db.query(models.AdPlatform).filter(models.AdPlatform.user_id == user.id).all()
    result = []
    for p in platforms:
        campaigns = []
        for c in p.campaigns:
            campaigns.append({
                "id": c.id,
                "daily_rate_usd": c.daily_rate_usd,
                "start_date": c.start_date.isoformat(),
                "end_date": c.end_date.isoformat() if c.end_date else None,
            })
        result.append({
            "id": p.id,
            "name": p.name,
            "label": p.label,
            "color": p.color,
            "campaigns": sorted(campaigns, key=lambda c: c["start_date"], reverse=True),
        })
    return result


@router.post("/platforms")
def create_platform(data: AdPlatformCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    existing = db.query(models.AdPlatform).filter(
        models.AdPlatform.user_id == user.id,
        models.AdPlatform.name == data.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Platform already added")
    platform = models.AdPlatform(user_id=user.id, name=data.name, label=data.label, color=data.color)
    db.add(platform)
    db.commit()
    db.refresh(platform)
    return {"id": platform.id}


@router.delete("/platforms/{platform_id}")
def delete_platform(platform_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    platform = db.query(models.AdPlatform).filter(
        models.AdPlatform.id == platform_id, models.AdPlatform.user_id == user.id
    ).first()
    if not platform:
        raise HTTPException(status_code=404, detail="Platform not found")
    db.delete(platform)
    db.commit()
    return {"success": True}


# ── Ad Campaigns (per platform) ──────────────────────────────

@router.post("/campaigns")
def create_campaign(data: AdCampaignCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    platform = db.query(models.AdPlatform).filter(
        models.AdPlatform.id == data.platform_id, models.AdPlatform.user_id == user.id
    ).first()
    if not platform:
        raise HTTPException(status_code=404, detail="Platform not found")
    # Auto-close previous open campaign for this platform
    prev = db.query(models.FacebookAd).filter(
        models.FacebookAd.platform_id == data.platform_id,
        models.FacebookAd.end_date == None,
    ).first()
    if prev:
        prev.end_date = datetime.fromisoformat(data.start_date)
    campaign = models.FacebookAd(
        user_id=user.id,
        platform_id=data.platform_id,
        platform=platform.name,
        daily_rate_usd=data.daily_rate_usd,
        start_date=datetime.fromisoformat(data.start_date),
        end_date=datetime.fromisoformat(data.end_date) if data.end_date else None,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return {"id": campaign.id}


@router.put("/campaigns/{campaign_id}")
def update_campaign(campaign_id: int, data: AdCampaignCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    campaign = db.query(models.FacebookAd).filter(
        models.FacebookAd.id == campaign_id, models.FacebookAd.user_id == user.id
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.daily_rate_usd = data.daily_rate_usd
    campaign.start_date = datetime.fromisoformat(data.start_date)
    campaign.end_date = datetime.fromisoformat(data.end_date) if data.end_date else None
    db.commit()
    return {"success": True}


@router.delete("/campaigns/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    campaign = db.query(models.FacebookAd).filter(
        models.FacebookAd.id == campaign_id, models.FacebookAd.user_id == user.id
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()
    return {"success": True}


@router.get("/cost-per-order")
def cost_per_order(start: str, end: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Calculate total ad spend and cost per order for a date range, using order_date.
    If Meta is connected, uses real Meta spend. Manual platforms cover non-Meta spend."""
    import httpx
    from auth import get_store_id
    start_dt = datetime.fromisoformat(start)
    end_dt = datetime.fromisoformat(end).replace(hour=23, minute=59, second=59)

    # Count orders in range using order_date
    order_count = db.query(models.Order).filter(
        models.Order.user_id == get_store_id(user),
        models.Order.order_date >= start_dt,
        models.Order.order_date <= end_dt,
        models.Order.status != "cancelled",
    ).count()

    total_usd = 0.0
    breakdown = []

    # ── Real Meta spend (if connected) ──────────────────────────
    meta_token = db.query(models.AppSettings).filter(
        models.AppSettings.key == "meta_access_token",
        models.AppSettings.user_id == user.id,
    ).first()
    meta_account = db.query(models.AppSettings).filter(
        models.AppSettings.key == "meta_ad_account_id",
        models.AppSettings.user_id == user.id,
    ).first()

    meta_connected = bool(meta_token and meta_account)
    if meta_connected:
        try:
            resp = httpx.get(
                f"https://graph.facebook.com/v19.0/{meta_account.value}/insights",
                params={
                    "access_token": meta_token.value,
                    "fields": "spend",
                    "time_range": f'{{"since":"{start}","until":"{end}"}}',
                    "level": "account",
                },
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                meta_spend = sum(float(d.get("spend", 0)) for d in data)
                if meta_spend > 0:
                    total_usd += meta_spend
                    breakdown.append({"platform": "Meta Ads", "color": "#0866FF", "total_usd": round(meta_spend, 2)})
        except Exception:
            pass  # fall back to manual if Meta call fails

    # ── Manual platforms (skip facebook platform if Meta is connected) ──
    platforms = db.query(models.AdPlatform).filter(models.AdPlatform.user_id == user.id).all()
    for p in platforms:
        # Skip facebook manual tracking if Meta API is connected
        if meta_connected and p.name == "facebook":
            continue
        platform_usd = 0.0
        for c in p.campaigns:
            c_start = c.start_date
            c_end = c.end_date if c.end_date else datetime.now()
            overlap_start = max(c_start, start_dt)
            overlap_end = min(c_end, end_dt)
            if overlap_end > overlap_start:
                days = (overlap_end - overlap_start).days + 1
                platform_usd += days * c.daily_rate_usd
        total_usd += platform_usd
        if platform_usd > 0:
            breakdown.append({"platform": p.label, "color": p.color, "total_usd": round(platform_usd, 2)})

    return {
        "start": start,
        "end": end,
        "order_count": order_count,
        "total_usd": round(total_usd, 2),
        "breakdown": breakdown,
        "meta_connected": meta_connected,
    }


# ── Legacy facebook-ads endpoints (keep for backwards compat) ──

@router.get("/facebook-ads")
def list_facebook_ads(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    ads = db.query(models.FacebookAd).filter(models.FacebookAd.user_id == user.id).order_by(models.FacebookAd.start_date.desc()).all()
    return [
        {"id": a.id, "daily_rate_usd": a.daily_rate_usd, "start_date": a.start_date.isoformat(),
         "end_date": a.end_date.isoformat() if a.end_date else None}
        for a in ads
    ]


# ── Withdrawals ─────────────────────────────────────────────

@router.get("/withdrawals")
def list_withdrawals(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    withdrawals = db.query(models.Withdrawal).filter(models.Withdrawal.user_id == user.id).order_by(models.Withdrawal.date.desc()).all()
    return [
        {"id": w.id, "amount": w.amount, "description": w.description, "type": w.type,
         "date": w.date.isoformat() if w.date else None}
        for w in withdrawals
    ]


@router.post("/withdrawals")
def create_withdrawal(data: WithdrawalCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    withdrawal = models.Withdrawal(
        user_id=user.id,
        amount=data.amount, description=data.description, type="manual",
        date=datetime.fromisoformat(data.date) if data.date else datetime.now(),
    )
    db.add(withdrawal)
    db.commit()
    db.refresh(withdrawal)
    return {"id": withdrawal.id}


@router.delete("/withdrawals/{withdrawal_id}")
def delete_withdrawal(withdrawal_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    withdrawal = db.query(models.Withdrawal).filter(models.Withdrawal.id == withdrawal_id, models.Withdrawal.user_id == user.id).first()
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if withdrawal.type == "stock_purchase":
        raise HTTPException(status_code=400, detail="Cannot delete automatic stock purchase withdrawal")
    db.delete(withdrawal)
    db.commit()
    return {"success": True}
