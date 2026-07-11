import test from "node:test";
import assert from "node:assert/strict";
import { MotionTracker } from "../lib/handMetrics.mjs";

const DT = 1 / 60;

test("steady straight-line motion accumulates its path length", () => {
  const tracker = new MotionTracker();
  // move 0.9 units along x over 3 simulated seconds
  for (let i = 0; i <= 180; i++) tracker.update(i * .005, 1.8, 0, DT);
  const { distance, steadiness } = tracker.stats();
  assert.ok(distance > .8 && distance < .95, `distance ${distance}`);
  assert.ok(steadiness > .85, `steadiness ${steadiness}`);
});

test("pure jitter adds almost no distance and reads as unsteady", () => {
  const tracker = new MotionTracker();
  for (let i = 0; i < 240; i++) tracker.update(.5 + (i % 2 ? .02 : -.02), 1.8, 0, DT);
  const { distance, steadiness } = tracker.stats();
  assert.ok(distance < .05, `distance ${distance}`);
  assert.ok(steadiness < .5, `steadiness ${steadiness}`);
});

test("holding still is perfectly steady and moves nothing", () => {
  const tracker = new MotionTracker();
  for (let i = 0; i < 120; i++) tracker.update(1, 2, -1, DT);
  const { distance, speed, steadiness } = tracker.stats();
  assert.equal(distance, 0);
  assert.equal(speed, 0);
  assert.ok(steadiness > .99);
});

test("speed tracks how fast the hand travels", () => {
  const slow = new MotionTracker();
  const fast = new MotionTracker();
  for (let i = 0; i < 60; i++) {
    slow.update(i * .001, 0, 0, DT);
    fast.update(i * .01, 0, 0, DT);
  }
  assert.ok(fast.stats().speed > slow.stats().speed * 5);
});

test("reset clears accumulated state", () => {
  const tracker = new MotionTracker();
  for (let i = 0; i < 30; i++) tracker.update(i * .01, 0, 0, DT);
  tracker.reset();
  assert.equal(tracker.stats().distance, 0);
});
