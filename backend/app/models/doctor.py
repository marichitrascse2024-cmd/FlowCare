from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, Text, Time
from sqlalchemy.orm import relationship
from app.database.database import Base

class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    doctor_code = Column(String(50), unique=True, index=True, nullable=False) # e.g. DOC-2026-0001
    specialization = Column(String(100), nullable=False, index=True) # Cardiology, Pediatrics, General Medicine, etc.
    qualification = Column(String(150), nullable=False) # MBBS, MD, MS, DM, etc.
    experience_years = Column(Integer, default=0, nullable=False)
    consultation_fee = Column(Float, default=500.0, nullable=False)
    room_number = Column(String(50), nullable=False)
    biography = Column(Text, nullable=True)
    is_available = Column(Boolean, default=True, nullable=False)
    average_consultation_time = Column(Integer, default=15, nullable=False) # in minutes
    last_check_in_at = Column(DateTime, nullable=True) # Doctor check-in timestamp
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="doctor_profile")
    schedules = relationship("DoctorSchedule", back_populates="doctor", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="doctor", cascade="all, delete-orphan")
    queue_entries = relationship("QueueEntry", back_populates="doctor", cascade="all, delete-orphan")
    medical_records = relationship("MedicalRecord", back_populates="doctor", cascade="all, delete-orphan")
    prescriptions = relationship("Prescription", back_populates="doctor", cascade="all, delete-orphan")

class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False) # 0=Monday, 6=Sunday
    start_time = Column(String(10), nullable=False) # e.g. "09:00"
    end_time = Column(String(10), nullable=False)   # e.g. "17:00"
    slot_duration = Column(Integer, default=15, nullable=False) # in minutes
    is_active = Column(Boolean, default=True, nullable=False)

    doctor = relationship("Doctor", back_populates="schedules")
