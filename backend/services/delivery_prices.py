"""Sync delivery company price lists from their APIs into DeliveryCompanyPrice table."""
import httpx
from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
import models


def _upsert_prices(db: Session, rows: list[dict]):
    """Bulk upsert DeliveryCompanyPrice rows."""
    if not rows:
        return
    for row in rows:
        existing = db.query(models.DeliveryCompanyPrice).filter_by(
            store_id=row["store_id"],
            company=row["company"],
            from_city=row["from_city"],
            to_city=row["to_city"],
        ).first()
        if existing:
            existing.national_fee = row["national_fee"]
            existing.local_fee    = row.get("local_fee")
        else:
            db.add(models.DeliveryCompanyPrice(**row))
    db.commit()


def sync_olivraison_prices(store_id: int, db: Session, token: str, from_city: str):
    """Pull Olivraison /cities price list and store it."""
    try:
        r = httpx.get(
            "https://partners.olivraison.com/cities",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        if r.status_code != 200:
            return
        cities = r.json()  # [{name, price}, ...]
        if not isinstance(cities, list):
            return
        from_city_norm = from_city.lower().strip()
        rows = []
        for c in cities:
            name  = (c.get("name") or "").lower().strip()
            price = c.get("price")
            if not name or price is None:
                continue
            rows.append({
                "store_id":     store_id,
                "company":      "olivraison",
                "from_city":    from_city_norm,
                "to_city":      name,
                "national_fee": float(price),
                "local_fee":    None,
            })
        _upsert_prices(db, rows)
    except Exception:
        pass


def sync_forcelog_prices(store_id: int, db: Session, api_key: str, from_city: str):
    """Pull Forcelog /Cities/GetCities price list and store it."""
    try:
        r = httpx.get(
            "https://api.forcelog.ma/customer/Cities/GetCities",
            headers={"X-API-Key": api_key},
            timeout=15,
        )
        if r.status_code != 200:
            return
        data = r.json()
        cities_raw = data.get("Cities") or data.get("cities") or {}
        # Handle both dict-of-dicts and list formats
        if isinstance(cities_raw, dict):
            city_list = list(cities_raw.values())
        elif isinstance(cities_raw, list):
            city_list = cities_raw
        else:
            return
        from_city_norm = from_city.lower().strip()
        rows = []
        for c in city_list:
            if not isinstance(c, dict):
                continue
            name         = (c.get("NAME") or c.get("name") or "").lower().strip()
            national_fee = c.get("D_FEES") or c.get("d_fees")
            local_fee    = c.get("D_FEES_SAME_CITY") or c.get("d_fees_same_city")
            if not name or national_fee is None:
                continue
            rows.append({
                "store_id":     store_id,
                "company":      "forcelog",
                "from_city":    from_city_norm,
                "to_city":      name,
                "national_fee": float(national_fee),
                "local_fee":    float(local_fee) if local_fee is not None else None,
            })
        _upsert_prices(db, rows)
    except Exception:
        pass


def sync_all_prices(store_id: int, db: Session):
    """Sync prices for all configured delivery companies for this store."""
    def get_setting(key):
        s = db.query(models.AppSettings).filter_by(key=key, user_id=store_id).first()
        return s.value if s else None

    # Get the default warehouse city as the origin
    default_wh = db.query(models.Warehouse).filter_by(store_id=store_id, is_default=True).first()
    if not default_wh:
        default_wh = db.query(models.Warehouse).filter_by(store_id=store_id).first()
    from_city = default_wh.city if default_wh else ""

    # Olivraison
    oliv_key    = get_setting("olivraison_api_key")
    oliv_secret = get_setting("olivraison_secret_key")
    if oliv_key and oliv_secret and from_city:
        try:
            r = httpx.post(
                "https://partners.olivraison.com/auth/login",
                json={"apiKey": oliv_key, "secretKey": oliv_secret},
                timeout=10,
            )
            if r.status_code == 200:
                token = r.json().get("token")
                if token:
                    sync_olivraison_prices(store_id, db, token, from_city)
        except Exception:
            pass

    # Forcelog
    fl_key = get_setting("forcelog_api_key")
    if fl_key and from_city:
        sync_forcelog_prices(store_id, db, fl_key, from_city)
