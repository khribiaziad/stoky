import io
import re
import uuid
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, SessionLocal
from auth import get_current_user
import models

router = APIRouter(prefix="/cities", tags=["cities"])

# ── Background job state ───────────────────────────────────────────────────────
_executor = ThreadPoolExecutor(max_workers=2)
_jobs: dict = {}   # job_id -> { status, progress, pages_done, pages_total, result, error }

MAX_PAGES = 150    # safety cap


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class CityInput(BaseModel):
    name: str
    delivery_fee: float
    return_fee: float
    is_casa: bool = False


# ── PDF helpers ────────────────────────────────────────────────────────────────

def _clean_number(s):
    if s is None:
        return None
    s = str(s).strip()
    s = re.sub(r'[A-Za-z\s]', '', s)
    s = s.replace(',', '.').strip()
    s = re.sub(r'\.(?=.*\.)', '', s)
    try:
        v = float(s)
        return v if v >= 0 else None
    except Exception:
        return None


def _looks_like_city(s) -> bool:
    if not s:
        return False
    s = str(s).strip()
    if len(s) < 2 or len(s) > 60:
        return False
    if re.match(r'^\d+[\.,]?\d*$', s):
        return False
    if not re.search(r'[A-Za-zÀ-ÿ\u0600-\u06FF]', s):
        return False
    skip = {'ville', 'city', 'destination', 'wilaya', 'region', 'livraison',
            'delivery', 'retour', 'return', 'tarif', 'prix', 'frais', 'fee',
            'name', 'nom', 'total', 'zone', 'localite', 'localité', 'agence'}
    if s.lower() in skip:
        return False
    return True


def _detect_columns(header_row):
    if not header_row:
        return None
    city_col = delivery_col = return_col = None
    city_kw    = {'ville', 'city', 'destination', 'nom', 'name', 'localité', 'localite'}
    deliver_kw = {'livraison', 'delivery', 'tarif', 'prix', 'frais livraison', 'domicile'}
    return_kw  = {'retour', 'return', 'frais retour', 'prix retour', 'reprise'}
    for i, cell in enumerate(header_row):
        if cell is None:
            continue
        c = str(cell).strip().lower()
        if any(k in c for k in city_kw):
            city_col = i
        elif any(k in c for k in deliver_kw) and delivery_col is None:
            delivery_col = i
        elif any(k in c for k in return_kw):
            return_col = i
    if city_col is not None and delivery_col is not None:
        return city_col, delivery_col, return_col
    return None


def _parse_table(table):
    if not table or len(table) < 2:
        return []
    results = []
    col_info = _detect_columns(table[0])
    if col_info:
        city_col, delivery_col, return_col = col_info
        for row in table[1:]:
            if len(row) <= max(city_col, delivery_col):
                continue
            name = str(row[city_col] or '').strip()
            if not _looks_like_city(name):
                continue
            d = _clean_number(row[delivery_col])
            r = _clean_number(row[return_col]) if return_col is not None and return_col < len(row) else None
            if d is not None:
                results.append((name, d, r or 0.0))
    else:
        for row in table:
            if not row:
                continue
            city_name = city_idx = None
            for i, cell in enumerate(row):
                if _looks_like_city(cell):
                    city_name = str(cell).strip()
                    city_idx = i
                    break
            if city_name is None:
                continue
            nums = []
            for cell in row[city_idx + 1:]:
                v = _clean_number(cell)
                if v is not None and v > 0:
                    nums.append(v)
            if nums:
                results.append((city_name, nums[0], nums[1] if len(nums) > 1 else 0.0))
    return results


