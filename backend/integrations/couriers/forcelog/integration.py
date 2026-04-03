"""Youssef — Forcelog courier integration."""

from integrations.couriers.base import BaseCourierIntegration

# Status keyword lists — identical to routers/forcelog.py
_DELIVERED_KEYWORDS   = ["livré", "livre", "delivered", "confirmé par livreur", "livraison effectuée"]
_CANCELLED_KEYWORDS   = ["annulé", "annule", "retour", "refusé", "refuse", "cancelled",
                          "retourné", "retourne", "echec", "échoué"]
_IN_DELIVERY_KEYWORDS = ["appel", "call", "en route", "enroute", "route", "transit", "ramassage",
                          "pickup", "tentative", "expédié", "expedie", "injoignable", "vocal",
                          "sms", "whatsapp", "réponse", "reponse", "reporté", "reporte"]

# Forcelog uppercase status constants — identical to routers/forcelog.py
_FORCELOG_DELIVERED = {"DELIVERED"}
_FORCELOG_CANCELLED = {"RETURNED", "CANCELLED", "REFUSED", "LOST"}

# Forcelog event types that carry parcel status updates
_RELEVANT_EVENTS = {"parcel.updated", "parcel.history", "parcel.created"}


class ForcelogIntegration(BaseCourierIntegration):

    def map_status(self, raw_status: str) -> str | None:
        """Map a Forcelog status string to a Stocky order status.

        Checks uppercase constants first (exact match), then falls back to
        case-insensitive keyword search — identical to routers/forcelog._map_status.
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
        """Extract tracking_id and status from a Forcelog webhook payload.

        Forcelog wraps parcel data under a "data" key and gates events behind
        an "event" field. Unsupported event types return an empty dict so
        process_webhook ignores them silently.
        The display_status combines status and secondary_status for the UI.
        """
        event = payload.get("event", "")
        if event not in _RELEVANT_EVENTS:
            return {}

        data = payload.get("data", {})
        parcel_code = data.get("parcel_code")
        if not parcel_code:
            return {}

        status_raw = str(data.get("status") or "").strip()
        secondary  = str(data.get("secondary_status") or "").strip()
        display    = f"{status_raw} — {secondary}" if secondary else status_raw

        return {"tracking_id": parcel_code, "status_raw": status_raw, "display_status": display}
