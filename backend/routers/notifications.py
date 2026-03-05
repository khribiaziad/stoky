from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _get_store_id(user: models.User) -> int:
    return user.store_id if user.role == "confirmer" else user.id


def _create_notification(db: Session, store_id: int, order: models.Order, message: str, notif_type: str):
    n = models.Notification(
        store_id=store_id,
        order_id=order.id,
        caleo_id=order.caleo_id,
        customer_name=order.customer_name,
        message=message,
        type=notif_type,
    )
    db.add(n)


@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = _get_store_id(user)
    items = (
        db.query(models.Notification)
        .filter_by(store_id=sid)
        .order_by(models.Notification.created_at.desc())
        .limit(50)
        .all()
    )
    unread = sum(1 for n in items if not n.is_read)
    return {
        "unread": unread,
        "notifications": [
            {
                "id": n.id,
                "order_id": n.order_id,
                "caleo_id": n.caleo_id,
                "customer_name": n.customer_name,
                "message": n.message,
                "type": n.type,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in items
        ],
    }


@router.patch("/{notif_id}/read")
def mark_read(
    notif_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = _get_store_id(user)
    n = db.query(models.Notification).filter_by(id=notif_id, store_id=sid).first()
    if n:
        n.is_read = True
        db.commit()
    return {"ok": True}


@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    sid = _get_store_id(user)
    db.query(models.Notification).filter_by(store_id=sid, is_read=False).update({"is_read": True})
    db.commit()
    return {"ok": True}
