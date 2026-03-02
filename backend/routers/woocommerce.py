from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
import models
from routers.leads import _match_items

router = APIRouter(prefix="/woocommerce", tags=["woocommerce"])


@router.post("/webhook", include_in_schema=False)
async def woocommerce_webhook(
    request: Request,
    api_key: str,
    db: Session = Depends(get_db),
):
    """
    Public webhook — WooCommerce calls this on order.created event.
    URL: POST /api/woocommerce/webhook?api_key=STORE_KEY
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

    # Only process new/pending orders
    status = payload.get("status", "")
    if status not in ("pending", "processing", "on-hold", ""):
        return {"ok": True, "skipped": f"status={status}"}

    # Extract customer info from billing address
    billing  = payload.get("billing") or {}
    shipping = payload.get("shipping") or {}

    first_name = billing.get("first_name") or shipping.get("first_name", "")
    last_name  = billing.get("last_name")  or shipping.get("last_name", "")
    full_name  = f"{first_name} {last_name}".strip() or "Unknown"
    phone      = billing.get("phone") or shipping.get("phone", "")
    email      = billing.get("email", "")
    city       = billing.get("city") or shipping.get("city", "")
    address    = " ".join(filter(None, [
        billing.get("address_1") or shipping.get("address_1", ""),
        billing.get("address_2") or shipping.get("address_2", ""),
    ]))

    # Extract line items
    raw_items = []
    for item in (payload.get("line_items") or []):
        name = item.get("name", "")
        qty  = item.get("quantity", 1)
        if name:
            raw_items.append({"product_name": name, "quantity": qty})

    total = float(payload.get("total") or 0)

    matched, matched_total = _match_items(raw_items, store_id, db)

    order_ref = payload.get("number") or payload.get("id", "")

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
        notes=f"WooCommerce order #{order_ref}",
        status="pending",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    return {"ok": True, "lead_id": lead.id}
