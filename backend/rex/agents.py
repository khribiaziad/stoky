"""
Stocky Team Agents
Each team member is a specialized AI agent that Rex can consult.
Rex calls them via tool_use — they fetch their own domain data, analyze it, and report back.
Agents never write to the DB. They only read and analyze.
"""

import json
import os
from datetime import datetime, timedelta
from collections import defaultdict

import anthropic
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from core.date_ranges import MOROCCO_TZ
from services.calculations import get_summary
from services.stock_service import check_low_stock
from rex.usage import log_usage
import models


def _now():
    return datetime.now(MOROCCO_TZ).replace(tzinfo=None)


_CLIENT = None
def _client():
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _CLIENT


# ── HASSAN — Chief Accountant ──────────────────────────────────────────────────

def _hassan_context(db: Session, store_id: int) -> dict:
    now = _now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_start  = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)

    # Previous month
    prev_month_end   = month_start
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    today      = get_summary(db, today_start,      now,            store_id)
    week       = get_summary(db, week_start,        now,            store_id)
    month      = get_summary(db, month_start,       now,            store_id)
    prev_month = get_summary(db, prev_month_start,  prev_month_end, store_id)

    def _delta(current, prev):
        if prev == 0:
            return None
        return round((current - prev) / prev * 100, 1)

    return {
        "today":      {"financials": today["financials"], "orders": today["orders"]},
        "this_week":  {"financials": week["financials"],  "orders": week["orders"]},
        "this_month": {"financials": month["financials"], "orders": month["orders"]},
        "prev_month": {"financials": prev_month["financials"], "orders": prev_month["orders"]},
        "capital":    month["capital"],
        "trends": {
            "revenue_delta_pct":      _delta(month["financials"]["revenue"],      prev_month["financials"]["revenue"]),
            "clean_profit_delta_pct": _delta(month["financials"]["clean_profit"], prev_month["financials"]["clean_profit"]),
            "orders_delta_pct":       _delta(month["orders"]["total"],            prev_month["orders"]["total"]),
        },
    }


_HASSAN_PROMPT = """You are Hassan, Chief Accountant at Stocky — a Moroccan COD dropshipping platform.

Rex (the business intelligence layer) is asking you a financial question about a store.

Your job:
- Analyze the financial data you receive
- Give Rex a clear, specific financial picture
- Flag anything concerning: negative profit, negative cash balance, high costs, low margins
- Note what's performing well
- All amounts are in MAD
- Be concise — bullet points preferred, max 150 words
- You are reporting to Rex, not the owner directly
"""


def analyze_hassan(question: str, db: Session, store_id: int) -> str:
    ctx = _hassan_context(db, store_id)
    resp = _client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=_HASSAN_PROMPT,
        messages=[{"role": "user", "content": f"Financial data:\n{json.dumps(ctx, indent=2, default=str)}\n\nQuestion: {question}"}],
    )
    log_usage(db, store_id, "claude-haiku-4-5-20251001", resp.usage.input_tokens, resp.usage.output_tokens)
    return resp.content[0].text


# ── KARIMA — Order Manager ─────────────────────────────────────────────────────

def _karima_context(db: Session, store_id: int) -> dict:
    now = _now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    orders = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.user_id == store_id, models.Order.is_deleted == False)
        .order_by(models.Order.order_date.desc())
        .all()
    )

    status_counts = defaultdict(int)
    for o in orders:
        status_counts[o.status] += 1

    today_count = sum(1 for o in orders if o.order_date and o.order_date >= today_start)

    recent = [
        {
            "id": o.id,
            "status": o.status,
            "city": o.city,
            "amount": o.total_amount,
            "date": o.order_date.strftime("%Y-%m-%d") if o.order_date else None,
        }
        for o in orders[:15]
    ]

    low_stock_variants = check_low_stock(db, store_id)
    low_stock_items = [
        {
            "product": v.product.name if v.product else "Unknown",
            "variant": f"{v.size or ''} {v.color or ''}".strip(),
            "stock": v.stock,
            "threshold": v.low_stock_threshold,
        }
        for v in low_stock_variants
    ]

    leads = db.query(models.Lead).filter(models.Lead.store_id == store_id).all()
    pending_leads = [l for l in leads if l.status == "pending"]

    return {
        "status_counts_all_time": dict(status_counts),
        "orders_today": today_count,
        "recent_15_orders": recent,
        "low_stock_items": low_stock_items,
        "out_of_stock_count": sum(1 for x in low_stock_items if x["stock"] == 0),
        "pending_leads": len(pending_leads),
        "total_leads": len(leads),
    }


