# Required environment variables:
#   ANTHROPIC_API_KEY — Rex (AI layer) uses this to call Claude. Set in Render or .env.
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from database import engine, get_db
from sqlalchemy import text
from sqlalchemy.orm import Session
import models
from routers import products, stock, orders, team, expenses, reports, packs, auth as auth_router, cities as cities_router, platform as platform_router, leads as leads_router, suppliers as suppliers_router, olivraison as olivraison_router, youcan as youcan_router, woocommerce as woocommerce_router, shopify as shopify_router, meta_ads as meta_ads_router, tiktok_ads as tiktok_ads_router, snapchat_ads as snapchat_ads_router, pinterest_ads as pinterest_ads_router, google_ads as google_ads_router, offers as offers_router, promo_codes as promo_codes_router, bot as bot_router, campaign_connections as campaign_connections_router, warehouses as warehouses_router, forcelog as forcelog_router
from routers.rex import router as rex_router
from auth import get_current_user
from seed_cities import seed

# Create all tables
models.Base.metadata.create_all(bind=engine)

# Migrations for new columns on existing tables
with engine.connect() as conn:
    for stmt in [
        "ALTER TABLE facebook_ads ADD COLUMN platform VARCHAR DEFAULT 'facebook'",
        "ALTER TABLE facebook_ads ADD COLUMN platform_id INTEGER REFERENCES ad_platforms(id)",
        "ALTER TABLE fixed_expenses ADD COLUMN category VARCHAR DEFAULT 'other'",
        "ALTER TABLE orders ADD COLUMN notes TEXT",
        "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin'",
        "ALTER TABLE subscriptions ADD COLUMN notes TEXT",
        "ALTER TABLE subscriptions ADD COLUMN needs_renewal BOOLEAN DEFAULT false",
        "CREATE TABLE IF NOT EXISTS platform_expenses (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, category VARCHAR DEFAULT 'other', amount FLOAT NOT NULL, currency VARCHAR DEFAULT 'MAD', type VARCHAR DEFAULT 'monthly', date DATETIME NOT NULL, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS store_api_keys (id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL UNIQUE REFERENCES users(id), key VARCHAR NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES users(id), customer_name VARCHAR NOT NULL, customer_phone VARCHAR NOT NULL, customer_email VARCHAR, customer_city VARCHAR, customer_address VARCHAR, raw_items JSON, matched_items JSON, total_amount FLOAT, notes TEXT, status VARCHAR DEFAULT 'pending', order_id INTEGER REFERENCES orders(id), last_message_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "ALTER TABLE broken_stock ADD COLUMN user_id INTEGER REFERENCES users(id)",
        "ALTER TABLE products ADD COLUMN supplier VARCHAR",
        "ALTER TABLE products ADD COLUMN image_url VARCHAR",
        "ALTER TABLE variants ADD COLUMN sku VARCHAR",
        "CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name VARCHAR NOT NULL, phone VARCHAR, platform VARCHAR, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS supplier_payments (id INTEGER PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id), amount FLOAT NOT NULL, date DATETIME NOT NULL, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)",
        "ALTER TABLE users ADD COLUMN google_id VARCHAR",
        "ALTER TABLE users ADD COLUMN google_email VARCHAR",
        "ALTER TABLE orders ADD COLUMN tracking_id VARCHAR",
        "ALTER TABLE orders ADD COLUMN delivery_status VARCHAR",
        "ALTER TABLE packs ADD COLUMN product_id INTEGER REFERENCES products(id)",
        "ALTER TABLE packs ADD COLUMN packaging_cost FLOAT DEFAULT 0",
        "ALTER TABLE packs ADD COLUMN is_active BOOLEAN DEFAULT true",
        "CREATE TABLE IF NOT EXISTS offers (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), name VARCHAR NOT NULL, selling_price FLOAT NOT NULL, packaging_cost FLOAT DEFAULT 0, start_date DATETIME, end_date DATETIME, is_active BOOLEAN DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS offer_items (id INTEGER PRIMARY KEY, offer_id INTEGER NOT NULL REFERENCES offers(id), variant_id INTEGER NOT NULL REFERENCES variants(id), quantity INTEGER DEFAULT 1)",
        "CREATE TABLE IF NOT EXISTS promo_codes (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), code VARCHAR NOT NULL, discount_type VARCHAR NOT NULL, discount_value FLOAT NOT NULL, min_order_value FLOAT, usage_limit INTEGER, used_count INTEGER DEFAULT 0, expiry_date DATETIME, applies_to VARCHAR DEFAULT 'all', target_ids JSON, is_active BOOLEAN DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "ALTER TABLE orders ADD COLUMN pack_id INTEGER REFERENCES packs(id)",
        "ALTER TABLE orders ADD COLUMN offer_id INTEGER REFERENCES offers(id)",
        "ALTER TABLE orders ADD COLUMN promo_code_used VARCHAR",
        "ALTER TABLE orders ADD COLUMN discount_amount FLOAT DEFAULT 0",
        "ALTER TABLE orders ADD COLUMN reported_date DATETIME",
        "ALTER TABLE leads ADD COLUMN reported_date DATETIME",
        "ALTER TABLE leads ADD COLUMN last_message_at DATETIME",
        "ALTER TABLE order_expenses ADD COLUMN seal_bag_returned BOOLEAN DEFAULT false",
        "ALTER TABLE order_expenses ADD COLUMN product_broken BOOLEAN DEFAULT false",
        "ALTER TABLE order_items ADD COLUMN unit_price FLOAT",
        "ALTER TABLE variants ADD COLUMN under_1kg BOOLEAN DEFAULT false",
        "ALTER TABLE products ADD COLUMN under_1kg BOOLEAN DEFAULT false",
        "ALTER TABLE variants ADD COLUMN low_stock_threshold INTEGER DEFAULT 5",
        "ALTER TABLE orders ADD COLUMN confirmed_by INTEGER REFERENCES team_members(id)",
        "ALTER TABLE packs ADD COLUMN item_count INTEGER DEFAULT 1",
        "ALTER TABLE products ADD COLUMN short_name VARCHAR",
        # campaign_connections is managed by SQLAlchemy create_all — no raw SQL needed
        "ALTER TABLE orders ADD COLUMN delivery_provider VARCHAR",
        "ALTER TABLE orders ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id)",
        "ALTER TABLE orders ADD COLUMN uploaded_by INTEGER REFERENCES users(id)",
        "CREATE TABLE IF NOT EXISTS warehouses (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL REFERENCES users(id), name VARCHAR NOT NULL, city VARCHAR NOT NULL, is_default BOOLEAN DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS variant_stock (id INTEGER PRIMARY KEY AUTOINCREMENT, variant_id INTEGER NOT NULL REFERENCES variants(id), warehouse_id INTEGER NOT NULL REFERENCES warehouses(id), quantity INTEGER NOT NULL DEFAULT 0, UNIQUE(variant_id, warehouse_id))",
        "CREATE TABLE IF NOT EXISTS delivery_company_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL REFERENCES users(id), company VARCHAR NOT NULL, from_city VARCHAR NOT NULL, to_city VARCHAR NOT NULL, national_fee FLOAT NOT NULL, local_fee FLOAT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(store_id, company, from_city, to_city))",
        "ALTER TABLE stock_arrivals ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id)",
        "ALTER TABLE orders ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE orders ADD COLUMN deleted_at DATETIME",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_orders_caleo_id ON orders (caleo_id) WHERE caleo_id IS NOT NULL",
        "ALTER TABLE orders ADD COLUMN lead_id INTEGER REFERENCES leads(id)",
        "ALTER TABLE leads ADD COLUMN source VARCHAR DEFAULT 'website'",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_product_name_per_store ON products (user_id, name)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_name_per_store ON suppliers (user_id, name)",
        "ALTER TABLE suppliers ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true",
        "ALTER TABLE stock_arrivals ADD COLUMN idempotency_key VARCHAR",
        "CREATE INDEX IF NOT EXISTS ix_stock_arrivals_idempotency_key ON stock_arrivals (idempotency_key)",
        "ALTER TABLE team_members ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT false",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_appsettings_user_key ON app_settings (user_id, key)",
        "ALTER TABLE store_api_keys ADD COLUMN previous_key VARCHAR",
        "ALTER TABLE store_api_keys ADD COLUMN previous_key_expires_at DATETIME",
        "CREATE TABLE IF NOT EXISTS team_member_rate_history (id INTEGER PRIMARY KEY AUTOINCREMENT, team_member_id INTEGER REFERENCES team_members(id), fixed_monthly FLOAT, per_order_rate FLOAT, effective_from DATETIME NOT NULL, effective_to DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS bot_api_keys (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL UNIQUE REFERENCES users(id), key VARCHAR NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS product_price_history (id INTEGER PRIMARY KEY AUTOINCREMENT, variant_id INTEGER REFERENCES variants(id), old_selling_price FLOAT, new_selling_price FLOAT, old_buying_price FLOAT, new_buying_price FLOAT, changed_at DATETIME DEFAULT CURRENT_TIMESTAMP, changed_by INTEGER REFERENCES users(id))",
        "ALTER TABLE orders ADD COLUMN callback_time DATETIME",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_promocode_per_store ON promo_codes (user_id, code)",
    ]:
        try:
            conn.execute(text(stmt))
            conn.commit()
        except Exception:
            conn.rollback()  # PostgreSQL: reset aborted transaction before next statement

