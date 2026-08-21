from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.medical_record import MedicalRecord, LabReport
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.schemas.medical_record import MedicalRecordCreate, MedicalRecordUpdate, MedicalRecordOut, LabReportCreate, LabReportOut
from app.services.encryption_service import encryption_service

router = APIRouter(prefix="/medical-records", tags=["Medical Records"])

def generate_record_number(db: Session) -> str:
    count = db.query(MedicalRecord).count()
    return f"REC-2026-{1001 + count}"

@router.get("/patient/{patient_id}", response_model=List[MedicalRecordOut])
def get_patient_medical_records(
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
        has_appt = db.query(Appointment).filter(Appointment.patient_id == patient_id, Appointment.doctor_id == doc_id).first()
        has_queue = db.query(QueueEntry).filter(QueueEntry.patient_id == patient_id, QueueEntry.doctor_id == doc_id).first()
        has_rec = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient_id, MedicalRecord.doctor_id == doc_id).first()
        if not (has_appt or has_queue or has_rec):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. You can only view medical records for patients assigned to you.")

    records = db.query(MedicalRecord).filter(
        MedicalRecord.patient_id == patient_id
    ).order_by(MedicalRecord.visit_date.desc()).all()

    results = []
    for r in records:
        # Decrypt sensitive fields if encrypted
        diag = r.diagnosis
        notes = r.doctor_notes
        plan = r.treatment_plan
        symp = r.symptoms

        if r.is_encrypted and r.encrypted_payload and r.encryption_key and r.encryption_iv:
            decrypted = encryption_service.decrypt_medical_payload(
                encrypted_payload_b64=r.encrypted_payload,
                wrapped_key_b64=r.encryption_key,
                iv_b64=r.encryption_iv
            )
            if isinstance(decrypted, dict) and "error" not in decrypted:
                diag = decrypted.get("diagnosis", diag)
                notes = decrypted.get("doctor_notes", notes)
                plan = decrypted.get("treatment_plan", plan)
                symp = decrypted.get("symptoms", symp)

        results.append(MedicalRecordOut(
            id=r.id,
            record_number=r.record_number,
            patient_id=r.patient_id,
            patient_name=r.patient.user.full_name if (r.patient and r.patient.user) else "Patient",
            doctor_id=r.doctor_id,
            doctor_name=r.doctor.user.full_name if (r.doctor and r.doctor.user) else "Doctor",
            doctor_specialization=r.doctor.specialization if r.doctor else "",
            appointment_id=r.appointment_id,
            visit_date=r.visit_date,
            chief_complaint=r.chief_complaint,
            symptoms=symp,
            diagnosis=diag,
            doctor_notes=notes,
            treatment_plan=plan,
            blood_pressure=r.blood_pressure,
            heart_rate=r.heart_rate,
            temperature=r.temperature,
            oxygen_saturation=r.oxygen_saturation,
            weight_kg=r.weight_kg,
            height_cm=r.height_cm,
            follow_up_date=r.follow_up_date,
            lab_reports=[LabReportOut(
                id=l.id,
                patient_id=l.patient_id,
                medical_record_id=l.medical_record_id,
                test_name=l.test_name,
                test_category=l.test_category,
                results_summary=l.results_summary,
                reference_range=l.reference_range,
                status=l.status,
                performed_at=l.performed_at
            ) for l in r.lab_reports],
            created_at=r.created_at,
            updated_at=r.updated_at
        ))
    return results

@router.post("", response_model=MedicalRecordOut)
def create_medical_record(
    rec_in: MedicalRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([RoleEnum.DOCTOR, RoleEnum.ADMIN]))
):
    doctor_id = rec_in.doctor_id
    if current_user.role == RoleEnum.DOCTOR:
        if not current_user.doctor_profile:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Doctor profile not found.")
        doctor_id = current_user.doctor_profile.id
    elif not doctor_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="doctor_id is required.")

    # Apply Hybrid Encryption to sensitive medical data
    sensitive_dict = {
        "diagnosis": rec_in.diagnosis,
        "doctor_notes": rec_in.doctor_notes or "",
        "treatment_plan": rec_in.treatment_plan or "",
        "symptoms": rec_in.symptoms
    }
    enc_meta = encryption_service.encrypt_medical_payload(sensitive_dict)

    record = MedicalRecord(
        record_number=generate_record_number(db),
        patient_id=rec_in.patient_id,
        doctor_id=doctor_id,
        appointment_id=rec_in.appointment_id,
        visit_date=rec_in.visit_date or datetime.now(timezone.utc).date(),
        chief_complaint=rec_in.chief_complaint,
        symptoms=rec_in.symptoms,
        diagnosis=rec_in.diagnosis,
        doctor_notes=rec_in.doctor_notes,
        treatment_plan=rec_in.treatment_plan,
        
        # Hybrid Encryption Storage
        is_encrypted=True,
        encrypted_payload=enc_meta["encrypted_payload"],
        encryption_key=enc_meta["encryption_key"],
        encryption_iv=enc_meta["encryption_iv"],
        encryption_tag=enc_meta["encryption_tag"],

        blood_pressure=rec_in.blood_pressure,
        heart_rate=rec_in.heart_rate,
        temperature=rec_in.temperature,
        oxygen_saturation=rec_in.oxygen_saturation,
        weight_kg=rec_in.weight_kg,
        height_cm=rec_in.height_cm,
        follow_up_date=rec_in.follow_up_date
    )
    db.add(record)
    db.flush()

    if rec_in.lab_reports:
        for lr in rec_in.lab_reports:
            lab_obj = LabReport(
                patient_id=rec_in.patient_id,
                medical_record_id=record.id,
                test_name=lr.test_name,
                test_category=lr.test_category or "Pathology",
                results_summary=lr.results_summary,
                reference_range=lr.reference_range,
                status=lr.status or "COMPLETED"
            )
            db.add(lab_obj)

    db.commit()
    db.refresh(record)

    return MedicalRecordOut(
        id=record.id,
        record_number=record.record_number,
        patient_id=record.patient_id,
        patient_name=record.patient.user.full_name if (record.patient and record.patient.user) else "Patient",
        doctor_id=record.doctor_id,
        doctor_name=record.doctor.user.full_name if (record.doctor and record.doctor.user) else "Doctor",
        doctor_specialization=record.doctor.specialization if record.doctor else "",
        appointment_id=record.appointment_id,
        visit_date=record.visit_date,
        chief_complaint=record.chief_complaint,
        symptoms=record.symptoms,
        diagnosis=record.diagnosis,
        doctor_notes=record.doctor_notes,
        treatment_plan=record.treatment_plan,
        blood_pressure=record.blood_pressure,
        heart_rate=record.heart_rate,
        temperature=record.temperature,
        oxygen_saturation=record.oxygen_saturation,
        weight_kg=record.weight_kg,
        height_cm=record.height_cm,
        follow_up_date=record.follow_up_date,
        lab_reports=[LabReportOut(
            id=l.id,
            patient_id=l.patient_id,
            medical_record_id=l.medical_record_id,
            test_name=l.test_name,
            test_category=l.test_category,
            results_summary=l.results_summary,
            reference_range=l.reference_range,
            status=l.status,
            performed_at=l.performed_at
        ) for l in record.lab_reports],
        created_at=record.created_at,
        updated_at=record.updated_at
    )
