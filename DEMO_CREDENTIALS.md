# 🏥 FlowCare — Demo Credentials & Testing Directory

This document contains all pre-entered demonstration accounts created for testing FlowCare's complete hospital workflow, including all 10 Indian demo patients, 16 multi-department doctors across 12 clinical specialties, and administrative/clinical staff.

> **Note:** All passwords in the database are cryptographically hashed using Argon2 / bcrypt. Plain-text passwords are never stored in the database.

---

## 👤 1. Demo Patient Accounts (10 Patients)

**Default Patient Password:** `FlowCare@123`

| # | Patient Name | Patient ID | Login Email | Gender / Age | Blood Group | Department / Appointment Status |
|---|---|---|---|---|---|---|
| 1 | **Arjun Kumar** | `PAT1001` | `arjun.kumar@flowcare.demo` | Male (40 yrs) | O+ | Cardiology (Dr. Rajesh Kumar) — **WAITING in Queue (`C101`)** |
| 2 | **Priya Sharma** | `PAT1002` | `priya.sharma@flowcare.demo` | Female (33 yrs) | B+ | Orthopedics (Dr. Meena Reddy) — **WAITING in Queue (`O102`)** |
| 3 | **Rahul Krishnan** | `PAT1003` | `rahul.krishnan@flowcare.demo` | Male (46 yrs) | A+ | General Medicine (Dr. Suresh Babu) — **IN_CONSULTATION (`G101`)** |
| 4 | **Ananya Ramesh** | `PAT1004` | `ananya.ramesh@flowcare.demo` | Female (8 yrs) | O+ | Pediatrics (Dr. Anjali Sharma) — **WAITING in Queue (`P101`)** |
| 5 | **Karthik Raj** | `PAT1005` | `karthik.raj@flowcare.demo` | Male (37 yrs) | AB+ | Neurology (Dr. Arun Prakash) — **CONFIRMED (Tomorrow 10:00 AM)** |
| 6 | **Sneha Prakash** | `PAT1006` | `sneha.prakash@flowcare.demo` | Female (29 yrs) | B- | Dermatology (Dr. Kavitha Iyer) — **BOOKED (Day 2 at 02:30 PM)** |
| 7 | **Vignesh Kumar** | `PAT1007` | `vignesh.kumar@flowcare.demo` | Male (51 yrs) | A- | Cardiology (Dr. Rajesh Kumar) — **COMPLETED** |
| 8 | **Divya Srinivasan** | `PAT1008` | `divya.srinivasan@flowcare.demo` | Female (31 yrs) | O- | Gynecology (Dr. Priya Menon) — **CONFIRMED (Day 3 at 11:00 AM)** |
| 9 | **Naveen Mohan** | `PAT1009` | `naveen.mohan@flowcare.demo` | Male (44 yrs) | B+ | ENT (Dr. Naveen Rao) — **BOOKED (Day 4 at 03:00 PM)** |
| 10 | **Kavya Lakshmi** | `PAT1010` | `kavya.lakshmi@flowcare.demo` | Female (25 yrs) | A+ | Ophthalmology (Dr. Divya Krishnan) — **CONFIRMED (Day 5 at 04:00 PM)** |

---

## 👨‍⚕️ 2. Multi-Department Doctor Accounts (16 Doctors Across 12 Specialties)

**Default Doctor Password:** `Doctor@123`

| # | Doctor Name | Department / Specialty | Login Email | Qualification | Room Location | Fee (₹) |
|---|---|---|---|---|---|---|
| 1 | **Dr. Rajesh Kumar** | Cardiology | `dr.rajesh@flowcare.com` | MBBS, MD, DM (Cardiology), FACC | Room 101 (Cardio Wing) | ₹800 |
| 2 | **Dr. Sanjay Verma** | Cardiology | `dr.sanjay@flowcare.com` | MBBS, MD, DNB (Cardiology) | Room 102 (Cardio Wing) | ₹750 |
| 3 | **Dr. Meena Reddy** | Orthopedics | `dr.meena@flowcare.com` | MBBS, MS (Orthopedics), MCh | Room 103 (Bone & Joint) | ₹700 |
| 4 | **Dr. Arvind Swamy** | Orthopedics | `dr.arvind@flowcare.com` | MBBS, D.Ortho, MS (Orthopedics) | Room 104 (Bone & Joint) | ₹650 |
| 5 | **Dr. Suresh Babu** | General Medicine | `dr.suresh@flowcare.com` | MBBS, MD (Internal Medicine) | Room 201 (OPD Floor 1) | ₹500 |
| 6 | **Dr. Sunita Patel** | General Medicine | `dr.patel@flowcare.com` | MBBS, MD (General Medicine) | Room 202 (OPD Floor 1) | ₹500 |
| 7 | **Dr. Anjali Sharma** | Pediatrics | `dr.anjali@flowcare.com` | MBBS, DCH, DNB (Pediatrics) | Room 203 (Child Health) | ₹600 |
| 8 | **Dr. Rohit Mehta** | Pediatrics | `dr.rohit@flowcare.com` | MBBS, MD (Pediatrics) | Room 204 (Child Health) | ₹550 |
| 9 | **Dr. Kavitha Iyer** | Dermatology | `dr.kavitha@flowcare.com` | MBBS, MD (Dermatology, DVL) | Room 301 (Derma Care) | ₹650 |
| 10 | **Dr. Arun Prakash** | Neurology | `dr.arun@flowcare.com` | MBBS, MD, DM (Neurology) | Room 302 (Neuro Sciences) | ₹900 |
| 11 | **Dr. Priya Menon** | Gynecology | `dr.priyam@flowcare.com` | MBBS, MS (OBG), DGO, FICOG | Room 303 (Women Wellness) | ₹700 |
| 12 | **Dr. Naveen Rao** | ENT | `dr.naveen@flowcare.com` | MBBS, MS (ENT) | Room 401 (ENT Center) | ₹550 |
| 13 | **Dr. Divya Krishnan** | Ophthalmology | `dr.divya@flowcare.com` | MBBS, MS (Ophthalmology), FICO | Room 402 (Eye Care) | ₹600 |
| 14 | **Dr. Karthik Srinivasan** | Dental | `dr.karthiks@flowcare.com` | BDS, MDS (Oral Surgery) | Room 403 (Dental Suite) | ₹500 |
| 15 | **Dr. Vijay Kumar** | Pulmonology | `dr.vijay@flowcare.com` | MBBS, MD (Pulmonary Med), FCCP | Room 501 (Chest Clinic) | ₹750 |
| 16 | **Dr. Swetha Ramesh** | Gastroenterology | `dr.swetha@flowcare.com` | MBBS, MD, DM (Gastroenterology) | Room 502 (Digestive Health) | ₹850 |

