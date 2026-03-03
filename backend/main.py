from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from database import engine, get_db
from sqlalchemy import text
from sqlalchemy.orm import Session
import models
from routers import products, stock, orders, team, expenses, reports, packs, auth as auth_router, cities as cities_router, platform as platform_router, leads as leads_router, suppliers as suppliers_router, olivraison as olivraison_router, youcan as youcan_router, woocommerce as woocommerce_router, shopify as shopify_router, forcelog as forcelog_router
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
        "ALTER TABLE subscriptions ADD COLUMN needs_renewal BOOLEAN DEFAULT 0",
        "CREATE TABLE IF NOT EXISTS platform_expenses (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, category VARCHAR DEFAULT 'other', amount FLOAT NOT NULL, currency VARCHAR DEFAULT 'MAD', type VARCHAR DEFAULT 'monthly', date DATETIME NOT NULL, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS store_api_keys (id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL UNIQUE REFERENCES users(id), key VARCHAR NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES users(id), customer_name VARCHAR NOT NULL, customer_phone VARCHAR NOT NULL, customer_email VARCHAR, customer_city VARCHAR, customer_address VARCHAR, raw_items JSON, matched_items JSON, total_amount FLOAT, notes TEXT, status VARCHAR DEFAULT 'pending', order_id INTEGER REFERENCES orders(id), message_count INTEGER DEFAULT 0, last_message_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
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
app.include_router(leads_router.router, prefix="/api")
app.include_router(suppliers_router.router, prefix="/api")
app.include_router(olivraison_router.router, prefix="/api")
app.include_router(forcelog_router.router, prefix="/api")
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
