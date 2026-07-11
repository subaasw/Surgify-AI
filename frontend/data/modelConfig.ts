/**
 * Central model registry. The prototype uses procedural fallbacks so it works
 * offline. Add freely licensed GLB paths here when production assets arrive.
 */
export const modelConfig = {
  patient: { source: "/3d/patient.glb", alternateSource: "/3d/patient2.fbx", fallback: "FallbackPatient" },
  hospitalBed: { source: "/models/hospital-bed.glb", fallback: "FallbackHospitalBed" },
  monitor: { source: "/models/monitor.glb", fallback: "FallbackMonitor" },
  anatomy: { source: null, fallback: "procedural-torso" },
  instruments: {
    needleHolder: { source: "/3d/Instruments/NeedleHolder.glb", fallback: "FallbackNeedleHolder" },
    forceps: { source: "/3d/Instruments/Forceps.glb", fallback: "FallbackForceps" },
    scissors: { source: "/3d/Instruments/SurgicalScissors.glb", fallback: "FallbackScissors" },
    curvedNeedle: { source: "/3d/Instruments/CurveNeedle.glb", fallback: "FallbackCurvedNeedle" },
  },
  organs: {
    brain: { source: "/3d/Organs/Brain.glb", color: "#d9a6a6" },
    kidney: { source: "/3d/Organs/Kidney.glb", color: "#984d46" },
    lungs: { source: "/3d/Organs/Lungs.glb", color: "#e58f9b" },
    ribCage: { source: "/3d/Organs/Rib Cage.glb", color: "#e9e1ca" },
    heart: { source: "/3d/Organs/heart.glb", color: "#c94755" },
    muscle: { source: "/3d/Organs/muscle.glb", color: "#b64953" },
    liver: { source: "/3d/Organs/liver.glb", color: "#7f352f" },
    stomach: { source: "/3d/Organs/stomach.glb", color: "#c48674" },
  },
} as const;

export const MODEL_PATHS = {
  patient: "/3d/patient.glb",
  alternatePatient: "/3d/patient2.fbx",
  hand: "/3d/hand.glb",
  hospitalBed: "/models/hospital-bed.glb",
  monitor: "/models/monitor.glb",
  needleHolder: "/3d/Instruments/NeedleHolder.glb",
  forceps: "/3d/Instruments/Forceps.glb",
  scissors: "/3d/Instruments/SurgicalScissors.glb",
  curvedNeedle: "/3d/Instruments/CurveNeedle.glb",
  brain: "/3d/Organs/Brain.glb",
  kidney: "/3d/Organs/Kidney.glb",
  lungs: "/3d/Organs/Lungs.glb",
  ribCage: "/3d/Organs/Rib Cage.glb",
  heart: "/3d/Organs/heart.glb",
  muscle: "/3d/Organs/muscle.glb",
  liver: "/3d/Organs/liver.glb",
  stomach: "/3d/Organs/stomach.glb",
} as const;
