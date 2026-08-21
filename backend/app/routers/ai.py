import time
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.audit import AIPredictionLog
from app.schemas.ai import (
    WaitingTimeRequest, WaitingTimeResponse,
    SlotRecommendationRequest, SlotRecommendationResponse, RecommendedSlot,
    MedicalSummaryRequest, MedicalSummaryResponse, MedicalSummaryItem,
    BillingAssistanceRequest, BillingAssistanceResponse, BillingDraftItem
)
from app.ai.waiting_time import waiting_time_predictor
from app.ai.appointment_scheduler import ai_appointment_scheduler
from app.ai.medical_summary import ai_medical_summary_engine
from app.ai.billing_assistant import ai_billing_assistant

router = APIRouter(prefix="/ai", tags=["AI Assistance Modules"])

@router.post("/waiting-time", response_model=WaitingTimeResponse)
def predict_waiting_time(
    req: WaitingTimeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start_time = time.time()
    
    patient_id = req.patient_id
    if current_user.role == RoleEnum.PATIENT and current_user.patient_profile:
        patient_id = current_user.patient_profile.id

    result = waiting_time_predictor.predict(
        db=db,
        doctor_id=req.doctor_id,
        patient_id=patient_id,
        priority=req.priority or "NORMAL",
        appointment_type=req.appointment_type or "GENERAL"
    )

    latency = round((time.time() - start_time) * 1000, 2)
    # Log prediction
    ai_log = AIPredictionLog(
        module_name="WAITING_TIME",
        input_payload=json.dumps(req.model_dump(), default=str),
        output_result=json.dumps(result, default=str),
        latency_ms=latency
    )
    db.add(ai_log)
    db.commit()

    return WaitingTimeResponse(**result)

@router.post("/appointment-suggestion", response_model=SlotRecommendationResponse)
def recommend_appointment_slots(
    req: SlotRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start_time = time.time()

    slots = ai_appointment_scheduler.recommend_slots(
        db=db,
        doctor_id=req.doctor_id,
        specialization=req.specialization,
        preferred_date=req.preferred_date,
        preferred_time_of_day=req.preferred_time_of_day or "ANY",
        urgency=req.urgency or "NORMAL"
    )

    latency = round((time.time() - start_time) * 1000, 2)
    ai_log = AIPredictionLog(
        module_name="APPOINTMENT_SCHEDULING",
        input_payload=json.dumps(req.model_dump(), default=str),
        output_result=json.dumps(slots, default=str),
        latency_ms=latency
    )
    db.add(ai_log)
    db.commit()

    return SlotRecommendationResponse(
        recommendations=[RecommendedSlot(**s) for s in slots],
        ai_note="Slots are dynamically ranked based on doctor workload balance, low queue latency, and zero conflict assurance."
    )

@router.post("/medical-summary", response_model=MedicalSummaryResponse)
def get_medical_summary(
    req: MedicalSummaryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # If patient, verify they are requesting their own record
    if current_user.role == RoleEnum.PATIENT and (not current_user.patient_profile or current_user.patient_profile.id != req.patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    start_time = time.time()
    try:
        summary_data = ai_medical_summary_engine.generate_summary(
            db=db,
            patient_id=req.patient_id,
            query=req.query
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    latency = round((time.time() - start_time) * 1000, 2)
    ai_log = AIPredictionLog(
        module_name="MEDICAL_SUMMARY",
        input_payload=json.dumps(req.model_dump(), default=str),
        output_result=json.dumps(summary_data, default=str),
        latency_ms=latency
    )
    db.add(ai_log)
    db.commit()

    return MedicalSummaryResponse(
        patient_id=summary_data["patient_id"],
        patient_name=summary_data["patient_name"],
        patient_code=summary_data["patient_code"],
        age_gender=summary_data["age_gender"],
        blood_group=summary_data["blood_group"],
        known_allergies=summary_data["known_allergies"],
        total_past_visits=summary_data["total_past_visits"],
        summary_sections=[MedicalSummaryItem(**sec) for sec in summary_data["summary_sections"]],
        ai_disclaimer=summary_data["ai_disclaimer"]
    )

@router.post("/billing-assistance", response_model=BillingAssistanceResponse)
def get_billing_assistance(
    req: BillingAssistanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start_time = time.time()
    try:
        draft = ai_billing_assistant.generate_draft_bill(
            db=db,
            patient_id=req.patient_id,
            appointment_id=req.appointment_id,
            medical_record_id=req.medical_record_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    latency = round((time.time() - start_time) * 1000, 2)
    ai_log = AIPredictionLog(
        module_name="BILLING_ASSISTANT",
        input_payload=json.dumps(req.model_dump(), default=str),
        output_result=json.dumps(draft, default=str),
        latency_ms=latency
    )
    db.add(ai_log)
    db.commit()

    return BillingAssistanceResponse(
        patient_id=draft["patient_id"],
        patient_name=draft["patient_name"],
        appointment_id=draft["appointment_id"],
        draft_items=[BillingDraftItem(**item) for item in draft["draft_items"]],
        detected_subtotal=draft["detected_subtotal"],
        suggested_discount=draft["suggested_discount"],
        suggested_tax=draft["suggested_tax"],
        suggested_total=draft["suggested_total"],
        ai_warnings=draft["ai_warnings"],
        ai_disclaimer=draft["ai_disclaimer"]
    )
