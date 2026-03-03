from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models, httpx

router = APIRouter(prefix="/forcelog", tags=["forcelog"])

FORCELOG_BASE = "https://api.forcelog.ma"


def _get_store_id(user: models.User) -> int:
    return user.store_id if user.role == "confirmer" else user.id


def _get_setting(db: Session, key: str, store_id: int):
    s = db.query(models.AppSettings).filter_by(key=key, user_id=store_id).first()
    return s.value if s else None


@router.post("/send/{order_id}")
def send_to_forcelog(
    order_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = _get_store_id(user)
    api_key = _get_setting(db, "forcelog_api_key", sid)

    if not api_key:
        raise HTTPException(400, "Forcelog API key not configured — go to Settings → Forcelog")

    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == sid,
    ).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.tracking_id:
        raise HTTPException(400, "Order already sent to a delivery service")

    # Build product description
    if order.items:
        parts = []
        for i in order.items:
            name = i.product_name
            if i.size:  name += f" {i.size}"
            if i.color: name += f" {i.color}"
            parts.append(f"{i.quantity}x {name}")
        description = ", ".join(parts)
    else:
        description = order.caleo_id

    payload = {
        "ORDER_NUM":      (order.caleo_id or str(order.id))[:20],
        "RECEIVER":       (order.customer_name or "")[:50],
        "PHONE":          (order.customer_phone or "")[:14],
        "CITY":           (order.city or "")[:50],
        "ADDRESS":        (order.customer_address or order.city or "")[:100],
        "COMMENT":        (order.notes or "")[:100],
        "PRODUCT_NATURE": description[:100],
        "COD":            order.total_amount or 0,
    }

    r = httpx.post(
        f"{FORCELOG_BASE}/customer/Parcels/AddParcel",
        json=payload,
        headers={"X-API-Key": api_key},
        timeout=15,
    )

    if r.status_code >= 400:
        raise HTTPException(400, f"Forcelog error: {r.text}")

    data = r.json()
    result = data.get("ADD-PARCEL", {})

    if result.get("RESULT") != "SUCCESS":
        raise HTTPException(400, f"Forcelog error: {result.get('MESSAGE', 'Unknown error')}")

    tracking_number = (result.get("NEW-PARCEL") or {}).get("TRACKING_NUMBER")

    order.tracking_id = tracking_number
    order.delivery_status = "Envoyé"
    order.delivery_provider = "forcelog"
    db.commit()

    return {"success": True, "tracking_id": tracking_number}


@router.get("/status/{order_id}")
def get_forcelog_status(
    order_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = _get_store_id(user)
    api_key = _get_setting(db, "forcelog_api_key", sid)

    if not api_key:
        raise HTTPException(400, "Forcelog API key not configured")

    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == sid,
    ).first()
    if not order or not order.tracking_id:
        raise HTTPException(404, "Order or tracking ID not found")

    r = httpx.get(
        f"{FORCELOG_BASE}/customer/Parcels/GetParcel",
        params={"Code": order.tracking_id},
        headers={"X-API-Key": api_key},
        timeout=15,
    )

    if r.status_code >= 400:
        raise HTTPException(400, f"Forcelog error: {r.text}")

    data = r.json()
    status_raw = data.get("PARCEL", {}).get("STATUS", "")

    if status_raw:
        order.delivery_status = status_raw
        s = status_raw.lower()
        if any(k in s for k in ["livré", "livre", "delivered"]):
            order.status = "delivered"
        elif any(k in s for k in ["annulé", "annule", "retour", "refusé"]):
            order.status = "cancelled"
        db.commit()

    return {"status": status_raw, "tracking_id": order.tracking_id, "delivery_status": status_raw}
