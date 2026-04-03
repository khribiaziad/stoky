"""
One-time migration script: seed warehouses and VariantStock from existing data.
Run once: python migrate_warehouses.py
"""
from database import SessionLocal
import models

db = SessionLocal()

try:
    stores = db.query(models.User).filter(models.User.role == "admin").all()
    print(f"Found {len(stores)} store(s) to migrate")

    for store in stores:
        sid = store.id

        # Skip if already migrated
        if db.query(models.Warehouse).filter_by(store_id=sid).first():
            print(f"  Store {sid} ({store.store_name}): already has warehouses, skipping")
            continue

        # Determine warehouse city from delivery settings
        city = ""
        for key in ["olivraison_pickup_city", "forcelog_pickup_city"]:
            s = db.query(models.AppSettings).filter_by(key=key, user_id=sid).first()
            if s and s.value:
                city = s.value
                break

        wh = models.Warehouse(
            store_id=sid,
            name="Entrepôt Principal",
            city=city or "",
            is_default=True,
        )
        db.add(wh)
        db.flush()

        # Migrate variant stock
        variants = db.query(models.Variant).join(
            models.Product, models.Variant.product_id == models.Product.id
        ).filter(models.Product.user_id == sid).all()

        for v in variants:
            if not db.query(models.VariantStock).filter_by(variant_id=v.id, warehouse_id=wh.id).first():
                db.add(models.VariantStock(
                    variant_id=v.id,
                    warehouse_id=wh.id,
                    quantity=v.stock or 0,
                ))

        # Assign existing orders to this warehouse
        db.query(models.Order).filter(
            models.Order.user_id == sid,
            models.Order.warehouse_id == None,
        ).update({"warehouse_id": wh.id})

        db.commit()
        print(f"  Store {sid} ({store.store_name}): created warehouse '{wh.name}' (city='{city}'), migrated {len(variants)} variants")

    print("Migration complete.")
finally:
    db.close()
