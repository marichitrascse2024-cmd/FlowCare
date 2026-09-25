from datetime import date, datetime, timezone
import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.scan_schedule import ScanSchedule, ScanTypeEnum, ScanStatusEnum
from app.schemas.scan_schedule import ScanScheduleCreate, ScanScheduleUpdate, ScanScheduleOut

router = APIRouter(prefix="/scan-schedules", tags=["Scan Scheduling Management"])

def generate_unique_scan_number(db: Session) -> str:
    """Generate a unique scan reference number like SCN-2026-1001."""
    year = datetime.now().year
    for _ in range(100):
        seq = random.randint(1000, 9999)
        code = f"SCN-{year}-{seq}"
        if not db.query(ScanSchedule).filter(ScanSchedule.scan_number == code).first():
            return code
    # Fallback timestamp based
    return f"SCN-{year}-{int(datetime.now().timestamp())}"

def serialize_scan_schedule(s: ScanSchedule) -> ScanScheduleOut:
    """Serialize ScanSchedule ORM model into Pydantic ScanScheduleOut."""
    patient_name = s.patient.user.full_name if (s.patient and s.patient.user) else None
    patient_code = s.patient.patient_code if s.patient else None
    patient_phone = s.patient.user.phone if (s.patient and s.patient.user) else None

    doctor_name = None
    doctor_specialization = None
    if s.doctor and s.doctor.user:
        doc_full = s.doctor.user.full_name
        doctor_name = doc_full if doc_full.startswith("Dr.") else f"Dr. {doc_full}"
        doctor_specialization = s.doctor.specialization

    return ScanScheduleOut(
        id=s.id,
        scan_number=s.scan_number,
        patient_id=s.patient_id,
        patient_name=patient_name,
        patient_code=patient_code,
        patient_phone=patient_phone,
        doctor_id=s.doctor_id,
        doctor_name=doctor_name,
        doctor_specialization=doctor_specialization,
        scan_type=s.scan_type,
        body_part=s.body_part,
        scan_date=s.scan_date,
        time_slot=s.time_slot,
        radiologist_technician=s.radiologist_technician,
        status=s.status,
        estimated_duration_minutes=s.estimated_duration_minutes,
        instructions=s.instructions,
        findings_summary=s.findings_summary,
        created_at=s.created_at,
        updated_at=s.updated_at
    )

@router.get("/slots")
def get_available_scan_slots(
    scan_type: Optional[ScanTypeEnum] = None,
    scan_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve available time slots for scan scheduling on a given date."""
    target_date = scan_date or date.today()
    all_slots = [
        "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM",
        "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
        "12:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
        "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM"
    ]

    query = db.query(ScanSchedule).filter(
        ScanSchedule.scan_date == target_date,
        ScanSchedule.status != ScanStatusEnum.CANCELLED
    )
    if scan_type:
        query = query.filter(ScanSchedule.scan_type == scan_type)

    existing_scans = query.all()
    booked_slots = {s.time_slot for s in existing_scans}

    slots_status = [
        {
            "time_slot": slot,
            "available": slot not in booked_slots
        }
        for slot in all_slots
    ]

    return {
        "date": target_date,
        "scan_type": scan_type.value if scan_type else None,
        "slots": slots_status,
        "available_slots": [s for s in all_slots if s not in booked_slots]
    }

@router.get("", response_model=List[ScanScheduleOut])
def list_scan_schedules(
    patient_id: Optional[int] = Query(None, alias="patient"),
    doctor_id: Optional[int] = Query(None, alias="doctor"),
    scan_type: Optional[ScanTypeEnum] = None,
    scan_date: Optional[date] = Query(None, alias="date"),
    status_filter: Optional[ScanStatusEnum] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List scan schedules with security scoping and flexible filtering."""
    query = db.query(ScanSchedule)

    # Security Scoping based on Role
    if current_user.role == RoleEnum.PATIENT:
        if not current_user.patient_profile:
            return []
        query = query.filter(ScanSchedule.patient_id == current_user.patient_profile.id)
    elif current_user.role == RoleEnum.DOCTOR:
        if current_user.doctor_profile:
            # Show scans referred by doctor or requested by patient filter
            if doctor_id:
                query = query.filter(ScanSchedule.doctor_id == doctor_id)
            else:
                query = query.filter(ScanSchedule.doctor_id == current_user.doctor_profile.id)
        if patient_id:
            query = query.filter(ScanSchedule.patient_id == patient_id)
    else:
        # Staff roles (ADMIN, RECEPTIONIST, NURSE)
        if patient_id:
            query = query.filter(ScanSchedule.patient_id == patient_id)
        if doctor_id:
            query = query.filter(ScanSchedule.doctor_id == doctor_id)

    if scan_type:
        query = query.filter(ScanSchedule.scan_type == scan_type)
    if scan_date:
        query = query.filter(ScanSchedule.scan_date == scan_date)
    if status_filter:
        query = query.filter(ScanSchedule.status == status_filter)

    schedules = query.order_by(ScanSchedule.scan_date.desc(), ScanSchedule.time_slot.asc()).offset(skip).limit(limit).all()
    return [serialize_scan_schedule(s) for s in schedules]

@router.post("", response_model=ScanScheduleOut, status_code=status.HTTP_201_CREATED)
def create_scan_schedule(
    scan_in: ScanScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Book/Schedule a new scan."""
    # Determine target patient
    target_patient_id = None
    if current_user.role == RoleEnum.PATIENT:
        if not current_user.patient_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Patient profile not found for current user."
            )
        target_patient_id = current_user.patient_profile.id
    else:
        # Staff booking for patient
        target_patient_id = scan_in.patient_id
        if not target_patient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="patient_id is required when creating a scan schedule as staff."
            )

    # Validate patient exists
    patient = db.query(Patient).filter(Patient.id == target_patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {target_patient_id} does not exist."
        )

    # Validate doctor exists if provided
    if scan_in.doctor_id:
        doctor = db.query(Doctor).filter(Doctor.id == scan_in.doctor_id).first()
        if not doctor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Doctor with ID {scan_in.doctor_id} does not exist."
            )

    # Generate unique scan number
    scan_num = generate_unique_scan_number(db)

    # Create scan schedule record
    new_scan = ScanSchedule(
        scan_number=scan_num,
        patient_id=target_patient_id,
        doctor_id=scan_in.doctor_id,
        scan_type=scan_in.scan_type,
        body_part=scan_in.body_part,
        scan_date=scan_in.scan_date,
        time_slot=scan_in.time_slot,
        radiologist_technician=scan_in.radiologist_technician,
        status=ScanStatusEnum.SCHEDULED,
        estimated_duration_minutes=scan_in.estimated_duration_minutes or 30,
        instructions=scan_in.instructions
    )

    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)

    return serialize_scan_schedule(new_scan)

@router.get("/{scan_id}", response_model=ScanScheduleOut)
def get_scan_schedule(
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch details of a single scan schedule by ID."""
    scan = db.query(ScanSchedule).filter(ScanSchedule.id == scan_id).first()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan schedule with ID {scan_id} not found."
        )

    # Security check: Patients can only view their own scan schedules
    if current_user.role == RoleEnum.PATIENT:
        if not current_user.patient_profile or current_user.patient_profile.id != scan.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot view another patient's scan schedule."
            )

    return serialize_scan_schedule(scan)

