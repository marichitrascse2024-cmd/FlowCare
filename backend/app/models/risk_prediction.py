from datetime import datetime, timezone
import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Enum, JSON
from sqlalchemy.orm import relationship
from app.database.database import Base

class RiskLevelEnum(str, enum.Enum):
    LOW = "LOW RISK"
    MODERATE = "MODERATE RISK"
    HIGH = "HIGH RISK"

class RiskTypeEnum(str, enum.Enum):
    CARDIOVASCULAR = "Cardiovascular Disease Risk"
    DIABETES = "Type 2 Diabetes Risk"
    HYPERTENSION = "Hypertension Complication Risk"
    GENERAL_HEALTH = "Comprehensive Health Risk"

class RiskPrediction(Base):
    __tablename__ = "risk_predictions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True)
    
    risk_type = Column(String(100), default="Cardiovascular Disease Risk", nullable=False)
    risk_level = Column(String(50), default="LOW RISK", nullable=False)
    risk_score = Column(Float, default=0.0, nullable=False) # 0 to 100%
    
    contributing_factors = Column(JSON, nullable=True) # List of factors e.g. ["Elevated BP", "Age > 50"]
    recommendations = Column(JSON, nullable=True) # Actionable recommendations
    input_vitals = Column(JSON, nullable=True) # Vitals snapshot used for prediction
    
    disclaimer = Column(String(255), default="AI-generated risk assessment. This is not a medical diagnosis. Final clinical decisions must be made by a qualified doctor.")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="risk_predictions")
    doctor = relationship("Doctor")
