from typing import List, Dict, Any, Optional
from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.models.doctor import Doctor
from app.models.appointment import Appointment, AppointmentStatusEnum

DEPARTMENT_KEYWORD_RULES = {
    "Cardiology": [
        "chest pain", "angina", "heart", "cardiac", "palpitation", "irregular pulse",
        "high bp", "hypertension", "cholesterol", "shortness of breath on walking", "breathless",
        "chest tightness", "sweating", "left arm pain"
    ],
    "Orthopedics": [
        "knee pain", "joint pain", "back pain", "fracture", "bone", "ligament", "sprain",
        "arthritis", "shoulder pain", "spondylosis", "spine", "ankle swelling", "hip pain",
        "cartilage", "posture", "swollen knee", "walking difficulty"
    ],
    "General Medicine": [
        "fever", "viral", "cold", "body ache", "weakness", "fatigue", "chills", "malaise",
        "weight loss", "general checkup", "infection", "headache and fever", "dizziness",
        "typhoid", "dengue", "flu"
    ],
    "Pediatrics": [
        "child", "baby", "infant", "newborn", "kid", "vaccination", "pediatric",
        "growth", "milestones", "child fever", "child cough", "child rash", "colic",
        "toddler", "bedwetting"
    ],
    "Dermatology": [
        "skin rash", "itching", "eczema", "psoriasis", "acne", "pimple", "hair fall",
        "dandruff", "fungal", "dermatitis", "mole", "skin allergy", "dry skin",
        "pigmentation", "skin lesion", "scabies"
    ],
    "Neurology": [
        "migraine", "severe headache", "seizure", "fits", "numbness", "tingling",
        "nerve pain", "stroke", "paralysis", "memory loss", "tremor", "neuropathy",
        "vertigo", "fainting", "loss of balance"
    ],
    "Gynecology": [
        "pregnancy", "antenatal", "menstrual", "period", "cramps", "pcos", "pcod",
        "pelvic pain", "discharge", "fertility", "uterus", "fibroid", "ovary",
        "trimester", "irregular periods", "morning sickness"
    ],
    "ENT": [
        "ear pain", "ear discharge", "hearing loss", "sore throat", "tonsil", "nasal",
        "sinus", "sinusitis", "nose bleed", "hoarse voice", "tinnitus", "ringing ear",
        "throat pain", "blocked nose", "ear infection"
    ],
    "Ophthalmology": [
        "eye pain", "blurred vision", "red eye", "cataract", "eye strain", "double vision",
        "glaucoma", "watery eyes", "spectacles", "power check", "dry eyes", "itching eyes",
        "vision loss", "squint"
    ],
    "Dental": [
        "toothache", "tooth", "cavity", "gum bleeding", "bad breath", "root canal",
        "wisdom tooth", "braces", "teeth cleaning", "jaw pain", "swollen gum",
        "sensitive teeth", "dental decay"
    ],
    "Pulmonology": [
        "chronic cough", "wheezing", "asthma", "bronchitis", "copd", "lung",
        "phlegm", "pneumonia", "difficulty breathing", "chest congestion",
        "smoker cough", "shortness of breath"
    ],
    "Gastroenterology": [
        "stomach pain", "acid reflux", "gerd", "heartburn", "vomiting", "diarrhea",
        "constipation", "ulcer", "jaundice", "bloating", "indigestion", "gastric",
        "liver", "fatty liver", "gas problem", "abdomen"
    ]
}

class DoctorRecommendationService:
    @classmethod
    def analyze_symptoms_and_recommend(
        cls, 
        db: Session, 
        symptoms_text: str, 
        target_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze patient's free-text symptoms, recommend the most suitable clinical department,
        and retrieve all active doctors belonging to that department with live schedule availability.
        """
        clean_text = str(symptoms_text).lower().strip()
        
        # Scoring each department based on keyword hits and exact phrase weights
        scores: Dict[str, int] = {dept: 0 for dept in DEPARTMENT_KEYWORD_RULES}
        matched_terms: Dict[str, List[str]] = {dept: [] for dept in DEPARTMENT_KEYWORD_RULES}

        for dept, keywords in DEPARTMENT_KEYWORD_RULES.items():
            for kw in keywords:
                if kw in clean_text:
                    # Multi-word phrase has higher specificity
                    weight = 3 if " " in kw else 1
                    scores[dept] += weight
                    matched_terms[dept].append(kw)

        # Find department with maximum score
        sorted_depts = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        best_dept, best_score = sorted_depts[0]

        # Default fallback to General Medicine if no specific match
        if best_score == 0:
            best_dept = "General Medicine"
            reason = "General clinical evaluation based on non-specific symptoms."
        else:
            hit_words = ", ".join(matched_terms[best_dept][:3])
            reason = f"Symptoms matching {best_dept} indicators ({hit_words})."

        # Query all real doctors for the recommended department
        docs_query = db.query(Doctor).filter(Doctor.specialization == best_dept).all()

        # If none found for exact specialization, fallback to all available
        if not docs_query:
            docs_query = db.query(Doctor).all()

        check_date = target_date or str(date.today())

        recommended_doctors = []
        for doc in docs_query:
            doc_name = doc.user.full_name if doc.user else "Doctor"
            if not doc_name.startswith("Dr."):
                doc_name = f"Dr. {doc_name}"

            # Check next available slots
            standard_slots = [
                "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
                "11:00 AM", "11:30 AM", "02:00 PM", "02:30 PM",
                "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"
            ]
            booked_slots = [
                a.time_slot for a in db.query(Appointment).filter(
                    Appointment.doctor_id == doc.id,
                    Appointment.appointment_date == check_date,
                    Appointment.status.notin_([AppointmentStatusEnum.CANCELLED])
                ).all()
            ]
            avail_slots = [s for s in standard_slots if s not in booked_slots]

            recommended_doctors.append({
                "doctor_id": doc.id,
                "doctor_code": doc.doctor_code,
                "full_name": doc_name,
                "specialization": doc.specialization,
                "qualification": doc.qualification,
                "experience_years": doc.experience_years,
                "consultation_fee": doc.consultation_fee,
                "room_number": doc.room_number,
                "biography": doc.biography,
                "available_slots_count": len(avail_slots),
                "next_available_slot": avail_slots[0] if avail_slots else "Tomorrow 09:00 AM"
            })

        # Secondary departments if multiple matches
        secondary = [d for d, s in sorted_depts[1:3] if s > 0]

        return {
            "recommended_department": best_dept,
            "confidence_score": min(98, 65 + (best_score * 8)),
            "reason": reason,
            "matched_symptoms": matched_terms.get(best_dept, []),
            "secondary_departments": secondary,
            "doctors": recommended_doctors,
            "total_doctors_available": len(recommended_doctors),
            "disclaimer": "Doctor recommendation is AI-assisted triage advice. Patients may select any specialist."
        }

recommendation_service = DoctorRecommendationService()
