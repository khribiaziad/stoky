"""
Rex Memory
Stores facts Rex learns about the store across conversations.
Simple key-value JSON blob per store. Rex reads on every turn, updates when he learns something new.
"""

import os
import json
from datetime import datetime

import anthropic
from sqlalchemy.orm import Session

import models
from rex.usage import log_usage


def load_memory(db: Session, user_id: int) -> dict:
    """Return the store's memory facts dict. Empty dict if none yet."""
    mem = db.query(models.RexMemory).filter_by(user_id=user_id).first()
    return mem.facts or {} if mem else {}


def save_memory(db: Session, user_id: int, facts: dict):
    """Upsert the memory facts for a store."""
    mem = db.query(models.RexMemory).filter_by(user_id=user_id).first()
    if mem:
        mem.facts = facts
        mem.updated_at = datetime.utcnow()
    else:
        mem = models.RexMemory(user_id=user_id, facts=facts)
        db.add(mem)
    db.commit()


def format_memory_for_prompt(facts: dict) -> str:
    """Format memory facts into a readable block for Rex's system prompt."""
    if not facts:
        return ""
    lines = [f"- {k}: {v}" for k, v in facts.items()]
    return "What you remember about this store:\n" + "\n".join(lines)


_EXTRACT_PROMPT = """You are Rex's memory manager. Your job is to extract important facts from a conversation that Rex should remember for future conversations.

Extract only facts that are:
- Stated explicitly by the owner (not inferred)
- Useful in future conversations (preferences, decisions, context, goals, problems)
- Not already in the existing memory

Return a JSON object with string keys and string values. Only include NEW facts, not existing ones.
If there's nothing new worth remembering, return an empty object {}.

Examples of good facts to remember:
- "preferred_courier": "Forcelog because Olivraison has bad rates"
- "main_market": "targeting Casablanca and Rabat"
- "problem": "high return rate on the red hoodie"
- "goal": "launch new product next month"

Do NOT remember: temporary data, numbers that change daily, things already in the memory.
"""


def extract_and_update_memory(db: Session, user_id: int, conversation_text: str):
    """After a conversation, extract new facts and merge into memory."""
    existing = load_memory(db, user_id)

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=_EXTRACT_PROMPT,
        messages=[{
            "role": "user",
            "content": (
                f"Existing memory:\n{json.dumps(existing, indent=2)}\n\n"
                f"Conversation:\n{conversation_text}\n\n"
                "Extract new facts to remember (JSON only, no explanation):"
            ),
        }],
    )

    log_usage(db, user_id, "claude-haiku-4-5-20251001", response.usage.input_tokens, response.usage.output_tokens)
    text = response.content[0].text.strip()
    # Extract JSON from response
    try:
        start = text.find("{")
        end   = text.rfind("}") + 1
        if start >= 0 and end > start:
            new_facts = json.loads(text[start:end])
            if new_facts:
                merged = {**existing, **new_facts}
                save_memory(db, user_id, merged)
    except Exception:
        pass  # Memory extraction is best-effort, never crash
