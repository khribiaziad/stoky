"""Hamza — Meta (Facebook/Instagram) ad platform integration."""

import httpx
from integrations.platforms.base import BaseAdPlatformIntegration

META_GRAPH_URL = "https://graph.facebook.com/v19.0"


def _get_setting(db, key: str, store_id: int):
    """Read a single AppSettings value for a store. Returns None if unset."""
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


class MetaIntegration(BaseAdPlatformIntegration):

    def is_connected(self, db, store_id: int) -> bool:
        """Return True if a non-empty meta_access_token is stored for this store."""
        token = _get_setting(db, "meta_access_token", store_id)
        return bool(token)

    def get_spend(self, db, store_id: int, start: str, end: str) -> float:
        """Fetch real ad spend from the Meta Graph API and return the total in MAD.

        Steps:
        1. Read meta_access_token and meta_ad_account_id from AppSettings.
        2. Read usd_rate from AppSettings via Hassan's _get_usd_rate helper.
        3. Call GET /{account_id}/insights with fields=spend,
           time_range={since: start, until: end}, level=account.
        4. Sum all spend values, convert USD → MAD using the real usd_rate.
        5. Return total MAD spend.

        Raises on any API or parsing failure — get_spend_safe catches it.

        Args:
            db: Database session.
            store_id: Store owner's user_id.
            start: ISO date string "YYYY-MM-DD" (range start, inclusive).
            end: ISO date string "YYYY-MM-DD" (range end, inclusive).

        Returns:
            Total spend in MAD as a float.
        """
        from services.calculations import _get_usd_rate

        token      = _get_setting(db, "meta_access_token",    store_id)
        account_id = _get_setting(db, "meta_ad_account_id",   store_id)

        if not token or not account_id:
            return 0.0

        usd_rate = _get_usd_rate(db, store_id)

        # Ensure account_id is prefixed with "act_" as required by Meta Graph API
        if not account_id.startswith("act_"):
            account_id = f"act_{account_id}"

        params = {
            "fields":     "spend",
            "time_range": f'{{"since":"{start}","until":"{end}"}}',
            "level":      "account",
            "access_token": token,
        }

        r = httpx.get(
            f"{META_GRAPH_URL}/{account_id}/insights",
            params=params,
            timeout=15,
        )
        r.raise_for_status()

        data = r.json()
        total_usd = sum(
            float(entry.get("spend") or 0)
            for entry in data.get("data", [])
        )
        return total_usd * usd_rate
