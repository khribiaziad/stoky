"""Hamza — Pinterest Ads platform integration."""

from integrations.platforms.base import BaseAdPlatformIntegration


class PinterestIntegration(BaseAdPlatformIntegration):
    """Pinterest Ads spend integration.

    Reads pinterest_access_token and pinterest_ad_account_id from AppSettings.
    Calls the Pinterest Ads API to fetch real spend in USD, converts to MAD.
    """

    def is_connected(self, db, store_id: int) -> bool:
        # TODO: implement — read pinterest_access_token from AppSettings
        raise NotImplementedError

    def get_spend(self, db, store_id: int, start: str, end: str) -> float:
        # TODO: implement — call Pinterest Ads API /ad_accounts/{id}/reports/
        raise NotImplementedError
