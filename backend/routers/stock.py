from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from auth import get_current_user, get_store_id
import models

router = APIRouter(prefix="/stock", tags=["stock"])


class ArrivalItem(BaseModel):
    variant_id: int
    quantity: int


class BulkStockArrivalCreate(BaseModel):
    items: List[ArrivalItem]
    additional_fees: float = 0
    description: Optional[str] = None
    date: Optional[str] = None


class BrokenStockCreate(BaseModel):
    variant_id: int
    quantity: int
    source: str = "storage"
    source_order_id: Optional[int] = None
    returnable_to_supplier: bool = False


@router.get("/arrivals")
def list_arrivals(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    arrivals = db.query(models.StockArrival).filter(models.StockArrival.user_id == get_store_id(user)).order_by(models.StockArrival.date.desc()).all()
    result = []
    for a in arrivals:
        variant = a.variant
        result.append({
            "id": a.id,
            "batch_id": a.description,
            "variant_id": a.variant_id,
            "product_name": (variant.product.name if variant and variant.product else "") if variant else "",
            "size": variant.size if variant else "",
            "color": variant.color if variant else "",
            "quantity": a.quantity,
            "additional_fees": a.additional_fees,
            "total_cost": a.total_cost,
            "description": a.description,
            "date": a.date.isoformat() if a.date else None,
        })
    return result


@router.post("/arrivals")
def add_bulk_stock(data: BulkStockArrivalCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot add stock")
    if not data.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    arrival_date = datetime.fromisoformat(data.date) if data.date else datetime.now()
    stock_cost = 0.0
    variants = []

    for item in data.items:
        variant = db.query(models.Variant).filter(
            models.Variant.id == item.variant_id,
            models.Variant.product_id.in_(
                db.query(models.Product.id).filter(models.Product.user_id == user.id)
            )
        ).first()
        if not variant:
            raise HTTPException(status_code=404, detail=f"Variant {item.variant_id} not found")
        stock_cost += variant.buying_price * item.quantity
        variants.append((variant, item.quantity))

    total_cost = stock_cost + data.additional_fees

    for i, (variant, quantity) in enumerate(variants):
        item_cost = variant.buying_price * quantity
        arrival = models.StockArrival(
            user_id=user.id,
            variant_id=variant.id,
            quantity=quantity,
            additional_fees=data.additional_fees if i == 0 else 0,
            description=data.description,
            total_cost=item_cost + (data.additional_fees if i == 0 else 0),
            date=arrival_date,
        )
        db.add(arrival)
        variant.stock += quantity

    items_summary = ", ".join(
        f"{v.product.name} {v.size or ''} {v.color or ''} x{q}".strip()
        for v, q in variants
    )
    withdrawal = models.Withdrawal(
        user_id=user.id,
        amount=total_cost,
        description=f"Stock arrival: {items_summary}" + (f" | {data.description}" if data.description else ""),
        type="stock_purchase",
        date=arrival_date,
    )
    db.add(withdrawal)
    db.commit()

    return {"success": True, "total_cost": total_cost, "items_count": len(variants)}


@router.delete("/arrivals/{arrival_id}")
def delete_arrival(arrival_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    arrival = db.query(models.StockArrival).filter(
        models.StockArrival.id == arrival_id,
        models.StockArrival.user_id == get_store_id(user)
    ).first()
    if not arrival:
        raise HTTPException(status_code=404, detail="Arrival not found")
    # Reverse stock
    variant = db.query(models.Variant).filter(models.Variant.id == arrival.variant_id).first()
    if variant:
        variant.stock = max(0, variant.stock - arrival.quantity)
    # Remove matching stock_purchase withdrawal
    withdrawal = db.query(models.Withdrawal).filter(
        models.Withdrawal.user_id == get_store_id(user),
        models.Withdrawal.type == "stock_purchase",
        models.Withdrawal.amount == arrival.total_cost,
        models.Withdrawal.date == arrival.date,
    ).first()
    if withdrawal:
        db.delete(withdrawal)
    db.delete(arrival)
    db.commit()
    return {"success": True}


class StockAdjustInput(BaseModel):
    stock: int


@router.put("/variants/{variant_id}/stock")
def adjust_stock(variant_id: int, data: StockAdjustInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    variant = db.query(models.Variant).filter(
        models.Variant.id == variant_id,
        models.Variant.product_id.in_(
            db.query(models.Product.id).filter(models.Product.user_id == get_store_id(user))
        )
    ).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    variant.stock = max(0, data.stock)
    db.commit()
    return {"success": True}


@router.get("/broken")
def list_broken_stock(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    broken = (
        db.query(models.BrokenStock)
        .join(models.Variant, models.BrokenStock.variant_id == models.Variant.id)
        .join(models.Product, models.Variant.product_id == models.Product.id)
        .filter(models.Product.user_id == get_store_id(user))
        .order_by(models.BrokenStock.date.desc())
        .all()
    )
    result = []
    for b in broken:
        variant = b.variant
        result.append({
            "id": b.id,
            "variant_id": b.variant_id,
            "product_name": (variant.product.name if variant and variant.product else "") if variant else "",
            "size": variant.size if variant else "",
            "color": variant.color if variant else "",
            "quantity": b.quantity,
            "source": b.source,
            "source_order_id": b.source_order_id,
            "returnable_to_supplier": b.returnable_to_supplier,
            "value_lost": b.value_lost,
            "date": b.date.isoformat() if b.date else None,
        })
    return result


@router.post("/broken")
def add_broken_stock(data: BrokenStockCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    try:
        if user.role == "confirmer":
            raise HTTPException(status_code=403, detail="Confirmers cannot add broken stock")
        variant = db.query(models.Variant).filter(models.Variant.id == data.variant_id).first()
        if not variant:
            raise HTTPException(status_code=404, detail="Variant not found")

        value_lost = 0.0 if data.returnable_to_supplier else (variant.buying_price or 0.0) * data.quantity
        broken = models.BrokenStock(
            user_id=user.id,
            variant_id=data.variant_id,
            quantity=data.quantity,
            source=data.source,
            source_order_id=data.source_order_id,
            returnable_to_supplier=data.returnable_to_supplier,
            value_lost=value_lost,
            date=datetime.now(),
        )
        db.add(broken)
        variant.stock = max(0, variant.stock - data.quantity)
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BrokenStockUpdate(BaseModel):
    quantity: int
    returnable_to_supplier: bool


@router.put("/broken/{broken_id}")
def update_broken_stock(broken_id: int, data: BrokenStockUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Not authorized")
    broken = db.query(models.BrokenStock).filter(
        models.BrokenStock.id == broken_id,
        models.BrokenStock.user_id == get_store_id(user),
    ).first()
    if not broken:
        raise HTTPException(status_code=404, detail="Record not found")
    variant = db.query(models.Variant).filter(models.Variant.id == broken.variant_id).first()
    old_quantity = broken.quantity
    broken.quantity = data.quantity
    broken.returnable_to_supplier = data.returnable_to_supplier
    broken.value_lost = 0.0 if data.returnable_to_supplier else ((variant.buying_price or 0.0) if variant else 0.0) * data.quantity
    if variant:
        variant.stock = max(0, variant.stock + old_quantity - data.quantity)
    db.commit()
    return {"success": True}


@router.delete("/broken/{broken_id}")
def delete_broken_stock(broken_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Not authorized")
    broken = db.query(models.BrokenStock).filter(
        models.BrokenStock.id == broken_id,
        models.BrokenStock.user_id == get_store_id(user),
    ).first()
    if not broken:
        raise HTTPException(status_code=404, detail="Record not found")
    variant = db.query(models.Variant).filter(models.Variant.id == broken.variant_id).first()
    if variant:
        variant.stock += broken.quantity
    db.delete(broken)
    db.commit()
    return {"success": True}
