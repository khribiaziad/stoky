from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
from auth import get_current_user, get_store_id, hash_password
from services.calculations import calculate_months_in_range
import models

router = APIRouter(prefix="/team", tags=["team"])


class TeamMemberCreate(BaseModel):
    name: str
    role: Optional[str] = None
    payment_type: str
    fixed_monthly: float = 0
    per_order_rate: float = 0
    is_confirmer: bool = False
    start_date: Optional[str] = None


class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    payment_type: Optional[str] = None
    fixed_monthly: Optional[float] = None
    per_order_rate: Optional[float] = None
    is_confirmer: Optional[bool] = None
    end_date: Optional[str] = None
    is_active: Optional[bool] = None


class ConfirmerAccountCreate(BaseModel):
    username: str
    password: str
    role: str = "confirmer"


@router.get("")
def list_team(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    members = db.query(models.TeamMember).filter(models.TeamMember.user_id == get_store_id(user)).all()

    # Build a map: team_member_id → (username, role)
    account_users = db.query(models.User).filter(
        models.User.store_id == get_store_id(user),
        models.User.team_member_id != None,
    ).all()
    account_map = {u.team_member_id: {"username": u.username, "role": u.role, "is_active": u.is_approved} for u in account_users}

    return [
        {
            "id": m.id,
            "name": m.name,
            "role": m.role,
            "payment_type": m.payment_type,
            "fixed_monthly": m.fixed_monthly,
            "per_order_rate": m.per_order_rate,
            "is_confirmer": m.is_confirmer,
            "confirmer_username": account_map.get(m.id, {}).get("username"),
            "account_role": account_map.get(m.id, {}).get("role"),
            "account_is_active": account_map.get(m.id, {}).get("is_active"),
            "start_date": m.start_date.isoformat() if m.start_date else None,
            "end_date": m.end_date.isoformat() if m.end_date else None,
            "is_active": m.is_active,
        }
        for m in members
    ]


@router.post("")
def create_team_member(data: TeamMemberCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if data.payment_type not in ("monthly", "per_order", "both"):
        raise HTTPException(status_code=400, detail="payment_type must be monthly, per_order, or both")
    member = models.TeamMember(
        user_id=user.id,
        name=data.name,
        role=data.role,
        payment_type=data.payment_type,
        fixed_monthly=data.fixed_monthly,
        per_order_rate=data.per_order_rate,
        is_confirmer=data.is_confirmer,
        start_date=datetime.fromisoformat(data.start_date) if data.start_date else datetime.now(),
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return {"id": member.id, "name": member.name}


@router.put("/{member_id}")
def update_team_member(member_id: int, data: TeamMemberUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    member = db.query(models.TeamMember).filter(models.TeamMember.id == member_id, models.TeamMember.user_id == user.id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if data.name is not None: member.name = data.name
    if data.role is not None: member.role = data.role
    if data.payment_type is not None: member.payment_type = data.payment_type
    if data.fixed_monthly is not None: member.fixed_monthly = data.fixed_monthly
    if data.per_order_rate is not None: member.per_order_rate = data.per_order_rate
    if data.end_date is not None: member.end_date = datetime.fromisoformat(data.end_date)
    if data.is_confirmer is not None: member.is_confirmer = data.is_confirmer
    if data.is_active is not None: member.is_active = data.is_active
    db.commit()
    return {"success": True}


@router.delete("/{member_id}")
def delete_team_member(member_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Confirmers cannot delete team members")
    member = db.query(models.TeamMember).filter(models.TeamMember.id == member_id, models.TeamMember.user_id == user.id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    db.delete(member)
    db.commit()
    return {"success": True}


@router.post("/{member_id}/create-account")
def create_confirmer_account(
    member_id: int,
    data: ConfirmerAccountCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Create a login account for a team member (makes them a confirmer)."""
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Only admins can create confirmer accounts")

    member = db.query(models.TeamMember).filter(
        models.TeamMember.id == member_id,
        models.TeamMember.user_id == user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    if data.role not in ("confirmer", "admin"):
        raise HTTPException(status_code=400, detail="role must be confirmer or admin")
    if len(data.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = db.query(models.User).filter(models.User.username == data.username.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Check if this member already has an account
    existing_account = db.query(models.User).filter(
        models.User.team_member_id == member_id,
    ).first()
    if existing_account:
        raise HTTPException(status_code=400, detail="This team member already has an account")

    confirmer = models.User(
        username=data.username.lower().strip(),
        store_name=user.store_name,
        password_hash=hash_password(data.password),
        is_approved=True,
        role=data.role,
        store_id=user.id,
        team_member_id=member_id,
    )
    db.add(confirmer)
    member.is_confirmer = True
    db.commit()
    db.refresh(confirmer)
    return {"success": True, "username": confirmer.username}


@router.post("/{member_id}/toggle-account")
def toggle_member_account(
    member_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Suspend or reactivate a team member's login. Data is never deleted."""
    if user.role == "confirmer":
        raise HTTPException(status_code=403, detail="Only admins can manage accounts")

    member = db.query(models.TeamMember).filter(
        models.TeamMember.id == member_id,
        models.TeamMember.user_id == get_store_id(user),
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    linked_user = db.query(models.User).filter(models.User.team_member_id == member_id).first()
    if not linked_user:
        raise HTTPException(status_code=404, detail="This member has no login account")

    linked_user.is_approved = not linked_user.is_approved
    db.commit()
    return {"is_active": linked_user.is_approved, "username": linked_user.username}


def _parse_period(period: Optional[str], start: Optional[str], end: Optional[str]):
    now = datetime.now()
    if period == "today":
        s = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return s, now
    elif period == "yesterday":
        y = now - timedelta(days=1)
        return y.replace(hour=0, minute=0, second=0, microsecond=0), y.replace(hour=23, minute=59, second=59)
    elif period == "this_week":
        s = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        return s, now
    elif period == "last_7_days":
        return now - timedelta(days=7), now
    elif period == "this_month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0), now
    elif period == "custom" and start and end:
        return datetime.fromisoformat(start), datetime.fromisoformat(end)
    return None, None


@router.get("/{member_id}/stats")
def get_member_stats(
    member_id: int,
    period: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    member = db.query(models.TeamMember).filter(
        models.TeamMember.id == member_id,
        models.TeamMember.user_id == get_store_id(user),
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    linked_user = db.query(models.User).filter(models.User.team_member_id == member_id).first()

    member_info = {
        "id": member.id,
        "name": member.name,
        "role": member.role,
        "payment_type": member.payment_type,
        "per_order_rate": member.per_order_rate,
        "fixed_monthly": member.fixed_monthly,
        "is_active": member.is_active,
        "start_date": member.start_date.isoformat() if member.start_date else None,
        "username": linked_user.username if linked_user else None,
        "account_role": linked_user.role if linked_user else None,
    }

    if not linked_user:
        return {
            "member": member_info,
            "has_account": False,
            "orders": {"total": 0, "delivered": 0, "cancelled": 0, "pending": 0,
                       "delivery_rate": 0, "return_rate": 0, "avg_order_value": 0},
            "earnings": 0,
            "revenue": 0,
        }

    s, e = _parse_period(period, start, end)

    q = db.query(models.Order).filter(models.Order.uploaded_by == linked_user.id)
    if s: q = q.filter(models.Order.order_date >= s)
    if e: q = q.filter(models.Order.order_date <= e)
    orders = q.all()

    total = len(orders)
    delivered = sum(1 for o in orders if o.status == "delivered")
    cancelled = sum(1 for o in orders if o.status == "cancelled")
    pending   = sum(1 for o in orders if o.status == "pending")
    total_for_rate = delivered + cancelled + pending
    revenue = sum(o.total_amount for o in orders if o.status == "delivered")

    # Earnings
    earnings = 0.0
    if member.payment_type in ("per_order", "both") and member.per_order_rate:
        earnings += member.per_order_rate * delivered
    if member.payment_type in ("monthly", "both") and member.fixed_monthly:
        months = calculate_months_in_range(s, e, member.start_date, member.end_date)
        earnings += member.fixed_monthly * months

    return {
        "member": member_info,
        "has_account": True,
        "orders": {
            "total": total,
            "delivered": delivered,
            "cancelled": cancelled,
            "pending": pending,
            "delivery_rate": round(delivered / total_for_rate * 100, 1) if total_for_rate > 0 else 0,
            "return_rate": round(cancelled / total_for_rate * 100, 1) if total_for_rate > 0 else 0,
            "avg_order_value": round(revenue / delivered, 1) if delivered > 0 else 0,
        },
        "earnings": round(earnings, 2),
        "revenue": round(revenue, 2),
    }
