import test from "node:test";
import assert from "node:assert/strict";
import { WORKSPACE, damp, fingerCurls, fingerDirs, palmPose, rangeValueAt, relativeCursorAt, springStep, stablePinch } from "../lib/handPhysics.mjs";

// flat hand facing the camera: wrist below knuckles, index left of pinky (right hand)
function flatHand(over = {}) {
  const landmarks = Array.from({ length: 21 }, () => ({ x: .5, y: .5, z: 0 }));
  landmarks[0] = { x: .5, y: .62, z: 0 };   // wrist
  landmarks[5] = { x: .44, y: .5, z: 0 };   // index MCP
  landmarks[9] = { x: .5, y: .48, z: 0 };   // middle MCP
  landmarks[17] = { x: .56, y: .5, z: 0 };  // pinky MCP
  return { pinch: false, landmarks, ...over };
}

test("centered hand maps near the workspace center", () => {
  const pose = palmPose(flatHand());
  assert.ok(Math.abs(pose.x) < .2);
  assert.ok(Math.abs(pose.screen.x) < .2 && Math.abs(pose.screen.y) < .2);
  assert.ok(pose.y >= WORKSPACE.floorY && pose.y <= WORKSPACE.y[1]);
});

test("screen pose mirrors camera input into the surgeon POV", () => {
  const right = flatHand();
  right.landmarks.forEach(point => { point.x = .25; });
  const left = flatHand();
  left.landmarks.forEach(point => { point.x = .75; });
  assert.ok(palmPose(right).screen.x > 0);
  assert.ok(palmPose(left).screen.x < 0);
});

test("bigger apparent hand (closer to camera) reaches deeper into the scene", () => {
  const near = flatHand();
  near.landmarks[0] = { x: .5, y: .9, z: 0 }; // wrist far from knuckle → large hand
  const far = palmPose(flatHand());
  const close = palmPose(near);
  assert.ok(close.z < far.z); // toward the patient is -z in POV
  assert.ok(close.y >= WORKSPACE.floorY);
});

test("palm basis is orthonormal and flips when the hand shows its back", () => {
  const pose = palmPose(flatHand());
  const { across, up, forward } = pose.axes;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  assert.ok(Math.abs(dot(across, forward)) < 1e-6);
  assert.ok(Math.abs(dot(up, forward)) < 1e-6);
  assert.ok(Math.abs(Math.hypot(...up) - 1) < 1e-6);
  const mirrored = flatHand();
  [mirrored.landmarks[5], mirrored.landmarks[17]] = [mirrored.landmarks[17], mirrored.landmarks[5]];
  const flipped = palmPose(mirrored);
  assert.ok(dot(up, flipped.axes.up) < -.99); // back of hand → palm normal inverts
});

test("landmark→world map preserves chirality (rotation, not a mirror)", () => {
  // POV: fingers pointing at the camera (knuckle closer than wrist) must
  // point INTO the scene, away from the viewer — and the mapping must stay a
  // proper rotation, since the old reflection mirrored every hand
  const leaning = flatHand();
  leaning.landmarks[9] = { x: .5, y: .6, z: -.2 };
  const { axes } = palmPose(leaning);
  assert.ok(axes.forward[2] < -.9, `expected forward to point into the scene, got ${axes.forward}`);
  // and the basis stays right-handed: across × up = forward
  const [a, u, f] = [axes.across, axes.up, axes.forward];
  const crossAU = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  assert.ok(crossAU[0] * f[0] + crossAU[1] * f[1] + crossAU[2] * f[2] > .99);
});

test("straight fingers give ~0 curl, folded fingers give high curl", () => {
  const straight = Array.from({ length: 21 }, (_, i) => ({ x: .5, y: .8 - i * .01, z: 0 }));
  const open = fingerCurls(straight);
  assert.ok(open.index < .1 && open.pinky < .1);
  const fist = straight.map(p => ({ ...p }));
  fist[5] = { x: .5, y: .5, z: 0 };
  fist[6] = { x: .5, y: .42, z: 0 };
  fist[8] = { x: .5, y: .5, z: .02 }; // tip folded back toward the knuckle
  const closed = fingerCurls(fist);
  assert.ok(closed.index > .8);
});

test("spring converges on the target without exploding", () => {
  const s = { value: 0, velocity: 0 };
  for (let i = 0; i < 600; i++) springStep(s, 2, 1 / 60);
  assert.ok(Math.abs(s.value - 2) < .01);
});

test("damp stays in (0,1) and grows with dt", () => {
  assert.ok(damp(12, 1 / 120) > 0 && damp(12, 1 / 120) < 1);
  assert.ok(damp(12, 1 / 30) > damp(12, 1 / 120));
});

test("fingerDirs: straight finger runs along palm forward, folded tip reverses", () => {
  const hand = flatHand();
  hand.landmarks[10] = { x: .5, y: .36, z: 0 };
  hand.landmarks[11] = { x: .5, y: .28, z: 0 };
  hand.landmarks[12] = { x: .5, y: .2, z: 0 };
  const open = fingerDirs(hand.landmarks, palmPose(hand).axes);
  for (const d of open.middle) assert.ok(d[2] > .9, `straight segment should follow forward, got ${d}`);
  hand.landmarks[12] = { x: .5, y: .44, z: .05 }; // fold the fingertip back toward the palm
  const folded = fingerDirs(hand.landmarks, palmPose(hand).axes);
  assert.ok(folded.middle[2][2] < 0, "distal segment should reverse against forward");
});

