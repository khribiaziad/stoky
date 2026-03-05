from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models, httpx, unicodedata, re

router = APIRouter(prefix="/forcelog", tags=["forcelog"])

FORCELOG_BASE = "https://api.forcelog.ma"

# In-process cache for Forcelog city list (keyed by api_key)
_city_cache: dict[str, list[str]] = {}


def _strip_accents(s: str) -> str:
    """Lowercase + remove all diacritics: 'Salé' → 'sale'."""
    return ''.join(
        c for c in unicodedata.normalize('NFKD', s)
        if not unicodedata.combining(c)
    ).lower().strip()


def _fetch_forcelog_cities(api_key: str) -> list[str]:
    """Fetch and cache Forcelog's city name list."""
    if api_key in _city_cache:
        return _city_cache[api_key]
    try:
        r = httpx.get(
            f"{FORCELOG_BASE}/customer/Cities/GetCities",
            headers={"X-API-Key": api_key},
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            # Handle both list-of-strings and list-of-dicts formats
            raw = data.get("CITIES") or data.get("cities") or (data if isinstance(data, list) else [])
            cities = []
            for item in raw:
                if isinstance(item, str):
                    cities.append(item)
                elif isinstance(item, dict):
                    cities.append(item.get("NAME") or item.get("name") or item.get("CITY") or "")
            _city_cache[api_key] = [c for c in cities if c]
    except Exception:
        pass
    return _city_cache.get(api_key, [])


def _match_city(our_city: str, api_key: str) -> str:
    """
    Find Forcelog's exact city name for our city.
    1. Fetch Forcelog's city list.
    2. Match by stripping accents from both sides.
    3. Fall back to the original value if no match found.
    """
    city = our_city.strip()
    if not city:
        return city
    needle = _strip_accents(city)
    cities = _fetch_forcelog_cities(api_key)
    for c in cities:
        if _strip_accents(c) == needle:
            return c
    # Partial match (e.g. "El Jadida" inside "El Jadida Province")
    for c in cities:
        if needle in _strip_accents(c) or _strip_accents(c) in needle:
            return c
    return city  # unchanged — will still error, but at least we tried


def _normalize_phone_for_forcelog(phone: str) -> str:
    """Convert any Moroccan phone format to 0XXXXXXXXX (10 digits)."""
    import re
    p = re.sub(r'[\s\.\-\(\)]', '', phone or '')
    if p.startswith('+212'):
        p = '0' + p[4:]
    elif p.startswith('00212'):
        p = '0' + p[5:]
    elif p.startswith('212') and len(p) == 12:
        p = '0' + p[3:]
    return p[:14]


DELIVERED_KEYWORDS = ["livré", "livre", "delivered", "confirmé par livreur", "livraison effectuée"]
CANCELLED_KEYWORDS = ["annulé", "annule", "retour", "refusé", "refuse", "cancelled", "retourné", "retourne", "echec", "échoué"]


def _map_status(raw: str) -> str | None:
    """Map a raw delivery-company status string to Stocky's order status."""
    s = raw.lower()
    if any(k in s for k in DELIVERED_KEYWORDS):
        return "delivered"
    if any(k in s for k in CANCELLED_KEYWORDS):
        return "cancelled"
    return None  # still in transit / unknown → don't change order status


def _get_store_id(user: models.User) -> int:
    return user.store_id if user.role == "confirmer" else user.id


def _get_setting(db: Session, key: str, store_id: int):
    s = db.query(models.AppSettings).filter_by(key=key, user_id=store_id).first()
    return s.value if s else None


@router.get("/cities")
def get_forcelog_cities(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Fetch the list of cities accepted by Forcelog."""
    sid = _get_store_id(user)
    api_key = _get_setting(db, "forcelog_api_key", sid)
    if not api_key:
        raise HTTPException(400, "Forcelog API key not configured")
    _city_cache.pop(api_key, None)  # force refresh
    cities = _fetch_forcelog_cities(api_key)
    return {"cities": cities, "count": len(cities)}


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
        "PHONE":          _normalize_phone_for_forcelog(order.customer_phone or ""),
        "CITY":           _match_city(order.city or "", api_key)[:50],
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
        msg = result.get('MESSAGE', 'Unknown error')
        city_sent = _match_city(order.city or "", api_key)
        if "city" in msg.lower():
            msg += f" (sent: '{city_sent}', stored: '{order.city}')"
        raise HTTPException(400, f"Forcelog error: {msg}")

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
        mapped = _map_status(status_raw)
        if mapped:
            order.status = mapped
        db.commit()

    return {"status": status_raw, "tracking_id": order.tracking_id, "delivery_status": status_raw}


@router.post("/sync-all")
def sync_all_forcelog(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Refresh delivery status for all Forcelog orders that are still pending."""
    sid = _get_store_id(user)
    api_key = _get_setting(db, "forcelog_api_key", sid)
    if not api_key:
        raise HTTPException(400, "Forcelog API key not configured")

    orders = db.query(models.Order).filter(
        models.Order.user_id == sid,
        models.Order.delivery_provider == "forcelog",
        models.Order.tracking_id.isnot(None),
        models.Order.status == "pending",
    ).all()

    updated = []
    for order in orders:
        try:
            r = httpx.get(
                f"{FORCELOG_BASE}/customer/Parcels/GetParcel",
                params={"Code": order.tracking_id},
                headers={"X-API-Key": api_key},
                timeout=10,
            )
            if r.status_code == 200:
                status_raw = r.json().get("PARCEL", {}).get("STATUS", "")
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
