"""Karima — owns all order operations in Stocky. Every status change goes through here."""
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

import models
from core.date_ranges import MOROCCO_TZ
from core.permissions import require_admin
from core.query_helpers import apply_date_filter, scoped_query
from services import expense_service, stock_service


# ---------------------------------------------------------------------------
# Status transition matrix — every valid move lives here and nowhere else
# ---------------------------------------------------------------------------

_ALLOWED_TRANSITIONS: dict = {
    "pending":     {"in_delivery", "cancelled"},
    "in_delivery": {"delivered", "returned", "lost", "no_answer"},
    "no_answer":   {"in_delivery", "reported", "cancelled"},
    "reported":    {"in_delivery", "cancelled"},
    "delivered":   {"returned"},  # exchange case only
}

# Statuses that require stock to be restored on transition
_RESTORE_ON_TRANSITION = {"cancelled", "returned"}


def _now() -> datetime:
    """Return current Morocco time as a naive datetime, compatible with DB columns."""
    return datetime.now(MOROCCO_TZ).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def create_order(
    db: Session,
    order_data: dict,
    store_id: int,
    created_by: Optional[int] = None,
) -> models.Order:
    """Create an order with items, automatic stock deduction, and an expense row.

    This is the single point of order creation. Callers pass raw data; Karima
    handles the DB writes, stock ledger, and expense guarantee.

    Calls stock_service.deduct_stock() for every item.
    Calls expense_service.create_order_expense() automatically — no order is
    ever created without an expense row.
    Sets order_date using MOROCCO_TZ.

    The order is db.add()'d and flushed but not committed — the caller commits.

    Args:
        db: Database session.
        order_data: Dict containing:
            Required — caleo_id (str), customer_name (str), total_amount (float),
                items (list of {variant_id: int, quantity: int}).
            Optional — customer_phone, customer_address, city, status
                (default "pending"), pack_id, offer_id, promo_code,
                discount_amount, warehouse_id, order_date (datetime).
        store_id: The store owner's user_id.
        created_by: Optional user_id of the user creating the order.

    Returns:
        The created Order model instance.

    Raises:
        HTTPException 404: If a referenced variant is not found.
        HTTPException 400: If stock is insufficient (raised by stock_service).
    """
    order = models.Order(
        user_id=store_id,
        uploaded_by=created_by,
        caleo_id=order_data["caleo_id"],
        customer_name=order_data["customer_name"],
        customer_phone=order_data.get("customer_phone"),
        customer_address=order_data.get("customer_address"),
        city=order_data.get("city"),
        total_amount=order_data["total_amount"],
        status=order_data.get("status", "pending"),
        order_date=order_data.get("order_date") or _now(),
        pack_id=order_data.get("pack_id"),
        offer_id=order_data.get("offer_id"),
        promo_code_used=order_data.get("promo_code"),
        discount_amount=order_data.get("discount_amount", 0),
        warehouse_id=order_data.get("warehouse_id"),
    )
    db.add(order)
    db.flush()  # populate order.id before writing items and expense

    warehouse_id = order_data.get("warehouse_id")
    items_for_stock: list = []

    for item_data in order_data.get("items", []):
        variant_id = item_data["variant_id"]
        quantity = item_data.get("quantity", 1)

        variant = (
            db.query(models.Variant)
            .options(joinedload(models.Variant.product))
            .filter(models.Variant.id == variant_id)
            .first()
        )
        if not variant:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Variant {variant_id} not found")

        db.add(models.OrderItem(
            order_id=order.id,
            variant_id=variant.id,
            product_name=variant.product.name,
            size=variant.size,
            color=variant.color,
            quantity=quantity,
            unit_cost=variant.buying_price or 0.0,
            unit_price=variant.selling_price,
        ))
        items_for_stock.append({"variant_id": variant_id, "quantity": quantity})

    stock_service.deduct_stock(db, items_for_stock, warehouse_id)
    expense_service.create_order_expense(db, order, order.city, store_id)
    return order


