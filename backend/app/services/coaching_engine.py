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


# Optional LLM adapter interface. Rule-based implementation above stays active by default.
class LLMCoachAdapter:  # pragma: no cover - optional, requires ANTHROPIC_API_KEY
    """Stub adapter: if ENABLE_EXTERNAL_LLM=true and a key is set, a Claude-backed coach
    could rewrite rule-based messages. Deliberately not implemented for the hackathon —
    the deterministic engine is the product requirement."""

    def rewrite(self, message: str, context: dict) -> str:
        return message
