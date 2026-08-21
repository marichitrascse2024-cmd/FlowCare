from datetime import date
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from app.models.patient import Patient
from app.models.medical_record import MedicalRecord, LabReport
from app.models.prescription import Prescription, PrescriptionItem

class AIMedicalSummaryEngine:
    """
    AI Medical Record Retrieval & Summarization Assistant.
    Extracts relevant clinical history, synthesizes condition chronologies,
    vitals trends, and medication records without hallucinating medical facts.
    """

    @classmethod
    def generate_summary(
        cls,
        db: Session,
        patient_id: int,
        query: Optional[str] = None
    ) -> Dict[str, Any]:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise ValueError(f"Patient with ID {patient_id} not found.")

        # Query medical records
        med_records_query = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient_id).order_by(MedicalRecord.visit_date.desc())
        all_records = med_records_query.all()

        # Query prescriptions
        prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient_id).order_by(Prescription.created_at.desc()).all()

        # Query lab reports
        lab_reports = db.query(LabReport).filter(LabReport.patient_id == patient_id).order_by(LabReport.performed_at.desc()).all()

        # Calculate patient age
        age_str = "Age N/A"
        if patient.date_of_birth:
            today = date.today()
            age = today.year - patient.date_of_birth.year - (
                (today.month, today.day) < (patient.date_of_birth.month, patient.date_of_birth.day)
            )
            age_str = f"{age} yrs"

        gender_str = patient.gender or "Unspecified"
        age_gender = f"{age_str}, {gender_str}"

        # Filter records if query is provided
        search_terms = query.lower().split() if query else []
        
        filtered_records = []
        for r in all_records:
            if not search_terms:
                filtered_records.append(r)
            else:
                combined_text = f"{r.diagnosis} {r.symptoms} {r.treatment_plan} {r.doctor_notes or ''}".lower()
                if any(term in combined_text for term in search_terms):
                    filtered_records.append(r)

        # Build categorized summary sections
        sections = []

        # 1. Diagnoses & Clinical Findings
        diagnoses_list = []
        for r in (filtered_records if filtered_records else all_records)[:5]:
            doc_name = r.doctor.user.full_name if (r.doctor and r.doctor.user) else "Attending Doctor"
            spec = r.doctor.specialization if r.doctor else "General"
            diagnoses_list.append(
                f"[{r.visit_date}] {r.diagnosis} (Chief Complaint: {r.chief_complaint or r.symptoms}) — Recorded by Dr. {doc_name} ({spec})"
            )
        if not diagnoses_list:
            diagnoses_list.append("No historical diagnosis records found matching query.")
        sections.append({
            "category": "Diagnoses & Clinical Visits",
            "details": diagnoses_list
        })

        # 2. Treatments & Procedures
        treatments_list = []
        for r in (filtered_records if filtered_records else all_records)[:4]:
            if r.treatment_plan:
                treatments_list.append(f"[{r.visit_date}] Plan: {r.treatment_plan}")
            if r.doctor_notes:
                treatments_list.append(f"[{r.visit_date}] Clinical Notes: {r.doctor_notes}")
        if not treatments_list:
            treatments_list.append("No specific procedural or treatment records noted.")
        sections.append({
            "category": "Past Treatments & Management",
            "details": treatments_list
        })

        # 3. Prescriptions & Medications
        medications_list = []
        for rx in prescriptions[:3]:
            for item in rx.items:
                medications_list.append(
                    f"{item.medicine_name} ({item.dosage}) — {item.frequency} for {item.duration_days} days [{item.route}]"
                )
        if not medications_list:
            medications_list.append("No active or historical medication orders on file.")
        sections.append({
            "category": "Medication History & Prescriptions",
            "details": medications_list
        })

        # 4. Laboratory & Diagnostic Tests
        labs_list = []
        for lab in lab_reports[:5]:
            labs_list.append(
                f"[{lab.performed_at.strftime('%Y-%m-%d')}] {lab.test_name} ({lab.test_category}): {lab.results_summary or 'Completed'} (Ref: {lab.reference_range or 'Normal'})"
            )
        if not labs_list:
            labs_list.append("No prior lab reports recorded.")
        sections.append({
            "category": "Diagnostic & Laboratory Investigations",
            "details": labs_list
        })

        # 5. Risk Alerts & Allergies
        risk_list = []
        if patient.known_allergies:
            risk_list.append(f"⚠️ ALLERGY ALERT: {patient.known_allergies}")
        else:
            risk_list.append("No known drug or food allergies documented.")

        if patient.medical_history_notes:
            risk_list.append(f"Chronic Profile: {patient.medical_history_notes}")

        # Check for abnormal vitals in latest record
        if all_records:
            latest_rec = all_records[0]
            if latest_rec.blood_pressure:
                risk_list.append(f"Latest Recorded BP: {latest_rec.blood_pressure} mmHg on {latest_rec.visit_date}")
            if latest_rec.heart_rate and (latest_rec.heart_rate > 100 or latest_rec.heart_rate < 60):
                risk_list.append(f"Notable Heart Rate: {latest_rec.heart_rate} bpm (Review recommended)")
            if latest_rec.oxygen_saturation and latest_rec.oxygen_saturation < 95:
                risk_list.append(f"Low SpO2 Alert: {latest_rec.oxygen_saturation}%")

        sections.append({
            "category": "Clinical Risk Alerts & Allergies",
            "details": risk_list
        })

        return {
            "patient_id": patient.id,
            "patient_name": patient.user.full_name if patient.user else "Patient",
            "patient_code": patient.patient_code,
            "age_gender": age_gender,
            "blood_group": patient.blood_group,
            "known_allergies": patient.known_allergies,
            "total_past_visits": len(all_records),
            "summary_sections": sections,
            "ai_disclaimer": "AI-assisted clinical summary extracted from verified electronic health records. Healthcare providers must review primary records before final clinical determinations."
        }

ai_medical_summary_engine = AIMedicalSummaryEngine()
