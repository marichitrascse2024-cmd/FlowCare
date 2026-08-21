from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.billing import Bill, BillItem, HospitalService, Payment, PaymentStatusEnum
from app.schemas.billing import (
    BillCreate, BillConfirmRequest, BillOut, BillItemOut,
    HospitalServiceCreate, HospitalServiceOut,
    PaymentCreate, PaymentOut
)
from app.services.billing_service import billing_service

router = APIRouter(prefix="/bills", tags=["Hospital Billing & Invoices"])

# --- Hospital Services Catalog ---

@router.get("/services", response_model=List[HospitalServiceOut])
def list_hospital_services(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(HospitalService).filter(HospitalService.is_active == True)
    if category:
        query = query.filter(HospitalService.category.ilike(f"%{category}%"))
    return query.order_by(HospitalService.category.asc(), HospitalService.service_name.asc()).all()

@router.post("/services", response_model=HospitalServiceOut)
def create_hospital_service(
    service_in: HospitalServiceCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([RoleEnum.ADMIN]))
):
    existing = db.query(HospitalService).filter(HospitalService.service_code == service_in.service_code).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Service code already exists.")

    service = HospitalService(
        service_code=service_in.service_code,
        service_name=service_in.service_name,
        category=service_in.category,
        base_price=service_in.base_price,
        description=service_in.description,
        is_active=service_in.is_active
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service

# --- Bills & Invoices ---

@router.get("", response_model=List[BillOut])
def list_bills(
    patient_id: Optional[int] = None,
    payment_status: Optional[PaymentStatusEnum] = None,
    is_draft: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Bill)

    # Scoping: Patient can only view own bills
    if current_user.role == RoleEnum.PATIENT:
        if not current_user.patient_profile:
            return []
        query = query.filter(Bill.patient_id == current_user.patient_profile.id, Bill.is_draft == False)
    else:
        if patient_id:
            query = query.filter(Bill.patient_id == patient_id)
        if is_draft is not None:
            query = query.filter(Bill.is_draft == is_draft)

    if payment_status:
        query = query.filter(Bill.payment_status == payment_status)

    bills = query.order_by(Bill.created_at.desc()).offset(skip).limit(limit).all()
    results = []
    for b in bills:
        results.append(BillOut(
            id=b.id,
            bill_number=b.bill_number,
            patient_id=b.patient_id,
            patient_name=b.patient.user.full_name if (b.patient and b.patient.user) else "Patient",
            patient_code=b.patient.patient_code if b.patient else "",
            appointment_id=b.appointment_id,
            subtotal=b.subtotal,
            discount_amount=b.discount_amount,
            tax_amount=b.tax_amount,
            total_amount=b.total_amount,
            payment_status=b.payment_status,
            is_draft=b.is_draft,
            ai_flags=b.ai_flags,
            verified_by_user_id=b.verified_by_user_id,
            verified_by_name=None,
            verified_at=b.verified_at,
            notes=b.notes,
            items=[BillItemOut(
                id=it.id,
                bill_id=it.bill_id,
                service_id=it.service_id,
                item_name=it.item_name,
                category=it.category,
                unit_price=it.unit_price,
                quantity=it.quantity,
                subtotal_price=it.subtotal_price,
                is_ai_suggested=it.is_ai_suggested
            ) for it in b.items],
            payments=[PaymentOut(
                id=p.id,
                bill_id=p.bill_id,
                payment_method=p.payment_method,
                amount_paid=p.amount_paid,
                transaction_reference=p.transaction_reference,
                notes=p.notes,
                paid_at=p.paid_at
            ) for p in b.payments],
            created_at=b.created_at,
            updated_at=b.updated_at
        ))
    return results

@router.post("", response_model=BillOut)
def create_bill(
    bill_in: BillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.RECEPTIONIST, RoleEnum.DOCTOR]))
):
    bill = billing_service.create_bill(db, bill_in, created_by_user_id=current_user.id)
    return BillOut(
        id=bill.id,
        bill_number=bill.bill_number,
        patient_id=bill.patient_id,
        patient_name=bill.patient.user.full_name if (bill.patient and bill.patient.user) else "Patient",
        patient_code=bill.patient.patient_code if bill.patient else "",
        appointment_id=bill.appointment_id,
        subtotal=bill.subtotal,
        discount_amount=bill.discount_amount,
        tax_amount=bill.tax_amount,
        total_amount=bill.total_amount,
        payment_status=bill.payment_status,
        is_draft=bill.is_draft,
        ai_flags=bill.ai_flags,
        verified_by_user_id=bill.verified_by_user_id,
        verified_by_name=None,
        verified_at=bill.verified_at,
        notes=bill.notes,
        items=[BillItemOut(
            id=it.id,
            bill_id=it.bill_id,
            service_id=it.service_id,
            item_name=it.item_name,
            category=it.category,
            unit_price=it.unit_price,
            quantity=it.quantity,
            subtotal_price=it.subtotal_price,
            is_ai_suggested=it.is_ai_suggested
        ) for it in bill.items],
        payments=[],
        created_at=bill.created_at,
        updated_at=bill.updated_at
    )

