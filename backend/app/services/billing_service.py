from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.billing import Bill, BillItem, Payment, HospitalService, PaymentStatusEnum, PaymentMethodEnum
from app.models.patient import Patient
from app.models.notification import NotificationTypeEnum
from app.schemas.billing import BillCreate, BillConfirmRequest, PaymentCreate
from app.services.notification_service import notification_service

class BillingService:
    @staticmethod
    def generate_bill_number(db: Session) -> str:
        today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        count = db.query(Bill).count()
        return f"INV-{today_str}-{1001 + count}"

    @classmethod
    def create_bill(
        cls,
        db: Session,
        bill_in: BillCreate,
        created_by_user_id: Optional[int] = None
    ) -> Bill:
        patient = db.query(Patient).filter(Patient.id == bill_in.patient_id).first()
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

        subtotal = sum(item.subtotal_price for item in bill_in.items)
        discount = bill_in.discount_amount
        tax = bill_in.tax_amount if bill_in.tax_amount > 0 else round(subtotal * 0.05, 2)
        total = round(subtotal + tax - discount, 2)

        bill = Bill(
            bill_number=cls.generate_bill_number(db),
            patient_id=bill_in.patient_id,
            appointment_id=bill_in.appointment_id,
            subtotal=round(subtotal, 2),
            discount_amount=round(discount, 2),
            tax_amount=round(tax, 2),
            total_amount=round(total, 2),
            payment_status=PaymentStatusEnum.PENDING,
            is_draft=bill_in.is_draft,
            ai_flags=bill_in.ai_flags,
            notes=bill_in.notes
        )
        db.add(bill)
        db.flush()

        for it in bill_in.items:
            item_obj = BillItem(
                bill_id=bill.id,
                service_id=it.service_id,
                item_name=it.item_name,
                category=it.category or "General",
                unit_price=it.unit_price,
                quantity=it.quantity,
                subtotal_price=it.subtotal_price,
                is_ai_suggested=it.is_ai_suggested
            )
            db.add(item_obj)

        db.commit()
        db.refresh(bill)

        if not bill.is_draft and patient.user:
            notification_service.create_notification(
                db=db,
                user_id=patient.user.id,
                title="Invoice Generated",
                message=f"Bill #{bill.bill_number} for ₹{bill.total_amount:.2f} has been generated.",
                notification_type=NotificationTypeEnum.BILL_GENERATED
            )

        return bill

    @classmethod
    def confirm_draft_bill(
        cls,
        db: Session,
        bill_id: int,
        staff_user_id: int,
        confirm_data: Optional[BillConfirmRequest] = None
    ) -> Bill:
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found.")

        # Update items if provided in review
        if confirm_data and confirm_data.items is not None:
            # Remove existing draft items and replace
            db.query(BillItem).filter(BillItem.bill_id == bill.id).delete()
            for it in confirm_data.items:
                item_obj = BillItem(
                    bill_id=bill.id,
                    service_id=it.service_id,
                    item_name=it.item_name,
                    category=it.category or "General",
                    unit_price=it.unit_price,
                    quantity=it.quantity,
                    subtotal_price=it.subtotal_price,
                    is_ai_suggested=it.is_ai_suggested
                )
                db.add(item_obj)
            db.flush()

            subtotal = sum(item.subtotal_price for item in confirm_data.items)
            bill.subtotal = round(subtotal, 2)
            bill.discount_amount = round(confirm_data.discount_amount or 0.0, 2)
            bill.tax_amount = round(confirm_data.tax_amount or (subtotal * 0.05), 2)
            bill.total_amount = round(bill.subtotal + bill.tax_amount - bill.discount_amount, 2)
            if confirm_data.notes:
                bill.notes = confirm_data.notes

        bill.is_draft = False
        bill.verified_by_user_id = staff_user_id
        bill.verified_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(bill)

        # Notify patient
        if bill.patient and bill.patient.user:
            notification_service.create_notification(
                db=db,
                user_id=bill.patient.user.id,
                title="Invoice Confirmed by Staff",
                message=f"Bill #{bill.bill_number} has been verified for ₹{bill.total_amount:.2f}.",
                notification_type=NotificationTypeEnum.BILL_GENERATED
            )

        return bill

    @classmethod
    def record_payment(
        cls,
        db: Session,
        bill_id: int,
        payment_in: PaymentCreate,
        received_by_user_id: Optional[int] = None
    ) -> Payment:
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found.")

        payment = Payment(
            bill_id=bill.id,
            payment_method=payment_in.payment_method,
            amount_paid=payment_in.amount_paid,
            transaction_reference=payment_in.transaction_reference,
            notes=payment_in.notes,
            paid_at=datetime.now(timezone.utc)
        )
        db.add(payment)
        db.flush()

        # Update bill payment status
        total_paid = sum(p.amount_paid for p in bill.payments) + payment.amount_paid
        if total_paid >= bill.total_amount:
            bill.payment_status = PaymentStatusEnum.PAID
        elif total_paid > 0:
            bill.payment_status = PaymentStatusEnum.PARTIAL

        db.commit()
        db.refresh(payment)
        return payment

billing_service = BillingService()
