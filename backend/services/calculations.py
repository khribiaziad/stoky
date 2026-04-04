"""Hassan — single source of truth for all profit calculation in Stocky."""
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

import models
from core.date_ranges import MOROCCO_TZ


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    """Current Morocco time as a naive datetime (compatible with naive DB columns)."""
    return datetime.now(MOROCCO_TZ).replace(tzinfo=None)


def _get_usd_rate(db: Session, user_id: int) -> float:
    """Read usd_rate from AppSettings. Never hardcode."""
    setting = (
        db.query(models.AppSettings)
        .filter(
            models.AppSettings.key == "usd_rate",
            models.AppSettings.user_id == user_id,
        )
        .first()
    )
    if setting and setting.value:
        try:
            return float(setting.value)
        except (ValueError, TypeError):
            pass
    return 10.0  # safe fallback if not configured


def _count_delivered(
    db: Session,
    start: Optional[datetime],
    end: Optional[datetime],
    user_id: int,
) -> int:
    q = (
        db.query(func.count(models.Order.id))
        .filter(
            models.Order.status == "delivered",
            models.Order.user_id == user_id,
        )
    )
    if start:
        q = q.filter(models.Order.order_date >= start)
    if end:
        q = q.filter(models.Order.order_date <= end)
    return q.scalar() or 0


def _months_in_range(
    range_start: Optional[datetime],
    range_end: Optional[datetime],
    member_start: Optional[datetime],
    member_end: Optional[datetime],
) -> float:
    """Pro-rate monthly salary by actual period length (days / 30)."""
    now = _now()
    starts = [x for x in [range_start, member_start, datetime(2000, 1, 1)] if x is not None]
    ends = [x for x in [range_end, member_end, now] if x is not None]
    effective_start = max(starts)
    effective_end = min(ends)
    if effective_end <= effective_start:
        return 0.0
    return (effective_end - effective_start).days / 30.0


# ---------------------------------------------------------------------------
# 10 public functions — Hassan's contract
# ---------------------------------------------------------------------------

def calculate_order_profit(order: models.Order) -> float:
    """Per-order P&L. Handles all statuses. Null-safe on buying_price / unit_cost."""
    status = order.status

    # In-progress statuses — no realized P&L yet
    if status in ("pending", "in_delivery", "reported", "no_answer"):
        return 0.0

    expenses = order.expenses
    product_cost = sum((item.unit_cost or 0.0) * item.quantity for item in order.items)

    if status == "delivered":
        if not expenses:
            return (order.total_amount or 0.0) - product_cost
        total_costs = (
            product_cost
            + (expenses.delivery_fee or 0.0)
            + (expenses.sticker or 0.0)
            + (expenses.seal_bag or 0.0)
            + (expenses.packaging or 0.0)
        )
        return (order.total_amount or 0.0) - total_costs

    if status in ("cancelled", "returned"):
        if not expenses:
            return -product_cost
        return_costs = (
            (expenses.return_fee or 0.0)
            + (expenses.sticker or 0.0)
            + (expenses.packaging or 0.0)
        )
        if expenses.seal_bag_returned:
            return_costs += (expenses.seal_bag or 0.0) - 1
        else:
            return_costs += (expenses.seal_bag or 0.0)
        if expenses.product_broken:
            return_costs += product_cost
        return -return_costs

    if status == "lost":
        if not expenses:
            return -product_cost
        return -(product_cost + (expenses.delivery_fee or 0.0))

    return 0.0


def calculate_gross_profit(
    db: Session,
    start: Optional[datetime],
    end: Optional[datetime],
    user_id: int,
) -> float:
    """Revenue minus COGS for all financially impactful orders. Date filter in SQL."""
    profit_statuses = ("delivered", "cancelled", "returned", "lost")
    q = (
        db.query(models.Order)
        .options(
            joinedload(models.Order.items),
            joinedload(models.Order.expenses),
        )
        .filter(
            models.Order.user_id == user_id,
            models.Order.status.in_(profit_statuses),
        )
    )
    if start:
        q = q.filter(models.Order.order_date >= start)
    if end:
        q = q.filter(models.Order.order_date <= end)
    return sum(calculate_order_profit(o) for o in q.all())


def calculate_team_costs(
    db: Session,
    start: Optional[datetime],
    end: Optional[datetime],
    user_id: int,
) -> float:
    """Salary costs pro-rated by actual period length. Handles monthly and per-order."""
    members = (
        db.query(models.TeamMember)
        .filter(
            models.TeamMember.user_id == user_id,
            models.TeamMember.is_active == True,
        )
        .all()
    )
    delivered_count = _count_delivered(db, start, end, user_id)
    total = 0.0
    for m in members:
        if getattr(m, 'is_suspended', False):
            continue
        if m.payment_type in ("monthly", "both") and m.fixed_monthly:
            months = _months_in_range(start, end, m.start_date, m.end_date)
            total += m.fixed_monthly * months
        if m.payment_type in ("per_order", "both") and m.per_order_rate:
            total += m.per_order_rate * delivered_count
    return total


