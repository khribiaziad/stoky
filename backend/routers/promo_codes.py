from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_db
from auth import get_current_user, get_store_id
import models

router = APIRouter(prefix="/promo-codes", tags=["promo_codes"])


class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str          # "percentage" or "fixed"
    discount_value: float
    min_order_value: Optional[float] = None
    usage_limit: Optional[int] = None   # null = unlimited
    expiry_date: Optional[str] = None
    applies_to: str = "all"            # "all", "products", "packs"
    target_ids: Optional[List[int]] = None
    is_active: bool = True


def serialize_promo(p: models.PromoCode) -> dict:
    return {
        "id": p.id,
        "code": p.code,
        "discount_type": p.discount_type,
        "discount_value": p.discount_value,
        "min_order_value": p.min_order_value,
        "usage_limit": p.usage_limit,
        "used_count": p.used_count or 0,
        "expiry_date": p.expiry_date.isoformat()[:10] if p.expiry_date else None,
        "applies_to": p.applies_to,
        "target_ids": p.target_ids or [],
        "is_active": p.is_active if p.is_active is not None else True,
    }


@router.get("")
def list_promo_codes(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    codes = db.query(models.PromoCode).filter(
        models.PromoCode.user_id == get_store_id(user)
    ).order_by(models.PromoCode.created_at.desc()).all()
    return [serialize_promo(c) for c in codes]


@router.post("")
def create_promo_code(data: PromoCodeCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot create promo codes")
    if data.discount_type not in ("percentage", "fixed"):
        raise HTTPException(status_code=400, detail="discount_type must be 'percentage' or 'fixed'")
    if data.discount_type == "percentage" and not (0 < data.discount_value <= 100):
        raise HTTPException(status_code=400, detail="Percentage must be between 1 and 100")
    promo = models.PromoCode(
        user_id=user.id,
        code=data.code.upper().strip(),
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        min_order_value=data.min_order_value,
        usage_limit=data.usage_limit,
        expiry_date=datetime.fromisoformat(data.expiry_date) if data.expiry_date else None,
        applies_to=data.applies_to,
        target_ids=data.target_ids,
        is_active=data.is_active,
        used_count=0,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return serialize_promo(promo)


@router.put("/{promo_id}")
def update_promo_code(promo_id: int, data: PromoCodeCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot edit promo codes")
    promo = db.query(models.PromoCode).filter(
        models.PromoCode.id == promo_id, models.PromoCode.user_id == user.id
    ).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")
    if data.discount_type not in ("percentage", "fixed"):
        raise HTTPException(status_code=400, detail="discount_type must be 'percentage' or 'fixed'")
    promo.code = data.code.upper().strip()
    promo.discount_type = data.discount_type
    promo.discount_value = data.discount_value
    promo.min_order_value = data.min_order_value
    promo.usage_limit = data.usage_limit
    promo.expiry_date = datetime.fromisoformat(data.expiry_date) if data.expiry_date else None
    promo.applies_to = data.applies_to
    promo.target_ids = data.target_ids
    promo.is_active = data.is_active
    db.commit()
    return serialize_promo(promo)


@router.patch("/{promo_id}/toggle")
def toggle_promo_code(promo_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    promo = db.query(models.PromoCode).filter(
        models.PromoCode.id == promo_id, models.PromoCode.user_id == user.id
    ).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")
    promo.is_active = not promo.is_active
    db.commit()
    return {"is_active": promo.is_active}


@router.delete("/{promo_id}")
def delete_promo_code(promo_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot delete promo codes")
    promo = db.query(models.PromoCode).filter(
        models.PromoCode.id == promo_id, models.PromoCode.user_id == user.id
    ).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")
    db.delete(promo)
    db.commit()
    return {"success": True}
