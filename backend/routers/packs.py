from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from auth import get_current_user, get_store_id
import models

router = APIRouter(prefix="/packs", tags=["packs"])


class PackPresetItemInput(BaseModel):
    variant_id: int
    quantity: int = 1


class PackPresetInput(BaseModel):
    name: str
    items: List[PackPresetItemInput]


class PackCreate(BaseModel):
    name: str
    selling_price: float
    packaging_cost: float = 0
    item_count: int = 1
    product_id: Optional[int] = None
    is_active: bool = True


def serialize_pack(pack: models.Pack, db: Session) -> dict:
    presets = []
    for preset in pack.presets:
        preset_items = []
        for item in preset.items:
            variant = db.query(models.Variant).filter(models.Variant.id == item.variant_id).first()
            if variant:
                preset_items.append({
                    "id": item.id,
                    "variant_id": item.variant_id,
                    "quantity": item.quantity,
                    "label": f"{variant.product.name}{' · ' + variant.size if variant.size else ''}{' · ' + variant.color if variant.color else ''}",
                    "stock": variant.stock,
                    "buying_price": variant.buying_price,
                })
        presets.append({
            "id": preset.id,
            "name": preset.name,
            "items": preset_items,
        })

    product_name = None
    if pack.product_id:
        product = db.query(models.Product).filter(models.Product.id == pack.product_id).first()
        if product:
            product_name = product.name

    return {
        "id": pack.id,
        "name": pack.name,
        "selling_price": pack.selling_price,
        "packaging_cost": pack.packaging_cost or 0,
        "item_count": pack.item_count,
        "product_id": pack.product_id,
        "product_name": product_name,
        "is_active": pack.is_active if pack.is_active is not None else True,
        "presets": presets,
    }


@router.get("")
def list_packs(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    packs = db.query(models.Pack).filter(models.Pack.user_id == get_store_id(user)).all()
    return [serialize_pack(p, db) for p in packs]


@router.post("")
def create_pack(data: PackCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot create packs")
    pack = models.Pack(
        user_id=get_store_id(user),
        name=data.name,
        selling_price=data.selling_price,
        packaging_cost=data.packaging_cost,
        item_count=data.item_count,
        product_id=data.product_id,
        is_active=data.is_active,
    )
    db.add(pack)
    db.commit()
    db.refresh(pack)
    return serialize_pack(pack, db)


@router.put("/{pack_id}")
def update_pack(pack_id: int, data: PackCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot edit packs")
    pack = db.query(models.Pack).filter(models.Pack.id == pack_id, models.Pack.user_id == get_store_id(user)).first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    pack.name = data.name
    pack.selling_price = data.selling_price
    pack.packaging_cost = data.packaging_cost
    pack.item_count = data.item_count
    pack.product_id = data.product_id
    pack.is_active = data.is_active
    db.commit()
    return serialize_pack(pack, db)


@router.patch("/{pack_id}/toggle")
def toggle_pack(pack_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    pack = db.query(models.Pack).filter(models.Pack.id == pack_id, models.Pack.user_id == get_store_id(user)).first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    pack.is_active = not pack.is_active
    db.commit()
    return {"is_active": pack.is_active}


@router.delete("/{pack_id}")
def delete_pack(pack_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot delete packs")
    pack = db.query(models.Pack).filter(models.Pack.id == pack_id, models.Pack.user_id == get_store_id(user)).first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    db.delete(pack)
    db.commit()
    return {"success": True}


@router.post("/{pack_id}/presets")
def add_preset(pack_id: int, data: PackPresetInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot add presets")
    pack = db.query(models.Pack).filter(models.Pack.id == pack_id, models.Pack.user_id == get_store_id(user)).first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")

    preset = models.PackPreset(pack_id=pack_id, name=data.name)
    db.add(preset)
    db.flush()

    for item in data.items:
        preset_item = models.PackPresetItem(
            preset_id=preset.id,
            variant_id=item.variant_id,
            quantity=item.quantity,
        )
        db.add(preset_item)

    db.commit()
    db.refresh(pack)
    return serialize_pack(pack, db)


@router.delete("/presets/{preset_id}")
def delete_preset(preset_id: int, db: Session = Depends(get_db)):
    preset = db.query(models.PackPreset).filter(models.PackPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    db.delete(preset)
    db.commit()
    return {"success": True}
