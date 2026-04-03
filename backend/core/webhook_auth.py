"""
Reusable webhook authentication dependencies for FastAPI endpoints.

Both factories return a FastAPI dependency (a callable) that can be passed
directly to Depends(). They read the shared secret from AppSettings in the DB,
keyed as "{courier_name}_webhook_secret".

Usage:
    from core.webhook_auth import hmac_auth, secret_auth

    # HMAC SHA256 — for couriers that sign the payload (e.g. Forcelog)
    @router.post("/webhook")
    async def my_webhook(
        request: Request,
        db: Session = Depends(get_db),
        _: None = Depends(hmac_auth("forcelog")),
    ):
        body = await request.body()
        ...

    # Shared secret — for couriers that send a static token in a header (e.g. Olivraison)
    @router.post("/webhook")
    async def my_webhook(
        request: Request,
        db: Session = Depends(get_db),
        _: None = Depends(secret_auth("olivraison")),
    ):
        ...

The dependency resolves to None on success. On failure it raises HTTP 401.
"""

import hmac as _hmac
import hashlib
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
import models


def hmac_auth(courier_name: str):
    """
    Returns a FastAPI dependency that validates HMAC SHA256 webhook signatures.

    Expects the incoming request to carry an 'X-{Courier}-Signature' header
    (case-insensitive lookup via the courier_name argument) in the format:
        sha256=<hex_digest>

    The secret is loaded from AppSettings where key="{courier_name}_webhook_secret".
    The check iterates all store secrets so a single global webhook URL can serve
    multiple stores — it passes if any store's secret matches.

    Raises HTTP 401 if:
      - The signature header is missing entirely.
      - No store has a configured webhook secret for this courier.
      - The signature does not match any configured store secret.

    Example: hmac_auth("forcelog") reads AppSettings key "forcelog_webhook_secret"
    and validates against the "X-Forcelog-Signature" header.
    """
    header_name = f"X-{courier_name.capitalize()}-Signature"
    settings_key = f"{courier_name}_webhook_secret"

    async def dependency(request: Request, db: Session = Depends(get_db)):
        sig_header = request.headers.get(header_name, "")
        if not sig_header:
            raise HTTPException(status_code=401, detail=f"Missing {header_name} header")

        body = await request.body()
        store_secrets = (
            db.query(models.AppSettings)
            .filter_by(key=settings_key)
            .all()
        )
        if not store_secrets:
            raise HTTPException(status_code=401, detail="Webhook secret not configured")

        for s in store_secrets:
            if not s.value:
                continue
            expected = "sha256=" + _hmac.new(
                s.value.encode(), body, hashlib.sha256
            ).hexdigest()
            if _hmac.compare_digest(expected, sig_header):
                return None

        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    return dependency


def secret_auth(courier_name: str):
    """
    Returns a FastAPI dependency that validates a static shared-secret webhook token.

    Expects the incoming request to carry an 'X-{Courier}-Secret' header whose
    value must exactly match the secret stored in AppSettings for at least one store.

    The secret is loaded from AppSettings where key="{courier_name}_webhook_secret".
    The check iterates all store secrets so a single global webhook URL can serve
    multiple stores.

    Raises HTTP 401 if:
      - The secret header is missing entirely.
      - No store has a configured webhook secret for this courier.
      - The header value does not match any configured store secret.

    Example: secret_auth("olivraison") reads AppSettings key "olivraison_webhook_secret"
    and validates against the "X-Olivraison-Secret" header.
    """
    header_name = f"X-{courier_name.capitalize()}-Secret"
    settings_key = f"{courier_name}_webhook_secret"

    def dependency(request: Request, db: Session = Depends(get_db)):
        incoming = request.headers.get(header_name, "")
        if not incoming:
            raise HTTPException(status_code=401, detail=f"Missing {header_name} header")

        store_secrets = (
            db.query(models.AppSettings)
            .filter_by(key=settings_key)
            .all()
        )
        if not store_secrets:
            raise HTTPException(status_code=401, detail="Webhook secret not configured")

        for s in store_secrets:
            if not s.value:
                continue
            if _hmac.compare_digest(s.value, incoming):
                return None

        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    return dependency
