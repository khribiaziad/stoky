"""Fatima — base interface for all e-commerce platform webhook integrations."""

import logging
from abc import ABC, abstractmethod

from sqlalchemy.orm import Session

import models
from routers.leads import _match_items
from services import expense_service

log = logging.getLogger(__name__)


def _create_lead_from_data(db: Session, store_id: int, normalised: dict) -> models.Lead:
    """Create a Lead row from a normalised platform payload dict."""
    raw_items = normalised.get("raw_items") or []
    matched, matched_total = _match_items(raw_items, store_id, db)

    # City resolution: DB lookup beats raw form value
    city    = normalised.get("customer_city") or ""
    address = normalised.get("customer_address") or ""
    if address:
        all_cities = db.query(models.City).all()
        addr_lower = address.lower()
        for c in all_cities:
            if c.name.lower() in addr_lower:
                city = c.name
                break

    total = normalised.get("total") or 0.0

    lead = models.Lead(
        store_id=store_id,
        customer_name=normalised.get("customer_name") or "Unknown",
        customer_phone=normalised.get("customer_phone") or "",
        customer_email=normalised.get("customer_email") or "",
        customer_city=city,
        customer_address=address,
        raw_items=raw_items,
        matched_items=matched if matched else None,
        total_amount=total or matched_total or None,
        notes=normalised.get("notes") or "",
        source=normalised.get("source") or "website",
        status="pending",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


class BaseOrderNormaliser(ABC):
    """
    Abstract base for converting external platform order payloads into
    Stocky's internal order schema.

    Subclasses must implement:
        parse_webhook(payload)    — accepts a raw dict from the platform webhook;
                                    returns a normalised dict, or None to skip
        validate_webhook(payload) — returns False to discard this webhook
                                    (e.g. wrong status on WooCommerce)

    Concrete method provided:
        process_webhook(db, store_id, payload) — validate → parse → create lead
    """

    @abstractmethod
    def parse_webhook(self, payload: dict) -> dict:
        """Parse raw platform payload into Stocky's normalised lead dict."""

    @abstractmethod
    def validate_webhook(self, payload: dict) -> bool:
        """Return False to skip this webhook without creating a lead."""

    def process_webhook(self, db: Session, store_id: int, payload: dict):
        """Validate → parse → create lead. Returns the Lead or None if skipped."""
        if not self.validate_webhook(payload):
            return None
        normalised = self.parse_webhook(payload)
        if normalised is None:
            return None
        lead = _create_lead_from_data(db, store_id, normalised)
        # Bug #194: if this webhook ever creates a confirmed order directly,
        # ensure it gets an expense row (defensive — currently a no-op since
        # process_webhook always creates pending leads, not orders)
        if lead and getattr(lead, "order_id", None):
            expense_service.get_or_create_expense(db, lead)
        return lead
