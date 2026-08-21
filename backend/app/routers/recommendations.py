from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.recommendation_service import recommendation_service

router = APIRouter(prefix="", tags=["Doctor Recommendation System"])

class SymptomRecommendationRequest(BaseModel):
    symptoms: str
    target_date: Optional[str] = None

class DoctorCardOut(BaseModel):
    doctor_id: int
    doctor_code: str
    full_name: str
    specialization: str
    qualification: str
    experience_years: int
    consultation_fee: float
    room_number: str
    biography: Optional[str] = None
    available_slots_count: int
    next_available_slot: str

class RecommendationResponse(BaseModel):
    recommended_department: str
    confidence_score: int
    reason: str
    matched_symptoms: List[str]
    secondary_departments: List[str]
    doctors: List[DoctorCardOut]
    total_doctors_available: int
    disclaimer: str

@router.post("/doctor-recommendation", response_model=RecommendationResponse)
def get_doctor_recommendations(
    req: SymptomRecommendationRequest,
    db: Session = Depends(get_db)
):
    """
    Analyze symptoms and recommend appropriate clinical department + all available doctors.
    """
    if not req.symptoms.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please describe your symptoms to receive recommendations.")

    res = recommendation_service.analyze_symptoms_and_recommend(
        db=db,
        symptoms_text=req.symptoms,
        target_date=req.target_date
    )
    return res

@router.get("/doctors/recommended", response_model=RecommendationResponse)
def query_recommended_doctors(
    symptoms: str = Query(..., description="Patient symptoms description"),
    target_date: Optional[str] = Query(None, description="Preferred appointment date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    if not symptoms.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Symptoms parameter is required.")

    res = recommendation_service.analyze_symptoms_and_recommend(
        db=db,
        symptoms_text=symptoms,
        target_date=target_date
    )
    return res
