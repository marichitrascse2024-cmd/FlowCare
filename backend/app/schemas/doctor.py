from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr

class DoctorScheduleBase(BaseModel):
    day_of_week: int # 0=Monday, 6=Sunday
    start_time: str # "09:00"
    end_time: str # "17:00"
    slot_duration: int = 15
    is_active: bool = True

class DoctorScheduleCreate(DoctorScheduleBase):
    pass

class DoctorScheduleOut(DoctorScheduleBase):
    id: int
    doctor_id: int

    class Config:
        from_attributes = True

class DoctorBase(BaseModel):
    specialization: str
    qualification: str
    experience_years: int = 0
    consultation_fee: float = 500.0
    room_number: str
    biography: Optional[str] = None
    is_available: bool = True
    average_consultation_time: int = 15

class DoctorCreate(DoctorBase):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: Optional[str] = "Doctor@123"

class DoctorUpdate(BaseModel):
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    consultation_fee: Optional[float] = None
    room_number: Optional[str] = None
    biography: Optional[str] = None
    is_available: Optional[bool] = None
    average_consultation_time: Optional[int] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None

class DoctorOut(DoctorBase):
    id: int
    user_id: int
    doctor_code: str
    full_name: str
    email: str
    phone: Optional[str] = None
    schedules: List[DoctorScheduleOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
