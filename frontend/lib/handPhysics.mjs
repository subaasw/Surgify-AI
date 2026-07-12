/**
 * Pure hand-tracking math: MediaPipe's 21 normalized 3D landmarks → world
 * position, palm orientation basis (front/back aware), per-finger curls, and
 * the spring-damper integration that gives motion inertia. Plain JS so
 * `node --test` runs it without a TS loader.
 */

export const WORKSPACE = {
  x: [-2.3, 2.3], // across the bed
  y: [1.55, 3.1], // hand height: image bottom → at the patient, top → raised
  z: [1.7, -2.3], // reach: hand far from camera → near your body, close → deep over the patient
  // ponytail: flat collision plane over the patient; swap for a raycast
  // against the patient mesh if contact accuracy ever matters
  floorY: 1.74,
  // apparent hand size (wrist → middle knuckle, image space) is the depth
  // proxy: bringing the hand toward the camera reaches forward into the scene
  sizeFar: .1,
  sizeNear: .3,
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sub = (a, b) => [a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** Map a screen-space pointer onto a native range and snap to its step. */
export function rangeValueAt(clientX, left, width, min, max, step = 1) {
  const ratio = clamp((clientX - left) / Math.max(width, 1), 0, 1);
  const value = min + ratio * (max - min);
  return clamp(Math.round(value / step) * step, min, max);
}

/** Relative mouse-style movement: hand deltas move a parked screen cursor. */
export function relativeCursorAt(pointer, handAnchor, cursorAnchor, bounds, gain = 1.8) {
  return {
    x: clamp(cursorAnchor.x + (pointer.x - handAnchor.x) * bounds.width * gain, bounds.left, bounds.left + bounds.width),
    y: clamp(cursorAnchor.y + (pointer.y - handAnchor.y) * bounds.height * gain, bounds.top, bounds.top + bounds.height),
  };
}

/** Cheap collision envelope matching the layered patient lying along world Z. */
export function patientSurfaceYAt(x, z) {
  if ((x / .34) ** 2 + ((z + 1.72) / .38) ** 2 <= 1) return 2.08;
  if (Math.abs(x) <= .46 && z >= -1.34 && z <= .22) return 2.02;
  if (Math.abs(Math.abs(x) - .62) <= .18 && z >= -.9 && z <= .78) return 1.98;
  if (Math.abs(x) <= .38 && z > .22 && z <= .72) return 1.94;
  if (Math.abs(Math.abs(x) - .24) <= .2 && z > .72 && z <= 2.06) return 1.86;
  return null;
}

/**
 * Solid-surface height under a hand anywhere in the room, so fingertips rest on
 * whatever is below them instead of sinking in: the contoured patient body, the
 * operating bed, the instrument tray, else the floor. One source of truth for
 * both the wrist and the fingertip collision clamps.
 */
export function sceneSurfaceYAt(x, z) {
  const body = patientSurfaceYAt(x, z);
  if (body != null) return body;                                    // on the patient
  if (Math.abs(x) <= 1.18 && Math.abs(z) <= 2.42) return 1.73;      // operating bed top
  if (x >= 2.1 && x <= 3.5 && z >= -1.02 && z <= -.22) return 1.08; // instrument tray top
  return 1.0;                                                        // room floor
}

/** Distance along a camera ray to a horizontal interaction surface. */
export function rayPlaneDistance(originY, directionY, planeY) {
  if (Math.abs(directionY) < 1e-6) return null;
  const distance = (planeY - originY) / directionY;
  return distance >= 0 ? distance : null;
}

/** Camera-space reach tuned to the active clinical view. */
export function handProjectionDistance(mode, depth) {
  const reach = clamp(depth, 0, 1);
  return mode === "closeup" ? lerp(.78, 1.25, reach) : lerp(2.6, 5.8, reach);
}

/** Exclude Drei Line2 helpers from camera-less physics raycasts. */
export function isSurfaceMesh(object) {
  return Boolean(object?.isMesh && !object?.isLine2 && !object?.isLineSegments2);
}

/** Demo-only posture feedback until tracked stability drives this directly. */
export function postureFeedbackAt(sample) {
  return sample < .5
    ? { title: "Hand stability warning", message: "Your hand appears unstable. Slow down and keep your wrist neutral.", tone: "warning" }
    : { title: "Good hand posture", message: "Your wrist position and hand posture look controlled. Maintain this approach.", tone: "success" };
}

export const INCISION_SEGMENTS = 4;

/** Return the guide segment touched by a real tool tip, or -1 off-surface. */
export function incisionSegmentAt(point, segments = INCISION_SEGMENTS) {
  if (Math.abs(point.x) > .055 || point.y < .02 || point.y > .105 || point.z < -.29 || point.z > .29) return -1;
  return Math.min(segments - 1, Math.floor((point.z + .29) / .58 * segments));
}

/** Strict local wound contact used by nerve manipulation and microsuturing. */
export function insideSurgeryWindow(point) {
  return Math.abs(point.x) <= .24 && Math.abs(point.z) <= .31 && point.y >= .015 && point.y <= .16;
}

/**
 * Two-frame pinch debounce. Returns a new tiny state object and emits only on
 * stable edges, so holding a pinch cannot repeatedly activate a control.
 */
export function stablePinch(state, pinching, stableFrames = 2) {
  const frames = pinching === state.candidate ? Math.min(state.frames + 1, stableFrames) : 1;
  if (frames < stableFrames || pinching === state.active) {
    return { state: { ...state, candidate: pinching, frames }, event: null };
  }
  return {
    state: { active: pinching, candidate: pinching, frames },
    event: pinching ? "press" : "release",
  };
}

/**
 * During projected-hand surgery the camera follows the work instead of making
 * the learner reach toward off-screen world geometry. Pick up at the tray,
 * then move to the operative field as soon as the tools for that phase are held.
 */
export function requiredSurgeryTools(step, stitchPhase) {
  if (step === 5) return ["Scalpel"];
  if (step !== 6) return [];
  if (stitchPhase === 0) return ["Forceps"];
  if (stitchPhase >= 1 && stitchPhase <= 3) return ["Needle holder"];
  if (stitchPhase === 4) return ["Needle holder", "Forceps"];
  return ["Surgical scissors"];
}

export function guidedCameraMode(step, stitchPhase, heldTools, tracking, requestedMode = "room") {
  if (!tracking) return requestedMode === "webcam" ? "pov" : requestedMode;
  if (step < 4) return "pov";
  if (step === 4) return "tray";
  if (step === 7) return "closeup";

  const required = requiredSurgeryTools(step, stitchPhase);
  return required.every(tool => heldTools.includes(tool)) ? "closeup" : "tray";
}

// camera space (x right, y down, z away from camera) → POV world space.
// The webcam watches your hands from the front; the sim shows them from
// behind, exactly like your own eyes — a 180° turn about the vertical axis
// (a proper rotation, det +1, so a right hand stays a right hand):
// raise your hand and it rises, push toward the screen and it reaches into
// the scene, and you see the back of your hand just like in VR.
const toWorld = v => [-v[0], -v[1], v[2]];

/**
 * Full palm pose from one detected hand, POV-mapped:
 * - x: screen side matches your physical side
 * - y: hand height in the image → hand height over the table
 * - z: apparent hand size → reach (toward the camera = deeper into the scene)
 * - axes: orthonormal palm basis — `across` (pinky→index), `forward`
 *   (wrist→middle knuckle), `up` (palm normal). Showing the back of the hand
 *   vs the palm flips `up`, which is exactly what orients the 3D model.
 */
export function palmPose(hand, ws = WORKSPACE) {
  const lm = hand.landmarks;
  // orientation from metric 3D world landmarks when available — image-space z
  // is a rough estimate and made the palm/back reading flicker
  const wm = hand.world?.length ? hand.world : lm;
  const cx = clamp((lm[0].x + lm[5].x + lm[17].x) / 3, 0, 1);
  const cy = clamp((lm[0].y + lm[5].y + lm[17].y) / 3, 0, 1);
  const size = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y);
  const depth = clamp((size - ws.sizeFar) / (ws.sizeNear - ws.sizeFar), 0, 1);
  const forward = norm(toWorld(sub(wm[9], wm[0])));
  const up = norm(cross(forward, norm(toWorld(sub(wm[5], wm[17])))));
  const across = norm(cross(up, forward));
  return {
    x: lerp(ws.x[0], ws.x[1], 1 - cx),
    y: Math.max(ws.floorY, lerp(ws.y[1], ws.y[0], cy)),
    z: lerp(ws.z[0], ws.z[1], depth),
    screen: { x: 1 - cx * 2, y: 1 - cy * 2, depth },
    grip: hand.pinch ? 1 : 0,
    axes: { across, up, forward },
  };
}

const FINGER_SEGMENTS = {
  thumb: [[1, 2], [2, 3], [3, 4]],
  index: [[5, 6], [6, 7], [7, 8]],
  middle: [[9, 10], [10, 11], [11, 12]],
  ring: [[13, 14], [14, 15], [15, 16]],
  pinky: [[17, 18], [18, 19], [19, 20]],
};

/**
 * Per-joint bone directions for skeletal retargeting: every phalanx segment
 * (3 per finger, thumb included) as a unit vector expressed in the palm basis
 * from `palmPose`. Palm-relative, so the rig can reproduce the exact pose —
 * individual finger bends, spread, thumb opposition — under any hand
 * orientation.
 */
export function fingerDirs(landmarks, axes) {
  const dirs = {};
  for (const [finger, segments] of Object.entries(FINGER_SEGMENTS)) {
    dirs[finger] = segments.map(([a, b]) => {
      const s = norm(toWorld(sub(landmarks[b], landmarks[a])));
      return [dot(s, axes.across), dot(s, axes.up), dot(s, axes.forward)];
    });
  }
  return dirs;
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

/**
 * Geometric pose classifier — backstop for the ML gesture model, which misses
 * casual thumbs-up/down. Curls from metric world landmarks, up/down from the
 * image-space thumb direction, thresholds relative to hand size.
 */
export function classifyPose(landmarks, world = landmarks) {
  const curls = fingerCurls(world);
  const fourCurled = curls.index > .5 && curls.middle > .5 && curls.ring > .5 && curls.pinky > .5;
  if (fourCurled) {
    if (curls.thumb < .35) {
      const size = Math.hypot(landmarks[9].x - landmarks[0].x, landmarks[9].y - landmarks[0].y) || 1;
      const rise = (landmarks[4].y - landmarks[0].y) / size; // image y grows downward
      if (rise < -.5) return "Thumb_Up";
      if (rise > .5) return "Thumb_Down";
    }
    return "Closed_Fist";
  }
  if (curls.index < .22 && curls.middle < .22 && curls.ring < .22 && curls.pinky < .22) return "Open_Palm";
  return "";
}

/**
 * One-Euro filter — adaptive low-pass for realtime tracking: heavy smoothing
 * at rest (kills detection jitter), light smoothing during fast motion (no
 * perceptible lag). `minCutoff` Hz sets rest smoothness, `beta` how quickly
 * responsiveness ramps with speed.
 */
export class OneEuro {
  constructor(minCutoff = 1.2, beta = .5) { this.minCutoff = minCutoff; this.beta = beta; this.value = null; this.dValue = 0; }
  next(raw, dt) {
    if (this.value === null || dt <= 0) { this.value = raw; return raw; }
    const alpha = cutoff => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    this.dValue += alpha(1) * ((raw - this.value) / dt - this.dValue);
    this.value += alpha(this.minCutoff + this.beta * Math.abs(this.dValue)) * (raw - this.value);
    return this.value;
  }
  reset() { this.value = null; this.dValue = 0; }
}

/** One-Euro bank for a full 21-landmark set (x, y, z each). */
export class LandmarkFilter {
  constructor(minCutoff, beta) { this.filters = Array.from({ length: 63 }, () => new OneEuro(minCutoff, beta)); }
  apply(landmarks, dt) {
    return landmarks.map((p, i) => ({
      x: this.filters[i * 3].next(p.x, dt),
      y: this.filters[i * 3 + 1].next(p.y, dt),
      z: this.filters[i * 3 + 2].next(p.z ?? 0, dt),
    }));
  }
  reset() { for (const f of this.filters) f.reset(); }
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
