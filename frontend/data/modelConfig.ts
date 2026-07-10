/**
 * Central model registry. The prototype uses procedural fallbacks so it works
 * offline. Add freely licensed GLB paths here when production assets arrive.
 */
export const modelConfig = {
  patient: { source: "/models/patient.glb", fallback: "FallbackPatient" },
  hospitalBed: { source: "/models/hospital-bed.glb", fallback: "FallbackHospitalBed" },
  monitor: { source: "/models/monitor.glb", fallback: "FallbackMonitor" },
  anatomy: { source: null, fallback: "procedural-torso" },
  instruments: {
    needleHolder: { source: "/models/needle-holder.glb", fallback: "FallbackNeedleHolder" },
    forceps: { source: "/models/forceps.glb", fallback: "FallbackForceps" },
    scissors: { source: "/models/scissors.glb", fallback: "FallbackScissors" },
    curvedNeedle: { source: null, fallback: "FallbackCurvedNeedle" },
  },
} as const;

export const MODEL_PATHS = {
  patient: "/models/patient.glb",
  hospitalBed: "/models/hospital-bed.glb",
  monitor: "/models/monitor.glb",
  needleHolder: "/models/needle-holder.glb",
  forceps: "/models/forceps.glb",
} as const;
