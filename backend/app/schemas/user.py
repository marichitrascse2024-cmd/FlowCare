from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models.user import RoleEnum, UserStatusEnum

class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    role: RoleEnum = RoleEnum.PATIENT

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[UserStatusEnum] = None
    role: Optional[RoleEnum] = None

class UserOut(UserBase):
    id: int
    status: UserStatusEnum
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
