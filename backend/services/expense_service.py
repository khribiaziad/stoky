"""Karima's expense ledger. Every order must have an expense row. No exceptions."""
from typing import Optional

from sqlalchemy.orm import Session

import models


def _get_setting(db: Session, key: str, user_id: int) -> Optional[str]:
    """Look up a store AppSettings value by key. Returns None if not found or unset."""
    row = (
        db.query(models.AppSettings)
        .filter(
            models.AppSettings.key == key,
            models.AppSettings.user_id == user_id,
        )
        .first()
    )
    return row.value if (row and row.value is not None) else None


def _safe_float(value, default: float) -> float:
    """Convert a value to float safely. Returns default on any failure."""
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def create_order_expense(
    db: Session,
    order: models.Order,
    city: Optional[str],
    store_id: int,
) -> models.OrderExpense:
    """Create an OrderExpense row for an order. Never returns None.

    Fee lookup priority for delivery_fee and return_fee:
      1. City table — case-insensitive name match.
      2. Store AppSettings — keys: default_delivery_fee, default_return_fee.
      3. Hardcoded defaults — delivery: 35 MAD, return: 7 MAD.

    Packaging, sticker, and seal_bag defaults are read from AppSettings keys
    default_packaging, default_sticker, and default_seal_bag respectively,
    falling back to 1.0, 0.0, and 0.0.

    The returned expense is db.add()'d but not yet committed — the caller commits.

    Args:
        db: Database session.
        order: Order model instance. Must have a valid id (call db.flush() first).
        city: Destination city name used for fee lookup. May be None.
        store_id: Store owner's user_id for AppSettings lookup.

    Returns:
        The newly created OrderExpense instance.
    """
    # 1. City table
    city_row = None
    if city:
        city_row = db.query(models.City).filter(models.City.name.ilike(city)).first()

    if city_row:
        delivery_fee = city_row.delivery_fee
        return_fee = city_row.return_fee
    else:
        # 2. AppSettings → 3. hardcoded fallbacks
        delivery_fee = _safe_float(
            _get_setting(db, "default_delivery_fee", store_id), 35.0
        )
        return_fee = _safe_float(
            _get_setting(db, "default_return_fee", store_id), 7.0
        )

    default_packaging = _safe_float(_get_setting(db, "default_packaging", store_id), 1.0)
    default_sticker   = _safe_float(_get_setting(db, "default_sticker",   store_id), 0.0)
    default_seal_bag  = _safe_float(_get_setting(db, "default_seal_bag",  store_id), 0.0)

    expense = models.OrderExpense(
        order_id=order.id,
        delivery_fee=delivery_fee,
        return_fee=return_fee,
        packaging=default_packaging,
        sticker=default_sticker,
        seal_bag=default_seal_bag,
    )
    db.add(expense)
    return expense


def get_or_create_expense(db: Session, order: models.Order) -> models.OrderExpense:
    """Return the existing expense row for an order, or create a default one.

    Fixes Bug #189 — no order is ever left without an expense row.
    Safe to call multiple times: returns the existing row immediately if present.

    Args:
        db: Database session.
        order: The Order model instance.

    Returns:
        The existing or newly created OrderExpense.
    """
    if order.expenses:
        return order.expenses
    return create_order_expense(db, order, order.city, order.user_id)


def update_delivery_fees(
    db: Session,
    order: models.Order,
    delivery_fee: float,
    return_fee: float,
) -> None:
    """Update delivery and return fees on an order after courier confirmation.

    Called by the courier integration layer (Youssef) when Olivraison or
    Forcelog confirm pickup and supply final fee amounts. Creates an expense
    row first if the order does not already have one.

    Args:
        db: Database session.
        order: The Order model instance.
        delivery_fee: Confirmed delivery fee from the courier.
        return_fee: Confirmed return fee from the courier.
    """
    expense = get_or_create_expense(db, order)
    expense.delivery_fee = delivery_fee
    expense.return_fee = return_fee
