import test from "node:test";
import assert from "node:assert/strict";
import { WORKSPACE, damp, fingerCurls, palmPose, springStep } from "../lib/handPhysics.mjs";

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
  assert.ok(pose.y >= WORKSPACE.floorY && pose.y <= WORKSPACE.hoverY);
});

test("bigger apparent hand (closer to camera) reaches lower, never below floor", () => {
  const near = flatHand();
  near.landmarks[0] = { x: .5, y: .9, z: 0 }; // wrist far from knuckle → large hand
  const far = palmPose(flatHand());
  const close = palmPose(near);
  assert.ok(close.y < far.y);
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
