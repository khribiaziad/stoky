"""Aggregated ad spend summary across all connected platforms.
Delegates all spend fetching to Hamza's integration classes.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models

from integrations.platforms.meta.integration import MetaIntegration
from integrations.platforms.tiktok.integration import TikTokIntegration
from integrations.platforms.snapchat.integration import SnapchatIntegration
from integrations.platforms.pinterest.integration import PinterestIntegration
from integrations.platforms.google.integration import GoogleIntegration

router = APIRouter(prefix="/ads", tags=["ads"])

_PLATFORMS = [
    {"key": "meta",      "label": "Meta (Facebook/Instagram)", "color": "#1877f2", "cls": MetaIntegration},
    {"key": "tiktok",    "label": "TikTok",                    "color": "#010101", "cls": TikTokIntegration},
    {"key": "snapchat",  "label": "Snapchat",                  "color": "#FFFC00", "cls": SnapchatIntegration},
    {"key": "pinterest", "label": "Pinterest",                 "color": "#E60023", "cls": PinterestIntegration},
    {"key": "google",    "label": "Google Ads",                "color": "#4285f4", "cls": GoogleIntegration},
]


@router.get("/spend-summary")
def ads_spend_summary(
    start: str,
    end: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Aggregate real ad spend across all connected platforms for a date range."""
    from services.calculations import _get_usd_rate
    usd_rate = _get_usd_rate(db, user.id)

    result = []
    total_mad = 0.0

    for p in _PLATFORMS:
        integration = p["cls"]()
        connected = integration.is_connected(db, user.id)
        spend_mad = 0.0
        error = None
        if connected:
            spend_mad = integration.get_spend_safe(db, user.id, start, end)
            # get_spend_safe already returns MAD and never raises
        spend_usd = round(spend_mad / usd_rate, 2) if usd_rate else 0.0
        total_mad += spend_mad
        result.append({
            "platform": p["key"],
            "label": p["label"],
            "color": p["color"],
            "connected": connected,
            "spend_usd": spend_usd,
            "spend_mad": round(spend_mad, 2),
            "error": error,
        })

    return {
        "platforms": result,
        "total_mad": round(total_mad, 2),
        "usd_rate": usd_rate,
        "start": start,
        "end": end,
    }
