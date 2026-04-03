# Stoky Bot System — Context for Claude

## What it is
The bot system connects a Stoky store to WhatsApp so customers can receive automated order confirmation messages and reply YES/NO to confirm or cancel their COD order.

It is split into two parts:
1. **`routers/bot.py`** — Stoky's backend bridge (this repo)
2. **Bot microservice** — a separate Node.js service running at `BOT_SERVICE_URL` (default: `http://localhost:3001`, configured via env var)

Stoky's backend does NOT handle WhatsApp messages directly. It only manages the connection to the bot service.

---

## Architecture

```
Store owner (browser)
    │
    │ POST /api/bot/connect
    ▼
routers/bot.py  ──────────────────────►  Bot microservice (Node.js, port 3001)
    │                                         │
    │  passes: stockyUrl, token, apiKey       │  opens WhatsApp Web session
    │                                         │  waits for QR scan
    │                                         │
    │  GET /api/bot/qr                        │  returns QR image
    ◄─────────────────────────────────────────┘
    │
    │  (store owner scans QR with their WhatsApp)
    │
    │  Bot is now live — messages flow through the bot service
    │
    │  Bot calls back to Stoky via:
    │    POST /api/leads/inbound?api_key=STORE_KEY
    │    (creates leads from customer messages)
```

---

## routers/bot.py — Endpoints

| Method | Path | What it does |
|--------|------|-------------|
| `POST` | `/api/bot/connect` | Registers this store with the bot service. Passes Stoky's URL, a 30-day auth token, and the store's API key so the bot can call back to create leads. |
| `GET` | `/api/bot/status` | Proxies to bot service → returns `{status: "connected" / "disconnected"}` |
| `GET` | `/api/bot/qr` | Proxies to bot service → returns QR code data for WhatsApp Web scan |
| `DELETE` | `/api/bot/disconnect` | Kills the WhatsApp session for this store |

All endpoints require an authenticated Stoky user (`get_current_user`).
Service-to-service calls use the `x-bot-secret` header (env: `BOT_SECRET`).

---

## Key env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `BOT_SERVICE_URL` | `http://localhost:3001` | Where the bot microservice runs |
| `BOT_SECRET` | `""` | Shared secret for Stoky ↔ bot service auth |
| `RENDER_EXTERNAL_URL` | `http://localhost:8000` | Stoky's public URL, passed to bot so it knows where to send callbacks |

---

## What the bot service does (not in this repo)
- Opens a WhatsApp Web session per store (identified by `store_id`)
- Sends confirmation messages to customers when a new lead arrives
- Listens for customer replies (YES → confirm lead, NO → cancel lead)
- Calls `POST /api/leads/inbound?api_key=...` to create leads from inbound WhatsApp orders
- Manages QR code generation and session persistence

---

## What routers/bot.py does NOT do
- Does not send WhatsApp messages
- Does not read customer replies
- Does not create or update leads directly
- Does not store any WhatsApp session state

---

## Related files
- `routers/leads.py` — `inbound_lead` endpoint that the bot calls back to create leads
- `models.StoreApiKey` — the API key the bot uses to authenticate its callbacks
- `auth.create_token(sid)` — generates the 30-day token passed to the bot on connect
