export type CameraMode = "room" | "patient" | "closeup" | "webcam" | "anatomy" | "tray";

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
  selectedRegion: string | null;
  selectedTool: string | null;
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
  stitchPhase: number;
  suturePosition: number;
  sutureAngle: number;
  events: SimulationEvent[];
};
