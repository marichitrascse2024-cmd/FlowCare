import requests

BASE_URL = 'http://127.0.0.1:8000/api'

def test_role_login():
    print("=" * 75)
    print("FLOWCARE — ROLE-BASED LOGIN & STRICT AUTHORIZATION TEST SUITE")
    print("=" * 75)

    # 1. Patient Login
    r = requests.post(f'{BASE_URL}/auth/login', json={'email': 'arjun.kumar@flowcare.demo', 'password': 'FlowCare@123', 'role': 'PATIENT'})
    assert r.status_code == 200, f'Patient login failed: {r.text}'
    assert r.json()['role'] == 'PATIENT', 'Role mismatch'
    print('  [PASS] 1. Patient Login (Arjun Kumar -> Patient Account)')

    # 2. Doctor 1 Login
    r = requests.post(f'{BASE_URL}/auth/login', json={'email': 'rajesh.kumar@flowcare.demo', 'password': 'Doctor@123', 'role': 'DOCTOR'})
    assert r.status_code == 200, f'Doctor 1 login failed: {r.text}'
    assert r.json()['role'] == 'DOCTOR', 'Role mismatch'
    print('  [PASS] 2. Doctor 1 Login (Dr. Rajesh Kumar -> Cardiology Doctor Station)')

    # 3. Doctor 2 Login
    r = requests.post(f'{BASE_URL}/auth/login', json={'email': 'meena.reddy@flowcare.demo', 'password': 'Doctor@123', 'role': 'DOCTOR'})
    assert r.status_code == 200, f'Doctor 2 login failed: {r.text}'
    assert r.json()['role'] == 'DOCTOR', 'Role mismatch'
    print('  [PASS] 3. Doctor 2 Login (Dr. Meena Reddy -> Orthopedics Doctor Station)')

    # 4. Nurse Login
    r = requests.post(f'{BASE_URL}/auth/login', json={'email': 'nurse@flowcare.com', 'password': 'Staff@123', 'role': 'NURSE'})
    assert r.status_code == 200, f'Nurse login failed: {r.text}'
    assert r.json()['role'] == 'NURSE', 'Role mismatch'
    print('  [PASS] 4. Nurse Login (Nurse / Staff Station)')

    # 5. Admin Login
    r = requests.post(f'{BASE_URL}/auth/login', json={'email': 'admin@flowcare.com', 'password': 'Admin@123', 'role': 'ADMIN'})
    assert r.status_code == 200, f'Admin login failed: {r.text}'
    assert r.json()['role'] == 'ADMIN', 'Role mismatch'
    print('  [PASS] 5. Admin Login (Hospital Administration Dashboard)')

    # 6. Receptionist Login
    r = requests.post(f'{BASE_URL}/auth/login', json={'email': 'receptionist@flowcare.com', 'password': 'Staff@123', 'role': 'RECEPTIONIST'})
    assert r.status_code == 200, f'Receptionist login failed: {r.text}'
    assert r.json()['role'] == 'RECEPTIONIST', 'Role mismatch'
    print('  [PASS] 6. Receptionist Login (Front Desk Station)')

    # 7. Wrong Password
    r = requests.post(f'{BASE_URL}/auth/login', json={'email': 'admin@flowcare.com', 'password': 'WrongPassword!', 'role': 'ADMIN'})
    assert r.status_code == 401, 'Expected 401 on wrong password'
    print('  [PASS] 7. Wrong password correctly rejected with 401 Unauthorized')

    # 8. Doctor role + Patient credentials -> Must reject with role mismatch
    r = requests.post(f'{BASE_URL}/auth/login', json={'email': 'arjun.kumar@flowcare.demo', 'password': 'FlowCare@123', 'role': 'DOCTOR'})
    assert r.status_code == 401, f'Expected 401, got {r.status_code}'
    assert 'Invalid credentials or role mismatch' in r.text, f'Unexpected error message: {r.text}'
    print('  [PASS] 8. Doctor role + Patient credentials rejected: "Invalid credentials or role mismatch."')

    # 9. Patient role + Doctor credentials -> Must reject with role mismatch
    r = requests.post(f'{BASE_URL}/auth/login', json={'email': 'rajesh.kumar@flowcare.demo', 'password': 'Doctor@123', 'role': 'PATIENT'})
    assert r.status_code == 401, f'Expected 401, got {r.status_code}'
    assert 'Invalid credentials or role mismatch' in r.text, f'Unexpected error message: {r.text}'
    print('  [PASS] 9. Patient role + Doctor credentials rejected: "Invalid credentials or role mismatch."')

    # 10. Admin role + Doctor credentials -> Must reject with role mismatch
    r = requests.post(f'{BASE_URL}/auth/login', json={'email': 'rajesh.kumar@flowcare.demo', 'password': 'Doctor@123', 'role': 'ADMIN'})
    assert r.status_code == 401, f'Expected 401, got {r.status_code}'
    assert 'Invalid credentials or role mismatch' in r.text, f'Unexpected error message: {r.text}'
    print('  [PASS] 10. Admin role + Doctor credentials rejected: "Invalid credentials or role mismatch."')

    # 11. Receptionist role + Nurse credentials -> Must reject with role mismatch
    r = requests.post(f'{BASE_URL}/auth/login', json={'email': 'nurse@flowcare.com', 'password': 'Staff@123', 'role': 'RECEPTIONIST'})
    assert r.status_code == 401, f'Expected 401, got {r.status_code}'
    assert 'Invalid credentials or role mismatch' in r.text, f'Unexpected error message: {r.text}'
    print('  [PASS] 11. Receptionist role + Nurse credentials rejected: "Invalid credentials or role mismatch."')

    print("\n" + "=" * 75)
    print("ALL ROLE-BASED AUTHENTICATION & VALIDATION TESTS PASSED 100%!")
    print("=" * 75)

if __name__ == '__main__':
    test_role_login()
