"""
Rex — Intelligence Layer
prompt_engine.py sends questions + store context to Claude API.
Rex reads the context, answers the question, returns plain language insight.
"""

import json
import os

import anthropic

REX_SYSTEM_PROMPT = """You are Rex, the business intelligence assistant for Stocky.
Stocky is an operations dashboard for Moroccan COD (cash on delivery) dropshipping businesses.

You have access to real-time data about the store you are helping.
You speak directly to the store owner or their team.
You are concise, honest, and direct. You never make up numbers.
If the data shows a problem, you say so clearly.
If you don't have enough data to answer, you say so.
You always answer in the same language the user asks in (Arabic, French, or English).
You never write to the database. You only read and explain.
Amounts are always in MAD (Moroccan Dirham) unless otherwise specified.
"""


def ask_rex(question: str, context: dict, conversation_history: list = None) -> str:
    """Send a question to Rex with store context.
    context: the store snapshot from context_builder.build_store_context()
    conversation_history: list of previous {"role": "user/assistant", "content": "..."} dicts
    Returns Rex's answer as a plain string.
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    context_block = f"""
Current store data:
{json.dumps(context, indent=2, default=str)}
"""

    messages = list(conversation_history or [])
    messages = messages + [
        {"role": "user", "content": f"{context_block}\n\nQuestion: {question}"}
    ]

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system=REX_SYSTEM_PROMPT,
        messages=messages,
    )

    return response.content[0].text


def get_proactive_insight(context: dict) -> str | None:
    """Generate one proactive insight based on the store context.
    Called when the user opens their dashboard.
    Returns a short insight string or None if nothing notable.
    Only fires if there are alerts or notable patterns.
    """
    if not context.get("alerts"):
        return None

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=150,
        system=REX_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"Store data: {json.dumps(context, default=str)}\n\nGive me ONE short proactive insight (max 2 sentences) about the most important thing happening in this store right now. Be specific with numbers."
        }]
    )

    return response.content[0].text
