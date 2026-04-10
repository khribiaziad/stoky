"""Rex API endpoints — the only way the frontend and bot talk to Rex."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from database import get_db, SessionLocal
from auth import get_current_user
from rex.context_builder import build_store_context
from rex.prompt_engine import ask_rex_customer, get_proactive_insight
from rex.orchestrator import ask_rex_owner, stream_rex_owner
from rex.memory import extract_and_update_memory
import models

router = APIRouter(prefix="/api/rex", tags=["rex"])


def _get_store_id(user: models.User) -> int:
    return user.store_id if user.role == "confirmer" else user.id


# ── Conversations ─────────────────────────────────────────────────────────────

@router.get("/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = _get_store_id(user)
    convs = (
        db.query(models.RexConversation)
        .filter_by(user_id=store_id)
        .order_by(models.RexConversation.updated_at.desc())
        .all()
    )
    return [
        {"id": c.id, "title": c.title or "Untitled", "updated_at": c.updated_at}
        for c in convs
    ]


@router.post("/conversations")
def create_conversation(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = _get_store_id(user)
    conv = models.RexConversation(user_id=store_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"id": conv.id, "title": conv.title, "updated_at": conv.updated_at}


@router.get("/conversations/{conv_id}")
def get_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = _get_store_id(user)
    conv = (
        db.query(models.RexConversation)
        .options(joinedload(models.RexConversation.messages))
        .filter_by(id=conv_id, user_id=store_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        "id": conv.id,
        "title": conv.title or "Untitled",
        "updated_at": conv.updated_at,
        "messages": [
            {"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at}
            for m in conv.messages
        ],
    }


@router.delete("/conversations/{conv_id}")
def delete_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = _get_store_id(user)
    conv = db.query(models.RexConversation).filter_by(id=conv_id, user_id=store_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.query(models.RexMessage).filter_by(conversation_id=conv_id).delete()
    db.delete(conv)
    db.commit()
    return {"success": True}


# ── Streaming ask (main endpoint) ─────────────────────────────────────────────

@router.post("/conversations/{conv_id}/ask")
def ask_in_conversation(
    conv_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Ask Rex a question within a conversation. Streams SSE response."""
    store_id = _get_store_id(user)
    question = (body.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="question required")

    conv = (
        db.query(models.RexConversation)
        .options(joinedload(models.RexConversation.messages))
        .filter_by(id=conv_id, user_id=store_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Auto-title from first question
    if not conv.title and not conv.messages:
        conv.title = question[:60] + ("..." if len(question) > 60 else "")
        db.commit()

    # Capture everything needed before the generator runs (session-safe)
    history = [
        {"role": "user" if m.role == "user" else "assistant", "content": m.content}
        for m in conv.messages[-20:]
    ]
    store_name = user.store_name

    def event_stream():
        # Use a fresh DB session inside the generator — avoids session lifecycle issues with StreamingResponse
        gen_db = SessionLocal()
        full_answer = ""
        try:
            for event in stream_rex_owner(question, gen_db, store_id, store_name, history):
                yield event
                if event.startswith("data: "):
                    try:
                        data = json.loads(event[6:])
                        if data.get("type") == "done":
                            full_answer = data.get("answer", "")
                        elif data.get("type") == "error":
                            return
                    except Exception:
                        pass

            # Save messages to DB
            gen_db.add(models.RexMessage(conversation_id=conv_id, role="user", content=question))
            if full_answer:
                gen_db.add(models.RexMessage(conversation_id=conv_id, role="rex", content=full_answer))
            conv_record = gen_db.query(models.RexConversation).filter_by(id=conv_id).first()
            if conv_record:
                conv_record.updated_at = datetime.utcnow()
            gen_db.commit()

            # Extract memory facts (best-effort)
            try:
                extract_and_update_memory(gen_db, store_id, f"Owner: {question}\nRex: {full_answer}")
            except Exception:
                pass

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'text': str(e)})}\n\n"
        finally:
            gen_db.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── Legacy ask endpoint (kept for RexChat floating widget) ────────────────────

@router.post("/ask")
def ask(
    body: dict,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    question = body.get("question", "").strip()
    if not question:
        return {"answer": None}

    store_id = _get_store_id(user)
    history = body.get("history", [])
    answer = ask_rex_owner(question, db, store_id, user.store_name, history)
    return {"answer": answer}


# ── Proactive insight ─────────────────────────────────────────────────────────

@router.get("/insight")
def get_insight(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    store_id = _get_store_id(user)
    context = build_store_context(db, store_id, user.store_name)
    insight = get_proactive_insight(context)
    return {"insight": insight}


# ── n8n daily briefing endpoint ───────────────────────────────────────────────

@router.get("/briefing")
def daily_briefing(
    api_key: str,
    db: Session = Depends(get_db),
):
    """Called by n8n every morning. Returns a business summary for WhatsApp delivery.
    Auth: ?api_key=<leads_api_key>
    """
    setting = db.query(models.AppSettings).filter_by(key="leads_api_key", value=api_key).first()
    if not setting:
        raise HTTPException(status_code=401, detail="Invalid API key")

    store_id = setting.user_id
    store = db.query(models.User).filter_by(id=store_id).first()
    store_name = store.store_name if store else "the store"

    answer = ask_rex_owner(
        "Give me a complete morning briefing: how did yesterday go, what needs attention today, and any alerts I should know about.",
        db, store_id, store_name,
    )
    return {"briefing": answer, "store": store_name}


# ── Customer endpoint (WhatsApp bot) ─────────────────────────────────────────

@router.post("/customer")
def customer_message(
    body: dict,
    db: Session = Depends(get_db),
):
    """Rex customer mode — called by the WhatsApp bot."""
    api_key = body.get("api_key", "")
    setting = db.query(models.AppSettings).filter_by(key="leads_api_key", value=api_key).first()
    if not setting:
        raise HTTPException(status_code=401, detail="Invalid API key")

    store_id = setting.user_id
    store = db.query(models.User).filter_by(id=store_id).first()
    store_name = store.store_name if store else "the store"

    phone      = body.get("phone", "").strip()
    message    = body.get("message", "").strip()
    history    = body.get("history", [])
    tool_result = body.get("tool_result")

    if not message and not tool_result:
        raise HTTPException(status_code=400, detail="message or tool_result required")

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
                {"size": v.size, "color": v.color, "selling_price": v.selling_price, "stock": v.stock}
                for v in p.variants
            ],
        }
        for p in products_raw
    ]

    if tool_result:
        history.append({
            "role": "user",
            "content": [{"type": "tool_result", "tool_use_id": tool_result["tool_use_id"], "content": tool_result["content"]}],
        })
        response = ask_rex_customer("", customer_context, history, products)
    else:
        response = ask_rex_customer(message, customer_context, history, products)

    if response.stop_reason == "tool_use":
        tool_block = next((b for b in response.content if b.type == "tool_use"), None)
        if tool_block:
            return {
                "text": None,
                "tool_use": {"id": tool_block.id, "name": tool_block.name, "input": tool_block.input},
                "assistant_content": [b.model_dump() for b in response.content],
            }

    text_block = next((b for b in response.content if b.type == "text"), None)
    return {
        "text": text_block.text if text_block else "Sorry, something went wrong.",
        "tool_use": None,
        "assistant_content": [b.model_dump() for b in response.content],
    }
