from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from auth import get_current_user, get_store_id
import models
import uuid, os, shutil
from datetime import datetime

router = APIRouter(prefix="/products", tags=["products"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "products")


def _create_initial_arrival(db, user_id: int, variant: models.Variant):
    """Auto-create a stock arrival when a variant is added with initial stock > 0."""
    cost = (variant.buying_price or 0) * variant.stock
    arrival = models.StockArrival(
        user_id=user_id,
        variant_id=variant.id,
        quantity=variant.stock,
        additional_fees=0,
        description="Initial stock",
        total_cost=cost,
        date=datetime.now(),
    )
    db.add(arrival)


ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/upload-image")
async def upload_product_image(file: UploadFile = File(...), user: models.User = Depends(get_current_user)):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")
    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 5MB")
    ext = os.path.splitext(file.filename)[1].lower()
    filename = f"{uuid.uuid4()}{ext}"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"url": f"/uploads/products/{filename}"}


class VariantCreate(BaseModel):
    sku: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    buying_price: float
    selling_price: Optional[float] = None
    stock: int = 0
    low_stock_threshold: int = 5


class ProductCreate(BaseModel):
    name: str
    short_name: Optional[str] = None
    category: str = "caps"
    has_sizes: bool = True
    has_colors: bool = True
    under_1kg: bool = False
    supplier: Optional[str] = None
    supplier_id: Optional[int] = None
    image_url: Optional[str] = None
    variants: List[VariantCreate] = []


class VariantUpdate(BaseModel):
    sku: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    buying_price: Optional[float] = None
    selling_price: Optional[float] = None
    low_stock_threshold: Optional[int] = None


def serialize_variant(v, db: Session) -> dict:
    broken = db.query(models.BrokenStock).filter(models.BrokenStock.variant_id == v.id).all()
    broken_qty = sum(b.quantity for b in broken)
    returnable_broken = sum(b.quantity for b in broken if b.returnable_to_supplier)

    return {
        "id": v.id,
        "sku": v.sku,
        "size": v.size,
        "color": v.color,
        "buying_price": v.buying_price,
        "selling_price": v.selling_price,
        "stock": v.stock,
        "low_stock_threshold": v.low_stock_threshold,
        "broken_stock": broken_qty,
        "returnable_broken": returnable_broken,
        "non_returnable_broken": broken_qty - returnable_broken,
    }


