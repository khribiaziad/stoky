from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from database import get_db
from auth import get_current_user, hash_password
import models

router = APIRouter(prefix="/platform", tags=["platform"])


def require_super_admin(user: models.User = Depends(get_current_user)):
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


# ── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    stores = db.query(models.User).filter(models.User.role == "admin").all()
    store_ids = [s.id for s in stores]
    subs = db.query(models.Subscription).filter(models.Subscription.store_id.in_(store_ids)).all()
    sub_map = {s.store_id: s for s in subs}

    now = datetime.utcnow()
    total     = len(stores)
    active    = sum(1 for s in stores if sub_map.get(s.id) and sub_map[s.id].status == "active" and s.is_approved)
    suspended = sum(1 for s in stores if not s.is_approved)
    expired   = sum(1 for s in stores if sub_map.get(s.id) and sub_map[s.id].status == "expired")
    expiring  = sum(1 for s in stores if sub_map.get(s.id) and sub_map[s.id].end_date and
                    0 < (sub_map[s.id].end_date - now).days <= 30)

    return {"total": total, "active": active, "suspended": suspended, "expired": expired, "expiring": expiring}


# ── Growth chart ─────────────────────────────────────────────────────────────

@router.get("/growth")
def get_growth(db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    rows = (
        db.query(
            extract("year",  models.User.created_at).label("year"),
            extract("month", models.User.created_at).label("month"),
            func.count(models.User.id).label("count"),
        )
        .filter(models.User.role == "admin")
        .group_by("year", "month")
        .order_by("year", "month")
        .all()
    )
    return [{"year": int(r.year), "month": int(r.month), "count": r.count} for r in rows]


# ── Store list ────────────────────────────────────────────────────────────────

@router.get("/stores")
def list_stores(db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    stores = db.query(models.User).filter(models.User.role == "admin").order_by(models.User.created_at.desc()).all()
    result = []
    for store in stores:
        sub = db.query(models.Subscription).filter(models.Subscription.store_id == store.id).first()
        order_count = db.query(func.count(models.Order.id)).filter(models.Order.user_id == store.id).scalar() or 0
        last_order = db.query(func.max(models.Order.created_at)).filter(models.Order.user_id == store.id).scalar()
        result.append({
            "id": store.id,
            "username": store.username,
            "store_name": store.store_name,
            "is_approved": store.is_approved,
            "created_at": store.created_at,
            "order_count": order_count,
            "last_order_at": last_order,
            "subscription": {
                "plan": sub.plan if sub else "free",
                "status": sub.status if sub else "active",
                "start_date": sub.start_date if sub else None,
                "end_date": sub.end_date if sub else None,
                "notes": sub.notes if sub else None,
                "needs_renewal": sub.needs_renewal if sub else False,
            },
        })
    return result


# ── Create store ──────────────────────────────────────────────────────────────

class CreateStoreInput(BaseModel):
    username: str
    store_name: str
    password: str

@router.post("/stores")
def create_store(data: CreateStoreInput, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    if len(data.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if db.query(models.User).filter(models.User.username == data.username.lower().strip()).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = models.User(
        username=data.username.lower().strip(),
        store_name=data.store_name.strip(),
        password_hash=hash_password(data.password),
        is_approved=True,
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    sub = models.Subscription(store_id=user.id, plan="free", status="active")
    db.add(sub)
    db.commit()

    return {"id": user.id, "username": user.username, "store_name": user.store_name}


# ── Store status ──────────────────────────────────────────────────────────────

class UpdateStatusInput(BaseModel):
    is_approved: bool

@router.patch("/stores/{store_id}/status")
def update_store_status(store_id: int, data: UpdateStatusInput, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    store = db.query(models.User).filter(models.User.id == store_id, models.User.role == "admin").first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    store.is_approved = data.is_approved
    db.commit()
    return {"success": True, "is_approved": store.is_approved}


# ── Reset password ────────────────────────────────────────────────────────────

class ResetPasswordInput(BaseModel):
    new_password: str

@router.post("/stores/{store_id}/reset-password")
def reset_password(store_id: int, data: ResetPasswordInput, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    store = db.query(models.User).filter(models.User.id == store_id, models.User.role == "admin").first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    store.password_hash = hash_password(data.new_password)
    db.commit()
    return {"success": True}


@router.delete("/stores/{store_id}")
def delete_store(store_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    store = db.query(models.User).filter(models.User.id == store_id, models.User.role == "admin").first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    # Delete all data belonging to this store in dependency order
    db.query(models.Notification).filter_by(user_id=store_id).delete()
    db.query(models.Lead).filter_by(store_id=store_id).delete()
    db.query(models.AppSettings).filter_by(user_id=store_id).delete()
    db.query(models.StoreApiKey).filter_by(user_id=store_id).delete()
    db.query(models.FacebookAd).filter_by(user_id=store_id).delete()
    db.query(models.AdPlatform).filter_by(user_id=store_id).delete()
    db.query(models.Withdrawal).filter_by(user_id=store_id).delete()
    db.query(models.FixedExpense).filter_by(user_id=store_id).delete()
    db.query(models.StockArrival).filter_by(user_id=store_id).delete()

    # Orders + their items/expenses
    order_ids = [o.id for o in db.query(models.Order.id).filter_by(user_id=store_id).all()]
    if order_ids:
        db.query(models.OrderExpense).filter(models.OrderExpense.order_id.in_(order_ids)).delete(synchronize_session=False)
        db.query(models.OrderItem).filter(models.OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
    db.query(models.Order).filter_by(user_id=store_id).delete()

    # Products + variants + packs
    product_ids = [p.id for p in db.query(models.Product.id).filter_by(user_id=store_id).all()]
    if product_ids:
        variant_ids = [v.id for v in db.query(models.Variant.id).filter(models.Variant.product_id.in_(product_ids)).all()]
        if variant_ids:
            db.query(models.BrokenStock).filter(models.BrokenStock.variant_id.in_(variant_ids)).delete(synchronize_session=False)
        db.query(models.Variant).filter(models.Variant.product_id.in_(product_ids)).delete(synchronize_session=False)
    db.query(models.Product).filter_by(user_id=store_id).delete()

    pack_ids = [p.id for p in db.query(models.Pack.id).filter_by(user_id=store_id).all()]
    if pack_ids:
        preset_ids = [pr.id for pr in db.query(models.PackPreset.id).filter(models.PackPreset.pack_id.in_(pack_ids)).all()]
        if preset_ids:
            db.query(models.PackPresetItem).filter(models.PackPresetItem.preset_id.in_(preset_ids)).delete(synchronize_session=False)
        db.query(models.PackPreset).filter(models.PackPreset.pack_id.in_(pack_ids)).delete(synchronize_session=False)
    db.query(models.Pack).filter_by(user_id=store_id).delete()

    db.query(models.City).filter_by(user_id=store_id).delete()
    db.query(models.TeamMember).filter_by(user_id=store_id).delete()

    # Suppliers + payments
    supplier_ids = [s.id for s in db.query(models.Supplier.id).filter_by(user_id=store_id).all()]
    if supplier_ids:
        db.query(models.SupplierPayment).filter(models.SupplierPayment.supplier_id.in_(supplier_ids)).delete(synchronize_session=False)
    db.query(models.Supplier).filter_by(user_id=store_id).delete()

    # Confirmer sub-accounts
    db.query(models.User).filter_by(store_id=store_id, role="confirmer").delete()

    # Subscription + payments
    db.query(models.Payment).filter_by(store_id=store_id).delete()
    db.query(models.Subscription).filter_by(store_id=store_id).delete()

    db.delete(store)
    db.commit()
    return {"success": True}


# ── Subscription ──────────────────────────────────────────────────────────────

class UpdateSubscriptionInput(BaseModel):
    plan: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

@router.patch("/stores/{store_id}/subscription")
def update_subscription(store_id: int, data: UpdateSubscriptionInput, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    store = db.query(models.User).filter(models.User.id == store_id, models.User.role == "admin").first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    sub = db.query(models.Subscription).filter(models.Subscription.store_id == store_id).first()
    if not sub:
        sub = models.Subscription(store_id=store_id)
        db.add(sub)
    if data.plan is not None:       sub.plan = data.plan
    if data.status is not None:     sub.status = data.status
    if data.start_date is not None: sub.start_date = data.start_date
    if data.end_date is not None:   sub.end_date = data.end_date
    db.commit()
    return {"plan": sub.plan, "status": sub.status, "start_date": sub.start_date, "end_date": sub.end_date}


# ── Notes ─────────────────────────────────────────────────────────────────────

class UpdateNotesInput(BaseModel):
    notes: Optional[str] = None
    needs_renewal: Optional[bool] = None

@router.patch("/stores/{store_id}/notes")
def update_notes(store_id: int, data: UpdateNotesInput, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    sub = db.query(models.Subscription).filter(models.Subscription.store_id == store_id).first()
    if not sub:
        sub = models.Subscription(store_id=store_id)
        db.add(sub)
    if data.notes is not None:         sub.notes = data.notes
    if data.needs_renewal is not None: sub.needs_renewal = data.needs_renewal
    db.commit()
    return {"success": True}


# ── Payments ──────────────────────────────────────────────────────────────────

class PaymentInput(BaseModel):
    amount: float
    plan: Optional[str] = None
    note: Optional[str] = None
    date: datetime

@router.get("/stores/{store_id}/payments")
def get_payments(store_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    payments = db.query(models.Payment).filter(models.Payment.store_id == store_id).order_by(models.Payment.date.desc()).all()
    return [{"id": p.id, "amount": p.amount, "plan": p.plan, "note": p.note, "date": p.date} for p in payments]

@router.post("/stores/{store_id}/payments")
def add_payment(store_id: int, data: PaymentInput, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    payment = models.Payment(store_id=store_id, amount=data.amount, plan=data.plan, note=data.note, date=data.date)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return {"id": payment.id, "amount": payment.amount, "plan": payment.plan, "note": payment.note, "date": payment.date}

@router.delete("/payments/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.commit()
    return {"success": True}


# ── Storage usage per store ───────────────────────────────────────────────────

@router.get("/stores/{store_id}/storage")
def get_store_storage(store_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    store = db.query(models.User).filter(models.User.id == store_id, models.User.role == "admin").first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    # Count rows per table for this store
    counts = {
        "orders":         db.query(func.count(models.Order.id)).filter(models.Order.user_id == store_id).scalar() or 0,
        "order_items":    db.query(func.count(models.OrderItem.id)).join(models.Order).filter(models.Order.user_id == store_id).scalar() or 0,
        "products":       db.query(func.count(models.Product.id)).filter(models.Product.user_id == store_id).scalar() or 0,
        "variants":       db.query(func.count(models.Variant.id)).join(models.Product).filter(models.Product.user_id == store_id).scalar() or 0,
        "stock_arrivals": db.query(func.count(models.StockArrival.id)).filter(models.StockArrival.user_id == store_id).scalar() or 0,
        "broken_stock":   db.query(func.count(models.BrokenStock.id)).join(models.Variant).join(models.Product).filter(models.Product.user_id == store_id).scalar() or 0,
        "expenses":       db.query(func.count(models.FixedExpense.id)).filter(models.FixedExpense.user_id == store_id).scalar() or 0,
        "withdrawals":    db.query(func.count(models.Withdrawal.id)).filter(models.Withdrawal.user_id == store_id).scalar() or 0,
        "ads":            db.query(func.count(models.FacebookAd.id)).filter(models.FacebookAd.user_id == store_id).scalar() or 0,
        "team_members":   db.query(func.count(models.TeamMember.id)).filter(models.TeamMember.user_id == store_id).scalar() or 0,
    }
    total_rows = sum(counts.values())
    # Rough estimate: avg 200 bytes per row
    estimated_kb = round(total_rows * 200 / 1024, 1)
    breakdown = [{"table": k, "count": v} for k, v in counts.items()]
    return {"total_rows": total_rows, "estimated_kb": estimated_kb, "breakdown": breakdown}


# ── Platform Expenses ─────────────────────────────────────────────────────────

class PlatformExpenseInput(BaseModel):
    name: str
    category: Optional[str] = "other"
    amount: float
    currency: Optional[str] = "MAD"
    type: Optional[str] = "monthly"
    date: datetime
    note: Optional[str] = None

@router.get("/expenses")
def list_platform_expenses(month: Optional[str] = None, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    q = db.query(models.PlatformExpense)
    if month:
        try:
            year, mon = int(month[:4]), int(month[5:7])
            q = q.filter(
                extract("year",  models.PlatformExpense.date) == year,
                extract("month", models.PlatformExpense.date) == mon,
            )
        except Exception:
            pass
    rows = q.order_by(models.PlatformExpense.date.desc()).all()
    return [{"id": r.id, "name": r.name, "category": r.category, "amount": r.amount,
             "currency": r.currency, "type": r.type, "date": r.date, "note": r.note} for r in rows]

@router.post("/expenses")
def create_platform_expense(data: PlatformExpenseInput, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    exp = models.PlatformExpense(
        name=data.name, category=data.category, amount=data.amount,
        currency=data.currency, type=data.type, date=data.date, note=data.note,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return {"id": exp.id, "name": exp.name, "category": exp.category, "amount": exp.amount,
            "currency": exp.currency, "type": exp.type, "date": exp.date, "note": exp.note}

class PlatformExpensePatch(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    type: Optional[str] = None
    date: Optional[datetime] = None
    note: Optional[str] = None

@router.patch("/expenses/{expense_id}")
def update_platform_expense(expense_id: int, data: PlatformExpensePatch, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    exp = db.query(models.PlatformExpense).filter(models.PlatformExpense.id == expense_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    if data.name is not None:     exp.name = data.name
    if data.category is not None: exp.category = data.category
    if data.amount is not None:   exp.amount = data.amount
    if data.currency is not None: exp.currency = data.currency
    if data.type is not None:     exp.type = data.type
    if data.date is not None:     exp.date = data.date
    if data.note is not None:     exp.note = data.note
    db.commit()
    return {"id": exp.id, "name": exp.name, "category": exp.category, "amount": exp.amount,
            "currency": exp.currency, "type": exp.type, "date": exp.date, "note": exp.note}

@router.delete("/expenses/{expense_id}")
def delete_platform_expense(expense_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    exp = db.query(models.PlatformExpense).filter(models.PlatformExpense.id == expense_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(exp)
    db.commit()
    return {"success": True}


# ── Platform settings (pricing) ───────────────────────────────────────────────

@router.get("/settings")
def get_platform_settings(db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    rows = db.query(models.PlatformSettings).all()
    return {r.key: r.value for r in rows}

class PlatformSettingsInput(BaseModel):
    key: str
    value: str

@router.post("/settings")
def save_platform_setting(data: PlatformSettingsInput, db: Session = Depends(get_db), _: models.User = Depends(require_super_admin)):
    row = db.query(models.PlatformSettings).filter(models.PlatformSettings.key == data.key).first()
    if row:
        row.value = data.value
    else:
        row = models.PlatformSettings(key=data.key, value=data.value)
        db.add(row)
    db.commit()
    return {"success": True}
