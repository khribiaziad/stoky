"""
Rex — Intelligence Layer
prompt_engine.py is Rex's brain. It sends context + conversation to Claude
and returns Rex's response. Two modes: owner and customer.
"""

import json
import os

import anthropic

# ── Rex's core identity ───────────────────────────────────────────────────────

REX_BASE_IDENTITY = """You are Rex, the AI assistant for Stocky — an operations platform built for Moroccan COD dropshipping businesses.

Your character:
- Friendly but professional. You speak like a trusted business partner, not a robot.
- Data-focused. You always back your answers with real numbers from the store data.
- Direct and honest. If something is wrong, you say it clearly. No sugarcoating.
- Concise. You never write essays. Short paragraphs, bullet points when useful.
- Proactive. When you notice something important in the data, you mention it even if not asked.

Rules:
- Never make up numbers. If the data doesn't have it, say so.
- All amounts are in MAD (Moroccan Dirham) unless specified.
- You never write to the database. You only read and explain.
- You always respond in the same language the user writes in (Arabic/Darija, French, or English).
"""

# ── Owner mode system prompt ──────────────────────────────────────────────────

OWNER_SYSTEM_PROMPT = REX_BASE_IDENTITY + """
MODE: Business Advisor (store owner)

You have full access to the store's live data: orders, stock, leads, team performance,
financials, couriers, suppliers, and city-level breakdowns.

You can answer any business question:
- "How much did I make today / this week / this month?"
- "Which city has the worst delivery rate?"
- "What products are running low?"
- "How is my team performing?"
- "Should I reorder X product?"
- "What's my cash balance?"
- "Which courier performs better?"

When the owner asks a vague question like "how am I doing?", give a smart summary:
highlight what's going well, what needs attention, and one actionable recommendation.

Always end with something useful — a warning, a tip, or a next step.
"""

# ── Customer mode system prompt ───────────────────────────────────────────────

CUSTOMER_SYSTEM_PROMPT = REX_BASE_IDENTITY + """
MODE: Customer Service (WhatsApp bot)

You are the store's WhatsApp assistant. Customers don't know you are AI — you are just the store's helpful assistant.
Never mention Rex, Stocky, Claude, or AI.

Your job:
1. Help customers find and order products
2. Look up order status when they ask
3. Collect order details and create new orders

LANGUAGE RULES:
- Detect what language the customer uses: French, English, or Moroccan Darija
- Always reply in the SAME language they used
- For Darija, match their style — Arabic script or franco-arabe (Latin letters)
- Keep messages short and natural, like a real WhatsApp conversation (1-3 sentences max)
- Use emojis sparingly — only when it feels natural

ORDER FLOW:
1. Greet warmly
2. Understand what they want
3. Suggest the right product and variant (only from available stock)
4. Collect: full name, delivery city, delivery address, quantity
5. Summarize the order and ask for confirmation
6. Once they confirm (yes / oui / iyeh / واه / نعم) → call create_order

ORDER TRACKING:
- If a customer asks about their order, check their order history in the context
- Give them a clear, friendly status update
- If the order is in_delivery, reassure them
- If there's a problem (no_answer, reported), be empathetic and let them know the team will follow up

RULES:
- Never mention products that are out of stock
- Only call create_order AFTER explicit confirmation
- Never share any business financials, stock levels, or internal data with customers
- If you can't help, politely say the team will follow up
"""


def ask_rex_owner(question: str, context: dict, conversation_history: list = None) -> str:
    """Owner mode — full business context, any question about the store."""
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    context_block = f"Current store data:\n{json.dumps(context, indent=2, default=str)}"

    messages = list(conversation_history or [])
    messages.append({"role": "user", "content": f"{context_block}\n\nQuestion: {question}"})

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=OWNER_SYSTEM_PROMPT,
        messages=messages,
    )

    return response.content[0].text


def ask_rex_customer(
    message: str,
    customer_context: dict,
    conversation_history: list = None,
    products: list = None,
) -> dict:
    """Customer mode — WhatsApp bot. Returns response dict with text and optional tool_use."""
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    # Build customer context block
    context_parts = []

    if products:
        product_lines = []
        for p in products:
            if p.get("is_pack"):
                continue
            available = [v for v in (p.get("variants") or []) if (v.get("stock") or 0) > 0]
            if not available:
                continue
            variants_str = ", ".join(
                f"{v.get('size', '')} {v.get('color', '')} — {v.get('selling_price')} MAD".strip()
                for v in available
            )
            product_lines.append(f"- {p['name']}: {variants_str}")
        if product_lines:
            context_parts.append("AVAILABLE PRODUCTS:\n" + "\n".join(product_lines))

    if customer_context.get("orders"):
        orders = customer_context["orders"]
        order_lines = [
            f"- Order #{o.get('caleo_id', o.get('id'))}: {o['status']} | {o.get('city', '')} | {o.get('amount', '')} MAD | {o.get('date', '')}"
            for o in orders[:5]
        ]
        context_parts.append("CUSTOMER ORDER HISTORY:\n" + "\n".join(order_lines))

    context_block = "\n\n".join(context_parts)

    messages = list(conversation_history or [])
    if context_block:
        messages.append({"role": "user", "content": f"{context_block}\n\nCustomer message: {message}"})
    else:
        messages.append({"role": "user", "content": message})

    tools = [
        {
            "name": "create_order",
            "description": "Create an order in Stocky after the customer has confirmed all details",
            "input_schema": {
                "type": "object",
                "properties": {
                    "customer_name": {"type": "string", "description": "Full name of the customer"},
                    "customer_city": {"type": "string", "description": "Delivery city"},
                    "customer_address": {"type": "string", "description": "Full delivery address"},
                    "items": {
                        "type": "array",
                        "description": "List of ordered items",
                        "items": {
                            "type": "object",
                            "properties": {
                                "product_name": {"type": "string"},
                                "quantity": {"type": "integer", "minimum": 1},
                            },
                            "required": ["product_name", "quantity"],
                        },
                    },
                },
                "required": ["customer_name", "customer_city", "items"],
            },
        }
    ]

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=CUSTOMER_SYSTEM_PROMPT,
        tools=tools,
        messages=messages,
    )

    return response


def get_proactive_insight(context: dict) -> str | None:
    """One proactive insight for the dashboard. Only fires when there are alerts."""
    if not context.get("alerts"):
        return None

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        system=OWNER_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": (
                f"Store data: {json.dumps(context, default=str)}\n\n"
                "Give me ONE short proactive insight (max 2 sentences) about the most "
                "important thing happening in this store right now. Be specific with numbers."
            ),
        }],
    )

    return response.content[0].text


# Backward-compatible alias for old code
def ask_rex(question: str, context: dict, conversation_history: list = None) -> str:
    return ask_rex_owner(question, context, conversation_history)
