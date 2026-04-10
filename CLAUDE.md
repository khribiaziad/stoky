# Stocky — Claude Code Rules

## Project Overview
Stocky is a COD (cash on delivery) dropshipping operations dashboard for Moroccan businesses.
- **Backend**: FastAPI + SQLAlchemy (PostgreSQL on Render, SQLite locally)
- **Frontend**: React + Vite
- **Active branch**: `redesign` (live at https://stocky-redesign.onrender.com)
- **Production branch**: `main` (live at https://stoky-o31o.onrender.com)

---

## 🔴 High-Risk Areas — REQUIRE EXPLICIT APPROVAL BEFORE ANY CHANGE

These areas are interconnected and a one-line change can cause cascading bugs:

1. **`backend/services/order_service.py`** — status transition matrix, stock deduction/restoration, order creation
2. **`backend/services/stock_service.py`** — stock deduction and restoration logic
3. **`backend/services/expense_service.py`** — expense creation and calculation
4. **`backend/routers/auth.py`** — login, token, permissions
5. **`backend/main.py` migration block** — ALTER TABLE statements run on every deploy
6. **`backend/models.py`** — any schema change requires a matching migration in main.py
7. **`backend/routers/orders.py`** — order status updates, confirmed_by, bulk operations
8. **`backend/routers/forcelog.py` / `olivraison.py`** — courier sync logic

**Protocol for high-risk changes:**
1. Read the full function AND all its callers before proposing anything
2. Write the proposed change in CHANGES.md under "Pending Approval"
3. Wait for explicit user approval ("go", "yes", "do it")
4. Only then write the code

---

## 🟡 Medium-Risk Areas — Read fully before changing

- Any router that touches stock (`stock.py`, `orders.py`, `leads.py`)
- `backend/core/date_ranges.py` — affects all report and filter endpoints
- `frontend/src/App.jsx` — nav, permissions, routing
- `frontend/src/pages/Dashboard.jsx` — large file, many interdependencies

---

## 🟢 Low-Risk Areas — Can change freely

- UI styling, CSS, layout changes
- Frontend-only state/display logic
- Adding new API endpoints that don't touch existing logic
- New modal/form components

---

## General Rules

- **Never make a one-liner change to backend logic without reading the full function and all callers**
- **Never modify the transition matrix without understanding stock restoration implications**
- **Never change `confirmed_by`, `uploaded_by`, or any FK field without checking the referenced table**
- **Always add new DB columns to the migration block in `main.py`**
- **Never use `replace_all: true` on large files without previewing what will change**
- **After any backend change, update CHANGES.md**
- **Do not merge `redesign` to `main` without explicit user instruction**

---

## Database FK Reference
- `orders.confirmed_by` → `team_members.id` (NOT `users.id`)
- `orders.uploaded_by` → `users.id`
- `team_members.user_id` → `users.id`
- `users.team_member_id` → `team_members.id`
- `users.store_id` → `users.id` (confirmers point to their admin)

---

## Two Delivery Modes — CRITICAL BUSINESS LOGIC

**Mode A — No delivery company (manual)**
User manages delivery themselves via a simple dropdown with 3 statuses:
- `pending → delivered`
- `pending → cancelled`
That's it. No courier steps.

**Mode B — With delivery company (Forcelog / Olivraison)**
Order is sent to a courier. Status updates automatically via courier API.
Full flow applies: pending → awaiting_pickup → in_delivery → delivered/returned/no_answer/etc.

The transition matrix must allow BOTH modes. `pending → delivered` must always be valid.

---

## Status Flow (orders)
```
pending → delivered (Mode A: manual, no courier)
pending → cancelled (Mode A: manual, no courier)
pending → awaiting_pickup → in_delivery → delivered  (Mode B: courier)
                                        → returned (stock restored)
                                        → no_answer → reported → in_delivery
                                                               → pending
                                        → lost → pending
                                        → cancelled (stock restored)
```
Stock is only affected at: **order creation** (deduct) and **cancelled/returned** (restore).

---

## Rex — AI Intelligence Layer

Rex is the AI brain of Stocky. He has two modes and lives entirely in `backend/rex/`.

**Owner mode** — answers business questions in the dashboard chat (`RexChat` component).
**Customer mode** — powers the WhatsApp bot (`stoky-bot`), handles product lookup + order creation.

### Multi-Agent Architecture (orchestrator pattern)
Rex is the CEO. When the owner asks a question, Rex consults specialized agents, each owning their domain. This happens silently in the backend — the owner only sees Rex's final answer.

| Agent | File | Domain |
|-------|------|--------|
| Hassan | `rex/agents.py` | Profit, revenue, margins, cash balance |
| Karima | `rex/agents.py` | Orders, stock levels, leads pipeline |
| Hamza  | `rex/agents.py` | Ad spend per platform, ROAS |
| Youssef| `rex/agents.py` | Courier performance, delivery rates |
| Omar   | `rex/agents.py` | City performance, top products, return rates |

**Flow:**
1. Owner asks Rex a question via `POST /api/rex/ask`
2. `rex/orchestrator.py` → Rex (Claude Sonnet) picks which agents to call via tool_use
3. Each agent fetches its own domain data from DB + calls Claude Haiku to analyze
4. Rex receives all agent reports, synthesizes one final answer
5. Answer returned to owner

### Key files
- `backend/rex/agents.py` — all 5 agent context builders + analyzers + registry
- `backend/rex/orchestrator.py` — Rex orchestrator (agentic loop with tool_use)
- `backend/rex/prompt_engine.py` — customer mode (`ask_rex_customer`) + proactive insight
- `backend/rex/context_builder.py` — full store snapshot (used for proactive insight only)
- `backend/routers/rex.py` — `/api/rex/ask` (owner), `/api/rex/insight`, `/api/rex/customer` (bot)
- `frontend/src/components/RexChat.jsx` — floating chat UI (hidden for confirmers)
- `stoky-bot/rex.js` — WhatsApp bot calls `/api/rex/customer`

### Conversation storage
- `RexConversation` + `RexMessage` models store full history per store
- Conversations have auto-title from first message
- Endpoints: `GET/POST /api/rex/conversations`, `GET/DELETE /api/rex/conversations/{id}`, `POST /api/rex/conversations/{id}/ask`

### Streaming
- `/api/rex/conversations/{id}/ask` returns SSE (`text/event-stream`)
- Events: `{"type":"status","text":"Consulting Hassan..."}`, `{"type":"token","text":"word"}`, `{"type":"done","answer":"full text"}`
- Phase 1: agentic loop (non-streaming) — yields status events per agent
- Phase 2: final synthesis streams token by token via `client.messages.stream()`

### Memory
- `RexMemory` model: one JSON blob per store with key-value facts
- Rex reads memory before every answer (injected into system prompt)
- After each conversation, `extract_and_update_memory()` extracts new facts via Haiku
- `backend/rex/memory.py` — load, save, format, extract

### Historical trends
- Hassan: compares this month vs prev month (revenue, profit, orders delta %)
- Omar: tracks city delivery rates vs prev month

### n8n daily briefing
- `GET /api/rex/briefing?api_key=<leads_api_key>` — called by n8n every morning
- Returns a full morning briefing text ready for WhatsApp delivery

### Rules
- Rex **never writes to the DB** — read only, always (memory extraction is the only write, via `memory.py`)
- Owner mode uses `claude-sonnet-4-6`, agents use `claude-haiku-4-5-20251001`
- Always answer in the language the user writes in (AR/FR/EN/Darija)
- Never serve stale context — always build fresh on each request
- The full `build_store_context()` is only used for `/insight` (proactive insight), not for `/ask`
- The legacy `POST /api/rex/ask` endpoint is kept for the floating `RexChat` widget

---

## The Stocky Ecosystem Vision — CRITICAL CONTEXT

**Stocky is not just a SaaS dashboard. It is a network.**

Every store using Stocky is a node in an ecosystem. Rex is the intelligence layer that sees across all nodes — without any individual store knowing about the others.

### Rex has two levels of intelligence

**Level 1 — Store level (current)**
Rex helps the individual store owner understand and run their business better.

**Level 2 — Ecosystem level (the real vision)**
Rex sees across ALL stores on the platform and identifies cross-network opportunities:

- Store A buys product X at 5 USD → Rex knows
- Supplier B (also on Stocky) sells product X at 4 USD → Rex knows
- Rex surfaces the match → platform owner facilitates the deal → store saves money, supplier gets a new client

Same logic applies to:
- Delivery companies on Stocky with better rates for specific cities
- Products with high return rates across stores → better supplier exists on the network
- A store struggling with a city → another courier on the platform serves it better

### Why this matters for how we build

- **Store profiles / Rex memory** are not just for UX — they are the raw data for ecosystem intelligence
- Every data point Rex collects per store feeds the network-level analysis
- The platform owner (you) uses Rex at the ecosystem level to spot and facilitate deals
- Stores never see each other's data — they only experience a smarter Rex

### What this means for architecture decisions
- Store profile files (one per store) need to be structured so they can be read both by Rex for that store AND aggregated across stores by you
- Rex will eventually need a `super_admin` mode — same brain, ecosystem-wide context
- Every feature built for Rex should be evaluated at both levels: "how does this help the store owner?" AND "how does this data feed the ecosystem?"

### Sub-agents at the ecosystem level
Each agent owns their domain across ALL stores — not just one:
- **Hassan** → pricing patterns, margin benchmarks across stores
- **Karima** → best-selling products network-wide, stock trends
- **Youssef** → courier performance per city across all stores (who really delivers best in Casablanca?)
- **Hamza** → which ad platforms/campaigns work best per product category
- **Omar** → cross-store analytics, city demand patterns, product trends

At ecosystem level, Rex asks the same agents — they just query across all stores instead of one.
This means splitting the work across agents is not just good architecture, it's the foundation of the ecosystem intelligence.

### Platform owner superpowers (you, via super_admin Rex)
- "What Facebook campaigns are converting best in Casablanca right now?" → Hamza answers across all stores
- "What's the winning product in Marrakech this month?" → Omar answers across all stores
- "Which supplier has the best margins for product X?" → Hassan answers across all stores
- "Which courier has the best delivery rate in the North?" → Youssef answers across all stores

You see what no individual store can see. Each store contributes data. You hold the full picture.

### Potential monetization paths (noted, not built yet)
- Facilitate deals between stores and suppliers/couriers on the network (take a cut)
- Sell winning product / regional trend reports to stores
- Premium Rex tier: "your delivery rate vs platform average" benchmarking
- Regional ad intelligence: which campaigns work per city/product category
