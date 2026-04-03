from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_db
from auth import get_current_user, get_store_id
import models

router = APIRouter(prefix="/offers", tags=["offers"])


class OfferItemInput(BaseModel):
    variant_id: int
    quantity: int = 1


class OfferCreate(BaseModel):
    name: str
    selling_price: float
    packaging_cost: float = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True
    items: List[OfferItemInput]


def serialize_offer(offer: models.Offer, db: Session) -> dict:
    items = []
    for item in offer.items:
        variant = db.query(models.Variant).filter(models.Variant.id == item.variant_id).first()
        if variant:
            items.append({
                "id": item.id,
                "variant_id": item.variant_id,
                "quantity": item.quantity,
                "label": f"{variant.product.name}{' · ' + variant.size if variant.size else ''}{' · ' + variant.color if variant.color else ''}",
                "stock": variant.stock,
                "buying_price": variant.buying_price,
            })
    return {
        "id": offer.id,
        "name": offer.name,
        "selling_price": offer.selling_price,
        "packaging_cost": offer.packaging_cost or 0,
        "start_date": offer.start_date.isoformat()[:10] if offer.start_date else None,
        "end_date": offer.end_date.isoformat()[:10] if offer.end_date else None,
        "is_active": offer.is_active if offer.is_active is not None else True,
        "items": items,
    }


@router.get("")
def list_offers(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    offers = db.query(models.Offer).filter(models.Offer.user_id == get_store_id(user)).order_by(models.Offer.created_at.desc()).all()
    return [serialize_offer(o, db) for o in offers]


@router.post("")
def create_offer(data: OfferCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot create offers")
    if not data.items:
        raise HTTPException(status_code=400, detail="An offer must have at least one product")
    offer = models.Offer(
        user_id=user.id,
        name=data.name,
        selling_price=data.selling_price,
        packaging_cost=data.packaging_cost,
        start_date=datetime.fromisoformat(data.start_date) if data.start_date else None,
        end_date=datetime.fromisoformat(data.end_date) if data.end_date else None,
        is_active=data.is_active,
    )
    db.add(offer)
    db.flush()
    for item in data.items:
        db.add(models.OfferItem(offer_id=offer.id, variant_id=item.variant_id, quantity=item.quantity))
    db.commit()
    db.refresh(offer)
    return serialize_offer(offer, db)


@router.put("/{offer_id}")
def update_offer(offer_id: int, data: OfferCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot edit offers")
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id, models.Offer.user_id == user.id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if not data.items:
        raise HTTPException(status_code=400, detail="An offer must have at least one product")
    offer.name = data.name
    offer.selling_price = data.selling_price
    offer.packaging_cost = data.packaging_cost
    offer.start_date = datetime.fromisoformat(data.start_date) if data.start_date else None
    offer.end_date = datetime.fromisoformat(data.end_date) if data.end_date else None
    offer.is_active = data.is_active
    db.query(models.OfferItem).filter(models.OfferItem.offer_id == offer_id).delete()
    for item in data.items:
        db.add(models.OfferItem(offer_id=offer_id, variant_id=item.variant_id, quantity=item.quantity))
    db.commit()
    db.refresh(offer)
    return serialize_offer(offer, db)


@router.patch("/{offer_id}/toggle")
def toggle_offer(offer_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id, models.Offer.user_id == get_store_id(user)).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    offer.is_active = not offer.is_active
    db.commit()
    return {"is_active": offer.is_active}


@router.delete("/{offer_id}")
def delete_offer(offer_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot delete offers")
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id, models.Offer.user_id == user.id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    db.delete(offer)
    db.commit()
    return {"success": True}
