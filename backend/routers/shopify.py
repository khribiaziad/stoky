from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
import models
from integrations.ecommerce.shopify.integration import ShopifyIntegration

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

    lead = ShopifyIntegration().process_webhook(db, api_key_record.store_id, payload)
    return {"ok": True, "lead_id": lead.id if lead else None}
