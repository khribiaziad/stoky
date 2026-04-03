"""Hamza — TikTok Ads platform integration."""

from integrations.platforms.base import BaseAdPlatformIntegration


class TikTokIntegration(BaseAdPlatformIntegration):
    """TikTok Ads spend integration.

    Reads tiktok_access_token and tiktok_advertiser_id from AppSettings.
    Calls the TikTok Marketing API to fetch real spend in USD, converts to MAD.
    """

    def is_connected(self, db, store_id: int) -> bool:
        # TODO: implement — read tiktok_access_token from AppSettings
        raise NotImplementedError

    def get_spend(self, db, store_id: int, start: str, end: str) -> float:
        # TODO: implement — call TikTok Marketing API /reports/integrated/get/
        raise NotImplementedError
