import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean, Text
from sqlalchemy.orm import relationship
from app.database.database import Base

class NotificationTypeEnum(str, enum.Enum):
    APPOINTMENT_CONFIRMED = "APPOINTMENT_CONFIRMED"
    APPOINTMENT_CANCELLED = "APPOINTMENT_CANCELLED"
    QUEUE_CALLED = "QUEUE_CALLED"
    WAITING_TIME_UPDATE = "WAITING_TIME_UPDATE"
    PRESCRIPTION_READY = "PRESCRIPTION_READY"
    BILL_GENERATED = "BILL_GENERATED"
    SYSTEM_ALERT = "SYSTEM_ALERT"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(Enum(NotificationTypeEnum), default=NotificationTypeEnum.SYSTEM_ALERT, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    link = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="notifications")
