from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.scan_schedule import ScanTypeEnum, ScanStatusEnum

class ScanScheduleBase(BaseModel):
    scan_type: ScanTypeEnum
    body_part: Optional[str] = None
    scan_date: date
    time_slot: str
    doctor_id: Optional[int] = None
    radiologist_technician: Optional[str] = None
    estimated_duration_minutes: Optional[int] = 30
    instructions: Optional[str] = None
    findings_summary: Optional[str] = None

class ScanScheduleCreate(BaseModel):
    patient_id: Optional[int] = None # Optional for patient role; required for staff booking
    scan_type: ScanTypeEnum
    body_part: Optional[str] = None
    scan_date: date
    time_slot: str
    doctor_id: Optional[int] = None
    radiologist_technician: Optional[str] = None
    estimated_duration_minutes: Optional[int] = 30
    instructions: Optional[str] = None

class ScanScheduleUpdate(BaseModel):
    scan_type: Optional[ScanTypeEnum] = None
    body_part: Optional[str] = None
    scan_date: Optional[date] = None
    time_slot: Optional[str] = None
    doctor_id: Optional[int] = None
    radiologist_technician: Optional[str] = None
    status: Optional[ScanStatusEnum] = None
    estimated_duration_minutes: Optional[int] = None
    instructions: Optional[str] = None
    findings_summary: Optional[str] = None

class ScanScheduleOut(ScanScheduleBase):
    id: int
    scan_number: str
    patient_id: int
    patient_name: Optional[str] = None
    patient_code: Optional[str] = None
    patient_phone: Optional[str] = None
    doctor_id: Optional[int] = None
    doctor_name: Optional[str] = None
    doctor_specialization: Optional[str] = None
    status: ScanStatusEnum
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
