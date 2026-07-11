/**
 * Pure hand-tracking math: MediaPipe's 21 normalized 3D landmarks → world
 * position, palm orientation basis (front/back aware), per-finger curls, and
 * the spring-damper integration that gives motion inertia. Plain JS so
 * `node --test` runs it without a TS loader.
 */

export const WORKSPACE = {
  x: [-2.3, 2.3], // across the bed
  z: [-2.5, 1.9], // along the patient (head → feet)
  hoverY: 2.4, // height when the hand is far from the camera
  // ponytail: flat collision plane over the patient; swap for a raycast
  // against the patient mesh if contact accuracy ever matters
  floorY: 1.74,
  // apparent hand size (wrist → middle knuckle, image space) maps to depth:
  // bringing the hand toward the camera reaches down toward the patient
  sizeFar: .1,
  sizeNear: .3,
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sub = (a, b) => [a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// camera space (x right, y down, z away from camera) → world space
// (x across the bed, y up, z along the patient). A proper rotation (det +1),
// not a reflection — so a right hand stays a right hand: leaning toward the
// camera reaches down, image-down runs along the patient, and screen side
// matches your physical side.
const toWorld = v => [-v[0], v[2], v[1]];

/**
 * Full palm pose from one detected hand.
 * - position: palm center in the workspace, height from apparent hand size
 * - axes: orthonormal palm basis — `across` (pinky→index), `forward`
 *   (wrist→middle knuckle), `up` (palm normal). Showing the back of the hand
 *   vs the palm flips `up`, which is exactly what orients the 3D model.
 */
export function palmPose(hand, ws = WORKSPACE) {
  const lm = hand.landmarks;
  const cx = clamp((lm[0].x + lm[5].x + lm[17].x) / 3, 0, 1);
  const cy = clamp((lm[0].y + lm[5].y + lm[17].y) / 3, 0, 1);
  const size = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y);
  const depth = clamp((size - ws.sizeFar) / (ws.sizeNear - ws.sizeFar), 0, 1);
  const forward = norm(toWorld(sub(lm[9], lm[0])));
  const up = norm(cross(forward, norm(toWorld(sub(lm[5], lm[17])))));
  const across = norm(cross(up, forward));
  return {
    x: lerp(ws.x[0], ws.x[1], 1 - cx),
    y: Math.max(ws.floorY, lerp(ws.hoverY, ws.floorY, depth)),
    z: lerp(ws.z[0], ws.z[1], cy),
    grip: hand.pinch ? 1 : 0,
    axes: { across, up, forward },
  };
}

const FINGER_JOINTS = { thumb: [2, 3, 4], index: [5, 6, 8], middle: [9, 10, 12], ring: [13, 14, 16], pinky: [17, 18, 20] };

/** Per-finger curl 0 (straight) → 1 (folded), from the bend at the middle joint. */
export function fingerCurls(landmarks) {
  const curls = {};
  for (const [finger, [mcp, pip, tip]] of Object.entries(FINGER_JOINTS)) {
    const a = norm(sub(landmarks[pip], landmarks[mcp]));
    const b = norm(sub(landmarks[tip], landmarks[pip]));
    const angle = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
    curls[finger] = clamp(angle / (Math.PI * .75), 0, 1);
  }
  return curls;
}

/** Semi-implicit spring-damper step. Mutates and returns `state`. */
export function springStep(state, target, dt, stiffness = 70, damping = 14) {
  const step = Math.min(dt, 1 / 30); // survive tab-switch dt spikes
  state.velocity += (stiffness * (target - state.value) - damping * state.velocity) * step;
  state.value += state.velocity * step;
  return state;
}

/** Frame-rate-independent smoothing factor for slerp/lerp toward a target. */
export function damp(rate, dt) {
  return 1 - Math.exp(-rate * Math.min(dt, 1 / 30));
}