def calculate_fixed_expenses(
    db: Session,
    start: Optional[datetime],
    end: Optional[datetime],
    user_id: int,
) -> float:
    """Fixed expenses: monthly, annual, per_order, and one_time all included."""
    expenses = (
        db.query(models.FixedExpense)
        .filter(
            models.FixedExpense.user_id == user_id,
            models.FixedExpense.is_active == True,
        )
        .all()
    )
    delivered_count = _count_delivered(db, start, end, user_id)
    now = _now()
    range_start = start or datetime(2000, 1, 1)
    range_end = end or now
    total = 0.0
    for exp in expenses:
        if exp.type == "monthly":
            months = _months_in_range(start, end, exp.start_date, None)
            total += exp.amount * months

        elif exp.type == "per_order":
            total += exp.amount * delivered_count

        elif exp.type == "annual":
            exp_start = exp.start_date or datetime(2000, 1, 1)
            eff_start = max(range_start, exp_start)
            eff_end = min(range_end, now)
            if eff_end > eff_start:
                days = (eff_end - eff_start).days
                total += exp.amount * (days / 365.0)

        elif exp.type == "one_time":
            if start is None and end is None:
                # All-time query: include every one_time expense
                total += exp.amount
            elif exp.start_date:
                if (start is None or exp.start_date >= start) and (
                    end is None or exp.start_date <= end
                ):
                    total += exp.amount

    return total


def _calculate_manual_ad_spend(
    db: Session,
    start: Optional[datetime],
    end: Optional[datetime],
    user_id: int,
) -> float:
    """Fallback: sum manual FacebookAd daily_rate entries for stores without a live API connection."""
    usd_rate = _get_usd_rate(db, user_id)
    now = _now()
    range_start = start or datetime(2000, 1, 1)
    range_end = end or now
    periods = (
        db.query(models.FacebookAd)
        .filter(models.FacebookAd.user_id == user_id)
        .all()
    )
    total = 0.0
    for p in periods:
        p_end = p.end_date or now
        effective_start = max(range_start, p.start_date)
        effective_end = min(range_end, p_end)
        if effective_end.date() < effective_start.date():
            continue
        days = (effective_end.date() - effective_start.date()).days + 1
        total += p.daily_rate_usd * days * usd_rate
    return total


def calculate_ads_costs(
    db: Session,
    start: Optional[datetime],
    end: Optional[datetime],
    user_id: int,
) -> float:
    """Hamza feeds Hassan the real spend numbers from every connected platform.
    Falls back to manual daily_rate entries only if no platform returns spend.
    """
    from integrations.platforms.meta.integration import MetaIntegration
    from integrations.platforms.tiktok.integration import TikTokIntegration
    from integrations.platforms.snapchat.integration import SnapchatIntegration
    from integrations.platforms.pinterest.integration import PinterestIntegration
    from integrations.platforms.google.integration import GoogleIntegration

    start_str = start.strftime("%Y-%m-%d") if start else "2000-01-01"
    end_str   = end.strftime("%Y-%m-%d")   if end   else _now().strftime("%Y-%m-%d")

    platforms = [
        MetaIntegration(),
        TikTokIntegration(),
        SnapchatIntegration(),
        PinterestIntegration(),
        GoogleIntegration(),
    ]

    total = sum(p.get_spend_safe(db, user_id, start_str, end_str) for p in platforms)

    # Fall back to manual entries only if no platform is connected / returned data
    if total == 0:
        total = _calculate_manual_ad_spend(db, start, end, user_id)

    return total


# Backward-compatible alias — dashboard endpoint imports this name
calculate_facebook_ads = calculate_ads_costs