@router.put("/{scan_id}", response_model=ScanScheduleOut)
def update_scan_schedule(
    scan_id: int,
    scan_update: ScanScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update scan schedule details with strict role-based permission controls."""
    scan = db.query(ScanSchedule).filter(ScanSchedule.id == scan_id).first()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan schedule with ID {scan_id} not found."
        )

    # Role Security Checks
    if current_user.role == RoleEnum.PATIENT:
        if not current_user.patient_profile or current_user.patient_profile.id != scan.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot modify another patient's scan schedule."
            )
        # Patients can reschedule date/time slot or update body_part/instructions
        if scan_update.scan_date is not None:
            scan.scan_date = scan_update.scan_date
        if scan_update.time_slot is not None:
            scan.time_slot = scan_update.time_slot
        if scan_update.body_part is not None:
            scan.body_part = scan_update.body_part
        if scan_update.instructions is not None:
            scan.instructions = scan_update.instructions

    elif current_user.role == RoleEnum.DOCTOR:
        # Doctor can update status, findings_summary, estimated_duration_minutes
        if scan_update.status is not None:
            scan.status = scan_update.status
        if scan_update.findings_summary is not None:
            scan.findings_summary = scan_update.findings_summary
        if scan_update.estimated_duration_minutes is not None:
            scan.estimated_duration_minutes = scan_update.estimated_duration_minutes

    elif current_user.role == RoleEnum.NURSE:
        # Nurse can update status, estimated_duration_minutes, radiologist_technician, instructions
        if scan_update.status is not None:
            scan.status = scan_update.status
        if scan_update.estimated_duration_minutes is not None:
            scan.estimated_duration_minutes = scan_update.estimated_duration_minutes
        if scan_update.radiologist_technician is not None:
            scan.radiologist_technician = scan_update.radiologist_technician
        if scan_update.instructions is not None:
            scan.instructions = scan_update.instructions

    else:
        # ADMIN or RECEPTIONIST: Full management
        if scan_update.scan_type is not None:
            scan.scan_type = scan_update.scan_type
        if scan_update.body_part is not None:
            scan.body_part = scan_update.body_part
        if scan_update.scan_date is not None:
            scan.scan_date = scan_update.scan_date
        if scan_update.time_slot is not None:
            scan.time_slot = scan_update.time_slot
        if scan_update.doctor_id is not None:
            scan.doctor_id = scan_update.doctor_id
        if scan_update.radiologist_technician is not None:
            scan.radiologist_technician = scan_update.radiologist_technician
        if scan_update.status is not None:
            scan.status = scan_update.status
        if scan_update.estimated_duration_minutes is not None:
            scan.estimated_duration_minutes = scan_update.estimated_duration_minutes
        if scan_update.instructions is not None:
            scan.instructions = scan_update.instructions
        if scan_update.findings_summary is not None:
            scan.findings_summary = scan_update.findings_summary

    scan.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(scan)

    return serialize_scan_schedule(scan)

@router.put("/{scan_id}/cancel", response_model=ScanScheduleOut)
def cancel_scan_schedule(
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel a scan schedule (soft update status to Cancelled)."""
    scan = db.query(ScanSchedule).filter(ScanSchedule.id == scan_id).first()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan schedule with ID {scan_id} not found."
        )

    # Security Check
    if current_user.role == RoleEnum.PATIENT:
        if not current_user.patient_profile or current_user.patient_profile.id != scan.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot cancel another patient's scan schedule."
            )

    scan.status = ScanStatusEnum.CANCELLED
    scan.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(scan)

    return serialize_scan_schedule(scan)
