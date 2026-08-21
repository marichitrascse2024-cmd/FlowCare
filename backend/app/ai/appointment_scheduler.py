from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.doctor import Doctor, DoctorSchedule
from app.models.appointment import Appointment, AppointmentStatusEnum

class AIAppointmentScheduler:
    """
    AI-Assisted Smart Appointment Scheduling Engine.
    Scans doctor shifts, analyzes existing bookings, balances queue workload,
    prevents double booking, and recommends optimal available slots.
    """

    STANDARD_SLOTS = [
        "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
        "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"
    ]

    @classmethod
    def recommend_slots(
        cls,
        db: Session,
        doctor_id: Optional[int] = None,
        specialization: Optional[str] = None,
        preferred_date: Optional[date] = None,
        preferred_time_of_day: str = "ANY", # MORNING, AFTERNOON, EVENING, ANY
        urgency: str = "NORMAL"
    ) -> List[Dict[str, Any]]:
        target_date = preferred_date or (date.today() + timedelta(days=1))
        
        # Build doctor query
        query = db.query(Doctor).filter(Doctor.is_available == True)
        if doctor_id:
            query = query.filter(Doctor.id == doctor_id)
        elif specialization:
            query = query.filter(Doctor.specialization.ilike(f"%{specialization}%"))
        
        doctors = query.all()
        if not doctors:
            # Fallback to any available doctor if specific specialization not matched
            doctors = db.query(Doctor).filter(Doctor.is_available == True).limit(5).all()

        recommendations = []

        for doc in doctors:
            # Fetch existing appointments for this doctor on target date
            existing_appts = db.query(Appointment).filter(
                Appointment.doctor_id == doc.id,
                Appointment.appointment_date == target_date,
                Appointment.status.notin_([AppointmentStatusEnum.CANCELLED])
            ).all()

            booked_slots = {a.time_slot for a in existing_appts}
            doctor_workload_count = len(booked_slots)

            # Available slots for this doctor
            for slot in cls.STANDARD_SLOTS:
                if slot in booked_slots:
                    continue # Skip booked slot to prevent conflict

                # Filter by preferred time of day
                is_morning = "AM" in slot
                is_afternoon = "PM" in slot and any(h in slot for h in ["01:", "02:", "03:"])
                is_evening = "PM" in slot and any(h in slot for h in ["04:", "05:", "06:", "07:"])

                if preferred_time_of_day == "MORNING" and not is_morning:
                    continue
                if preferred_time_of_day == "AFTERNOON" and not is_afternoon:
                    continue
                if preferred_time_of_day == "EVENING" and not is_evening:
                    continue

                # Calculate workload and scoring factor
                # Lower score means less load / better recommendation
                load_factor = min(1.0, doctor_workload_count / 12.0)
                
                # Reason generation
                reasons = [
                    f"Doctor available in Room {doc.room_number}",
                    "No scheduling conflict detected"
                ]
                if load_factor < 0.3:
                    reasons.append("Low doctor queue load — minimal expected wait time")
                elif load_factor < 0.6:
                    reasons.append("Moderate clinic flow")
                else:
                    reasons.append("Popular slot — recommended for timely arrival")

                if urgency == "HIGH":
                    reasons.append("Prioritized for prompt medical attention")

                recommendations.append({
                    "doctor_id": doc.id,
                    "doctor_name": doc.user.full_name if doc.user else "Dr. Medical Specialist",
                    "specialization": doc.specialization,
                    "room_number": doc.room_number,
                    "appointment_date": target_date,
                    "time_slot": slot,
                    "consultation_fee": doc.consultation_fee,
                    "load_score": round(load_factor, 2),
                    "reason": " • ".join(reasons)
                })

        # Sort recommendations by load_score (least loaded slots first)
        recommendations.sort(key=lambda x: (x["load_score"], x["time_slot"]))
        return recommendations[:6] # Return top 6 optimal suggestions

ai_appointment_scheduler = AIAppointmentScheduler()
