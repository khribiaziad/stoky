"""Hamza — Pinterest Ads platform integration."""

import httpx
from integrations.platforms.base import BaseAdPlatformIntegration

PINTEREST_API_BASE = "https://api.pinterest.com/v5"


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


class PinterestIntegration(BaseAdPlatformIntegration):

    def is_connected(self, db, store_id: int) -> bool:
        token = _get_setting(db, "pinterest_access_token", store_id)
        account_id = _get_setting(db, "pinterest_ad_account_id", store_id)
        return bool(token and account_id)

    def get_spend(self, db, store_id: int, start: str, end: str) -> float:
        """Fetch real ad spend from Pinterest Ads API. Returns total in MAD."""
        from services.calculations import _get_usd_rate

        token = _get_setting(db, "pinterest_access_token", store_id)
        account_id = _get_setting(db, "pinterest_ad_account_id", store_id)

        if not token or not account_id:
            return 0.0

        usd_rate = _get_usd_rate(db, store_id)

        # Fetch campaign IDs
        camps_r = httpx.get(
            f"{PINTEREST_API_BASE}/ad_accounts/{account_id}/campaigns",
            headers={"Authorization": f"Bearer {token}"},
            params={"page_size": 100},
            timeout=15,
        )
        camps_r.raise_for_status()

        campaign_ids = [c.get("id") for c in camps_r.json().get("items", []) if c.get("id")]
        if not campaign_ids:
            return 0.0

        r = httpx.get(
            f"{PINTEREST_API_BASE}/ad_accounts/{account_id}/campaigns/analytics",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "campaign_ids": campaign_ids,
                "start_date": start,
                "end_date": end,
                "columns": "SPEND_IN_DOLLAR",
                "granularity": "TOTAL",
            },
            timeout=15,
        )
        r.raise_for_status()

        rows = r.json()
        total_usd = sum(
            float(row.get("SPEND_IN_DOLLAR", 0) or 0)
            for row in (rows if isinstance(rows, list) else [])
        )
        return total_usd * usd_rate
