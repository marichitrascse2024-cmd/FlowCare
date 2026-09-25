from datetime import datetime, date, time
from typing import Optional

def parse_time_string(time_str: str) -> time:
    """Parse time string like '09:00', '09:00 AM', or '14:30' into datetime.time object."""
    if not time_str:
        return time(9, 0)
    time_str = str(time_str).strip()
    for fmt in ("%H:%M", "%I:%M %p", "%I:%M%p", "%H:%M:%S"):
        try:
            return datetime.strptime(time_str, fmt).time()
        except ValueError:
            continue
    return time(9, 0)

def calculate_doctor_delay_minutes(doctor, target_date: date) -> int:
    """
    Calculates dynamic doctor delay in minutes for a given target_date.
    Compares doctor.last_check_in_at with doctor's scheduled start time for target_date.
    Returns 0 if doctor arrived early or on-time, or if no check-in exists for target_date.
    Returns positive minutes if doctor checked in late.
    """
    if not doctor or not getattr(doctor, 'last_check_in_at', None):
        return 0

    check_in_dt = doctor.last_check_in_at
    if hasattr(check_in_dt, 'date'):
        check_in_date = check_in_dt.date()
    else:
        return 0

    if check_in_date != target_date:
        return 0

    # Determine scheduled start time for target_date's day of week (0=Monday...6=Sunday)
    day_of_week = target_date.weekday()
    sched_start_time = time(9, 0) # default 09:00 AM

    if hasattr(doctor, 'schedules') and doctor.schedules:
        for sch in doctor.schedules:
            if sch.day_of_week == day_of_week and getattr(sch, 'is_active', True):
                if sch.start_time:
                    sched_start_time = parse_time_string(sch.start_time)
                break

    sched_start_dt = datetime.combine(target_date, sched_start_time)
    
    # Handle timezone awareness safely for datetime difference
    naive_check_in_dt = check_in_dt.replace(tzinfo=None) if check_in_dt.tzinfo else check_in_dt

    delay_seconds = (naive_check_in_dt - sched_start_dt).total_seconds()
    delay_minutes = int(delay_seconds // 60)

    return max(0, delay_minutes)

def shift_time_slot(time_slot_str: str, delay_minutes: int) -> str:
    """
    Shifts an appointment time_slot_str (e.g. '10:00 AM', '09:30 AM', '14:00') by delay_minutes.
    If delay_minutes <= 0 or time_slot_str is empty/invalid, returns original time_slot_str.
    Returns formatted string like '10:20 AM'.
    """
    if not time_slot_str or not delay_minutes or delay_minutes <= 0:
        return time_slot_str

    from datetime import timedelta
    clean_str = str(time_slot_str).strip()
    
    t_obj = None
    has_am_pm = False
    for fmt in ("%I:%M %p", "%I:%M%p", "%H:%M", "%H:%M:%S"):
        try:
            parsed = datetime.strptime(clean_str, fmt)
            t_obj = parsed
            if "%p" in fmt:
                has_am_pm = True
            break
        except ValueError:
            continue

    if not t_obj:
        return time_slot_str

    shifted_dt = t_obj + timedelta(minutes=delay_minutes)
    
    if has_am_pm or clean_str.upper().endswith(("AM", "PM")):
        return shifted_dt.strftime("%I:%M %p")
    else:
        return shifted_dt.strftime("%H:%M")
