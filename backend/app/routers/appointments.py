from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.appointment import Appointment, AppointmentStatusEnum
from app.models.patient import Patient
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentOut
from app.services.appointment_service import appointment_service
from app.services.doctor_delay import calculate_doctor_delay_minutes, shift_time_slot

router = APIRouter(prefix="/appointments", tags=["Appointment Management"])

def serialize_appointment(a: Appointment) -> AppointmentOut:
    dept = a.department or (a.doctor.specialization if a.doctor else "General")
    doc_name = a.doctor.user.full_name if (a.doctor and a.doctor.user) else "Doctor"
    if not doc_name.startswith("Dr."):
        doc_name = f"Dr. {doc_name}"

    pat_name = a.patient.user.full_name if (a.patient and a.patient.user) else "Patient"
    pat_code = a.patient.patient_code if a.patient else ""
    pat_phone = a.patient.user.phone if (a.patient and a.patient.user) else None

    # Calculate dynamic doctor delay in minutes and shifted time slot
    doc_delay = calculate_doctor_delay_minutes(a.doctor, a.appointment_date) if a.doctor else 0
    shifted_slot = shift_time_slot(a.time_slot, doc_delay)

    return AppointmentOut(
        id=a.id,
        appointment_number=a.appointment_number,
        patient_id=a.patient_id,
        patient_name=pat_name,
        patient_code=pat_code,
        patient_phone=pat_phone,
        doctor_id=a.doctor_id,
        doctor_name=doc_name,
        doctor_specialization=dept,
        department=dept,
        doctor_room=a.doctor.room_number if a.doctor else "",
        appointment_date=a.appointment_date,
        time_slot=a.time_slot,
        appointment_time=a.time_slot,
        status=a.status,
        appointment_status=a.status.value if hasattr(a.status, 'value') else str(a.status),
        appointment_type=a.appointment_type,
        chief_complaint=a.chief_complaint,
        notes=a.notes,
        cancellation_reason=a.cancellation_reason,
        ai_suggested=a.ai_suggested or "NO",
        queue_token=a.queue_entry.token_number if a.queue_entry else None,
        queue_status=a.queue_entry.status.value if a.queue_entry else None,
        doctor_delay_minutes=doc_delay,
        shifted_time_slot=shifted_slot,
        created_at=a.created_at,
        updated_at=a.updated_at
    )

@router.get("", response_model=List[AppointmentOut])
def list_appointments(
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    department: Optional[str] = None,
    appointment_date: Optional[date] = None,
    status_filter: Optional[AppointmentStatusEnum] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Appointment)

    # Role-based scoping
    if current_user.role == RoleEnum.PATIENT:
        if not current_user.patient_profile:
            return []
        query = query.filter(Appointment.patient_id == current_user.patient_profile.id)
    elif current_user.role == RoleEnum.DOCTOR:
        if current_user.doctor_profile:
            query = query.filter(Appointment.doctor_id == current_user.doctor_profile.id)
    else:
        # Admin / Receptionist / Nurse can filter
        if doctor_id:
            query = query.filter(Appointment.doctor_id == doctor_id)
        if patient_id:
            query = query.filter(Appointment.patient_id == patient_id)

    if department and department != "All Departments":
        query = query.filter(
            (Appointment.department.ilike(f"%{department}%")) |
            (Appointment.doctor.has(specialization=department))
        )

    if appointment_date:
        query = query.filter(Appointment.appointment_date == appointment_date)
    if status_filter:
        query = query.filter(Appointment.status == status_filter)

    appts = query.order_by(Appointment.appointment_date.desc(), Appointment.time_slot.asc()).offset(skip).limit(limit).all()
    return [serialize_appointment(a) for a in appts]

@router.post("", response_model=AppointmentOut)
def create_appointment(
    appt_in: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_patient_id = appt_in.patient_id

    # If current user is Patient, use their own profile ID
    if current_user.role == RoleEnum.PATIENT:
        if not current_user.patient_profile:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Patient profile not linked.")
        target_patient_id = current_user.patient_profile.id
    elif not target_patient_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="patient_id is required for staff booking.")

    appt = appointment_service.book_appointment(db, appt_in, patient_id=target_patient_id)
    return serialize_appointment(appt)

@router.get("/{appointment_id}", response_model=AppointmentOut)
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")

    if current_user.role == RoleEnum.PATIENT and (not current_user.patient_profile or current_user.patient_profile.id != a.patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return serialize_appointment(a)

@router.put("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: int,
    appt_update: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")

    if current_user.role == RoleEnum.PATIENT and (not current_user.patient_profile or current_user.patient_profile.id != a.patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    updated_appt = appointment_service.update_appointment(db, appointment_id, appt_update)
    return serialize_appointment(updated_appt)