def calculate_cash_balance(db: Session, user_id: int) -> float:
    """Net cash: base capital + all-time clean profit − manual withdrawals only."""
    base_setting = (
        db.query(models.AppSettings)
        .filter(
            models.AppSettings.key == "base_capital",
            models.AppSettings.user_id == user_id,
        )
        .first()
    )
    base_amount = float(base_setting.value) if base_setting and base_setting.value else 0.0

    gross = calculate_gross_profit(db, None, None, user_id)
    team = calculate_team_costs(db, None, None, user_id)
    fixed = calculate_fixed_expenses(db, None, None, user_id)
    ads = calculate_ads_costs(db, None, None, user_id)
    clean = gross - team - fixed - ads

    # Only subtract manual withdrawals — stock purchases are reflected in stock value
    manual_withdrawals = (
        db.query(func.sum(models.Withdrawal.amount))
        .filter(
            models.Withdrawal.user_id == user_id,
            models.Withdrawal.type == "manual",
        )
        .scalar() or 0.0
    )
    supplier_payments = (
        db.query(func.sum(models.SupplierPayment.amount))
        .join(models.Supplier, models.Supplier.id == models.SupplierPayment.supplier_id)
        .filter(models.Supplier.user_id == user_id)
        .scalar() or 0.0
    )
    return base_amount + clean - manual_withdrawals - supplier_payments


def calculate_stock_value(db: Session, user_id: int) -> float:
    """Current stock value + returnable broken stock. Null-safe on buying_price."""
    products = (
        db.query(models.Product)
        .options(joinedload(models.Product.variants))
        .filter(models.Product.user_id == user_id)
        .all()
    )
    total = 0.0
    for p in products:
        for v in p.variants:
            total += v.stock * (v.buying_price or 0.0)

    broken_stocks = (
        db.query(models.BrokenStock)
        .options(joinedload(models.BrokenStock.variant))
        .join(models.Variant, models.BrokenStock.variant_id == models.Variant.id)
        .join(models.Product, models.Variant.product_id == models.Product.id)
        .filter(
            models.BrokenStock.returnable_to_supplier == True,
            models.Product.user_id == user_id,
        )
        .all()
    )
    for bs in broken_stocks:
        if bs.variant:
            total += bs.quantity * (bs.variant.buying_price or 0.0)
    return total


def calculate_total_capital(db: Session, user_id: int) -> float:
    """Total capital = cash balance + stock value. calculate_cash_balance called once."""
    cb = calculate_cash_balance(db, user_id)
    sv = calculate_stock_value(db, user_id)
    return cb + sv


def count_delivered_orders(
    db: Session,
    start: Optional[datetime],
    end: Optional[datetime],
    user_id: int,
) -> int:
    """Count of delivered orders in period."""
    return _count_delivered(db, start, end, user_id)


def get_summary(
    db: Session,
    start: Optional[datetime],
    end: Optional[datetime],
    user_id: int,
) -> dict:
    """Full financial + order summary for a period. Single entry point for /summary."""
    gross_profit = calculate_gross_profit(db, start, end, user_id)
    team_costs = calculate_team_costs(db, start, end, user_id)
    fixed_costs = calculate_fixed_expenses(db, start, end, user_id)
    ads_costs = calculate_ads_costs(db, start, end, user_id)
    clean_profit = gross_profit - team_costs - fixed_costs - ads_costs

    # Capital — calculate_cash_balance called exactly once
    cb = calculate_cash_balance(db, user_id)
    sv = calculate_stock_value(db, user_id)
    total_capital = cb + sv

    # Order counts — all filters pushed into SQL
    def _count(status: str) -> int:
        q = (
            db.query(func.count(models.Order.id))
            .filter(
                models.Order.status == status,
                models.Order.user_id == user_id,
            )
        )
        if start:
            q = q.filter(models.Order.order_date >= start)
        if end:
            q = q.filter(models.Order.order_date <= end)
        return q.scalar() or 0

    total_q = db.query(func.count(models.Order.id)).filter(
        models.Order.user_id == user_id
    )
    if start:
        total_q = total_q.filter(models.Order.order_date >= start)
    if end:
        total_q = total_q.filter(models.Order.order_date <= end)
    total_orders = total_q.scalar() or 0

    delivered = _count("delivered")
    cancelled = _count("cancelled")
    pending = _count("pending")

    rev_q = db.query(func.sum(models.Order.total_amount)).filter(
        models.Order.status == "delivered",
        models.Order.user_id == user_id,
    )
    if start:
        rev_q = rev_q.filter(models.Order.order_date >= start)
    if end:
        rev_q = rev_q.filter(models.Order.order_date <= end)
    revenue = rev_q.scalar() or 0.0

    total_for_rate = delivered + cancelled + pending

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
            "cash_balance": round(cb, 2),
            "stock_value": round(sv, 2),
            "total_capital": round(total_capital, 2),
        },
        "orders": {
            "total": total_orders,
            "delivered": delivered,
            "cancelled": cancelled,
            "pending": pending,
            "delivery_rate": round(delivered / total_for_rate * 100, 1) if total_for_rate > 0 else 0,
            "return_rate": round(cancelled / total_for_rate * 100, 1) if total_for_rate > 0 else 0,
            "avg_order_value": round(revenue / delivered, 1) if delivered > 0 else 0,
        },
    }
