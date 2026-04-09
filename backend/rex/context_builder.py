"""
Rex — Intelligence Layer
context_builder.py builds a complete snapshot of everything happening in a store.
Rex reads this before answering any question or generating any insight.
Rex never queries the DB directly — he reads what the team already produced.
"""

import json
import os
from datetime import datetime, timedelta
from collections import defaultdict

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from core.date_ranges import MOROCCO_TZ
from services.calculations import get_summary
from services.stock_service import check_low_stock
import models

CONTEXTS_DIR = os.path.join(os.path.dirname(__file__), "store_contexts")


def _now():
    return datetime.now(MOROCCO_TZ).replace(tzinfo=None)


def build_store_context(db: Session, store_id: int, store_name: str) -> dict:
    """Build a complete store snapshot for Rex.
    Called on every Rex request — always fresh, never cached.
    Returns a dict and saves it to store_contexts/{store_id}.json.
    """
    now = _now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_start  = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)

    # ── Financials ────────────────────────────────────────────────────────────
    today = get_summary(db, today_start, now, store_id)
    month = get_summary(db, month_start, now, store_id)
    week  = get_summary(db, week_start,  now, store_id)

    # ── Orders: full breakdown ────────────────────────────────────────────────
    all_orders = (
        db.query(models.Order)
        .options(joinedload(models.Order.items), joinedload(models.Order.expenses))
        .filter(
            models.Order.user_id == store_id,
            models.Order.is_deleted == False,
        )
        .order_by(models.Order.order_date.desc())
        .all()
    )

    # Status counts (all time)
    status_counts = defaultdict(int)
    for o in all_orders:
        status_counts[o.status] += 1

    # City performance (this month)
    city_stats = defaultdict(lambda: {"delivered": 0, "cancelled": 0, "total": 0})
    for o in all_orders:
        if o.order_date and o.order_date >= month_start:
            city = (o.city or "Unknown").strip().title()
            city_stats[city]["total"] += 1
            if o.status == "delivered":
                city_stats[city]["delivered"] += 1
            elif o.status in ("cancelled", "returned"):
                city_stats[city]["cancelled"] += 1

    top_cities = []
    for city, s in sorted(city_stats.items(), key=lambda x: x[1]["total"], reverse=True)[:8]:
        rate = round(s["delivered"] / s["total"] * 100, 1) if s["total"] > 0 else 0
        top_cities.append({"city": city, "total": s["total"], "delivered": s["delivered"], "delivery_rate": rate})

    # Courier performance (this month)
    courier_stats = defaultdict(lambda: {"delivered": 0, "cancelled": 0, "total": 0})
    for o in all_orders:
        if o.order_date and o.order_date >= month_start and o.delivery_provider:
            c = o.delivery_provider
            courier_stats[c]["total"] += 1
            if o.status == "delivered":
                courier_stats[c]["delivered"] += 1
            elif o.status in ("cancelled", "returned"):
                courier_stats[c]["cancelled"] += 1

    courier_breakdown = []
    for courier, s in courier_stats.items():
        rate = round(s["delivered"] / s["total"] * 100, 1) if s["total"] > 0 else 0
        courier_breakdown.append({"courier": courier, "total": s["total"], "delivery_rate": rate})

    # Recent 20 orders (for context on what's happening now)
    recent_orders = []
    for o in all_orders[:20]:
        recent_orders.append({
            "id": o.id,
            "caleo_id": o.caleo_id,
            "status": o.status,
            "city": o.city,
            "amount": o.total_amount,
            "date": o.order_date.strftime("%Y-%m-%d") if o.order_date else None,
            "courier": o.delivery_provider,
        })

    # ── Stock ─────────────────────────────────────────────────────────────────
    low_stock_variants = check_low_stock(db, store_id)
    low_stock_items = [
        {
            "product": v.product.name if v.product else "Unknown",
            "variant": v.name if hasattr(v, 'name') else f"{v.size or ''} {v.color or ''}".strip(),
            "stock": v.stock,
            "threshold": v.low_stock_threshold,
        }
        for v in low_stock_variants
    ]

    out_of_stock = [item for item in low_stock_items if item["stock"] == 0]

    # Top selling products (this month, by units delivered)
    product_sales = defaultdict(lambda: {"units": 0, "revenue": 0.0, "returns": 0})
    for o in all_orders:
        if o.order_date and o.order_date >= month_start:
            for item in o.items:
                name = item.product_name or "Unknown"
                if o.status == "delivered":
                    product_sales[name]["units"] += item.quantity
                    product_sales[name]["revenue"] += (item.unit_price or 0) * item.quantity
                elif o.status in ("cancelled", "returned"):
                    product_sales[name]["returns"] += item.quantity

    top_products = sorted(product_sales.items(), key=lambda x: x[1]["units"], reverse=True)[:5]
    top_products_list = [{"product": k, **v} for k, v in top_products]

    # Products with high return rates
    high_return_products = []
    for name, s in product_sales.items():
        total = s["units"] + s["returns"]
        if total >= 5:
            return_rate = round(s["returns"] / total * 100, 1)
            if return_rate > 30:
                high_return_products.append({"product": name, "return_rate": return_rate, "total": total})
    high_return_products.sort(key=lambda x: x["return_rate"], reverse=True)

    # ── Leads ─────────────────────────────────────────────────────────────────
    leads = db.query(models.Lead).filter(models.Lead.store_id == store_id).all()
    pending_leads = [l for l in leads if l.status == "pending"]
    confirmed_leads = [l for l in leads if l.status == "confirmed"]
    lead_conversion_rate = round(len(confirmed_leads) / len(leads) * 100, 1) if leads else 0

    # ── Team ──────────────────────────────────────────────────────────────────
    team_members = (
        db.query(models.TeamMember)
        .filter(models.TeamMember.user_id == store_id, models.TeamMember.is_active == True)
        .all()
    )

    team_today = []
    for m in team_members:
        confirmed_today = db.query(func.count(models.Order.id)).filter(
            models.Order.confirmed_by == m.id,
            models.Order.order_date >= today_start,
        ).scalar() or 0
        team_today.append({
            "name": m.name,
            "role": m.role,
            "confirmed_today": confirmed_today,
        })

    # ── Suppliers ─────────────────────────────────────────────────────────────
    suppliers = (
        db.query(models.Supplier)
        .filter(models.Supplier.user_id == store_id)
        .all()
    )
    supplier_summary = []
    for s in suppliers:
        total_paid = db.query(func.sum(models.SupplierPayment.amount)).filter(
            models.SupplierPayment.supplier_id == s.id
        ).scalar() or 0.0
        supplier_summary.append({
            "name": s.name,
            "total_paid": round(total_paid, 2),
        })

    # ── Alerts ────────────────────────────────────────────────────────────────
    alerts = []
    if month["capital"]["cash_balance"] < 0:
        alerts.append("Cash balance is negative — check withdrawals and stock purchases")
    if month["financials"]["clean_profit"] < 0:
        alerts.append(f"Clean profit is negative this month ({month['financials']['clean_profit']} MAD)")
    if low_stock_items:
        alerts.append(f"{len(low_stock_items)} product variant(s) running low on stock")
    if out_of_stock:
        alerts.append(f"{len(out_of_stock)} product variant(s) are completely out of stock")
    if pending_leads:
        alerts.append(f"{len(pending_leads)} lead(s) waiting to be confirmed")
    if month["orders"]["return_rate"] > 25:
        alerts.append(f"Return rate is high: {month['orders']['return_rate']}% this month")
    if high_return_products:
        alerts.append(f"{high_return_products[0]['product']} has a {high_return_products[0]['return_rate']}% return rate")

    # ── Build final context ───────────────────────────────────────────────────
    context = {
        "store": store_name,
        "store_id": store_id,
        "generated_at": now.isoformat(),

        "today": {
            "revenue": today["financials"]["revenue"],
            "clean_profit": today["financials"]["clean_profit"],
            "orders_total": today["orders"]["total"],
            "orders_delivered": today["orders"]["delivered"],
            "orders_pending": today["orders"]["pending"],
            "orders_cancelled": today["orders"]["cancelled"],
            "delivery_rate": today["orders"]["delivery_rate"],
        },

        "this_week": {
            "revenue": week["financials"]["revenue"],
            "clean_profit": week["financials"]["clean_profit"],
            "orders_total": week["orders"]["total"],
            "delivered": week["orders"]["delivered"],
            "delivery_rate": week["orders"]["delivery_rate"],
            "return_rate": week["orders"]["return_rate"],
        },

        "this_month": {
            "revenue": month["financials"]["revenue"],
            "gross_profit": month["financials"]["gross_profit"],
            "clean_profit": month["financials"]["clean_profit"],
            "team_costs": month["financials"]["team_costs"],
            "ads_costs": month["financials"]["ads_costs"],
            "fixed_costs": month["financials"]["fixed_costs"],
            "orders_total": month["orders"]["total"],
            "delivered": month["orders"]["delivered"],
            "cancelled": month["orders"]["cancelled"],
            "delivery_rate": month["orders"]["delivery_rate"],
            "return_rate": month["orders"]["return_rate"],
            "avg_order_value": month["orders"]["avg_order_value"],
        },

        "capital": {
            "cash_balance": month["capital"]["cash_balance"],
            "stock_value": month["capital"]["stock_value"],
            "total_capital": month["capital"]["total_capital"],
        },

        "orders": {
            "all_time_status_counts": dict(status_counts),
            "recent_20": recent_orders,
            "top_cities_this_month": top_cities,
            "courier_performance_this_month": courier_breakdown,
        },

        "stock": {
            "low_stock_items": low_stock_items,
            "out_of_stock_count": len(out_of_stock),
            "top_selling_products_this_month": top_products_list,
            "high_return_rate_products": high_return_products[:5],
        },

        "leads": {
            "total": len(leads),
            "pending": len(pending_leads),
            "confirmed": len(confirmed_leads),
            "conversion_rate": lead_conversion_rate,
        },

        "team": {
            "total_members": len(team_members),
            "activity_today": team_today,
        },

        "suppliers": supplier_summary,

        "alerts": alerts,
    }

    # Save to file
    os.makedirs(CONTEXTS_DIR, exist_ok=True)
    path = os.path.join(CONTEXTS_DIR, f"{store_id}.json")
    with open(path, "w") as f:
        json.dump(context, f, indent=2, default=str)

    return context


def load_store_context(store_id: int) -> dict | None:
    """Load the last saved context for a store."""
    path = os.path.join(CONTEXTS_DIR, f"{store_id}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)
