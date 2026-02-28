"""All profit and capital calculation logic."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Optional
import models


USD_TO_MAD = 10


def calculate_order_profit(order: models.Order, db: Session) -> float:
    if order.status == "pending":
        return 0.0
    expenses = order.expenses
    if not expenses:
        return 0.0
    product_cost = sum(item.unit_cost * item.quantity for item in order.items)
    if order.status == "delivered":
        total_costs = product_cost + expenses.delivery_fee + expenses.sticker + expenses.seal_bag + expenses.packaging
        return order.total_amount - total_costs
    if order.status == "cancelled":
        return_costs = expenses.return_fee + expenses.sticker + expenses.packaging
        if expenses.seal_bag_returned:
            return_costs += expenses.seal_bag - 1
        else:
            return_costs += expenses.seal_bag
        if expenses.product_broken:
            return_costs += product_cost
        return -return_costs
    return 0.0


def get_delivered_orders(db: Session, start: Optional[datetime], end: Optional[datetime], user_id: int):
    query = db.query(models.Order).filter(models.Order.status == "delivered", models.Order.user_id == user_id)
    if start:
        query = query.filter(models.Order.order_date >= start)
    if end:
        query = query.filter(models.Order.order_date <= end)
    return query.all()


def count_delivered_orders(db: Session, start: Optional[datetime], end: Optional[datetime], user_id: int) -> int:
    query = db.query(func.count(models.Order.id)).filter(models.Order.status == "delivered", models.Order.user_id == user_id)
    if start:
        query = query.filter(models.Order.order_date >= start)
    if end:
        query = query.filter(models.Order.order_date <= end)
    return query.scalar() or 0


def calculate_months_in_range(range_start, range_end, member_start, member_end) -> float:
    now = datetime.now()
    effective_start = max(filter(None, [range_start, member_start, datetime(2000, 1, 1)]))
    effective_end = min(filter(None, [range_end, member_end, now]))
    if effective_end <= effective_start:
        return 0.0
    return (effective_end - effective_start).days / 30.0


def calculate_team_costs(db: Session, start: Optional[datetime], end: Optional[datetime], user_id: int) -> float:
    team_members = db.query(models.TeamMember).filter(models.TeamMember.is_active == True, models.TeamMember.user_id == user_id).all()
    delivered_count = count_delivered_orders(db, start, end, user_id)
    total = 0.0
    for member in team_members:
        if member.payment_type in ("monthly", "both") and member.fixed_monthly:
            months = calculate_months_in_range(start, end, member.start_date, member.end_date)
            total += member.fixed_monthly * months
        if member.payment_type in ("per_order", "both") and member.per_order_rate:
            total += member.per_order_rate * delivered_count
    return total


def calculate_fixed_expenses(db: Session, start: Optional[datetime], end: Optional[datetime], user_id: int) -> float:
    expenses = db.query(models.FixedExpense).filter(models.FixedExpense.is_active == True, models.FixedExpense.user_id == user_id).all()
    delivered_count = count_delivered_orders(db, start, end, user_id)
    total = 0.0
    for expense in expenses:
        if expense.type == "monthly":
            months = calculate_months_in_range(start, end, expense.start_date, None)
            total += expense.amount * months
        elif expense.type == "per_order":
            total += expense.amount * delivered_count
    return total


def calculate_facebook_ads(db: Session, start: Optional[datetime], end: Optional[datetime], user_id: int) -> float:
    now = datetime.now()
    range_start = start or datetime(2000, 1, 1)
    range_end = end or now
    periods = db.query(models.FacebookAd).filter(models.FacebookAd.user_id == user_id).all()
    total = 0.0
    for period in periods:
        p_start = period.start_date
        p_end = period.end_date or now
        effective_start = max(range_start, p_start)
        effective_end = min(range_end, p_end)
        if effective_end.date() < effective_start.date():
            continue
        days = (effective_end.date() - effective_start.date()).days + 1
        total += period.daily_rate_usd * days * USD_TO_MAD
    return total


def calculate_gross_profit(db: Session, start: Optional[datetime], end: Optional[datetime], user_id: int) -> float:
    orders = get_delivered_orders(db, start, end, user_id)
    cancelled_query = db.query(models.Order).filter(models.Order.status == "cancelled", models.Order.user_id == user_id)
    if start:
        cancelled_query = cancelled_query.filter(models.Order.order_date >= start)
    if end:
        cancelled_query = cancelled_query.filter(models.Order.order_date <= end)
    total = sum(calculate_order_profit(o, db) for o in orders)
    total += sum(calculate_order_profit(o, db) for o in cancelled_query.all())
    return total


def calculate_cash_balance(db: Session, user_id: int) -> float:
    base_setting = db.query(models.AppSettings).filter(models.AppSettings.key == "base_capital", models.AppSettings.user_id == user_id).first()
    base_amount = float(base_setting.value) if base_setting and base_setting.value else 0.0
    gross_profit = calculate_gross_profit(db, None, None, user_id)
    team_costs = calculate_team_costs(db, None, None, user_id)
    fixed_costs = calculate_fixed_expenses(db, None, None, user_id)
    ads_costs = calculate_facebook_ads(db, None, None, user_id)
    clean_profit = gross_profit - team_costs - fixed_costs - ads_costs
    withdrawals = db.query(func.sum(models.Withdrawal.amount)).filter(models.Withdrawal.user_id == user_id).scalar() or 0.0
    return base_amount + clean_profit - withdrawals


def calculate_stock_value(db: Session, user_id: int) -> float:
    total = 0.0
    products = db.query(models.Product).filter(models.Product.user_id == user_id).all()
    for p in products:
        for v in p.variants:
            total += v.stock * v.buying_price
    returnable_broken = (
        db.query(models.BrokenStock)
        .join(models.Variant, models.BrokenStock.variant_id == models.Variant.id)
        .join(models.Product, models.Variant.product_id == models.Product.id)
        .filter(models.BrokenStock.returnable_to_supplier == True, models.Product.user_id == user_id)
        .all()
    )
    for bs in returnable_broken:
        variant = db.query(models.Variant).filter(models.Variant.id == bs.variant_id).first()
        if variant:
            total += bs.quantity * variant.buying_price
    return total


def calculate_total_capital(db: Session, user_id: int) -> float:
    return calculate_cash_balance(db, user_id) + calculate_stock_value(db, user_id)
