from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from database import engine, get_db
from sqlalchemy import text
from sqlalchemy.orm import Session
import models
from routers import products, stock, orders, team, expenses, reports, packs, auth as auth_router, cities as cities_router
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
    ]:
        try:
            conn.execute(text(stmt))
            conn.commit()
        except Exception:
            pass  # column already exists

# Seed cities on startup
seed()

app = FastAPI(title="Stocky API", version="1.0.0")

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


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Stocky"}


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


# Serve React frontend (production build)
_dist = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        return FileResponse(os.path.join(_dist, "index.html"))
