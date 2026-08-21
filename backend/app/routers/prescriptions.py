from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.prescription import Prescription, PrescriptionItem
from app.models.patient import Patient
from app.models.notification import NotificationTypeEnum
from app.schemas.prescription import PrescriptionCreate, PrescriptionOut, PrescriptionItemOut
from app.services.notification_service import notification_service

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])

def generate_rx_number(db: Session) -> str:
    count = db.query(Prescription).count()
    return f"RX-2026-{1001 + count}"

@router.get("/patient/{patient_id}", response_model=List[PrescriptionOut])
def get_patient_prescriptions(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == RoleEnum.PATIENT and (not current_user.patient_profile or current_user.patient_profile.id != patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if current_user.role == RoleEnum.DOCTOR and current_user.doctor_profile:
        doc_id = current_user.doctor_profile.id
        from app.models.appointment import Appointment
        from app.models.queue import QueueEntry
        from app.models.medical_record import MedicalRecord
        has_appt = db.query(Appointment).filter(Appointment.patient_id == patient_id, Appointment.doctor_id == doc_id).first()
        has_queue = db.query(QueueEntry).filter(QueueEntry.patient_id == patient_id, QueueEntry.doctor_id == doc_id).first()
        has_rx = db.query(Prescription).filter(Prescription.patient_id == patient_id, Prescription.doctor_id == doc_id).first()
        if not (has_appt or has_queue or has_rx):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. You can only view prescriptions for patients assigned to you.")

    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == patient_id
    ).order_by(Prescription.created_at.desc()).all()

    results = []
    for rx in prescriptions:
        results.append(PrescriptionOut(
            id=rx.id,
            prescription_number=rx.prescription_number,
            patient_id=rx.patient_id,
            patient_name=rx.patient.user.full_name if (rx.patient and rx.patient.user) else "Patient",
            doctor_id=rx.doctor_id,
            doctor_name=rx.doctor.user.full_name if (rx.doctor and rx.doctor.user) else "Doctor",
            doctor_specialization=rx.doctor.specialization if rx.doctor else "",
            appointment_id=rx.appointment_id,
            medical_record_id=rx.medical_record_id,
            general_instructions=rx.general_instructions,
            dietary_advice=rx.dietary_advice,
            items=[PrescriptionItemOut(
                id=it.id,
                prescription_id=it.prescription_id,
                medicine_name=it.medicine_name,
                dosage=it.dosage,
                frequency=it.frequency,
                duration_days=it.duration_days,
                route=it.route,
                special_instructions=it.special_instructions
            ) for it in rx.items],
            created_at=rx.created_at
        ))
    return results

@router.post("", response_model=PrescriptionOut)
def create_prescription(
    rx_in: PrescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.DOCTOR, RoleEnum.ADMIN]))
):
    doctor_id = rx_in.doctor_id
    if current_user.role == RoleEnum.DOCTOR:
        if not current_user.doctor_profile:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Doctor profile not found.")
        doctor_id = current_user.doctor_profile.id
    elif not doctor_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="doctor_id is required.")

    rx = Prescription(
        prescription_number=generate_rx_number(db),
        patient_id=rx_in.patient_id,
        doctor_id=doctor_id,
        appointment_id=rx_in.appointment_id,
        medical_record_id=rx_in.medical_record_id,
        general_instructions=rx_in.general_instructions,
        dietary_advice=rx_in.dietary_advice
    )
    db.add(rx)
    db.flush()

    for it in rx_in.items:
        rx_item = PrescriptionItem(
            prescription_id=rx.id,
            medicine_name=it.medicine_name,
            dosage=it.dosage,
            frequency=it.frequency,
            duration_days=it.duration_days,
            route=it.route or "Oral",
            special_instructions=it.special_instructions
        )
        db.add(rx_item)

    db.commit()
    db.refresh(rx)

    # Notify patient
    patient = db.query(Patient).filter(Patient.id == rx_in.patient_id).first()
    if patient and patient.user:
        notification_service.create_notification(
            db=db,
            user_id=patient.user.id,
            title="Prescription Ready",
            message=f"Prescription #{rx.prescription_number} has been issued by Dr. {rx.doctor.user.full_name if (rx.doctor and rx.doctor.user) else 'Doctor'}.",
            notification_type=NotificationTypeEnum.PRESCRIPTION_READY
        )

    return PrescriptionOut(
        id=rx.id,
        prescription_number=rx.prescription_number,
        patient_id=rx.patient_id,
        patient_name=patient.user.full_name if (patient and patient.user) else "Patient",
        doctor_id=rx.doctor_id,
        doctor_name=rx.doctor.user.full_name if (rx.doctor and rx.doctor.user) else "Doctor",
        doctor_specialization=rx.doctor.specialization if rx.doctor else "",
        appointment_id=rx.appointment_id,
        medical_record_id=rx.medical_record_id,
        general_instructions=rx.general_instructions,
        dietary_advice=rx.dietary_advice,
        items=[PrescriptionItemOut(
            id=it.id,
            prescription_id=it.prescription_id,
            medicine_name=it.medicine_name,
            dosage=it.dosage,
            frequency=it.frequency,
            duration_days=it.duration_days,
            route=it.route,
            special_instructions=it.special_instructions
        ) for it in rx.items],
        created_at=rx.created_at
    )
