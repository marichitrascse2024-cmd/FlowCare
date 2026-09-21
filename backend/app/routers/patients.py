from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.security import get_password_hash
from app.core.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum, UserStatusEnum
from app.models.patient import Patient
from app.schemas.patient import PatientCreate, PatientUpdate, PatientOut

router = APIRouter(prefix="/patients", tags=["Patient Management"])

@router.get("", response_model=List[PatientOut])
def list_patients(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # If patient, only return own profile
    if current_user.role == RoleEnum.PATIENT:
        if not current_user.patient_profile:
            return []
        p = current_user.patient_profile
        return [PatientOut(
            id=p.id,
            user_id=p.user_id,
            patient_code=p.patient_code,
            full_name=current_user.full_name,
            email=current_user.email,
            phone=current_user.phone,
            date_of_birth=p.date_of_birth,
            gender=p.gender,
            blood_group=p.blood_group,
            address=p.address,
            emergency_contact_name=p.emergency_contact_name,
            emergency_contact_phone=p.emergency_contact_phone,
            medical_history_notes=p.medical_history_notes,
            known_allergies=p.known_allergies,
            insurance_provider=p.insurance_provider,
            insurance_policy_number=p.insurance_policy_number,
            created_at=p.created_at,
            updated_at=p.updated_at
        )]

    query = db.query(Patient).join(User)

    # If DOCTOR, scope to patients assigned to this doctor
    if current_user.role == RoleEnum.DOCTOR and current_user.doctor_profile:
        doc_id = current_user.doctor_profile.id
        from app.models.appointment import Appointment
        from app.models.queue import QueueEntry
        from app.models.medical_record import MedicalRecord

        appt_pat_ids = db.query(Appointment.patient_id).filter(Appointment.doctor_id == doc_id)
        queue_pat_ids = db.query(QueueEntry.patient_id).filter(QueueEntry.doctor_id == doc_id)
        rec_pat_ids = db.query(MedicalRecord.patient_id).filter(MedicalRecord.doctor_id == doc_id)

        query = query.filter(
            (Patient.id.in_(appt_pat_ids)) |
            (Patient.id.in_(queue_pat_ids)) |
            (Patient.id.in_(rec_pat_ids))
        )

    if search:
        query = query.filter(
            (Patient.patient_code.ilike(f"%{search}%")) |
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%")) |
            (User.phone.ilike(f"%{search}%")) |
            (Patient.blood_group.ilike(f"%{search}%"))
        )
    
    patients = query.order_by(Patient.created_at.desc()).offset(skip).limit(limit).all()
    results = []
    for p in patients:
        results.append(PatientOut(
            id=p.id,
            user_id=p.user_id,
            patient_code=p.patient_code,
            full_name=p.user.full_name if p.user else "Patient",
            email=p.user.email if p.user else "",
            phone=p.user.phone if p.user else None,
            date_of_birth=p.date_of_birth,
            gender=p.gender,
            blood_group=p.blood_group,
            address=p.address,
            emergency_contact_name=p.emergency_contact_name,
            emergency_contact_phone=p.emergency_contact_phone,
            medical_history_notes=p.medical_history_notes,
            known_allergies=p.known_allergies,
            insurance_provider=p.insurance_provider,
            insurance_policy_number=p.insurance_policy_number,
            created_at=p.created_at,
            updated_at=p.updated_at
        ))
    return results

@router.post("", response_model=PatientOut)
def create_patient(
    patient_in: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.RECEPTIONIST]))
):
    existing = db.query(User).filter(User.email == patient_in.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists.")

    user = User(
        full_name=patient_in.full_name,
        email=patient_in.email,
        phone=patient_in.phone,
        password_hash=get_password_hash(patient_in.password or "Patient@123"),
        role=RoleEnum.PATIENT,
        status=UserStatusEnum.ACTIVE
    )

    if patient_in.face_image:
        from app.services.face_service import face_service
        try:
            img = face_service.decode_image_data(patient_in.face_image)
            vec = face_service.extract_face_vector(img)
            user.face_embedding = face_service.serialize_vector(vec)
            user.face_auth_enabled = True
            user.face_registered_at = datetime.now(timezone.utc)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to process face photo: {str(e)}")

    db.add(user)
    db.flush()

    patient_count = db.query(Patient).count()
    patient_code = f"PAT-2026-{1001 + patient_count}"

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
        insurance_provider=patient_in.insurance_provider,
        insurance_policy_number=patient_in.insurance_policy_number,
        qr_token=qr_token,
        qr_created_at=datetime.now(timezone.utc)
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    return PatientOut(
        id=patient.id,
        user_id=patient.user_id,
        patient_code=patient.patient_code,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        blood_group=patient.blood_group,
        address=patient.address,
        emergency_contact_name=patient.emergency_contact_name,
        emergency_contact_phone=patient.emergency_contact_phone,
        medical_history_notes=patient.medical_history_notes,
        known_allergies=patient.known_allergies,
        insurance_provider=patient.insurance_provider,
        insurance_policy_number=patient.insurance_policy_number,
        created_at=patient.created_at,
        updated_at=patient.updated_at
    )

@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    # Authorization: Patient can only view own record
    if current_user.role == RoleEnum.PATIENT and (not current_user.patient_profile or current_user.patient_profile.id != patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. You can only view your own records.")

    return PatientOut(
        id=patient.id,
        user_id=patient.user_id,
        patient_code=patient.patient_code,
        full_name=patient.user.full_name if patient.user else "Patient",
        email=patient.user.email if patient.user else "",
        phone=patient.user.phone if patient.user else None,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        blood_group=patient.blood_group,
        address=patient.address,
        emergency_contact_name=patient.emergency_contact_name,
        emergency_contact_phone=patient.emergency_contact_phone,
        medical_history_notes=patient.medical_history_notes,
        known_allergies=patient.known_allergies,
        insurance_provider=patient.insurance_provider,
        insurance_policy_number=patient.insurance_policy_number,
        created_at=patient.created_at,
        updated_at=patient.updated_at
    )

@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int,
    patient_in: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    if current_user.role == RoleEnum.PATIENT and (not current_user.patient_profile or current_user.patient_profile.id != patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if patient_in.date_of_birth is not None:
        patient.date_of_birth = patient_in.date_of_birth
    if patient_in.gender is not None:
        patient.gender = patient_in.gender
    if patient_in.blood_group is not None:
        patient.blood_group = patient_in.blood_group
    if patient_in.address is not None:
        patient.address = patient_in.address
    if patient_in.emergency_contact_name is not None:
        patient.emergency_contact_name = patient_in.emergency_contact_name
    if patient_in.emergency_contact_phone is not None:
        patient.emergency_contact_phone = patient_in.emergency_contact_phone
    if patient_in.medical_history_notes is not None:
        patient.medical_history_notes = patient_in.medical_history_notes
    if patient_in.known_allergies is not None:
        patient.known_allergies = patient_in.known_allergies
    if patient_in.insurance_provider is not None:
        patient.insurance_provider = patient_in.insurance_provider
    if patient_in.insurance_policy_number is not None:
        patient.insurance_policy_number = patient_in.insurance_policy_number

    if patient.user:
        if patient_in.full_name is not None:
            patient.user.full_name = patient_in.full_name
        if patient_in.phone is not None:
            patient.user.phone = patient_in.phone

    db.commit()
    db.refresh(patient)

    return PatientOut(
        id=patient.id,
        user_id=patient.user_id,
        patient_code=patient.patient_code,
        full_name=patient.user.full_name if patient.user else "Patient",
        email=patient.user.email if patient.user else "",
        phone=patient.user.phone if patient.user else None,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        blood_group=patient.blood_group,
        address=patient.address,
        emergency_contact_name=patient.emergency_contact_name,
        emergency_contact_phone=patient.emergency_contact_phone,
        medical_history_notes=patient.medical_history_notes,
        known_allergies=patient.known_allergies,
        insurance_provider=patient.insurance_provider,
        insurance_policy_number=patient.insurance_policy_number,
        created_at=patient.created_at,
        updated_at=patient.updated_at
    )
