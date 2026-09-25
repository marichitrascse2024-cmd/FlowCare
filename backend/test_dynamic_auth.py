import requests

BASE = 'http://127.0.0.1:8000/api'

def test_dynamic_auth():
    print("=" * 70)
    print("FLOWCARE — DYNAMIC AUTHENTICATION & ROLE REDIRECTION VERIFICATION")
    print("=" * 70)

    # 1. Existing Doctor Login
    r1 = requests.post(f'{BASE}/auth/login', json={'email': 'dr.rajesh@flowcare.com', 'password': 'Doctor@123'})
    assert r1.status_code == 200, f'Doc login failed: {r1.text}'
    role1 = r1.json()['role']
    assert role1 == 'DOCTOR', f'Expected DOCTOR role, got {role1}'
    print(f'[PASS] 1. Existing Doctor Login: {r1.json()["full_name"]} -> DB Role: {role1}')

    # 2. Existing Patient Login
    r2 = requests.post(f'{BASE}/auth/login', json={'email': 'arjun.kumar@flowcare.demo', 'password': 'FlowCare@123'})
    assert r2.status_code == 200, f'Patient login failed: {r2.text}'
    role2 = r2.json()['role']
    assert role2 == 'PATIENT', f'Expected PATIENT role, got {role2}'
    print(f'[PASS] 2. Existing Patient Login: {r2.json()["full_name"]} -> DB Role: {role2}')

    # 3. New Patient Registration & Login
    r_admin = requests.post(f'{BASE}/auth/login', json={'email': 'admin@flowcare.com', 'password': 'Admin@123'})
    admin_headers = {'Authorization': f'Bearer {r_admin.json()["access_token"]}'}

    import time
    timestamp = int(time.time())
    new_pat_email = f'patient_{timestamp}@flowcare.demo'
    reg_res = requests.post(f'{BASE}/auth/register', json={
        'full_name': 'New Dynamic Patient',
        'email': new_pat_email,
        'password': 'TestPassword@123',
        'phone': '+91 9876543210'
    })
    assert reg_res.status_code == 200, f'Registration failed: {reg_res.text}'

    r3 = requests.post(f'{BASE}/auth/login', json={'email': new_pat_email, 'password': 'TestPassword@123'})
    assert r3.status_code == 200, f'New patient login failed: {r3.text}'
    role3 = r3.json()['role']
    assert role3 == 'PATIENT', f'Expected PATIENT role, got {role3}'
    print(f'[PASS] 3. Newly Registered Patient Login: {r3.json()["full_name"]} -> DB Role: {role3}')

    # 4. New Doctor Creation & Login
    new_doc_email = f'doctor_{timestamp}@flowcare.demo'
    doc_create = requests.post(f'{BASE}/users', headers=admin_headers, json={
        'full_name': 'Dr. Dynamic Doctor',
        'email': new_doc_email,
        'password': 'TestPassword@123',
        'role': 'DOCTOR'
    })
    assert doc_create.status_code == 200, f'Doctor creation failed: {doc_create.text}'

    r4 = requests.post(f'{BASE}/auth/login', json={'email': new_doc_email, 'password': 'TestPassword@123'})
    assert r4.status_code == 200, f'New doctor login failed: {r4.text}'
    role4 = r4.json()['role']
    assert role4 == 'DOCTOR', f'Expected DOCTOR role, got {role4}'
    print(f'[PASS] 4. Newly Created Doctor Login: {r4.json()["full_name"]} -> DB Role: {role4}')

    # 5. New Nurse Creation & Login
    new_nurse_email = f'nurse_{timestamp}@flowcare.demo'
    nurse_create = requests.post(f'{BASE}/users', headers=admin_headers, json={
        'full_name': 'Nurse Dynamic Nurse',
        'email': new_nurse_email,
        'password': 'TestPassword@123',
        'role': 'NURSE'
    })
    assert nurse_create.status_code == 200, f'Nurse creation failed: {nurse_create.text}'

    r5 = requests.post(f'{BASE}/auth/login', json={'email': new_nurse_email, 'password': 'TestPassword@123'})
    assert r5.status_code == 200, f'New nurse login failed: {r5.text}'
    role5 = r5.json()['role']
    assert role5 == 'NURSE', f'Expected NURSE role, got {role5}'
    print(f'[PASS] 5. Newly Created Nurse Login: {r5.json()["full_name"]} -> DB Role: {role5}')

    # 6. New Admin Creation & Login
    new_admin_email = f'admin_{timestamp}@flowcare.demo'
    admin_create = requests.post(f'{BASE}/users', headers=admin_headers, json={
        'full_name': 'Admin Dynamic Admin',
        'email': new_admin_email,
        'password': 'TestPassword@123',
        'role': 'ADMIN'
    })
    assert admin_create.status_code == 200, f'Admin creation failed: {admin_create.text}'

    r6 = requests.post(f'{BASE}/auth/login', json={'email': new_admin_email, 'password': 'TestPassword@123'})
    assert r6.status_code == 200, f'New admin login failed: {r6.text}'
    role6 = r6.json()['role']
    assert role6 == 'ADMIN', f'Expected ADMIN role, got {role6}'
    print(f'[PASS] 6. Newly Created Admin Login: {r6.json()["full_name"]} -> DB Role: {role6}')

    # 7. New Receptionist Creation & Login
    new_rec_email = f'receptionist_{timestamp}@flowcare.demo'
    rec_create = requests.post(f'{BASE}/users', headers=admin_headers, json={
        'full_name': 'Receptionist Dynamic Test',
        'email': new_rec_email,
        'password': 'TestPassword@123',
        'role': 'RECEPTIONIST'
    })
    assert rec_create.status_code == 200, f'Receptionist creation failed: {rec_create.text}'

    r7 = requests.post(f'{BASE}/auth/login', json={'email': new_rec_email, 'password': 'TestPassword@123'})
    assert r7.status_code == 200, f'New receptionist login failed: {r7.text}'
    role7 = r7.json()['role']
    assert role7 == 'RECEPTIONIST', f'Expected RECEPTIONIST role, got {role7}'
    print(f'[PASS] 7. Newly Created Receptionist Login: {r7.json()["full_name"]} -> DB Role: {role7}')

    print("=" * 70)
    print("ALL DYNAMIC AUTHENTICATION & ROLE TESTS PASSED 100%!")
    print("=" * 70)

if __name__ == '__main__':
    test_dynamic_auth()
