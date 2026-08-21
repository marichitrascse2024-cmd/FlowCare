from datetime import date, datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.security import get_password_hash
from app.core.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum, UserStatusEnum
from app.models.doctor import Doctor, DoctorSchedule
from app.models.appointment import Appointment, AppointmentStatusEnum
from app.schemas.doctor import DoctorCreate, DoctorUpdate, DoctorOut, DoctorScheduleCreate, DoctorScheduleOut

router = APIRouter(prefix="/doctors", tags=["Doctor Management"])

def serialize_doctor(d: Doctor) -> DoctorOut:
    raw_name = d.user.full_name if d.user else "Dr. Staff"
    doc_name = raw_name if raw_name.startswith("Dr.") else f"Dr. {raw_name}"
    return DoctorOut(
        id=d.id,
        user_id=d.user_id,
        doctor_code=d.doctor_code,
        full_name=doc_name,
        email=d.user.email if d.user else "",
        phone=d.user.phone if d.user else None,
        specialization=d.specialization,
        qualification=d.qualification,
        experience_years=d.experience_years,
        consultation_fee=d.consultation_fee,
        room_number=d.room_number,
        biography=d.biography,
        is_available=d.is_available,
        average_consultation_time=d.average_consultation_time,
        schedules=[DoctorScheduleOut(
            id=s.id,
            doctor_id=s.doctor_id,
            day_of_week=s.day_of_week,
            start_time=s.start_time,
            end_time=s.end_time,
            slot_duration=s.slot_duration,
            is_active=s.is_active
        ) for s in d.schedules] if d.schedules else [],
        created_at=d.created_at,
        updated_at=d.updated_at
    )

@router.get("", response_model=List[DoctorOut])
def list_doctors(
    specialization: Optional[str] = None,
    department: Optional[str] = None,
    is_available: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Doctor).join(User)
    
    dept_filter = specialization or department
    if dept_filter and dept_filter != "All Departments":
        query = query.filter(Doctor.specialization.ilike(f"%{dept_filter}%"))
    
    if is_available is not None:
        query = query.filter(Doctor.is_available == is_available)
    
    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) |
            (Doctor.specialization.ilike(f"%{search}%")) |
            (Doctor.doctor_code.ilike(f"%{search}%")) |
            (Doctor.room_number.ilike(f"%{search}%"))
        )

    doctors = query.order_by(Doctor.id.asc()).offset(skip).limit(limit).all()
    return [serialize_doctor(d) for d in doctors]

@router.get("/department/{department_name}", response_model=List[DoctorOut])
def get_doctors_by_department(
    department_name: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve and display ALL doctors belonging to a specific department from database.
    """
    query = db.query(Doctor).join(User)
    if department_name and department_name != "All Departments":
        query = query.filter(Doctor.specialization.ilike(f"%{department_name}%"))
    doctors = query.order_by(Doctor.id.asc()).all()
    return [serialize_doctor(d) for d in doctors]

@router.get("/{doctor_id}/slots")
def get_doctor_available_slots(
    doctor_id: int,
    date_str: Optional[str] = Query(None, alias="date"),
    db: Session = Depends(get_db)
):
    """
    Get available time slots for a specific doctor on a given date based on their schedule and existing bookings.
    """
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

    target_date = date.today()
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = date.today()

    standard_slots = [
        "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
        "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"
    ]

    # Fetch booked slots for this doctor on target date
    existing_appts = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == target_date,
        Appointment.status.notin_([AppointmentStatusEnum.CANCELLED])
    ).all()
    booked_set = {a.time_slot for a in existing_appts}

    slot_list = []
    for s in standard_slots:
        is_booked = s in booked_set
        slot_list.append({
            "time_slot": s,
            "is_available": not is_booked,
            "status": "BOOKED" if is_booked else "AVAILABLE"
        })

    return {
        "doctor_id": doctor.id,
        "doctor_name": doctor.user.full_name if doctor.user else "Doctor",
        "department": doctor.specialization,
        "appointment_date": str(target_date),
        "total_slots": len(slot_list),
        "available_slots_count": sum(1 for s in slot_list if s["is_available"]),
        "slots": slot_list
    }

@router.post("", response_model=DoctorOut)
def create_doctor(
    doc_in: DoctorCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([RoleEnum.ADMIN]))
):
    existing = db.query(User).filter(User.email == doc_in.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered.")

    user = User(
        full_name=doc_in.full_name,
        email=doc_in.email,
        phone=doc_in.phone,
        password_hash=get_password_hash(doc_in.password or "Doctor@123"),
        role=RoleEnum.DOCTOR,
        status=UserStatusEnum.ACTIVE
    )
    db.add(user)
    db.flush()

    doc_count = db.query(Doctor).count()
    doctor_code = f"DOC-2026-{101 + doc_count}"

    doctor = Doctor(
        user_id=user.id,
        doctor_code=doctor_code,
        specialization=doc_in.specialization,
        qualification=doc_in.qualification,
        experience_years=doc_in.experience_years,
        consultation_fee=doc_in.consultation_fee,
        room_number=doc_in.room_number,
        biography=doc_in.biography,
        is_available=doc_in.is_available,
        average_consultation_time=doc_in.average_consultation_time
    )
    db.add(doctor)
    db.flush()

    # Add default Mon-Fri schedule
    for day in range(5): # Mon-Fri
        schedule = DoctorSchedule(
            doctor_id=doctor.id,
            day_of_week=day,
            start_time="09:00",
            end_time="17:00",
            slot_duration=doctor.average_consultation_time,
            is_active=True
        )
        db.add(schedule)

    db.commit()
    db.refresh(doctor)
    return serialize_doctor(doctor)

@router.get("/{doctor_id}", response_model=DoctorOut)
def get_doctor(doctor_id: int, db: Session = Depends(get_db)):
    d = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")
    return serialize_doctor(d)

@router.put("/{doctor_id}", response_model=DoctorOut)
def update_doctor(
    doctor_id: int,
    doc_update: DoctorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    d = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

    if current_user.role != RoleEnum.ADMIN and (current_user.role != RoleEnum.DOCTOR or (current_user.doctor_profile and current_user.doctor_profile.id != doctor_id)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if doc_update.specialization is not None:
        d.specialization = doc_update.specialization
    if doc_update.qualification is not None:
        d.qualification = doc_update.qualification
    if doc_update.experience_years is not None:
        d.experience_years = doc_update.experience_years
    if doc_update.consultation_fee is not None:
        d.consultation_fee = doc_update.consultation_fee
    if doc_update.room_number is not None:
        d.room_number = doc_update.room_number
    if doc_update.biography is not None:
        d.biography = doc_update.biography
    if doc_update.is_available is not None:
        d.is_available = doc_update.is_available
    if doc_update.average_consultation_time is not None:
        d.average_consultation_time = doc_update.average_consultation_time

    if d.user:
        if doc_update.full_name is not None:
            d.user.full_name = doc_update.full_name
        if doc_update.phone is not None:
            d.user.phone = doc_update.phone

    db.commit()
    db.refresh(d)
    return serialize_doctor(d)