_KARIMA_PROMPT = """You are Karima, Order Manager at Stocky — a Moroccan COD dropshipping platform.

Rex (the business intelligence layer) is asking you about orders, stock, or leads.

Your job:
- Analyze the operational data you receive
- Give Rex a clear picture of: order flow, stock health, leads pipeline
- Flag stuck orders, high cancellation counts, out-of-stock items, pending leads
- Be specific with counts and names
- Be concise — bullet points preferred, max 150 words
- You are reporting to Rex, not the owner directly
"""


def analyze_karima(question: str, db: Session, store_id: int) -> str:
    ctx = _karima_context(db, store_id)
    resp = _client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=_KARIMA_PROMPT,
        messages=[{"role": "user", "content": f"Operations data:\n{json.dumps(ctx, indent=2, default=str)}\n\nQuestion: {question}"}],
    )
    log_usage(db, store_id, "claude-haiku-4-5-20251001", resp.usage.input_tokens, resp.usage.output_tokens)
    return resp.content[0].text


# ── HAMZA — Ads Manager ────────────────────────────────────────────────────────

def _hamza_context(db: Session, store_id: int) -> dict:
    now = _now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    month = get_summary(db, month_start, now, store_id)

    # Per-platform spend
    from integrations.platforms.meta.integration      import MetaIntegration
    from integrations.platforms.tiktok.integration    import TikTokIntegration
    from integrations.platforms.snapchat.integration  import SnapchatIntegration
    from integrations.platforms.pinterest.integration import PinterestIntegration
    from integrations.platforms.google.integration    import GoogleIntegration

    start_str = month_start.strftime("%Y-%m-%d")
    end_str   = now.strftime("%Y-%m-%d")

    platform_spend = {}
    for name, cls in [
        ("meta",      MetaIntegration),
        ("tiktok",    TikTokIntegration),
        ("snapchat",  SnapchatIntegration),
        ("pinterest", PinterestIntegration),
        ("google",    GoogleIntegration),
    ]:
        spend = cls().get_spend_safe(db, store_id, start_str, end_str)
        if spend > 0:
            platform_spend[name] = round(spend, 2)

    revenue = month["financials"]["revenue"]
    total_ads = month["financials"]["ads_costs"]
    roas = round(revenue / total_ads, 2) if total_ads > 0 else None

    return {
        "total_ads_spend_this_month": total_ads,
        "spend_by_platform": platform_spend,
        "revenue_this_month": revenue,
        "roas": roas,
        "ads_as_pct_of_revenue": round(total_ads / revenue * 100, 1) if revenue > 0 else None,
    }


_HAMZA_PROMPT = """You are Hamza, Ads Manager at Stocky — a Moroccan COD dropshipping platform.

Rex (the business intelligence layer) is asking you about advertising performance.

Your job:
- Analyze the ad spend data you receive
- Calculate ROAS (revenue / ad spend) efficiency
- Flag if ad spend is eating >30% of revenue (concerning)
- Note which platforms are active and their relative spend
- If no ad data is available, say so clearly
- Be concise — bullet points preferred, max 150 words
- You are reporting to Rex, not the owner directly
"""


def analyze_hamza(question: str, db: Session, store_id: int) -> str:
    ctx = _hamza_context(db, store_id)
    resp = _client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=_HAMZA_PROMPT,
        messages=[{"role": "user", "content": f"Ads data:\n{json.dumps(ctx, indent=2, default=str)}\n\nQuestion: {question}"}],
    )
    log_usage(db, store_id, "claude-haiku-4-5-20251001", resp.usage.input_tokens, resp.usage.output_tokens)
    return resp.content[0].text


# ── YOUSSEF — Delivery Coordinator ────────────────────────────────────────────

