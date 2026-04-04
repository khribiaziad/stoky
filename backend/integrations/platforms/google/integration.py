"""Hamza — Google Ads platform integration."""

import httpx
from integrations.platforms.base import BaseAdPlatformIntegration

GOOGLE_ADS_API_BASE = "https://googleads.googleapis.com/v17"


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


def _clean_customer_id(cid: str) -> str:
    return cid.replace("-", "")


class GoogleIntegration(BaseAdPlatformIntegration):

    def is_connected(self, db, store_id: int) -> bool:
        token = _get_setting(db, "google_access_token", store_id)
        customer_id = _get_setting(db, "google_customer_id", store_id)
        dev_token = _get_setting(db, "google_developer_token", store_id)
        return bool(token and customer_id and dev_token)

    def get_spend(self, db, store_id: int, start: str, end: str) -> float:
        """Fetch real ad spend from Google Ads API. Returns total in MAD."""
        from services.calculations import _get_usd_rate

        token = _get_setting(db, "google_access_token", store_id)
        customer_id = _get_setting(db, "google_customer_id", store_id)
        dev_token = _get_setting(db, "google_developer_token", store_id)

        if not token or not customer_id or not dev_token:
            return 0.0

        usd_rate = _get_usd_rate(db, store_id)
        cid = _clean_customer_id(customer_id)

        query = f"""
            SELECT metrics.cost_micros
            FROM campaign
            WHERE segments.date BETWEEN '{start}' AND '{end}'
              AND campaign.status != 'REMOVED'
        """
        r = httpx.post(
            f"{GOOGLE_ADS_API_BASE}/customers/{cid}/googleAds:searchStream",
            headers={
                "Authorization": f"Bearer {token}",
                "developer-token": dev_token,
                "login-customer-id": cid,
                "Content-Type": "application/json",
            },
            json={"query": query},
            timeout=15,
        )
        r.raise_for_status()

        total_usd = 0.0
        for batch in r.json():
            for row in batch.get("results", []):
                total_usd += int(row.get("metrics", {}).get("costMicros", 0)) / 1_000_000

        return total_usd * usd_rate
