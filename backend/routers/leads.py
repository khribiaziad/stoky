import os
import secrets
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user, get_store_id
from core.permissions import require_admin
from database import get_db
from services import expense_service
import models

router = APIRouter(prefix="/leads", tags=["leads"])


# ── Product matching ──────────────────────────────────────────────────────────

def _match_items(raw_items: list, store_id: int, db: Session) -> tuple:
    """Match raw product names to variants. Returns (matched_items, total_amount)."""
    matched = []
    total = 0.0
    for item in raw_items:
        name = item.get("product_name", "").lower().strip()
        qty  = item.get("quantity", 1)

        # Find product — try name contains order name, then reverse
        product = db.query(models.Product).filter(
            models.Product.user_id == store_id,
            func.lower(models.Product.name).contains(name),
        ).first()
        if not product:
            all_products = db.query(models.Product).filter(
                models.Product.user_id == store_id
            ).all()
            for p in all_products:
                if p.name.lower() in name:
                    product = p
                    break

        if product and product.variants:
            # Try to match variant by size/color from the remaining string
            remainder = name.replace(product.name.lower(), '').strip(' -/')
            v = None
            if remainder and len(product.variants) > 1:
                for candidate in product.variants:
                    size  = (candidate.size  or '').lower()
                    color = (candidate.color or '').lower()
                    if (size and size in remainder) or (color and color in remainder):
                        v = candidate
                        break
            if not v:
                v = product.variants[0]

            unit_price = v.selling_price or 0
            label = product.name
            if v.color or v.size:
                label += ' - ' + ' / '.join(filter(None, [v.color, v.size]))
            matched.append({
                "variant_id":   v.id,
                "product_name": label,
                "quantity":     qty,
                "unit_price":   unit_price,
            })
            total += unit_price * qty
    return matched, total


# ── Order creation from lead ──────────────────────────────────────────────────

def _create_order_from_lead(lead: models.Lead, db: Session) -> Optional[models.Order]:
    """Create an Order from a confirmed lead. Returns None on stock error."""
    import uuid
    caleo_id = f"LEAD-{lead.id}-{uuid.uuid4().hex[:6].upper()}"

    order = models.Order(
        user_id=lead.store_id,
        uploaded_by=None,
        caleo_id=caleo_id,
        customer_name=lead.customer_name,
        customer_phone=lead.customer_phone,
        customer_address=lead.customer_address,
        city=lead.customer_city,
        total_amount=lead.total_amount or 0,
        status="reported" if lead.status == "reported" else "pending",
        reported_date=lead.reported_date if lead.status == "reported" else None,
        order_date=datetime.now(),
    )
    db.add(order)
    db.flush()

    for item in (lead.matched_items or []):
        variant = db.query(models.Variant).filter(models.Variant.id == item["variant_id"]).first()
        if not variant:
            db.rollback()
            return None
        qty = item.get("quantity", 1)
        if variant.stock < qty:
            db.rollback()
            return None
        variant.stock -= qty
        db.add(models.OrderItem(
            order_id=order.id,
            variant_id=variant.id,
            product_name=item.get("product_name", variant.product.name),
            size=variant.size,
            color=variant.color,
            quantity=qty,
            unit_cost=variant.buying_price,
            unit_price=variant.selling_price,
        ))

    db.add(models.OrderExpense(
        order_id=order.id,
        sticker=0,
        seal_bag=0,
        packaging=1,
        delivery_fee=35.0,
        return_fee=7.0,
    ))
    return order


# ── Schemas ───────────────────────────────────────────────────────────────────

class RawItem(BaseModel):
    product_name: str
    quantity: int = 1


class InboundLeadInput(BaseModel):
    customer_name:    str
    customer_phone:   str
    customer_email:   Optional[str] = None
    customer_city:    Optional[str] = None
    customer_address: Optional[str] = None
    total_amount:     Optional[float] = None
    notes:            Optional[str] = None
    items:            List[RawItem]
    # Honeypot: real users leave this empty; bots fill it in
    website:          Optional[str] = None


# ── Spam protection helpers ───────────────────────────────────────────────────

_SILENT_OK = {"status": "lead_created", "id": 0}  # fake success for bots

def _phone_digits(phone: str) -> str:
    return "".join(c for c in phone if c.isdigit())

