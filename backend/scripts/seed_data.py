"""Create tables and seed a demo user + one polished completed demo session/result.

Usage: python -m scripts.seed_data
"""
import uuid
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal, init_db
from app.models import SimulationResult, SimulationSession, User
from app.services.data_store import store


def seed() -> None:
    init_db()
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        if db.query(User).filter_by(id="user_guest").one_or_none():
            print("Seed data already present — nothing to do.")
            return

        db.add(User(id="user_guest", display_name="Guest Trainee", is_guest=True))

        scenario = store.get_scenario("scenario_forearm_laceration")
        session_id = f"session_{uuid.uuid4().hex[:10]}"
        metrics = {
            "patient_assessment": 90, "procedure_sequence": 84, "instrument_selection": 95,
            "entry_accuracy": 78, "exit_accuracy": 72, "tool_stability": 80,
            "motion_efficiency": 76, "safety": 92, "completion_time_score": 81,
        }
        db.add(SimulationSession(
            id=session_id, scenario_id=scenario["id"], user_id="user_guest", mode="demo",
            status="completed", started_at=now - timedelta(minutes=14), ended_at=now,
            elapsed_seconds=680, current_step_index=len(scenario["steps"]),
            selected_region="right_forearm", selected_tool="surgical_scissors",
            camera_mode="closeup", score=82,
            completed_step_ids=[s["id"] for s in scenario["steps"]],
            checklist={k: True for s in scenario["steps"] if (k := s.get("checklist_key"))},
            metrics=metrics, engine_state={},
        ))
        db.add(SimulationResult(
            id=f"result_{uuid.uuid4().hex[:10]}", session_id=session_id,
            scenario_id=scenario["id"], final_score=82, grade="Good Progress", metrics=metrics,
            strengths=["Correct instrument selection", "Strong safety awareness",
                       "Complete patient assessment"],
            improvements=["Improve exit-point accuracy", "Reduce unnecessary tool movement"],
            missed_actions=[], critical_errors=[], event_timeline=[],
            coach_summary=("You completed the simulation safely and followed the expected sequence. "
                           "Focus next on smoother tool movement and improved exit-point placement."),
            completed_at=now,
        ))
        db.commit()
        print(f"Seeded guest user and demo result (session {session_id}).")


if __name__ == "__main__":
    seed()
