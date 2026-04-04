"""Hamza — TikTok Ads platform integration."""

import httpx
from integrations.platforms.base import BaseAdPlatformIntegration

TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3"


def _get_setting(db, key: str, store_id: int):
    import models
    row = (
        db.query(models.AppSettings)
        .filter(
            models.AppSettings.key == key,
            models.AppSettings.user_id == store_id,
        )
        .first()
    )
    return row.value if (row and row.value) else None


class TikTokIntegration(BaseAdPlatformIntegration):

    def is_connected(self, db, store_id: int) -> bool:
        token = _get_setting(db, "tiktok_access_token", store_id)
        advertiser_id = _get_setting(db, "tiktok_advertiser_id", store_id)
        return bool(token and advertiser_id)

    def get_spend(self, db, store_id: int, start: str, end: str) -> float:
        """Fetch real ad spend from TikTok Marketing API. Returns total in MAD."""
        from services.calculations import _get_usd_rate

        token = _get_setting(db, "tiktok_access_token", store_id)
        advertiser_id = _get_setting(db, "tiktok_advertiser_id", store_id)

        if not token or not advertiser_id:
            return 0.0

        usd_rate = _get_usd_rate(db, store_id)

        resp = httpx.post(
            f"{TIKTOK_API_BASE}/report/integrated/get/",
            headers={"Access-Token": token, "Content-Type": "application/json"},
            json={
                "advertiser_id": advertiser_id,
                "report_type": "BASIC",
                "dimensions": ["campaign_id"],
                "metrics": ["spend"],
                "start_date": start,
                "end_date": end,
                "page_size": 100,
            },
            timeout=15,
        )
        resp.raise_for_status()

        body = resp.json()
        if body.get("code", -1) != 0:
            raise ValueError(body.get("message", "TikTok API error"))

        rows = body.get("data", {}).get("list", [])
        total_usd = sum(float(r.get("metrics", {}).get("spend", 0)) for r in rows)
        return total_usd * usd_rate
