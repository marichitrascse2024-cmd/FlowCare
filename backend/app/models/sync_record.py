from datetime import datetime, timezone
import enum
from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, JSON
from app.database.database import Base

class SyncStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    SYNCED = "SYNCED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"

class SyncOperationEnum(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"

class SyncRecord(Base):
    __tablename__ = "sync_records"

    id = Column(Integer, primary_key=True, index=True)
    sync_id = Column(String(100), unique=True, index=True, nullable=False) # e.g. SYNC-20260819-001
    entity_type = Column(String(50), nullable=False) # Patient, Appointment, Doctor, MedicalRecord, Prescription, Bill, Queue
    entity_id = Column(String(50), nullable=False)
    operation = Column(String(20), default="CREATE", nullable=False)
    
    sync_status = Column(String(20), default="PENDING", nullable=False) # PENDING, SYNCED, FAILED
    payload_preview = Column(Text, nullable=True) # Non-sensitive data representation
    last_attempt = Column(DateTime, nullable=True)
    synced_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
