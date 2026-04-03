import os
import secrets
import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt as _jwt
from sqlalchemy.orm import Session

from auth import get_current_user, get_store_id
from database import get_db
import models

router = APIRouter(prefix="/bot", tags=["bot"])

BOT_URL    = os.environ.get("BOT_SERVICE_URL", "http://localhost:3001")
STOCKY_URL = os.environ.get("RENDER_EXTERNAL_URL", "http://localhost:8000")

BOT_SECRET = os.environ.get("BOT_SECRET")
if not BOT_SECRET:
    raise RuntimeError("BOT_SECRET environment variable is required. Set it in your .env file.")

BOT_JWT_SECRET = os.environ.get("BOT_JWT_SECRET")
if not BOT_JWT_SECRET:
    raise RuntimeError("BOT_JWT_SECRET environment variable is required. Set it in your .env file.")

_HEADERS = {"x-bot-secret": BOT_SECRET}
_TIMEOUT = 10


def _url(path: str) -> str:
    return f"{BOT_URL}{path}"


def _create_bot_token(store_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=30)
    return _jwt.encode({"sub": str(store_id), "exp": expire, "bot": True}, BOT_JWT_SECRET, algorithm="HS256")


def _get_or_create_bot_key(sid: int, db: Session) -> str:
    record = db.query(models.BotApiKey).filter(
        models.BotApiKey.store_id == sid
    ).first()
    if not record:
        record = models.BotApiKey(store_id=sid, key=secrets.token_urlsafe(32))
        db.add(record)
        db.commit()
        db.refresh(record)
    return record.key


@router.post("/connect")
async def connect_bot(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = get_store_id(user)
    bot_key = _get_or_create_bot_key(sid, db)
    token = _create_bot_token(sid)  # 30-day bot JWT signed with BOT_JWT_SECRET

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                _url(f"/sessions/{sid}/connect"),
                json={"stockyUrl": STOCKY_URL, "token": token, "botKey": bot_key},
                headers=_HEADERS,
                timeout=_TIMEOUT,
            )
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Bot service unavailable: {e}")


@router.get("/status")
async def bot_status(user: models.User = Depends(get_current_user)):
    sid = get_store_id(user)
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                _url(f"/sessions/{sid}/status"),
                headers=_HEADERS,
                timeout=5,
            )
            return resp.json()
        except Exception:
            return {"status": "disconnected"}


@router.get("/qr")
async def bot_qr(user: models.User = Depends(get_current_user)):
    sid = get_store_id(user)
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                _url(f"/sessions/{sid}/qr"),
                headers=_HEADERS,
                timeout=5,
            )
            return resp.json()
        except Exception:
            return {"status": "disconnected"}


@router.delete("/disconnect")
async def disconnect_bot(user: models.User = Depends(get_current_user)):
    sid = get_store_id(user)
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.delete(
                _url(f"/sessions/{sid}"),
                headers=_HEADERS,
                timeout=_TIMEOUT,
            )
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Bot service unavailable: {e}")
