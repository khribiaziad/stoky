from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import get_current_user, get_store_id
import models

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


class WarehouseCreate(BaseModel):
    name: str
    city: str
    is_default: bool = False


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    is_default: Optional[bool] = None


def _serialize(w: models.Warehouse) -> dict:
    return {
        "id":         w.id,
        "name":       w.name,
        "city":       w.city,
        "is_default": w.is_default,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }


def _set_default(store_id: int, warehouse_id: int, db: Session):
    """Make one warehouse the default and unset all others."""
    db.query(models.Warehouse).filter(
        models.Warehouse.store_id == store_id,
        models.Warehouse.id != warehouse_id,
    ).update({"is_default": False})
    db.query(models.Warehouse).filter_by(id=warehouse_id).update({"is_default": True})


def _sync_prices(store_id: int, db: Session):
    """Trigger price sync in background — errors are swallowed."""
    try:
        from services.delivery_prices import sync_all_prices
        sync_all_prices(store_id, db)
    except Exception:
        pass


@router.get("")
def list_warehouses(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = get_store_id(user)
    warehouses = db.query(models.Warehouse).filter_by(store_id=store_id).order_by(
        models.Warehouse.is_default.desc(),
        models.Warehouse.created_at.asc(),
    ).all()
    return [_serialize(w) for w in warehouses]


@router.post("")
def create_warehouse(
    data: WarehouseCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = get_store_id(user)
    existing_count = db.query(models.Warehouse).filter_by(store_id=store_id).count()

    # First warehouse is always default
    is_default = data.is_default or existing_count == 0

    wh = models.Warehouse(
        store_id=store_id,
        name=data.name,
        city=data.city.strip(),
        is_default=is_default,
    )
    db.add(wh)
    db.flush()

    if is_default:
        _set_default(store_id, wh.id, db)

    # Seed VariantStock for existing variants (quantity = 0)
    if existing_count == 0:
        # First warehouse: migrate existing Variant.stock
        variants = db.query(models.Variant).join(
            models.Product, models.Variant.product_id == models.Product.id
        ).filter(models.Product.user_id == store_id).all()
        for v in variants:
            existing_vs = db.query(models.VariantStock).filter_by(
                variant_id=v.id, warehouse_id=wh.id
            ).first()
            if not existing_vs:
                db.add(models.VariantStock(
                    variant_id=v.id,
                    warehouse_id=wh.id,
                    quantity=v.stock or 0,
                ))
    else:
        # Additional warehouse: start at zero for all variants
        variants = db.query(models.Variant).join(
            models.Product, models.Variant.product_id == models.Product.id
        ).filter(models.Product.user_id == store_id).all()
        for v in variants:
            existing_vs = db.query(models.VariantStock).filter_by(
                variant_id=v.id, warehouse_id=wh.id
            ).first()
            if not existing_vs:
                db.add(models.VariantStock(
                    variant_id=v.id,
                    warehouse_id=wh.id,
                    quantity=0,
                ))

    db.commit()
    db.refresh(wh)

    # Sync delivery prices for the new warehouse city
    _sync_prices(store_id, db)

    return _serialize(wh)


@router.put("/{warehouse_id}")
def update_warehouse(
    warehouse_id: int,
    data: WarehouseUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = get_store_id(user)
    wh = db.query(models.Warehouse).filter_by(id=warehouse_id, store_id=store_id).first()
    if not wh:
        raise HTTPException(404, "Warehouse not found")

    city_changed = data.city is not None and data.city.strip().lower() != wh.city.lower()

    if data.name is not None:
        wh.name = data.name.strip()
    if data.city is not None:
        wh.city = data.city.strip()
    if data.is_default:
        _set_default(store_id, wh.id, db)

    db.commit()
    db.refresh(wh)

    if city_changed:
        _sync_prices(store_id, db)

    return _serialize(wh)


@router.delete("/{warehouse_id}")
def delete_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = get_store_id(user)
    wh = db.query(models.Warehouse).filter_by(id=warehouse_id, store_id=store_id).first()
    if not wh:
        raise HTTPException(404, "Warehouse not found")

    count = db.query(models.Warehouse).filter_by(store_id=store_id).count()
    if count <= 1:
        raise HTTPException(400, "Cannot delete the only warehouse")

    if wh.is_default:
        raise HTTPException(400, "Cannot delete the default warehouse — set another warehouse as default first")

    # Check if warehouse has stock
    has_stock = db.query(models.VariantStock).filter(
        models.VariantStock.warehouse_id == warehouse_id,
        models.VariantStock.quantity > 0,
    ).first()
    if has_stock:
        raise HTTPException(400, "Cannot delete warehouse with remaining stock — transfer stock first")

    db.query(models.VariantStock).filter_by(warehouse_id=warehouse_id).delete()
    db.delete(wh)
    db.commit()
    return {"success": True}


@router.post("/sync-prices")
def sync_prices(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Manually trigger a price sync from all connected delivery companies."""
    store_id = get_store_id(user)
    try:
        from services.delivery_prices import sync_all_prices
        sync_all_prices(store_id, db)
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, f"Price sync failed: {str(e)}")


@router.get("/{warehouse_id}/stock")
def get_warehouse_stock(
    warehouse_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get all variant stock levels for a specific warehouse."""
    store_id = get_store_id(user)
    wh = db.query(models.Warehouse).filter_by(id=warehouse_id, store_id=store_id).first()
    if not wh:
        raise HTTPException(404, "Warehouse not found")

    stock_rows = db.query(models.VariantStock).filter_by(warehouse_id=warehouse_id).all()
    return {
        "warehouse": _serialize(wh),
        "stock": [
            {"variant_id": s.variant_id, "quantity": s.quantity}
            for s in stock_rows
        ],
    }
