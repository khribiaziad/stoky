"""Smart warehouse selection: pick the warehouse with sufficient stock and lowest delivery cost."""
import unicodedata
from sqlalchemy.orm import Session
import models


def _norm(city: str) -> str:
    """Lowercase + strip accents for fuzzy city matching."""
    s = unicodedata.normalize("NFKD", city or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


def _get_delivery_cost(warehouse: models.Warehouse, customer_city: str, store_id: int, db: Session) -> float | None:
    """
    Look up delivery cost from warehouse city to customer city.
    Priority: DeliveryCompanyPrice (from API sync) → City table fallback.
    """
    from_norm = _norm(warehouse.city)
    to_norm   = _norm(customer_city)

    # Try all synced company prices for this store/from_city — pick cheapest
    prices = db.query(models.DeliveryCompanyPrice).filter(
        models.DeliveryCompanyPrice.store_id == store_id,
        models.DeliveryCompanyPrice.from_city == from_norm,
    ).all()

    best = None
    for p in prices:
        if _norm(p.to_city) != to_norm:
            continue
        # Use local_fee if same city, otherwise national_fee
        if from_norm == to_norm and p.local_fee is not None:
            cost = p.local_fee
        else:
            cost = p.national_fee
        if best is None or cost < best:
            best = cost

    if best is not None:
        return best

    # Fallback: City table (existing logic)
    city_row = db.query(models.City).filter(
        models.City.name.ilike(customer_city)
    ).first()
    if city_row:
        return city_row.delivery_fee

    return None


def _check_stock(items: list, warehouse_id: int, db: Session) -> bool:
    """Return True if all order items have sufficient stock in this warehouse."""
    for item in items:
        variant_id = item.get("variant_id") if isinstance(item, dict) else getattr(item, "variant_id", None)
        quantity   = item.get("quantity")   if isinstance(item, dict) else getattr(item, "quantity", 1)
        if variant_id is None:
            continue
        stock_row = db.query(models.VariantStock).filter_by(
            variant_id=variant_id,
            warehouse_id=warehouse_id,
        ).first()
        available = stock_row.quantity if stock_row else 0
        if available < quantity:
            return False
    return True


def pick_warehouse(items, customer_city: str, store_id: int, db: Session):
    """
    Select the best warehouse for an order.
    Returns (warehouse, delivery_cost) or (None, None) if no warehouse has stock.

    items can be a list of ORM OrderItem objects or dicts with variant_id/quantity.
    """
    warehouses = db.query(models.Warehouse).filter_by(store_id=store_id).all()
    if not warehouses:
        return None, None

    # Check if VariantStock is populated at all for this store
    has_warehouse_stock = db.query(models.VariantStock).join(
        models.Warehouse, models.VariantStock.warehouse_id == models.Warehouse.id
    ).filter(models.Warehouse.store_id == store_id).first() is not None

    candidates = []
    for wh in warehouses:
        # If VariantStock isn't populated yet (pre-migration), skip stock check
        if has_warehouse_stock and not _check_stock(items, wh.id, db):
            continue
        cost = _get_delivery_cost(wh, customer_city, store_id, db)
        candidates.append((wh, cost))

    if not candidates:
        return None, None

    # Sort by cost (None = unknown, treat as infinity), then prefer default warehouse
    def sort_key(x):
        wh, cost = x
        return (cost if cost is not None else 999999, 0 if wh.is_default else 1)

    candidates.sort(key=sort_key)
    best_wh, best_cost = candidates[0]
    return best_wh, best_cost


def deduct_warehouse_stock(items, warehouse_id: int, db: Session):
    """Deduct order item quantities from VariantStock for the chosen warehouse."""
    for item in items:
        variant_id = item.get("variant_id") if isinstance(item, dict) else getattr(item, "variant_id", None)
        quantity   = item.get("quantity")   if isinstance(item, dict) else getattr(item, "quantity", 1)
        if variant_id is None:
            continue
        stock_row = db.query(models.VariantStock).filter_by(
            variant_id=variant_id,
            warehouse_id=warehouse_id,
        ).first()
        if stock_row:
            stock_row.quantity = max(0, stock_row.quantity - quantity)


def restore_warehouse_stock(items, warehouse_id: int, db: Session):
    """Restore order item quantities to VariantStock (e.g. on cancellation)."""
    for item in items:
        variant_id = item.get("variant_id") if isinstance(item, dict) else getattr(item, "variant_id", None)
        quantity   = item.get("quantity")   if isinstance(item, dict) else getattr(item, "quantity", 1)
        if variant_id is None:
            continue
        stock_row = db.query(models.VariantStock).filter_by(
            variant_id=variant_id,
            warehouse_id=warehouse_id,
        ).first()
        if stock_row:
            stock_row.quantity += quantity
        else:
            db.add(models.VariantStock(
                variant_id=variant_id,
                warehouse_id=warehouse_id,
                quantity=quantity,
            ))