def _check_rate_limit(phone: str, store_id: int, db: Session) -> Optional[str]:
    """
    Returns an error message string if blocked, None if allowed.
    - pending/unresponsive lead exists → tell customer to finalize it
    - 3+ submissions in 24h → too many attempts
    """
    digits = _phone_digits(phone)
    if len(digits) < 5:
        return None  # can't rate-limit without a valid phone
    cutoff = datetime.utcnow() - timedelta(hours=24)

    existing_active = db.query(models.Lead).filter(
        models.Lead.store_id == store_id,
        models.Lead.customer_phone.contains(digits[-9:]),
        models.Lead.status.in_(["pending", "unresponsive"]),
    ).first()
    if existing_active:
        return "You already have a pending order. Please check your WhatsApp and reply YES or NO to confirm or cancel it before placing a new one."

    recent_count = db.query(models.Lead).filter(
        models.Lead.store_id == store_id,
        models.Lead.customer_phone.contains(digits[-9:]),
        models.Lead.created_at >= cutoff,
    ).count()
    if recent_count >= 3:
        return "Too many orders submitted from this number today. Please try again tomorrow."

    return None

def _is_store_flooded(store_id: int, db: Session) -> bool:
    cutoff = datetime.utcnow() - timedelta(hours=1)
    count = db.query(models.Lead).filter(
        models.Lead.store_id == store_id,
        models.Lead.created_at >= cutoff,
    ).count()
    return count >= 30


# ── Public: inbound webhook ───────────────────────────────────────────────────

