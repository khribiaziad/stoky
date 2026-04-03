"""Hamza — Snapchat Ads platform integration."""

from integrations.platforms.base import BaseAdPlatformIntegration


class SnapchatIntegration(BaseAdPlatformIntegration):
    """Snapchat Ads spend integration.

    Reads snapchat_access_token and snapchat_ad_account_id from AppSettings.
    Calls the Snapchat Marketing API to fetch real spend in USD, converts to MAD.
    """

    def is_connected(self, db, store_id: int) -> bool:
        # TODO: implement — read snapchat_access_token from AppSettings
        raise NotImplementedError

    def get_spend(self, db, store_id: int, start: str, end: str) -> float:
        # TODO: implement — call Snapchat Marketing API /adaccounts/{id}/stats/
        raise NotImplementedError
