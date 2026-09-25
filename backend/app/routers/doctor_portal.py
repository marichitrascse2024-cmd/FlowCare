from datetime import datetime, timezone, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.doctor import Doctor
from app.models.appointment import Appointment, AppointmentStatusEnum
from app.models.queue import QueueEntry, QueueStatusEnum
from app.models.patient import Patient
from app.models.medical_record import MedicalRecord
from app.schemas.appointment import AppointmentOut
from app.schemas.queue import QueueEntryOut
from app.schemas.patient import PatientOut
from app.routers.appointments import serialize_appointment
from app.routers.queue import serialize_queue_entry
from app.services.doctor_delay import calculate_doctor_delay_minutes

router = APIRouter(prefix="/doctor", tags=["Doctor Dedicated Portal APIs"])

@router.post("/check-in")
def doctor_check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.DOCTOR]))
):
    """
    Doctor Check-In API.
    Records current date/time into last_check_in_at on the logged-in doctor profile.
    Safe to repeat; updates existing timestamp on same-day check-in.
    """
    if not current_user.doctor_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found for current logged-in user."
        )

    doc = current_user.doctor_profile
    now_utc = datetime.now(timezone.utc)

    doc.last_check_in_at = now_utc
    doc.is_available = True
    doc.updated_at = now_utc

    db.commit()
    db.refresh(doc)

    delay_mins = calculate_doctor_delay_minutes(doc, date.today())

    return {
        "message": "Doctor checked in successfully.",
        "doctor_id": doc.id,
        "check_in_time": doc.last_check_in_at,
        "doctor_delay_minutes": delay_mins
    }

@router.get("/profile")
def get_logged_in_doctor_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.DOCTOR]))
):
    if not current_user.doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found.")
    
    doc = current_user.doctor_profile
    delay_mins = calculate_doctor_delay_minutes(doc, date.today())
    return {
        "id": doc.id,
        "doctor_code": doc.doctor_code,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "department": doc.specialization,
        "specialization": doc.specialization,
        "qualification": doc.qualification,
        "experience_years": doc.experience_years,
        "consultation_fee": doc.consultation_fee,
        "room_number": doc.room_number,
        "biography": doc.biography,
        "is_available": doc.is_available,
        "last_check_in_at": doc.last_check_in_at,
        "doctor_delay_minutes": delay_mins
    }

@router.get("/appointments", response_model=List[AppointmentOut])
def get_logged_in_doctor_appointments(
    appointment_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.DOCTOR]))
):
    if not current_user.doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found.")

    doc_id = current_user.doctor_profile.id
    query = db.query(Appointment).filter(Appointment.doctor_id == doc_id)

    if appointment_date:
        query = query.filter(Appointment.appointment_date == appointment_date)

    appts = query.order_by(Appointment.appointment_date.desc(), Appointment.time_slot.asc()).all()
    return [serialize_appointment(a) for a in appts]

@router.get("/queue", response_model=List[QueueEntryOut])
def get_logged_in_doctor_queue(
    status_filter: Optional[QueueStatusEnum] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.DOCTOR]))
):
    if not current_user.doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found.")

    doc_id = current_user.doctor_profile.id
    query = db.query(QueueEntry).filter(QueueEntry.doctor_id == doc_id)

    if status_filter:
        query = query.filter(QueueEntry.status == status_filter)
    else:
        query = query.filter(QueueEntry.status.in_([QueueStatusEnum.WAITING, QueueStatusEnum.CALLED, QueueStatusEnum.IN_CONSULTATION]))

    entries = query.all()
    status_order = {
        QueueStatusEnum.IN_CONSULTATION: 1,
        QueueStatusEnum.CALLED: 2,
        QueueStatusEnum.WAITING: 3,
    }
    entries.sort(key=lambda e: (status_order.get(e.status, 4), e.queue_position if e.queue_position is not None else 999, e.created_at or 0))

    return [serialize_queue_entry(e) for e in entries]

@router.get("/patients", response_model=List[PatientOut])
def get_logged_in_doctor_assigned_patients(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.DOCTOR]))
):
    if not current_user.doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found.")

    doc_id = current_user.doctor_profile.id
    appt_pat_ids = db.query(Appointment.patient_id).filter(Appointment.doctor_id == doc_id)
    queue_pat_ids = db.query(QueueEntry.patient_id).filter(QueueEntry.doctor_id == doc_id)
    rec_pat_ids = db.query(MedicalRecord.patient_id).filter(MedicalRecord.doctor_id == doc_id)

    query = db.query(Patient).join(User).filter(
        (Patient.id.in_(appt_pat_ids)) |
        (Patient.id.in_(queue_pat_ids)) |
        (Patient.id.in_(rec_pat_ids))
    )

    if search:
        query = query.filter(
            (Patient.patient_code.ilike(f"%{search}%")) |
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%")) |
            (User.phone.ilike(f"%{search}%"))
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
