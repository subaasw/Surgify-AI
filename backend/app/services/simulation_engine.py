"""Deterministic simulation state machine.

Functional core / imperative shell: rule evaluation and verdict computation are
pure functions over immutable inputs (they return new state instead of mutating);
`process_event` / `finalize_session` are the thin imperative edge that persists
the outcome and owns score, step progression, checklist, and safety status.
The frontend only submits events and receives verdicts.
"""
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import SimulationEvent, SimulationResult, SimulationSession
from . import coaching_engine, scoring_engine
from .data_store import ApiError, store

# Actions that never advance a step but are always legal while active.
FREE_ACTIONS = frozenset({"camera_change", "update_tool_pose", "ask_patient", "review_patient",
                          "select_tool", "deselect_tool", "safety_violation", "inspect"})

SUPPORTED_ACTIONS = FREE_ACTIONS | {
    "select_body_region", "check_pulse", "check_sensation", "check_movement",
    "apply_gloves", "clean_training_area", "apply_drape", "position_tool",
    "begin_stitch", "advance_needle", "reach_exit", "pull_suture",
    "knot_action", "cut_suture", "complete_step",
}

SAFETY_PENALTIES = {"wrong_region": 15, "safety_zone": 20, "skipped_check": 10, "wrong_tool": 5}

MEASUREMENT_KEYS = ("entry_error_mm", "exit_error_mm", "path_length_px", "ideal_path_length_px")


# ---------------------------------------------------------------------------
# Pure functional core
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Verdict:
    """The complete outcome of one event, computed without side effects."""
    accepted: bool = True
    step_completed: bool = False
    score_delta: float = 0.0
    feedback_code: str | None = None
    feedback: tuple[dict, ...] = ()
    state: dict = field(default_factory=dict)
    selected_region: str | None = None
    coach_notes: tuple[tuple[str, str | None, str | None], ...] = ()  # (code, step_id, suggested_action)


def current_step(session: SimulationSession, scenario: dict) -> dict | None:
    steps = scenario["steps"]
    return steps[session.current_step_index] if session.current_step_index < len(steps) else None


def _field_value(name: str, event: dict, ctx: dict) -> object:
    if name in ctx:
        return ctx[name]
    return event.get(name) or event.get("metadata", {}).get(name)


def _compare(left: object, operator: str, right: object) -> bool:
    try:
        if operator in ("equals", "=="):
            return left == right
        if left is None:
            return False
        lv, rv = float(left), float(right)  # type: ignore[arg-type]
        return {"<=": lv <= rv, "<": lv < rv, ">=": lv >= rv, ">": lv > rv}[operator]
    except (TypeError, ValueError, KeyError):
        return False


def evaluate_rule(rule: dict, event: dict, ctx: dict, state: dict, step_id: str) -> tuple[bool, dict]:
    """Pure: returns (matched, new_state). Never mutates its inputs."""
    rtype = rule.get("type")

    if rtype == "exact_action":
        if event["action"] != rule["action"]:
            return False, state
        target = rule.get("target")
        matched = target is None or target in (event.get("target"), event.get("body_region"))
        return matched, state

    if rtype == "tool_selected":
        return event["action"] == "select_tool" and event.get("tool_id") == rule["tool_id"], state

    if rtype == "metric_threshold":
        value = event.get("metadata", {}).get(rule["metric"], state.get(rule["metric"]))
        return _compare(value, rule["operator"], rule["value"]), state

    if rtype == "ordered_actions":
        expected = rule["actions"]
        progress = state.get("ordered_progress", {}).get(step_id, 0)
        key = event.get("target") or event.get("metadata", {}).get("throw") or event["action"]
        if progress < len(expected) and key == expected[progress]:
            new_state = {**state, "ordered_progress": {**state.get("ordered_progress", {}),
                                                       step_id: progress + 1}}
            return progress + 1 >= len(expected), new_state
        return False, state

    if rtype == "all_conditions":
        matched = all(_compare(_field_value(c["field"], event, ctx), c["operator"], c["value"])
                      for c in rule["conditions"])
        return matched, state

    return False, state


