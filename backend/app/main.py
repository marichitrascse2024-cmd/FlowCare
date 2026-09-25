from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.database.database import Base, engine
from app.database.seed_data import seed_database

from app.models.scan_schedule import ScanSchedule # Ensure ScanSchedule model is registered with SQLAlchemy Base metadata

# Routers
from app.routers import (
    auth,
    users,
    patients,
    doctors,
    doctor_portal,
    appointments,
    queue,
    medical_records,
    prescriptions,
    billing,
    ai,
    notifications,
    reports,
    qr,
    disease_risk,
    recommendations,
    sync,
    scan_schedules,
    signaling
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and seed realistic demo data on startup
    try:
        Base.metadata.create_all(bind=engine)
        seed_database()
    except Exception as e:
        print(f"Warning during DB startup/seed: {e}")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
# FLOWCARE API
### AI-Powered Hospital Patient Flow & Healthcare Management System

FlowCare is a production-style hospital management platform designed to optimize patient flow, reduce waiting times, and assist healthcare professionals through AI-powered decision support.

## Key Capabilities:
- **Authentication & RBAC**: ADMIN, DOCTOR, RECEPTIONIST, NURSE, PATIENT
- **AI Queue Management & Waiting-Time Prediction**: Live queue tracking with queuing theory + statistical predictions
- **AI Appointment Scheduling & Doctor Recommendation**: Workload-balanced smart slot and specialist suggestions
- **Dynamic Patient QR Code**: Secure tokenized check-in and fast-track admissions
- **Hybrid Medical Encryption**: AES-256-GCM + RSA-2048 high-security medical protection
- **AI Disease Risk Prediction**: Cardiovascular, Type 2 Diabetes, and Hypertension risk scoring
- **Cloud Synchronization**: Multi-entity cloud synchronization and audit queue
- **Comprehensive Clinical & Financial Modules**: Appointments, Consultations, Prescriptions, Lab Reports, Invoices
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"An internal server error occurred: {str(exc)}"}
    )

# Include API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(patients.router, prefix=settings.API_V1_STR)
app.include_router(doctors.router, prefix=settings.API_V1_STR)
app.include_router(doctor_portal.router, prefix=settings.API_V1_STR)
app.include_router(appointments.router, prefix=settings.API_V1_STR)
app.include_router(queue.router, prefix=settings.API_V1_STR)
app.include_router(medical_records.router, prefix=settings.API_V1_STR)
app.include_router(prescriptions.router, prefix=settings.API_V1_STR)
app.include_router(billing.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)

# 5 Advanced Features Routers
app.include_router(qr.router, prefix=settings.API_V1_STR)
app.include_router(disease_risk.router, prefix=settings.API_V1_STR)
app.include_router(recommendations.router, prefix=settings.API_V1_STR)
app.include_router(sync.router, prefix=settings.API_V1_STR)
app.include_router(scan_schedules.router, prefix=settings.API_V1_STR)
app.include_router(signaling.router)

@app.get("/")
def root():
    return {
        "system": "FLOWCARE",
        "tagline": "AI-Powered Hospital Patient Flow & Healthcare Management System",
        "status": "Operational",
        "features": [
            "Dynamic QR Code",
            "Hybrid Encryption",
            "AI Disease Risk Prediction",
            "Doctor Recommendation System",
            "Cloud Synchronization"
        ],
        "api_docs": "/docs",
        "redoc": "/redoc"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
