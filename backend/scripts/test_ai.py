import asyncio
import sys

# Ensure backend root is in path
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.coaching_engine import ai_assistant

async def test_ai():
    print("Testing Ollama AI Generation...")
    metrics = {"entry_accuracy": 50, "safety": 100}
    rule_msg = "Improve entry-point accuracy"
    
    print(f"Input Metrics: {metrics}")
    print(f"Input Rule: {rule_msg}")
    
    ai_msg = await ai_assistant.generate_ai_feedback(metrics, rule_msg)
    print(f"\n[AI Output]: {ai_msg}\n")
    
    print("Testing Edge TTS Generation...")
    audio_b64 = await ai_assistant.generate_tts_audio(ai_msg)
    
    if audio_b64 and audio_b64.startswith("data:audio/mp3;base64,"):
        print(f"[TTS Output]: Success! Generated Base64 string of length {len(audio_b64)}")
        
        # Save it to a file so we can listen to it
        import base64
        import os
        audio_data = base64.b64decode(audio_b64.split(",")[1])
        with open("test_output.mp3", "wb") as f:
            f.write(audio_data)
        
        print("\n🔊 Saved the audio to 'backend/test_output.mp3'!")
        print("You can open this file in your file explorer to hear the voice.")
        
        # On Mac, we can automatically play it using afplay
        if sys.platform == "darwin":
            print("Playing audio now...")
            os.system("afplay test_output.mp3")
    else:
        print("[TTS Output]: Failed to generate audio.")

if __name__ == "__main__":
    asyncio.run(test_ai())
