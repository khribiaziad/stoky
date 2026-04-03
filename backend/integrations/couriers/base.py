"""
Youssef — Delivery Coordinator
Every courier integration inherits from BaseCourierIntegration.
Adding a new courier = create a new folder, extend this class, done.
"""

from abc import ABC, abstractmethod


class BaseCourierIntegration(ABC):

    @abstractmethod
    def map_status(self, raw_status: str) -> str | None:
        """Map courier's status string to Stocky status.
        Return one of: delivered, cancelled, returned, in_delivery, no_answer
        Return None if status should be ignored.
        """

    @abstractmethod
    def parse_webhook_payload(self, payload: dict) -> dict:
        """Extract tracking_id and status from courier webhook payload.
        Return: {"tracking_id": str, "status_raw": str, "display_status": str}
        Return empty dict to silently ignore the event.
        """

    def process_webhook(self, db, payload: dict):
        """Shared logic — calls parse_webhook_payload + map_status +
        order_service.change_order_status. Every courier gets this for free."""
        from services.order_service import change_order_status
        from services.expense_service import update_delivery_fees
        import models

        parsed = self.parse_webhook_payload(payload)
        if not parsed:
            return {"ok": True}

        tracking_id = parsed.get("tracking_id")
        status_raw = parsed.get("status_raw", "")
        display = parsed.get("display_status", status_raw)

        order = db.query(models.Order).filter(
            models.Order.tracking_id == tracking_id,
            models.Order.is_deleted == False
        ).first()

        if not order:
            return {"ok": True}

        order.delivery_status = display
        mapped = self.map_status(status_raw)
        if mapped:
            change_order_status(db, order, mapped)

        db.commit()
        return {"ok": True}
