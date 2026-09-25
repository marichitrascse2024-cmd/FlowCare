import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Enum, Text
from sqlalchemy.orm import relationship
from app.database.database import Base

class ScanTypeEnum(str, enum.Enum):
    MRI = "MRI"
    CT_SCAN = "CT Scan"
    X_RAY = "X-Ray"
    ULTRASOUND = "Ultrasound"
    PET_SCAN = "PET Scan"

class ScanStatusEnum(str, enum.Enum):
    SCHEDULED = "Scheduled"
    CONFIRMED = "Confirmed"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class ScanSchedule(Base):
    __tablename__ = "scan_schedules"

    id = Column(Integer, primary_key=True, index=True)
    scan_number = Column(String(50), unique=True, index=True, nullable=False) # e.g. SCN-2026-0001
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True, index=True) # Referring doctor
    scan_type = Column(Enum(ScanTypeEnum), nullable=False, index=True)
    body_part = Column(String(100), nullable=True) # e.g. "Brain", "Chest", "Lumbar Spine"
    scan_date = Column(Date, nullable=False, index=True)
    time_slot = Column(String(20), nullable=False) # e.g. "09:00 AM"
    radiologist_technician = Column(String(150), nullable=True)
    status = Column(Enum(ScanStatusEnum), default=ScanStatusEnum.SCHEDULED, nullable=False, index=True)
    estimated_duration_minutes = Column(Integer, default=30, nullable=False)
    instructions = Column(Text, nullable=True)
    findings_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    patient = relationship("Patient")
    doctor = relationship("Doctor")
