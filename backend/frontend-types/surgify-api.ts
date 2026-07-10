/**
 * Surgify AI backend API types — copy this file into the frontend.
 * Base URL: NEXT_PUBLIC_SURGIFY_API_URL (default http://localhost:8000/api/v1)
 * WebSocket: NEXT_PUBLIC_SURGIFY_WS_URL (default ws://localhost:8000) + `/ws/sessions/{sessionId}`
 *
 * All ids are canonical snake_case (e.g. "right_forearm", "needle_holder"), but the
 * backend also accepts the frontend's display labels ("Right arm", "Needle holder")
 * in event payloads and instrument lookups.
 */

// ---------- scenarios ----------

export interface ScenarioSummary {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimated_minutes: number;
  objectives: string[];
  body_regions: string[];
  required_tools: string[];
  step_count: number;
  is_available: boolean;
}

export interface ScenarioStep {
  id: string;
  order: number;
  /** Maps to the frontend's 7 procedure phases: review | identify | assess | prepare | instruments | suture | complete */
  phase: string;
  title: string;
  instruction: string;
  hint: string | null;
  required_action: string;
  required_target: string | null;
  required_tool: string | null;
  allowed_tools: string[];
  score_value: number;
  safety_critical: boolean;
}

export interface ScenarioDetail extends ScenarioSummary {
  full_description: string;
  patient_id: string;
  scoring_weights: Record<string, number>;
  steps: ScenarioStep[];
  disclaimer: string;
}

// ---------- patient ----------

export interface PatientVitals {
  heart_rate: number;
  systolic_bp: number;
  diastolic_bp: number;
  spo2: number;
  respiratory_rate: number;
  temperature_c: number;
}

export interface PatientDialogueQuestion {
  question_id: string;
  question: string;
}

export interface VirtualPatient {
  id: string;
  display_name: string;
  age: number;
  sex: string;
  case_id: string;
  chief_complaint: string;
  mechanism: string;
  current_status: string;
  allergies: string[];
  medical_history: string[];
  vital_signs: PatientVitals;
  dialogue: PatientDialogueQuestion[];
  disclaimer: string;
}

export interface PatientQuestionResponse {
  question_id: string;
  answer: string;
  emotion: string;
  audio_url: string | null;
}

// ---------- instruments ----------

export interface InstrumentPart {
  part_id: string;
  label: string;
  description: string;
  highlight_position: [number, number, number];
}

export interface Instrument {
  id: string;
  name: string;
  /** Display label already used by the frontend toolbar, e.g. "Needle holder" */
  frontend_label: string;
  category: string;
  description: string;
  primary_use: string;
  grip_zone: string;
  active_tip: string;
  common_mistakes: string[];
  model_path: string | null;
  icon: string | null;
}

// ---------- sessions ----------

export type SessionStatus = "created" | "active" | "paused" | "completed" | "abandoned";
export type SessionMode = "virtual_patient" | "webcam" | "demo";

export interface SessionMetrics {
  patient_assessment: number;
  procedure_sequence: number;
  instrument_selection: number;
  entry_accuracy: number;
  exit_accuracy: number;
  tool_stability: number;
  motion_efficiency: number;
  safety: number;
  completion_time_score: number;
}

export interface SimulationSession {
  id: string;
  scenario_id: string;
  user_id: string | null;
  mode: SessionMode;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  elapsed_seconds: number;
  current_step_index: number;
  current_step: ScenarioStep | null;
  selected_region: string | null;
  selected_tool: string | null;
  camera_mode: string;
  score: number;
  completed_step_ids: string[];
  checklist: Record<string, boolean>;
  metrics: SessionMetrics;
}

export interface SessionCreateResponse {
  session: SimulationSession;
  scenario: ScenarioDetail;
  patient: VirtualPatient;
  available_actions: string[];
  available_tools: Instrument[];
  websocket_channel: string;
  disclaimer: string;
}

// ---------- events ----------

export type SimulationAction =
  | "review_patient" | "ask_patient" | "select_body_region" | "select_tool" | "deselect_tool"
  | "inspect" | "check_pulse" | "check_sensation" | "check_movement"
  | "apply_gloves" | "clean_training_area" | "apply_drape"
  | "position_tool" | "update_tool_pose" | "begin_stitch" | "advance_needle" | "reach_exit"
  | "pull_suture" | "knot_action" | "cut_suture" | "complete_step"
  | "camera_change" | "safety_violation";

