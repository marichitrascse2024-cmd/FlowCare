from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.deps import get_current_user
from app.models.user import User, RoleEnum, UserStatusEnum
from app.models.patient import Patient
from app.schemas.auth import LoginRequest, TokenResponse, PasswordChangeRequest, CurrentUserResponse
from app.schemas.patient import PatientCreate
from app.models.audit import AuditLog

router = APIRouter(prefix="/auth", tags=["Authentication & Profile"])

class QRLoginRequest(BaseModel):
    qr_token: str

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    
    # Enforce role matching if selected role is supplied
    if login_data.role:
        expected_role = login_data.role.strip().upper()
        user_role_str = (user.role.value if hasattr(user.role, 'value') else str(user.role)).upper()
        if expected_role != user_role_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials or role mismatch."
            )

    if user.status != UserStatusEnum.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not active. Please contact hospital administration."
        )
    
    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="USER_LOGIN",
        entity="User",
        entity_id=str(user.id),
        details=f"User {user.email} logged in with role {user.role.value}."
    )
    db.add(audit)
    db.commit()

    access_token = create_access_token(subject=user.id, role=user.role.value)
    
    patient_id = user.patient_profile.id if user.patient_profile else None
    patient_code = user.patient_profile.patient_code if user.patient_profile else None
    doctor_id = user.doctor_profile.id if user.doctor_profile else None
    doctor_code = user.doctor_profile.doctor_code if user.doctor_profile else None
    doctor_dept = user.doctor_profile.specialization if user.doctor_profile else None

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        patient_id=patient_id,
        patient_code=patient_code,
        doctor_id=doctor_id,
        doctor_code=doctor_code,
        doctor_specialization=doctor_dept,
        department=doctor_dept
    )

@router.post("/patient/qr-login", response_model=TokenResponse)
def patient_qr_login(login_data: QRLoginRequest, db: Session = Depends(get_db)):
    """Authenticate patient via scanned dynamic QR Code token."""
    from app.services.qr_service import qr_service
    try:
        return qr_service.patient_qr_login(db=db, qr_token=login_data.qr_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"QR authentication failed: {str(e)}"
        )

@router.post("/qr-login", response_model=TokenResponse)
def generic_qr_login(login_data: QRLoginRequest, db: Session = Depends(get_db)):
    """Alias for patient QR login."""
    return patient_qr_login(login_data, db)

@router.post("/register", response_model=TokenResponse)
def register_patient(patient_in: PatientCreate, db: Session = Depends(get_db)):
    # Check if email exists
    existing_user = db.query(User).filter(User.email == patient_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )
    
    # Create user
    user = User(
        full_name=patient_in.full_name,
        email=patient_in.email,
        phone=patient_in.phone,
        password_hash=get_password_hash(patient_in.password),
        role=RoleEnum.PATIENT,
        status=UserStatusEnum.ACTIVE
    )
    db.add(user)
    db.flush()

    # Generate patient code
    patient_count = db.query(Patient).count()
    patient_code = f"PAT{1001 + patient_count}"

    from app.services.qr_service import qr_service
    qr_token = qr_service.generate_patient_qr_token(patient_code)

    patient = Patient(
        user_id=user.id,
        patient_code=patient_code,
        date_of_birth=patient_in.date_of_birth,
        gender=patient_in.gender,
        blood_group=patient_in.blood_group,
        address=patient_in.address,
        city=patient_in.city,
        state=patient_in.state,
        emergency_contact_name=patient_in.emergency_contact_name,
        emergency_contact_phone=patient_in.emergency_contact_phone,
        medical_history_notes=patient_in.medical_history_notes,
        known_allergies=patient_in.known_allergies,
        qr_token=qr_token,
        qr_created_at=datetime.now(timezone.utc)
    )
    db.add(patient)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=user.id, role=user.role.value)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        patient_id=patient.id,
        patient_code=patient.patient_code,
        doctor_id=None,
        doctor_code=None,
        doctor_specialization=None,
        department=None
    )

@router.get("/me", response_model=CurrentUserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    patient_id = current_user.patient_profile.id if current_user.patient_profile else None
    patient_code = current_user.patient_profile.patient_code if current_user.patient_profile else None
    doctor_id = current_user.doctor_profile.id if current_user.doctor_profile else None
    doctor_code = current_user.doctor_profile.doctor_code if current_user.doctor_profile else None
    doctor_dept = current_user.doctor_profile.specialization if current_user.doctor_profile else None

    return CurrentUserResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        phone=current_user.phone,
        role=current_user.role,
        status=current_user.status,
        patient_id=patient_id,
        patient_code=patient_code,
        doctor_id=doctor_id,
        doctor_code=doctor_code,
        doctor_specialization=doctor_dept,
        department=doctor_dept,
        created_at=current_user.created_at
    )

@router.post("/change-password")
def change_password(
    data: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password does not match our records."
        )
    
    current_user.password_hash = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Password changed successfully."}
