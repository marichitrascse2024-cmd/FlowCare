from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.queue import QueueEntry, QueueStatusEnum, PriorityEnum
from app.models.appointment import Appointment, AppointmentStatusEnum
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.notification import NotificationTypeEnum
from app.services.notification_service import notification_service
from app.ai.waiting_time import waiting_time_predictor

class QueueService:
    @staticmethod
    def generate_token_number(db: Session, doctor: Doctor) -> str:
        # Prefix based on doctor specialization initial
        prefix = doctor.specialization[0].upper() if doctor.specialization else "Q"
        
        # Determine doctor's 1-based index within their department for 100, 200, 300 series
        dept_docs = db.query(Doctor.id).filter(Doctor.specialization == doctor.specialization).order_by(Doctor.id.asc()).all()
        doc_ids = [d_id for (d_id,) in dept_docs]
        try:
            doc_index = doc_ids.index(doctor.id) + 1
        except ValueError:
            doc_index = 1

        base_series = doc_index * 100

        # Find highest token already issued for this specific doctor
        doctor_tokens = db.query(QueueEntry.token_number).filter(
            QueueEntry.doctor_id == doctor.id
        ).all()
        
        highest_num = base_series
        for (t_str,) in doctor_tokens:
            try:
                num = int(t_str[1:])
                if num > highest_num:
                    highest_num = num
            except (ValueError, IndexError):
                continue
                
        candidate_num = highest_num + 1
        candidate_token = f"{prefix}{candidate_num}"

        # Global uniqueness safety check
        while db.query(QueueEntry).filter(QueueEntry.token_number == candidate_token).first():
            candidate_num += 1
            candidate_token = f"{prefix}{candidate_num}"

        return candidate_token

    @classmethod
    def check_in_patient(
        cls,
        db: Session,
        patient_id: int,
        doctor_id: int,
        appointment_id: Optional[int] = None,
        priority: PriorityEnum = PriorityEnum.NORMAL,
        notes: Optional[str] = None
    ) -> QueueEntry:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

        doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        if not doctor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

        # If patient already has an active checked-in queue entry with this doctor or appointment, return it
        if appointment_id:
            existing_entry = db.query(QueueEntry).filter(
                QueueEntry.appointment_id == appointment_id,
                QueueEntry.status.in_([QueueStatusEnum.WAITING, QueueStatusEnum.CALLED, QueueStatusEnum.IN_CONSULTATION])
            ).first()
            if existing_entry:
                return existing_entry
        else:
            existing_active = db.query(QueueEntry).filter(
                QueueEntry.patient_id == patient_id,
                QueueEntry.doctor_id == doctor_id,
                QueueEntry.status.in_([QueueStatusEnum.WAITING, QueueStatusEnum.CALLED, QueueStatusEnum.IN_CONSULTATION])
            ).first()
            if existing_active:
                return existing_active

        # Calculate current queue position strictly for this doctor's queue
        waiting_count = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doctor_id,
            QueueEntry.status.in_([QueueStatusEnum.WAITING, QueueStatusEnum.CALLED])
        ).count()
        position = waiting_count + 1

        # Generate unique token for this doctor's series
        token = cls.generate_token_number(db, doctor)

        # AI estimated waiting time for this doctor's line
        pred = waiting_time_predictor.predict(
            db=db,
            doctor_id=doctor_id,
            patient_id=patient_id,
            priority=priority.value
        )
        est_wait = pred.get("estimated_wait_minutes", 15)

        # Create queue entry retaining selected doctor_id
        queue_entry = QueueEntry(
            token_number=token,
            patient_id=patient_id,
            doctor_id=doctor_id,
            appointment_id=appointment_id,
            status=QueueStatusEnum.WAITING,
            priority=priority,
            queue_position=position,
            estimated_wait_minutes=est_wait,
            room_number=doctor.room_number,
            check_in_time=datetime.now(timezone.utc),
            notes=notes
        )
        db.add(queue_entry)

        # Update appointment status if applicable
        if appointment_id:
            appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
            if appt:
                appt.status = AppointmentStatusEnum.WAITING

        db.commit()
        db.refresh(queue_entry)

        # Send notification to patient
        if patient.user:
            doc_name = doctor.user.full_name if doctor.user else "Specialist"
            if not doc_name.startswith("Dr."):
                doc_name = f"Dr. {doc_name}"
            notification_service.create_notification(
                db=db,
                user_id=patient.user.id,
                title="Checked-In Successfully",
                message=f"Your token is {token} for {doc_name} ({doctor.specialization} — Room {doctor.room_number}). Current position: #{position}. Estimated wait: ~{est_wait} mins.",
                notification_type=NotificationTypeEnum.QUEUE_CALLED
            )

        return queue_entry

    @classmethod
    def advance_queue(cls, db: Session, doctor_id: int) -> Dict[str, Any]:
        """
        Completes current consulting patient and calls the next waiting patient in line for this specific doctor.
        """
        # 1. Complete active patient if any
        active_entry = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doctor_id,
            QueueEntry.status == QueueStatusEnum.IN_CONSULTATION
        ).first()

        completed_token = None
        if active_entry:
            active_entry.status = QueueStatusEnum.COMPLETED
            active_entry.consultation_end = datetime.now(timezone.utc)
            completed_token = active_entry.token_number
            if active_entry.appointment:
                active_entry.appointment.status = AppointmentStatusEnum.COMPLETED

        # 2. Find next waiting or called patient for THIS doctor
        next_entry = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doctor_id,
            QueueEntry.status.in_([QueueStatusEnum.CALLED, QueueStatusEnum.WAITING])
        ).order_by(
            QueueEntry.priority.desc(),
            QueueEntry.queue_position.asc()
        ).first()

        next_token = None
        if next_entry:
            next_entry.status = QueueStatusEnum.IN_CONSULTATION
            next_entry.called_time = next_entry.called_time or datetime.now(timezone.utc)
            next_entry.consultation_start = datetime.now(timezone.utc)
            next_token = next_entry.token_number
            if next_entry.appointment:
                next_entry.appointment.status = AppointmentStatusEnum.IN_CONSULTATION

            # Notify next patient
            if next_entry.patient and next_entry.patient.user:
                notification_service.create_notification(
                    db=db,
                    user_id=next_entry.patient.user.id,
                    title="It's Your Turn! Consultation Starting",
                    message=f"Token {next_token}: Please proceed to Room {next_entry.room_number or 'Doctor Room'}.",
                    notification_type=NotificationTypeEnum.QUEUE_CALLED
                )

        # 3. Recalculate queue positions and wait times strictly for this doctor's waiting line
        remaining_waiting = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doctor_id,
            QueueEntry.status == QueueStatusEnum.WAITING
        ).order_by(QueueEntry.queue_position.asc()).all()

        for idx, entry in enumerate(remaining_waiting, start=1):
            entry.queue_position = idx
            pred = waiting_time_predictor.predict(db, doctor_id, entry.patient_id, entry.priority.value)
            entry.estimated_wait_minutes = pred.get("estimated_wait_minutes", 15)

        db.commit()

        return {
            "message": "Queue progressed successfully.",
            "completed_token": completed_token,
            "current_token": next_token,
            "next_entry": next_entry
        }

    @classmethod
    def update_entry_status(
        cls,
        db: Session,
        queue_id: int,
        new_status: QueueStatusEnum,
        notes: Optional[str] = None
    ) -> QueueEntry:
        entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue entry not found.")

        entry.status = new_status
        if notes:
            entry.notes = notes

        now = datetime.now(timezone.utc)
        if new_status == QueueStatusEnum.CALLED:
            entry.called_time = now
        elif new_status == QueueStatusEnum.IN_CONSULTATION:
            entry.consultation_start = now
            if entry.appointment:
                entry.appointment.status = AppointmentStatusEnum.IN_CONSULTATION
        elif new_status == QueueStatusEnum.COMPLETED:
            entry.consultation_end = now
            if entry.appointment:
                entry.appointment.status = AppointmentStatusEnum.COMPLETED
        elif new_status == QueueStatusEnum.CANCELLED:
            if entry.appointment:
                entry.appointment.status = AppointmentStatusEnum.CANCELLED

        db.commit()
        db.refresh(entry)
        return entry

queue_service = QueueService()
