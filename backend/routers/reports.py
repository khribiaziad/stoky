from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
from auth import get_current_user, get_store_id
from services.calculations import (
    calculate_gross_profit, calculate_team_costs, calculate_fixed_expenses,
    calculate_facebook_ads, calculate_cash_balance, calculate_stock_value,
    calculate_total_capital, count_delivered_orders,
)
import models

router = APIRouter(prefix="/reports", tags=["reports"])


def parse_date_range(period, start, end):
    now = datetime.now()
    if period == "today":
        s = now.replace(hour=0, minute=0, second=0, microsecond=0)
        e = now
    elif period == "yesterday":
        yesterday = now - timedelta(days=1)
        s = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        e = yesterday.replace(hour=23, minute=59, second=59)
    elif period == "this_week":
        s = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        e = now
    elif period == "last_7_days":
        s = now - timedelta(days=7)
        e = now
    elif period == "this_month":
        s = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        e = now
    elif period == "custom" and start and end:
        s = datetime.fromisoformat(start)
        e = datetime.fromisoformat(end)
    else:
        s = None
        e = None
    return s, e


@router.get("/summary")
def get_summary(
    period: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    s, e = parse_date_range(period, start, end)
    uid = get_store_id(user)

    gross_profit = calculate_gross_profit(db, s, e, uid)
    team_costs = calculate_team_costs(db, s, e, uid)
    fixed_costs = calculate_fixed_expenses(db, s, e, uid)
    ads_costs = calculate_facebook_ads(db, s, e, uid)
    clean_profit = gross_profit - team_costs - fixed_costs - ads_costs

    base_q = db.query(func.count(models.Order.id)).filter(models.Order.user_id == uid)
    total = (base_q.filter(models.Order.order_date >= s) if s else base_q).scalar() or 0

    def count_by_status(status):
        q = db.query(func.count(models.Order.id)).filter(models.Order.status == status, models.Order.user_id == uid)
        if s: q = q.filter(models.Order.order_date >= s)
        if e: q = q.filter(models.Order.order_date <= e)
        return q.scalar() or 0

    delivered = count_by_status("delivered")
    cancelled = count_by_status("cancelled")
    pending = count_by_status("pending")

    rev_q = db.query(func.sum(models.Order.total_amount)).filter(models.Order.status == "delivered", models.Order.user_id == uid)
    if s: rev_q = rev_q.filter(models.Order.order_date >= s)
    if e: rev_q = rev_q.filter(models.Order.order_date <= e)
    revenue = rev_q.scalar() or 0.0

    total_for_rate = count_by_status("delivered") + count_by_status("cancelled") + count_by_status("pending")

    return {
        "financials": {
            "gross_profit": round(gross_profit, 2),
            "team_costs": round(team_costs, 2),
            "fixed_costs": round(fixed_costs, 2),
            "ads_costs": round(ads_costs, 2),
            "clean_profit": round(clean_profit, 2),
            "revenue": round(revenue, 2),
        },
        "capital": {
            "cash_balance": round(calculate_cash_balance(db, uid), 2),
            "stock_value": round(calculate_stock_value(db, uid), 2),
            "total_capital": round(calculate_total_capital(db, uid), 2),
        },
        "orders": {
            "total": total,
            "delivered": delivered,
            "cancelled": cancelled,
            "pending": pending,
            "delivery_rate": round(delivered / total_for_rate * 100, 1) if total_for_rate > 0 else 0,
            "return_rate": round(cancelled / total_for_rate * 100, 1) if total_for_rate > 0 else 0,
            "avg_order_value": round(revenue / delivered, 1) if delivered > 0 else 0,
        },
    }


@router.get("/top-products")
def top_products(
    period: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    s, e = parse_date_range(period, start, end)
    query = (
        db.query(
            models.OrderItem.product_name,
            func.sum(models.OrderItem.quantity).label("total_qty"),
            func.count(models.OrderItem.order_id.distinct()).label("order_count"),
            func.sum(models.OrderItem.quantity * func.coalesce(models.OrderItem.unit_price, 0)).label("revenue"),
        )
        .join(models.Order, models.OrderItem.order_id == models.Order.id)
        .filter(models.Order.status == "delivered", models.Order.user_id == get_store_id(user))
        .group_by(models.OrderItem.product_name)
        .order_by(func.sum(models.OrderItem.quantity).desc())
    )
    if s: query = query.filter(models.Order.order_date >= s)
    if e: query = query.filter(models.Order.order_date <= e)
    return [{"product_name": r.product_name, "total_qty": r.total_qty, "order_count": r.order_count, "revenue": round(r.revenue or 0, 2)} for r in query.limit(10).all()]


@router.get("/top-cities")
def top_cities(
    period: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    s, e = parse_date_range(period, start, end)
    query = (
        db.query(models.Order.city, func.count(models.Order.id).label("order_count"), func.sum(models.Order.total_amount).label("revenue"))
        .filter(models.Order.status == "delivered", models.Order.user_id == get_store_id(user))
        .group_by(models.Order.city)
        .order_by(func.count(models.Order.id).desc())
    )
    if s: query = query.filter(models.Order.order_date >= s)
    if e: query = query.filter(models.Order.order_date <= e)
    return [{"city": r.city, "order_count": r.order_count, "revenue": round(r.revenue or 0, 2)} for r in query.limit(10).all()]


@router.get("/cities")
def list_cities(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    cities = db.query(models.City).order_by(models.City.name).all()
    return [{"id": c.id, "name": c.name, "delivery_fee": c.delivery_fee, "return_fee": c.return_fee, "is_casa": c.is_casa} for c in cities]


def _prev_range(period, s, e, now):
    """Return (prev_start, prev_end) for the period preceding (s, e)."""
    if period == "today":
        yesterday = now - timedelta(days=1)
        return (
            yesterday.replace(hour=0, minute=0, second=0, microsecond=0),
            yesterday.replace(hour=23, minute=59, second=59),
        )
    if period == "last_7_days":
        return (now - timedelta(days=14), now - timedelta(days=7))
    if period == "this_week":
        day = now.weekday()
        start_of_week = (now - timedelta(days=day)).replace(hour=0, minute=0, second=0, microsecond=0)
        prev_end = start_of_week - timedelta(seconds=1)
        return (start_of_week - timedelta(days=7), prev_end)
    if period == "this_month":
        first_this = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_end = first_this - timedelta(seconds=1)
        prev_start = prev_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return (prev_start, prev_end)
    if s and e:
        duration = e - s
        return (s - duration - timedelta(seconds=1), s - timedelta(seconds=1))
    return (None, None)


@router.get("/dashboard")
def get_dashboard_stats(
    period: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Operational snapshot: order counts for selected period + clean profit + team today."""
    uid = get_store_id(user)
    now = datetime.now()

    if not period and not start:
        period = "today"

    s, e = parse_date_range(period, start, end)
    if s is None: s = datetime(2000, 1, 1)
    if e is None: e = now

    def count_orders(s0, e0):
        if s0 is None or e0 is None:
            return {"to_confirm": 0, "in_delivery": 0, "delivered": 0, "returned": 0}
        orders = db.query(models.Order).filter(
            models.Order.user_id == uid,
            models.Order.order_date >= s0,
            models.Order.order_date <= e0,
        ).all()
        return {
            "to_confirm": sum(1 for o in orders if o.status == "pending" and not o.tracking_id),
            "in_delivery": sum(1 for o in orders if o.status == "pending" and o.tracking_id),
            "delivered":   sum(1 for o in orders if o.status == "delivered"),
            "returned":    sum(1 for o in orders if o.status == "cancelled"),
        }

    current = count_orders(s, e)
    ps, pe = _prev_range(period, s, e, now)
    previous = count_orders(ps, pe)

    # Clean profit for selected period
    gross   = calculate_gross_profit(db, s, e, uid)
    team_c  = calculate_team_costs(db, s, e, uid)
    fixed_c = calculate_fixed_expenses(db, s, e, uid)
    ads_c   = calculate_facebook_ads(db, s, e, uid)
    clean_profit = round(gross - team_c - fixed_c - ads_c, 2)

    # Team performance: always today regardless of period
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    team_orders = db.query(models.Order).filter(
        models.Order.user_id == uid,
        models.Order.order_date >= today_start,
        models.Order.uploaded_by.isnot(None),
    ).all()

    uploaders: dict = {}
    for o in team_orders:
        k = o.uploaded_by
        if k not in uploaders:
            uploaders[k] = {"total": 0, "delivered": 0, "returned": 0}
        uploaders[k]["total"] += 1
        if o.status == "delivered":   uploaders[k]["delivered"] += 1
        elif o.status == "cancelled": uploaders[k]["returned"]  += 1

    team_today = []
    for uploader_id, st in uploaders.items():
        uploader = db.query(models.User).filter(models.User.id == uploader_id).first()
        name = uploader.username if uploader else f"User {uploader_id}"
        team_today.append({"name": name, **st})
    team_today.sort(key=lambda x: x["total"], reverse=True)

    return {
        "current":      current,
        "previous":     previous,
        "has_previous": ps is not None,
        "clean_profit": clean_profit,
        "team_today":   team_today,
    }


@router.get("/my-stats")
def get_my_stats(
    period: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Stats for the logged-in user's own uploaded orders (used by confirmer dashboard)."""
    s, e = parse_date_range(period, None, None)

    base_q = db.query(models.Order).filter(models.Order.uploaded_by == user.id)
    if s: base_q = base_q.filter(models.Order.order_date >= s)
    if e: base_q = base_q.filter(models.Order.order_date <= e)

    all_orders = base_q.all()
    total = len(all_orders)
    delivered = sum(1 for o in all_orders if o.status == "delivered")
    cancelled = sum(1 for o in all_orders if o.status == "cancelled")
    pending = sum(1 for o in all_orders if o.status == "pending")

    total_for_rate = delivered + cancelled + pending

    # Look up the team member linked to this confirmer for earnings
    earnings = 0.0
    if user.team_member_id:
        member = db.query(models.TeamMember).filter(models.TeamMember.id == user.team_member_id).first()
        if member and member.per_order_rate:
            earnings = member.per_order_rate * delivered

    return {
        "orders": {
            "total": total,
            "delivered": delivered,
            "cancelled": cancelled,
            "pending": pending,
            "delivery_rate": round(delivered / total_for_rate * 100, 1) if total_for_rate > 0 else 0,
            "return_rate": round(cancelled / total_for_rate * 100, 1) if total_for_rate > 0 else 0,
        },
        "earnings": round(earnings, 2),
    }
