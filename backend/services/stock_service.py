"""Karima's stock ledger. Every stock change goes through here."""
import logging
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

import models

logger = logging.getLogger(__name__)


def deduct_stock(db: Session, items: list, warehouse_id: Optional[int] = None) -> None:
    """Deduct stock for each item in the list.

    For each item, deducts from Variant.stock. If warehouse_id is provided,
    also deducts from the corresponding VariantStock row.
    Logs a warning and skips (never crashes) if no VariantStock row exists for
    the given warehouse. Raises HTTP 400 if Variant.stock would go negative.

    Args:
        db: Database session.
        items: List of dicts or objects with variant_id and quantity.
        warehouse_id: Optional warehouse to also deduct warehouse-level stock from.

    Raises:
        HTTPException 400: If stock is insufficient for any item.
    """
    for item in items:
        if isinstance(item, dict):
            variant_id = item["variant_id"]
            quantity = item.get("quantity", 1)
        else:
            variant_id = item.variant_id
            quantity = item.quantity

        variant = db.query(models.Variant).filter(models.Variant.id == variant_id).first()
        if variant is None:
            logger.warning("deduct_stock: Variant %s not found — skipping", variant_id)
            continue

        if variant.stock < quantity:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insufficient stock for variant {variant_id}. "
                    f"Available: {variant.stock}, requested: {quantity}"
                ),
            )
        variant.stock -= quantity

        if warehouse_id:
            vs = (
                db.query(models.VariantStock)
                .filter_by(variant_id=variant_id, warehouse_id=warehouse_id)
                .first()
            )
            if vs is None:
                logger.warning(
                    "deduct_stock: No VariantStock row for variant %s in warehouse %s"
                    " — skipping warehouse deduction",
                    variant_id,
                    warehouse_id,
                )
            else:
                vs.quantity = max(0, vs.quantity - quantity)


def restore_stock(db: Session, items: list, warehouse_id: Optional[int] = None) -> None:
    """Restore stock for each item — the reverse of deduct_stock.

    Adds quantity back to Variant.stock. If warehouse_id is provided, also
    adds to the VariantStock row, creating the row if it does not yet exist.
    Logs a warning and skips if the Variant itself is not found.

    Args:
        db: Database session.
        items: List of dicts or objects with variant_id and quantity.
        warehouse_id: Optional warehouse to also restore warehouse-level stock.
    """
    for item in items:
        if isinstance(item, dict):
            variant_id = item["variant_id"]
            quantity = item.get("quantity", 1)
        else:
            variant_id = item.variant_id
            quantity = item.quantity

        variant = db.query(models.Variant).filter(models.Variant.id == variant_id).first()
        if variant is None:
            logger.warning("restore_stock: Variant %s not found — skipping", variant_id)
            continue
        variant.stock += quantity

        if warehouse_id:
            vs = (
                db.query(models.VariantStock)
                .filter_by(variant_id=variant_id, warehouse_id=warehouse_id)
                .first()
            )
            if vs is None:
                vs = models.VariantStock(
                    variant_id=variant_id,
                    warehouse_id=warehouse_id,
                    quantity=0,
                )
                db.add(vs)
                db.flush()
            vs.quantity += quantity


def get_stock_level(db: Session, variant_id: int, warehouse_id: Optional[int] = None) -> int:
    """Return current stock for a variant. Returns 0 if no row found.

    If warehouse_id is provided, returns the VariantStock quantity for that
    specific warehouse. Otherwise returns the global Variant.stock field.

    Args:
        db: Database session.
        variant_id: ID of the variant to check.
        warehouse_id: Optional warehouse ID to check warehouse-specific stock.

    Returns:
        Current stock quantity, or 0 if the row does not exist.
    """
    if warehouse_id:
        vs = (
            db.query(models.VariantStock)
            .filter_by(variant_id=variant_id, warehouse_id=warehouse_id)
            .first()
        )
        return vs.quantity if vs else 0

    variant = db.query(models.Variant).filter(models.Variant.id == variant_id).first()
    return variant.stock if variant else 0


def check_low_stock(db: Session, user_id: int) -> list:
    """Return all variants where stock <= low_stock_threshold. Used by Rex and dashboard alerts.

    Returns Variant instances with their product eagerly loaded.
    Only considers variants with low_stock_threshold > 0 to avoid false alerts on
    variants that have no threshold configured.

    Args:
        db: Database session.
        user_id: Store owner's user_id for scoping.

    Returns:
        List of Variant model instances at or below their configured threshold.
    """
    return (
        db.query(models.Variant)
        .options(joinedload(models.Variant.product))
        .join(models.Product, models.Variant.product_id == models.Product.id)
        .filter(
            models.Product.user_id == user_id,
            models.Variant.low_stock_threshold > 0,
            models.Variant.stock <= models.Variant.low_stock_threshold,
        )
        .all()
    )
