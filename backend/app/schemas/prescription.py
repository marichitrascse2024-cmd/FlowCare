from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class PrescriptionItemBase(BaseModel):
    medicine_name: str
    dosage: str # e.g. "500 mg"
    frequency: str # e.g. "Twice daily after food (1-0-1)"
    duration_days: int # e.g. 5
    route: Optional[str] = "Oral"
    special_instructions: Optional[str] = None

class PrescriptionItemCreate(PrescriptionItemBase):
    pass

class PrescriptionItemOut(PrescriptionItemBase):
    id: int
    prescription_id: int

    class Config:
        from_attributes = True

class PrescriptionCreate(BaseModel):
    patient_id: int
    doctor_id: Optional[int] = None
    appointment_id: Optional[int] = None
    medical_record_id: Optional[int] = None
    general_instructions: Optional[str] = None
    dietary_advice: Optional[str] = None
    items: List[PrescriptionItemCreate]

class PrescriptionOut(BaseModel):
    id: int
    prescription_number: str
    patient_id: int
    patient_name: Optional[str] = None
    doctor_id: int
    doctor_name: Optional[str] = None
    doctor_specialization: Optional[str] = None
    appointment_id: Optional[int] = None
    medical_record_id: Optional[int] = None
    general_instructions: Optional[str] = None
    dietary_advice: Optional[str] = None
    items: List[PrescriptionItemOut] = []
    created_at: datetime

    class Config:
        from_attributes = True
