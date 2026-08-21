from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class StatusCount(BaseModel):
    label: str
    count: int

class DailyTrend(BaseModel):
    date: str
    appointments: int
    completed: int
    revenue: float

class DoctorPerformance(BaseModel):
    doctor_id: int
    doctor_name: str
    specialization: str
    total_consultations: int
    average_wait_time_minutes: float
    patient_satisfaction_score: float

class DashboardAnalyticsOut(BaseModel):
    total_patients: int
    total_doctors: int
    available_doctors: int
    today_appointments: int
    patients_waiting: int
    patients_in_consultation: int
    completed_consultations_today: int
    average_wait_time_today: int # minutes
    today_revenue: float
    total_revenue: float
    pending_bills_count: int
    pending_bills_amount: float
    queue_status_breakdown: List[StatusCount]
    daily_trends: List[DailyTrend]
    doctor_performance: List[DoctorPerformance]
