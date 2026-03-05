import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from auth import get_current_user, get_store_id
from services.pdf_parser import parse_pickup_pdf, parse_return_pdf
import models

router = APIRouter(prefix="/orders", tags=["orders"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")


class OrderItemInput(BaseModel):
    variant_id: int
    quantity: int = 1


class OrderExpenseInput(BaseModel):
    sticker: float = 0
    seal_bag: float = 0
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


class BulkOrderCreate(BaseModel):
    orders: List[OrderCreateInput]


class ReturnInput(BaseModel):
    order_id: int
    seal_bag_returned: bool = False
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


def serialize_order(order: models.Order, db: Session) -> dict:
    items = []
    for item in order.items:
        items.append({
            "id": item.id,
            "variant_id": item.variant_id,
            "product_name": item.product_name,
            "size": item.size,
            "color": item.color,
            "quantity": item.quantity,
            "unit_cost": item.unit_cost,
        })

    expenses = None
    if order.expenses:
        expenses = {
            "sticker": order.expenses.sticker,
            "seal_bag": order.expenses.seal_bag,
            "packaging": order.expenses.packaging,
            "delivery_fee": order.expenses.delivery_fee,
            "return_fee": order.expenses.return_fee,
            "seal_bag_returned": order.expenses.seal_bag_returned,
            "product_broken": order.expenses.product_broken,
        }

    # Resolve uploader name
    uploaded_by_name = None
    if order.uploaded_by:
        uploader = db.query(models.User).filter(models.User.id == order.uploaded_by).first()
        if uploader:
            uploaded_by_name = uploader.username

    # Resolve confirmer name
    confirmed_by_name = None
    if order.confirmed_by:
        member = db.query(models.TeamMember).filter(models.TeamMember.id == order.confirmed_by).first()
        if member:
            confirmed_by_name = member.name

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
        "order_date": order.order_date.isoformat() if order.order_date else None,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "uploaded_by": uploaded_by_name,
        "confirmed_by": confirmed_by_name,
        "items": items,
        "expenses": expenses,
    }


@router.get("")
def list_orders(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = get_store_id(user)
    query = db.query(models.Order).filter(models.Order.user_id == sid).order_by(models.Order.order_date.desc())
    # Confirmers only see their own uploaded orders
    if user.role == "confirmer":
        query = query.filter(models.Order.uploaded_by == user.id)
    if status:
        query = query.filter(models.Order.status == status)
    orders = query.all()
    return [serialize_order(o, db) for o in orders]


@router.post("/bulk-status")
def bulk_update_status(data: BulkStatusInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    sid = get_store_id(user)
    if data.status not in ("pending", "delivered", "cancelled"):
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
    return serialize_order(order, db)


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
            matched.append(serialize_order(order, db))
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

    for order_data in data.orders:
        # Check if order already exists for this store
        existing = db.query(models.Order).filter(
            models.Order.caleo_id == order_data.caleo_id,
            models.Order.user_id == sid,
        ).first()
        if existing:
            continue

        delivery_fee, return_fee, is_casa = get_city_fees(order_data.city or "", db)
        packaging = order_data.expenses.packaging if order_data.expenses.packaging else (2 if is_casa else 3)

        order_date = None
        if order_data.order_date:
            try:
                order_date = datetime.fromisoformat(order_data.order_date)
            except ValueError:
                order_date = datetime.now()

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
        )
        db.add(order)
        db.flush()

        # Add items and reduce stock
        for item_data in order_data.items:
            variant = db.query(models.Variant).filter(
                models.Variant.id == item_data.variant_id
            ).first()
            if not variant:
                db.rollback()
                raise HTTPException(status_code=404, detail=f"Variant {item_data.variant_id} not found")

            if variant.stock < item_data.quantity:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"[{order_data.caleo_id}] Insufficient stock for {variant.product.name} {variant.size or ''} {variant.color or ''}. "
                           f"Available: {variant.stock}, requested: {item_data.quantity}"
                )
            variant.stock -= item_data.quantity

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

        # Add expenses
        expense = models.OrderExpense(
            order_id=order.id,
            sticker=order_data.expenses.sticker,
            seal_bag=order_data.expenses.seal_bag,
            packaging=packaging,
            delivery_fee=delivery_fee,
            return_fee=return_fee,
        )
        db.add(expense)
        created.append(order.caleo_id)

    db.commit()
    return {"success": True, "created": created, "count": len(created)}


@router.post("/process-returns")
def process_returns(data: ProcessReturnsInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Process returned orders."""
    sid = get_store_id(user)
    for ret in data.returns:
        order = db.query(models.Order).filter(models.Order.id == ret.order_id, models.Order.user_id == sid).first()
        if not order:
            raise HTTPException(status_code=404, detail=f"Order {ret.order_id} not found")

        order.status = "cancelled"

        if order.expenses:
            order.expenses.seal_bag_returned = ret.seal_bag_returned
            order.expenses.product_broken = ret.product_broken

        for item in order.items:
            if ret.product_broken:
                # Move to broken stock
                variant = db.query(models.Variant).filter(
                    models.Variant.id == item.variant_id
                ).first()
                broken = models.BrokenStock(
                    user_id=order.user_id,
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
    if status not in ("pending", "delivered", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    order.status = status
    db.commit()
    return {"success": True}


@router.put("/{order_id}")
def update_order(order_id: int, data: OrderUpdateInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    sid = get_store_id(user)
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.user_id == sid).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

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
        delivery_fee, return_fee, _ = get_city_fees(order.city or "", db)
        order.expenses.delivery_fee = delivery_fee
        order.expenses.return_fee = return_fee

    # Update expenses (sticker, seal_bag, packaging)
    if data.expenses is not None and order.expenses:
        order.expenses.sticker = data.expenses.sticker
        order.expenses.seal_bag = data.expenses.seal_bag
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
                        detail=f"[{order.caleo_id}] Insufficient stock for {variant.product.name} {variant.size or ''} {variant.color or ''}. "
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
    return serialize_order(order, db)


@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
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
    # Null out FK references that have no cascade (prevents FK constraint errors)
    db.query(models.BrokenStock).filter(models.BrokenStock.source_order_id == order_id).update({"source_order_id": None})
    db.query(models.Lead).filter(models.Lead.order_id == order_id).update({"order_id": None})
    db.delete(order)
    db.commit()
    return {"success": True}