def change_order_status(
    db: Session,
    order: models.Order,
    new_status: str,
    changed_by: Optional[int] = None,
) -> models.Order:
    """Validate and apply a status transition. Restore stock on cancel or return.

    Enforces the allowed transition matrix — raises HTTP 400 for any move not
    explicitly listed. Calls stock_service.restore_stock() automatically when
    transitioning to cancelled or returned.

    Allowed transitions:
        pending     → in_delivery, cancelled
        in_delivery → delivered, returned, lost, no_answer
        no_answer   → in_delivery, reported, cancelled
        reported    → in_delivery, cancelled
        delivered   → returned  (exchange case only)

    The order is updated in-place but not committed — the caller commits.

    Args:
        db: Database session.
        order: The Order model instance to update. Must have .items loaded.
        new_status: Target status string.
        changed_by: Optional user_id of the actor (reserved for audit logging).

    Returns:
        The updated Order instance.

    Raises:
        HTTPException 400: If the transition is not in the allowed set.
    """
    current = order.status
    allowed = _ALLOWED_TRANSITIONS.get(current, set())

    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot transition order {order.id} from '{current}' to '{new_status}'. "
                f"Allowed next statuses: {sorted(allowed) or ['none']}"
            ),
        )

    if new_status in _RESTORE_ON_TRANSITION:
        items_to_restore = [
            {"variant_id": item.variant_id, "quantity": item.quantity}
            for item in order.items
            if item.variant_id
        ]
        stock_service.restore_stock(db, items_to_restore, order.warehouse_id)

    order.status = new_status
    return order


def soft_delete_order(
    db: Session,
    order: models.Order,
    deleted_by: Optional[models.User] = None,
) -> None:
    """Soft-delete an order. Never hard-deletes — financial history is always preserved.

    Sets order.is_deleted = True and order.deleted_at = now(Morocco time).
    Admin-only: raises HTTP 403 if deleted_by is None or is not an admin.

    Args:
        db: Database session.
        order: The Order model instance to soft-delete.
        deleted_by: The User performing the deletion — must be an admin.

    Raises:
        HTTPException 403: If deleted_by is None or does not have admin role.
    """
    if deleted_by is None:
        raise HTTPException(status_code=403, detail="Admin access required")
    require_admin(deleted_by)  # raises 403 if role != "admin"

    order.is_deleted = True
    order.deleted_at = _now()

    if order.promo_code_used:
        promo = db.query(models.PromoCode).filter(
            models.PromoCode.code == order.promo_code_used,
            models.PromoCode.user_id == order.user_id,
        ).first()
        if promo and promo.used_count > 0:
            promo.used_count -= 1


def get_orders(
    db: Session,
    store_id: int,
    filters: Optional[dict] = None,
) -> list:
    """Fetch orders with eager loading. Applies status, date, city, and search filters.

    Uses Omar's query_helpers for consistent store scoping and date filtering.
    Never lazy-loads — joinedload on items and expenses is always applied.

    Args:
        db: Database session.
        store_id: The store owner's user_id.
        filters: Optional dict with any of these keys:
            status (str)   — exact status match.
            start (datetime) — order_date lower bound (inclusive).
            end (datetime)   — order_date upper bound (inclusive).
            city (str)     — partial city name match (case-insensitive).
            search (str)   — partial match on customer_name, customer_phone,
                             or caleo_id (case-insensitive).

    Returns:
        List of Order instances, newest first, with items and expenses loaded.
    """
    filters = filters or {}

    q = scoped_query(db, models.Order, store_id).options(
        joinedload(models.Order.items),
        joinedload(models.Order.expenses),
    ).filter(models.Order.is_deleted == False)

    status = filters.get("status")
    if status:
        q = q.filter(models.Order.status == status)

    q = apply_date_filter(
        q, models.Order.order_date, filters.get("start"), filters.get("end")
    )

    city = filters.get("city")
    if city:
        q = q.filter(models.Order.city.ilike(f"%{city}%"))

    search = filters.get("search")
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                models.Order.customer_name.ilike(term),
                models.Order.customer_phone.ilike(term),
                models.Order.caleo_id.ilike(term),
            )
        )

    return q.order_by(models.Order.order_date.desc()).all()
