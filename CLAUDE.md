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
