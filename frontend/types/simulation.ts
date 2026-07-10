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

export type SimulationState = {
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
};
