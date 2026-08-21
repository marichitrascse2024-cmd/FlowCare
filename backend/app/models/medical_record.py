from datetime import datetime, timezone, date
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Text, Float, Boolean
from sqlalchemy.orm import relationship
from app.database.database import Base

class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    record_number = Column(String(50), unique=True, index=True, nullable=False) # e.g. REC-2026-0001
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)
    
    visit_date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), nullable=False)
    chief_complaint = Column(Text, nullable=True)
    symptoms = Column(Text, nullable=False)
    diagnosis = Column(Text, nullable=False)
    doctor_notes = Column(Text, nullable=True)
    treatment_plan = Column(Text, nullable=True)
    
    # Hybrid Encryption fields for high-security medical protection
    is_encrypted = Column(Boolean, default=False, nullable=False)
    encrypted_payload = Column(Text, nullable=True)
    encryption_key = Column(Text, nullable=True) # RSA-protected AES session key
    encryption_iv = Column(String(100), nullable=True)
    encryption_tag = Column(String(100), nullable=True)

    # Vitals
    blood_pressure = Column(String(20), nullable=True) # e.g. "120/80"
    heart_rate = Column(Integer, nullable=True) # e.g. 72 bpm
    temperature = Column(Float, nullable=True) # e.g. 98.6 F
    oxygen_saturation = Column(Integer, nullable=True) # e.g. 98 %
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    
    follow_up_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="medical_records")
    doctor = relationship("Doctor", back_populates="medical_records")
    appointment = relationship("Appointment", back_populates="medical_record")
    lab_reports = relationship("LabReport", back_populates="medical_record", cascade="all, delete-orphan")
    prescriptions = relationship("Prescription", back_populates="medical_record")

class LabReport(Base):
    __tablename__ = "lab_reports"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    medical_record_id = Column(Integer, ForeignKey("medical_records.id", ondelete="SET NULL"), nullable=True)
    test_name = Column(String(150), nullable=False) # e.g. "Complete Blood Count", "Lipid Profile", "ECG"
    test_category = Column(String(100), default="Pathology") # Pathology, Radiology, Cardiology
    results_summary = Column(Text, nullable=True)
    reference_range = Column(String(100), nullable=True)
    status = Column(String(50), default="COMPLETED") # PENDING, COMPLETED
    performed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    medical_record = relationship("MedicalRecord", back_populates="lab_reports")
