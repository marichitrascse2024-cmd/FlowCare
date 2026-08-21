from datetime import date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.schemas.billing import BillItemCreate

class WaitingTimeRequest(BaseModel):
    doctor_id: int
    patient_id: Optional[int] = None
    priority: Optional[str] = "NORMAL" # NORMAL, URGENT, EMERGENCY, ELDERLY
    appointment_type: Optional[str] = "GENERAL"

class WaitingTimeResponse(BaseModel):
    doctor_id: int
    doctor_name: str
    specialization: str
    room_number: str
    patients_ahead: int
    average_consultation_time: int
    estimated_wait_minutes: int
    confidence_score: float # e.g. 0.92
    rush_hour_factor: float
    disclaimer: str = "Estimated waiting time is an AI-assisted statistical calculation and may vary depending on patient clinical complexity."

class SlotRecommendationRequest(BaseModel):
    doctor_id: Optional[int] = None
    specialization: Optional[str] = None
    preferred_date: Optional[date] = None
    preferred_time_of_day: Optional[str] = "ANY" # MORNING, AFTERNOON, EVENING, ANY
    urgency: Optional[str] = "NORMAL" # LOW, NORMAL, HIGH

class RecommendedSlot(BaseModel):
    doctor_id: int
    doctor_name: str
    specialization: str
    room_number: str
    appointment_date: date
    time_slot: str
    consultation_fee: float
    load_score: float # 0.0 to 1.0 (lower is less busy)
    reason: str

class SlotRecommendationResponse(BaseModel):
    recommendations: List[RecommendedSlot]
    ai_note: str

class MedicalSummaryRequest(BaseModel):
    patient_id: int
    query: Optional[str] = None # e.g. "cardiac history", "diabetes and medications", or blank for full summary

class MedicalSummaryItem(BaseModel):
    category: str # "Active Diagnoses", "Past Treatments", "Current Prescriptions", "Lab Findings", "Risk Alerts"
    details: List[str]

class MedicalSummaryResponse(BaseModel):
    patient_id: int
    patient_name: str
    patient_code: str
    age_gender: str
    blood_group: Optional[str] = None
    known_allergies: Optional[str] = None
    total_past_visits: int
    summary_sections: List[MedicalSummaryItem]
    ai_disclaimer: str = "AI-assisted clinical summary generated from verified electronic medical records. Review original records for definitive treatment decisions."

class BillingAssistanceRequest(BaseModel):
    appointment_id: Optional[int] = None
    medical_record_id: Optional[int] = None
    patient_id: Optional[int] = None

class BillingDraftItem(BaseModel):
    service_code: Optional[str] = None
    item_name: str
    category: str
    unit_price: float
    quantity: int
    subtotal_price: float
    is_ai_suggested: bool = True
    reasoning: str

class BillingAssistanceResponse(BaseModel):
    patient_id: int
    patient_name: str
    appointment_id: Optional[int] = None
    draft_items: List[BillingDraftItem]
    detected_subtotal: float
    suggested_discount: float
    suggested_tax: float
    suggested_total: float
    ai_warnings: List[str] # e.g. "Duplicate Blood Test detected in same session", "Consultation note mentions ECG but not in billable items"
    ai_disclaimer: str = "AI draft billing prepared automatically. Authorized hospital staff review and confirmation is required prior to invoice finalization."
