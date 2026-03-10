import os
import secrets
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user, get_store_id
from database import get_db
import models

router = APIRouter(prefix="/leads", tags=["leads"])

# ── Twilio helpers ────────────────────────────────────────────────────────────

def _twilio_client():
    """Return a Twilio Client or None if credentials are not configured."""
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token  = os.environ.get("TWILIO_AUTH_TOKEN")
    if not account_sid or not auth_token:
        return None
    try:
        from twilio.rest import Client
        return Client(account_sid, auth_token)
    except Exception:
        return None


def _whatsapp_from() -> str:
    return os.environ.get("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")


def _format_phone(phone: str) -> str:
    """Normalize a phone number to E.164 whatsapp: format."""
    phone = phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+" + phone
    return f"whatsapp:{phone}"


def _send_whatsapp(to: str, body: str) -> bool:
    client = _twilio_client()
    if not client:
        return False
    try:
        client.messages.create(
            from_=_whatsapp_from(),
            to=_format_phone(to),
            body=body,
        )
        return True
    except Exception:
        return False


def _confirmation_message(lead: models.Lead, store_name: str) -> str:
    lines = [f"Hi {lead.customer_name}! 👋", f"You placed an order at {store_name}:", ""]
    items = lead.matched_items or []
    for item in items:
        price = item.get("unit_price") or 0
        qty   = item.get("quantity", 1)
        name  = item.get("product_name", "Product")
        lines.append(f"• {name} x{qty} — {price * qty:.0f} MAD")
    amount = lead.total_amount or 0
    lines += ["", f"Total: {amount:.0f} MAD", "", "Reply YES to confirm or NO to cancel."]
    return "\n".join(lines)


def _followup_message(store_name: str) -> str:
    return (
        f"Your order at {store_name} was automatically cancelled (no reply received).\n"
        "Reply RECONFIRM if you'd like to restart."
    )


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

    lead = models.Lead(
        store_id=store_id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_email=data.customer_email,
        customer_city=data.customer_city,
        customer_address=data.customer_address,
        raw_items=raw_items,
        matched_items=matched if matched else None,
        total_amount=total if total > 0 else None,
        notes=data.notes,
        status="pending",
        message_count=1,
        last_message_at=datetime.utcnow(),
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    return {"status": "lead_created", "id": lead.id}


# ── Public: Twilio webhook ────────────────────────────────────────────────────

@router.post("/whatsapp/webhook", response_class=PlainTextResponse, include_in_schema=False)
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    raw_from = str(form.get("From", ""))
    body_raw  = str(form.get("Body", "")).strip()
    body      = body_raw.upper()

    # Extract plain phone from "whatsapp:+212..."
    phone = raw_from.replace("whatsapp:", "").strip()

    # Find most recent pending or cancelled lead for this phone
    lead = (
        db.query(models.Lead)
        .filter(
            models.Lead.customer_phone.contains(phone.lstrip("+")),
            models.Lead.status.in_(["pending", "cancelled"]),
        )
        .order_by(models.Lead.created_at.desc())
        .first()
    )

    if not lead:
        reply = "No active order found for your number."
        return _twiml(reply)

    store = db.query(models.User).filter(models.User.id == lead.store_id).first()
    store_name = store.store_name if store else "the store"

    if body in ("YES", "OUI", "نعم"):
        order = _create_order_from_lead(lead, db)
        if order is None:
            lead.status = "cancelled"
            db.commit()
            reply = "Sorry, we could not process your order (stock issue). Please contact us directly."
        else:
            lead.status   = "confirmed"
            lead.order_id = order.id
            db.commit()
            reply = f"✅ Your order has been confirmed! We'll process it shortly. Thank you!"

    elif body in ("NO", "NON", "لا"):
        lead.status = "cancelled"
        db.commit()
        reply = "Your order has been cancelled. If this was a mistake, reply RECONFIRM to restart."

    elif body in ("RECONFIRM", "RECOMMENCER"):
        if lead.status == "cancelled":
            lead.status         = "pending"
            lead.message_count  = 1
            lead.last_message_at = datetime.utcnow()
            db.commit()
            db.refresh(lead)
            msg = _confirmation_message(lead, store_name)
            _send_whatsapp(phone, msg)
            reply = "No problem! We've re-sent your order confirmation. Please reply YES or NO."
        else:
            reply = "Your order is already active. Reply YES to confirm or NO to cancel."

    else:
        reply = "Please reply YES to confirm your order, NO to cancel, or RECONFIRM to restart a cancelled order."

    return _twiml(reply)


def _twiml(message: str) -> str:
    safe = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{safe}</Message></Response>'


# ── Twilio test endpoint ──────────────────────────────────────────────────────

@router.post("/test-whatsapp")
def test_whatsapp(
    phone: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Send a test WhatsApp message to verify Twilio credentials."""
    import os
    sid   = os.environ.get("TWILIO_ACCOUNT_SID", "NOT SET")
    token = os.environ.get("TWILIO_AUTH_TOKEN", "NOT SET")
    frm   = os.environ.get("TWILIO_WHATSAPP_FROM", "NOT SET")

    if "NOT SET" in (sid, token, frm):
        return {"ok": False, "error": f"Missing env vars — SID:{sid[:6]}... TOKEN:{'set' if token != 'NOT SET' else 'NOT SET'} FROM:{frm}"}

    ok = _send_whatsapp(phone, "Test message from Stocky ✅ — WhatsApp is connected!")
    return {"ok": ok, "from": frm, "to": phone}


# ── Authenticated endpoints ───────────────────────────────────────────────────

@router.get("")
def list_leads(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = get_store_id(user)
    leads = (
        db.query(models.Lead)
        .filter(
            models.Lead.store_id == sid,
            models.Lead.status != "confirmed",
        )
        .order_by(models.Lead.created_at.desc())
        .all()
    )
    return [_serialize_lead(l) for l in leads]


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
    user: models.User = Depends(get_current_user),
):
    sid = get_store_id(user)
    record = db.query(models.StoreApiKey).filter(models.StoreApiKey.store_id == sid).first()
    new_key = secrets.token_urlsafe(32)
    if record:
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
        store = db.query(models.User).filter(models.User.id == lead.store_id).first()
        store_name = store.store_name if store else "the store"

        if lead.message_count == 1:
            # Send follow-up
            msg = _followup_message(store_name)
            _send_whatsapp(lead.customer_phone, msg)
            lead.message_count   = 2
            lead.last_message_at = datetime.utcnow()
        elif lead.message_count >= 2:
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
        "message_count":    lead.message_count,
        "reported_date":    lead.reported_date.isoformat() if lead.reported_date else None,
        "last_message_at":  lead.last_message_at.isoformat() if lead.last_message_at else None,
        "created_at":       lead.created_at.isoformat() if lead.created_at else None,
    }
