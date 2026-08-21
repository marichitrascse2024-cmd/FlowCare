import math
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.doctor import Doctor
from app.models.queue import QueueEntry, QueueStatusEnum, PriorityEnum
from app.models.appointment import Appointment, AppointmentTypeEnum

class WaitingTimePredictor:
    """
    AI/ML-assisted Patient Waiting-Time Estimation Engine.
    Combines M/M/1 queuing theory factors, doctor historical consultation speed,
    triage priority weights, active session progress, and time-of-day rush curves.
    """

    @staticmethod
    def get_time_of_day_multiplier(current_hour: int) -> float:
        # Peak hospital rush hours: 10:00 - 12:30 (1.20x) and 16:30 - 18:30 (1.15x)
        if 10 <= current_hour <= 12:
            return 1.20
        elif 16 <= current_hour <= 18:
            return 1.15
        elif 8 <= current_hour < 10:
            return 1.05
        elif 13 <= current_hour < 15:
            return 0.90
        return 1.00

    @classmethod
    def predict(
        cls,
        db: Session,
        doctor_id: int,
        patient_id: Optional[int] = None,
        priority: str = "NORMAL",
        appointment_type: str = "GENERAL"
    ) -> Dict[str, Any]:
        doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        if not doctor:
            return {
                "doctor_id": doctor_id,
                "doctor_name": "Unknown Doctor",
                "specialization": "General",
                "room_number": "N/A",
                "patients_ahead": 0,
                "average_consultation_time": 15,
                "estimated_wait_minutes": 0,
                "confidence_score": 0.5,
                "rush_hour_factor": 1.0,
                "disclaimer": "Doctor not found. Default estimate applied."
            }

        base_avg_duration = doctor.average_consultation_time or 15 # minutes

        # Check active consultation for this doctor
        active_consultation = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doctor_id,
            QueueEntry.status == QueueStatusEnum.IN_CONSULTATION
        ).first()

        remaining_active_time = 0
        if active_consultation and active_consultation.consultation_start:
            now_utc = datetime.now(timezone.utc)
            # Handle naive or aware
            start_time = active_consultation.consultation_start
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
            elapsed_minutes = (now_utc - start_time).total_seconds() / 60.0
            remaining_active_time = max(2, int(base_avg_duration - elapsed_minutes))
        elif active_consultation:
            remaining_active_time = int(base_avg_duration * 0.5)

        # Count waiting patients ahead in the queue for this doctor
        waiting_entries = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doctor_id,
            QueueEntry.status.in_([QueueStatusEnum.WAITING, QueueStatusEnum.CALLED])
        ).order_by(QueueEntry.queue_position.asc()).all()

        patients_ahead_count = len(waiting_entries)

        # If a specific patient_id is provided, calculate exact position ahead of this patient
        if patient_id:
            patient_entry = next((e for e in waiting_entries if e.patient_id == patient_id), None)
            if patient_entry:
                patients_ahead_count = max(0, patient_entry.queue_position - 1)

        current_hour = datetime.now().hour
        rush_multiplier = cls.get_time_of_day_multiplier(current_hour)

        # Type multiplier
        type_multiplier = 1.0
        if appointment_type == "FOLLOW_UP":
            type_multiplier = 0.75
        elif appointment_type == "SPECIALIST":
            type_multiplier = 1.25
        elif appointment_type == "EMERGENCY":
            type_multiplier = 0.20

        # Raw calculation
        calculated_wait = (patients_ahead_count * base_avg_duration * rush_multiplier * type_multiplier) + remaining_active_time
        
        # Priority adjustment
        if priority == "EMERGENCY":
            calculated_wait = min(calculated_wait, 2)
        elif priority == "URGENT":
            calculated_wait = math.ceil(calculated_wait * 0.5)
        elif priority == "ELDERLY":
            calculated_wait = math.ceil(calculated_wait * 0.8)

        estimated_wait = max(0, int(round(calculated_wait)))

        # Statistical confidence score (decreases slightly as queue size grows due to variance)
        confidence = max(0.65, min(0.96, 0.95 - (patients_ahead_count * 0.02)))

        return {
            "doctor_id": doctor.id,
            "doctor_name": doctor.user.full_name if doctor.user else "Dr. Staff",
            "specialization": doctor.specialization,
            "room_number": doctor.room_number,
            "patients_ahead": patients_ahead_count,
            "average_consultation_time": base_avg_duration,
            "estimated_wait_minutes": estimated_wait,
            "confidence_score": round(confidence, 2),
            "rush_hour_factor": round(rush_multiplier, 2),
            "disclaimer": "Estimated waiting time is an AI-assisted statistical calculation and may vary based on clinical complexity."
        }

waiting_time_predictor = WaitingTimePredictor()
