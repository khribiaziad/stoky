from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
import models
from routers.leads import _match_items, _create_order_from_lead
from datetime import datetime

router = APIRouter(prefix="/youcan", tags=["youcan"])


@router.post("/webhook", include_in_schema=False)
async def youcan_webhook(
    request: Request,
    api_key: str,
    db: Session = Depends(get_db),
):
    """
    Public webhook — YouCan calls this when a new order is placed.
    URL: POST /api/youcan/webhook?api_key=STORE_KEY
    """
    try:
        payload = await request.json()
    except Exception:
        return {"ok": True}

    # Validate API key → identify store
    api_key_record = db.query(models.StoreApiKey).filter(
        models.StoreApiKey.key == api_key
    ).first()
    if not api_key_record:
        raise HTTPException(status_code=401, detail="Invalid API key")

    store_id = api_key_record.store_id

    # Extract customer info
    customer   = payload.get("customer") or {}
    first_name = customer.get("first_name", "")
    last_name  = customer.get("last_name", "")
    full_name  = f"{first_name} {last_name}".strip() or "Unknown"
    phone      = customer.get("phone", "")

    # Shipping address — YouCan sends it as shipping_address or shipping.address
    addr_obj = (
        payload.get("shipping_address")
        or (payload.get("shipping") or {}).get("address")
        or {}
    )
    if isinstance(addr_obj, list):
        addr_obj = addr_obj[0] if addr_obj else {}

    city    = addr_obj.get("city", "")
    region  = addr_obj.get("region", "")
    address = " ".join(filter(None, [
        addr_obj.get("first_line", ""),
        addr_obj.get("second_line", ""),
    ]))
    # Phone fallback: sometimes in address object
    if not phone:
        phone = addr_obj.get("phone", "")

    # Products — YouCan sends variants array
    variants   = payload.get("variants") or []
    raw_items  = []
    for v in variants:
        name = ""
        product = v.get("product") or {}
        if product:
            name = product.get("name", "")
        if not name:
            name = v.get("name", "")
        qty = v.get("quantity", 1)
        if name:
            raw_items.append({"product_name": name, "quantity": qty})

    total = float(payload.get("total") or 0)

    matched, matched_total = _match_items(raw_items, store_id, db)

    # Auto-extract city from address if no city provided
    resolved_city = city or region
    if not resolved_city and address:
        all_cities = db.query(models.City).all()
        addr_lower = address.lower()
        for c in all_cities:
            if c.name.lower() in addr_lower:
                resolved_city = c.name
                break

    lead = models.Lead(
        store_id=store_id,
        customer_name=full_name,
        customer_phone=phone,
        customer_email=customer.get("email", ""),
        customer_city=resolved_city,
        customer_address=address,
        raw_items=raw_items,
        matched_items=matched if matched else None,
        total_amount=total or matched_total or None,
        notes=f"YouCan order #{payload.get('ref', '')}",
        status="pending",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    return {"ok": True, "lead_id": lead.id}
