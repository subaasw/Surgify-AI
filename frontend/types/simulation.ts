export type CameraMode = "room" | "patient" | "closeup" | "webcam" | "anatomy" | "tray" | "incision";

// surgical: 3D hands drive physics — grab instruments, collide with surfaces.
// normal: hands hidden, only the screen pointer is live; nothing collides.
export type MovementMode = "surgical" | "normal";

export type PatientVitals = {
  heartRate: number;
  systolic: number;
  diastolic: number;
  oxygenSaturation: number;
  respiratoryRate: number;
  temperature: number;
};

export type CoachMessage = {
  id: string;
  tone: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp: number;
};

export type SimulationEvent = {
  id: string;
  timestamp: number;
  tone: CoachMessage["tone"];
  label: string;
};

export type SimulationRunStatus = "ready" | "active" | "complete";

export type SimulationState = {
  runStatus: SimulationRunStatus;
  patientName: string;
  selectedRegion: string | null;
  selectedTool: string | null;
  heldTools: Record<"Left" | "Right", string | null>;
  surfaceContact: boolean;
  currentStep: number;
  completedSteps: string[];
  completedActions: string[];
  cameraMode: CameraMode;
  paused: boolean;
  elapsedTime: number;
  score: number;
  vitals: PatientVitals;
  feedback: CoachMessage[];
  anatomyOverlay: boolean;
  trackingOverlay: boolean;
  movementMode: MovementMode;
  events: SimulationEvent[];
  uiCollapsed: boolean;

  // ── Incision state ──
  /** 0→1 progress along the incision path while the scalpel is cutting. */
  incisionProgress: number;
  /** Guide segments actually crossed by the held scalpel tip. */
  incisionSegments: number[];
  /** Maximum approximated tip penetration in world units. */
  incisionDepth: number;
  /** True once the full incision is completed. */
  incisionComplete: boolean;

  // ── Suture state ──
  stitchPhase: number;
  /** 0→1 continuous animation progress within the current stitch phase. */
  stitchProgress: number;
  suturePosition: number;
  sutureAngle: number;
};