def _youssef_context(db: Session, store_id: int) -> dict:
    now = _now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    orders = (
        db.query(models.Order)
        .filter(models.Order.user_id == store_id, models.Order.is_deleted == False)
        .all()
    )

    courier_stats = defaultdict(lambda: {"delivered": 0, "cancelled": 0, "returned": 0, "in_transit": 0, "total": 0})
    for o in orders:
        if o.order_date and o.order_date >= month_start and o.delivery_provider:
            c = o.delivery_provider
            courier_stats[c]["total"] += 1
            if o.status == "delivered":
                courier_stats[c]["delivered"] += 1
            elif o.status == "cancelled":
                courier_stats[c]["cancelled"] += 1
            elif o.status == "returned":
                courier_stats[c]["returned"] += 1
            elif o.status in ("in_delivery", "awaiting_pickup"):
                courier_stats[c]["in_transit"] += 1

    breakdown = []
    for courier, s in courier_stats.items():
        rate = round(s["delivered"] / s["total"] * 100, 1) if s["total"] > 0 else 0
        breakdown.append({"courier": courier, "delivery_rate": rate, **s})

    in_transit_count = sum(
        1 for o in orders if o.status in ("in_delivery", "awaiting_pickup")
    )
    manual_pending = sum(
        1 for o in orders if o.status == "pending" and not o.delivery_provider
    )

    return {
        "courier_breakdown_this_month": breakdown,
        "orders_in_transit_now": in_transit_count,
        "manual_pending_orders": manual_pending,
    }


_YOUSSEF_PROMPT = """You are Youssef, Delivery Coordinator at Stocky — a Moroccan COD dropshipping platform.

Rex (the business intelligence layer) is asking you about delivery performance.

Your job:
- Analyze courier performance data
- Flag if any courier's delivery rate is below 60% (concerning for COD)
- Note how many orders are currently in transit
- Compare couriers if multiple are active
- If no couriers are connected, mention it
- Be concise — bullet points preferred, max 150 words
- You are reporting to Rex, not the owner directly
"""


def analyze_youssef(question: str, db: Session, store_id: int) -> str:
    ctx = _youssef_context(db, store_id)
    resp = _client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=_YOUSSEF_PROMPT,
        messages=[{"role": "user", "content": f"Delivery data:\n{json.dumps(ctx, indent=2, default=str)}\n\nQuestion: {question}"}],
    )
    log_usage(db, store_id, "claude-haiku-4-5-20251001", resp.usage.input_tokens, resp.usage.output_tokens)
    return resp.content[0].text


# ── OMAR — Head Librarian (Analytics) ─────────────────────────────────────────

def _omar_context(db: Session, store_id: int) -> dict:
    now = _now()
    month_start      = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_month_end   = month_start
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    orders = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(
            models.Order.user_id == store_id,
            models.Order.is_deleted == False,
            models.Order.order_date >= month_start,
        )
        .all()
    )

    prev_orders = (
        db.query(models.Order)
        .filter(
            models.Order.user_id == store_id,
            models.Order.is_deleted == False,
            models.Order.order_date >= prev_month_start,
            models.Order.order_date < prev_month_end,
        )
        .all()
    )

    prev_city_stats = defaultdict(lambda: {"delivered": 0, "total": 0})
    for o in prev_orders:
        city = (o.city or "Unknown").strip().title()
        prev_city_stats[city]["total"] += 1
        if o.status == "delivered":
            prev_city_stats[city]["delivered"] += 1

    city_stats = defaultdict(lambda: {"delivered": 0, "cancelled": 0, "total": 0})
    product_sales = defaultdict(lambda: {"units": 0, "returns": 0})

    for o in orders:
        city = (o.city or "Unknown").strip().title()
        city_stats[city]["total"] += 1
        if o.status == "delivered":
            city_stats[city]["delivered"] += 1
        elif o.status in ("cancelled", "returned"):
            city_stats[city]["cancelled"] += 1

        for item in (o.items or []):
            name = item.product_name or "Unknown"
            if o.status == "delivered":
                product_sales[name]["units"] += item.quantity
            elif o.status in ("cancelled", "returned"):
                product_sales[name]["returns"] += item.quantity

    top_cities = []
    for city, s in sorted(city_stats.items(), key=lambda x: x[1]["total"], reverse=True)[:10]:
        rate = round(s["delivered"] / s["total"] * 100, 1) if s["total"] > 0 else 0
        prev = prev_city_stats.get(city, {})
        prev_rate = round(prev["delivered"] / prev["total"] * 100, 1) if prev.get("total", 0) > 0 else None
        top_cities.append({
            "city": city, "total": s["total"], "delivery_rate": rate,
            "cancelled": s["cancelled"],
            "prev_month_delivery_rate": prev_rate,
        })

    top_products = sorted(product_sales.items(), key=lambda x: x[1]["units"], reverse=True)[:8]

    # High return rate products
    high_return = []
    for name, s in product_sales.items():
        total = s["units"] + s["returns"]
        if total >= 5:
            return_rate = round(s["returns"] / total * 100, 1)
            if return_rate > 30:
                high_return.append({"product": name, "return_rate": return_rate})
    high_return.sort(key=lambda x: x["return_rate"], reverse=True)

    return {
        "city_performance_this_month": top_cities,
        "top_products_this_month": [{"product": k, **v} for k, v in top_products],
        "high_return_rate_products": high_return[:5],
        "total_orders_this_month": len(orders),
    }


