from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models, httpx, time

router = APIRouter(prefix="/olivraison", tags=["olivraison"])

OLIVRAISON_BASE = "https://partners.olivraison.com"

# Token cache per store: {store_id: {"token": str, "expires_at": float}}
_token_cache: dict = {}


def _get_store_id(user: models.User) -> int:
    return user.store_id if user.role == "confirmer" else user.id


def _get_setting(db: Session, key: str, store_id: int):
    s = db.query(models.AppSettings).filter_by(key=key, user_id=store_id).first()
    return s.value if s else None


def _get_token(store_id: int, api_key: str, secret_key: str) -> str:
    cached = _token_cache.get(store_id)
    if cached and cached["expires_at"] > time.time() + 60:
        return cached["token"]
    r = httpx.post(
        f"{OLIVRAISON_BASE}/auth/login",
        json={"apiKey": api_key, "secretKey": secret_key},
        timeout=10,
    )
    if r.status_code != 200:
        raise HTTPException(400, "Olivraison authentication failed — check your API credentials in Settings → Store → Olivraison")
    data = r.json()
    token = data["token"]
    _token_cache[store_id] = {"token": token, "expires_at": time.time() + 3600}
    return token


@router.post("/send/{order_id}")
def send_to_olivraison(
    order_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = _get_store_id(user)

    api_key  = _get_setting(db, "olivraison_api_key",      sid)
    secret   = _get_setting(db, "olivraison_secret_key",   sid)
    p_street = _get_setting(db, "olivraison_pickup_street", sid) or ""
    p_city   = _get_setting(db, "olivraison_pickup_city",  sid) or ""
    p_phone  = _get_setting(db, "olivraison_pickup_phone", sid) or ""

    if not api_key or not secret:
        raise HTTPException(400, "Olivraison credentials not configured — go to Settings → Store → Olivraison")

    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == sid,
    ).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.tracking_id:
        raise HTTPException(400, "Order already sent to Olivraison")

    # Build description from order items
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

    token = _get_token(sid, api_key, secret)

    payload = {
        "price": order.total_amount,
        "comment": order.notes or "",
        "description": description,
        "inventory": False,
        "name": description,
        "destination": {
            "name": order.customer_name,
            "phone": order.customer_phone or "",
            "city": order.city or "",
            "streetAddress": order.customer_address or "",
        },
        "pickup_address": {
            "streetAddress": p_street,
            "city": p_city,
            "phone": p_phone,
            "company": user.store_name,
            "email": "",
            "website": "",
        },
    }

    r = httpx.post(
        f"{OLIVRAISON_BASE}/package",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )

    if r.status_code >= 400:
        raise HTTPException(400, f"Olivraison error: {r.text}")

    data = r.json()
    tracking_id = data.get("trackingID")

    order.tracking_id = tracking_id
    order.delivery_status = "Envoyé"
    order.delivery_provider = "olivraison"
    db.commit()

    return {"success": True, "tracking_id": tracking_id}


@router.post("/webhook")
async def olivraison_webhook(request: Request, db: Session = Depends(get_db)):
    """Public webhook — Olivraison calls this when delivery status changes."""
    try:
        payload = await request.json()
    except Exception:
        return {"ok": True}

    tracking_id = (
        payload.get("trackingID")
        or payload.get("tracking_id")
        or payload.get("id")
    )
    status_raw = str(payload.get("status") or payload.get("statut") or "").strip()

    if not tracking_id:
        return {"ok": True}

    order = db.query(models.Order).filter(
        models.Order.tracking_id == tracking_id
    ).first()
    if not order:
        return {"ok": True}

    # Always store the raw Olivraison status label
    if status_raw:
        order.delivery_status = status_raw

    # Map to Stocky order status
    from routers.forcelog import _map_status
    mapped = _map_status(status_raw)
    if mapped:
        order.status = mapped

    # Create in-app notification for meaningful events
    if status_raw:
        from routers.notifications import _create_notification
        if mapped == "delivered":
            _create_notification(db, order.user_id, order, f"Livré — {status_raw}", "delivered")
        elif mapped == "cancelled":
            _create_notification(db, order.user_id, order, f"Retour — {status_raw}", "returned")

    db.commit()
    return {"ok": True}


@router.post("/ramassage")
def request_ramassage(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = _get_store_id(user)
    api_key = _get_setting(db, "olivraison_api_key", sid)
    secret  = _get_setting(db, "olivraison_secret_key", sid)
    if not api_key or not secret:
        raise HTTPException(400, "Olivraison credentials not configured — go to Settings → Olivraison")

    # In-delivery = pending status with a tracking ID assigned
    orders = db.query(models.Order).filter(
        models.Order.user_id == sid,
        models.Order.delivery_provider == "olivraison",
        models.Order.status == "pending",
        models.Order.tracking_id.isnot(None),
    ).all()

    if not orders:
        raise HTTPException(400, "No in-delivery Olivraison orders found for ramassage")

    tracking_ids = [o.tracking_id for o in orders]
    token = _get_token(sid, api_key, secret)

    with httpx.Client() as client:
        r = client.post(
            f"{OLIVRAISON_BASE}/pickup",
            json={"packages": tracking_ids},
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        r.raise_for_status()
        data = r.json()

    return {
        "count": len(tracking_ids),
        "sticker_url": data.get("stickerFilePath"),
        "slip_url": data.get("sipFilePath"),
    }


@router.post("/sync-all")
def sync_all_olivraison(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Refresh delivery status for all Olivraison orders that are still pending."""
    from routers.forcelog import _map_status
    sid = _get_store_id(user)
    api_key = _get_setting(db, "olivraison_api_key", sid)
    secret  = _get_setting(db, "olivraison_secret_key", sid)
    if not api_key or not secret:
        raise HTTPException(400, "Olivraison credentials not configured")

    token = _get_token(sid, api_key, secret)

    orders = db.query(models.Order).filter(
        models.Order.user_id == sid,
        models.Order.delivery_provider == "olivraison",
        models.Order.tracking_id.isnot(None),
    ).all()

    updated = []
    for order in orders:
        try:
            r = httpx.get(
                f"{OLIVRAISON_BASE}/package/{order.tracking_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            if r.status_code == 200:
                data = r.json()
                status_raw = str(data.get("status") or data.get("statut") or "").strip()
                if status_raw:
                    order.delivery_status = status_raw
                    mapped = _map_status(status_raw)
                    if mapped:
                        order.status = mapped
                    updated.append({"id": order.id, "caleo_id": order.caleo_id, "delivery_status": status_raw, "status": order.status})
        except Exception:
            continue

    db.commit()
    return {"updated": len(updated), "orders": updated}
