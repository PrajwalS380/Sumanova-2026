/**
 * Stylised secondary motion for hair (sumanova-us-108) — pure TypeScript, no allocations per step.
 *
 * Eight motion groups (see sculpt3d/groom.ts `Motion`): 0 fringe, 1 left side, 2 right side,
 * 3 back, 4 top, 5 tail 1, 6 tail 2 / second plait, 7 plait. Each group is a 2-segment pendulum
 * (mid + tip) expressed as a small rotation vector (axis × angle, head-local) about every lock's own
 * pivot; the shader blends mid → tip along the lock. Inputs per frame: the head's world position and
 * orientation. From them: inertial push (linear + angular acceleration at the group's typical
 * position), gravity in head space (hair falls when the head bows or tilts), and an optional breeze
 * while standing still. Integrated with a fixed 1/120 s sub-step, so it looks the same at any frame
 * rate and never explodes after a hitch.
 */

export const GROUPS = 8;

interface GroupSpec {
  freq: number; // Hz
  damp: number; // damping ratio
  max: number; // max angle (rad)
  weight: number;
  /** typical position of the group's locks relative to the head centre (head radii) */
  at: [number, number, number];
}

// freq / damping / maxAngle / weight per group (tuned by eye)
export const GROUP_SPECS: GroupSpec[] = [
  { freq: 2.6, damp: 0.35, max: 0.25, weight: 0.6, at: [0, 0.6, 0.8] }, // 0 fringe
  { freq: 1.8, damp: 0.3, max: 0.35, weight: 1.0, at: [-0.9, -0.2, 0] }, // 1 left
  { freq: 1.8, damp: 0.3, max: 0.35, weight: 1.0, at: [0.9, -0.2, 0] }, // 2 right
  { freq: 1.6, damp: 0.3, max: 0.35, weight: 1.0, at: [0, -0.3, -0.9] }, // 3 back
  { freq: 2.4, damp: 0.45, max: 0.12, weight: 0.4, at: [0, 0.9, 0] }, // 4 top
  { freq: 1.2, damp: 0.18, max: 0.7, weight: 1.0, at: [0, 0.2, -1.1] }, // 5 tail
  { freq: 1.2, damp: 0.18, max: 0.7, weight: 1.0, at: [0.6, -0.4, -0.9] }, // 6 tail 2 / plait 2
  { freq: 0.9, damp: 0.22, max: 0.55, weight: 1.0, at: [0, -0.5, -1.0] }, // 7 plait (heavy)
];

const SUB = 1 / 120;
/** how strongly head acceleration (in head radii / s²) pushes the hair */
export let PUSH = 3.2;
export const setPush = (v: number) => (PUSH = v);
const CLAMP_IDX = [0, 1, 4, 5];
const MAX_SUB = 8;
/**
 * The simulation runs this far behind real time and reads its inputs from timestamped samples
 * (interpolated per sub-step): finite-difference accelerations lag by about one frame, so without a
 * fixed latency the response would depend on the frame rate.
 */
const LATENCY = 0.05;
const NS = 16; // input samples kept
const SW = 10; // per sample: time, la xyz, aa xyz, gravity xyz

export interface HeadPose {
  /** world position of the hair group */
  px: number; py: number; pz: number;
  /** world orientation (quaternion) */
  qx: number; qy: number; qz: number; qw: number;
  /** head radius in world units (scales the lever arm of angular acceleration) */
  radius: number;
}

export class HairMotion {
  /** per group: mid rotation (x, y, z) then tip rotation, head-local axis × angle */
  readonly mid = new Float32Array(GROUPS * 3);
  readonly tip = new Float32Array(GROUPS * 3);
  /** per-group weight scale (style length etc.); 0 = still */
  readonly weights = new Float32Array(GROUPS);
  /** breeze on/off (off while moving, with data saver, or when asked) */
  breeze = true;

