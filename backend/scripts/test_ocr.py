import asyncio
import io
from PIL import Image, ImageDraw, ImageFont
from app.services.ocr_service import ocr_service

async def run_test():
    print("Generating a test medical report image...")
    # Create a white image
    img = Image.new('RGB', (800, 400), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    
    # Try to use a default font
    # Pillow default font is very small, but tesseract can usually read it if scaled
    # Let's write some text
    text = """
    SURGICAL CONSULTATION REPORT
    
    Date: 2026-07-12
    Patient Name: Jane Doe
    DOB: 1985-04-12
    
    Chief Complaint: Pain in right forearm following a laceration.
    """
    
    d.text((50, 50), text, fill=(0, 0, 0))
    
    # Scale up the image so Tesseract has an easier time with the default font
    img = img.resize((1600, 800), Image.Resampling.LANCZOS)
    
    # Save to bytes
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    
    print("Sending to OCR Service...")
    result = await ocr_service.extract_patient_name(img_bytes)
    
    print("\n--- RESULTS ---")
    print(f"Raw Extracted Text:\n{result['raw_text']}\n")
    print(f"Extracted Name: {result['extracted_name']}")
    print(f"Error: {result['error']}")
    
    assert result['extracted_name'] == "Jane Doe" or "Jane" in str(result['extracted_name'])
    print("\n✅ Test Passed!")

if __name__ == "__main__":
    asyncio.run(run_test())
