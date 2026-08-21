from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.queue import QueueStatusEnum, PriorityEnum

class CheckInRequest(BaseModel):
    appointment_id: Optional[int] = None
    patient_id: Optional[int] = None
    doctor_id: Optional[int] = None
    priority: PriorityEnum = PriorityEnum.NORMAL
    notes: Optional[str] = None

class QueueStatusUpdate(BaseModel):
    status: QueueStatusEnum
    notes: Optional[str] = None

class QueueEntryOut(BaseModel):
    id: int
    token_number: str
    patient_id: int
    patient_name: Optional[str] = None
    patient_code: Optional[str] = None
    doctor_id: int
    doctor_name: Optional[str] = None
    department: Optional[str] = None
    doctor_specialization: Optional[str] = None
    room_number: Optional[str] = None
    appointment_id: Optional[int] = None
    status: QueueStatusEnum
    priority: PriorityEnum
    queue_position: int
    estimated_wait_minutes: int
    estimated_wait_time: Optional[int] = None
    check_in_time: datetime
    called_time: Optional[datetime] = None
    consultation_start: Optional[datetime] = None
    consultation_end: Optional[datetime] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class QueueAdvanceResponse(BaseModel):
    message: str
    current_token: Optional[str] = None
    next_token: Optional[str] = None
    queue_entry: Optional[QueueEntryOut] = None
