"""Rex API endpoints — the only way the frontend talks to Rex."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from rex.context_builder import build_store_context
from rex.prompt_engine import ask_rex, get_proactive_insight
import models

router = APIRouter(prefix="/api/rex", tags=["rex"])


@router.get("/insight")
def get_insight(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Returns one proactive insight for the dashboard.
    Builds fresh context then asks Rex what matters most right now.
    """
    store_id = user.store_id or user.id
    context = build_store_context(db, store_id, user.store_name)
    insight = get_proactive_insight(context)
    return {"insight": insight}


@router.post("/ask")
def ask(
    body: dict,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Ask Rex a question. Returns Rex's answer.
    body: {"question": str, "history": [...] optional}
    """
    question = body.get("question", "").strip()
    if not question:
        return {"answer": None}

    store_id = user.store_id or user.id
    context = build_store_context(db, store_id, user.store_name)
    history = body.get("history", [])
    answer = ask_rex(question, context, history)
    return {"answer": answer}
