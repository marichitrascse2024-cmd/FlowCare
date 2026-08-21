from typing import Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.patient import Patient
from app.models.medical_record import MedicalRecord
from app.models.risk_prediction import RiskPrediction, RiskLevelEnum, RiskTypeEnum

class RiskPredictionService:
    DISCLAIMER = "AI-generated risk assessment. This is not a medical diagnosis. Final clinical decisions must be made by a qualified doctor."

    @classmethod
    def calculate_cardiovascular_risk(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Multi-factor Cardiovascular Disease (CVD) 10-Year Risk Engine.
        Uses: Age, Gender, Systolic BP, Diastolic BP, BMI, Blood Sugar/Diabetes, Smoking/History, Symptoms.
        """
        age = float(data.get("age", 40))
        gender = str(data.get("gender", "Male")).capitalize()
        systolic = float(data.get("systolic_bp", 120))
        diastolic = float(data.get("diastolic_bp", 80))
        bmi = float(data.get("bmi", 24.0))
        blood_sugar = float(data.get("blood_sugar", 100))
        is_smoker = bool(data.get("is_smoker", False))
        family_history = bool(data.get("family_history_heart_disease", False))
        symptoms = data.get("symptoms", "")

        score = 0.0
        factors: List[str] = []
        recs: List[str] = []

        # Age Contribution
        if age >= 60:
            score += 25.0
            factors.append(f"Advanced age ({int(age)} yrs)")
        elif age >= 45:
            score += 15.0
            factors.append(f"Age threshold ({int(age)} yrs)")
        else:
            score += 5.0

        # Blood Pressure Contribution
        if systolic >= 160 or diastolic >= 100:
            score += 30.0
            factors.append(f"Stage 2 Hypertension (BP: {int(systolic)}/{int(diastolic)} mmHg)")
            recs.append("Urgent cardiologist consultation and 24-hr ambulatory BP monitoring.")
        elif systolic >= 140 or diastolic >= 90:
            score += 20.0
            factors.append(f"Stage 1 Hypertension (BP: {int(systolic)}/{int(diastolic)} mmHg)")
            recs.append("Cardiovascular evaluation and dietary sodium reduction.")
        elif systolic >= 130 or diastolic >= 85:
            score += 10.0
            factors.append(f"Elevated Blood Pressure (BP: {int(systolic)}/{int(diastolic)} mmHg)")

        # BMI Contribution
        if bmi >= 30:
            score += 15.0
            factors.append(f"Obesity Class I/II (BMI: {bmi:.1f} kg/m²)")
            recs.append("Structured metabolic weight management & cardiovascular conditioning.")
        elif bmi >= 25:
            score += 8.0
            factors.append(f"Overweight BMI ({bmi:.1f} kg/m²)")

        # Blood Sugar / Glycemic Contribution
        if blood_sugar >= 160:
            score += 20.0
            factors.append(f"Elevated Blood Glucose ({int(blood_sugar)} mg/dL)")
            recs.append("HbA1c test and glycemic regulation consultation.")
        elif blood_sugar >= 120:
            score += 10.0
            factors.append(f"Borderline Fasting Glucose ({int(blood_sugar)} mg/dL)")

        # Lifestyle & History
        if is_smoker:
            score += 18.0
            factors.append("Active tobacco/smoking history")
            recs.append("Smoking cessation counseling and pulmonary function check.")
        if family_history:
            score += 12.0
            factors.append("Family history of early coronary artery disease")

        # Symptoms
        symptoms_lower = str(symptoms).lower()
        if any(w in symptoms_lower for w in ["chest pain", "shortness of breath", "palpitation", "dyspnea"]):
            score += 20.0
            factors.append("Reported acute cardiovascular symptoms (Chest pain / Dyspnea)")
            recs.append("Immediate 12-lead ECG, Echo, and Troponin assessment.")

        # Determine Risk Level
        risk_score_pct = min(100.0, round(score, 1))
        if risk_score_pct >= 45.0:
            level = RiskLevelEnum.HIGH.value
        elif risk_score_pct >= 22.0:
            level = RiskLevelEnum.MODERATE.value
        else:
            level = RiskLevelEnum.LOW.value

        if not recs:
            recs.append("Maintain annual cardiovascular wellness checkup and balanced Mediterranean diet.")

        return {
            "risk_type": RiskTypeEnum.CARDIOVASCULAR.value,
            "risk_level": level,
            "risk_score": risk_score_pct,
            "contributing_factors": factors,
            "recommendations": recs,
            "disclaimer": cls.DISCLAIMER
        }

    @classmethod
    def calculate_diabetes_risk(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """Type 2 Diabetes Clinical Risk Engine (FINDRISC inspired)."""
        age = float(data.get("age", 40))
        bmi = float(data.get("bmi", 24.0))
        blood_sugar = float(data.get("blood_sugar", 100))
        family_history = bool(data.get("family_history_diabetes", False))
        systolic = float(data.get("systolic_bp", 120))
        symptoms = str(data.get("symptoms", "")).lower()

        score = 0.0
        factors = []
        recs = []

        if age >= 55:
            score += 20.0
            factors.append(f"Age > 55 years ({int(age)} yrs)")
        elif age >= 45:
            score += 10.0
            factors.append(f"Age 45-54 years ({int(age)} yrs)")

        if bmi >= 30:
            score += 25.0
            factors.append(f"High BMI / Obesity ({bmi:.1f} kg/m²)")
            recs.append("Target 7% body weight reduction through nutritional guidance.")
        elif bmi >= 25:
            score += 12.0
            factors.append(f"Overweight BMI ({bmi:.1f} kg/m²)")

        if blood_sugar >= 180:
            score += 35.0
            factors.append(f"Hyperglycemia detected ({int(blood_sugar)} mg/dL)")
            recs.append("Order Fasting Plasma Glucose, HbA1c, and Endocrinology review.")
        elif blood_sugar >= 120:
            score += 20.0
            factors.append(f"Impaired Fasting Glucose ({int(blood_sugar)} mg/dL)")
            recs.append("Order Oral Glucose Tolerance Test (OGTT).")

        if family_history:
            score += 15.0
            factors.append("First-degree family history of Type 2 Diabetes")

        if systolic >= 140:
            score += 10.0
            factors.append(f"Co-occurring Hypertension ({int(systolic)} mmHg)")

        if any(w in symptoms for w in ["fatigue", "frequent urination", "thirst", "polyuria", "polydipsia"]):
            score += 18.0
            factors.append("Reported symptoms of polyuria / polydipsia / chronic fatigue")

        risk_score_pct = min(100.0, round(score, 1))
        if risk_score_pct >= 45.0:
            level = RiskLevelEnum.HIGH.value
        elif risk_score_pct >= 20.0:
            level = RiskLevelEnum.MODERATE.value
        else:
            level = RiskLevelEnum.LOW.value

        if not recs:
            recs.append("Routine annual glycemic monitoring and 150 mins/week aerobic activity.")

        return {
            "risk_type": RiskTypeEnum.DIABETES.value,
            "risk_level": level,
            "risk_score": risk_score_pct,
            "contributing_factors": factors,
            "recommendations": recs,
            "disclaimer": cls.DISCLAIMER
        }

    @classmethod
    def evaluate_and_persist(cls, db: Session, patient_id: int, input_data: Dict[str, Any], doctor_id: int = None) -> RiskPrediction:
        """Evaluate disease risk and persist record in database."""
        risk_type = input_data.get("risk_type", RiskTypeEnum.CARDIOVASCULAR.value)
        
        if "Diabetes" in risk_type:
            res = cls.calculate_diabetes_risk(input_data)
        else:
            res = cls.calculate_cardiovascular_risk(input_data)

        prediction = RiskPrediction(
            patient_id=patient_id,
            doctor_id=doctor_id,
            risk_type=res["risk_type"],
            risk_level=res["risk_level"],
            risk_score=res["risk_score"],
            contributing_factors=res["contributing_factors"],
            recommendations=res["recommendations"],
            input_vitals=input_data,
            disclaimer=cls.DISCLAIMER,
            created_at=datetime.now(timezone.utc)
        )
        db.add(prediction)
        db.commit()
        db.refresh(prediction)
        return prediction

risk_prediction_service = RiskPredictionService()