export interface SimulationEventRequest {
  event_type?: string;
  action: SimulationAction;
  target?: string | null;
  tool_id?: string | null;
  body_region?: string | null;
  elapsed_ms?: number;
  metadata?: Record<string, unknown>;
}

export interface FeedbackItem {
  type: "instruction" | "hint" | "success" | "warning" | "error" | "safety" | "summary";
  code: string;
  message: string;
}

export interface SimulationEventResponse {
  accepted: boolean;
  score_delta: number;
  current_score: number;
  step_completed: boolean;
  completed_step_id: string | null;
  next_step: { id: string; title: string; instruction: string } | null;
  checklist_updates: Record<string, boolean>;
  feedback: FeedbackItem[];
  scenario_completed: boolean;
}

// ---------- coaching ----------

export interface CoachMessage {
  id: string;
  type: FeedbackItem["type"];
  code: string;
  message: string;
  priority: number;
  timestamp: string;
  related_step_id: string | null;
  suggested_action: string | null;
}

export interface HintResponse {
  message: string;
  related_step_id: string | null;
  penalty: number;
}

// ---------- results ----------

export interface ResultEvent {
  timestamp: string;
  elapsed_ms: number;
  action: string;
  target: string | null;
  tool_id: string | null;
  accepted: boolean;
  score_delta: number;
  feedback_code: string | null;
}

export interface SimulationResult {
  result_id: string;
  session_id: string;
  scenario: { id: string; name: string };
  final_score: number;
  grade: string;
  metrics: SessionMetrics;
  strengths: string[];
  improvements: string[];
  missed_actions: string[];
  critical_errors: string[];
  event_timeline: ResultEvent[];
  coach_summary: string;
  completed_at: string;
  disclaimer: string;
}

// ---------- vision ----------

export interface VisionFrameResult {
  frame_id: string;
  session_id: string | null;
  processed: boolean;
  mode: "mock" | "opencv" | "mediapipe";
  tracking_confidence: number;
  hands: unknown[];
  tools: {
    class_id: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
    tip: { x: number; y: number } | null;
  }[];
  metrics: Record<string, number>;
  warnings: string[];
}

export interface VisionMetricsRequest {
  timestamp_ms: number;
  tracking_confidence?: number;
  tool_tip?: { x: number; y: number } | null;
  tool_angle_deg?: number | null;
  entry_error_mm?: number | null;
  exit_error_mm?: number | null;
  path_length_px?: number | null;
  ideal_path_length_px?: number | null;
  position_variance?: number | null;
  safety_zone_entered?: boolean;
}

// ---------- trajectory ----------

export interface TrajectoryPoint {
  timestamp_ms: number;
  x: number;
  y: number;
  z?: number | null;
  confidence?: number;
  tool_id?: string;
}

export interface TrajectoryResponse {
  session_id: string;
  point_count: number;
  points: TrajectoryPoint[];
}

// ---------- anatomy ----------

export interface AnatomyStructure {
  id: string;
  name: string;
  category: string;
  model_node_name: string;
  description: string;
  default_visible: boolean;
}

export interface AnatomyRegion {
  id: string;
  name: string;
  frontend_label: string;
  selectable: boolean;
  structures: AnatomyStructure[];
  disclaimer: string;
}

// ---------- websocket ----------

export type ServerMessageType =
  | "session.started" | "session.paused" | "session.resumed" | "session.updated"
  | "step.completed" | "step.changed" | "checklist.updated" | "tool.selected"
  | "coach.message" | "metrics.updated" | "vision.updated" | "safety.warning"
  | "vitals.updated" | "scenario.completed" | "pong" | "error";

export interface WebSocketMessage<T = unknown> {
  type: ServerMessageType;
  session_id: string;
  timestamp: string;
  payload: T;
}

export interface ClientMessage<T = unknown> {
  type: "ping" | "subscribe" | "session.event" | "tool.pose" | "camera.changed" | "vision.metrics";
  payload?: T;
}

// ---------- errors ----------

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    request_id: string;
  };
}