  // state: angle about x and z (head-local) for mid and tip, and their velocities
  private s = new Float64Array(GROUPS * 8);
  private now = 0; // real time of the latest input
  private simT = 0; // simulation time (≤ now − LATENCY)
  private buf = new Float64Array(NS * SW);
  private nb = 0; // samples in the buffer (oldest first)
  private t = 0;
  private has = false;
  private pv = new Float64Array(3); // previous position
  private vel = new Float64Array(3); // previous velocity (world)
  private pq = new Float64Array(4); // previous quaternion
  private pw = new Float64Array(3); // previous angular velocity (local)
  // per-frame inputs held constant across sub-steps (head-local)
  private la = new Float64Array(3); // linear acceleration
  private aa = new Float64Array(3); // angular acceleration
  private gl = new Float64Array(3); // gravity direction
  private moving = 0;

  constructor() {
    this.weights.fill(1);
  }

  reset() {
    this.s.fill(0);
    this.mid.fill(0);
    this.tip.fill(0);
    this.nb = 0;
    this.has = false;
  }

  /** advance by dt seconds with the current head pose */
  step(dt: number, p: HeadPose) {
    if (!(dt > 0)) return;
    // a long gap (tab switch, hitch): start again from rest instead of a jolt
    if (dt > 0.25 || !this.has) {
      this.reset();
      this.has = true;
      this.pv[0] = p.px; this.pv[1] = p.py; this.pv[2] = p.pz;
      this.vel.fill(0);
      this.pq[0] = p.qx; this.pq[1] = p.qy; this.pq[2] = p.qz; this.pq[3] = p.qw;
      this.pw.fill(0);
      this.inputs(p, 0);
      this.simT = this.now - LATENCY;
      this.push(this.now - LATENCY);
      this.push(this.now);
      return;
    }
    dt = Math.min(dt, 0.05);
    this.now += dt;
    this.inputs(p, dt);
    // the accelerations are centred one frame back
    this.push(this.now - dt);
    let n = 0;
    while (this.simT + SUB <= this.now - LATENCY && n < MAX_SUB) {
      this.simT += SUB;
      this.sample(this.simT);
      this.integrate(SUB);
      n++;
    }
    if (n === MAX_SUB) this.simT = Math.max(this.simT, this.now - LATENCY - SUB);
    this.output();
  }

  /** store the current inputs (la, aa, gl) stamped at time `t` */
  private push(t: number) {
    if (this.nb === NS) {
      this.buf.copyWithin(0, SW);
      this.nb--;
    }
    // keep the stamps increasing
    if (this.nb && t <= this.buf[(this.nb - 1) * SW]) t = this.buf[(this.nb - 1) * SW] + 1e-6;
    const o = this.nb * SW;
    this.buf[o] = t;
    this.buf[o + 1] = this.la[0]; this.buf[o + 2] = this.la[1]; this.buf[o + 3] = this.la[2];
    this.buf[o + 4] = this.aa[0]; this.buf[o + 5] = this.aa[1]; this.buf[o + 6] = this.aa[2];
    this.buf[o + 7] = this.gl[0]; this.buf[o + 8] = this.gl[1]; this.buf[o + 9] = this.gl[2];
    this.nb++;
  }

  /** inputs at time t, interpolated between the stored samples (into la / aa / gl) */
  private sample(t: number) {
    const b = this.buf;
    let i = 0;
    while (i < this.nb - 2 && b[(i + 1) * SW] < t) i++;
    const o0 = i * SW, o1 = Math.min(i + 1, this.nb - 1) * SW;
    const span = b[o1] - b[o0];
    const f = span > 1e-9 ? Math.max(0, Math.min(1, (t - b[o0]) / span)) : 1;
    for (let k = 0; k < 3; k++) {
      this.la[k] = b[o0 + 1 + k] + (b[o1 + 1 + k] - b[o0 + 1 + k]) * f;
      this.aa[k] = b[o0 + 4 + k] + (b[o1 + 4 + k] - b[o0 + 4 + k]) * f;
      this.gl[k] = b[o0 + 7 + k] + (b[o1 + 7 + k] - b[o0 + 7 + k]) * f;
    }
  }

