import test from "node:test";
import assert from "node:assert/strict";
import { WORKSPACE, angleTarget, handTarget, springStep } from "../lib/handPhysics.mjs";

const hand = (over = {}) => ({
  pinch: false,
  pointer: { x: 0.5, y: 0.5 },
  landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
  ...over,
});

test("centered hand maps to workspace center at hover height", () => {
  const t = handTarget(hand());
  assert.ok(Math.abs(t.x) < 1e-9);
  assert.equal(t.y, WORKSPACE.hoverY);
  assert.equal(t.grip, 0);
});

test("pinch reaches down but never below the collision floor", () => {
  const t = handTarget(hand({ pinch: true }));
  assert.ok(t.y < WORKSPACE.hoverY);
  assert.ok(t.y >= WORKSPACE.floorY);
  assert.equal(t.grip, 1);
});

test("pointer edges stay inside the workspace even out of frame", () => {
  const t = handTarget(hand({ pointer: { x: 1.4, y: -0.2 } }));
  assert.ok(t.x >= WORKSPACE.x[0] && t.x <= WORKSPACE.x[1]);
  assert.ok(t.z >= WORKSPACE.z[0] && t.z <= WORKSPACE.z[1]);
});

test("spring converges on the target without exploding", () => {
  const s = { value: 0, velocity: 0 };
  for (let i = 0; i < 600; i++) springStep(s, 2, 1 / 60);
  assert.ok(Math.abs(s.value - 2) < 0.01);
});

test("angleTarget takes the short way around", () => {
  const rewrapped = angleTarget(3, -3);
  assert.ok(Math.abs(rewrapped - (3 + (2 * Math.PI - 6))) < 1e-9);
});
