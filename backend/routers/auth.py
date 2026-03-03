from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from auth import hash_password, verify_password, create_token, get_current_user
import models
import os, httpx, secrets, string

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterInput(BaseModel):
    username: str
    store_name: str
    password: str


class LoginInput(BaseModel):
    username: str
    password: str


@router.post("/register")
def register(data: RegisterInput, db: Session = Depends(get_db)):
    if len(data.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not data.store_name.strip():
        raise HTTPException(status_code=400, detail="Store name is required")

    existing = db.query(models.User).filter(models.User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = models.User(
        username=data.username.lower().strip(),
        store_name=data.store_name.strip(),
        password_hash=hash_password(data.password),
        is_approved=True,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Auto-create a free subscription for the new store
    subscription = models.Subscription(store_id=user.id, plan="free", status="active")
    db.add(subscription)
    db.commit()

    token = create_token(user.id)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "store_name": user.store_name,
            "role": user.role or "admin",
            "store_id": user.store_id,
            "team_member_id": user.team_member_id,
        },
    }


@router.post("/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username.lower().strip()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Your account is pending approval")

    token = create_token(user.id)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "store_name": user.store_name,
            "role": user.role or "admin",
            "store_id": user.store_id,
            "team_member_id": user.team_member_id,
        },
    }


@router.get("/me")
def me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "store_name": current_user.store_name,
        "role": current_user.role or "admin",
        "store_id": current_user.store_id,
        "team_member_id": current_user.team_member_id,
    }


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str


class UpdateStoreInput(BaseModel):
    store_name: str


@router.post("/change-password")
def change_password(data: ChangePasswordInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"success": True}


GOOGLE_CLIENT_ID = os.environ.get(
    "GOOGLE_CLIENT_ID",
    "10012394157-7dbqola147563ak63qcogb92i59d0kh0.apps.googleusercontent.com",
)


class GoogleLoginInput(BaseModel):
    access_token: str


@router.post("/google")
def google_login(data: GoogleLoginInput, db: Session = Depends(get_db)):
    # Verify by fetching user info from Google
    r = httpx.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {data.access_token}"},
    )
    if r.status_code != 200:
        raise HTTPException(status_code=400, detail="Invalid Google token")
    info = r.json()

    google_id = info.get("id")
    google_email = info.get("email", "")
    google_name = info.get("name") or info.get("given_name") or "User"

    # 1. Look up by google_id
    user = db.query(models.User).filter(models.User.google_id == google_id).first()

    if not user and google_email:
        # 2. Link existing account by email
        user = db.query(models.User).filter(models.User.google_email == google_email).first()
        if user:
            user.google_id = google_id
            db.commit()

    if not user:
        # 3. Create new account
        base = google_email.split("@")[0].lower() if google_email else "user"
        base = "".join(c for c in base if c.isalnum() or c == "_")[:20] or "user"
        username = base
        counter = 1
        while db.query(models.User).filter(models.User.username == username).first():
            username = f"{base}{counter}"
            counter += 1

        rand_pwd = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
        user = models.User(
            username=username,
            store_name=google_name,
            password_hash=hash_password(rand_pwd),
            is_approved=True,
            is_admin=False,
            google_id=google_id,
            google_email=google_email,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        db.add(models.Subscription(store_id=user.id, plan="free", status="active"))
        db.commit()

    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Your account is pending approval")

    token = create_token(user.id)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "store_name": user.store_name,
            "role": user.role or "admin",
            "store_id": user.store_id,
            "team_member_id": user.team_member_id,
        },
    }


@router.patch("/update-store")
def update_store(data: UpdateStoreInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Not authorized")
    if not data.store_name.strip():
        raise HTTPException(status_code=400, detail="Store name is required")
    user.store_name = data.store_name.strip()
    db.commit()
    return {"store_name": user.store_name}


class UpdateUsernameInput(BaseModel):
    username: str

@router.patch("/update-username")
def update_username(data: UpdateUsernameInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    new = data.username.lower().strip()
    if len(new) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if new != user.username:
        existing = db.query(models.User).filter(models.User.username == new).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
    user.username = new
    db.commit()
    return {"username": user.username}