@router.post("/inbound", include_in_schema=False)
def inbound_lead(
    data: InboundLeadInput,
    api_key: str,
    db: Session = Depends(get_db),
):
    # 1. Honeypot check — bots fill in the hidden 'website' field
    if data.website:
        return _SILENT_OK

    api_key_record = db.query(models.StoreApiKey).filter(
        models.StoreApiKey.key == api_key
    ).first()
    if not api_key_record:
        # Check if this matches a previous key still within its grace period
        api_key_record = db.query(models.StoreApiKey).filter(
            models.StoreApiKey.previous_key == api_key,
            models.StoreApiKey.previous_key_expires_at > datetime.now(),
        ).first()
    if not api_key_record:
        raise HTTPException(status_code=401, detail="Invalid API key")

    store_id = api_key_record.store_id

    # 2. Phone rate limit — same number already active or submitted 3+ times today
    rate_error = _check_rate_limit(data.customer_phone, store_id, db)
    if rate_error:
        raise HTTPException(status_code=429, detail=rate_error)

    # 3. Store flood protection — max 30 leads/hour per store
    if _is_store_flooded(store_id, db):
        return _SILENT_OK

    store    = db.query(models.User).filter(models.User.id == store_id).first()
    store_name = store.store_name if store else "the store"

    raw_items = [{"product_name": i.product_name, "quantity": i.quantity} for i in data.items]
    matched, total = _match_items(raw_items, store_id, db)

    # Auto-extract city from address (always tries, DB match wins over form value)
    city = data.customer_city
    if data.customer_address:
        all_cities = db.query(models.City).all()
        addr_lower = data.customer_address.lower()
        for c in all_cities:
            if c.name.lower() in addr_lower:
                city = c.name
                break

    lead = models.Lead(
        store_id=store_id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_email=data.customer_email,
        customer_city=city,
        customer_address=data.customer_address,
        raw_items=raw_items,
        matched_items=matched if matched else None,
        total_amount=data.total_amount or (total if total > 0 else None),
        notes=data.notes,
        status="pending",
        source="website",
        last_message_at=datetime.utcnow(),
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    return {"status": "lead_created", "id": lead.id}



# ── Authenticated endpoints ───────────────────────────────────────────────────

@router.get("")
def list_leads(
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = get_store_id(user)
    base = (
        db.query(models.Lead)
        .filter(
            models.Lead.store_id == sid,
            models.Lead.status != "confirmed",
        )
        .order_by(models.Lead.created_at.desc())
    )
    total_count = base.count()
    offset = (page - 1) * page_size
    leads = base.offset(offset).limit(page_size).all()
    return {"leads": [_serialize_lead(l) for l in leads], "page": page, "total": total_count}


@router.delete("/{lead_id}")
def delete_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid  = get_store_id(user)
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id, models.Lead.store_id == sid).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.order_id:
        raise HTTPException(status_code=400, detail="Cannot delete a lead that has a confirmed order. Delete the order first.")
    db.delete(lead)
    db.commit()
    return {"success": True}


@router.post("/{lead_id}/confirm")
def confirm_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Manually confirm a lead — creates an order from it."""
    import uuid
    sid  = get_store_id(user)
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id, models.Lead.store_id == sid).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.status == "confirmed":
        raise HTTPException(status_code=400, detail="Lead already confirmed")

    order = _create_order_from_lead(lead, db)
    if order is None:
        raise HTTPException(status_code=400, detail="Could not confirm order — stock may be insufficient")

    order.lead_id    = lead.id        # Fix #62: link order back to its lead
    order.notes      = lead.notes    # Fix #72: carry customer notes forward
    order.confirmed_by = user.id

    expense_service.get_or_create_expense(db, order)  # Bug #194: lead-confirmed orders always have an expense row

    lead.status   = "confirmed"
    lead.order_id = order.id
    db.commit()
    return {"success": True, "order_id": order.id}


@router.post("/{lead_id}/cancel")
def cancel_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid  = get_store_id(user)
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id, models.Lead.store_id == sid).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.status = "cancelled"
    db.commit()
    return {"success": True}


@router.post("/{lead_id}/not-answering")
def not_answering_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid  = get_store_id(user)
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id, models.Lead.store_id == sid).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.status = "unresponsive"
    db.commit()
    return {"success": True}


@router.post("/{lead_id}/report")
def report_lead(
    lead_id: int,
    reported_date: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    from datetime import datetime
    sid  = get_store_id(user)
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id, models.Lead.store_id == sid).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.status == "confirmed":
        raise HTTPException(status_code=400, detail="Lead already confirmed")

    # Temporarily set reported fields so _create_order_from_lead picks them up
    lead.status = "reported"
    lead.reported_date = datetime.fromisoformat(reported_date)

    order = _create_order_from_lead(lead, db)
    if order is None:
        raise HTTPException(status_code=400, detail="Could not create order — stock may be insufficient")

    lead.status   = "confirmed"
    lead.order_id = order.id
    db.commit()
    return {"success": True}


@router.get("/api-key")
def get_api_key(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = get_store_id(user)
    record = db.query(models.StoreApiKey).filter(models.StoreApiKey.store_id == sid).first()
    if not record:
        # Auto-generate on first access
        record = models.StoreApiKey(store_id=sid, key=secrets.token_urlsafe(32))
        db.add(record)
        db.commit()
        db.refresh(record)
    return {"key": record.key}


@router.post("/api-key/rotate")
def rotate_api_key(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_admin),
):
    sid = get_store_id(user)
    record = db.query(models.StoreApiKey).filter(models.StoreApiKey.store_id == sid).first()
    new_key = secrets.token_urlsafe(32)
    if record:
        record.previous_key = record.key
        record.previous_key_expires_at = datetime.now() + timedelta(hours=24)
        record.key = new_key
    else:
        record = models.StoreApiKey(store_id=sid, key=new_key)
        db.add(record)
    db.commit()
    return {"key": new_key}


# ── Scheduler job (called from main.py) ──────────────────────────────────────

def run_follow_up_job(db: Session):
    """
    Check for stale pending leads and send follow-ups or mark unresponsive.
    Designed to be called every 30 minutes by APScheduler.
    """
    cutoff = datetime.utcnow() - timedelta(hours=24)
    pending = db.query(models.Lead).filter(
        models.Lead.status == "pending",
        models.Lead.last_message_at < cutoff,
    ).all()

    for lead in pending:
        lead.status = "unresponsive"

    db.commit()


# ── Serialization ─────────────────────────────────────────────────────────────

def _serialize_lead(lead: models.Lead) -> dict:
    return {
        "id":               lead.id,
        "customer_name":    lead.customer_name,
        "customer_phone":   lead.customer_phone,
        "customer_email":   lead.customer_email,
        "customer_city":    lead.customer_city,
        "customer_address": lead.customer_address,
        "raw_items":        lead.raw_items,
        "matched_items":    lead.matched_items,
        "total_amount":     lead.total_amount,
        "notes":            lead.notes,
        "status":           lead.status,
        "order_id":         lead.order_id,
        "reported_date":    lead.reported_date.isoformat() if lead.reported_date else None,
        "last_message_at":  lead.last_message_at.isoformat() if lead.last_message_at else None,
        "created_at":       lead.created_at.isoformat() if lead.created_at else None,
    }
