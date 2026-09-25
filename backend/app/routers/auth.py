from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.deps import get_current_user
from app.models.user import User, RoleEnum, UserStatusEnum
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.schemas.auth import LoginRequest, TokenResponse, PasswordChangeRequest, CurrentUserResponse
from app.schemas.patient import PatientCreate
from app.models.audit import AuditLog
from app.services.face_service import face_service

router = APIRouter(prefix="/auth", tags=["Authentication & Profile"])

class QRLoginRequest(BaseModel):
    qr_token: str

class FaceLoginRequest(BaseModel):
    image_data: str
    role: Optional[str] = None

class RegisterFaceRequest(BaseModel):
    image_data: str
    user_id: Optional[int] = None

class GoogleLoginRequest(BaseModel):
    credential: Optional[str] = None
    email: Optional[str] = None
    google_id: Optional[str] = None
    role: Optional[str] = None

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    raw_ident = (login_data.email or "").strip()
    if not raw_ident:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address, username, or Patient ID is required."
        )

    # Multi-identifier lookup: Case-insensitive Email, Phone, Patient Code, or Doctor Code
    user = db.query(User).filter(
        or_(
            func.lower(User.email) == raw_ident.lower(),
            User.phone == raw_ident,
            User.id.in_(
                db.query(Patient.user_id).filter(
                    (func.upper(Patient.patient_code) == raw_ident.upper()) |
                    (Patient.patient_code == raw_ident)
                )
            ),
            User.id.in_(
                db.query(Doctor.user_id).filter(
                    (func.upper(Doctor.doctor_code) == raw_ident.upper()) |
                    (Doctor.doctor_code == raw_ident)
                )
            )
        )
    ).first()

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
        department=doctor_dept,
        face_auth_enabled=user.face_auth_enabled
    )

@router.post("/face-login", response_model=TokenResponse)
def face_login(req: FaceLoginRequest, db: Session = Depends(get_db)):
    """Authenticate registered FlowCare user via Live Camera or Photo Upload."""
    if not req.image_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face image provided. Please align your face in camera or upload a photo."
        )
    
    print("\n" + "=" * 60)
    print(f"[FACE-LOGIN] Initiating Face Recognition Login (Requested Role: {req.role or 'ANY'})")
    print("=" * 60)

    try:
        img = face_service.decode_image_data(req.image_data)
        print(f"[FACE-LOGIN] Image decoded: yes | Dimensions: {img.width}x{img.height} | Format: {img.format or 'RGB'}")
        query_vector = face_service.extract_face_vector(img)
        print(f"[FACE-LOGIN] Face detected: yes | Login embedding created: yes (vector length={len(query_vector)})")
    except ValueError as e:
        print(f"[FACE-LOGIN] Face detected: no | Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"[FACE-LOGIN] Image processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Please upload a valid JPG, JPEG, PNG, or WEBP image: {str(e)}"
        )

    # Strict Security Enforcement: Face Recognition is permitted ONLY for PATIENT authentication
    if req.role:
        role_upper = req.role.strip().upper()
        if role_upper != RoleEnum.PATIENT.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Face Recognition authentication is not permitted for {role_upper.capitalize()}. Please use Email and Password."
            )

    # Query active PATIENT users with face authentication registered
    query = db.query(User).filter(
        User.role == RoleEnum.PATIENT,
        User.face_auth_enabled == True,
        User.status == UserStatusEnum.ACTIVE
    )

    users = query.all()
    print(f"[FACE-LOGIN] Registered face retrieved: yes ({len(users)} registered candidate profiles found)")

    if not users:
        print("[FACE-LOGIN] Registered face retrieved: no (0 matching profiles in database)")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Face Recognition is not registered for this account. Please use Email + Password or register your face first."
        )
    
    best_user = None
    best_sim = 0.0
    
    for u in users:
        if not u.face_embedding:
            continue
        try:
            ver, stored_vector = face_service.deserialize_vector(u.face_embedding)
            if ver != 2:
                print(f"[FACE-LOGIN] Candidate {u.full_name} has legacy face template (v{ver}). Skipping legacy template.")
                continue
            sim = face_service.compute_similarity(query_vector, stored_vector)
            print(f"[FACE-LOGIN] Comparison performed: yes | Candidate: {u.full_name} | Role: {u.role.value} | Similarity score: {sim:.4f}")
            if sim > best_sim:
                best_sim = sim
                best_user = u
        except Exception as ex:
            print(f"[FACE-LOGIN] Error comparing vector for candidate {u.id}: {ex}")
            continue
    
    threshold = face_service.FACE_SIMILARITY_THRESHOLD
    print(f"[FACE-LOGIN] Comparison summary -> Best Candidate: {best_user.full_name if best_user else 'None'} | Score: {best_sim:.4f} | Required Threshold: {threshold}")

    # Required threshold for match
    if not best_user or best_sim < threshold:
        print(f"[FACE-LOGIN] Authentication result: FAILED (Best Score: {best_sim:.4f} < {threshold})")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Face not recognized. Please try again or use username and password."
        )
    
    print(f"[FACE-LOGIN] Authentication result: SUCCESS (Matched {best_user.full_name}, Role: {best_user.role.value}, Score: {best_sim:.4f})")

    # Role matching check if specified
    if req.role:
        expected_role = req.role.strip().upper()
        user_role_str = (best_user.role.value if hasattr(best_user.role, 'value') else str(best_user.role)).upper()
        if expected_role != user_role_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Face identified for {best_user.full_name}, but registered role is {user_role_str}, not {expected_role}."
            )
            
    # Audit log
    audit = AuditLog(
        user_id=best_user.id,
        action="FACE_AUTH_LOGIN",
        entity="User",
        entity_id=str(best_user.id),
        details=f"User {best_user.email} authenticated via Face Recognition (Similarity Score: {best_sim:.4f})."
    )
    db.add(audit)
    db.commit()

    access_token = create_access_token(subject=best_user.id, role=best_user.role.value)
    
    patient_id = best_user.patient_profile.id if best_user.patient_profile else None
    patient_code = best_user.patient_profile.patient_code if best_user.patient_profile else None
    doctor_id = best_user.doctor_profile.id if best_user.doctor_profile else None
    doctor_code = best_user.doctor_profile.doctor_code if best_user.doctor_profile else None
    doctor_dept = best_user.doctor_profile.specialization if best_user.doctor_profile else None

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=best_user.id,
        full_name=best_user.full_name,
        email=best_user.email,
        role=best_user.role,
        patient_id=patient_id,
        patient_code=patient_code,
        doctor_id=doctor_id,
        doctor_code=doctor_code,
        doctor_specialization=doctor_dept,
        department=doctor_dept,
        face_auth_enabled=best_user.face_auth_enabled
    )

