import re
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord, LabReport
from app.models.prescription import Prescription
from app.models.billing import HospitalService, Bill, BillItem

class AIBillingAssistant:
    """
    AI-Assisted Automated Billing Draft Generator & Duplicate/Missing Charge Detector.
    Scans consultation data, clinical notes, lab investigations, and pharmacy orders,
    correlates with the hospital service catalog, flags anomalies, and creates a draft bill
    for human staff verification.
    """

    @classmethod
    def generate_draft_bill(
        cls,
        db: Session,
        patient_id: Optional[int] = None,
        appointment_id: Optional[int] = None,
        medical_record_id: Optional[int] = None
    ) -> Dict[str, Any]:
        # Resolve patient and appointment/record
        appointment = None
        medical_record = None
        patient = None

        if appointment_id:
            appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
            if appointment:
                patient_id = appointment.patient_id
                medical_record = appointment.medical_record

        if medical_record_id and not medical_record:
            medical_record = db.query(MedicalRecord).filter(MedicalRecord.id == medical_record_id).first()
            if medical_record and not patient_id:
                patient_id = medical_record.patient_id

        if not patient_id:
            raise ValueError("Patient ID, Appointment ID, or Medical Record ID must be provided.")

        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise ValueError(f"Patient with ID {patient_id} not found.")

        # If medical record still not resolved, get the latest record for patient
        if not medical_record:
            medical_record = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient_id).order_by(MedicalRecord.visit_date.desc()).first()

        # Load hospital service price catalog
        catalog_services = db.query(HospitalService).filter(HospitalService.is_active == True).all()
        service_map = {s.service_name.lower(): s for s in catalog_services}

        draft_items: List[Dict[str, Any]] = []
        ai_warnings: List[str] = []
        seen_item_keys = set()

        # 1. Doctor Consultation Fee
        doctor = None
        if appointment and appointment.doctor:
            doctor = appointment.doctor
        elif medical_record and medical_record.doctor:
            doctor = medical_record.doctor

        if doctor:
            cons_fee = doctor.consultation_fee or 500.0
            doc_name = doctor.user.full_name if doctor.user else "Physician"
            draft_items.append({
                "service_code": "SRV-CONS",
                "item_name": f"Doctor Consultation — Dr. {doc_name} ({doctor.specialization})",
                "category": "Consultation",
                "unit_price": cons_fee,
                "quantity": 1,
                "subtotal_price": cons_fee,
                "is_ai_suggested": True,
                "reasoning": f"Standard {doctor.specialization} consultation fee"
            })
            seen_item_keys.add("consultation")

        # 2. Lab Reports / Diagnostic Investigations
        if medical_record and medical_record.lab_reports:
            for lab in medical_record.lab_reports:
                lab_key = lab.test_name.strip().lower()
                matched_srv = None
                
                # Check fuzzy match in catalog
                for cat_name, srv in service_map.items():
                    if cat_name in lab_key or lab_key in cat_name:
                        matched_srv = srv
                        break

                price = matched_srv.base_price if matched_srv else 450.0 # Standard default lab rate if not in catalog
                srv_code = matched_srv.service_code if matched_srv else "SRV-LAB-GEN"

                # Check duplicate detection
                if lab_key in seen_item_keys:
                    ai_warnings.append(f"⚠️ Potential duplicate charge flagged: '{lab.test_name}' appears more than once in this visit.")
                else:
                    seen_item_keys.add(lab_key)

                draft_items.append({
                    "service_code": srv_code,
                    "item_name": f"Diagnostic Test: {lab.test_name}",
                    "category": "Laboratory",
                    "unit_price": price,
                    "quantity": 1,
                    "subtotal_price": price,
                    "is_ai_suggested": True,
                    "reasoning": f"Matched from ordered clinical investigation ({lab.test_category})"
                })

        # 3. Prescriptions / Pharmacy items
        latest_rx = db.query(Prescription).filter(Prescription.patient_id == patient_id).order_by(Prescription.created_at.desc()).first()
        if latest_rx and latest_rx.items:
            for med in latest_rx.items:
                med_key = med.medicine_name.strip().lower()
                med_price = 150.0 # Default standard unit medicine cost
                draft_items.append({
                    "service_code": "SRV-PHARM",
                    "item_name": f"Pharmacy: {med.medicine_name} ({med.dosage} x {med.duration_days} days)",
                    "category": "Pharmacy",
                    "unit_price": med_price,
                    "quantity": 1,
                    "subtotal_price": med_price,
                    "is_ai_suggested": True,
                    "reasoning": f"Dispensation based on electronic prescription #{latest_rx.prescription_number}"
                })

        # 4. Text Mining for unbilled procedures in Doctor Notes
        if medical_record and (medical_record.doctor_notes or medical_record.treatment_plan):
            clinical_text = f"{medical_record.doctor_notes or ''} {medical_record.treatment_plan or ''}".lower()
            
            # Check for ECG
            if "ecg" in clinical_text and not any("ecg" in item["item_name"].lower() for item in draft_items):
                ai_warnings.append("💡 Note: Clinical notes mention 'ECG' but no corresponding lab/diagnostic charge was recorded.")
            
            # Check for X-Ray
            if "x-ray" in clinical_text or "xray" in clinical_text:
                if not any("x-ray" in item["item_name"].lower() for item in draft_items):
                    ai_warnings.append("💡 Note: Clinical notes mention 'X-Ray' but no radiology service was directly linked.")

            # Check for wound dressing or minor procedure
            if "dressing" in clinical_text or "suture" in clinical_text:
                draft_items.append({
                    "service_code": "SRV-PROC-DRESS",
                    "item_name": "Procedure: Clinical Dressing & Minor Care",
                    "category": "Procedure",
                    "unit_price": 250.0,
                    "quantity": 1,
                    "subtotal_price": 250.0,
                    "is_ai_suggested": True,
                    "reasoning": "Detected procedural care in attending doctor's notes"
                })

        # Calculate totals
        subtotal = sum(item["subtotal_price"] for item in draft_items)
        tax = round(subtotal * 0.05, 2) # 5% healthcare service tax
        discount = 0.0
        total = round(subtotal + tax - discount, 2)

        return {
            "patient_id": patient.id,
            "patient_name": patient.user.full_name if patient.user else "Patient",
            "appointment_id": appointment_id,
            "draft_items": draft_items,
            "detected_subtotal": round(subtotal, 2),
            "suggested_discount": discount,
            "suggested_tax": tax,
            "suggested_total": total,
            "ai_warnings": ai_warnings,
            "ai_disclaimer": "AI draft invoice generated from clinic events. Staff review and human confirmation is mandatory before billing finalization."
        }

ai_billing_assistant = AIBillingAssistant()