def _bump(state: dict, counter: str, penalty: str | None = None) -> dict:
    new_state = {**state, counter: state.get(counter, 0) + 1}
    if penalty:
        new_state["safety_penalties"] = state.get("safety_penalties", []) + [SAFETY_PENALTIES[penalty]]
    return new_state


def _feedback(code: str) -> dict:
    rule = store.coach_rules[code]
    return {"type": rule["type"], "code": code, "message": rule["message"]}


def _success_code(event: dict) -> str:
    if event["action"] == "select_body_region":
        return "CORRECT_REGION"
    if event.get("tool_id") == "needle_holder":
        return "NEEDLE_HOLDER_SELECTED"
    if event["action"] == "select_tool":
        return "TOOL_SELECTED"
    return "STEP_COMPLETED"


def absorb_measurements(state: dict, metadata: dict) -> dict:
    """Pure: fold raw measurement samples from event metadata into engine state."""
    new_state = dict(state)
    for key in MEASUREMENT_KEYS:
        if isinstance(metadata.get(key), (int, float)):
            new_state[key] = scoring_engine.clamp(float(metadata[key]), 0, 10000)
    if isinstance(metadata.get("position_variance"), (int, float)):
        sample = scoring_engine.clamp(float(metadata["position_variance"]), 0, 10)
        new_state["variance_samples"] = state.get("variance_samples", []) + [sample]
    return new_state


def _wrong_tool_verdict(state: dict, step: dict) -> Verdict:
    return Verdict(
        accepted=False,
        state=_bump(state, "wrong_tool", "wrong_tool"),
        feedback_code="WRONG_TOOL",
        feedback=(_feedback("WRONG_TOOL"),),
        coach_notes=(("WRONG_TOOL", step["id"], f"select_tool:{step.get('required_tool')}"),),
    )


def _rejection_verdict(state: dict, scenario: dict, completed_ids: list[str],
                       step: dict | None, action: str) -> Verdict:
    assessment_pending = any(s["phase"] == "assess" and s["id"] not in completed_ids
                             for s in scenario["steps"])
    code = ("ASSESSMENT_FIRST"
            if assessment_pending and action in ("begin_stitch", "advance_needle", "position_tool")
            else "OUT_OF_ORDER")
    return Verdict(
        accepted=False,
        state=_bump(state, "out_of_order"),
        feedback_code=code,
        feedback=(_feedback(code),),
        coach_notes=((code, step["id"] if step else None, None),),
    )


def judge_event(event: dict, scenario: dict, step: dict | None, ctx: dict, state: dict) -> Verdict:
    """Pure: decide the outcome of one event given the current step and engine state."""
    action = event["action"]
    matched, state = (False, state) if step is None else \
        evaluate_rule(step["completion_rule"], event, ctx, state, step["id"])

    # a matched non-selection action still requires the step's named tool in hand
    if matched and step is not None:
        required_tool = step.get("required_tool")
        if required_tool and action != "select_tool" and ctx.get("selected_tool") != required_tool:
            return _wrong_tool_verdict(state, step)

    if matched and step is not None:
        code = _success_code(event)
        return Verdict(
            accepted=True, step_completed=True, score_delta=float(step["score_value"]),
            state=state, feedback_code=code, feedback=(_feedback(code),),
            selected_region=(event.get("target") or event.get("body_region")
                             if action == "select_body_region" else ctx.get("selected_region")),
            coach_notes=((code, step["id"], None),),
        )

    # --- not matched ---
    if action == "safety_violation":
        return Verdict(
            state={**state, "safety_penalties": state.get("safety_penalties", [])
                   + [SAFETY_PENALTIES["safety_zone"]]},
            feedback_code="SAFETY_ZONE", feedback=(_feedback("SAFETY_ZONE"),),
            coach_notes=(("SAFETY_ZONE", step["id"] if step else None, None),),
        )

    if action == "select_body_region" and step is not None:
        return Verdict(
            accepted=False, state=_bump(state, "out_of_order", "wrong_region"),
            feedback_code="WRONG_REGION", feedback=(_feedback("WRONG_REGION"),),
            selected_region=None,
            coach_notes=(("WRONG_REGION", step["id"], None),),
        )

    if action in FREE_ACTIONS:
        if (action == "select_tool" and step is not None and step.get("required_tool")
                and step.get("allowed_tools") and event.get("tool_id") not in step["allowed_tools"]):
            return Verdict(
                state=_bump(state, "wrong_tool"), feedback_code="WRONG_TOOL",
                feedback=(_feedback("WRONG_TOOL"),),
                coach_notes=(("WRONG_TOOL", step["id"], None),),
                selected_region=ctx.get("selected_region"),
            )
        return Verdict(state=state, selected_region=ctx.get("selected_region"))

    if step is not None and action == step.get("required_action"):
        if step.get("required_tool") and ctx.get("selected_tool") != step["required_tool"]:
            return _wrong_tool_verdict(state, step)
        if step["completion_rule"].get("type") == "ordered_actions":
            return Verdict(state=state, feedback_code="KNOT_PROGRESS",
                           feedback=(_feedback("KNOT_PROGRESS"),),
                           selected_region=ctx.get("selected_region"))
        return Verdict(accepted=False, state=state, feedback_code="MOVE_CLOSER",
                       feedback=(_feedback("MOVE_CLOSER"),),
                       selected_region=ctx.get("selected_region"))

    return _rejection_verdict(state, scenario, ctx.get("completed_step_ids", []), step, action)


