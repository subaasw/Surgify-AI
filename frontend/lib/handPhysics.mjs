/**
 * Pure hand-tracking math: normalized camera-space landmarks → world-space
 * target pose, plus the spring-damper integration that gives the hand model
 * inertia. Plain JS so `node --test` runs it without a TS loader.
 */

export const WORKSPACE = {
  x: [-2.3, 2.3], // across the bed
  z: [-2.5, 1.9], // along the patient (head → feet)
  hoverY: 2.15, // cruising height above the patient
  reachY: 1.78, // pinching dips the hand toward the wound
  // ponytail: flat collision plane over the patient; swap for a raycast
  // against the patient mesh if contact accuracy ever matters
  floorY: 1.72,
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Map a backend VisionHand (MediaPipe, normalized 0..1 camera coords) to a
 * world-space target pose. The camera faces the user, so the frame is
 * mirrored on x.
 */
export function handTarget(hand, ws = WORKSPACE) {
  const lm = hand.landmarks;
  const px = clamp(hand.pointer?.x ?? lm[0].x, 0, 1);
  const py = clamp(hand.pointer?.y ?? lm[0].y, 0, 1);
  const x = lerp(ws.x[0], ws.x[1], 1 - px);
  const z = lerp(ws.z[0], ws.z[1], py);
  const y = Math.max(ws.floorY, hand.pinch ? ws.reachY : ws.hoverY);
  // wrist(0) → middle MCP(9) gives yaw, index MCP(5) → pinky MCP(17) gives roll
  const yaw = Math.atan2(-(lm[9].x - lm[0].x), -(lm[9].y - lm[0].y));
  const roll = Math.atan2(lm[17].y - lm[5].y, lm[17].x - lm[5].x);
  return { x, y, z, yaw, roll, grip: hand.pinch ? 1 : 0 };
}

/** Semi-implicit spring-damper step. Mutates and returns `state`. */
export function springStep(state, target, dt, stiffness = 70, damping = 14) {
  const step = Math.min(dt, 1 / 30); // survive tab-switch dt spikes
  state.velocity += (stiffness * (target - state.value) - damping * state.velocity) * step;
  state.value += state.velocity * step;
  return state;
}

/** Rewrap `target` so the spring takes the short way around the circle. */
export function angleTarget(current, target) {
  let d = (target - current) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return current + d;
}
