from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models.user import RoleEnum, UserStatusEnum

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    full_name: str
    email: str
    role: RoleEnum
    patient_id: Optional[int] = None
    patient_code: Optional[str] = None
    doctor_id: Optional[int] = None
    doctor_code: Optional[str] = None
    doctor_specialization: Optional[str] = None
    department: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class CurrentUserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    role: RoleEnum
    status: UserStatusEnum
    profile_image: Optional[str] = None
    patient_id: Optional[int] = None
    patient_code: Optional[str] = None
    doctor_id: Optional[int] = None
    doctor_code: Optional[str] = None
    doctor_specialization: Optional[str] = None
    department: Optional[str] = None

    class Config:
        from_attributes = True
