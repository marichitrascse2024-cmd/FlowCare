import enum
from datetime import datetime, timezone, date
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Enum, Text, Float
from sqlalchemy.orm import relationship
from app.database.database import Base

class AppointmentStatusEnum(str, enum.Enum):
    BOOKED = "BOOKED"
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    WAITING = "WAITING"
    IN_CONSULTATION = "IN_CONSULTATION"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"

class AppointmentTypeEnum(str, enum.Enum):
    GENERAL = "GENERAL"
    FOLLOW_UP = "FOLLOW_UP"
    EMERGENCY = "EMERGENCY"
    SPECIALIST = "SPECIALIST"

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    appointment_number = Column(String(50), unique=True, index=True, nullable=False) # e.g. APT-2026-0001
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    department = Column(String(100), nullable=True, index=True) # Department / Specialization
    appointment_date = Column(Date, nullable=False, index=True)
    time_slot = Column(String(20), nullable=False) # e.g. "10:30 AM"
    status = Column(Enum(AppointmentStatusEnum), default=AppointmentStatusEnum.BOOKED, nullable=False, index=True)
    appointment_type = Column(Enum(AppointmentTypeEnum), default=AppointmentTypeEnum.GENERAL, nullable=False)
    chief_complaint = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    cancellation_reason = Column(String(255), nullable=True)
    ai_suggested = Column(String(10), default="NO") # "YES" / "NO"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    @property
    def appointment_time(self) -> str:
        return self.time_slot

    @property
    def appointment_status(self) -> str:
        return self.status.value if hasattr(self.status, 'value') else str(self.status)

    # Relationships
    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    queue_entry = relationship("QueueEntry", back_populates="appointment", uselist=False, cascade="all, delete-orphan")
    medical_record = relationship("MedicalRecord", back_populates="appointment", uselist=False)
    bills = relationship("Bill", back_populates="appointment")
