from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from app.database.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False) # e.g. "USER_LOGIN", "PATIENT_CHECK_IN", "BILL_CONFIRMED", "CONSULTATION_COMPLETED"
    entity = Column(String(100), nullable=True) # e.g. "Appointment", "Bill", "QueueEntry"
    entity_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="audit_logs")

class AIPredictionLog(Base):
    __tablename__ = "ai_prediction_logs"

    id = Column(Integer, primary_key=True, index=True)
    module_name = Column(String(100), nullable=False) # "WAITING_TIME", "APPOINTMENT_SCHEDULING", "MEDICAL_SUMMARY", "BILLING_ASSISTANT"
    input_payload = Column(Text, nullable=True)
    output_result = Column(Text, nullable=True)
    latency_ms = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
