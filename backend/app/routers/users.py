from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.security import get_password_hash
from app.core.deps import require_roles, get_current_user
from app.models.user import User, RoleEnum, UserStatusEnum
from app.models.patient import Patient
from app.schemas.user import UserCreate, UserUpdate, UserOut

router = APIRouter(prefix="/users", tags=["User Management (Admin)"])

@router.get("", response_model=List[UserOut])
def list_users(
    role: Optional[RoleEnum] = None,
    status: Optional[UserStatusEnum] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([RoleEnum.ADMIN]))
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)
    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%")) |
            (User.phone.ilike(f"%{search}%"))
        )
    return query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

@router.post("", response_model=UserOut)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([RoleEnum.ADMIN]))
):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered.")

    new_user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        phone=user_in.phone,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role,
        status=UserStatusEnum.ACTIVE
    )
    db.add(new_user)
    db.flush()

    if new_user.role == RoleEnum.PATIENT:
        patient_count = db.query(Patient).count()
        patient_code = f"PAT-2026-{1001 + patient_count}"
        from app.services.qr_service import qr_service
        qr_token = qr_service.generate_patient_qr_token(patient_code)
        patient = Patient(
            user_id=new_user.id,
            patient_code=patient_code,
            qr_token=qr_token,
            qr_created_at=datetime.now(timezone.utc)
        )
        db.add(patient)

    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([RoleEnum.ADMIN]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user

@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([RoleEnum.ADMIN]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    if user_update.phone is not None:
        user.phone = user_update.phone
    if user_update.status is not None:
        user.status = user_update.status
    if user_update.role is not None:
        user.role = user_update.role

    db.commit()
    db.refresh(user)
    return user