def _parse_text_lines(text):
    results = []
    pattern = re.compile(
        r'^([A-Za-zÀ-ÿ\u0600-\u06FF][A-Za-zÀ-ÿ\u0600-\u06FF\s\'\-\.]{1,40}?)'
        r'\s+(\d+[\.,]?\d*)\s*(?:MAD|DH|dh|mad)?\s*[\|\-,;]?\s*(\d+[\.,]?\d*)?',
        re.IGNORECASE | re.MULTILINE
    )
    for m in pattern.finditer(text):
        name = m.group(1).strip(' \t-|,;')
        if not _looks_like_city(name):
            continue
        d = _clean_number(m.group(2))
        r = _clean_number(m.group(3)) if m.group(3) else 0.0
        if d and d > 0:
            results.append((name, d, r or 0.0))
    return results


def _parse_page(page):
    try:
        tables = page.extract_tables()
        if tables:
            entries = []
            for table in tables:
                entries.extend(_parse_table(table))
            return entries
        return _parse_text_lines(page.extract_text() or '')
    except Exception:
        return []


# ── Background worker ──────────────────────────────────────────────────────────

def _do_parse_and_save(job_id: str, content: bytes):
    """Runs in a thread pool — creates its own DB session."""
    import pdfplumber
    db = SessionLocal()
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            pages = pdf.pages[:MAX_PAGES]
            total = max(len(pages), 1)
            entries = []
            for i, page in enumerate(pages):
                entries.extend(_parse_page(page))
                _jobs[job_id].update({
                    "pages_done": i + 1,
                    "pages_total": total,
                    "progress": int((i + 1) / total * 90),
                })

        # Deduplicate (last occurrence wins)
        seen = {}
        for name, d, r in entries:
            seen[name.title()] = (d, r)

        _jobs[job_id]["progress"] = 95

        if not seen:
            raise ValueError(
                "No city/fee data found. Make sure the PDF has a table with city names and delivery fees."
            )

        added = updated = 0
        for name, (delivery_fee, return_fee) in seen.items():
            existing = db.query(models.City).filter(models.City.name == name).first()
            if existing:
                existing.delivery_fee = delivery_fee
                existing.return_fee = return_fee
                updated += 1
            else:
                db.add(models.City(name=name, delivery_fee=delivery_fee,
                                   return_fee=return_fee, is_casa=False))
                added += 1

        db.commit()
        _jobs[job_id].update({
            "status": "done",
            "progress": 100,
            "result": {"added": added, "updated": updated, "total": added + updated},
        })
    except Exception as e:
        db.rollback()
        _jobs[job_id].update({"status": "error", "error": str(e)})
    finally:
        db.close()


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("")
def list_cities(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return db.query(models.City).order_by(models.City.name).all()


@router.post("/upload-pdf")
async def upload_city_pdf(
    file: UploadFile = File(...),
    user: models.User = Depends(get_current_user),
):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Not authorized")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    content = await file.read()
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "pages_done": 0,
        "pages_total": None,
        "result": None,
        "error": None,
    }

    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _do_parse_and_save, job_id, content)

    return {"job_id": job_id}


@router.get("/pdf-job/{job_id}")
def get_pdf_job(job_id: str, user: models.User = Depends(get_current_user)):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("")
def create_city(data: CityInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Not authorized")
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="City name is required")
    existing = db.query(models.City).filter(models.City.name == data.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="City already exists")
    city = models.City(name=data.name.strip(), delivery_fee=data.delivery_fee,
                       return_fee=data.return_fee, is_casa=data.is_casa)
    db.add(city)
    db.commit()
    db.refresh(city)
    return city


@router.put("/{city_id}")
def update_city(city_id: int, data: CityInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Not authorized")
    city = db.query(models.City).filter(models.City.id == city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    city.name = data.name.strip()
    city.delivery_fee = data.delivery_fee
    city.return_fee = data.return_fee
    city.is_casa = data.is_casa
    db.commit()
    db.refresh(city)
    return city


@router.delete("/{city_id}")
def delete_city(city_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Not authorized")
    city = db.query(models.City).filter(models.City.id == city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    db.delete(city)
    db.commit()
    return {"success": True}
