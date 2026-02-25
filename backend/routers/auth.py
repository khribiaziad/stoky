from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from auth import hash_password, verify_password, create_token, get_current_user
import models

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


@router.patch("/update-store")
def update_store(data: UpdateStoreInput, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Not authorized")
    if not data.store_name.strip():
        raise HTTPException(status_code=400, detail="Store name is required")
    user.store_name = data.store_name.strip()
    db.commit()
    return {"store_name": user.store_name}
