"""Pydantic request/response schemas (mirrors frontend-types/surgify-api.ts)."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from .config import DISCLAIMER


# ---------- common ----------

class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = {}
    request_id: str


class ErrorEnvelope(BaseModel):
    error: ErrorBody


# ---------- scenario ----------

class ScenarioStepOut(BaseModel):
    id: str
    order: int
    phase: str
    title: str
    instruction: str
    hint: str | None = None
    required_action: str
    required_target: str | None = None
    required_tool: str | None = None
    allowed_tools: list[str] = []
    score_value: int
    safety_critical: bool


class ScenarioSummary(BaseModel):
    id: str
    slug: str
    name: str
    short_description: str
    difficulty: str
    estimated_minutes: int
    objectives: list[str]
    body_regions: list[str]
    required_tools: list[str]
    step_count: int
    is_available: bool


class ScenarioDetail(ScenarioSummary):
    full_description: str
    patient_id: str
    scoring_weights: dict[str, float]
    steps: list[ScenarioStepOut]
    disclaimer: str = DISCLAIMER


# ---------- patient ----------

class PatientVitalsOut(BaseModel):
    heart_rate: int
    systolic_bp: int
    diastolic_bp: int
    spo2: int
    respiratory_rate: int
    temperature_c: float


class PatientDialogueOut(BaseModel):
    question_id: str
    question: str


class VirtualPatientOut(BaseModel):
    id: str
    display_name: str
    age: int
    sex: str
    case_id: str
    chief_complaint: str
    mechanism: str
    current_status: str
    allergies: list[str]
    medical_history: list[str]
    vital_signs: PatientVitalsOut
    dialogue: list[PatientDialogueOut]
    disclaimer: str = DISCLAIMER


class PatientQuestionRequest(BaseModel):
    question_id: str


class PatientQuestionResponse(BaseModel):
    question_id: str
    answer: str
    emotion: str = "neutral"
    audio_url: str | None = None


# ---------- instruments ----------

class InstrumentPartOut(BaseModel):
    part_id: str
    label: str
    description: str
    highlight_position: list[float]


class InstrumentOut(BaseModel):
    id: str
    name: str
    frontend_label: str
    category: str
    description: str
    primary_use: str
    grip_zone: str
    active_tip: str
    common_mistakes: list[str]
    model_path: str | None = None
    icon: str | None = None


# ---------- session ----------

class SessionMetricsOut(BaseModel):
    patient_assessment: float = 0
    procedure_sequence: float = 0
    instrument_selection: float = 0
    entry_accuracy: float = 0
    exit_accuracy: float = 0
    tool_stability: float = 0
    motion_efficiency: float = 0
    safety: float = 0
    completion_time_score: float = 0


class SessionCreateRequest(BaseModel):
    scenario_id: str
    user_id: str | None = None
    mode: Literal["virtual_patient", "webcam", "demo"] = "virtual_patient"


class SessionState(BaseModel):
    id: str
    scenario_id: str
    user_id: str | None = None
    mode: str
    status: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    elapsed_seconds: int
    current_step_index: int
    current_step: ScenarioStepOut | None = None
    selected_region: str | None = None
    selected_tool: str | None = None
    camera_mode: str
    score: float
    completed_step_ids: list[str]
    checklist: dict[str, bool]
    metrics: SessionMetricsOut


class SessionCreateResponse(BaseModel):
    session: SessionState
    scenario: ScenarioDetail
    patient: VirtualPatientOut
    available_actions: list[str]
    available_tools: list[InstrumentOut]
    websocket_channel: str
    disclaimer: str = DISCLAIMER


# ---------- events ----------

class SimulationEventRequest(BaseModel):
    event_type: str = "interaction"
    action: str
    target: str | None = None
    tool_id: str | None = None
    body_region: str | None = None
    elapsed_ms: int = Field(default=0, ge=0)
    metadata: dict[str, Any] = {}


class FeedbackItem(BaseModel):
    type: str
    code: str
    message: str


class NextStepOut(BaseModel):
    id: str
    title: str
    instruction: str


class SimulationEventResponse(BaseModel):
    accepted: bool
    score_delta: float
    current_score: float
    step_completed: bool
    completed_step_id: str | None = None
    next_step: NextStepOut | None = None
    checklist_updates: dict[str, bool] = {}
    feedback: list[FeedbackItem] = []
    scenario_completed: bool = False


# ---------- coaching ----------

class CoachMessageOut(BaseModel):
    id: str
    type: str
    code: str
    message: str
    priority: int
    timestamp: datetime
    related_step_id: str | None = None
    suggested_action: str | None = None


class HintResponse(BaseModel):
    message: str
    related_step_id: str | None = None
    penalty: float = 1


# ---------- results ----------

class ResultEventOut(BaseModel):
    timestamp: datetime
    elapsed_ms: int
    action: str
    target: str | None = None
    tool_id: str | None = None
    accepted: bool
    score_delta: float
    feedback_code: str | None = None


class SimulationResultOut(BaseModel):
    result_id: str
    session_id: str
    scenario: dict[str, str]
    final_score: float
    grade: str
    metrics: SessionMetricsOut
    strengths: list[str]
    improvements: list[str]
    missed_actions: list[str]
    critical_errors: list[str]
    event_timeline: list[ResultEventOut]
    coach_summary: str
    completed_at: datetime
    disclaimer: str = DISCLAIMER


# ---------- vision ----------

class BBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class Point2D(BaseModel):
    x: float
    y: float


class Landmark3D(Point2D):
    z: float


class DetectedHand(BaseModel):
    handedness: str
    score: float = Field(ge=0, le=1)
    gesture: str
    gesture_score: float = Field(ge=0, le=1)
    pinch: bool
    pinch_distance: float = Field(ge=0)
    pointer: Point2D
    landmarks: list[Landmark3D]


class DetectedTool(BaseModel):
    class_id: str
    confidence: float
    bbox: BBox
    tip: Point2D | None = None


class VisionFrameResult(BaseModel):
    frame_id: str
    session_id: str | None = None
    processed: bool
    mode: str
    tracking_confidence: float
    hands: list[DetectedHand] = []
    tools: list[DetectedTool] = []
    metrics: dict[str, float] = {}
    warnings: list[str] = []


class VisionMetricsRequest(BaseModel):
    timestamp_ms: int = Field(ge=0)
    tracking_confidence: float = Field(default=1.0, ge=0, le=1)
    tool_tip: Point2D | None = None
    tool_angle_deg: float | None = Field(default=None, ge=-360, le=360)
    entry_error_mm: float | None = Field(default=None, ge=0, le=100)
    exit_error_mm: float | None = Field(default=None, ge=0, le=100)
    path_length_px: float | None = Field(default=None, ge=0)
    ideal_path_length_px: float | None = Field(default=None, ge=0)
    position_variance: float | None = Field(default=None, ge=0)
    safety_zone_entered: bool = False


# ---------- trajectory ----------

class TrajectoryPointIn(BaseModel):
    timestamp_ms: int = Field(ge=0)
    x: float
    y: float
    z: float | None = None
    confidence: float = Field(default=1.0, ge=0, le=1)
    tool_id: str = "needle_holder"


class TrajectoryBatchRequest(BaseModel):
    points: list[TrajectoryPointIn] = Field(max_length=2000)


class TrajectoryResponse(BaseModel):
    session_id: str
    point_count: int
    points: list[TrajectoryPointIn]


# ---------- anatomy ----------

class AnatomyStructureOut(BaseModel):
    id: str
    name: str
    category: str
    model_node_name: str
    description: str
    default_visible: bool


class AnatomyRegionOut(BaseModel):
    id: str
    name: str
    frontend_label: str
    selectable: bool
    structures: list[AnatomyStructureOut]
    disclaimer: str = "Educational visualization only. Not intended for diagnosis or procedure planning."
