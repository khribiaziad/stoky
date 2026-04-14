"""
Rex Usage Tracking
Logs every LLM call (tokens + cost) and handles monthly billing into FixedExpense.
"""

from datetime import datetime

from sqlalchemy import extract, func
from sqlalchemy.orm import Session

import models

# Pricing in USD per million tokens
PRICING = {
    "claude-sonnet-4-6":        {"input": 3.0,  "output": 15.0},
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.0},
}

USD_TO_MAD = 10.0  # approximate fixed rate


def _cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    price = PRICING.get(model, {"input": 3.0, "output": 15.0})
    return (input_tokens * price["input"] + output_tokens * price["output"]) / 1_000_000


def log_usage(db: Session, user_id: int, model: str, input_tokens: int, output_tokens: int) -> None:
    """Log one LLM call. Best-effort — never crashes the caller."""
    try:
        entry = models.RexUsageLog(
            user_id=user_id,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=_cost_usd(model, input_tokens, output_tokens),
        )
        db.add(entry)
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


def bill_month(db: Session, year: int, month: int) -> dict:
    """
    Aggregate all Rex usage for the given month across all stores.
    Creates a FixedExpense one_time entry per store and marks the month as billed.
    Safe to call multiple times — already-billed stores are skipped.
    """
    rows = (
        db.query(
            models.RexUsageLog.user_id,
            func.sum(models.RexUsageLog.cost_usd).label("total_usd"),
        )
        .filter(
            extract("year",  models.RexUsageLog.created_at) == year,
            extract("month", models.RexUsageLog.created_at) == month,
        )
        .group_by(models.RexUsageLog.user_id)
        .all()
    )

    billed = []
    skipped = []

    for row in rows:
        store_id, total_usd = row.user_id, float(row.total_usd or 0)

        # Skip if already billed for this month
        already = db.query(models.RexBilledMonth).filter_by(
            user_id=store_id, year=year, month=month
        ).first()
        if already:
            skipped.append(store_id)
            continue

        if total_usd <= 0:
            continue

        total_mad = round(total_usd * USD_TO_MAD, 2)
        month_label = datetime(year, month, 1).strftime("%B %Y")

        expense = models.FixedExpense(
            user_id=store_id,
            name=f"Rex AI – {month_label}",
            type="one_time",
            category="software",
            amount=total_mad,
            description=f"Rex AI usage for {month_label} · ${total_usd:.4f} × {USD_TO_MAD} MAD/USD",
            start_date=datetime(year, month, 1),
            is_active=True,
        )
        db.add(expense)
        db.flush()

        db.add(models.RexBilledMonth(
            user_id=store_id,
            year=year,
            month=month,
            cost_usd=total_usd,
            cost_mad=total_mad,
            expense_id=expense.id,
        ))

        billed.append({"store_id": store_id, "cost_usd": round(total_usd, 6), "cost_mad": total_mad})

    db.commit()
    return {"billed": billed, "skipped": skipped}
