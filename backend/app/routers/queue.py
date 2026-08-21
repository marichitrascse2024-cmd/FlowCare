from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.deps import get_current_user, get_current_user_optional, require_roles
from app.models.user import User, RoleEnum
from app.models.queue import QueueEntry, QueueStatusEnum, PriorityEnum
from app.models.appointment import Appointment, AppointmentStatusEnum
from app.schemas.queue import CheckInRequest, QueueEntryOut, QueueStatusUpdate, QueueAdvanceResponse
from app.services.queue_service import queue_service

router = APIRouter(prefix="/queue", tags=["AI Queue Management & Check-In"])

def serialize_queue_entry(e: QueueEntry) -> QueueEntryOut:
    dept = ""
    doc_name = "Doctor"
    if e.doctor:
        dept = e.doctor.specialization or ""
        if e.doctor.user:
            raw_name = e.doctor.user.full_name
            doc_name = raw_name if raw_name.startswith("Dr.") else f"Dr. {raw_name}"
    elif e.appointment and e.appointment.doctor:
        dept = e.appointment.doctor.specialization or ""
        if e.appointment.doctor.user:
            raw_name = e.appointment.doctor.user.full_name
            doc_name = raw_name if raw_name.startswith("Dr.") else f"Dr. {raw_name}"

    pat_name = "Patient"
    pat_code = ""
    if e.patient:
        pat_code = e.patient.patient_code or ""
        if e.patient.user:
            pat_name = e.patient.user.full_name
    elif e.appointment and e.appointment.patient:
        pat_code = e.appointment.patient.patient_code or ""
        if e.appointment.patient.user:
            pat_name = e.appointment.patient.user.full_name

    room = e.room_number or (e.doctor.room_number if e.doctor else "Room 101")

    return QueueEntryOut(
        id=e.id,
        token_number=e.token_number,
        patient_id=e.patient_id,
        patient_name=pat_name,
        patient_code=pat_code,
        doctor_id=e.doctor_id,
        doctor_name=doc_name,
        department=dept,
        doctor_specialization=dept,
        room_number=room,
        appointment_id=e.appointment_id,
        status=e.status,
        priority=e.priority,
        queue_position=e.queue_position,
        estimated_wait_minutes=e.estimated_wait_minutes,
        estimated_wait_time=e.estimated_wait_minutes,
        check_in_time=e.check_in_time,
        called_time=e.called_time,
        consultation_start=e.consultation_start,
        consultation_end=e.consultation_end,
        notes=e.notes
    )

@router.post("/check-in", response_model=QueueEntryOut)
def check_in_patient(
    checkin_in: CheckInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient_id = checkin_in.patient_id
    doctor_id = checkin_in.doctor_id
    appointment_id = checkin_in.appointment_id

    # If appointment_id is given, extract patient and doctor if missing
    if appointment_id:
        appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
        patient_id = patient_id or appt.patient_id
        doctor_id = doctor_id or appt.doctor_id

    # If patient role self-check-in
    if current_user.role == RoleEnum.PATIENT:
        if not current_user.patient_profile:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Patient profile not found.")
        patient_id = current_user.patient_profile.id

    if not patient_id or not doctor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both patient_id and doctor_id (or a valid appointment_id) are required for check-in."
        )

    entry = queue_service.check_in_patient(
        db=db,
        patient_id=patient_id,
        doctor_id=doctor_id,
        appointment_id=appointment_id,
        priority=checkin_in.priority,
        notes=checkin_in.notes
    )

    return serialize_queue_entry(entry)

@router.get("", response_model=List[QueueEntryOut])
def list_queue(
    doctor_id: Optional[int] = None,
    status_filter: Optional[QueueStatusEnum] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    query = db.query(QueueEntry)

    # Scoping: If Doctor, filter to their queue
    if current_user and current_user.role == RoleEnum.DOCTOR and current_user.doctor_profile:
        query = query.filter(QueueEntry.doctor_id == current_user.doctor_profile.id)
    elif doctor_id:
        query = query.filter(QueueEntry.doctor_id == doctor_id)

    if status_filter:
        query = query.filter(QueueEntry.status == status_filter)
    else:
        # By default, show active queue (WAITING, CALLED, IN_CONSULTATION)
        query = query.filter(QueueEntry.status.in_([QueueStatusEnum.WAITING, QueueStatusEnum.CALLED, QueueStatusEnum.IN_CONSULTATION]))

    entries = query.all()

    # Sort so IN_CONSULTATION is first (1), CALLED is second (2), WAITING is third (3), then by queue_position ascending
    status_order = {
        QueueStatusEnum.IN_CONSULTATION: 1,
        QueueStatusEnum.CALLED: 2,
        QueueStatusEnum.WAITING: 3,
    }
    entries.sort(key=lambda e: (status_order.get(e.status, 4), e.queue_position if e.queue_position is not None else 999, e.created_at or 0))

    return [serialize_queue_entry(e) for e in entries]

@router.get("/patient/{patient_id}", response_model=Optional[QueueEntryOut])
def get_patient_live_queue(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    if current_user and current_user.role == RoleEnum.PATIENT and (not current_user.patient_profile or current_user.patient_profile.id != patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    entry = db.query(QueueEntry).filter(
        QueueEntry.patient_id == patient_id,
        QueueEntry.status.in_([QueueStatusEnum.WAITING, QueueStatusEnum.CALLED, QueueStatusEnum.IN_CONSULTATION])
    ).order_by(QueueEntry.created_at.desc()).first()

    if not entry:
        return None

    return serialize_queue_entry(entry)

@router.post("/advance/{doctor_id}", response_model=QueueAdvanceResponse)
def advance_doctor_queue(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.DOCTOR, RoleEnum.ADMIN, RoleEnum.RECEPTIONIST, RoleEnum.NURSE]))
):
    # If doctor, verify it's their own queue or admin
    if current_user.role == RoleEnum.DOCTOR and current_user.doctor_profile and current_user.doctor_profile.id != doctor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only advance your own queue.")

    res = queue_service.advance_queue(db=db, doctor_id=doctor_id)
    
    next_entry_out = None
    if res.get("next_entry"):
        ne = res["next_entry"]
        next_entry_out = serialize_queue_entry(ne)

    return QueueAdvanceResponse(
        message=res["message"],
        current_token=res.get("current_token"),
        next_token=res.get("completed_token"),
        queue_entry=next_entry_out
    )

@router.put("/{queue_id}/status", response_model=QueueEntryOut)
def update_queue_status(
    queue_id: int,
    status_in: QueueStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.DOCTOR, RoleEnum.RECEPTIONIST, RoleEnum.NURSE]))
):
    entry = queue_service.update_entry_status(db, queue_id, status_in.status, status_in.notes)
    return serialize_queue_entry(entry)