  /** world motion → head-local inputs (no allocations) */
  private inputs(p: HeadPose, dt: number) {
    const { qx, qy, qz, qw } = p;
    // inverse rotation (conjugate) applied to a world vector
    const toLocal = (x: number, y: number, z: number, out: Float64Array) => {
      const ix = -qx, iy = -qy, iz = -qz, iw = qw;
      // v' = q⁻¹ v q
      const tx = 2 * (iy * z - iz * y), ty = 2 * (iz * x - ix * z), tz = 2 * (ix * y - iy * x);
      out[0] = x + iw * tx + (iy * tz - iz * ty);
      out[1] = y + iw * ty + (iz * tx - ix * tz);
      out[2] = z + iw * tz + (ix * ty - iy * tx);
    };
    toLocal(0, -1, 0, this.gl);
    if (dt <= 0) {
      this.la.fill(0);
      this.aa.fill(0);
      return;
    }
    // linear velocity / acceleration (world → local)
    const vx = (p.px - this.pv[0]) / dt, vy = (p.py - this.pv[1]) / dt, vz = (p.pz - this.pv[2]) / dt;
    const ax = (vx - this.vel[0]) / dt, ay = (vy - this.vel[1]) / dt, az = (vz - this.vel[2]) / dt;
    this.pv[0] = p.px; this.pv[1] = p.py; this.pv[2] = p.pz;
    this.vel[0] = vx; this.vel[1] = vy; this.vel[2] = vz;
    toLocal(ax / p.radius, ay / p.radius, az / p.radius, this.la);
    // angular velocity from q_prev⁻¹ · q (local frame), small-angle
    const ax0 = -this.pq[0], ay0 = -this.pq[1], az0 = -this.pq[2], aw0 = this.pq[3];
    const dx = aw0 * qx + ax0 * qw + ay0 * qz - az0 * qy;
    const dy = aw0 * qy - ax0 * qz + ay0 * qw + az0 * qx;
    const dz = aw0 * qz + ax0 * qy - ay0 * qx + az0 * qw;
    const dw = aw0 * qw - ax0 * qx - ay0 * qy - az0 * qz;
    const sgn = dw < 0 ? -2 : 2;
    const wx = (sgn * dx) / dt, wy = (sgn * dy) / dt, wz = (sgn * dz) / dt;
    this.aa[0] = (wx - this.pw[0]) / dt; this.aa[1] = (wy - this.pw[1]) / dt; this.aa[2] = (wz - this.pw[2]) / dt;
    this.pw[0] = wx; this.pw[1] = wy; this.pw[2] = wz;
    this.pq[0] = qx; this.pq[1] = qy; this.pq[2] = qz; this.pq[3] = qw;
    // how much the figure is moving (breeze only when still)
    const m = Math.min(1, Math.hypot(vx, vy, vz) / p.radius / 0.6 + Math.hypot(wx, wy, wz) / 1.5);
    this.moving += (m - this.moving) * Math.min(1, dt * 4);
  }