# Seed cities on startup
seed()

# ── Ensure default admin exists (uses ADMIN_USERNAME / ADMIN_PASSWORD env vars) ──
_admin_user = os.environ.get("ADMIN_USERNAME", "")
_admin_pass = os.environ.get("ADMIN_PASSWORD", "")
_admin_store = os.environ.get("ADMIN_STORE", "My Store")
if _admin_user and _admin_pass:
    from auth import hash_password
    with next(get_db()) as _db:
        _existing = _db.query(models.User).filter(models.User.username == _admin_user).first()
        if _existing:
            _existing.password_hash = hash_password(_admin_pass)
        else:
            _db.add(models.User(
                username=_admin_user,
                password_hash=hash_password(_admin_pass),
                store_name=_admin_store,
                role="admin",
                is_approved=True,
            ))
        _db.commit()

app = FastAPI(title="Stocky API", version="1.0.0")

# ── APScheduler: follow-up job for leads ──────────────────────────────────────
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from routers.leads import run_follow_up_job
    from datetime import datetime as _dt, timedelta as _td

    _scheduler = BackgroundScheduler()

    def _follow_up_task():
        db = next(get_db())
        try:
            run_follow_up_job(db)
        finally:
            db.close()

    def _cleanup_old_leads():
        from database import SessionLocal
        db = SessionLocal()
        try:
            cutoff = _dt.now() - _td(days=30)
            db.query(models.Lead).filter(
                models.Lead.status == "pending",
                models.Lead.created_at < cutoff,
                models.Lead.order_id.is_(None),
            ).delete()
            db.commit()
        finally:
            db.close()

    _scheduler.add_job(_follow_up_task, "interval", minutes=30)
    _scheduler.add_job(_cleanup_old_leads, "interval", hours=24)
    _scheduler.start()
