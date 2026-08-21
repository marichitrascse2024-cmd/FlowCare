from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.notification import NotificationTypeEnum

class NotificationCreate(BaseModel):
    user_id: int
    title: str
    message: str
    notification_type: NotificationTypeEnum = NotificationTypeEnum.SYSTEM_ALERT
    link: Optional[str] = None

class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    notification_type: NotificationTypeEnum
    is_read: bool
    link: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