  private integrate(h: number) {
    this.t += h;
    const g = this.gl;
    // breeze: two slow octaves, only while the figure is still
    const bz = this.breeze ? 0.015 * (1 - this.moving) : 0;
    const b1 = bz * (Math.sin(this.t * 2 * Math.PI * 0.31) + 0.5 * Math.sin(this.t * 2 * Math.PI * 0.67 + 1.3));
    const b2 = bz * (Math.sin(this.t * 2 * Math.PI * 0.43 + 0.7) + 0.5 * Math.sin(this.t * 2 * Math.PI * 0.59 + 2.1));
    for (let k = 0; k < GROUPS; k++) {
      const sp = GROUP_SPECS[k];
      const w = sp.weight * this.weights[k];
      const o = k * 8;
      if (w <= 0) {
        for (let i = 0; i < 8; i++) this.s[o + i] = 0;
        continue;
      }
      // relative acceleration of the group's locks: −(a + α × r)
      const [rx, ry, rz] = sp.at;
      const fx = -(this.la[0] + (this.aa[1] * rz - this.aa[2] * ry));
      const fz = -(this.la[2] + (this.aa[0] * ry - this.aa[1] * rx));
      // a hanging lock (pointing −y) rotated by (θx, θz) moves its tip by (+θz, −θx): so a sideways
      // push fx drives θz, a forward push fz drives −θx; gravity in head space sets the rest angle
      const tz = Math.max(-sp.max, Math.min(sp.max, g[0] * w)) + b1 * w;
      const tx = Math.max(-sp.max, Math.min(sp.max, -g[2] * w)) + b2 * w;
      const om = 2 * Math.PI * sp.freq, om2 = om * om, c = 2 * sp.damp * om;
      const push = PUSH * w;
      // mid: [θx, θz, vx, vz]; tip: [θx, θz, vx, vz] — the tip follows the mid with its own lag
      const s = this.s;
      const mxA = om2 * (tx - s[o]) - c * s[o + 2] - push * fz;
      const mzA = om2 * (tz - s[o + 1]) - c * s[o + 3] + push * fx;
      s[o + 2] += mxA * h; s[o + 3] += mzA * h;
      s[o] += s[o + 2] * h; s[o + 1] += s[o + 3] * h;
      const om2t = om2 * 1.8, ct = c * 1.2;
      const txA = om2t * (s[o] * 1.25 - s[o + 4]) - ct * s[o + 6] - push * 1.3 * fz;
      const tzA = om2t * (s[o + 1] * 1.25 - s[o + 5]) - ct * s[o + 7] + push * 1.3 * fx;
      s[o + 6] += txA * h; s[o + 7] += tzA * h;
      s[o + 4] += s[o + 6] * h; s[o + 5] += s[o + 7] * h;
      // never past the group's limit
      for (let j = 0; j < 4; j++) {
        const i = CLAMP_IDX[j];
        const lim = i >= 4 ? sp.max * 1.25 : sp.max;
        if (s[o + i] > lim) { s[o + i] = lim; s[o + i + 2] = Math.min(0, s[o + i + 2]); }
        else if (s[o + i] < -lim) { s[o + i] = -lim; s[o + i + 2] = Math.max(0, s[o + i + 2]); }
      }
    }
  }

  private output() {
    for (let k = 0; k < GROUPS; k++) {
      const o = k * 8;
      this.mid[k * 3] = this.s[o]; this.mid[k * 3 + 1] = 0; this.mid[k * 3 + 2] = this.s[o + 1];
      this.tip[k * 3] = this.s[o + 4]; this.tip[k * 3 + 1] = 0; this.tip[k * 3 + 2] = this.s[o + 5];
    }
  }
}

// ---------------------------------------------------------------------------- still captures

/** every live hair's master motion uniform (set to 0 to render the hair at rest) */
const live = new Set<{ value: number }>();
let still = 0;
export function registerHairMotion(u: { value: number }) {
  live.add(u);
  return () => live.delete(u);
}
/** true while a still capture is being rendered (profile pictures, body images) */
export const hairStill = () => still > 0;
/** render `f` with every hair at rest (no swing caught mid-motion), then restore */
export async function withHairAtRest<T>(f: () => Promise<T> | T): Promise<T> {
  still++;
  const saved = [...live].map((u) => [u, u.value] as const);
  for (const u of live) u.value = 0;
  try {
    return await f();
  } finally {
    still--;
    if (!still) for (const [u, v] of saved) u.value = v;
  }
}
/** the master motion value of every live hair (tests / harness) */
export const liveHairMotion = () => [...live].map((u) => u.value);
