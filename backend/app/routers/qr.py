from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.core.deps import get_current_user, get_current_user_optional, require_roles
from app.models.user import User, RoleEnum
from app.models.patient import Patient
from app.services.qr_service import qr_service

router = APIRouter(prefix="", tags=["Universal Dynamic QR Code System"])

class QRScanRequest(BaseModel):
    qr_token: str
    module: Optional[str] = "GENERAL"

class QRVerifyRequest(BaseModel):
    qr_token: str
    module: Optional[str] = "GENERAL" # RECEPTION, APPOINTMENT, DOCTOR, QUEUE, MEDICAL_RECORDS, BILLING, EMERGENCY, GENERAL

class QRResponse(BaseModel):
    patient_id: int
    patient_code: str
    patient_name: str
    qr_token: str
    qr_image_data_uri: str
    qr_svg: Optional[str] = None

@router.get("/patients/{patient_id}/qr", response_model=QRResponse)
def get_patient_qr_code(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve or generate dynamic QR code pass for the patient."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    # Authorization: Patients can only fetch their own QR code; staff can view as permitted
    if current_user.role == RoleEnum.PATIENT and (not current_user.patient_profile or current_user.patient_profile.id != patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. You can only view your own QR code.")

    res = qr_service.get_or_create_patient_qr(db=db, patient=patient)
    return res

@router.post("/patients/{patient_id}/qr", response_model=QRResponse)
def regenerate_patient_qr_code(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Regenerate a new cryptographic QR token for patient."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    if current_user.role == RoleEnum.PATIENT and (not current_user.patient_profile or current_user.patient_profile.id != patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # Force new token generation
    patient.qr_token = None
    res = qr_service.get_or_create_patient_qr(db=db, patient=patient)
    return res

@router.post("/patient/qr/verify")
def verify_patient_qr_code(
    verify_in: QRVerifyRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Centralized Universal Patient QR Verification API.
    Identifies patient from token, applies current user's session and RBAC permissions, and returns module-specific payload.
    """
    module_upper = (verify_in.module or "GENERAL").upper()

    try:
        data = qr_service.verify_and_resolve_patient_module(
            db=db,
            qr_token=verify_in.qr_token,
            scanner_user=current_user,
            module=module_upper
        )
        return {
            "status": "SUCCESS",
            "message": f"Patient QR verified for {module_upper} module.",
            "patient_data": data
        }
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"QR verification failed: {str(e)}")

@router.post("/qr/verify")
def verify_qr_alias(
    verify_in: QRVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Alias for centralized patient QR verification."""
    return verify_patient_qr_code(verify_in, db, current_user)

@router.post("/qr/scan")
def scan_and_resolve_patient_qr(
    scan_in: QRScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Legacy scanning endpoint compatible with existing calls."""
    verify_req = QRVerifyRequest(qr_token=scan_in.qr_token, module=scan_in.module or "GENERAL")
    return verify_patient_qr_code(verify_req, db, current_user)
