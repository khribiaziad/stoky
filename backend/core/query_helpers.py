"""
Shared SQLAlchemy query utilities used across multiple routers.

Eliminates repeated filter patterns and ensures consistent store scoping
and date filtering throughout the codebase.

Usage:
    from core.query_helpers import apply_date_filter, scoped_query

    # Scope a query to the current store and optionally filter by date range:
    q = scoped_query(db, models.Order, uid)
    q = apply_date_filter(q, models.Order.order_date, s, e)
    orders = q.filter(models.Order.status == "delivered").all()

    # Or combined:
    q = scoped_order_query(db, uid, s, e, status="delivered")
"""

from datetime import datetime
from typing import Optional, Type, TypeVar
from sqlalchemy.orm import Session, Query
from sqlalchemy import Column
import models

T = TypeVar("T")


def apply_date_filter(
    query: Query,
    date_column: Column,
    start: Optional[datetime],
    end: Optional[datetime],
) -> Query:
    """
    Apply optional start/end datetime filters to an existing SQLAlchemy query.

    Both bounds are inclusive. Pass None to skip that bound.

    Usage:
        q = db.query(models.Order)
        q = apply_date_filter(q, models.Order.order_date, s, e)
    """
    if start:
        query = query.filter(date_column >= start)
    if end:
        query = query.filter(date_column <= end)
    return query


def scoped_query(db: Session, model: Type[T], user_id: int) -> Query:
    """
    Return a query for model filtered to a single store's user_id.

    Assumes the model has a user_id column. Use for Order, Product,
    TeamMember, FixedExpense, Variant (via Product join), etc.

    Usage:
        orders = scoped_query(db, models.Order, uid).filter(...).all()
    """
    return db.query(model).filter(model.user_id == user_id)


def scoped_order_query(
    db: Session,
    user_id: int,
    start: Optional[datetime],
    end: Optional[datetime],
    status: Optional[str] = None,
) -> Query:
    """
    Return a query for orders scoped to a store, optionally filtered by status and date.

    This is the most common query pattern in the reports and orders routers.
    Centralising it ensures store isolation is never forgotten.

    Usage:
        delivered = scoped_order_query(db, uid, s, e, status="delivered").all()
        all_orders = scoped_order_query(db, uid, s, e).count()
    """
    q = db.query(models.Order).filter(models.Order.user_id == user_id)
    if status:
        q = q.filter(models.Order.status == status)
    q = apply_date_filter(q, models.Order.order_date, start, end)
    return q
