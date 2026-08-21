from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel

class LabReportBase(BaseModel):
    test_name: str
    test_category: Optional[str] = "Pathology"
    results_summary: Optional[str] = None
    reference_range: Optional[str] = None
    status: Optional[str] = "COMPLETED"

class LabReportCreate(LabReportBase):
    patient_id: int
    medical_record_id: Optional[int] = None

class LabReportOut(LabReportBase):
    id: int
    patient_id: int
    medical_record_id: Optional[int] = None
    performed_at: datetime

    class Config:
        from_attributes = True

class MedicalRecordBase(BaseModel):
    visit_date: Optional[date] = None
    chief_complaint: Optional[str] = None
    symptoms: str
    diagnosis: str
    doctor_notes: Optional[str] = None
    treatment_plan: Optional[str] = None
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    oxygen_saturation: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    follow_up_date: Optional[date] = None

class MedicalRecordCreate(MedicalRecordBase):
    patient_id: int
    doctor_id: Optional[int] = None # Injected by backend if doctor is creating
    appointment_id: Optional[int] = None
    lab_reports: Optional[List[LabReportBase]] = []

class MedicalRecordUpdate(BaseModel):
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    doctor_notes: Optional[str] = None
    treatment_plan: Optional[str] = None
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    oxygen_saturation: Optional[int] = None
    follow_up_date: Optional[date] = None

class MedicalRecordOut(MedicalRecordBase):
    id: int
    record_number: str
    patient_id: int
    patient_name: Optional[str] = None
    doctor_id: int
    doctor_name: Optional[str] = None
    doctor_specialization: Optional[str] = None
    appointment_id: Optional[int] = None
    lab_reports: List[LabReportOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