---

## 🏥 3. Hospital Staff Accounts

| Role | Name | Login Email | Password | Responsibilities |
|---|---|---|---|---|
| **Administrator** | Hospital Administrator | `admin@flowcare.com` | `Admin@123` | Full system control, analytics, user administration, financial audits |
| **Receptionist** | Sarah Jenkins | `receptionist@flowcare.com` | `Staff@123` | Patient arrival check-in, token generation, AI appointment scheduling, billing verification |
| **Nurse** | Clara Barton | `nurse@flowcare.com` | `Staff@123` | Triage intake, vital signs recording, allergy checking, urgency escalation |

---

## ⚡ 4. Recommended Testing Workflow

### Scenario A: Test Patient Experience (e.g. Arjun Kumar)
1. Navigate to: `http://127.0.0.1:3000/`
2. Log in with: `arjun.kumar@flowcare.demo` / `FlowCare@123`
3. View **Patient Dashboard**:
   - See **MY TOKEN** card at the top (`C101`) with attending doctor (Dr. Rajesh Kumar, Cardiology), position `#1`, and AI estimated wait time.
4. Click **Live Queue Board**:
   - Observe complete active queue across all hospital departments with Arjun Kumar highlighted with a blue accent and **YOU** badge.
5. Click **Doctors Directory**:
   - Filter by **"All Departments"** or select specific departments (e.g., *Orthopedics*, *Dermatology*, *Neurology*) to see available doctors and consultation fees.
6. Click **AI Smart Book Slot**:
   - Choose department and doctor to explore AI-optimized scheduling.

### Scenario B: Test Receptionist & Check-In Workflow
1. Log in with: `receptionist@flowcare.com` / `Staff@123`
2. View **Front Desk Station**:
   - See today's scheduled consultations.
   - Click **Check-In (Generate Token)** on any confirmed appointment or use **Quick Check-In / Walk-in**.
   - Filter by department to assign attending doctors across Cardiology, Orthopedics, General Medicine, Pediatrics, etc.
3. Open **Live Queue** and click **Refresh Board** to observe newly generated tokens instantly appear in the database lineup.

### Scenario C: Test Doctor Consultation Station
1. Log in with: `dr.rajesh@flowcare.com` / `Doctor@123`
2. In **Doctor Clinical Station**:
   - Click **Call Next Patient** to admit waiting patient (`C101`).
   - Click **Record Diagnosis & Rx** to save EHR consultation notes and auto-advance the queue.
3. Click **Refresh Station** to verify live database synchronization.

---

## 🔄 5. Global Refresh Behavior Verification
Every module in FlowCare is wired with a dedicated manual **Refresh** button that triggers a direct API call to FastAPI & MySQL/SQLite:
- **Admin Dashboard**: `Refresh Dashboard`
- **Doctor Dashboard**: `Refresh Station`
- **Receptionist Dashboard**: `Refresh Desk`
- **Nurse Station**: `Refresh Station`
- **Patient Portal**: `Refresh Portal`
- **Patients Directory**: `Refresh Patients`
- **Doctors Directory**: `Refresh Directory`
- **Appointments Management**: `Refresh Appointments`
- **Live Queue & Token Board**: `Refresh Board`
- **Medical Records**: `Refresh Records`
- **Prescriptions**: `Refresh Prescriptions`
- **Billing & Invoices**: `Refresh Invoices`
- **Reports & Analytics**: `Refresh Analytics`
- **System Users**: `Refresh Users`
