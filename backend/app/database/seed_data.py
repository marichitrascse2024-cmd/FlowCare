from datetime import datetime, date, timedelta, timezone
from sqlalchemy.orm import Session
from app.database.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.user import User, RoleEnum, UserStatusEnum
from app.models.patient import Patient
from app.models.doctor import Doctor, DoctorSchedule
from app.models.appointment import Appointment, AppointmentStatusEnum, AppointmentTypeEnum
from app.models.queue import QueueEntry, QueueStatusEnum, PriorityEnum
from app.models.medical_record import MedicalRecord, LabReport
from app.models.prescription import Prescription, PrescriptionItem
from app.models.billing import HospitalService, Bill, BillItem, Payment, PaymentStatusEnum, PaymentMethodEnum
from app.models.notification import Notification, NotificationTypeEnum
from app.models.audit import AuditLog

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    # 1. CORE STAFF USERS
    staff_users = [
        {"name": "Hospital Administrator", "email": "admin@flowcare.com", "phone": "+91 98400 00100", "pw": "Admin@123", "role": RoleEnum.ADMIN},
        {"name": "Sarah Jenkins (Front Desk)", "email": "receptionist@flowcare.com", "phone": "+91 98400 00101", "pw": "Staff@123", "role": RoleEnum.RECEPTIONIST},
        {"name": "Clara Barton (Charge Nurse)", "email": "nurse@flowcare.com", "phone": "+91 98400 00102", "pw": "Staff@123", "role": RoleEnum.NURSE},
    ]

    for s in staff_users:
        if not db.query(User).filter(User.email == s["email"]).first():
            u = User(
                full_name=s["name"],
                email=s["email"],
                phone=s["phone"],
                password_hash=get_password_hash(s["pw"]),
                role=s["role"],
                status=UserStatusEnum.ACTIVE
            )
            db.add(u)
    db.commit()

    # 2. DOCTORS ACROSS ALL MAJOR DEPARTMENTS
    doctors_info = [
        {
            "name": "Dr. Rajesh Kumar",
            "email": "dr.rajesh@flowcare.com",
            "phone": "+91 98400 00201",
            "specialization": "Cardiology",
            "qualification": "MBBS, MD, DM (Cardiology), FACC",
            "experience": 16,
            "fee": 800.0,
            "room": "Room 101 (Cardio Wing)",
            "avg_time": 20,
            "bio": "Senior Interventional Cardiologist specializing in acute coronary care, heart failure, and preventive cardiology."
        },
        {
            "name": "Dr. Sanjay Verma",
            "email": "dr.sanjay@flowcare.com",
            "phone": "+91 98400 00202",
            "specialization": "Cardiology",
            "qualification": "MBBS, MD, DNB (Cardiology)",
            "experience": 11,
            "fee": 750.0,
            "room": "Room 102 (Cardio Wing)",
            "avg_time": 18,
            "bio": "Consultant Cardiologist with focus on hypertension, lipid management, echocardiography, and arrhythmia care."
        },
        {
            "name": "Dr. Meena Reddy",
            "email": "dr.meena@flowcare.com",
            "phone": "+91 98400 00203",
            "specialization": "Orthopedics",
            "qualification": "MBBS, MS (Orthopedics), MCh",
            "experience": 14,
            "fee": 700.0,
            "room": "Room 103 (Bone & Joint Wing)",
            "avg_time": 18,
            "bio": "Senior Orthopedic Surgeon specializing in joint replacement, sports trauma, arthroscopy, and spine care."
        },
        {
            "name": "Dr. Arvind Swamy",
            "email": "dr.arvind@flowcare.com",
            "phone": "+91 98400 00204",
            "specialization": "Orthopedics",
            "qualification": "MBBS, D.Ortho, MS (Orthopedics)",
            "experience": 9,
            "fee": 650.0,
            "room": "Room 104 (Bone & Joint Wing)",
            "avg_time": 15,
            "bio": "Orthopedic specialist focusing on fracture fixation, pediatric orthopedics, and arthritis management."
        },
        {
            "name": "Dr. Suresh Babu",
            "email": "dr.suresh@flowcare.com",
            "phone": "+91 98400 00205",
            "specialization": "General Medicine",
            "qualification": "MBBS, MD (Internal Medicine)",
            "experience": 18,
            "fee": 500.0,
            "room": "Room 201 (OPD Floor 1)",
            "avg_time": 15,
            "bio": "Chief Physician with vast expertise in diabetes mellitus, infectious fevers, hypertension, and adult healthcare."
        },
        {
            "name": "Dr. Sunita Patel",
            "email": "dr.patel@flowcare.com",
            "phone": "+91 98400 00206",
            "specialization": "General Medicine",
            "qualification": "MBBS, MD (General Medicine)",
            "experience": 10,
            "fee": 500.0,
            "room": "Room 202 (OPD Floor 1)",
            "avg_time": 15,
            "bio": "Consultant Physician managing chronic lifestyle disorders, geriatric health, and preventative medical care."
        },
        {
            "name": "Dr. Anjali Sharma",
            "email": "dr.anjali@flowcare.com",
            "phone": "+91 98400 00207",
            "specialization": "Pediatrics",
            "qualification": "MBBS, DCH, DNB (Pediatrics)",
            "experience": 12,
            "fee": 600.0,
            "room": "Room 203 (Child Health Care)",
            "avg_time": 15,
            "bio": "Senior Pediatrician specializing in child immunization, developmental milestones, childhood asthma, and neonatal care."
        },
        {
            "name": "Dr. Rohit Mehta",
            "email": "dr.rohit@flowcare.com",
            "phone": "+91 98400 00208",
            "specialization": "Pediatrics",
            "qualification": "MBBS, MD (Pediatrics)",
            "experience": 8,
            "fee": 550.0,
            "room": "Room 204 (Child Health Care)",
            "avg_time": 15,
            "bio": "Pediatric specialist with dedication to pediatric nutrition, childhood infections, and adolescent health."
        },
        {
            "name": "Dr. Kavitha Iyer",
            "email": "dr.kavitha@flowcare.com",
            "phone": "+91 98400 00209",
            "specialization": "Dermatology",
            "qualification": "MBBS, MD (Dermatology, Venereology & Leprosy)",
            "experience": 11,
            "fee": 650.0,
            "room": "Room 301 (Derma Care)",
            "avg_time": 15,
            "bio": "Consultant Dermatologist and Trichologist managing psoriasis, eczema, acne vulgaris, and medical skin therapies."
        },
        {
            "name": "Dr. Arun Prakash",
            "email": "dr.arun@flowcare.com",
            "phone": "+91 98400 00210",
            "specialization": "Neurology",
            "qualification": "MBBS, MD (Medicine), DM (Neurology)",
            "experience": 15,
            "fee": 900.0,
            "room": "Room 302 (Neuro Sciences Wing)",
            "avg_time": 20,
            "bio": "Senior Neurologist specializing in stroke management, epilepsy, migraine disorders, Parkinson's disease, and neuropathies."
        },
        {
            "name": "Dr. Priya Menon",
            "email": "dr.priyam@flowcare.com",
            "phone": "+91 98400 00211",
            "specialization": "Gynecology",
            "qualification": "MBBS, MS (OBG), DGO, FICOG",
            "experience": 14,
            "fee": 700.0,
            "room": "Room 303 (Women Wellness)",
            "avg_time": 18,
            "bio": "Senior Gynecologist and Obstetrician specializing in high-risk pregnancy, PCOS management, and laparoscopic gynecology."
        },
        {
            "name": "Dr. Naveen Rao",
            "email": "dr.naveen@flowcare.com",
            "phone": "+91 98400 00212",
            "specialization": "ENT",
            "qualification": "MBBS, MS (ENT / Otorhinolaryngology)",
            "experience": 12,
            "fee": 550.0,
            "room": "Room 401 (ENT Center)",
            "avg_time": 15,
            "bio": "ENT Specialist focusing on sinusitis, endoscopic sinus surgery, vertigo evaluation, and hearing rehabilitation."
        },
        {
            "name": "Dr. Divya Krishnan",
            "email": "dr.divya@flowcare.com",
            "phone": "+91 98400 00213",
            "specialization": "Ophthalmology",
            "qualification": "MBBS, MS (Ophthalmology), FICO",
            "experience": 10,
            "fee": 600.0,
            "room": "Room 402 (Eye Care Center)",
            "avg_time": 15,
            "bio": "Consultant Ophthalmologist specializing in cataract surgery, glaucoma screening, diabetic retinopathy, and vision care."
        },
        {
            "name": "Dr. Karthik Srinivasan",
            "email": "dr.karthiks@flowcare.com",
            "phone": "+91 98400 00214",
            "specialization": "Dental",
            "qualification": "BDS, MDS (Oral & Maxillofacial Surgery)",
            "experience": 9,
            "fee": 500.0,
            "room": "Room 403 (Dental Suite)",
            "avg_time": 20,
            "bio": "Dental Surgeon with expertise in root canal treatment, dental implants, cosmetic restorations, and wisdom tooth surgeries."
        },
        {
            "name": "Dr. Vijay Kumar",
            "email": "dr.vijay@flowcare.com",
            "phone": "+91 98400 00215",
            "specialization": "Pulmonology",
            "qualification": "MBBS, MD (Pulmonary Medicine), FCCP",
            "experience": 13,
            "fee": 750.0,
            "room": "Room 501 (Chest & Lung Center)",
            "avg_time": 18,
            "bio": "Senior Pulmonologist specializing in asthma, COPD management, sleep apnea, post-COVID lung fibrosis, and bronchoscopy."
        },
        {
            "name": "Dr. Swetha Ramesh",
            "email": "dr.swetha@flowcare.com",
            "phone": "+91 98400 00216",
            "specialization": "Gastroenterology",
            "qualification": "MBBS, MD, DM (Medical Gastroenterology)",
            "experience": 11,
            "fee": 850.0,
            "room": "Room 502 (Digestive Health Center)",
            "avg_time": 20,
            "bio": "Consultant Gastroenterologist focusing on acid reflux, fatty liver disease, inflammatory bowel disease, and diagnostic endoscopy."
        }
    ]

    doctor_map = {}
    for idx, d_info in enumerate(doctors_info, start=1):
        u = db.query(User).filter(User.email == d_info["email"]).first()
        if not u:
            u = User(
                full_name=d_info["name"],
                email=d_info["email"],
                phone=d_info["phone"],
                password_hash=get_password_hash("Doctor@123"),
                role=RoleEnum.DOCTOR,
                status=UserStatusEnum.ACTIVE
            )
            db.add(u)
            db.flush()

        doc = db.query(Doctor).filter(Doctor.user_id == u.id).first()
        if not doc:
            doc = Doctor(
                user_id=u.id,
                doctor_code=f"DOC-2026-{100 + idx}",
                specialization=d_info["specialization"],
                qualification=d_info["qualification"],
                experience_years=d_info["experience"],
                consultation_fee=d_info["fee"],
                room_number=d_info["room"],
                biography=d_info["bio"],
                is_available=True,
                average_consultation_time=d_info["avg_time"]
            )
            db.add(doc)
            db.flush()

            for day in range(6): # Mon-Sat
                sch = DoctorSchedule(
                    doctor_id=doc.id,
                    day_of_week=day,
                    start_time="09:00",
                    end_time="17:00",
                    slot_duration=d_info["avg_time"],
                    is_active=True
                )
                db.add(sch)
        doctor_map[d_info["specialization"]] = doc
        doctor_map[d_info["name"]] = doc
    db.commit()

    # 3. 10 REALISTIC INDIAN DEMO PATIENTS
    demo_patients = [
        {
            "code": "PAT1001",
            "name": "Arjun Kumar",
            "email": "arjun.kumar@flowcare.demo",
            "phone": "+91 98401 11001",
            "dob": date(1986, 4, 15),
            "gender": "Male",
            "blood": "O+",
            "address": "45, Gandhi Street, T. Nagar",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "emergency_name": "Meera Kumar (Wife)",
            "emergency_phone": "+91 98401 99001",
            "allergies": "None",
            "history": "Mild hypertension, family history of coronary artery disease.",
            "insurance": "Star Health Gold",
            "policy": "SH-789012"
        },
        {
            "code": "PAT1002",
            "name": "Priya Sharma",
            "email": "priya.sharma@flowcare.demo",
            "phone": "+91 98402 22002",
            "dob": date(1993, 8, 22),
            "gender": "Female",
            "blood": "B+",
            "address": "12, 4th Main Road, Indiranagar",
            "city": "Bengaluru",
            "state": "Karnataka",
            "emergency_name": "Ramesh Sharma (Father)",
            "emergency_phone": "+91 98402 99002",
            "allergies": "Sulfa Drugs",
            "history": "Right knee ligament sprain during badminton.",
            "insurance": "HDFC ERGO Medishield",
            "policy": "HE-451209"
        },
        {
            "code": "PAT1003",
            "name": "Rahul Krishnan",
            "email": "rahul.krishnan@flowcare.demo",
            "phone": "+91 98403 33003",
            "dob": date(1980, 11, 10),
            "gender": "Male",
            "blood": "A+",
            "address": "78, Anna Salai, Guindy",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "emergency_name": "Sujatha Krishnan (Spouse)",
            "emergency_phone": "+91 98403 99003",
            "allergies": "Penicillin (moderate rash)",
            "history": "Type 2 Diabetes for 4 years (HbA1c 7.2), high triglycerides.",
            "insurance": "Care Health Supreme",
            "policy": "CH-118934"
        },
        {
            "code": "PAT1004",
            "name": "Ananya Ramesh",
            "email": "ananya.ramesh@flowcare.demo",
            "phone": "+91 98404 44004",
            "dob": date(2018, 6, 5),
            "gender": "Female",
            "blood": "O+",
            "address": "88, Banjara Hills Road No. 3",
            "city": "Hyderabad",
            "state": "Telangana",
            "emergency_name": "Ramesh Venkat (Father)",
            "emergency_phone": "+91 98404 99004",
            "allergies": "Dust mites & pollen",
            "history": "Recurrent childhood wheezing, seasonal upper respiratory tract infection.",
            "insurance": "Max Bupa ReAssure",
            "policy": "MB-902341"
        },
        {
            "code": "PAT1005",
            "name": "Karthik Raj",
            "email": "karthik.raj@flowcare.demo",
            "phone": "+91 98405 55005",
            "dob": date(1989, 2, 28),
            "gender": "Male",
            "blood": "AB+",
            "address": "33, Linking Road, Bandra West",
            "city": "Mumbai",
            "state": "Maharashtra",
            "emergency_name": "Deepa Raj (Sister)",
            "emergency_phone": "+91 98405 99005",
            "allergies": "None",
            "history": "Chronic tension headaches, neck strain from prolonged screen use.",
            "insurance": "Niva Bupa Health Companion",
            "policy": "NB-334190"
        },
        {
            "code": "PAT1006",
            "name": "Sneha Prakash",
            "email": "sneha.prakash@flowcare.demo",
            "phone": "+91 98406 66006",
            "dob": date(1997, 12, 14),
            "gender": "Female",
            "blood": "B-",
            "address": "21, Race Course Road",
            "city": "Coimbatore",
            "state": "Tamil Nadu",
            "emergency_name": "Prakash Narayanan (Father)",
            "emergency_phone": "+91 98406 99006",
            "allergies": "Latex",
            "history": "Eczema flares on forearms, mild acne vulgaris.",
            "insurance": "ICICI Lombard Health Shield",
            "policy": "IL-559281"
        },
        {
            "code": "PAT1007",
            "name": "Vignesh Kumar",
            "email": "vignesh.kumar@flowcare.demo",
            "phone": "+91 98407 77007",
            "dob": date(1975, 9, 3),
            "gender": "Male",
            "blood": "A-",
            "address": "15, Alwarpet High Road",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "emergency_name": "Lakshmi Vignesh (Wife)",
            "emergency_phone": "+91 98407 99007",
            "allergies": "Aspirin (gastric irritation)",
            "history": "Coronary artery disease, post-angioplasty (2023), regular cardiac follow-up.",
            "insurance": "Star Health Premier",
            "policy": "SH-662819"
        },
        {
            "code": "PAT1008",
            "name": "Divya Srinivasan",
            "email": "divya.srinivasan@flowcare.demo",
            "phone": "+91 98408 88008",
            "dob": date(1995, 3, 19),
            "gender": "Female",
            "blood": "O-",
            "address": "52, Koramangala 5th Block",
            "city": "Bengaluru",
            "state": "Karnataka",
            "emergency_name": "Srinivasan Raman (Father)",
            "emergency_phone": "+91 98408 99008",
            "allergies": "None",
            "history": "Polycystic Ovarian Syndrome (PCOS), regular menstrual wellness screening.",
            "insurance": "Tata AIG MediCare",
            "policy": "TA-882190"
        },
        {
            "code": "PAT1009",
            "name": "Naveen Mohan",
            "email": "naveen.mohan@flowcare.demo",
            "phone": "+91 98409 99009",
            "dob": date(1982, 7, 25),
            "gender": "Male",
            "blood": "B+",
            "address": "104, Jubilee Hills Road No. 36",
            "city": "Hyderabad",
            "state": "Telangana",
            "emergency_name": "Geetha Mohan (Wife)",
            "emergency_phone": "+91 98409 99009",
            "allergies": "Ciprofloxacin",
            "history": "Chronic sinusitis, recurrent nasal congestion and throat irritation.",
            "insurance": "Aditya Birla Activ Health",
            "policy": "AB-771204"
        },
        {
            "code": "PAT1010",
            "name": "Kavya Lakshmi",
            "email": "kavya.lakshmi@flowcare.demo",
            "phone": "+91 98410 10010",
            "dob": date(2001, 10, 8),
            "gender": "Female",
            "blood": "A+",
            "address": "67, Besant Nagar 2nd Avenue",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "emergency_name": "Sundaram Lakshmi (Mother)",
            "emergency_phone": "+91 98410 99010",
            "allergies": "None",
            "history": "Myopia (both eyes), digital eye strain, regular refractive evaluation.",
            "insurance": "Bajaj Allianz Health Guard",
            "policy": "BA-994182"
        }
    ]

    patient_map = {}
    for p_info in demo_patients:
        u = db.query(User).filter(User.email == p_info["email"]).first()
        if not u:
            u = User(
                full_name=p_info["name"],
                email=p_info["email"],
                phone=p_info["phone"],
                password_hash=get_password_hash("FlowCare@123"),
                role=RoleEnum.PATIENT,
                status=UserStatusEnum.ACTIVE
            )
            db.add(u)
            db.flush()

        pat = db.query(Patient).filter(Patient.user_id == u.id).first()
        if not pat:
            pat = Patient(
                user_id=u.id,
                patient_code=p_info["code"],
                date_of_birth=p_info["dob"],
                gender=p_info["gender"],
                blood_group=p_info["blood"],
                address=f"{p_info['address']}, {p_info['city']}, {p_info['state']}",
                emergency_contact_name=p_info["emergency_name"],
                emergency_contact_phone=p_info["emergency_phone"],
                known_allergies=p_info["allergies"],
                medical_history_notes=p_info["history"],
                insurance_provider=p_info["insurance"],
                insurance_policy_number=p_info["policy"]
            )
            db.add(pat)
            db.flush()
        patient_map[p_info["code"]] = pat
        patient_map[p_info["name"]] = pat
    db.commit()

    # 4. PRE-ENTERED REALISTIC MIXED APPOINTMENTS & LIVE QUEUE
    today = date.today()

    demo_appts = [
        {
            "num": "APT-2026-2001",
            "patient": patient_map["Arjun Kumar"],
            "doctor": doctor_map["Dr. Rajesh Kumar"],
            "date": today,
            "slot": "10:00 AM",
            "type": AppointmentTypeEnum.SPECIALIST,
            "status": AppointmentStatusEnum.WAITING,
            "complaint": "Chest discomfort on morning exercise, high cholesterol review",
            "checkin": True,
            "token": "C101",
            "q_status": QueueStatusEnum.WAITING,
            "priority": PriorityEnum.NORMAL,
            "q_pos": 1,
            "wait_min": 0
        },
        {
            "num": "APT-2026-2002",
            "patient": patient_map["Priya Sharma"],
            "doctor": doctor_map["Dr. Meena Reddy"],
            "date": today,
            "slot": "10:30 AM",
            "type": AppointmentTypeEnum.SPECIALIST,
            "status": AppointmentStatusEnum.WAITING,
            "complaint": "Right knee stiffness and ligament pain after sports",
            "checkin": True,
            "token": "O102",
            "q_status": QueueStatusEnum.WAITING,
            "priority": PriorityEnum.NORMAL,
            "q_pos": 1,
            "wait_min": 0
        },
        {
            "num": "APT-2026-2003",
            "patient": patient_map["Rahul Krishnan"],
            "doctor": doctor_map["Dr. Suresh Babu"],
            "date": today,
            "slot": "09:30 AM",
            "type": AppointmentTypeEnum.GENERAL,
            "status": AppointmentStatusEnum.IN_CONSULTATION,
            "complaint": "Type 2 Diabetes routine review and fasting blood sugar check",
            "checkin": True,
            "token": "G101",
            "q_status": QueueStatusEnum.IN_CONSULTATION,
            "priority": PriorityEnum.NORMAL,
            "q_pos": 1,
            "wait_min": 0
        },
        {
            "num": "APT-2026-2004",
            "patient": patient_map["Ananya Ramesh"],
            "doctor": doctor_map["Dr. Anjali Sharma"],
            "date": today,
            "slot": "11:00 AM",
            "type": AppointmentTypeEnum.GENERAL,
            "status": AppointmentStatusEnum.WAITING,
            "complaint": "Seasonal cold, persistent cough and childhood wheeze",
            "checkin": True,
            "token": "P101",
            "q_status": QueueStatusEnum.WAITING,
            "priority": PriorityEnum.NORMAL,
            "q_pos": 1,
            "wait_min": 10
        },
        {
            "num": "APT-2026-2005",
            "patient": patient_map["Karthik Raj"],
            "doctor": doctor_map["Dr. Arun Prakash"],
            "date": today + timedelta(days=1),
            "slot": "10:00 AM",
            "type": AppointmentTypeEnum.SPECIALIST,
            "status": AppointmentStatusEnum.CONFIRMED,
            "complaint": "Chronic tension headaches and neck stiffness",
            "checkin": False
        },
        {
            "num": "APT-2026-2006",
            "patient": patient_map["Sneha Prakash"],
            "doctor": doctor_map["Dr. Kavitha Iyer"],
            "date": today + timedelta(days=2),
            "slot": "02:30 PM",
            "type": AppointmentTypeEnum.SPECIALIST,
            "status": AppointmentStatusEnum.BOOKED,
            "complaint": "Eczema skin flare-up on forearms",
            "checkin": False
        },
        {
            "num": "APT-2026-2007",
            "patient": patient_map["Vignesh Kumar"],
            "doctor": doctor_map["Dr. Rajesh Kumar"],
            "date": today - timedelta(days=1),
            "slot": "11:30 AM",
            "type": AppointmentTypeEnum.FOLLOW_UP,
            "status": AppointmentStatusEnum.COMPLETED,
            "complaint": "Post-angioplasty routine cardiac check",
            "checkin": False
        },
        {
            "num": "APT-2026-2008",
            "patient": patient_map["Divya Srinivasan"],
            "doctor": doctor_map["Dr. Priya Menon"],
            "date": today + timedelta(days=3),
            "slot": "11:00 AM",
            "type": AppointmentTypeEnum.SPECIALIST,
            "status": AppointmentStatusEnum.CONFIRMED,
            "complaint": "PCOS wellness check and hormonal panel discussion",
            "checkin": False
        },
        {
            "num": "APT-2026-2009",
            "patient": patient_map["Naveen Mohan"],
            "doctor": doctor_map["Dr. Naveen Rao"],
            "date": today + timedelta(days=4),
            "slot": "03:00 PM",
            "type": AppointmentTypeEnum.GENERAL,
            "status": AppointmentStatusEnum.BOOKED,
            "complaint": "Sinus congestion and frequent throat irritation",
            "checkin": False
        },
        {
            "num": "APT-2026-2010",
            "patient": patient_map["Kavya Lakshmi"],
            "doctor": doctor_map["Dr. Divya Krishnan"],
            "date": today + timedelta(days=5),
            "slot": "04:00 PM",
            "type": AppointmentTypeEnum.GENERAL,
            "status": AppointmentStatusEnum.CONFIRMED,
            "complaint": "Refraction power check and computer vision strain",
            "checkin": False
        }
    ]

    for a_data in demo_appts:
        appt = db.query(Appointment).filter(Appointment.appointment_number == a_data["num"]).first()
        if not appt:
            appt = Appointment(
                appointment_number=a_data["num"],
                patient_id=a_data["patient"].id,
                doctor_id=a_data["doctor"].id,
                appointment_date=a_data["date"],
                time_slot=a_data["slot"],
                status=a_data["status"],
                appointment_type=a_data["type"],
                chief_complaint=a_data["complaint"],
                ai_suggested="YES" if a_data["slot"] in ["10:00 AM", "11:00 AM"] else "NO"
            )
            db.add(appt)
            db.flush()

        if a_data.get("checkin"):
            q_entry = db.query(QueueEntry).filter(QueueEntry.appointment_id == appt.id).first()
            if not q_entry:
                q_entry = QueueEntry(
                    token_number=a_data["token"],
                    patient_id=a_data["patient"].id,
                    doctor_id=a_data["doctor"].id,
                    appointment_id=appt.id,
                    status=a_data["q_status"],
                    priority=a_data["priority"],
                    queue_position=a_data["q_pos"],
                    estimated_wait_minutes=a_data["wait_min"],
                    room_number=a_data["doctor"].room_number,
                    check_in_time=datetime.now(timezone.utc) - timedelta(minutes=15),
                    called_time=datetime.now(timezone.utc) - timedelta(minutes=5) if a_data["q_status"] == QueueStatusEnum.IN_CONSULTATION else None,
                    consultation_start=datetime.now(timezone.utc) - timedelta(minutes=3) if a_data["q_status"] == QueueStatusEnum.IN_CONSULTATION else None
                )
                db.add(q_entry)

    db.commit()
    db.close()
    print("Database seeding with 10 Indian demo patients and 16 multi-department doctors completed successfully!")

if __name__ == "__main__":
    seed_database()
