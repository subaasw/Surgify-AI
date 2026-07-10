/**
 * Central model registry. The prototype uses procedural fallbacks so it works
 * offline. Add freely licensed GLB paths here when production assets arrive.
 */
export const modelConfig = {
  anatomy: { source: null, fallback: "procedural-torso" },
  instruments: {
    needleHolder: { source: null, fallback: "procedural-holder" },
    forceps: { source: null, fallback: "procedural-forceps" },
    scissors: { source: null, fallback: "procedural-scissors" },
    curvedNeedle: { source: null, fallback: "procedural-needle" },
  },
} as const;
