"""Fatima — Shopify e-commerce platform integration."""

from integrations.ecommerce.base import BaseOrderNormaliser


class ShopifyIntegration(BaseOrderNormaliser):
    """Shopify webhook normaliser.

    Reads line_items; pulls customer from shipping_address/billing_address/customer.
    No status filtering — all orders/create events are processed.
    """

    def validate_webhook(self, payload: dict) -> bool:
        return True  # No status filter — Shopify sends only on orders/create

    def parse_webhook(self, payload: dict) -> dict:
        shipping   = payload.get("shipping_address") or payload.get("billing_address") or {}
        customer   = payload.get("customer") or {}

        first_name = shipping.get("first_name") or customer.get("first_name", "")
        last_name  = shipping.get("last_name")  or customer.get("last_name", "")
        full_name  = f"{first_name} {last_name}".strip() or customer.get("email", "Unknown")
        phone      = shipping.get("phone") or customer.get("phone") or payload.get("phone", "")
        email      = customer.get("email", "")
        city       = shipping.get("city", "")
        address    = " ".join(filter(None, [
            shipping.get("address1", ""),
            shipping.get("address2", ""),
        ]))

        raw_items = []
        for item in (payload.get("line_items") or []):
            name = item.get("name") or item.get("title", "")
            qty  = item.get("quantity", 1)
            if name:
                raw_items.append({"product_name": name, "quantity": qty})

        total     = float(payload.get("total_price") or 0)
        order_ref = payload.get("order_number") or payload.get("name") or payload.get("id", "")

        return {
            "customer_name":    full_name,
            "customer_phone":   phone,
            "customer_email":   email,
            "customer_city":    city,
            "customer_address": address,
            "raw_items":        raw_items,
            "total":            total,
            "notes":            f"Shopify order #{order_ref}",
            "source":           "shopify",
        }
