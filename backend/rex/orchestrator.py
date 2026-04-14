"""
Rex Orchestrator
Rex is the CEO. He receives a question, consults the right team agents,
then synthesizes one clear answer — streaming token by token to the frontend.

Flow:
  1. Load store memory (facts Rex learned in past conversations)
  2. Agentic loop: Rex picks agents via tool_use, agents analyze their domain
  3. Final streaming synthesis: Rex streams the answer word by word
  4. Memory extraction: after response, extract new facts to remember
"""

import json
import os
from typing import Generator

import anthropic
from sqlalchemy.orm import Session

from .agents import get_agent_tools, run_agent
from .memory import load_memory, format_memory_for_prompt
from .usage import log_usage


_REX_SYSTEM = """You are Rex, the AI business intelligence layer for Stocky — a COD dropshipping platform for Moroccan businesses.

Your character:
- Friendly but professional. You speak like a trusted business partner, not a robot.
- Data-focused. You always back answers with real numbers.
- Direct and honest. If something is wrong, say it clearly — no sugarcoating.
- Concise. Short paragraphs or bullet points. Never write essays.
- Proactive. When you notice something important in the data, mention it even if not asked.

You have a team of specialists you can consult:
- Hassan  → finances: profit, revenue, margins, cash balance, month-over-month trends
- Karima  → operations: orders, stock, leads
- Hamza   → marketing: ad spend, ROAS, platform performance
- Youssef → logistics: courier rates, delivery performance
- Omar    → analytics: city performance vs last month, top products, return rates

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


def _build_system(memory_facts: dict) -> str:
    memory_block = format_memory_for_prompt(memory_facts)
    if memory_block:
        return _REX_SYSTEM + f"\n\n{memory_block}"
    return _REX_SYSTEM


def ask_rex_owner(
    question: str,
    db: Session,
    store_id: int,
    store_name: str,
    conversation_history: list = None,
) -> str:
    """Non-streaming version — used for simple calls (proactive insight etc)."""
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    tools = get_agent_tools()
    memory = load_memory(db, store_id)
    system = _build_system(memory)

    messages = list(conversation_history or [])
    messages.append({"role": "user", "content": f"Store: {store_name}\n\nQuestion: {question}"})

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system,
            tools=tools,
            messages=messages,
        )

        log_usage(db, store_id, "claude-sonnet-4-6", response.usage.input_tokens, response.usage.output_tokens)

        if response.stop_reason == "end_turn":
            return "\n".join(b.text for b in response.content if hasattr(b, "text"))

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    agent_name = block.name.replace("ask_", "")
                    result = run_agent(agent_name, block.input.get("question", question), db, store_id)
                    tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": result})
            messages.append({"role": "user", "content": tool_results})
        else:
            return "\n".join(b.text for b in response.content if hasattr(b, "text"))


def stream_rex_owner(
    question: str,
    db: Session,
    store_id: int,
    store_name: str,
    conversation_history: list = None,
) -> Generator[str, None, None]:
    """
    Streaming version — yields SSE events:
      {"type": "status", "text": "Consulting Hassan..."}
      {"type": "token",  "text": "word"}
      {"type": "done",   "answer": "full answer text"}
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    tools = get_agent_tools()
    memory = load_memory(db, store_id)
    system = _build_system(memory)

    messages = list(conversation_history or [])
    messages.append({"role": "user", "content": f"Store: {store_name}\n\nQuestion: {question}"})

    agent_reports = []

    # ── Phase 1: agentic loop (non-streaming) — collect all agent reports ──────
    while True:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system,
            tools=tools,
            messages=messages,
        )

        log_usage(db, store_id, "claude-sonnet-4-6", response.usage.input_tokens, response.usage.output_tokens)

        if response.stop_reason != "tool_use":
            break

        messages.append({"role": "assistant", "content": response.content})
        tool_results = []

        for block in response.content:
            if block.type == "tool_use":
                agent_name = block.name.replace("ask_", "")
                label = agent_name.capitalize()

                yield f"data: {json.dumps({'type': 'status', 'text': f'Consulting {label}...'})}\n\n"

                result = run_agent(agent_name, block.input.get("question", question), db, store_id)
                agent_reports.append(f"[{label.upper()}]\n{result}")

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        messages.append({"role": "user", "content": tool_results})

    # ── Phase 2: streaming synthesis ──────────────────────────────────────────
    yield f"data: {json.dumps({'type': 'status', 'text': 'Analyzing...'})}\n\n"

    full_answer = ""

    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=system,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            full_answer += text
            yield f"data: {json.dumps({'type': 'token', 'text': text})}\n\n"
        final = stream.get_final_message()
        log_usage(db, store_id, "claude-sonnet-4-6", final.usage.input_tokens, final.usage.output_tokens)

    yield f"data: {json.dumps({'type': 'done', 'answer': full_answer})}\n\n"
