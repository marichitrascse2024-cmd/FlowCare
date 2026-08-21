from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.patient import Patient
from app.models.risk_prediction import RiskPrediction
from app.services.risk_prediction_service import risk_prediction_service

router = APIRouter(prefix="", tags=["AI Disease Risk Prediction"])

class RiskPredictionRequest(BaseModel):
    patient_id: Optional[int] = None
    risk_type: str = "Cardiovascular Disease Risk" # Cardiovascular Disease Risk or Type 2 Diabetes Risk
    age: Optional[float] = 40.0
    gender: Optional[str] = "Male"
    systolic_bp: Optional[float] = 120.0
    diastolic_bp: Optional[float] = 80.0
    bmi: Optional[float] = 24.5
    blood_sugar: Optional[float] = 100.0
    is_smoker: Optional[bool] = False
    family_history_heart_disease: Optional[bool] = False
    family_history_diabetes: Optional[bool] = False
    symptoms: Optional[str] = ""

class RiskPredictionResponse(BaseModel):
    id: Optional[int] = None
    patient_id: Optional[int] = None
    risk_type: str
    risk_level: str
    risk_score: float
    contributing_factors: List[str]
    recommendations: List[str]
    disclaimer: str
    created_at: Optional[str] = None

@router.post("/ai/disease-risk", response_model=RiskPredictionResponse)
def evaluate_disease_risk(
    req: RiskPredictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Run multi-factor AI Disease Risk assessment and persist result in database.
    Displays clear medical disclaimer that this is risk scoring, not a medical diagnosis.
    """
    target_patient_id = req.patient_id

    # If patient is logged in and patient_id omitted, default to own profile
    if current_user.role == RoleEnum.PATIENT and current_user.patient_profile:
        target_patient_id = current_user.patient_profile.id
    elif not target_patient_id:
        # Fallback to first patient or create calculation
        pat = db.query(Patient).first()
        target_patient_id = pat.id if pat else 1

    doctor_id = current_user.doctor_profile.id if (current_user.role == RoleEnum.DOCTOR and current_user.doctor_profile) else None

    # Retrieve patient age/gender if available
    patient = db.query(Patient).filter(Patient.id == target_patient_id).first()
    payload = req.model_dump()
    if patient:
        if patient.gender and not req.gender:
            payload["gender"] = patient.gender
        if patient.date_of_birth:
            from datetime import date
            today = date.today()
            calc_age = today.year - patient.date_of_birth.year
            payload["age"] = float(calc_age)

    prediction = risk_prediction_service.evaluate_and_persist(
        db=db,
        patient_id=target_patient_id,
        input_data=payload,
        doctor_id=doctor_id
    )

    return RiskPredictionResponse(
        id=prediction.id,
        patient_id=prediction.patient_id,
        risk_type=prediction.risk_type,
        risk_level=prediction.risk_level,
        risk_score=prediction.risk_score,
        contributing_factors=prediction.contributing_factors or [],
        recommendations=prediction.recommendations or [],
        disclaimer=prediction.disclaimer,
        created_at=str(prediction.created_at)
    )

@router.get("/patients/{patient_id}/risk-predictions", response_model=List[RiskPredictionResponse])
def get_patient_risk_predictions(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == RoleEnum.PATIENT and (not current_user.patient_profile or current_user.patient_profile.id != patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    preds = db.query(RiskPrediction).filter(
        RiskPrediction.patient_id == patient_id
    ).order_by(RiskPrediction.created_at.desc()).limit(10).all()

    return [
        RiskPredictionResponse(
            id=p.id,
            patient_id=p.patient_id,
            risk_type=p.risk_type,
            risk_level=p.risk_level,
            risk_score=p.risk_score,
            contributing_factors=p.contributing_factors or [],
            recommendations=p.recommendations or [],
            disclaimer=p.disclaimer,
            created_at=str(p.created_at)
        ) for p in preds
    ]
