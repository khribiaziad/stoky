"""Youssef — Olivraison courier integration."""

from integrations.couriers.base import BaseCourierIntegration

# Status keyword lists — identical to the shared mapping in routers/forcelog.py
_DELIVERED_KEYWORDS   = ["livré", "livre", "delivered", "confirmé par livreur", "livraison effectuée"]
_CANCELLED_KEYWORDS   = ["annulé", "annule", "retour", "refusé", "refuse", "cancelled",
                          "retourné", "retourne", "echec", "échoué"]
_IN_DELIVERY_KEYWORDS = ["appel", "call", "en route", "enroute", "route", "transit", "ramassage",
                          "pickup", "tentative", "expédié", "expedie", "injoignable", "vocal",
                          "sms", "whatsapp", "réponse", "reponse", "reporté", "reporte"]

# Forcelog-origin uppercase statuses also used by Olivraison mapping
_FORCELOG_DELIVERED = {"DELIVERED"}
_FORCELOG_CANCELLED = {"RETURNED", "CANCELLED", "REFUSED", "LOST"}


class OlivIntegration(BaseCourierIntegration):

    def map_status(self, raw_status: str) -> str | None:
        """Map an Olivraison status string to a Stocky order status.

        Uses the same keyword table as Forcelog so a single shared mapping
        covers both couriers — identical to routers/forcelog._map_status.
        Returns None if the status should be ignored (no order state change).
        """
        if raw_status in _FORCELOG_DELIVERED:
            return "delivered"
        if raw_status in _FORCELOG_CANCELLED:
            return "cancelled"
        s = raw_status.lower()
        if any(k in s for k in _DELIVERED_KEYWORDS):
            return "delivered"
        if any(k in s for k in _CANCELLED_KEYWORDS):
            return "cancelled"
        if any(k in s for k in _IN_DELIVERY_KEYWORDS):
            return "in_delivery"
        return None

    def parse_webhook_payload(self, payload: dict) -> dict:
        """Extract tracking_id and status from an Olivraison webhook payload.

        Olivraison sends a flat JSON object. The tracking ID may arrive under
        several keys depending on the API version.
        Returns empty dict if tracking_id is missing (event will be ignored).
        """
        tracking_id = (
            payload.get("trackingID")
            or payload.get("tracking_id")
            or payload.get("id")
        )
        if not tracking_id:
            return {}
        status_raw = str(payload.get("status") or payload.get("statut") or "").strip()
        return {"tracking_id": tracking_id, "status_raw": status_raw, "display_status": status_raw}
