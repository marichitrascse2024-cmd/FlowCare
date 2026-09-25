from fastapi.testclient import TestClient
from app.main import app
from app.database.database import Base, engine
from app.database.seed_data import seed_database

# Ensure database tables and seed data are initialized for test client
Base.metadata.create_all(bind=engine)
try:
    seed_database()
except Exception:
    pass

client = TestClient(app)

def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["system"] == "FLOWCARE"
    assert data["status"] == "Operational"
    print("[PASS] test_root_endpoint")

def test_login_admin():
    res = client.post("/api/auth/login", json={
        "email": "admin@flowcare.com",
        "password": "Admin@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "ADMIN"
    assert "access_token" in data
    print("[PASS] test_login_admin")

def test_login_doctor():
    res = client.post("/api/auth/login", json={
        "email": "dr.rajesh@flowcare.com",
        "password": "Doctor@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "DOCTOR"
    assert data["doctor_id"] is not None
    print("[PASS] test_login_doctor")

def test_login_patient():
    res = client.post("/api/auth/login", json={
        "email": "arjun.kumar@flowcare.demo",
        "password": "FlowCare@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "PATIENT"
    assert data["patient_id"] is not None
    print("[PASS] test_login_patient")

def test_rbac_patient_forbidden_from_admin_users():
    # Login as patient
    res_pat = client.post("/api/auth/login", json={
        "email": "arjun.kumar@flowcare.demo",
        "password": "FlowCare@123"
    })
    token = res_pat.json()["access_token"]
    
    # Try accessing admin users endpoint
    res_admin = client.get("/api/users", headers={"Authorization": f"Bearer {token}"})
    assert res_admin.status_code == 403
    print("[PASS] test_rbac_patient_forbidden_from_admin_users (HTTP 403 verified)")

def test_ai_waiting_time():
    res = client.post("/api/auth/login", json={
        "email": "receptionist@flowcare.com",
        "password": "Staff@123"
    })
    token = res.json()["access_token"]
    
    res_ai = client.post(
        "/api/ai/waiting-time",
        headers={"Authorization": f"Bearer {token}"},
        json={"doctor_id": 1, "priority": "NORMAL"}
    )
    assert res_ai.status_code == 200
    data = res_ai.json()
    assert "estimated_wait_minutes" in data
    assert "patients_ahead" in data
    assert "confidence_score" in data
    print("[PASS] test_ai_waiting_time")

def test_ai_slot_recommendation():
    res = client.post("/api/auth/login", json={
        "email": "arjun.kumar@flowcare.demo",
        "password": "FlowCare@123"
    })
    token = res.json()["access_token"]

    res_ai = client.post(
        "/api/ai/appointment-suggestion",
        headers={"Authorization": f"Bearer {token}"},
        json={"specialization": "Cardiology", "preferred_time_of_day": "MORNING"}
    )
    assert res_ai.status_code == 200
    data = res_ai.json()
    assert len(data["recommendations"]) > 0
    assert data["recommendations"][0]["doctor_name"] is not None
    print("[PASS] test_ai_slot_recommendation")

def test_ai_medical_summary():
    res = client.post("/api/auth/login", json={
        "email": "dr.rajesh@flowcare.com",
        "password": "Doctor@123"
    })
    token = res.json()["access_token"]

    res_ai = client.post(
        "/api/ai/medical-summary",
        headers={"Authorization": f"Bearer {token}"},
        json={"patient_id": 1}
    )
    assert res_ai.status_code == 200
    data = res_ai.json()
    assert data["patient_name"] is not None
    assert len(data["summary_sections"]) >= 4
    print("[PASS] test_ai_medical_summary")

def test_ai_billing_assistance():
    res = client.post("/api/auth/login", json={
        "email": "receptionist@flowcare.com",
        "password": "Staff@123"
    })
    token = res.json()["access_token"]

    res_ai = client.post(
        "/api/ai/billing-assistance",
        headers={"Authorization": f"Bearer {token}"},
        json={"patient_id": 1}
    )
    assert res_ai.status_code == 200
    data = res_ai.json()
    assert data["detected_subtotal"] >= 0
    assert "draft_items" in data
    print("[PASS] test_ai_billing_assistance")

def test_dashboard_analytics():
    res = client.post("/api/auth/login", json={
        "email": "admin@flowcare.com",
        "password": "Admin@123"
    })
    token = res.json()["access_token"]

    res_rep = client.get("/api/reports/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert res_rep.status_code == 200
    data = res_rep.json()
    assert data["total_patients"] >= 5
    assert data["total_doctors"] >= 4
    assert len(data["doctor_performance"]) >= 4
    print("[PASS] test_dashboard_analytics")

def test_doctor_check_in():
    # Login as doctor
    res_doc = client.post("/api/auth/login", json={
        "email": "dr.rajesh@flowcare.com",
        "password": "Doctor@123"
    })
    assert res_doc.status_code == 200
    token = res_doc.json()["access_token"]

    # Call Doctor Check-In API
    res_checkin = client.post("/api/doctor/check-in", headers={"Authorization": f"Bearer {token}"})
    assert res_checkin.status_code == 200
    data = res_checkin.json()
    assert data["message"] == "Doctor checked in successfully."
    assert "doctor_id" in data
    assert "check_in_time" in data
    assert data["check_in_time"] is not None
    print("[PASS] test_doctor_check_in")

def test_doctor_delay_calculation():
    from datetime import date, datetime
    from app.services.doctor_delay import calculate_doctor_delay_minutes

    class DummySchedule:
        def __init__(self, day_of_week, start_time, is_active=True):
            self.day_of_week = day_of_week
            self.start_time = start_time
            self.is_active = is_active

    class DummyDoctor:
        def __init__(self, last_check_in_at, schedules):
            self.last_check_in_at = last_check_in_at
            self.schedules = schedules

    target_date = date(2026, 9, 24) # Thursday (weekday 3)
    schedules = [DummySchedule(day_of_week=3, start_time="09:00 AM")]

    # 1. Early Doctor (Arrives 8:45 AM, Scheduled 9:00 AM) -> 0 mins delay
    early_doc = DummyDoctor(last_check_in_at=datetime(2026, 9, 24, 8, 45), schedules=schedules)
    assert calculate_doctor_delay_minutes(early_doc, target_date) == 0

    # 2. On-Time Doctor (Arrives 9:00 AM, Scheduled 9:00 AM) -> 0 mins delay
    ontime_doc = DummyDoctor(last_check_in_at=datetime(2026, 9, 24, 9, 0), schedules=schedules)
    assert calculate_doctor_delay_minutes(ontime_doc, target_date) == 0

    # 3. 20-minute Late Doctor (Arrives 9:20 AM, Scheduled 9:00 AM) -> 20 mins delay
    late_doc = DummyDoctor(last_check_in_at=datetime(2026, 9, 24, 9, 20), schedules=schedules)
    assert calculate_doctor_delay_minutes(late_doc, target_date) == 20

    print("[PASS] test_doctor_delay_calculation (early: 0m, ontime: 0m, late: 20m verified)")

def test_shifted_time_slot_calculation():
    from app.services.doctor_delay import shift_time_slot

    # 1. 0 minute delay -> Shifted equals Original ('10:00 AM')
    orig_time_10 = "10:00 AM"
    assert shift_time_slot(orig_time_10, 0) == "10:00 AM"

    # 2. 20 minute delay -> Shifted is '10:20 AM' (Original: '10:00 AM', Delay: 20)
    assert shift_time_slot(orig_time_10, 20) == "10:20 AM"

    # 3. 15 minute delay for 09:30 AM -> '09:45 AM'
    assert shift_time_slot("09:30 AM", 15) == "09:45 AM"

    # 4. 30 minute delay for 11:45 AM -> '12:15 PM'
    assert shift_time_slot("11:45 AM", 30) == "12:15 PM"

    print("[PASS] test_shifted_time_slot_calculation (0m -> 10:00 AM, 20m -> 10:20 AM verified)")

def test_webrtc_signaling_websocket():
    with client.websocket_connect("/ws/video-call/101") as ws1:
        with client.websocket_connect("/ws/video-call/101") as ws2:
            # Check peer-joined notification received by ws1
            msg1 = ws1.receive_json()
            assert msg1["type"] == "peer-joined"
            assert msg1["room_id"] == "101"

            # ws1 sends WebRTC offer
            offer_payload = {"type": "offer", "sdp": "v=0..."}
            ws1.send_json(offer_payload)

            # ws2 receives relayed WebRTC offer
            relayed_offer = ws2.receive_json()
            assert relayed_offer["type"] == "offer"
            assert relayed_offer["sdp"] == "v=0..."

            # ws2 sends WebRTC answer
            answer_payload = {"type": "answer", "sdp": "v=0..."}
            ws2.send_json(answer_payload)

            # ws1 receives relayed WebRTC answer
            relayed_answer = ws1.receive_json()
            assert relayed_answer["type"] == "answer"
            assert relayed_answer["sdp"] == "v=0..."

    print("[PASS] test_webrtc_signaling_websocket (WebSocket signaling room & WebRTC relay verified)")

if __name__ == "__main__":
    print("Running FlowCare Backend Integration Tests...")
    test_root_endpoint()
    test_login_admin()
    test_login_doctor()
    test_login_patient()
    test_rbac_patient_forbidden_from_admin_users()
    test_ai_waiting_time()
    test_ai_slot_recommendation()
    test_ai_medical_summary()
    test_ai_billing_assistance()
    test_dashboard_analytics()
    test_doctor_check_in()
    test_doctor_delay_calculation()
    test_shifted_time_slot_calculation()
    test_webrtc_signaling_websocket()
    print("==================================================")
    print("ALL 14 FLOWCARE BACKEND TESTS PASSED PERFECTLY!")
    print("==================================================")
