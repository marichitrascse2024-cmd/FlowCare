from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel
from app.models.appointment import AppointmentStatusEnum, AppointmentTypeEnum

class AppointmentBase(BaseModel):
    doctor_id: int
    department: Optional[str] = None
    appointment_date: date
    time_slot: str # e.g. "10:30 AM"
    appointment_type: AppointmentTypeEnum = AppointmentTypeEnum.GENERAL
    chief_complaint: Optional[str] = None
    notes: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    patient_id: Optional[int] = None # Optional because if patient is booking, backend injects current patient id
    ai_suggested: Optional[str] = "NO"

class AppointmentUpdate(BaseModel):
    status: Optional[AppointmentStatusEnum] = None
    appointment_date: Optional[date] = None
    time_slot: Optional[str] = None
    appointment_type: Optional[AppointmentTypeEnum] = None
    chief_complaint: Optional[str] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None

class AppointmentOut(AppointmentBase):
    id: int
    appointment_number: str
    patient_id: int
    patient_name: Optional[str] = None
    patient_code: Optional[str] = None
    patient_phone: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_specialization: Optional[str] = None
    doctor_room: Optional[str] = None
    status: AppointmentStatusEnum
    appointment_time: Optional[str] = None
    appointment_status: Optional[str] = None
    cancellation_reason: Optional[str] = None
    ai_suggested: Optional[str] = "NO"
    queue_token: Optional[str] = None
    queue_status: Optional[str] = None
    doctor_delay_minutes: Optional[int] = 0
    shifted_time_slot: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
