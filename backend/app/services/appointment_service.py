from datetime import datetime, date, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.appointment import Appointment, AppointmentStatusEnum, AppointmentTypeEnum
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.notification import NotificationTypeEnum
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate
from app.services.notification_service import notification_service

class AppointmentService:
    @staticmethod
    def generate_appointment_number(db: Session) -> str:
        today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        count = db.query(Appointment).count()
        return f"APT-{today_str}-{1001 + count}"

    @classmethod
    def book_appointment(
        cls,
        db: Session,
        appt_in: AppointmentCreate,
        patient_id: int
    ) -> Appointment:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found.")

        doctor = db.query(Doctor).filter(Doctor.id == appt_in.doctor_id).first()
        if not doctor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

        # Double-booking prevention check
        existing = db.query(Appointment).filter(
            Appointment.doctor_id == appt_in.doctor_id,
            Appointment.appointment_date == appt_in.appointment_date,
            Appointment.time_slot == appt_in.time_slot,
            Appointment.status.notin_([AppointmentStatusEnum.CANCELLED])
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Time slot '{appt_in.time_slot}' on {appt_in.appointment_date} with Dr. {doctor.user.full_name if doctor.user else 'Doctor'} is already booked. Please pick another slot."
            )

        appointment = Appointment(
            appointment_number=cls.generate_appointment_number(db),
            patient_id=patient_id,
            doctor_id=appt_in.doctor_id,
            department=doctor.specialization or appt_in.department,
            appointment_date=appt_in.appointment_date,
            time_slot=appt_in.time_slot,
            status=AppointmentStatusEnum.CONFIRMED,
            appointment_type=appt_in.appointment_type,
            chief_complaint=appt_in.chief_complaint,
            notes=appt_in.notes,
            ai_suggested=appt_in.ai_suggested or "NO"
        )
        db.add(appointment)
        db.commit()
        db.refresh(appointment)

        # Notify patient and doctor
        if patient.user:
            notification_service.create_notification(
                db=db,
                user_id=patient.user.id,
                title="Appointment Confirmed",
                message=f"Your appointment #{appointment.appointment_number} with Dr. {doctor.user.full_name if doctor.user else 'Specialist'} on {appointment.appointment_date} at {appointment.time_slot} is confirmed.",
                notification_type=NotificationTypeEnum.APPOINTMENT_CONFIRMED
            )

        if doctor.user:
            notification_service.create_notification(
                db=db,
                user_id=doctor.user.id,
                title="New Patient Booking",
                message=f"Patient {patient.user.full_name if patient.user else 'Patient'} booked for {appointment.appointment_date} at {appointment.time_slot}.",
                notification_type=NotificationTypeEnum.APPOINTMENT_CONFIRMED
            )

        return appointment

    @classmethod
    def update_appointment(
        cls,
        db: Session,
        appointment_id: int,
        appt_update: AppointmentUpdate
    ) -> Appointment:
        appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")

        # Check conflict if rescheduling date or time
        if appt_update.appointment_date or appt_update.time_slot:
            new_date = appt_update.appointment_date or appt.appointment_date
            new_slot = appt_update.time_slot or appt.time_slot
            conflict = db.query(Appointment).filter(
                Appointment.id != appt.id,
                Appointment.doctor_id == appt.doctor_id,
                Appointment.appointment_date == new_date,
                Appointment.time_slot == new_slot,
                Appointment.status.notin_([AppointmentStatusEnum.CANCELLED])
            ).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Slot '{new_slot}' on {new_date} is already occupied."
                )
            appt.appointment_date = new_date
            appt.time_slot = new_slot

        if appt_update.status:
            appt.status = appt_update.status
        if appt_update.chief_complaint is not None:
            appt.chief_complaint = appt_update.chief_complaint
        if appt_update.notes is not None:
            appt.notes = appt_update.notes
        if appt_update.cancellation_reason is not None:
            appt.cancellation_reason = appt_update.cancellation_reason

        db.commit()
        db.refresh(appt)
        return appt

appointment_service = AppointmentService()