_OMAR_PROMPT = """You are Omar, Head Librarian (Data Analyst) at Stocky — a Moroccan COD dropshipping platform.

Rex (the business intelligence layer) is asking you for data analysis.

Your job:
- Analyze geographic and product performance data
- Identify best and worst performing cities by delivery rate
- Highlight top selling products
- Flag products with high return rates (>30%)
- Note any important patterns
- Be concise — bullet points preferred, max 150 words
- You are reporting to Rex, not the owner directly
"""


def analyze_omar(question: str, db: Session, store_id: int) -> str:
    ctx = _omar_context(db, store_id)
    resp = _client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=_OMAR_PROMPT,
        messages=[{"role": "user", "content": f"Analytics data:\n{json.dumps(ctx, indent=2, default=str)}\n\nQuestion: {question}"}],
    )
    log_usage(db, store_id, "claude-haiku-4-5-20251001", resp.usage.input_tokens, resp.usage.output_tokens)
    return resp.content[0].text


# ── Agent registry ─────────────────────────────────────────────────────────────

AGENTS = {
    "hassan": {
        "fn": analyze_hassan,
        "description": (
            "Chief Accountant. Knows profit, revenue, margins, cash balance, "
            "team costs, ad costs, fixed costs, clean profit for today/week/month."
        ),
    },
    "karima": {
        "fn": analyze_karima,
        "description": (
            "Order Manager. Knows order counts by status, recent orders, "
            "stock levels, low/out-of-stock items, pending leads."
        ),
    },
    "hamza": {
        "fn": analyze_hamza,
        "description": (
            "Ads Manager. Knows ad spend per platform (Meta, TikTok, Google, Snapchat), "
            "total marketing costs, ROAS."
        ),
    },
    "youssef": {
        "fn": analyze_youssef,
        "description": (
            "Delivery Coordinator. Knows courier performance (Forcelog, Olivraison), "
            "delivery rates, orders currently in transit."
        ),
    },
    "omar": {
        "fn": analyze_omar,
        "description": (
            "Data Analyst. Knows city-by-city performance, top selling products, "
            "high return rate products, geographic patterns."
        ),
    },
}


def get_agent_tools() -> list:
    """Return Claude tool definitions for all agents."""
    return [
        {
            "name": f"ask_{name}",
            "description": info["description"],
            "input_schema": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": f"Specific question for {name.capitalize()} to analyze",
                    }
                },
                "required": ["question"],
            },
        }
        for name, info in AGENTS.items()
    ]


def run_agent(name: str, question: str, db: Session, store_id: int) -> str:
    """Run a named agent and return their analysis."""
    agent = AGENTS.get(name)
    if not agent:
        return f"Unknown agent: {name}"
    try:
        return agent["fn"](question, db, store_id)
    except Exception as e:
        return f"{name.capitalize()} encountered an error: {str(e)}"
