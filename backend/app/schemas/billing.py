from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.billing import PaymentStatusEnum, PaymentMethodEnum

class HospitalServiceBase(BaseModel):
    service_code: str
    service_name: str
    category: str
    base_price: float
    description: Optional[str] = None
    is_active: bool = True

class HospitalServiceCreate(HospitalServiceBase):
    pass

class HospitalServiceOut(HospitalServiceBase):
    id: int

    class Config:
        from_attributes = True

class BillItemBase(BaseModel):
    service_id: Optional[int] = None
    item_name: str
    category: Optional[str] = "General"
    unit_price: float
    quantity: int = 1
    subtotal_price: float
    is_ai_suggested: bool = False

class BillItemCreate(BillItemBase):
    pass

class BillItemOut(BillItemBase):
    id: int
    bill_id: int

    class Config:
        from_attributes = True

class PaymentCreate(BaseModel):
    payment_method: PaymentMethodEnum = PaymentMethodEnum.CASH
    amount_paid: float
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None

class PaymentOut(BaseModel):
    id: int
    bill_id: int
    payment_method: PaymentMethodEnum
    amount_paid: float
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None
    paid_at: datetime

    class Config:
        from_attributes = True

class BillCreate(BaseModel):
    patient_id: int
    appointment_id: Optional[int] = None
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    items: List[BillItemCreate]
    notes: Optional[str] = None
    is_draft: bool = False
    ai_flags: Optional[str] = None

class BillConfirmRequest(BaseModel):
    discount_amount: Optional[float] = 0.0
    tax_amount: Optional[float] = 0.0
    notes: Optional[str] = None
    items: Optional[List[BillItemCreate]] = None # modified items during staff review

class BillOut(BaseModel):
    id: int
    bill_number: str
    patient_id: int
    patient_name: Optional[str] = None
    patient_code: Optional[str] = None
    appointment_id: Optional[int] = None
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    payment_status: PaymentStatusEnum
    is_draft: bool
    ai_flags: Optional[str] = None
    verified_by_user_id: Optional[int] = None
    verified_by_name: Optional[str] = None
    verified_at: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[BillItemOut] = []
    payments: List[PaymentOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
