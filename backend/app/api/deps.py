"""Shared lookups and serializers for the API routers."""
from sqlalchemy.orm import Session

from ..models import SimulationSession
from ..services.data_store import ApiError, store
from ..services.simulation_engine import current_step


def get_session_or_404(db: Session, session_id: str) -> SimulationSession:
    session = db.get(SimulationSession, session_id)
    if not session:
        raise ApiError(404, "SESSION_NOT_FOUND", f"Unknown session '{session_id}'.")
    return session


def scenario_summary(sc: dict) -> dict:
    return {**sc, "step_count": len(sc["steps"])}


def patient_out(p: dict) -> dict:
    return {**p, "dialogue": [{"question_id": d["question_id"], "question": d["question"]} for d in p["dialogue"]]}


def session_state(session: SimulationSession) -> dict:
    scenario = store.get_scenario(session.scenario_id)
    step = current_step(session, scenario)
    return {
        "id": session.id,
        "scenario_id": session.scenario_id,
        "user_id": session.user_id,
        "mode": session.mode,
        "status": session.status,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "elapsed_seconds": session.elapsed_seconds,
        "current_step_index": session.current_step_index,
        "current_step": step,
        "selected_region": session.selected_region,
        "selected_tool": session.selected_tool,
        "camera_mode": session.camera_mode,
        "score": session.score,
        "completed_step_ids": session.completed_step_ids,
        "checklist": session.checklist,
        "metrics": session.metrics,
    }