test("palmPose orientation prefers metric world landmarks over image ones", () => {
  const hand = flatHand();
  // world copy rotated: fingers point along +x in camera space instead of up
  hand.world = hand.landmarks.map(p => ({ x: .5 + (.62 - p.y), y: .5 + (p.x - .5), z: p.z }));
  const { axes } = palmPose(hand);
  assert.ok(axes.forward[0] < -.9, `expected forward from world landmarks, got ${axes.forward}`);
});

// thumbs-up: four fingers folded, thumb straight above the wrist
function thumbsUpHand() {
  const landmarks = Array.from({ length: 21 }, () => ({ x: .5, y: .7, z: 0 }));
  landmarks[0] = { x: .5, y: .8, z: 0 };                          // wrist
  landmarks[2] = { x: .5, y: .72, z: 0 };                         // thumb MCP
  landmarks[3] = { x: .5, y: .64, z: 0 };                         // thumb IP
  landmarks[4] = { x: .5, y: .56, z: 0 };                         // thumb tip, well above wrist
  for (const [mcp, pip, tip] of [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]]) {
    landmarks[mcp] = { x: .54, y: .66, z: 0 };
    landmarks[pip] = { x: .54, y: .6, z: 0 };
    landmarks[tip] = { x: .54, y: .66, z: .02 };                  // folded back to the knuckle
  }
  return landmarks;
}

test("classifyPose: thumbs-up, thumbs-down, fist, open palm", async () => {
  const { classifyPose } = await import("../lib/handPhysics.mjs");
  const up = thumbsUpHand();
  assert.equal(classifyPose(up), "Thumb_Up");
  const down = up.map(p => ({ ...p, y: 1.5 - p.y })); // flip vertically
  assert.equal(classifyPose(down), "Thumb_Down");
  const fist = up.map(p => ({ ...p }));
  fist[4] = { x: .52, y: .74, z: .02 }; // thumb wrapped over the fingers
  fist[3] = { x: .54, y: .68, z: 0 };
  assert.equal(classifyPose(fist), "Closed_Fist");
  const open = Array.from({ length: 21 }, (_, i) => ({ x: .5, y: .8 - i * .01, z: 0 })); // straight fingers
  assert.equal(classifyPose(open), "Open_Palm");
});

test("one-euro filter kills jitter at rest but follows fast motion", async () => {
  const { OneEuro } = await import("../lib/handPhysics.mjs");
  const rest = new OneEuro(1.2, 5);
  let wobble = 0;
  for (let i = 0; i < 120; i++) wobble = rest.next(.5 + (i % 2 ? .004 : -.004), 1 / 60);
  assert.ok(Math.abs(wobble - .5) < .002, `rest jitter should shrink, got ${wobble}`);
  const moving = new OneEuro(1.2, 5);
  let followed = 0;
  for (let i = 0; i < 30; i++) followed = moving.next(i * .02, 1 / 60); // fast sweep
  assert.ok(Math.abs(followed - 29 * .02) < .05, `fast motion should track closely, got ${followed} vs ${29 * .02}`);
});

test("rangeValueAt clamps and snaps hand-driven ranges", () => {
  assert.equal(rangeValueAt(50, 0, 100, 0, 1, .01), .5);
  assert.equal(rangeValueAt(-20, 0, 100, 30, 85, 1), 30);
  assert.equal(rangeValueAt(130, 0, 100, 30, 85, 1), 85);
  assert.equal(rangeValueAt(46, 0, 100, 0, 10, 2), 4);
});

test("relative cursor stays parked on re-pinch and moves by hand delta", () => {
  const bounds = { left: 0, top: 0, width: 1000, height: 500 };
  const parked = { x: 600, y: 250 };
  assert.deepEqual(relativeCursorAt({ x: .2, y: .3 }, { x: .2, y: .3 }, parked, bounds), parked);
  assert.deepEqual(relativeCursorAt({ x: .3, y: .4 }, { x: .2, y: .3 }, parked, bounds, 1), { x: 700, y: 300 });
  assert.deepEqual(relativeCursorAt({ x: 2, y: -2 }, { x: 0, y: 0 }, parked, bounds), { x: 1000, y: 0 });
});

test("stablePinch emits one press and one release per stable gesture", () => {
  let state = { active: false, candidate: false, frames: 0 };
  let next = stablePinch(state, true);
  assert.equal(next.event, null);
  next = stablePinch(next.state, true);
  assert.equal(next.event, "press");
  next = stablePinch(next.state, true);
  assert.equal(next.event, null, "holding must not repeat the press");
  next = stablePinch(next.state, false);
  assert.equal(next.event, null);
  next = stablePinch(next.state, false);
  assert.equal(next.event, "release");
});
