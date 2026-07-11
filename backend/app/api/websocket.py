"""WebSocket channel: /ws/sessions/{session_id}."""
import asyncio
import contextlib
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..config import get_settings
from ..database import SessionLocal
from ..models import SimulationSession
from ..services import simulation_engine, vitals
from ..services.data_store import store
from ..services.websocket_manager import manager
from ..services.coaching_engine import ai_assistant
from .sessions import session_state_json

router = APIRouter()
settings = get_settings()

_latest_vitals: dict[str, dict] = {}


async def _vitals_loop(session_id: str) -> None:
    while manager.has_listeners(session_id):
        with SessionLocal() as db:
            session = db.get(SimulationSession, session_id)
            if not session or session.status in ("completed", "abandoned"):
                return
            patient = store.get_patient(store.get_scenario(session.scenario_id)["patient_id"])
            active = session.status == "active"
        if patient["vital_signs"]["heart_rate"] and active:
            current = _latest_vitals.get(session_id, patient["vital_signs"])
            current = vitals.next_vitals(current)
            _latest_vitals[session_id] = current
            await manager.broadcast(session_id, "vitals.updated", current)
        await asyncio.sleep(settings.vitals_interval_seconds)


def _envelope(ws_type: str, session_id: str, payload: dict) -> dict:
    return {"type": ws_type, "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(), "payload": payload}


async def generate_and_send_ai_coach_message(session_id: str, feedback_item: dict, metrics: dict):
    """Background task to generate AI message and TTS, then broadcast."""
    rule_msg = feedback_item.get("message", "")
    if not rule_msg:
        return
        
    ai_msg = await ai_assistant.generate_ai_feedback(metrics, rule_msg)
    if not ai_msg:
        return  # Ollama/model not set up — skip AI coach message and voice entirely

    audio_data = await ai_assistant.generate_tts_audio(ai_msg)

    # Update the feedback item with AI enhancements
    enhanced_fb = dict(feedback_item)
    enhanced_fb["ai_message"] = ai_msg
    enhanced_fb["audio_data"] = audio_data

    await manager.broadcast(session_id, "coach.ai_message", enhanced_fb)


@router.websocket("/ws/sessions/{session_id}")
async def session_channel(websocket: WebSocket, session_id: str):
    with SessionLocal() as db:
        exists = db.get(SimulationSession, session_id) is not None
    if not exists:
        await websocket.close(code=4404, reason="Unknown session")
        return

    await manager.connect(session_id, websocket)
    vitals_task = asyncio.create_task(_vitals_loop(session_id))
    try:
        while True:
            message = await websocket.receive_json()
            mtype = message.get("type")
            payload = message.get("payload", {})

            if mtype == "ping":
                await websocket.send_json(_envelope("pong", session_id, {}))

            elif mtype == "subscribe":
                with SessionLocal() as db:
                    session = db.get(SimulationSession, session_id)
                    await websocket.send_json(_envelope("session.updated", session_id,
                                                        session_state_json(session)))

            elif mtype == "session.event":
                with SessionLocal() as db:
                    session = db.get(SimulationSession, session_id)
                    try:
                        response = simulation_engine.process_event(db, session, payload)
                        await manager.broadcast(session_id, "session.updated", session_state_json(session))
                        for fb in response["feedback"]:
                            await manager.broadcast(session_id, "coach.message", fb)
                            asyncio.create_task(
                                generate_and_send_ai_coach_message(
                                    session_id, fb, session.metrics.model_dump() if session.metrics else {}
                                )
                            )
                        if response["step_completed"]:
                            await manager.broadcast(session_id, "step.completed", {
                                "completed_step_id": response["completed_step_id"],
                                "next_step": response["next_step"]})
                        await websocket.send_json(_envelope("session.updated", session_id, response))
                    except Exception as exc:  # invalid action / inactive session
                        detail = getattr(exc, "detail", {"code": "EVENT_ERROR", "message": str(exc)})
                        await websocket.send_json(_envelope("error", session_id, detail))

            elif mtype in ("tool.pose", "camera.changed", "vision.metrics"):
                if mtype == "camera.changed":
                    with SessionLocal() as db:
                        session = db.get(SimulationSession, session_id)
                        session.camera_mode = payload.get("camera_mode", session.camera_mode)
                        db.commit()
                await websocket.send_json(_envelope("session.updated", session_id, {"received": mtype}))

            else:
                await websocket.send_json(_envelope("error", session_id,
                                                    {"code": "UNKNOWN_MESSAGE_TYPE",
                                                     "message": f"Unsupported client message '{mtype}'."}))
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(session_id, websocket)
        if not manager.has_listeners(session_id):
            vitals_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await vitals_task
            _latest_vitals.pop(session_id, None)
