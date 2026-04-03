"""Fatima — WooCommerce e-commerce platform integration."""

from integrations.ecommerce.base import BaseOrderNormaliser

_ACCEPTED_STATUSES = {"pending", "processing", "on-hold", ""}


class WooCommerceIntegration(BaseOrderNormaliser):
    """WooCommerce webhook normaliser.

    Reads line_items; pulls customer from billing/shipping.
    Only processes pending/processing/on-hold orders — all others are silently skipped.
    """

    def validate_webhook(self, payload: dict) -> bool:
        return payload.get("status", "") in _ACCEPTED_STATUSES

    def parse_webhook(self, payload: dict) -> dict:
        billing  = payload.get("billing")  or {}
        shipping = payload.get("shipping") or {}

        first_name = billing.get("first_name") or shipping.get("first_name", "")
        last_name  = billing.get("last_name")  or shipping.get("last_name", "")
        full_name  = f"{first_name} {last_name}".strip() or "Unknown"
        phone      = billing.get("phone")  or shipping.get("phone", "")
        email      = billing.get("email", "")
        city       = billing.get("city")   or shipping.get("city", "")
        address    = " ".join(filter(None, [
            billing.get("address_1")  or shipping.get("address_1", ""),
            billing.get("address_2")  or shipping.get("address_2", ""),
        ]))

        raw_items = []
        for item in (payload.get("line_items") or []):
            name = item.get("name", "")
            qty  = item.get("quantity", 1)
            if name:
                raw_items.append({"product_name": name, "quantity": qty})

        total     = float(payload.get("total") or 0)
        order_ref = payload.get("number") or payload.get("id", "")

        return {
            "customer_name":    full_name,
            "customer_phone":   phone,
            "customer_email":   email,
            "customer_city":    city,
            "customer_address": address,
            "raw_items":        raw_items,
            "total":            total,
            "notes":            f"WooCommerce order #{order_ref}",
            "source":           "woocommerce",
        }
