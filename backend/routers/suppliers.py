from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db
from auth import get_current_user, get_store_id
import models

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


class SupplierCreate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    platform: Optional[str] = None
    notes: Optional[str] = None


class SupplierPaymentCreate(BaseModel):
    amount: float
    date: str
    note: Optional[str] = None


@router.get("")
def list_suppliers(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    store_id = get_store_id(user)
    suppliers = db.query(models.Supplier).filter(models.Supplier.user_id == store_id).order_by(models.Supplier.name).all()
    result = []
    for s in suppliers:
        products = db.query(models.Product).filter(
            models.Product.supplier_id == s.id,
            models.Product.user_id == store_id,
        ).all()
        product_ids = [p.id for p in products]

        # Total purchased = sum of stock arrivals for variants of linked products
        total_purchased = 0.0
        if product_ids:
            variant_ids = [v.id for p in products for v in p.variants]
            if variant_ids:
                arrivals = db.query(models.StockArrival).filter(
                    models.StockArrival.variant_id.in_(variant_ids)
                ).all()
                total_purchased = sum(a.total_cost for a in arrivals)

        total_paid = db.query(func.sum(models.SupplierPayment.amount)).filter(
            models.SupplierPayment.supplier_id == s.id
        ).scalar() or 0.0

        result.append({
            "id": s.id,
            "name": s.name,
            "phone": s.phone,
            "platform": s.platform,
            "notes": s.notes,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "product_count": len(products),
            "total_purchased": round(total_purchased, 2),
            "total_paid": round(total_paid, 2),
            "balance": round(total_purchased - total_paid, 2),
        })
    return result


@router.post("")
def create_supplier(data: SupplierCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot manage suppliers")
    s = models.Supplier(user_id=get_store_id(user), **data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "name": s.name}


@router.put("/{supplier_id}")
def update_supplier(supplier_id: int, data: SupplierCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot manage suppliers")
    s = db.query(models.Supplier).filter(models.Supplier.id == supplier_id, models.Supplier.user_id == get_store_id(user)).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if data.name is not None: s.name = data.name
    if data.phone is not None: s.phone = data.phone
    if data.platform is not None: s.platform = data.platform
    if data.notes is not None: s.notes = data.notes
    db.commit()
    return {"success": True}


@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot manage suppliers")
    s = db.query(models.Supplier).filter(models.Supplier.id == supplier_id, models.Supplier.user_id == get_store_id(user)).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    # Unlink products, then soft-delete (preserves payment history)
    db.query(models.Product).filter(models.Product.supplier_id == supplier_id).update({"supplier_id": None})
    s.is_active = False
    db.commit()
    return {"success": True}


@router.get("/{supplier_id}/detail")
def get_supplier_detail(supplier_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    store_id = get_store_id(user)
    s = db.query(models.Supplier).filter(models.Supplier.id == supplier_id, models.Supplier.user_id == store_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")

    products = db.query(models.Product).filter(
        models.Product.supplier_id == s.id,
        models.Product.user_id == store_id,
    ).all()

    products_out = []
    all_arrivals = []
    for p in products:
        total_stock = sum(v.stock for v in p.variants)
        products_out.append({"id": p.id, "name": p.name, "category": p.category, "variant_count": len(p.variants), "total_stock": total_stock})
        for v in p.variants:
            for a in v.stock_arrivals:
                all_arrivals.append({
                    "id": a.id,
                    "date": a.date.isoformat() if a.date else None,
                    "product_name": p.name,
                    "variant": f"{v.size or ''} {v.color or ''}".strip() or "—",
                    "quantity": a.quantity,
                    "total_cost": a.total_cost,
                })

    all_arrivals.sort(key=lambda x: x["date"] or "", reverse=True)

    payments = db.query(models.SupplierPayment).filter(
        models.SupplierPayment.supplier_id == supplier_id
    ).order_by(models.SupplierPayment.date.desc()).all()

    payments_out = [{"id": p.id, "amount": p.amount, "date": p.date.isoformat(), "note": p.note} for p in payments]

    total_purchased = sum(a["total_cost"] for a in all_arrivals)
    total_paid = sum(p["amount"] for p in payments_out)

    return {
        "products": products_out,
        "arrivals": all_arrivals,
        "payments": payments_out,
        "total_purchased": round(total_purchased, 2),
        "total_paid": round(total_paid, 2),
        "balance": round(total_purchased - total_paid, 2),
    }


@router.post("/{supplier_id}/payments")
def add_payment(supplier_id: int, data: SupplierPaymentCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot manage suppliers")
    s = db.query(models.Supplier).filter(models.Supplier.id == supplier_id, models.Supplier.user_id == get_store_id(user)).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    payment = models.SupplierPayment(
        supplier_id=supplier_id,
        amount=data.amount,
        date=datetime.fromisoformat(data.date),
        note=data.note,
    )
    db.add(payment)
    db.commit()
    return {"success": True}


@router.delete("/payments/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    store_id = get_store_id(user)
    payment = db.query(models.SupplierPayment).join(
        models.Supplier, models.Supplier.id == models.SupplierPayment.supplier_id
    ).filter(
        models.SupplierPayment.id == payment_id,
        models.Supplier.user_id == store_id,
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.commit()
    return {"success": True}
