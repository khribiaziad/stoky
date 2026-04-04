"""Hamza — Snapchat Ads platform integration."""

import httpx
from integrations.platforms.base import BaseAdPlatformIntegration

SNAPCHAT_API_BASE = "https://adsapi.snapchat.com/v1"


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


class SnapchatIntegration(BaseAdPlatformIntegration):

    def is_connected(self, db, store_id: int) -> bool:
        token = _get_setting(db, "snapchat_access_token", store_id)
        account_id = _get_setting(db, "snapchat_ad_account_id", store_id)
        return bool(token and account_id)

    def get_spend(self, db, store_id: int, start: str, end: str) -> float:
        """Fetch real ad spend from Snapchat Marketing API. Returns total in MAD."""
        from services.calculations import _get_usd_rate

        token = _get_setting(db, "snapchat_access_token", store_id)
        account_id = _get_setting(db, "snapchat_ad_account_id", store_id)

        if not token or not account_id:
            return 0.0

        usd_rate = _get_usd_rate(db, store_id)

        # Fetch all campaign IDs first
        camps_r = httpx.get(
            f"{SNAPCHAT_API_BASE}/adaccounts/{account_id}/campaigns",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        camps_r.raise_for_status()

        camp_ids = [
            item["campaign"]["id"]
            for item in camps_r.json().get("campaigns", [])
            if item.get("campaign", {}).get("id")
        ]

        total_micro = 0
        for camp_id in camp_ids:
            stats_r = httpx.get(
                f"{SNAPCHAT_API_BASE}/campaigns/{camp_id}/stats",
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "granularity": "TOTAL",
                    "fields": "spend",
                    "start_time": f"{start}T00:00:00.000-0000",
                    "end_time": f"{end}T23:59:59.999-0000",
                },
                timeout=15,
            )
            if stats_r.status_code != 200:
                continue
            for item in stats_r.json().get("timeseries_stats", []):
                for entry in item.get("timeseries_stat", {}).get("timeseries", []):
                    total_micro += entry.get("stats", {}).get("spend", 0) or 0

        total_usd = total_micro / 1_000_000
        return total_usd * usd_rate
