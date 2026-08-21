from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.services.sync_service import sync_service

router = APIRouter(prefix="/sync", tags=["Cloud Synchronization"])

@router.get("/status")
def get_cloud_sync_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.DOCTOR, RoleEnum.RECEPTIONIST]))
):
    """Retrieve overall cloud synchronization status and audit records."""
    return sync_service.get_sync_status(db=db)

@router.post("/run")
def trigger_cloud_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.ADMIN]))
):
    """Manually trigger a cloud synchronization batch."""
    res = sync_service.run_sync_cycle(db=db)
    return res

@router.post("/retry")
def retry_failed_cloud_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.ADMIN]))
):
    """Retry all failed synchronization tasks."""
    res = sync_service.retry_failed_syncs(db=db)
    return res
