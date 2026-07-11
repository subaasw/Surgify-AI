/**
 * Hand-motion math: path distance, speed, and steadiness from a stream of
 * palm positions. Distance integrates a low-passed position through a small
 * hysteresis gate, so back-and-forth jitter cancels instead of inflating the
 * path while slow deliberate motion still counts in full. Steadiness scores
 * the high-frequency velocity residual (1 = rock steady), which stays high
 * during smooth travel — constant velocity is not tremor. Plain JS so
 * `node --test` runs it without a TS loader.
 */

const damp = (rate, dt) => 1 - Math.exp(-rate * Math.min(dt, 1 / 30));

const COMMIT_DIST = .004; // smoothed movement must add up to this before it counts

export class MotionTracker {
  /**
   * @param smoothRate position low-pass rate separating movement from noise
   * @param tremorScale velocity residual (units/s) that reads as fully unsteady
   */
  constructor(smoothRate = 8, tremorScale = 1.2) {
    this.smoothRate = smoothRate;
    this.tremorScale = tremorScale;
    this.reset();
  }

  reset() {
    this.ema = null; // smoothed position
    this.raw = null; // last raw sample — tremor must see the unsmoothed signal
    this.vel = [0, 0, 0]; // smoothed velocity, units/s
    this.pending = [0, 0, 0]; // uncommitted smoothed displacement
    this.tremor = 0;
    this.distance = 0;
    this.speed = 0;
  }

  /** Feed one palm sample; returns {distance, speed, steadiness}. */
  update(x, y, z, dt) {
    if (!this.ema || dt <= 0) {
      this.ema = [x, y, z];
      this.raw = [x, y, z];
      return this.stats();
    }
    const alpha = damp(this.smoothRate, dt);
    const prev = this.ema;
    const next = [prev[0] + (x - prev[0]) * alpha, prev[1] + (y - prev[1]) * alpha, prev[2] + (z - prev[2]) * alpha];

    // distance: bank smoothed displacement, commit once it clears the gate —
    // alternating jitter cancels inside `pending` and never commits
    for (let i = 0; i < 3; i++) this.pending[i] += next[i] - prev[i];
    const banked = Math.hypot(...this.pending);
    if (banked > COMMIT_DIST) {
      this.distance += banked;
      this.pending = [0, 0, 0];
    }

    // steadiness: how much raw instantaneous velocity deviates from its own
    // trend — constant travel has zero residual, oscillation is all residual
    const v = [(x - this.raw[0]) / dt, (y - this.raw[1]) / dt, (z - this.raw[2]) / dt];
    const trend = damp(6, dt);
    const residual = Math.hypot(v[0] - this.vel[0], v[1] - this.vel[1], v[2] - this.vel[2]);
    for (let i = 0; i < 3; i++) this.vel[i] += (v[i] - this.vel[i]) * trend;
    this.tremor += (residual - this.tremor) * damp(2, dt);

    this.speed = Math.hypot(...this.vel);
    this.ema = next;
    this.raw = [x, y, z];
    return this.stats();
  }

  stats() {
    return {
      distance: this.distance,
      speed: this.speed,
      steadiness: Math.max(0, 1 - this.tremor / this.tremorScale),
    };
  }
}

/**
 * Live per-hand stats, written from the render loop and read by the HUD.
 * `at` bumps on every update so readers can detect staleness.
 */
export const motionStats = {
  Right: { distance: 0, speed: 0, steadiness: 1, live: false },
  Left: { distance: 0, speed: 0, steadiness: 1, live: false },
  at: 0,
};
