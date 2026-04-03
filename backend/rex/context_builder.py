"""
Rex — Intelligence Layer
context_builder.py builds a fresh snapshot of a store's current state.
This snapshot is what Rex reads before answering any question.
Hassan, Karima, Hamza, and Youssef all feed into this snapshot.
Rex never calls the DB directly — he reads what the team already produced.
"""

import json
import os
from datetime import datetime
from core.date_ranges import MOROCCO_TZ
from services.calculations import get_summary
from services.stock_service import check_low_stock

CONTEXTS_DIR = os.path.join(os.path.dirname(__file__), "store_contexts")


def build_store_context(db, store_id: int, store_name: str) -> dict:
    """Build a complete store snapshot for Rex to read.
    Called whenever a user opens Rex or when data changes significantly.
    Returns a dict and also saves it to store_contexts/{store_id}.json
    """
    now = datetime.now(MOROCCO_TZ)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Today's summary from Hassan
    today = get_summary(db, today_start, now, store_id)

    # This month from Hassan
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month = get_summary(db, month_start, now, store_id)

    # Low stock alerts from Karima
    low_stock = check_low_stock(db, store_id)
    low_stock_items = [
        {"product": v.product.name, "variant": v.name, "stock": v.stock, "threshold": v.low_stock_threshold}
        for v in low_stock
    ]

    # Build alerts list
    alerts = []
    if month["capital"]["cash_balance"] < 0:
        alerts.append("Cash balance is negative — check withdrawals and stock purchase accounting")
    if low_stock_items:
        alerts.append(f"{len(low_stock_items)} product(s) running low on stock")
    if month["financials"]["clean_profit"] < 0:
        alerts.append("Clean profit is negative this month")

    context = {
        "store": store_name,
        "store_id": store_id,
        "generated_at": now.isoformat(),
        "today": {
            "revenue": today["financials"].get("revenue", 0),
            "clean_profit": today["financials"]["clean_profit"],
            "orders_delivered": today.get("orders", {}).get("delivered", 0),
            "orders_pending": today.get("orders", {}).get("pending", 0),
            "delivery_rate": today.get("orders", {}).get("delivery_rate", 0),
        },
        "this_month": {
            "revenue": month["financials"].get("revenue", 0),
            "gross_profit": month["financials"]["gross_profit"],
            "clean_profit": month["financials"]["clean_profit"],
            "team_costs": month["financials"]["team_costs"],
            "ads_costs": month["financials"]["ads_costs"],
            "cash_balance": month["capital"]["cash_balance"],
            "stock_value": month["capital"]["stock_value"],
            "delivered": month.get("orders", {}).get("delivered", 0),
            "return_rate": month.get("orders", {}).get("return_rate", 0),
        },
        "alerts": alerts,
        "low_stock": low_stock_items,
    }

    # Save to file
    os.makedirs(CONTEXTS_DIR, exist_ok=True)
    path = os.path.join(CONTEXTS_DIR, f"{store_id}.json")
    with open(path, "w") as f:
        json.dump(context, f, indent=2, default=str)

    return context


def load_store_context(store_id: int) -> dict | None:
    """Load the last saved context for a store.
    Returns None if no context has been built yet.
    """
    path = os.path.join(CONTEXTS_DIR, f"{store_id}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)
