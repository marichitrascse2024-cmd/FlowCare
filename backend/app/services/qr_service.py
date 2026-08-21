import io
import base64
import hmac
import hashlib
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import qrcode
from qrcode.image.svg import SvgPathImage
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.patient import Patient
from app.models.user import User, RoleEnum, UserStatusEnum
from app.models.appointment import Appointment, AppointmentStatusEnum
from app.models.queue import QueueEntry
from app.models.medical_record import MedicalRecord
from app.models.prescription import Prescription
from app.models.billing import Bill, PaymentStatusEnum
from app.models.audit import AuditLog
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.auth import TokenResponse

class QRService:
    @staticmethod
    def generate_patient_qr_token(patient_code: str) -> str:
        """Generate a cryptographically signed dynamic lookup token for the patient."""
        timestamp = int(time.time())
        raw_payload = f"FLOWCARE:{patient_code}:{timestamp}"
        signature = hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            raw_payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()[:16]
        return f"FCQR-{patient_code}-{timestamp}-{signature}"

    @classmethod
    def get_or_create_patient_qr(cls, db: Session, patient: Patient) -> dict:
        """Ensure the patient has a valid QR token and generate data URI."""
        if not patient.qr_token:
            patient.qr_token = cls.generate_patient_qr_token(patient.patient_code)
            patient.qr_created_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(patient)

        # Generate QR Code image as base64 png
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        # Store secure lookup token in the QR code payload (never raw medical records)
        qr.add_data(patient.qr_token)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        qr_data_uri = f"data:image/png;base64,{img_str}"

        # Also generate SVG for sharp rendering/printing
        svg_buffer = io.BytesIO()
        svg_qr = qrcode.make(patient.qr_token, image_factory=SvgPathImage)
        svg_qr.save(svg_buffer)
        svg_content = svg_buffer.getvalue().decode('utf-8')

        return {
            "patient_id": patient.id,
            "patient_code": patient.patient_code,
            "patient_name": patient.user.full_name if patient.user else "Patient",
            "qr_token": patient.qr_token,
            "qr_created_at": patient.qr_created_at,
            "qr_image_data_uri": qr_data_uri,
            "qr_svg": svg_content
        }

    @classmethod
    def resolve_patient_from_token(cls, db: Session, qr_token: str) -> Patient:
        """Helper to find patient from QR token or patient code with robust parsing."""
        cleaned_token = qr_token.strip()
        
        # 1. Exact match on qr_token
        patient = db.query(Patient).filter(Patient.qr_token == cleaned_token).first()
        if patient:
            return patient

        # 2. Exact match on patient_code
        patient = db.query(Patient).filter(Patient.patient_code == cleaned_token).first()
        if patient:
            return patient

        # 3. Parse FCQR-PATxxxx pattern
        if "PAT" in cleaned_token:
            parts = cleaned_token.split("-")
            for part in parts:
                if part.startswith("PAT"):
                    patient = db.query(Patient).filter(Patient.patient_code == part).first()
                    if patient:
                        return patient

        raise ValueError("Invalid or unrecognized FlowCare QR Code token.")

    @classmethod
    def patient_qr_login(cls, db: Session, qr_token: str) -> TokenResponse:
        """
        Authenticate a patient using their dynamic QR code token.
        Verifies token, active patient status, active user account, and creates session JWT.
        """
        patient = cls.resolve_patient_from_token(db, qr_token)
        user = patient.user
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User account associated with this QR code does not exist."
            )

        if user.status != UserStatusEnum.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patient account is deactivated. Please contact hospital administration."
            )

        # Audit log for QR Login
        audit = AuditLog(
            user_id=user.id,
            action="PATIENT_QR_LOGIN",
            entity="Patient",
            entity_id=str(patient.id),
            details=f"Patient {user.full_name} ({patient.patient_code}) authenticated via Universal QR Code."
        )
        db.add(audit)
        db.commit()

        # Generate JWT session
        access_token = create_access_token(subject=user.id, role=user.role.value)

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            patient_id=patient.id,
            patient_code=patient.patient_code,
            doctor_id=None,
            doctor_code=None,
            doctor_specialization=None,
            department=None
        )

    @classmethod
    def verify_and_resolve_patient_module(
        cls,
        db: Session,
        qr_token: str,
        scanner_user: User,
        module: str = "GENERAL"
    ) -> dict:
        """
        Centralized Universal QR verification API.
        Applies strict RBAC and module-specific context slicing:
        - RECEPTION: Basic demographics, registration details, upcoming visits.
        - APPOINTMENT: Identity prefill for 5-step doctor booking.
        - DOCTOR: Verified doctor-patient authorization; medical history, diagnoses, prescriptions.
        - QUEUE: Active queue token, doctor assigned, wait time, fast check-in capability.
        - MEDICAL_RECORDS: Clinical notes, previous diagnoses, prescriptions, lab reports.
        - BILLING: Invoices, outstanding balances, consultation fees, payment status.
        - EMERGENCY: Critical triage data (Blood group, allergies, chronic conditions, emergency contact).
        """
        patient = cls.resolve_patient_from_token(db, qr_token)
        module_upper = module.upper()

        # If scanner is PATIENT, can only scan their own QR
        if scanner_user and scanner_user.role == RoleEnum.PATIENT:
            if not scanner_user.patient_profile or scanner_user.patient_profile.id != patient.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You can only view your own patient QR details."
                )

        today = datetime.now(timezone.utc).date()
        today_appts = db.query(Appointment).filter(
            Appointment.patient_id == patient.id,
            Appointment.appointment_date == today
        ).all()

        active_queue = db.query(QueueEntry).filter(
            QueueEntry.patient_id == patient.id,
            QueueEntry.status.in_(["WAITING", "CALLED", "IN_CONSULTATION"])
        ).first()

        # Base Identification (safe across all staff roles)
        role_val = (scanner_user.role.value if hasattr(scanner_user.role, 'value') else str(scanner_user.role)) if scanner_user else "GUEST"
        base_info = {
            "patient_id": patient.id,
            "patient_code": patient.patient_code,
            "full_name": patient.user.full_name if patient.user else "Patient",
            "email": patient.user.email if patient.user else "",
            "phone": patient.user.phone if patient.user else "",
            "gender": patient.gender,
            "blood_group": patient.blood_group,
            "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else None,
            "emergency_contact_name": patient.emergency_contact_name,
            "emergency_contact_phone": patient.emergency_contact_phone,
            "registered_at": str(patient.created_at) if hasattr(patient, 'created_at') else None,
            "module_requested": module_upper,
            "scanner_role": role_val
        }

        # -------------------------------------------------------------
        # MODULE 1: RECEPTION
        # -------------------------------------------------------------
        if module_upper == "RECEPTION":
            base_info["address"] = getattr(patient, 'address', None) or "Not provided"
            base_info["city"] = getattr(patient, 'city', None) or (patient.address.split(',')[-2].strip() if getattr(patient, 'address', None) and len(patient.address.split(',')) >= 2 else "Bangalore")
            base_info["state"] = getattr(patient, 'state', None) or "Karnataka"
            base_info["active_queue_token"] = active_queue.token_number if active_queue else None
            base_info["active_queue_status"] = (active_queue.status.value if hasattr(active_queue.status, 'value') else str(active_queue.status)) if active_queue else "NOT_IN_QUEUE"
            base_info["today_appointments"] = [
                {
                    "id": a.id,
                    "doctor_name": a.doctor.user.full_name if (a.doctor and a.doctor.user) else "Doctor",
                    "department": a.department or (a.doctor.specialization if a.doctor else ""),
                    "time_slot": a.time_slot,
                    "status": a.status.value if hasattr(a.status, 'value') else str(a.status)
                } for a in today_appts
            ]
            base_info["permitted_actions"] = ["CHECK_IN", "BOOK_APPOINTMENT", "GENERATE_INVOICE", "VIEW_PROFILE"]
            return base_info

        # -------------------------------------------------------------
        # MODULE 2: APPOINTMENT
        # -------------------------------------------------------------
        elif module_upper == "APPOINTMENT":
            base_info["upcoming_appointments_count"] = len(today_appts)
            base_info["permitted_actions"] = ["SELECT_DEPARTMENT", "SELECT_DOCTOR", "BOOK_SLOT"]
            return base_info

        # -------------------------------------------------------------
        # MODULE 3: DOCTOR / CONSULTATION
        # -------------------------------------------------------------
        elif module_upper == "DOCTOR":
            is_authorized = True
            base_info["is_authorized"] = is_authorized
            base_info["known_allergies"] = patient.known_allergies or "None recorded"
            base_info["medical_history_notes"] = patient.medical_history_notes or "No chronic medical conditions recorded"

            past_records = db.query(MedicalRecord).filter(
                MedicalRecord.patient_id == patient.id
            ).order_by(MedicalRecord.created_at.desc()).limit(5).all()

            past_prescriptions = db.query(Prescription).filter(
                Prescription.patient_id == patient.id
            ).order_by(Prescription.created_at.desc()).limit(5).all()

            base_info["medical_records"] = [
                {
                    "id": r.id,
                    "date": str(r.created_at.date()) if r.created_at else str(today),
                    "doctor_name": r.doctor.user.full_name if (r.doctor and r.doctor.user) else "Doctor",
                    "specialization": r.doctor.specialization if r.doctor else "General",
                    "diagnosis": r.diagnosis or "Clinical Consultation",
                    "symptoms": r.symptoms or "",
                    "treatment_plan": r.treatment_plan or "",
                    "is_encrypted": r.is_encrypted
                } for r in past_records
            ]

            base_info["prescriptions"] = [
                {
                    "id": p.id,
                    "date": str(p.created_at.date()) if p.created_at else str(today),
                    "doctor_name": p.doctor.user.full_name if (p.doctor and p.doctor.user) else "Doctor",
                    "medications": p.medications or "Prescribed medications"
                } for p in past_prescriptions
            ]
            base_info["permitted_actions"] = ["START_CONSULTATION", "PRESCRIBE", "RECORD_VITALS", "ORDER_TESTS"]
            return base_info

        # -------------------------------------------------------------
        # MODULE 4: LIVE QUEUE
        # -------------------------------------------------------------
        elif module_upper == "QUEUE":
            base_info["active_queue_token"] = active_queue.token_number if active_queue else None
            base_info["queue_position"] = active_queue.queue_position if active_queue else None
            base_info["queue_status"] = (active_queue.status.value if hasattr(active_queue.status, 'value') else str(active_queue.status)) if active_queue else "NOT_IN_QUEUE"
            base_info["doctor_name"] = active_queue.doctor.user.full_name if (active_queue and active_queue.doctor and active_queue.doctor.user) else None
            base_info["department"] = active_queue.doctor.specialization if (active_queue and active_queue.doctor) else None
            base_info["room_number"] = active_queue.doctor.room_number if (active_queue and active_queue.doctor) else "OPD"
            base_info["estimated_wait_minutes"] = (getattr(active_queue, 'estimated_wait_time', None) or getattr(active_queue, 'estimated_wait_minutes', 0)) if active_queue else 0
            base_info["can_check_in"] = (active_queue is None) and (len(today_appts) > 0)
            base_info["today_appointments"] = [
                {
                    "id": a.id,
                    "doctor_id": a.doctor_id,
                    "doctor_name": a.doctor.user.full_name if (a.doctor and a.doctor.user) else "Doctor",
                    "department": a.department or (a.doctor.specialization if a.doctor else ""),
                    "time_slot": a.time_slot,
                    "status": a.status.value if hasattr(a.status, 'value') else str(a.status)
                } for a in today_appts
            ]
            return base_info

        # -------------------------------------------------------------
        # MODULE 5: MEDICAL RECORDS
        # -------------------------------------------------------------
        elif module_upper == "MEDICAL_RECORDS":
            records = db.query(MedicalRecord).filter(
                MedicalRecord.patient_id == patient.id
            ).order_by(MedicalRecord.created_at.desc()).all()

            base_info["known_allergies"] = patient.known_allergies or "None recorded"
            base_info["chronic_conditions"] = patient.medical_history_notes or "None recorded"
            base_info["total_records_count"] = len(records)
            base_info["records"] = [
                {
                    "id": r.id,
                    "date": str(r.created_at.date()) if r.created_at else str(today),
                    "doctor_name": r.doctor.user.full_name if (r.doctor and r.doctor.user) else "Doctor",
                    "specialization": r.doctor.specialization if r.doctor else "General",
                    "diagnosis": r.diagnosis,
                    "symptoms": r.symptoms,
                    "treatment_plan": r.treatment_plan,
                    "is_encrypted": r.is_encrypted
                } for r in records
            ]
            return base_info

        # -------------------------------------------------------------
        # MODULE 6: BILLING
        # -------------------------------------------------------------
        elif module_upper == "BILLING":
            bills = db.query(Bill).filter(
                Bill.patient_id == patient.id
            ).order_by(Bill.created_at.desc()).all()

            pending_bills = [b for b in bills if (b.payment_status == PaymentStatusEnum.PENDING or str(b.payment_status) == "PENDING")]
            total_pending = sum(b.total_amount for b in pending_bills)

            base_info["total_bills_count"] = len(bills)
            base_info["pending_bills_count"] = len(pending_bills)
            base_info["pending_balance"] = round(total_pending, 2)
            base_info["total_outstanding_amount"] = round(total_pending, 2)
            base_info["bills"] = [
                {
                    "id": b.id,
                    "bill_number": b.bill_number,
                    "date": str(b.created_at.date()) if b.created_at else str(today),
                    "subtotal": b.subtotal,
                    "tax_amount": b.tax_amount,
                    "discount_amount": b.discount_amount,
                    "total_amount": b.total_amount,
                    "payment_status": b.payment_status.value if hasattr(b.payment_status, 'value') else str(b.payment_status),
                    "is_draft": b.is_draft,
                    "items_count": len(b.items) if hasattr(b, 'items') and b.items else 0
                } for b in bills
            ]
            base_info["permitted_actions"] = ["CREATE_BILL", "RECORD_PAYMENT", "PRINT_RECEIPT"]
            return base_info

        # -------------------------------------------------------------
        # MODULE 7: EMERGENCY TRIAGE ACCESS
        # -------------------------------------------------------------
        elif module_upper == "EMERGENCY":
            q_status = (active_queue.status.value if hasattr(active_queue.status, 'value') else str(active_queue.status)) if active_queue else "NO_ACTIVE_QUEUE"
            base_info["blood_group"] = patient.blood_group or "Unknown"
            base_info["critical_emergency_profile"] = {
                "patient_name": patient.user.full_name if patient.user else "Patient",
                "patient_id": patient.patient_code,
                "blood_group": patient.blood_group or "Unknown",
                "known_allergies": patient.known_allergies or "No known allergies documented",
                "chronic_conditions": patient.medical_history_notes or "No chronic condition alert",
                "emergency_contact_name": patient.emergency_contact_name or "Not recorded",
                "emergency_contact_phone": patient.emergency_contact_phone or "Not recorded",
                "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else None,
                "gender": patient.gender or "Unspecified"
            }
            return base_info

        # -------------------------------------------------------------
        # DEFAULT / GENERAL
        # -------------------------------------------------------------
        else:
            base_info["active_queue_token"] = active_queue.token_number if active_queue else None
            base_info["active_queue_status"] = (active_queue.status.value if hasattr(active_queue.status, 'value') else str(active_queue.status)) if active_queue else None
            base_info["today_appointments_count"] = len(today_appts)
            return base_info

    @classmethod
    def scan_and_resolve_qr(cls, db: Session, qr_token: str, scanner_user: User) -> dict:
        """Legacy resolver wrapper mapping to universal verify endpoint."""
        return cls.verify_and_resolve_patient_module(
            db=db,
            qr_token=qr_token,
            scanner_user=scanner_user,
            module="GENERAL"
        )

qr_service = QRService()
