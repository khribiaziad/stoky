from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
import models
from routers.leads import _match_items

router = APIRouter(prefix="/shopify", tags=["shopify"])


@router.post("/webhook", include_in_schema=False)
async def shopify_webhook(
    request: Request,
    api_key: str,
    db: Session = Depends(get_db),
):
    """
    Public webhook — Shopify calls this on orders/create event.
    URL: POST /api/shopify/webhook?api_key=STORE_KEY
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
    shipping = payload.get("shipping_address") or payload.get("billing_address") or {}
    customer = payload.get("customer") or {}

    first_name = shipping.get("first_name") or customer.get("first_name", "")
    last_name  = shipping.get("last_name")  or customer.get("last_name", "")
    full_name  = f"{first_name} {last_name}".strip() or customer.get("email", "Unknown")
    phone      = shipping.get("phone") or customer.get("phone") or payload.get("phone", "")
    email      = customer.get("email", "")
    city       = shipping.get("city", "")
    address    = " ".join(filter(None, [
        shipping.get("address1", ""),
        shipping.get("address2", ""),
    ]))

    # Extract line items
    raw_items = []
    for item in (payload.get("line_items") or []):
        name = item.get("name") or item.get("title", "")
        qty  = item.get("quantity", 1)
        if name:
            raw_items.append({"product_name": name, "quantity": qty})

    total = float(payload.get("total_price") or 0)

    matched, matched_total = _match_items(raw_items, store_id, db)

    order_ref = payload.get("order_number") or payload.get("name") or payload.get("id", "")

    lead = models.Lead(
        store_id=store_id,
        customer_name=full_name,
        customer_phone=phone,
        customer_email=email,
        customer_city=city,
        customer_address=address,
        raw_items=raw_items,
        matched_items=matched if matched else None,
        total_amount=total or matched_total or None,
        notes=f"Shopify order #{order_ref}",
        status="pending",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    return {"ok": True, "lead_id": lead.id}
