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
            "to_confirm":      sum(1 for o in orders if o.status == "pending" and not o.tracking_id),
            "awaiting_pickup": sum(1 for o in orders if o.status == "pending" and o.tracking_id and (not o.delivery_status or o.delivery_status == "Envoyé")),
            "in_delivery":     sum(1 for o in orders if o.status == "pending" and o.tracking_id and o.delivery_status and o.delivery_status != "Envoyé"),
            "delivered":       sum(1 for o in orders if o.status == "delivered"),
            "returned":        sum(1 for o in orders if o.status == "cancelled"),
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

    # Money with couriers: current snapshot — all orders at delivery companies regardless of period
    in_transit_orders = db.query(models.Order).filter(
        models.Order.user_id == uid,
        models.Order.status == "pending",
        models.Order.tracking_id.isnot(None),
    ).all()
    in_delivery_amount = round(sum(o.total_amount or 0 for o in in_transit_orders), 2)
    oliv_amount  = 0
    force_amount = 0

    # Daily orders — last 7 days (always, for the trend line)
    daily_orders = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        d_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        d_end   = day.replace(hour=23, minute=59, second=59)
        count = db.query(func.count(models.Order.id)).filter(
            models.Order.user_id == uid,
            models.Order.order_date >= d_start,
            models.Order.order_date <= d_end,
        ).scalar() or 0
        daily_orders.append({"day": day.strftime("%a"), "orders": count})

    return {
        "current":      current,
        "previous":     previous,
        "has_previous": ps is not None,
        "clean_profit": clean_profit,
        "team_today":   team_today,
        "daily_orders":      daily_orders,
        "in_delivery_amount": in_delivery_amount,
        "oliv_amount":        oliv_amount,
        "force_amount":       force_amount,
    }


@router.get("/attention")
def get_attention(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Quick-action counts for the dashboard attention strip."""
    uid = get_store_id(user)
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end   = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    new_leads = db.query(func.count(models.Lead.id)).filter(
        models.Lead.store_id == uid,
        models.Lead.status == "pending",
    ).scalar() or 0

    pending_orders = db.query(func.count(models.Order.id)).filter(
        models.Order.user_id == uid,
        models.Order.status == "pending",
        models.Order.tracking_id.is_(None),
    ).scalar() or 0

    reported_due_today = 0

    low_stock_variants = db.query(models.Variant).join(
        models.Product, models.Variant.product_id == models.Product.id
    ).filter(
        models.Product.user_id == uid,
        models.Variant.low_stock_threshold > 0,
        models.Variant.stock <= models.Variant.low_stock_threshold,
    ).count()

    return {
        "newLeads":          new_leads,
        "pendingOrders":     pending_orders,
        "reportedDueToday":  reported_due_today,
        "lowStockItems":     low_stock_variants,
    }


@router.get("/week-summary")
def get_week_summary(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """This-week vs last-week comparison for revenue, orders, leads converted."""
    uid = get_store_id(user)
    now = datetime.now()

    # This week: Monday 00:00 → now
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end   = now

    # Last week: previous Monday → previous Sunday
    last_week_start = week_start - timedelta(days=7)
    last_week_end   = week_start - timedelta(seconds=1)

    def revenue_in(s, e):
        r = db.query(func.sum(models.Order.total_amount)).filter(
            models.Order.user_id == uid,
            models.Order.status == "delivered",
            models.Order.order_date >= s,
            models.Order.order_date <= e,
        ).scalar()
        return round(r or 0.0, 2)

    def orders_confirmed_in(s, e):
        return db.query(func.count(models.Order.id)).filter(
            models.Order.user_id == uid,
            models.Order.status.in_(["delivered", "awaiting_pickup", "in_delivery"]),
            models.Order.order_date >= s,
            models.Order.order_date <= e,
        ).scalar() or 0

    def leads_converted_in(s, e):
        return db.query(func.count(models.Lead.id)).filter(
            models.Lead.store_id == uid,
            models.Lead.status == "confirmed",
            models.Lead.order_id.isnot(None),
        ).join(models.Order, models.Lead.order_id == models.Order.id).filter(
            models.Order.order_date >= s,
            models.Order.order_date <= e,
        ).scalar() or 0

    def pct_delta(now_val, prev_val):
        if prev_val == 0:
            return None
        return round((now_val - prev_val) / prev_val * 100)

    rev_now  = revenue_in(week_start, week_end)
    rev_prev = revenue_in(last_week_start, last_week_end)

    ord_now  = orders_confirmed_in(week_start, week_end)
    ord_prev = orders_confirmed_in(last_week_start, last_week_end)

    lead_now  = leads_converted_in(week_start, week_end)
    lead_prev = leads_converted_in(last_week_start, last_week_end)

    return {
        "revenue":         rev_now,
        "revenueDelta":    pct_delta(rev_now, rev_prev),
        "ordersConfirmed": ord_now,
        "ordersDelta":     pct_delta(ord_now, ord_prev),
        "leadsConverted":  lead_now,
        "leadsDelta":      pct_delta(lead_now, lead_prev),
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