@router.post("/register-face")
def register_face(
    req: RegisterFaceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Register or update face biometric profile for an authenticated user."""
    target_user = current_user
    if req.user_id and req.user_id != current_user.id:
        if current_user.role not in [RoleEnum.ADMIN, RoleEnum.RECEPTIONIST]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to register face for another user.")
    if target_user.role != RoleEnum.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Face Recognition registration is only available for Patient accounts."
        )

    if not req.image_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No face image provided.")

    try:
        img = face_service.decode_image_data(req.image_data)
        vec = face_service.extract_face_vector(img)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to process face: {str(e)}")

    target_user.face_embedding = face_service.serialize_vector(vec)
    target_user.face_auth_enabled = True
    target_user.face_registered_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "message": f"Face template registered successfully for {target_user.full_name}!",
        "user_id": target_user.id,
        "face_auth_enabled": True
    }

@router.post("/google-login", response_model=TokenResponse)
def google_login(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Authenticate FlowCare user via Google Sign-In / OAuth identity."""
    email = None
    sub = None

    if req.credential:
        try:
            from jose import jwt
            unverified_claims = jwt.get_unverified_claims(req.credential)
            email = unverified_claims.get("email")
            sub = unverified_claims.get("sub")
        except Exception:
            pass
    
    if not email and req.email:
        email = req.email.strip().lower()
    if not sub and req.google_id:
        sub = req.google_id.strip()

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google authentication payload. Email could not be verified."
        )
    
    user = db.query(User).filter(User.email.ilike(email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This Google account is not registered with FlowCare. Please contact the administrator."
        )

    if user.status != UserStatusEnum.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not active. Please contact hospital administration."
        )

    # Check role match if specified
    if req.role:
        expected_role = req.role.strip().upper()
        user_role_str = (user.role.value if hasattr(user.role, 'value') else str(user.role)).upper()
        if expected_role != user_role_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Google account recognized for {user.full_name}, but registered role is {user_role_str}, not {expected_role}."
            )

    if sub and not user.google_sub_id:
        user.google_sub_id = sub
        db.commit()

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="GOOGLE_AUTH_LOGIN",
        entity="User",
        entity_id=str(user.id),
        details=f"User {user.email} authenticated via Google Sign-In."
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

    if patient_in.face_image:
        print("\n" + "=" * 60)
        print(f"[FACE-REG] Processing Face Registration for: {user.full_name} ({user.email})")
        print("=" * 60)
        try:
            img = face_service.decode_image_data(patient_in.face_image)
            print(f"[FACE-REG] Image decoded: yes | Dimensions: {img.width}x{img.height} | Format: {img.format or 'RGB'}")
            vec = face_service.extract_face_vector(img)
            print(f"[FACE-REG] Face detected: yes | Registration embedding created: yes (vector length={len(vec)})")
            user.face_embedding = face_service.serialize_vector(vec)
            user.face_auth_enabled = True
            user.face_registered_at = datetime.now(timezone.utc)
            print("[FACE-REG] Registration embedding attached to user model successfully.")
        except ValueError as e:
            print(f"[FACE-REG] Face detected: no | Error: {str(e)}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            print(f"[FACE-REG] Face processing error: {str(e)}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to process face photo: {str(e)}")

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

    if user.face_auth_enabled:
        print(f"[FACE-REG] Registration embedding saved: yes | Persisted to DB for User ID: {user.id} | Email: {user.email}")

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
        department=None,
        face_auth_enabled=user.face_auth_enabled
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
        face_auth_enabled=current_user.face_auth_enabled,
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
