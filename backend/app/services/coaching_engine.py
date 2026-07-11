"""Deterministic rule-based AI coach. No external LLM required (optional adapter below)."""
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import CoachMessageRow
from .data_store import store

METRIC_LABELS = {
    "patient_assessment": "patient assessment",
    "procedure_sequence": "procedure sequence",
    "instrument_selection": "instrument selection",
    "entry_accuracy": "entry-point accuracy",
    "exit_accuracy": "exit-point accuracy",
    "tool_stability": "tool stability",
    "motion_efficiency": "motion efficiency",
    "safety": "safety awareness",
    "completion_time_score": "completion time",
}

STRENGTH_PHRASES = {
    "patient_assessment": "Complete patient assessment",
    "procedure_sequence": "Consistent procedure sequence",
    "instrument_selection": "Correct instrument selection",
    "entry_accuracy": "Accurate entry-point placement",
    "exit_accuracy": "Accurate exit-point placement",
    "tool_stability": "Steady tool handling",
    "motion_efficiency": "Efficient tool movement",
    "safety": "Strong safety awareness",
    "completion_time_score": "Good time management",
}

IMPROVEMENT_PHRASES = {
    "patient_assessment": "Complete every patient-assessment step",
    "procedure_sequence": "Follow the guided step order more closely",
    "instrument_selection": "Double-check instrument choice before selecting",
    "entry_accuracy": "Improve entry-point accuracy",
    "exit_accuracy": "Improve exit-point accuracy",
    "tool_stability": "Steady the instrument during the needle arc",
    "motion_efficiency": "Reduce unnecessary tool movement",
    "safety": "Review the safety checks in the scenario",
    "completion_time_score": "Work toward the target completion time",
}


def make_message(db: Session, session_id: str, code: str, related_step_id: str | None = None,
                 message: str | None = None, suggested_action: str | None = None) -> CoachMessageRow:
    rule = store.coach_rules.get(code, {"type": "instruction", "message": message or code, "priority": 5})
    row = CoachMessageRow(
        id=f"coach_{uuid.uuid4().hex[:10]}",
        session_id=session_id,
        type=rule["type"],
        code=code,
        message=message or rule["message"],
        priority=rule.get("priority", 5),
        timestamp=datetime.now(timezone.utc),
        related_step_id=related_step_id,
        suggested_action=suggested_action,
    )
    db.add(row)
    return row


def build_summary(metrics: dict, critical_errors: list[str], missed: list[str]) -> tuple[list[str], list[str], str]:
    ranked = sorted(metrics.items(), key=lambda kv: kv[1], reverse=True)
    strengths = [STRENGTH_PHRASES[k] for k, v in ranked[:3] if v >= 80]
    improvements = [IMPROVEMENT_PHRASES[k] for k, v in ranked[::-1][:3] if v < 80]

    if critical_errors:
        summary = ("You completed the simulation, but critical safety items were missed. "
                   "Review the safety feedback before your next attempt.")
    elif not missed:
        summary = "You completed the simulation safely and followed the expected sequence."
    else:
        summary = "You completed the simulation with a few skipped steps. Review the missed actions list."
    if improvements:
        summary += f" Focus next on {IMPROVEMENT_PHRASES[[k for k, v in ranked[::-1] if v < 80][0]].lower()}."
    else:
        summary += " Keep practicing to maintain this level of performance."
    return strengths, improvements, summary


import base64
import ollama
import edge_tts
from ..config import get_settings

settings = get_settings()

class AsyncAIAssistant:
    """Uses Ollama and edge-tts to generate AI coaching messages asynchronously."""

    async def generate_ai_feedback(self, metrics: dict, rule_message: str) -> str:
        prompt = (
            f"You are an expert surgical coach. A trainee just triggered this feedback: '{rule_message}'. "
            f"Their current metrics are: {metrics}. "
            "Provide a brief, encouraging, and highly specific 1-2 sentence coaching tip. "
            "Do not use markdown or list format."
        )
        try:
            client = ollama.AsyncClient(host=settings.ollama_host)
            response = await client.generate(
                model=settings.ollama_model,
                prompt=prompt,
                stream=False
            )
            
            raw_text = response['response']
            # Remove <unused94> thought ... <unused95> blocks if the model outputs them
            if "<unused95>" in raw_text:
                raw_text = raw_text.split("<unused95>")[-1]
                
            return raw_text.strip()
        except Exception as e:
            print(f"Ollama generation failed: {e}")
            return rule_message

    async def generate_tts_audio(self, text: str) -> str | None:
        try:
            # Using JennyNeural for a natural, high-quality female voice
            communicate = edge_tts.Communicate(text, "en-US-JennyNeural")
            audio_data = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
            
            if audio_data:
                b64 = base64.b64encode(audio_data).decode("utf-8")
                return f"data:audio/mp3;base64,{b64}"
            return None
        except Exception as e:
            print(f"Edge TTS generation failed: {e}")
            return None

ai_assistant = AsyncAIAssistant()
