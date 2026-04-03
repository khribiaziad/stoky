"""
Hamza — Ads Manager
Every ad platform integration inherits from BaseAdPlatformIntegration.
Adding a new platform = create a new folder, extend this class, done.
"""

from abc import ABC, abstractmethod


class BaseAdPlatformIntegration(ABC):

    @abstractmethod
    def get_spend(self, db, store_id: int, start: str, end: str) -> float:
        """Return total spend in MAD for this platform in the date range.
        Always returns MAD — conversion handled inside each integration.
        Returns 0.0 if not connected or no data.
        """

    @abstractmethod
    def is_connected(self, db, store_id: int) -> bool:
        """Return True if this platform has valid credentials for this store."""

    def get_spend_safe(self, db, store_id: int, start: str, end: str) -> float:
        """Calls get_spend with error handling. Returns 0.0 on any failure.
        Every platform gets this for free — never crash Clean Profit on API error.
        """
        try:
            if not self.is_connected(db, store_id):
                return 0.0
            return self.get_spend(db, store_id, start, end)
        except Exception as e:
            import logging
            logging.warning(f"Hamza: {self.__class__.__name__} spend fetch failed: {e}")
            return 0.0