def normalize_event(payload: dict) -> dict:
    """Pure: map frontend display labels to canonical snake_case ids."""
    return {
        **payload,
        "target": store.normalize_region(payload.get("target")) or payload.get("target"),
        "body_region": store.normalize_region(payload.get("body_region")) or payload.get("body_region"),
        "tool_id": store.normalize_tool(payload.get("tool_id")) or payload.get("tool_id"),
    }


# ---------------------------------------------------------------------------
# Imperative shell (persistence + side effects)
# ---------------------------------------------------------------------------

def refresh_metrics(session: SimulationSession, scenario: dict) -> None:
    session.metrics = scoring_engine.compute_metrics(
        session.engine_state, scenario, session.elapsed_seconds, session.completed_step_ids)


def _record_event(db: Session, session: SimulationSession, event: dict, verdict: Verdict) -> None:
    db.add(SimulationEvent(
        id=f"evt_{uuid.uuid4().hex[:12]}",
        session_id=session.id,
        timestamp=datetime.now(timezone.utc),
        elapsed_ms=event.get("elapsed_ms", 0),
        event_type=event.get("event_type", "interaction"),
        action=event["action"],
        target=event.get("target"),
        tool_id=event.get("tool_id"),
        body_region=event.get("body_region"),
        meta=event.get("metadata", {}),
        accepted=verdict.accepted,
        score_delta=verdict.score_delta,
        feedback_code=verdict.feedback_code,
    ))


