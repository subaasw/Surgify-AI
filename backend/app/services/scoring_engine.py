"""Transparent weighted scoring. All metrics are 0-100 educational scores."""

ACCURACY_THRESHOLDS = [(2, 100), (5, 90), (8, 75), (12, 55)]  # (max_error_mm, score); beyond last -> 30

GRADES = [(90, "Excellent"), (80, "Good Progress"), (70, "Developing"), (55, "Needs Practice"), (0, "Keep Training")]


def clamp(v: float, lo: float = 0, hi: float = 100) -> float:
    return max(lo, min(hi, v))


def error_mm_to_score(error_mm: float | None, default: float = 85.0) -> float:
    if error_mm is None:
        return default
    for max_err, score in ACCURACY_THRESHOLDS:
        if error_mm <= max_err:
            return score
    return 30


def stability_score(position_variances: list[float], default: float = 80.0) -> float:
    if not position_variances:
        return default
    avg = sum(position_variances) / len(position_variances)
    # ponytail: linear map, variance 0 -> 100, variance 0.5+ -> 20; tune if real vision data arrives
    return clamp(100 - avg * 160, 20, 100)


def motion_efficiency_score(path_px: float | None, ideal_px: float | None, default: float = 78.0) -> float:
    if not path_px or not ideal_px:
        return default
    return clamp((ideal_px / path_px) * 100)


def completion_time_score(elapsed_seconds: int, estimated_minutes: int) -> float:
    if elapsed_seconds <= 0:
        return 80
    ratio = elapsed_seconds / (estimated_minutes * 60)
    if ratio <= 1.0:
        return 100
    return clamp(100 - (ratio - 1.0) * 60, 30, 100)


def compute_metrics(state: dict, scenario: dict, elapsed_seconds: int, completed_step_ids: list[str]) -> dict:
    """state = session.engine_state scratch dict maintained by the simulation engine."""
    steps = scenario["steps"]
    assess_steps = [s["id"] for s in steps if s.get("metric_category") == "patient_assessment"]
    done_assess = len([s for s in assess_steps if s in completed_step_ids])
    assessment = 100 * done_assess / len(assess_steps) if assess_steps else 100

    sequence = clamp(100 - 5 * state.get("out_of_order", 0) - 2 * state.get("hints_used", 0))
    instruments = clamp(100 - 12 * state.get("wrong_tool", 0))
    entry = error_mm_to_score(state.get("entry_error_mm"))
    exit_ = error_mm_to_score(state.get("exit_error_mm"), default=80.0)
    stability = stability_score(state.get("variance_samples", []))
    efficiency = motion_efficiency_score(state.get("path_length_px"), state.get("ideal_path_length_px"))
    safety = clamp(100 - sum(state.get("safety_penalties", [])))
    time_score = completion_time_score(elapsed_seconds, scenario["estimated_minutes"])

    return {
        "patient_assessment": round(clamp(assessment), 1),
        "procedure_sequence": round(sequence, 1),
        "instrument_selection": round(instruments, 1),
        "entry_accuracy": round(entry, 1),
        "exit_accuracy": round(exit_, 1),
        "tool_stability": round(stability, 1),
        "motion_efficiency": round(efficiency, 1),
        "safety": round(safety, 1),
        "completion_time_score": round(time_score, 1),
    }


def weighted_final_score(metrics: dict, weights: dict) -> float:
    total = 0.0
    for key, weight in weights.items():
        metric_key = "completion_time_score" if key == "completion_time" else key
        total += metrics.get(metric_key, 0) * weight
    return round(clamp(total), 1)


def grade_for(score: float) -> str:
    return next(label for threshold, label in GRADES if score >= threshold)
