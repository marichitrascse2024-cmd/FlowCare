import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Boolean, Text
from sqlalchemy.orm import relationship
from app.database.database import Base

class PaymentStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class PaymentMethodEnum(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    UPI = "UPI"
    INSURANCE = "INSURANCE"
    NET_BANKING = "NET_BANKING"

class HospitalService(Base):
    __tablename__ = "hospital_services"

    id = Column(Integer, primary_key=True, index=True)
    service_code = Column(String(50), unique=True, index=True, nullable=False) # e.g. "SRV-CONS-GEN"
    service_name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False) # Consultation, Laboratory, Radiology, Procedure, Pharmacy
    base_price = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_number = Column(String(50), unique=True, index=True, nullable=False) # e.g. "INV-2026-0001"
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)
    
    subtotal = Column(Float, default=0.0, nullable=False)
    discount_amount = Column(Float, default=0.0, nullable=False)
    tax_amount = Column(Float, default=0.0, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)
    
    payment_status = Column(Enum(PaymentStatusEnum), default=PaymentStatusEnum.PENDING, nullable=False, index=True)
    is_draft = Column(Boolean, default=False, nullable=False) # True if AI-generated draft awaiting human confirmation
    ai_flags = Column(Text, nullable=True) # JSON / text with duplicate warnings & missing charge notes
    
    verified_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="bills")
    appointment = relationship("Appointment", back_populates="bills")
    items = relationship("BillItem", back_populates="bill", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="bill", cascade="all, delete-orphan")

class BillItem(Base):
    __tablename__ = "bill_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(Integer, ForeignKey("hospital_services.id", ondelete="SET NULL"), nullable=True)
    
    item_name = Column(String(150), nullable=False)
    category = Column(String(100), default="General")
    unit_price = Column(Float, nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    subtotal_price = Column(Float, nullable=False)
    is_ai_suggested = Column(Boolean, default=False, nullable=False)

    bill = relationship("Bill", back_populates="items")
    service = relationship("HospitalService")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id", ondelete="CASCADE"), nullable=False)
    payment_method = Column(Enum(PaymentMethodEnum), default=PaymentMethodEnum.CASH, nullable=False)
    amount_paid = Column(Float, nullable=False)
    transaction_reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    paid_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    bill = relationship("Bill", back_populates="payments")