def process_event(db: Session, session: SimulationSession, payload: dict) -> dict:
    """Apply one event: judge it with the pure core, then persist the outcome."""
    if session.status != "active":
        raise ApiError(409, "SESSION_NOT_ACTIVE",
                       f"Session status is '{session.status}'. Start or resume it before sending events.",
                       {"status": session.status})

    event = normalize_event(payload)
    if event["action"] not in SUPPORTED_ACTIONS:
        raise ApiError(400, "UNSUPPORTED_ACTION", f"Action '{event['action']}' is not supported.",
                       {"supported": sorted(SUPPORTED_ACTIONS)})

    scenario = store.get_scenario(session.scenario_id)
    step = current_step(session, scenario)

    # tool selection bookkeeping happens before judging so tool_selected rules see it
    if event["action"] == "select_tool" and event.get("tool_id"):
        session.selected_tool = event["tool_id"]
    elif event["action"] == "deselect_tool":
        session.selected_tool = None

    ctx = {
        "selected_tool": session.selected_tool,
        "selected_region": session.selected_region,
        "camera_mode": session.camera_mode,
        "completed_step_ids": list(session.completed_step_ids),
    }
    verdict = judge_event(event, scenario, step, ctx, dict(session.engine_state or {}))

    # --- persist outcome ---
    session.elapsed_seconds = max(session.elapsed_seconds, event.get("elapsed_ms", 0) // 1000)
    if event["action"] == "camera_change":
        session.camera_mode = event.get("metadata", {}).get(
            "camera_mode", event.get("target") or session.camera_mode)
    if event["action"] == "select_body_region":
        session.selected_region = verdict.selected_region
    session.engine_state = absorb_measurements(verdict.state, event.get("metadata", {}))
    session.score = scoring_engine.clamp(session.score + verdict.score_delta, 0, 100)

    checklist_updates: dict[str, bool] = {}
    completed_step_id = None
    scenario_completed = False
    if verdict.step_completed and step is not None:
        completed_step_id = step["id"]
        session.completed_step_ids = session.completed_step_ids + [step["id"]]
        session.current_step_index += 1
        if step.get("checklist_key"):
            session.checklist = {**session.checklist, step["checklist_key"]: True}
            checklist_updates[step["checklist_key"]] = True
        scenario_completed = session.current_step_index >= len(scenario["steps"])

    refresh_metrics(session, scenario)
    _record_event(db, session, event, verdict)
    for code, step_id, suggested in verdict.coach_notes:
        coaching_engine.make_message(db, session.id, code, step_id, suggested_action=suggested)

    feedback = list(verdict.feedback)
    if scenario_completed:
        finalize_session(db, session, scenario)
        coaching_engine.make_message(db, session.id, "SCENARIO_COMPLETE")
        feedback.append(_feedback("SCENARIO_COMPLETE"))

    db.commit()

    next_step = current_step(session, scenario)
    return {
        "accepted": verdict.accepted,
        "score_delta": verdict.score_delta,
        "current_score": session.score,
        "step_completed": verdict.step_completed,
        "completed_step_id": completed_step_id,
        "next_step": None if next_step is None else {
            "id": next_step["id"], "title": next_step["title"], "instruction": next_step["instruction"]},
        "checklist_updates": checklist_updates,
        "feedback": feedback,
        "scenario_completed": scenario_completed,
    }


def finalize_session(db: Session, session: SimulationSession, scenario: dict | None = None,
                     abandoned: bool = False) -> SimulationResult:
    scenario = scenario or store.get_scenario(session.scenario_id)
    session.status = "abandoned" if abandoned else "completed"
    session.ended_at = datetime.now(timezone.utc)
    refresh_metrics(session, scenario)

    metrics = session.metrics
    final = scoring_engine.weighted_final_score(metrics, scenario["scoring_weights"])
    session.score = final

    missed = [s["title"] for s in scenario["steps"] if s["id"] not in session.completed_step_ids]
    critical = [s["title"] for s in scenario["steps"]
                if s.get("safety_critical") and s["id"] not in session.completed_step_ids]
    if SAFETY_PENALTIES["safety_zone"] in session.engine_state.get("safety_penalties", []):
        critical.append("Entered a marked safety zone")

    strengths, improvements, summary = coaching_engine.build_summary(metrics, critical, missed)

    events = db.query(SimulationEvent).filter_by(session_id=session.id).order_by(SimulationEvent.elapsed_ms).all()
    timeline = [{
        "timestamp": e.timestamp.isoformat(), "elapsed_ms": e.elapsed_ms, "action": e.action,
        "target": e.target, "tool_id": e.tool_id, "accepted": e.accepted,
        "score_delta": e.score_delta, "feedback_code": e.feedback_code,
    } for e in events]

    existing = db.query(SimulationResult).filter_by(session_id=session.id).one_or_none()
    result = existing or SimulationResult(id=f"result_{uuid.uuid4().hex[:10]}", session_id=session.id)
    result.scenario_id = scenario["id"]
    result.final_score = final
    result.grade = scoring_engine.grade_for(final)
    result.metrics = metrics
    result.strengths = strengths
    result.improvements = improvements
    result.missed_actions = missed
    result.critical_errors = critical
    result.event_timeline = timeline
    result.coach_summary = summary
    result.completed_at = session.ended_at
    if not existing:
        db.add(result)
    return result