@router.get("/{bill_id}", response_model=BillOut)
def get_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    b = db.query(Bill).filter(Bill.id == bill_id).first()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found.")

    if current_user.role == RoleEnum.PATIENT and (not current_user.patient_profile or current_user.patient_profile.id != b.patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return BillOut(
        id=b.id,
        bill_number=b.bill_number,
        patient_id=b.patient_id,
        patient_name=b.patient.user.full_name if (b.patient and b.patient.user) else "Patient",
        patient_code=b.patient.patient_code if b.patient else "",
        appointment_id=b.appointment_id,
        subtotal=b.subtotal,
        discount_amount=b.discount_amount,
        tax_amount=b.tax_amount,
        total_amount=b.total_amount,
        payment_status=b.payment_status,
        is_draft=b.is_draft,
        ai_flags=b.ai_flags,
        verified_by_user_id=b.verified_by_user_id,
        verified_by_name=None,
        verified_at=b.verified_at,
        notes=b.notes,
        items=[BillItemOut(
            id=it.id,
            bill_id=it.bill_id,
            service_id=it.service_id,
            item_name=it.item_name,
            category=it.category,
            unit_price=it.unit_price,
            quantity=it.quantity,
            subtotal_price=it.subtotal_price,
            is_ai_suggested=it.is_ai_suggested
        ) for it in b.items],
        payments=[PaymentOut(
            id=p.id,
            bill_id=p.bill_id,
            payment_method=p.payment_method,
            amount_paid=p.amount_paid,
            transaction_reference=p.transaction_reference,
            notes=p.notes,
            paid_at=p.paid_at
        ) for p in b.payments],
        created_at=b.created_at,
        updated_at=b.updated_at
    )

@router.post("/{bill_id}/confirm", response_model=BillOut)
def confirm_bill(
    bill_id: int,
    confirm_in: Optional[BillConfirmRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.RECEPTIONIST]))
):
    bill = billing_service.confirm_draft_bill(
        db=db,
        bill_id=bill_id,
        staff_user_id=current_user.id,
        confirm_data=confirm_in
    )
    return BillOut(
        id=bill.id,
        bill_number=bill.bill_number,
        patient_id=bill.patient_id,
        patient_name=bill.patient.user.full_name if (bill.patient and bill.patient.user) else "Patient",
        patient_code=bill.patient.patient_code if bill.patient else "",
        appointment_id=bill.appointment_id,
        subtotal=bill.subtotal,
        discount_amount=bill.discount_amount,
        tax_amount=bill.tax_amount,
        total_amount=bill.total_amount,
        payment_status=bill.payment_status,
        is_draft=bill.is_draft,
        ai_flags=bill.ai_flags,
        verified_by_user_id=bill.verified_by_user_id,
        verified_by_name=current_user.full_name,
        verified_at=bill.verified_at,
        notes=bill.notes,
        items=[BillItemOut(
            id=it.id,
            bill_id=it.bill_id,
            service_id=it.service_id,
            item_name=it.item_name,
            category=it.category,
            unit_price=it.unit_price,
            quantity=it.quantity,
            subtotal_price=it.subtotal_price,
            is_ai_suggested=it.is_ai_suggested
        ) for it in bill.items],
        payments=[PaymentOut(
            id=p.id,
            bill_id=p.bill_id,
            payment_method=p.payment_method,
            amount_paid=p.amount_paid,
            transaction_reference=p.transaction_reference,
            notes=p.notes,
            paid_at=p.paid_at
        ) for p in bill.payments],
        created_at=bill.created_at,
        updated_at=bill.updated_at
    )

@router.post("/{bill_id}/payments", response_model=PaymentOut)
def pay_bill(
    bill_id: int,
    pay_in: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    payment = billing_service.record_payment(
        db=db,
        bill_id=bill_id,
        payment_in=pay_in,
        received_by_user_id=current_user.id
    )
    return PaymentOut(
        id=payment.id,
        bill_id=payment.bill_id,
        payment_method=payment.payment_method,
        amount_paid=payment.amount_paid,
        transaction_reference=payment.transaction_reference,
        notes=payment.notes,
        paid_at=payment.paid_at
    )
