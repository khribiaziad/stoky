"""
Rex Orchestrator
Rex is the CEO. He receives a question from the store owner, decides which team
members to consult, calls them in sequence (letting Claude drive the routing),
then synthesizes everything into one clear answer.

Flow:
  Owner question → Rex (Claude) picks agents → agents fetch domain data & analyze
  → Rex synthesizes → final answer to owner

Rex never writes to the DB. He only reads what the team produces.
"""

import os
import anthropic
from sqlalchemy.orm import Session

from .agents import get_agent_tools, run_agent


_REX_SYSTEM = """You are Rex, the AI business intelligence layer for Stocky — a COD dropshipping platform for Moroccan businesses.

Your character:
- Friendly but professional. You speak like a trusted business partner, not a robot.
- Data-focused. You always back answers with real numbers.
- Direct and honest. If something is wrong, you say it clearly — no sugarcoating.
- Concise. Short paragraphs or bullet points. Never write essays.
- Proactive. When you notice something important in the data, you mention it even if not asked.

You have a team of specialists you can consult:
- Hassan  → finances: profit, revenue, margins, cash balance
- Karima  → operations: orders, stock, leads
- Hamza   → marketing: ad spend, ROAS, platform performance
- Youssef → logistics: courier rates, delivery performance
- Omar    → analytics: city performance, top products, return rates

How to work:
1. Read the owner's question carefully
2. Call the agents whose domain is relevant — you can call multiple
3. Synthesize their findings into one clear, actionable answer
4. Always end with something useful: a warning, a recommendation, or a next step

Rules:
- Never make up numbers — if the team doesn't have it, say so
- All amounts are in MAD (Moroccan Dirham)
- You never write to the database — read only, always
- Always respond in the same language the owner writes in (Arabic/Darija, French, or English)
"""


def ask_rex_owner(
    question: str,
    db: Session,
    store_id: int,
    store_name: str,
    conversation_history: list = None,
) -> str:
    """
    Rex orchestrates the team to answer the owner's question.
    Uses an agentic loop: Rex calls agents until he has enough to answer.
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    tools = get_agent_tools()

    messages = list(conversation_history or [])
    messages.append({
        "role": "user",
        "content": f"Store: {store_name}\n\nQuestion: {question}",
    })

    # Agentic loop — Rex keeps calling agents until stop_reason is "end_turn"
    while True:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=_REX_SYSTEM,
            tools=tools,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            text_blocks = [b.text for b in response.content if hasattr(b, "text")]
            return "\n".join(text_blocks)

        if response.stop_reason == "tool_use":
            # Add Rex's turn (including tool_use blocks) to messages
            messages.append({"role": "assistant", "content": response.content})

            # Run every agent Rex requested, collect results
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    agent_name = block.name.replace("ask_", "")
                    agent_question = block.input.get("question", question)
                    result = run_agent(agent_name, agent_question, db, store_id)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })

            # Feed all agent results back to Rex
            messages.append({"role": "user", "content": tool_results})

        else:
            # Unexpected stop reason — return whatever text Rex produced
            text_blocks = [b.text for b in response.content if hasattr(b, "text")]
            return "\n".join(text_blocks) if text_blocks else "I couldn't process that request."
