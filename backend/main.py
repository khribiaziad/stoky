from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from database import engine, get_db
from sqlalchemy import text
from sqlalchemy.orm import Session
import models
from routers import products, stock, orders, team, expenses, reports, packs, auth as auth_router, cities as cities_router, platform as platform_router, leads as leads_router, suppliers as suppliers_router, olivraison as olivraison_router, youcan as youcan_router, woocommerce as woocommerce_router, shopify as shopify_router, forcelog as forcelog_router, notifications as notifications_router, ai as ai_router, import_excel as import_excel_router
from auth import get_current_user
from seed_cities import seed

# Create all tables
models.Base.metadata.create_all(bind=engine)

# Migrations — use IF NOT EXISTS so statements are fully idempotent on PostgreSQL.
# Each runs in its own connection so a failure never aborts the next statement.
_is_pg = (os.environ.get("DATABASE_URL", "").startswith("postgres"))

def _col(table, col, typedef):
    """Return an idempotent ADD COLUMN statement."""
    if _is_pg:
        return f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {typedef}"
    return f"ALTER TABLE {table} ADD COLUMN {col} {typedef}"  # SQLite: caught below

for _stmt in [
    _col("facebook_ads",   "platform",              "VARCHAR DEFAULT 'facebook'"),
    _col("facebook_ads",   "platform_id",            "INTEGER REFERENCES ad_platforms(id)"),
    _col("fixed_expenses", "category",               "VARCHAR DEFAULT 'other'"),
    _col("orders",         "notes",                  "TEXT"),
    _col("users",          "role",                   "TEXT DEFAULT 'admin'"),
    _col("subscriptions",  "notes",                  "TEXT"),
    _col("subscriptions",  "needs_renewal",          "BOOLEAN DEFAULT 0"),
    "CREATE TABLE IF NOT EXISTS platform_expenses (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, category VARCHAR DEFAULT 'other', amount FLOAT NOT NULL, currency VARCHAR DEFAULT 'MAD', type VARCHAR DEFAULT 'monthly', date DATETIME NOT NULL, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS store_api_keys (id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL UNIQUE REFERENCES users(id), key VARCHAR NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES users(id), customer_name VARCHAR NOT NULL, customer_phone VARCHAR NOT NULL, customer_email VARCHAR, customer_city VARCHAR, customer_address VARCHAR, raw_items JSON, matched_items JSON, total_amount FLOAT, notes TEXT, status VARCHAR DEFAULT 'pending', order_id INTEGER REFERENCES orders(id), message_count INTEGER DEFAULT 0, last_message_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    _col("broken_stock",   "user_id",                "INTEGER REFERENCES users(id)"),
    _col("products",       "supplier",               "VARCHAR"),
    _col("products",       "image_url",              "VARCHAR"),
    _col("variants",       "sku",                    "VARCHAR"),
    "CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name VARCHAR NOT NULL, phone VARCHAR, platform VARCHAR, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS supplier_payments (id INTEGER PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id), amount FLOAT NOT NULL, date DATETIME NOT NULL, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    _col("products",       "supplier_id",            "INTEGER REFERENCES suppliers(id)"),
    _col("users",          "google_id",              "VARCHAR"),
    _col("users",          "google_email",           "VARCHAR"),
    _col("orders",         "tracking_id",            "VARCHAR"),
    _col("orders",         "delivery_status",        "VARCHAR"),
    _col("orders",         "delivery_provider",      "VARCHAR"),
    _col("users",          "email",                  "VARCHAR"),
    _col("users",          "whatsapp",               "VARCHAR"),
    _col("users",          "reset_token",            "VARCHAR"),
    _col("users",          "reset_token_expires",    "TIMESTAMP"),
    _col("orders",         "caleo_id",               "VARCHAR"),
    _col("orders",         "reported_date",           "TIMESTAMP"),
    _col("leads",          "reported_date",           "TIMESTAMP"),
]:
    try:
        with engine.begin() as _conn:
            _conn.execute(text(_stmt))
        print(f"[migration] OK: {_stmt[:80]}")
    except Exception as _e:
        print(f"[migration] SKIP ({_e.__class__.__name__}): {_stmt[:80]}")

# Seed cities on startup
seed()

# ── Ensure default admin exists (uses ADMIN_USERNAME / ADMIN_PASSWORD env vars) ──
_admin_user = os.environ.get("ADMIN_USERNAME", "")
_admin_pass = os.environ.get("ADMIN_PASSWORD", "")
_admin_store = os.environ.get("ADMIN_STORE", "My Store")
if _admin_user and _admin_pass:
    from auth import hash_password
    from database import SessionLocal
    _db = SessionLocal()
    try:
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
    except Exception as e:
        _db.rollback()
        print(f"Warning: admin user setup failed: {e}")
    finally:
        _db.close()

# ── Ensure super admin exists (uses SUPER_ADMIN_USERNAME / SUPER_ADMIN_PASSWORD env vars) ──
_super_user = os.environ.get("SUPER_ADMIN_USERNAME", "")
_super_pass = os.environ.get("SUPER_ADMIN_PASSWORD", "")
if _super_user and _super_pass:
    from auth import hash_password as _hp
    from database import SessionLocal as _SL
    _db2 = _SL()
    try:
        _sexisting = _db2.query(models.User).filter(models.User.username == _super_user).first()
        if _sexisting:
            _sexisting.password_hash = _hp(_super_pass)
            _sexisting.role = "super_admin"
            _sexisting.is_approved = True
        else:
            _db2.add(models.User(
                username=_super_user,
                password_hash=_hp(_super_pass),
                store_name="Platform Admin",
                role="super_admin",
                is_approved=True,
            ))
        _db2.commit()
        print(f"[startup] Super admin '{_super_user}' ready")
    except Exception as _e2:
        _db2.rollback()
        print(f"Warning: super admin setup failed: {_e2}")
    finally:
        _db2.close()

app = FastAPI(title="Stocky API", version="1.0.0")

# ── APScheduler: follow-up job for leads ──────────────────────────────────────
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from routers.leads import run_follow_up_job

    _scheduler = BackgroundScheduler()

    def _follow_up_task():
        db = next(get_db())
        try:
            run_follow_up_job(db)
        finally:
            db.close()

    _scheduler.add_job(_follow_up_task, "interval", minutes=30)
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
app.include_router(import_excel_router.router, prefix="/api")
app.include_router(leads_router.router, prefix="/api")
app.include_router(suppliers_router.router, prefix="/api")
app.include_router(olivraison_router.router, prefix="/api")
app.include_router(forcelog_router.router, prefix="/api")
app.include_router(notifications_router.router, prefix="/api")
app.include_router(ai_router.router, prefix="/api")
app.include_router(youcan_router.router, prefix="/api")
app.include_router(woocommerce_router.router, prefix="/api")
app.include_router(shopify_router.router, prefix="/api")


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
