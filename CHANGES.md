# Stocky — Change Log

All changes on the `redesign` branch. Most recent first.

---

## Pending Approval
_Nothing pending._

---

## Done — Not yet merged to main

### 2026-04-09
**Fix lead confirm 500: duplicate expense creation**
- File: `backend/routers/leads.py`
- Removed redundant `get_or_create_expense()` call on line 334. `create_order` already creates the expense inside `order_service`. The duplicate call hit a unique constraint on `order_expenses.order_id` before the session refreshed the relationship.
- Risk: Low (deletion only, no logic change)
- Test: Confirm a lead — no 500 error, expense row created once.


**Orders: table-only refresh on filter/tab switch**
- File: `frontend/src/pages/Orders.jsx`
- Added `loadOrders()` — fetches only orders. `load()` now only runs on initial mount (fetches products, packs, offers, promos too).
- All filter switches, tab changes, pagination, post-action refreshes use `loadOrders()`.
- Risk: Low
- Test: Switch between All / Pending / Delivered — table updates without full page flash.

### 2026-04-08
**Fix confirmed_by FK in orders router**
- File: `backend/routers/orders.py`
- `order.confirmed_by = user.id` → `user.team_member_id`
- `confirmed_by` references `team_members.id`, not `users.id`. Was causing FK violation on PostgreSQL when marking order as delivered.
- Risk: Low (same fix as leads.py, same root cause)
- Test: Mark an order as delivered — no 500 error.

**Fix order status transition matrix**
- File: `backend/services/order_service.py`
- Added `awaiting_pickup` (was completely missing — blocked all courier-dispatched orders)
- Added missing transitions: `pending → awaiting_pickup`, `awaiting_pickup → in_delivery/pending/cancelled`, `in_delivery → cancelled`, `no_answer/reported → pending`, `delivered → pending`, `lost → pending`
- Risk: Medium — read all callers, stock restoration only on cancelled/returned (unchanged)
- Test: Change order status through all stages including delivered → pending.

**Fix lead confirm 500**
- File: `backend/routers/leads.py`
- `order.confirmed_by = user.id` → `user.team_member_id` (same FK bug)
- Risk: Low
- Test: Confirm a lead — order created without 500 error.

**Add permissions column migration**
- File: `backend/main.py`
- Added `ALTER TABLE team_members ADD COLUMN permissions JSON` to migration block
- Risk: Low (additive only)
- Test: Deploy — no startup error.

### 2026-04-07
**Per-member permissions system**
- Files: `backend/models.py`, `backend/routers/team.py`, `backend/routers/auth.py`, `frontend/src/api.js`, `frontend/src/pages/Team.jsx`, `frontend/src/App.jsx`
- TeamMember gets a `permissions` JSON column. Admin can set per-page view/edit access via a modal on the Team page. Permissions load on login and filter nav + readOnly props.
- Risk: Medium
- Test: Create a team member account, set permissions, log in as them — verify nav and readOnly behavior.

**Keep-alive hook**
- File: `frontend/src/App.jsx`
- After 5 min idle, pings `/api/health` after a random 1–9 min delay to prevent Render server sleep.
- Risk: Low
- Test: Leave tab idle — server stays warm.

**Low Stock tab on Stock page**
- Files: `frontend/src/pages/Stock.jsx`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/App.jsx`
- New tab showing variants at/below threshold. Inline quick-arrival with paid checkbox per row. Deep-link from Dashboard alert bar and bento card.
- Risk: Low
- Test: Click low stock alert on Dashboard → lands on Low Stock tab. Add arrival → row disappears when stock clears threshold.

**Rolling date ranges**
- File: `backend/core/date_ranges.py`
- `this_month` → rolling 30 days (was calendar month, reset to 0 at month start)
- `this_week` → rolling 7 days (was calendar Monday)
- Risk: Low (no schema change)
- Test: Check reports/dashboard with "This Month" — shows last 30 days of data.

**Redesign v3 — purple dark theme**
- Files: `frontend/src/index.css`, `frontend/src/App.jsx`, `frontend/src/pages/Dashboard.jsx`, `frontend/index.html`
- New UI: purple accent (#7C6AF7), Geist font, hero card, pipeline strip, bento grid, grouped sidebar with section labels.
- Risk: Low (frontend only)
- Test: Visual review on desktop and mobile.

---

## Reverted
**delivered → pending transition (2026-04-08)**
- Was added without understanding stock implications, immediately reverted.
- Later re-added correctly as part of the full transition matrix fix.
