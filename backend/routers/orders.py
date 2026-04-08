import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from zoneinfo import ZoneInfo
from database import get_db

MOROCCO_TZ = ZoneInfo("Africa/Casablanca")
from auth import get_current_user, get_store_id
from core.permissions import require_admin
from services.pdf_parser import parse_pickup_pdf, parse_return_pdf
from services import expense_service, order_service
import models

router = APIRouter(prefix="/orders", tags=["orders"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")


class OrderItemInput(BaseModel):
    variant_id: int
    quantity: int = 1


class OrderExpenseInput(BaseModel):
    packaging: float = 1


class OrderCreateInput(BaseModel):
    caleo_id: str
    customer_name: str
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    city: Optional[str] = None
    total_amount: float
    order_date: Optional[str] = None
    confirmed_by: Optional[int] = None
    items: List[OrderItemInput]
    expenses: OrderExpenseInput
    pack_id: Optional[int] = None
    offer_id: Optional[int] = None
    promo_code: Optional[str] = None
    discount_amount: Optional[float] = 0


class BulkOrderCreate(BaseModel):
    orders: List[OrderCreateInput]


class ReturnInput(BaseModel):
    order_id: int
    product_broken: bool = False


class ProcessReturnsInput(BaseModel):
    returns: List[ReturnInput]


class BulkStatusInput(BaseModel):
    order_ids: List[int]
    status: str


class NotesInput(BaseModel):
    notes: Optional[str] = None


class OrderUpdateInput(BaseModel):
    caleo_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    city: Optional[str] = None
    total_amount: Optional[float] = None
    items: Optional[List[OrderItemInput]] = None
    expenses: Optional[OrderExpenseInput] = None


def get_city_fees(city_name: str, db: Session):
    city = db.query(models.City).filter(
        models.City.name.ilike(city_name)
    ).first()
    if city:
        return city.delivery_fee, city.return_fee, city.is_casa
    # Default fees if city not found
    return 35.0, 7.0, False


def serialize_order(order: models.Order, user_map: dict = None, member_map: dict = None) -> dict:
    items = [
        {
            "id": item.id,
            "variant_id": item.variant_id,
            "product_name": item.product_name,
            "size": item.size,
            "color": item.color,
            "quantity": item.quantity,
            "unit_cost": item.unit_cost,
        }
        for item in order.items
    ]

    expenses = None
    if order.expenses:
        expenses = {
            "seal_bag": order.expenses.seal_bag,
            "packaging": order.expenses.packaging,
            "delivery_fee": order.expenses.delivery_fee,
            "return_fee": order.expenses.return_fee,
            "product_broken": order.expenses.product_broken,
        }

    uploaded_by_name  = (user_map   or {}).get(order.uploaded_by)
    confirmed_by_name = (member_map or {}).get(order.confirmed_by)

    return {
        "id": order.id,
        "caleo_id": order.caleo_id,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "customer_address": order.customer_address,
        "city": order.city,
        "total_amount": order.total_amount,
        "status": order.status,
        "notes": order.notes,
        "tracking_id": order.tracking_id,
        "delivery_status": order.delivery_status,
        "delivery_provider": getattr(order, "delivery_provider", None),
        "order_date": order.order_date.isoformat() if order.order_date else None,
        "reported_date": order.reported_date.isoformat() if order.reported_date else None,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "uploaded_by": uploaded_by_name,
        "confirmed_by": confirmed_by_name,
        "items": items,
        "expenses": expenses,
    }


@router.get("")
def list_orders(
    status: Optional[str] = None,
    tab: Optional[str] = "orders",
    page: int = 1,
    limit: int = 100,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    reported_from: Optional[str] = None,
    reported_to: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    from sqlalchemy import func as _func
    sid = get_store_id(user)
    base = db.query(models.Order).filter(models.Order.user_id == sid)
    if user.role == "confirmer":
        base = base.filter(models.Order.uploaded_by == user.id)

    # Tab counts (always computed so labels stay accurate)
    order_count  = base.filter(models.Order.status != "cancelled").count()
    return_count = base.filter(models.Order.status == "cancelled").count()

    # Per-status counts for filter buttons
    status_counts = {
        row.status: row.cnt
        for row in db.query(models.Order.status, _func.count(models.Order.id).label("cnt"))
                      .filter(models.Order.user_id == sid)
                      .group_by(models.Order.status).all()
    }

    # Apply tab + status filter
    if tab == "returns":
        query = base.filter(models.Order.status == "cancelled")
    elif status and status not in ("all",):
        query = base.filter(models.Order.status == status)
    else:
        query = base.filter(models.Order.status != "cancelled")

    # Apply date filters
    if date_from:
        try:
            query = query.filter(models.Order.order_date >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59)
            query = query.filter(models.Order.order_date <= dt)
        except ValueError:
            pass
    if reported_from:
        try:
            query = query.filter(models.Order.reported_date >= datetime.fromisoformat(reported_from))
        except ValueError:
            pass
    if reported_to:
        try:
            rt = datetime.fromisoformat(reported_to).replace(hour=23, minute=59, second=59)
            query = query.filter(models.Order.reported_date <= rt)
        except ValueError:
            pass

    if search:
        query = query.filter(
            or_(
                models.Order.customer_name.ilike(f"%{search}%"),
                models.Order.customer_phone.ilike(f"%{search}%"),
                models.Order.city.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    orders = (
        query
        .options(joinedload(models.Order.items), joinedload(models.Order.expenses))
        .order_by(models.Order.order_date.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    uploader_ids = {o.uploaded_by for o in orders if o.uploaded_by}
    member_ids   = {o.confirmed_by for o in orders if o.confirmed_by}
    user_map   = {u.id: u.username for u in db.query(models.User).filter(models.User.id.in_(uploader_ids)).all()} if uploader_ids else {}
    member_map = {m.id: m.name   for m in db.query(models.TeamMember).filter(models.TeamMember.id.in_(member_ids)).all()} if member_ids else {}

    return {
        "orders": [serialize_order(o, user_map, member_map) for o in orders],
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
        "order_count": order_count,
        "return_count": return_count,
        "status_counts": status_counts,
    }


@router.post("/bulk-status")
def bulk_update_status(data: BulkStatusInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    sid = get_store_id(user)
    if data.status not in ("pending", "awaiting_pickup", "in_delivery", "delivered", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    orders = db.query(models.Order).filter(
        models.Order.id.in_(data.order_ids),
        models.Order.user_id == sid,
    ).all()
    for order in orders:
        order.status = data.status
    db.commit()
    return {"success": True, "count": len(orders)}


@router.patch("/{order_id}/notes")
def update_order_notes(order_id: int, data: NotesInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    sid = get_store_id(user)
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.user_id == sid).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.notes = data.notes
    db.commit()
    return {"success": True}


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    sid = get_store_id(user)
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.user_id == sid).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return serialize_order(order)


@router.post("/upload-pickup")
async def upload_pickup_pdf(file: UploadFile = File(...)):
    """Parse a Pickup Parcels PDF and return extracted orders."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, f"pickup_{file.filename}")

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        orders = parse_pickup_pdf(filepath)
        if not orders:
            raise HTTPException(status_code=422, detail="No orders found in PDF. Please check the file.")
        return {"success": True, "orders": orders}
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"PDF parsing failed: {str(e)}")


@router.post("/upload-return")
async def upload_return_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Parse a Return PDF and match CMD-IDs against existing orders."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, f"return_{file.filename}")

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        cmd_ids = parse_return_pdf(filepath)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"PDF parsing failed: {str(e)}")

    matched = []
    unmatched = []

    for cmd_id in cmd_ids:
        order = db.query(models.Order).filter(models.Order.caleo_id == cmd_id).first()
        if order:
            matched.append(serialize_order(order))
        else:
            unmatched.append(cmd_id)

    return {
        "success": True,
        "matched_orders": matched,
        "unmatched_cmd_ids": unmatched,
    }


@router.post("/bulk-create")
def bulk_create_orders(data: BulkOrderCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Create multiple orders from parsed PDF data."""
    sid = get_store_id(user)
    created = []
    failed = 0
    errors = []

    for order_data in data.orders:
        try:
            # Fix #39: reject zero/negative totals
            if order_data.total_amount <= 0:
                raise HTTPException(status_code=400, detail="Order total must be greater than 0")

            # Check if order already exists for this store
            existing = db.query(models.Order).filter(
                models.Order.caleo_id == order_data.caleo_id,
                models.Order.user_id == sid,
            ).first()
            if existing:
                continue

            # Fix #146: mutual exclusion — pack and offer cannot coexist
            if order_data.pack_id and order_data.offer_id:
                raise HTTPException(status_code=400, detail="An order cannot have both a pack and an offer")

            # Fix #154: validate pack is active
            if order_data.pack_id:
                pack = db.query(models.Pack).filter(
                    models.Pack.id == order_data.pack_id,
                    models.Pack.is_active == True,
                ).first()
                if not pack:
                    raise HTTPException(status_code=400, detail="Pack is not available")

            # Fix #154 + #138: validate offer is active and within date range
            if order_data.offer_id:
                offer = db.query(models.Offer).filter(
                    models.Offer.id == order_data.offer_id,
                    models.Offer.is_active == True,
                ).first()
                if not offer:
                    raise HTTPException(status_code=400, detail="Offer is not available")
                now = datetime.now()
                if offer.start_date and offer.start_date > now:
                    raise HTTPException(status_code=400, detail="This offer has not started yet")
                if offer.end_date and offer.end_date < now:
                    raise HTTPException(status_code=400, detail="This offer has expired")

            # Fix #137: promo code server-side validation
            if order_data.promo_code:
                promo = db.query(models.PromoCode).filter(
                    models.PromoCode.code == order_data.promo_code,
                    models.PromoCode.user_id == sid,
                    models.PromoCode.is_active == True,
                ).first()
                if not promo:
                    raise HTTPException(status_code=400, detail="Invalid or inactive promo code")
                if promo.usage_limit and promo.used_count >= promo.usage_limit:
                    raise HTTPException(status_code=400, detail="Promo code usage limit reached")
                if promo.min_order_value and order_data.total_amount < promo.min_order_value:
                    raise HTTPException(status_code=400, detail=f"Minimum order value is {promo.min_order_value} MAD")

            # Warehouse routing: pick best warehouse based on stock + delivery cost
            from services.warehouse_routing import pick_warehouse, deduct_warehouse_stock
            item_dicts = [{"variant_id": i.variant_id, "quantity": i.quantity} for i in order_data.items]
            best_wh, routed_delivery_fee = pick_warehouse(item_dicts, order_data.city or "", sid, db)

            # City table only queried when routing did not return a delivery fee
            if routed_delivery_fee is not None:
                delivery_fee = routed_delivery_fee
                _, return_fee, is_casa = get_city_fees(order_data.city or "", db)
            else:
                city_delivery_fee, return_fee, is_casa = get_city_fees(order_data.city or "", db)
                delivery_fee = city_delivery_fee
            packaging = order_data.expenses.packaging if order_data.expenses.packaging else (2 if is_casa else 3)

            if order_data.order_date:
                try:
                    order_date = datetime.fromisoformat(str(order_data.order_date))
                except (ValueError, TypeError):
                    raise HTTPException(status_code=400, detail="Invalid order date format. Use ISO format: YYYY-MM-DD")
            else:
                order_date = datetime.now(MOROCCO_TZ).replace(tzinfo=None)

            order = models.Order(
                user_id=sid,
                uploaded_by=user.id,
                caleo_id=order_data.caleo_id,
                customer_name=order_data.customer_name,
                customer_phone=order_data.customer_phone,
                customer_address=order_data.customer_address,
                city=order_data.city,
                total_amount=order_data.total_amount,
                status="pending",
                order_date=order_date or datetime.now(),
                pack_id=order_data.pack_id,
                offer_id=order_data.offer_id,
                promo_code_used=order_data.promo_code,
                discount_amount=order_data.discount_amount or 0,
                warehouse_id=best_wh.id if best_wh else None,
            )
            db.add(order)
            db.flush()

            # Add items and reduce stock
            has_salt_bag = False
            for item_data in order_data.items:
                variant = db.query(models.Variant).options(
                    joinedload(models.Variant.product)
                ).filter(
                    models.Variant.id == item_data.variant_id
                ).first()
                if not variant:
                    raise HTTPException(status_code=404, detail=f"Variant {item_data.variant_id} not found")

                if variant.stock < item_data.quantity:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for {variant.product.name} {variant.size or ''} {variant.color or ''}. "
                               f"Available: {variant.stock}, requested: {item_data.quantity}"
                    )
                variant.stock -= item_data.quantity

                if variant.product and variant.product.needs_salt_bag:
                    has_salt_bag = True

                # Also deduct from warehouse-specific stock
                if best_wh:
                    wh_stock = db.query(models.VariantStock).filter_by(
                        variant_id=variant.id, warehouse_id=best_wh.id
                    ).first()
                    if wh_stock:
                        wh_stock.quantity = max(0, wh_stock.quantity - item_data.quantity)

                order_item = models.OrderItem(
                    order_id=order.id,
                    variant_id=variant.id,
                    product_name=variant.product.name,
                    size=variant.size,
                    color=variant.color,
                    quantity=item_data.quantity,
                    unit_cost=variant.buying_price,
                    unit_price=variant.selling_price,
                )
                db.add(order_item)

            # Add expenses (salt bag auto-computed from product flags)
            expense = models.OrderExpense(
                order_id=order.id,
                seal_bag=1.0 if has_salt_bag else 0.0,
                packaging=packaging,
                delivery_fee=delivery_fee,
                return_fee=return_fee,
            )
            db.add(expense)
            db.flush()  # make expense relationship visible before safety-net check
            expense_service.get_or_create_expense(db, order)  # Bug #189: every order must have an expense row

            # Increment promo code usage
            if order_data.promo_code:
                promo = db.query(models.PromoCode).filter(
                    models.PromoCode.user_id == sid,
                    models.PromoCode.code == order_data.promo_code.upper().strip(),
                ).first()
                if promo:
                    promo.used_count = (promo.used_count or 0) + 1

            db.commit()
            created.append(order.caleo_id)

        except HTTPException as e:
            db.rollback()
            failed += 1
            errors.append({"caleo_id": order_data.caleo_id, "error": e.detail})
        except Exception as e:
            db.rollback()
            failed += 1
            errors.append({"caleo_id": order_data.caleo_id, "error": str(e)})

    return {"created": len(created), "failed": failed, "errors": errors}


@router.post("/process-returns")
def process_returns(data: ProcessReturnsInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Process returned orders."""
    sid = get_store_id(user)
    for ret in data.returns:
        order = db.query(models.Order).filter(models.Order.id == ret.order_id, models.Order.user_id == sid).first()
        if not order:
            raise HTTPException(status_code=404, detail=f"Order {ret.order_id} not found")

        if order.status == "returned":
            continue

        order.status = "cancelled"

        if order.expenses:
            order.expenses.product_broken = ret.product_broken

        for item in order.items:
            if ret.product_broken:
                # Move to broken stock
                variant = db.query(models.Variant).filter(
                    models.Variant.id == item.variant_id
                ).first()
                broken = models.BrokenStock(
                    variant_id=item.variant_id,
                    quantity=item.quantity,
                    source="return",
                    source_order_id=order.id,
                    returnable_to_supplier=False,
                    value_lost=item.unit_cost * item.quantity,
                    date=datetime.now(),
                )
                db.add(broken)
            else:
                # Restore stock
                variant = db.query(models.Variant).filter(
                    models.Variant.id == item.variant_id
                ).first()
                if variant:
                    variant.stock += item.quantity

    db.commit()
    return {"success": True}


@router.put("/{order_id}/status")
def update_order_status(order_id: int, status: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    sid = get_store_id(user)
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.user_id == sid).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if status == "delivered":
        order.confirmed_by = user.team_member_id
    order_service.change_order_status(db, order, status, changed_by=user.id)
    db.commit()
    return {"success": True}


@router.put("/{order_id}")
def update_order(order_id: int, data: OrderUpdateInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    sid = get_store_id(user)
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.user_id == sid).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.tracking_id and order.delivery_provider:
        raise HTTPException(status_code=400, detail="Cannot edit an order that has already been dispatched to a courier")
    if order.status == "delivered":
        raise HTTPException(status_code=400, detail="Cannot edit a delivered order. Create a return or exchange instead.")

    # Update basic fields
    if data.caleo_id is not None:
        order.caleo_id = data.caleo_id
    if data.customer_name is not None:
        order.customer_name = data.customer_name
    if data.customer_phone is not None:
        order.customer_phone = data.customer_phone
    if data.customer_address is not None:
        order.customer_address = data.customer_address
    if data.total_amount is not None:
        order.total_amount = data.total_amount

    # Update city and recalculate delivery fees
    city_changed = data.city is not None and data.city != order.city
    if data.city is not None:
        order.city = data.city
    if city_changed and order.expenses:
        # Re-run warehouse routing for new city
        from services.warehouse_routing import pick_warehouse
        item_dicts = [{"variant_id": i.variant_id, "quantity": i.quantity} for i in order.items]
        best_wh, routed_fee = pick_warehouse(item_dicts, order.city or "", sid, db)
        city_fee, return_fee, _ = get_city_fees(order.city or "", db)
        order.expenses.delivery_fee = routed_fee if routed_fee is not None else city_fee
        order.expenses.return_fee   = return_fee
        if best_wh:
            order.warehouse_id = best_wh.id

    # Update packaging only — seal_bag is auto-computed, sticker no longer exists
    if data.expenses is not None and order.expenses:
        order.expenses.packaging = data.expenses.packaging

    # Update items (only adjust stock for pending orders)
    if data.items is not None:
        is_pending = order.status == "pending"

        # Restore stock for old items (only if pending)
        if is_pending:
            for item in order.items:
                variant = db.query(models.Variant).filter(models.Variant.id == item.variant_id).first()
                if variant:
                    variant.stock += item.quantity

        # Delete old items
        for item in order.items:
            db.delete(item)
        db.flush()

        # Add new items
        for item_data in data.items:
            variant = db.query(models.Variant).filter(models.Variant.id == item_data.variant_id).first()
            if not variant:
                db.rollback()
                raise HTTPException(status_code=404, detail=f"Variant {item_data.variant_id} not found")
            if is_pending:
                if variant.stock < item_data.quantity:
                    db.rollback()
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for {variant.product.name} {variant.size or ''} {variant.color or ''}. "
                               f"Available: {variant.stock}, requested: {item_data.quantity}"
                    )
                variant.stock -= item_data.quantity
            db.add(models.OrderItem(
                order_id=order.id,
                variant_id=variant.id,
                product_name=variant.product.name,
                size=variant.size,
                color=variant.color,
                quantity=item_data.quantity,
                unit_cost=variant.buying_price,
                unit_price=variant.selling_price,
            ))

    db.commit()
    db.refresh(order)
    return serialize_order(order)


@router.patch("/{order_id}/reschedule")
def reschedule_order(order_id: int, callback_time: datetime, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == get_store_id(user),
        models.Order.status == "reported",
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Reported order not found")
    order.callback_time = callback_time
    db.commit()
    return {"success": True}


@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    sid = get_store_id(user)
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.user_id == sid).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    # Restore stock if order was pending
    if order.status == "pending":
        for item in order.items:
            variant = db.query(models.Variant).filter(
                models.Variant.id == item.variant_id
            ).first()
            if variant:
                variant.stock += item.quantity
    order_service.soft_delete_order(db, order, deleted_by=user)
    db.commit()
    return {"success": True}
