import io
import pytesseract
from PIL import Image
import ollama
from ..config import get_settings

settings = get_settings()

class OCRService:
    def __init__(self):
        self.model_name = "medgemma1.5:latest"
        
    async def extract_patient_name(self, image_bytes: bytes) -> dict:
        """
        Extracts raw text from an image using Tesseract OCR,
        then uses Ollama to intelligently parse the Patient Name.
        """
        raw_text = ""
        try:
            # 1. OCR the image
            image = Image.open(io.BytesIO(image_bytes))
            raw_text = pytesseract.image_to_string(image).strip()
            
            if not raw_text:
                return {"extracted_name": None, "raw_text": "", "error": "No text found in image"}
                
            # 2. Use LLM to extract the name
            prompt = f"""You are a medical data extraction assistant.
I will provide you with the raw OCR text of a medical case file report.
Your ONLY job is to find the patient's full name.
Return ONLY the patient's name, nothing else. If you cannot find a name, return "UNKNOWN".

Here is the raw text:
{raw_text}
"""
            extracted_name = None
            try:
                # We use ollama.AsyncClient
                client = ollama.AsyncClient(host=settings.ollama_host)
                response = await client.generate(
                    model=self.model_name,
                    prompt=prompt,
                    stream=False
                )
                
                ai_output = response.get("response", "").strip()
                
                # Clean up potential thinking tags if present
                if "<unused95>" in ai_output:
                    ai_output = ai_output.split("<unused95>")[-1].strip()
                    
                # Remove asterisks and newlines
                extracted_name = ai_output.replace("*", "").replace("\n", " ").strip()
                
                if extracted_name.upper() == "UNKNOWN" or not extracted_name:
                    extracted_name = None
            except Exception as llm_e:
                print(f"Ollama extraction failed: {llm_e}")
                
            return {
                "extracted_name": extracted_name,
                "raw_text": raw_text,
                "error": None
            }
            
        except Exception as e:
            return {"extracted_name": None, "raw_text": raw_text, "error": str(e)}

ocr_service = OCRService()