@router.get("")
def list_products(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    products = db.query(models.Product).filter(models.Product.user_id == get_store_id(user)).all()
    result = []
    for p in products:
        result.append({
            "id": p.id,
            "name": p.name,
            "short_name": p.short_name,
            "category": p.category,
            "has_sizes": p.has_sizes,
            "has_colors": p.has_colors,
            "under_1kg": p.under_1kg,
            "supplier": p.supplier,
            "supplier_id": p.supplier_id,
            "image_url": p.image_url,
            "variants": [serialize_variant(v, db) for v in p.variants],
        })
    return result


@router.post("")
def create_product(data: ProductCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot create products")
    product = models.Product(
        user_id=user.id,
        name=data.name,
        short_name=data.short_name,
        category=data.category,
        has_sizes=data.has_sizes,
        has_colors=data.has_colors,
        under_1kg=data.under_1kg,
        supplier=data.supplier,
        supplier_id=data.supplier_id,
        image_url=data.image_url,
    )
    if not data.has_sizes and any(v.size for v in data.variants):
        raise HTTPException(status_code=400, detail="This product does not support sizes")
    if not data.has_colors and any(v.color for v in data.variants):
        raise HTTPException(status_code=400, detail="This product does not support colors")

    db.add(product)
    db.flush()

    for v in data.variants:
        variant = models.Variant(product_id=product.id, **v.model_dump())
        db.add(variant)
        db.flush()
        if variant.stock > 0:
            _create_initial_arrival(db, user.id, variant)

    db.commit()
    db.refresh(product)
    return {"id": product.id, "name": product.name}


@router.put("/{product_id}")
def update_product(product_id: int, data: ProductCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot edit products")
    product = db.query(models.Product).filter(models.Product.id == product_id, models.Product.user_id == user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if data.image_url != product.image_url and product.image_url:
        old_path = os.path.join(UPLOAD_DIR, os.path.basename(product.image_url))
        if os.path.exists(old_path):
            os.remove(old_path)
    product.name = data.name
    product.short_name = data.short_name
    product.category = data.category
    product.has_sizes = data.has_sizes
    product.has_colors = data.has_colors
    product.under_1kg = data.under_1kg
    product.supplier = data.supplier
    product.supplier_id = data.supplier_id
    product.image_url = data.image_url
    db.commit()
    return {"id": product.id, "name": product.name}


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot delete products")
    product = db.query(models.Product).filter(models.Product.id == product_id, models.Product.user_id == user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    variant_ids = [v.id for v in product.variants]
    if variant_ids:
        db.query(models.StockArrival).filter(
            models.StockArrival.variant_id.in_(variant_ids)
        ).update({"variant_id": None}, synchronize_session=False)
        db.query(models.BrokenStock).filter(
            models.BrokenStock.variant_id.in_(variant_ids)
        ).delete(synchronize_session=False)
    db.delete(product)
    db.commit()
    return {"success": True}


@router.post("/{product_id}/variants")
def add_variant(product_id: int, data: VariantCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    product = db.query(models.Product).filter(models.Product.id == product_id, models.Product.user_id == user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if not product.has_sizes and data.size:
        raise HTTPException(status_code=400, detail="This product does not support sizes")
    if not product.has_colors and data.color:
        raise HTTPException(status_code=400, detail="This product does not support colors")

    existing = db.query(models.Variant).filter(
        models.Variant.product_id == product_id,
        models.Variant.size == (data.size or None),
        models.Variant.color == (data.color or None),
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A variant with size '{data.size or '-'}' and color '{data.color or '-'}' already exists for this product."
        )

    variant = models.Variant(product_id=product_id, **data.model_dump())
    db.add(variant)
    db.flush()
    if variant.stock > 0:
        _create_initial_arrival(db, user.id, variant)
    db.commit()
    db.refresh(variant)
    return {"id": variant.id}



@router.put("/variants/{variant_id}")
def update_variant(variant_id: int, data: VariantUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    store_id = get_store_id(user)
    variant = db.query(models.Variant).filter(
        models.Variant.id == variant_id,
        models.Variant.product_id.in_(
            db.query(models.Product.id).filter(models.Product.user_id == store_id)
        ),
    ).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    updates = data.model_dump(exclude_none=True)
    price_changed = "selling_price" in updates or "buying_price" in updates
    if price_changed:
        db.add(models.ProductPriceHistory(
            variant_id=variant.id,
            old_selling_price=variant.selling_price,
            new_selling_price=updates.get("selling_price", variant.selling_price),
            old_buying_price=variant.buying_price,
            new_buying_price=updates.get("buying_price", variant.buying_price),
            changed_by=user.id,
        ))
    for field, value in updates.items():
        setattr(variant, field, value)
    db.commit()
    return {"success": True}


@router.delete("/variants/{variant_id}")
def delete_variant(variant_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    store_id = get_store_id(user)
    variant = db.query(models.Variant).filter(
        models.Variant.id == variant_id,
        models.Variant.product_id.in_(
            db.query(models.Product.id).filter(models.Product.user_id == store_id)
        ),
    ).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    db.query(models.StockArrival).filter(models.StockArrival.variant_id == variant_id).delete()
    db.query(models.BrokenStock).filter(models.BrokenStock.variant_id == variant_id).delete()
    db.query(models.OrderItem).filter(models.OrderItem.variant_id == variant_id).delete()

    db.delete(variant)
    db.commit()
    return {"success": True}
