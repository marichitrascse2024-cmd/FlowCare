import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text, Float
from sqlalchemy.orm import relationship
from app.database.database import Base

class QueueStatusEnum(str, enum.Enum):
    WAITING = "WAITING"
    CALLED = "CALLED"
    IN_CONSULTATION = "IN_CONSULTATION"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"
    CANCELLED = "CANCELLED"

class PriorityEnum(str, enum.Enum):
    NORMAL = "NORMAL"
    URGENT = "URGENT"
    EMERGENCY = "EMERGENCY"
    ELDERLY = "ELDERLY"

class QueueEntry(Base):
    __tablename__ = "queue_entries"

    id = Column(Integer, primary_key=True, index=True)
    token_number = Column(String(30), unique=True, index=True, nullable=False) # e.g. "C105"
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, unique=True)
    
    status = Column(Enum(QueueStatusEnum), default=QueueStatusEnum.WAITING, nullable=False, index=True)
    priority = Column(Enum(PriorityEnum), default=PriorityEnum.NORMAL, nullable=False, index=True)
    queue_position = Column(Integer, default=1, nullable=False)
    estimated_wait_minutes = Column(Integer, default=0, nullable=False)
    
    room_number = Column(String(50), nullable=True)
    check_in_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    called_time = Column(DateTime, nullable=True)
    consultation_start = Column(DateTime, nullable=True)
    consultation_end = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="queue_entries")
    doctor = relationship("Doctor", back_populates="queue_entries")
    appointment = relationship("Appointment", back_populates="queue_entry")
