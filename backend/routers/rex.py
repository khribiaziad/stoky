"""Rex API endpoints — the only way the frontend and bot talk to Rex."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from database import get_db
from auth import get_current_user
from rex.context_builder import build_store_context
from rex.prompt_engine import ask_rex_owner, ask_rex_customer, get_proactive_insight
import models

router = APIRouter(prefix="/api/rex", tags=["rex"])


def _get_store_id(user: models.User) -> int:
    return user.store_id if user.role == "confirmer" else user.id


# ── Owner endpoints (authenticated) ──────────────────────────────────────────

@router.get("/insight")
def get_insight(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Returns one proactive insight for the dashboard."""
    store_id = _get_store_id(user)
    context = build_store_context(db, store_id, user.store_name)
    insight = get_proactive_insight(context)
    return {"insight": insight}


@router.post("/ask")
def ask(
    body: dict,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Ask Rex a business question. Owner only.
    body: {"question": str, "history": [...] optional}
    """
    question = body.get("question", "").strip()
    if not question:
        return {"answer": None}

    store_id = _get_store_id(user)
    context = build_store_context(db, store_id, user.store_name)
    history = body.get("history", [])
    answer = ask_rex_owner(question, context, history)
    return {"answer": answer}


# ── Customer endpoint (bot-facing, API key auth) ──────────────────────────────

@router.post("/customer")
def customer_message(
    body: dict,
    db: Session = Depends(get_db),
):
    """Rex customer mode — called by the WhatsApp bot.

    body: {
        "api_key": str,
        "phone": str,
        "message": str,
        "history": [...] optional,
        "tool_result": {...} optional  -- when bot is returning a tool result
    }

    Returns: {"text": str, "tool_use": {...} | None}
    """
    # API key auth
    api_key = body.get("api_key", "")
    setting = db.query(models.AppSettings).filter_by(key="leads_api_key", value=api_key).first()
    if not setting:
        raise HTTPException(status_code=401, detail="Invalid API key")

    store_id = setting.user_id
    store = db.query(models.User).filter_by(id=store_id).first()
    store_name = store.store_name if store else "the store"

    phone = body.get("phone", "").strip()
    message = body.get("message", "").strip()
    history = body.get("history", [])
    tool_result = body.get("tool_result")

    if not message and not tool_result:
        raise HTTPException(status_code=400, detail="message or tool_result required")

    # Look up customer's orders by phone
    customer_orders = (
        db.query(models.Order)
        .filter(
            models.Order.user_id == store_id,
            models.Order.customer_phone.ilike(f"%{phone[-9:]}%"),
            models.Order.is_deleted == False,
        )
        .order_by(models.Order.order_date.desc())
        .limit(5)
        .all()
    )

    customer_context = {
        "orders": [
            {
                "id": o.id,
                "caleo_id": o.caleo_id,
                "status": o.status,
                "city": o.city,
                "amount": o.total_amount,
                "date": o.order_date.strftime("%Y-%m-%d") if o.order_date else None,
            }
            for o in customer_orders
        ]
    }

    # Fetch products
    products_raw = (
        db.query(models.Product)
        .options(joinedload(models.Product.variants))
        .filter(models.Product.user_id == store_id)
        .all()
    )
    products = [
        {
            "name": p.name,
            "is_pack": False,
            "variants": [
                {
                    "size": v.size,
                    "color": v.color,
                    "selling_price": v.selling_price,
                    "stock": v.stock,
                }
                for v in p.variants
            ],
        }
        for p in products_raw
    ]

    # If bot is returning a tool result (after creating an order)
    if tool_result:
        history.append({
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tool_result["tool_use_id"],
                "content": tool_result["content"],
            }],
        })
        response = ask_rex_customer("", customer_context, history, products)
    else:
        response = ask_rex_customer(message, customer_context, history, products)

    # Parse response
    if response.stop_reason == "tool_use":
        tool_block = next((b for b in response.content if b.type == "tool_use"), None)
        if tool_block:
            return {
                "text": None,
                "tool_use": {
                    "id": tool_block.id,
                    "name": tool_block.name,
                    "input": tool_block.input,
                },
                "assistant_content": [b.model_dump() for b in response.content],
            }

    text_block = next((b for b in response.content if b.type == "text"), None)
    return {
        "text": text_block.text if text_block else "Sorry, something went wrong.",
        "tool_use": None,
        "assistant_content": [b.model_dump() for b in response.content],
    }
