"""
Ahmed — Security
Reusable FastAPI dependencies for role enforcement.

Usage:
    from core.permissions import require_admin, require_confirmer, require_any_role

    @router.delete("/orders/{id}")
    def delete_order(user = Depends(require_admin)):
        ...

Every new endpoint that is admin-only adds one line.
Never write if user.role == "confirmer" inline again.

Both dependencies call get_current_user internally, so you do NOT need a
separate Depends(get_current_user) when using these.
"""

from fastapi import Depends, HTTPException
import models
from auth import get_current_user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    """
    Raises HTTP 403 if the authenticated user is not an admin.

    Use on any endpoint that must be restricted to store owners:
    product creation, team management, settings writes, key rotation, etc.

    Returns the authenticated User so the endpoint can use it directly.
    """
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_confirmer(user: models.User = Depends(get_current_user)) -> models.User:
    """
    Raises HTTP 403 if the authenticated user is not a confirmer.

    Use on endpoints that should only be accessible to confirmer-role accounts,
    such as confirmer-specific stats or order confirmation flows.

    Returns the authenticated User so the endpoint can use it directly.
    """
    if user.role != "confirmer":
        raise HTTPException(status_code=403, detail="Confirmer access required")
    return user


def require_any_role(user: models.User = Depends(get_current_user)) -> models.User:
    """
    Raises HTTP 403 if the authenticated user has an unrecognised role.

    Use on endpoints accessible to both admins and confirmers but that must
    block unauthenticated or super_admin-only access from hitting store logic.

    Valid roles: "admin", "confirmer".
    Anything else (e.g. "super_admin" acting on store data) is rejected.

    Returns the authenticated User so the endpoint can use it directly.
    """
    if user.role not in ("admin", "confirmer"):
        raise HTTPException(status_code=403, detail="Store account required")
    return user
