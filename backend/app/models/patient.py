from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Text
from sqlalchemy.orm import relationship
from app.database.database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    patient_code = Column(String(50), unique=True, index=True, nullable=False) # e.g. PAT-2026-0001
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True) # Male, Female, Other
    blood_group = Column(String(10), nullable=True) # A+, O+, etc.
    address = Column(Text, nullable=True)
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(30), nullable=True)
    medical_history_notes = Column(Text, nullable=True)
    known_allergies = Column(Text, nullable=True)
    insurance_provider = Column(String(100), nullable=True)
    insurance_policy_number = Column(String(100), nullable=True)
    
    # Dynamic QR Code support
    qr_token = Column(String(255), unique=True, index=True, nullable=True)
    qr_created_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="patient_profile")
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    queue_entries = relationship("QueueEntry", back_populates="patient", cascade="all, delete-orphan")
    medical_records = relationship("MedicalRecord", back_populates="patient", cascade="all, delete-orphan")
    prescriptions = relationship("Prescription", back_populates="patient", cascade="all, delete-orphan")
    bills = relationship("Bill", back_populates="patient", cascade="all, delete-orphan")
    risk_predictions = relationship("RiskPrediction", back_populates="patient", cascade="all, delete-orphan")
