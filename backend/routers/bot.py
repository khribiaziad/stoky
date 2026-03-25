import os
import secrets
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user, get_store_id, create_token
from database import get_db
import models

router = APIRouter(prefix="/bot", tags=["bot"])

BOT_URL    = os.environ.get("BOT_SERVICE_URL", "http://localhost:3001")
BOT_SECRET = os.environ.get("BOT_SECRET", "")
STOCKY_URL = os.environ.get("RENDER_EXTERNAL_URL", "http://localhost:8000")

_HEADERS = {"x-bot-secret": BOT_SECRET}
_TIMEOUT = 10


def _url(path: str) -> str:
    return f"{BOT_URL}{path}"


async def _get_or_create_api_key(sid: int, db: Session) -> str:
    record = db.query(models.StoreApiKey).filter(
        models.StoreApiKey.store_id == sid
    ).first()
    if not record:
        record = models.StoreApiKey(store_id=sid, key=secrets.token_urlsafe(32))
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
    api_key = await _get_or_create_api_key(sid, db)
    token = create_token(sid)  # 30-day Stocky auth token for the bot

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                _url(f"/sessions/{sid}/connect"),
                json={"stockyUrl": STOCKY_URL, "token": token, "apiKey": api_key},
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
