"""Fatima — YouCan e-commerce platform integration."""

from integrations.ecommerce.base import BaseOrderNormaliser


class YouCanIntegration(BaseOrderNormaliser):
    """YouCan webhook normaliser.

    Reads variants array; resolves city from shipping_address or shipping.address.
    """

    def validate_webhook(self, payload: dict) -> bool:
        return True  # YouCan only fires on new orders

    def parse_webhook(self, payload: dict) -> dict:
        customer   = payload.get("customer") or {}
        first_name = customer.get("first_name", "")
        last_name  = customer.get("last_name", "")
        full_name  = f"{first_name} {last_name}".strip() or "Unknown"
        phone      = customer.get("phone", "")

        addr_obj = (
            payload.get("shipping_address")
            or (payload.get("shipping") or {}).get("address")
            or {}
        )
        if isinstance(addr_obj, list):
            addr_obj = addr_obj[0] if addr_obj else {}

        city    = addr_obj.get("city", "")
        region  = addr_obj.get("region", "")
        address = " ".join(filter(None, [
            addr_obj.get("first_line", ""),
            addr_obj.get("second_line", ""),
        ]))
        if not phone:
            phone = addr_obj.get("phone", "")

        variants  = payload.get("variants") or []
        raw_items = []
        for v in variants:
            name    = ""
            product = v.get("product") or {}
            if product:
                name = product.get("name", "")
            if not name:
                name = v.get("name", "")
            qty = v.get("quantity", 1)
            if name:
                raw_items.append({"product_name": name, "quantity": qty})

        total = float(payload.get("total") or 0)

        return {
            "customer_name":    full_name,
            "customer_phone":   phone,
            "customer_email":   customer.get("email", ""),
            "customer_city":    city or region,
            "customer_address": address,
            "raw_items":        raw_items,
            "total":            total,
            "notes":            f"YouCan order #{payload.get('ref', '')}",
            "source":           "youcan",
        }
