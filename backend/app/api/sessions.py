"""Session lifecycle, events, coaching, vision metrics, trajectory, and per-session results."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CoachMessageRow, SimulationResult, SimulationSession, TrajectoryPoint
from ..config import get_settings
from ..schemas import (CoachGenerateRequest, CoachGenerateResponse, CoachMessageOut, HintResponse, SessionCreateRequest, SessionCreateResponse,
                       SessionState, SimulationEventRequest, SimulationEventResponse,
                       SimulationResultOut, TrajectoryBatchRequest, TrajectoryResponse,
                       VisionMetricsRequest)
from ..services import coaching_engine, scoring_engine, simulation_engine
from ..services.data_store import ApiError, store
from ..services.websocket_manager import manager
from .deps import get_session_or_404, patient_out, scenario_summary, session_state

router = APIRouter()
settings = get_settings()


def _result_out(result: SimulationResult) -> dict:
    scenario = store.get_scenario(result.scenario_id)
    return {
        "result_id": result.id, "session_id": result.session_id,
        "scenario": {"id": scenario["id"], "name": scenario["name"]},
        "final_score": result.final_score, "grade": result.grade, "metrics": result.metrics,
        "strengths": result.strengths, "improvements": result.improvements,
        "missed_actions": result.missed_actions, "critical_errors": result.critical_errors,
        "event_timeline": result.event_timeline, "coach_summary": result.coach_summary,
        "completed_at": result.completed_at,
    }


# ---------- lifecycle ----------

@router.post("/sessions", response_model=SessionCreateResponse, status_code=201)
async def create_session(body: SessionCreateRequest, db: Session = Depends(get_db)):
    scenario = store.get_scenario(body.scenario_id)
    session = SimulationSession(
        id=f"session_{uuid.uuid4().hex[:10]}",
        scenario_id=scenario["id"],
        user_id=body.user_id,
        mode=body.mode,
        status="created",
        checklist={key: False for key in
                   {s["checklist_key"] for s in scenario["steps"] if s.get("checklist_key")}},
        metrics=scoring_engine.compute_metrics({}, scenario, 0, []),
        completed_step_ids=[],
        engine_state={},
    )
    db.add(session)
    for code in ("SESSION_STARTED",):
        coaching_engine.make_message(db, session.id, code, scenario["steps"][0]["id"])
    db.commit()
    return {
        "session": session_state(session),
        "scenario": scenario_summary(scenario),
        "patient": patient_out(store.get_patient(scenario["patient_id"])),
        "available_actions": sorted(simulation_engine.SUPPORTED_ACTIONS),
        "available_tools": [store.get_instrument(t) for t in scenario["required_tools"]],
        "websocket_channel": f"/ws/sessions/{session.id}",
    }


@router.get("/sessions/{session_id}", response_model=SessionState)
def get_session(session_id: str, db: Session = Depends(get_db)):
    return session_state(get_session_or_404(db, session_id))


async def _transition(db: Session, session_id: str, allowed_from: tuple[str, ...], new_status: str,
                      ws_type: str) -> SimulationSession:
    session = get_session_or_404(db, session_id)
    if session.status not in allowed_from:
        raise ApiError(409, "INVALID_STATE_TRANSITION",
                       f"Cannot move session from '{session.status}' to '{new_status}'.",
                       {"status": session.status, "allowed_from": list(allowed_from)})
    session.status = new_status
    if new_status == "active" and session.started_at is None:
        session.started_at = datetime.now(timezone.utc)
    db.commit()
    await manager.broadcast(session_id, ws_type, session_state_json(session))
    return session


def session_state_json(session: SimulationSession) -> dict:
    return SessionState(**session_state(session)).model_dump(mode="json")


@router.post("/sessions/{session_id}/start", response_model=SessionState)
async def start_session(session_id: str, db: Session = Depends(get_db)):
    return session_state(await _transition(db, session_id, ("created",), "active", "session.started"))


@router.post("/sessions/{session_id}/pause", response_model=SessionState)
async def pause_session(session_id: str, db: Session = Depends(get_db)):
    return session_state(await _transition(db, session_id, ("active",), "paused", "session.paused"))


@router.post("/sessions/{session_id}/resume", response_model=SessionState)
async def resume_session(session_id: str, db: Session = Depends(get_db)):
    return session_state(await _transition(db, session_id, ("paused",), "active", "session.resumed"))


@router.post("/sessions/{session_id}/reset", response_model=SessionState)
async def reset_session(session_id: str, db: Session = Depends(get_db)):
    session = get_session_or_404(db, session_id)
    scenario = store.get_scenario(session.scenario_id)
    session.status = "created"
    session.started_at = None
    session.ended_at = None
    session.elapsed_seconds = 0
    session.current_step_index = 0
    session.selected_region = None
    session.selected_tool = None
    session.score = 0
    session.completed_step_ids = []
    session.checklist = {key: False for key in
                         {s["checklist_key"] for s in scenario["steps"] if s.get("checklist_key")}}
    session.engine_state = {}
    session.metrics = scoring_engine.compute_metrics({}, scenario, 0, [])
    db.commit()
    await manager.broadcast(session_id, "session.updated", session_state_json(session))
    return session_state(session)


@router.post("/sessions/{session_id}/complete", response_model=SimulationResultOut)
async def complete_session(session_id: str, db: Session = Depends(get_db)):
    session = get_session_or_404(db, session_id)
    if session.status not in ("active", "paused", "completed"):
        raise ApiError(409, "INVALID_STATE_TRANSITION",
                       f"Cannot complete a session in status '{session.status}'.")
    result = simulation_engine.finalize_session(db, session)
    db.commit()
    out = _result_out(result)
    await manager.broadcast(session_id, "scenario.completed", {"final_score": result.final_score,
                                                               "grade": result.grade})
    return out


@router.post("/sessions/{session_id}/abandon", response_model=SessionState)
async def abandon_session(session_id: str, db: Session = Depends(get_db)):
    session = get_session_or_404(db, session_id)
    if session.status in ("completed", "abandoned"):
        raise ApiError(409, "INVALID_STATE_TRANSITION", f"Session is already '{session.status}'.")
    simulation_engine.finalize_session(db, session, abandoned=True)
    db.commit()
    await manager.broadcast(session_id, "session.updated", session_state_json(session))
    return session_state(session)


# ---------- events ----------

@router.post("/sessions/{session_id}/events", response_model=SimulationEventResponse)
async def submit_event(session_id: str, body: SimulationEventRequest, db: Session = Depends(get_db)):
    session = get_session_or_404(db, session_id)
    response = simulation_engine.process_event(db, session, body.model_dump())

    await manager.broadcast(session_id, "session.updated", session_state_json(session))
    if response["step_completed"]:
        await manager.broadcast(session_id, "step.completed", {
            "completed_step_id": response["completed_step_id"], "next_step": response["next_step"]})
        if response["checklist_updates"]:
            await manager.broadcast(session_id, "checklist.updated", session.checklist)
    if body.action == "select_tool":
        await manager.broadcast(session_id, "tool.selected", {"tool_id": session.selected_tool})
    for fb in response["feedback"]:
        await manager.broadcast(session_id, "coach.message", fb)
    await manager.broadcast(session_id, "metrics.updated", session.metrics)
    if any(fb["type"] == "safety" for fb in response["feedback"]):
        await manager.broadcast(session_id, "safety.warning", response["feedback"][-1])
    if response["scenario_completed"]:
        await manager.broadcast(session_id, "scenario.completed", {"final_score": session.score})
    return response


# ---------- coaching ----------

@router.get("/sessions/{session_id}/coach", response_model=list[CoachMessageOut])
def get_coach_messages(session_id: str, limit: int = 50, db: Session = Depends(get_db)):
    get_session_or_404(db, session_id)
    rows = (db.query(CoachMessageRow).filter_by(session_id=session_id)
            .order_by(CoachMessageRow.timestamp.desc()).limit(min(limit, 200)).all())
    return list(reversed(rows))


@router.post("/sessions/{session_id}/coach/hint", response_model=HintResponse)
async def request_hint(session_id: str, db: Session = Depends(get_db)):
    session = get_session_or_404(db, session_id)
    scenario = store.get_scenario(session.scenario_id)
    step = simulation_engine.current_step(session, scenario)
    if step is None:
        raise ApiError(409, "NO_ACTIVE_STEP", "The scenario has no remaining steps.")
    state = dict(session.engine_state or {})
    state["hints_used"] = state.get("hints_used", 0) + 1
    session.engine_state = state
    penalty = 1.0
    session.score = scoring_engine.clamp(session.score - penalty, 0, 100)
    simulation_engine.refresh_metrics(session, scenario)
    hint = step.get("hint") or step["instruction"]
    coaching_engine.make_message(db, session_id, "HINT_USED", step["id"], message=hint,
                                 suggested_action=step["required_action"])
    db.commit()
    await manager.broadcast(session_id, "coach.message",
                            {"type": "hint", "code": "HINT_USED", "message": hint})
    return {"message": hint, "related_step_id": step["id"], "penalty": penalty}


@router.post("/coach/generate", response_model=CoachGenerateResponse)
async def generate_coach_feedback(body: CoachGenerateRequest):
    """Generates AI feedback and TTS audio based on a rule message and metrics."""
    ai = coaching_engine.AsyncAIAssistant()
    ai_message = await ai.generate_ai_feedback(body.message, body.metrics)
    
    audio_data = None
    if ai_message:
        audio_data = await ai.generate_tts_audio(ai_message)
    else:
        # Fallback to the original rule-based message if AI fails
        audio_data = await ai.generate_tts_audio(body.message)
        
    return {"ai_message": ai_message, "audio_data": audio_data}


# ---------- vision metrics ----------

@router.post("/sessions/{session_id}/vision-metrics")
async def submit_vision_metrics(session_id: str, body: VisionMetricsRequest, db: Session = Depends(get_db)):
    session = get_session_or_404(db, session_id)
    if session.status != "active":
        raise ApiError(409, "SESSION_NOT_ACTIVE", "Vision metrics require an active session.")
    state = dict(session.engine_state or {})
    for key in ("entry_error_mm", "exit_error_mm", "path_length_px", "ideal_path_length_px"):
        value = getattr(body, key)
        if value is not None:
            state[key] = value
    if body.position_variance is not None:
        state.setdefault("variance_samples", []).append(min(body.position_variance, 10))
    if body.safety_zone_entered:
        state.setdefault("safety_penalties", []).append(simulation_engine.SAFETY_PENALTIES["safety_zone"])
        coaching_engine.make_message(db, session_id, "SAFETY_ZONE")
        await manager.broadcast(session_id, "safety.warning",
                                {"code": "SAFETY_ZONE", "message": store.coach_rules["SAFETY_ZONE"]["message"]})
    session.engine_state = state
    simulation_engine.refresh_metrics(session, store.get_scenario(session.scenario_id))
    db.commit()
    await manager.broadcast(session_id, "metrics.updated", session.metrics)
    await manager.broadcast(session_id, "vision.updated",
                            {"tracking_confidence": body.tracking_confidence,
                             "tool_tip": body.tool_tip.model_dump() if body.tool_tip else None})
    return {"accepted": True, "metrics": session.metrics}


# ---------- trajectory ----------

@router.post("/sessions/{session_id}/trajectory")
def submit_trajectory(session_id: str, body: TrajectoryBatchRequest, db: Session = Depends(get_db)):
    session = get_session_or_404(db, session_id)
    existing = db.query(TrajectoryPoint).filter_by(session_id=session_id).count()
    budget = max(0, settings.max_trajectory_points - existing)
    points = body.points
    if len(points) > budget:
        points = points[:: max(1, len(points) // max(budget, 1))][:budget]  # downsample
    for p in points:
        db.add(TrajectoryPoint(session_id=session.id, timestamp_ms=p.timestamp_ms, x=p.x, y=p.y,
                               z=p.z, confidence=p.confidence, tool_id=p.tool_id))
    db.commit()
    return {"accepted": True, "stored": len(points),
            "downsampled": len(points) < len(body.points),
            "total_points": existing + len(points)}


@router.get("/sessions/{session_id}/trajectory", response_model=TrajectoryResponse)
def get_trajectory(session_id: str, db: Session = Depends(get_db)):
    get_session_or_404(db, session_id)
    rows = (db.query(TrajectoryPoint).filter_by(session_id=session_id)
            .order_by(TrajectoryPoint.timestamp_ms).all())
    return {"session_id": session_id, "point_count": len(rows),
            "points": [{"timestamp_ms": r.timestamp_ms, "x": r.x, "y": r.y, "z": r.z,
                        "confidence": r.confidence, "tool_id": r.tool_id} for r in rows]}


# ---------- per-session result ----------

@router.get("/sessions/{session_id}/results", response_model=SimulationResultOut)
def get_session_result(session_id: str, db: Session = Depends(get_db)):
    get_session_or_404(db, session_id)
    result = db.query(SimulationResult).filter_by(session_id=session_id).one_or_none()
    if not result:
        raise ApiError(404, "RESULT_NOT_FOUND", "The session has not been completed yet.")
    return _result_out(result)
