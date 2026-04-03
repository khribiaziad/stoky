from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db
from auth import get_current_user, get_store_id
import models

router = APIRouter(prefix="/campaign-connections", tags=["campaign_connections"])


class ConnectionCreate(BaseModel):
    platform: str = "meta"
    meta_campaign_id: str          # Platform campaign ID (string)
    campaign_name: str = ""
    item_type: str                 # "product", "pack", "offer"
    item_id: int


def _item_name(item_type: str, item_id: int, db: Session, store_id: int) -> str:
    if item_type == "product":
        obj = db.query(models.Product).filter(
            models.Product.id == item_id, models.Product.user_id == store_id
        ).first()
    elif item_type == "pack":
        obj = db.query(models.Pack).filter(
            models.Pack.id == item_id, models.Pack.user_id == store_id
        ).first()
    elif item_type == "offer":
        obj = db.query(models.Offer).filter(
            models.Offer.id == item_id, models.Offer.user_id == store_id
        ).first()
    else:
        return "Unknown"
    return obj.name if obj else "Unknown"


def _serialize(conn: models.CampaignConnection, db: Session, store_id: int) -> dict:
    return {
        "id": conn.id,
        "platform": conn.platform,
        "meta_campaign_id": conn.meta_campaign_id,
        "campaign_name": conn.campaign_name,
        "item_type": conn.item_type,
        "item_id": conn.item_id,
        "item_name": _item_name(conn.item_type, conn.item_id, db, store_id),
    }


def _get_orders_for_item(item_type, item_id, store_id, from_dt, to_dt, db):
    base = db.query(models.Order).filter(
        models.Order.user_id == store_id,
        models.Order.order_date >= from_dt,
        models.Order.order_date <= to_dt,
    )
    if item_type == "product":
        ids_q = (
            db.query(models.Order.id)
            .join(models.OrderItem, models.OrderItem.order_id == models.Order.id)
            .join(models.Variant, models.Variant.id == models.OrderItem.variant_id)
            .filter(
                models.Variant.product_id == item_id,
                models.Order.user_id == store_id,
                models.Order.order_date >= from_dt,
                models.Order.order_date <= to_dt,
            )
            .distinct()
        )
        return db.query(models.Order).filter(models.Order.id.in_(ids_q)).all()
    elif item_type == "pack":
        return base.filter(models.Order.pack_id == item_id).all()
    elif item_type == "offer":
        return base.filter(models.Order.offer_id == item_id).all()
    return []


def _avg(values):
    return round(sum(values) / len(values), 2) if values else None


def _order_stats(orders):
    total            = len(orders)
    delivered_orders = [o for o in orders if o.status == "delivered"]
    returned_orders  = [o for o in orders if o.status == "cancelled"]
    delivered        = len(delivered_orders)
    returned         = len(returned_orders)

    avg_delivery_cost  = _avg([o.expenses.delivery_fee for o in delivered_orders if o.expenses and o.expenses.delivery_fee])
    avg_packaging_cost = _avg([o.expenses.packaging for o in delivered_orders if o.expenses and o.expenses.packaging])
    avg_return_cost    = _avg([o.expenses.return_fee for o in returned_orders if o.expenses and o.expenses.return_fee])

    # Weighted average buy price per order: sum(unit_cost × qty) / total_qty across delivered orders
    buy_price_per_order = []
    for o in delivered_orders:
        total_qty  = sum(i.quantity for i in o.items)
        total_cost = sum(i.unit_cost * i.quantity for i in o.items)
        if total_qty > 0:
            buy_price_per_order.append(total_cost / total_qty)
    avg_buy_price = _avg(buy_price_per_order)

    return {
        "total_orders":      total,
        "delivered_orders":  delivered,
        "returned_orders":   returned,
        "return_rate":       round(returned / total * 100, 1) if total > 0 else 0,
        "avg_delivery_cost":  avg_delivery_cost,
        "avg_packaging_cost": avg_packaging_cost,
        "avg_return_cost":    avg_return_cost,
        "avg_buy_price":      avg_buy_price,
    }


# ── item-stats / bulk-stats must come before /{conn_id} ─────────────────────
@router.get("/item-stats")
def get_item_stats(
    item_type: str = Query(...),
    item_id:   int = Query(...),
    start: Optional[str] = Query(None),
    end:   Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    from_dt  = datetime.fromisoformat(start) if start else datetime(2000, 1, 1)
    to_dt    = datetime.fromisoformat(end)   if end   else datetime.now()
    store_id = get_store_id(user)
    orders   = _get_orders_for_item(item_type, item_id, store_id, from_dt, to_dt, db)
    return _order_stats(orders)


@router.get("/bulk-stats")
def get_bulk_stats(
    start: Optional[str] = Query(None),
    end:   Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = get_store_id(user)
    from_dt  = datetime.fromisoformat(start) if start else datetime(2000, 1, 1)
    to_dt    = datetime.fromisoformat(end)   if end   else datetime.now()
    conns    = db.query(models.CampaignConnection).filter(
        models.CampaignConnection.user_id == store_id
    ).all()
    result = {}
    for conn in conns:
        orders = _get_orders_for_item(conn.item_type, conn.item_id, store_id, from_dt, to_dt, db)
        result[conn.id] = _order_stats(orders)
    return result


@router.get("")
def list_connections(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = get_store_id(user)
    conns = db.query(models.CampaignConnection).filter(
        models.CampaignConnection.user_id == store_id
    ).all()
    return [_serialize(c, db, store_id) for c in conns]


@router.post("")
def upsert_connection(
    data: ConnectionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    import logging
    store_id = get_store_id(user)

    # Fix #224: validate item belongs to this store
    item = None
    if data.item_type == "product":
        item = db.query(models.Product).filter(
            models.Product.id == data.item_id,
            models.Product.user_id == store_id,
        ).first()
    elif data.item_type == "pack":
        item = db.query(models.Pack).filter(
            models.Pack.id == data.item_id,
            models.Pack.user_id == store_id,
        ).first()
    elif data.item_type == "offer":
        item = db.query(models.Offer).filter(
            models.Offer.id == data.item_id,
            models.Offer.user_id == store_id,
        ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in your store")

    existing = db.query(models.CampaignConnection).filter(
        models.CampaignConnection.meta_campaign_id == data.meta_campaign_id,
        models.CampaignConnection.platform == data.platform,
        models.CampaignConnection.user_id == store_id,
    ).first()
    if existing:
        # Fix #159: log campaign attribution changes before overwriting
        logging.info(
            f"Campaign connection updated: store={store_id} campaign={data.meta_campaign_id} "
            f"old_item={existing.item_type}:{existing.item_id} new_item={data.item_type}:{data.item_id}"
        )
        existing.item_type     = data.item_type
        existing.item_id       = data.item_id
        existing.campaign_name = data.campaign_name
        existing.platform      = data.platform
        db.commit()
        db.refresh(existing)
        return _serialize(existing, db, store_id)
    conn = models.CampaignConnection(
        user_id=store_id,
        platform=data.platform,
        meta_campaign_id=data.meta_campaign_id,
        campaign_name=data.campaign_name,
        item_type=data.item_type,
        item_id=data.item_id,
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return _serialize(conn, db, store_id)


@router.delete("/{conn_id}")
def delete_connection(
    conn_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = get_store_id(user)
    conn = db.query(models.CampaignConnection).filter(
        models.CampaignConnection.id == conn_id,
        models.CampaignConnection.user_id == store_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()
    return {"success": True}