except ImportError:
    pass  # apscheduler not installed yet

# CORS — allow React frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(products.router, prefix="/api")
app.include_router(stock.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(team.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(packs.router, prefix="/api")
app.include_router(auth_router.router, prefix="/api")
app.include_router(cities_router.router, prefix="/api")
app.include_router(platform_router.router, prefix="/api")
app.include_router(leads_router.router, prefix="/api")
app.include_router(suppliers_router.router, prefix="/api")
app.include_router(olivraison_router.router, prefix="/api")
app.include_router(youcan_router.router, prefix="/api")
app.include_router(woocommerce_router.router, prefix="/api")
app.include_router(shopify_router.router, prefix="/api")
app.include_router(meta_ads_router.router, prefix="/api")
app.include_router(tiktok_ads_router.router, prefix="/api")
app.include_router(snapchat_ads_router.router, prefix="/api")
app.include_router(pinterest_ads_router.router, prefix="/api")
app.include_router(google_ads_router.router, prefix="/api")
app.include_router(offers_router.router, prefix="/api")
app.include_router(promo_codes_router.router, prefix="/api")
app.include_router(bot_router.router, prefix="/api")
app.include_router(campaign_connections_router.router, prefix="/api")
app.include_router(warehouses_router.router, prefix="/api")
app.include_router(forcelog_router.router, prefix="/api")
app.include_router(rex_router)  # Rex sets its own /api/rex prefix


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Stocky"}


@app.get("/order-form", include_in_schema=False)
def order_form():
    path = os.path.join(os.path.dirname(__file__), "order-form.html")
    return FileResponse(path)


@app.get("/landing", include_in_schema=False)
def landing_page():
    path = os.path.join(os.path.dirname(__file__), "landing.html")
    return FileResponse(path)


@app.get("/api/settings/{key}")
def get_setting(key: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    setting = db.query(models.AppSettings).filter(models.AppSettings.key == key, models.AppSettings.user_id == user.id).first()
    if not setting:
        return {"key": key, "value": None}
    return {"key": key, "value": setting.value}


@app.post("/api/settings/{key}")
def set_setting(key: str, value: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if key == 'store_logo' and len(value) > 500_000:
        raise HTTPException(status_code=400, detail="Logo too large. Please use an image under 375KB.")
    setting = db.query(models.AppSettings).filter(models.AppSettings.key == key, models.AppSettings.user_id == user.id).first()
    if setting:
        setting.value = value
    else:
        setting = models.AppSettings(key=key, value=value, user_id=user.id)
        db.add(setting)
    db.commit()
    return {"success": True}


# Serve uploaded files (product images, etc.)
_uploads = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(_uploads, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads), name="uploads")

# Serve React frontend (production build)
_dist = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        return FileResponse(os.path.join(_dist, "index.html"))
