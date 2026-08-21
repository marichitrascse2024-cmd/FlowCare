from fastapi.testclient import TestClient
from app.main import app

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
        "email": "dr.sharma@flowcare.com",
        "password": "Doctor@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "DOCTOR"
    assert data["doctor_id"] is not None
    print("[PASS] test_login_doctor")

def test_login_patient():
    res = client.post("/api/auth/login", json={
        "email": "patient@flowcare.com",
        "password": "Patient@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "PATIENT"
    assert data["patient_id"] is not None
    print("[PASS] test_login_patient")

def test_rbac_patient_forbidden_from_admin_users():
    # Login as patient
    res_pat = client.post("/api/auth/login", json={
        "email": "patient@flowcare.com",
        "password": "Patient@123"
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
        "email": "patient@flowcare.com",
        "password": "Patient@123"
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
        "email": "dr.sharma@flowcare.com",
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
    assert data["patient_name"] == "John Doe"
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
    assert data["detected_subtotal"] > 0
    assert len(data["draft_items"]) > 0
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
    print("==================================================")
    print("ALL 10 FLOWCARE BACKEND TESTS PASSED PERFECTLY!")
    print("==================================================")
