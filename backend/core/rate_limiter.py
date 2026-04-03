"""
Simple in-memory rate limiter for FastAPI endpoints.

Uses a per-IP sliding window counter stored in a module-level dict.
Suitable for single-process deployments (Render free tier, single Uvicorn worker).
Not suitable for multi-worker or multi-instance deployments without a shared
cache — use Redis-backed rate limiting in that case.

Usage:
    from core.rate_limiter import rate_limit

    @router.post("/login")
    def login(
        request: Request,
        data: LoginInput,
        _: None = Depends(rate_limit(max_attempts=10, window_seconds=60)),
    ):
        ...

The dependency raises HTTP 429 if the caller's IP has exceeded max_attempts
within the rolling window_seconds window. It resolves to None on success.
"""

import time
from collections import defaultdict, deque
from fastapi import Depends, HTTPException, Request


# Module-level store: {(ip, endpoint_key): deque of timestamps}
_request_log: dict = defaultdict(deque)


def rate_limit(max_attempts: int, window_seconds: int):
    """
    Returns a FastAPI dependency that enforces a sliding-window rate limit.

    Tracks requests by client IP (X-Forwarded-For if behind a proxy, else
    request.client.host). Each unique (IP, endpoint) pair has its own counter.

    Args:
        max_attempts:    Maximum number of requests allowed in the window.
        window_seconds:  Length of the sliding window in seconds.

    Raises HTTP 429 with a Retry-After header if the limit is exceeded.

    Example: rate_limit(max_attempts=5, window_seconds=60) allows 5 calls
    per IP per minute before blocking.
    """
    def dependency(request: Request):
        ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown")
        )
        key = (ip, request.url.path)
        now = time.monotonic()
        window = _request_log[key]

        # Drop timestamps outside the window
        while window and window[0] < now - window_seconds:
            window.popleft()

        if len(window) >= max_attempts:
            raise HTTPException(
                status_code=429,
                detail="Too many requests — please try again later",
                headers={"Retry-After": str(window_seconds)},
            )

        window.append(now)
        return None

    return dependency
