from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel

class PatientBase(BaseModel):
    date_of_birth: Optional[date] = None
    gender: Optional[str] = "Other"
    blood_group: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    medical_history_notes: Optional[str] = None
    known_allergies: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None

class PatientCreate(PatientBase):
    full_name: str
    email: str
    phone: Optional[str] = None
    password: Optional[str] = "Patient@123"
    face_image: Optional[str] = None

class PatientUpdate(PatientBase):
    full_name: Optional[str] = None
    phone: Optional[str] = None

class PatientOut(PatientBase):
    id: int
    user_id: int
    patient_code: str
    full_name: str
    email: str
    phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
