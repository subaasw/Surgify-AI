from fastapi import APIRouter, File, UploadFile, HTTPException
from ..services.ocr_service import ocr_service
from ..schemas import PatientNameExtractionResponse

router = APIRouter()

@router.post("/extract-name", response_model=PatientNameExtractionResponse)
async def extract_patient_name(file: UploadFile = File(...)):
    """
    Extracts the patient name from an uploaded image of a case file report.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
        
    image_bytes = await file.read()
    result = await ocr_service.extract_patient_name(image_bytes)
    
    if result.get("error"):
        # We can still return 200 with the error in the body, or 500
        # For OCR service, returning 200 with error explicitly handled by the client is better
        pass
        
    return PatientNameExtractionResponse(**result)
