import type { BodyP } from '../look/face';
import { loft, type Prim, type Part, type V3 } from './sdf';

/**
 * The sculpted body: a stylised adult with a friendly, slightly chunky cartoon build.
 * Joints and radii are derived from the body variant; every volume is tied to a skeleton
 * bone, so the single body mesh bends naturally at shoulders, elbows, hips, knees and ankles.
 */

// ---------------------------------------------------------------------------- skeleton

export const B = {
  pelvis: 0, chest: 1, neck: 2, head: 3,
  upperArmL: 4, foreArmL: 5, handL: 6, upperArmR: 7, foreArmR: 8, handR: 9,
  thighL: 10, shinL: 11, footL: 12, thighR: 13, shinR: 14, footR: 15,
  /** fingers: FINGER0 + side*10 + finger*2 + (0 = base, 1 = tip); finger 0 = thumb … 4 = pinky */
  FINGER0: 16,
} as const;
export const BONE_COUNT = 36;
export const fingerBone = (side: 0 | 1, finger: number, seg: 0 | 1) => B.FINGER0 + side * 10 + finger * 2 + seg;
/** parent of each bone (-1 = root) */
export const PARENT: number[] = (() => {
  const p = new Array(BONE_COUNT).fill(-1);
  p[B.chest] = B.pelvis; p[B.neck] = B.chest; p[B.head] = B.neck;
  p[B.upperArmL] = B.chest; p[B.foreArmL] = B.upperArmL; p[B.handL] = B.foreArmL;
  p[B.upperArmR] = B.chest; p[B.foreArmR] = B.upperArmR; p[B.handR] = B.foreArmR;
  p[B.thighL] = B.pelvis; p[B.shinL] = B.thighL; p[B.footL] = B.shinL;
  p[B.thighR] = B.pelvis; p[B.shinR] = B.thighR; p[B.footR] = B.shinR;
  for (const side of [0, 1] as const)
    for (let f = 0; f < 5; f++) {
      p[fingerBone(side, f, 0)] = side ? B.handR : B.handL;
      p[fingerBone(side, f, 1)] = fingerBone(side, f, 0);
    }
  return p;
})();

/** Head centre in body space (the existing face/hair rig hangs off it). */
export const HEAD_Y = 2.068;
export const HEAD_SCALE = 0.8;

export interface Joints {
  /** world-space rest position of every bone */
  pos: V3[];
  bp: BodyP;
  /** frequently used radii */
  r: { upperArm: number; foreArm: number; wrist: number; thigh: number; knee: number; calf: number; ankle: number; neck: number };
  /** x of the shoulder / hip joints (left side is −x) */
  sx: number;
  hx: number;
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mirror = (v: V3, side: number): V3 => [v[0] * side, v[1], v[2]];
export { add, lerp };

export function joints(bp: BodyP): Joints {
  const w = bp.width, sh = bp.shoulders, hp = bp.hips;
  const sx = 0.228 * sh * w + 0.012;
  const hx = 0.092 * hp * w;
  const pos: V3[] = new Array(BONE_COUNT);
  pos[B.pelvis] = [0, 1.05, 0];
  pos[B.chest] = [0, 1.36, 0];
  pos[B.neck] = [0, 1.74, -0.005];
  pos[B.head] = [0, 1.86, 0];
  for (const [side, s] of [[-1, 0], [1, 1]] as const) {
    const ua = s ? B.upperArmR : B.upperArmL;
    pos[ua] = [side * sx, 1.615, -0.005];
    pos[ua + 1] = [side * (sx + 0.006), 1.335, -0.012];
    pos[ua + 2] = [side * (sx + 0.01), 1.075, 0.0];
    const th = s ? B.thighR : B.thighL;
    pos[th] = [side * hx, 0.985, 0];
    pos[th + 1] = [side * (hx + 0.004), 0.56, 0.005];
    pos[th + 2] = [side * (hx + 0.006), 0.105, -0.012];
    // fingers (rest: hand hangs, palm facing the thigh, fingers pointing down)
    const wr = pos[ua + 2];
    const h = handLayout(side);
    for (let f = 0; f < 5; f++) {
      pos[fingerBone(s, f, 0)] = add(wr, h[f].base);
      pos[fingerBone(s, f, 1)] = add(wr, h[f].mid);
    }
  }
  const k = Math.min(w, 1.12);
  return {
    pos,
    bp,
    sx,
    hx,
    r: { upperArm: 0.062 * k, foreArm: 0.053 * k, wrist: 0.038 * Math.min(w, 1.06), thigh: 0.112 * Math.min(w * hp, 1.2), knee: 0.066 * k, calf: 0.069 * k, ankle: 0.043 * k, neck: 0.068 * k },
  };
}

// ---------------------------------------------------------------------------- hand layout

interface FingerLayout { base: V3; mid: V3; tip: V3; r0: number; r1: number; r2: number }
/** Finger joints relative to the wrist for one side (rest pose, palm toward the body). */
export function handLayout(side: number): FingerLayout[] {
  // z = front/back (index in front), x toward the body = palm side, y down along the hand
  const palmIn = -side; // palm faces the thigh: +x for the left hand, −x for the right
  const F = (z: number, len: number, r: number, spread: number): FingerLayout => {
    const base: V3 = [palmIn * 0.003, -0.094, z];
    const dir: V3 = [palmIn * 0.07, -1, spread];
    const n = Math.hypot(...dir);
    const d: V3 = [dir[0] / n, dir[1] / n, dir[2] / n];
    const mid = add(base, [d[0] * len * 0.5, d[1] * len * 0.5, d[2] * len * 0.5]);
    const tip = add(base, [d[0] * len, d[1] * len, d[2] * len]);
    return { base, mid, tip, r0: r, r1: r * 0.93, r2: r * 0.84 };
  };
  const thumbBase: V3 = [palmIn * 0.014, -0.046, 0.034];
  const thumbMid: V3 = [palmIn * 0.026, -0.08, 0.054];
  const thumbTip: V3 = [palmIn * 0.03, -0.114, 0.06];
  return [
    { base: thumbBase, mid: thumbMid, tip: thumbTip, r0: 0.0132, r1: 0.0122, r2: 0.0108 },
    F(0.0285, 0.078, 0.0108, 0.1),
    F(0.0095, 0.087, 0.0112, 0.02),
    F(-0.0095, 0.08, 0.0106, -0.06),
    F(-0.027, 0.064, 0.0094, -0.15),
  ];
}

// ---------------------------------------------------------------------------- sculpt parts

/**
 * Body volumes. `inf` inflates everything (clothing is the same anatomy, puffed out a little).
 * `only` picks regions, so a garment can reuse just the torso, arms or legs.
 */
export type Region = 'torso' | 'neck' | 'upperArm' | 'foreArm' | 'thigh' | 'shin' | 'foot' | 'pelvis';

export function bodyPrims(J: Joints, inf = 0, only?: Region[], tagBase = 0): Prim[] {
  const { pos, bp, r } = J;
  const w = bp.width, hp = bp.hips, sh = bp.shoulders, belly = bp.belly;
  const want = (g: Region) => !only || only.includes(g);
  const P: Prim[] = [];
  const I = inf;
  // tags: 1 torso, 2 neck, 3 upper arm L, 4 upper arm R, 5 forearm L, 6 forearm R, 7 thigh L, 8 thigh R, 9 shin L, 10 shin R, 11 foot L, 12 foot R, 13 pelvis
  if (want('pelvis')) {
    // seat (glutes) — the lofted trunk below carries the hips themselves
    for (const s of [-1, 1]) P.push({ t: 'ellipsoid', c: [s * 0.07 * hp * w, 0.99, -0.045], r: [0.09 * hp + I, 0.1 + I, 0.08 + I], bone: B.pelvis, k: 0.06, tag: tagBase + 13 });
  }
  if (want('torso') || want('pelvis')) {
    // One lofted trunk from hips to shoulders: wide hips → nipped waist → ribcage → chest →
    // sloping shoulders → neck base. Slices are ellipses, so the silhouette flows continuously.
    const W = w, bl = belly;
    const lo = want('pelvis') ? 0.9 : 1.12, hi = want('torso') ? 1.74 : 1.16;
    const f = loft(
      lo,
      hi,
      [[0.9, 0.15 * hp * W], [1.02, 0.17 * hp * W], [1.12, (0.158 + bl * 0.02) * W], [1.2, (0.148 + bl * 0.03) * W], [1.32, 0.156 * W], [1.45, 0.168 * sh * W], [1.55, 0.18 * sh * W], [1.61, 0.19 * sh * W], [1.66, 0.15 * sh], [1.7, 0.1], [1.74, 0.07]],
      [[0.9, 0.1], [1.02, 0.112], [1.14, 0.1 + bl * 0.05], [1.22, 0.098 + bl * 0.06], [1.34, 0.108 + bl * 0.02], [1.45, 0.118], [1.55, 0.106], [1.61, 0.088], [1.67, 0.074], [1.74, 0.066]],
      [[0.9, -0.012], [1.02, -0.012], [1.2, 0.004 + bl * 0.02], [1.45, 0.012], [1.6, -0.01], [1.74, -0.01]],
    );
    P.push({ t: 'fn', f: inf ? (x, y, z) => f(x, y, z) - I : f, c: [0, (lo + hi) / 2, 0], ext: [0.2 * Math.max(sh, hp) * W + bl * 0.03 + I + 0.01, (hi - lo) / 2 + 0.01, 0.15 + bl * 0.06 + I], bone: B.chest, k: 0.05, tag: tagBase + 1 });
    // spine weighting: the lower trunk follows the pelvis
    P.push({ t: 'ellipsoid', c: [0, 1.06, -0.005], r: [0.15 * hp * W + I - 0.01, 0.1 + I, 0.1 + I], bone: B.pelvis, k: 0.06, tag: tagBase + 13 });
  }
  if (want('torso')) {
    for (const s of [-1, 1]) {
      // shoulder cap (deltoid) — rounds the shoulder into the arm without a "ball joint" look
      P.push({ t: 'ellipsoid', c: [s * (J.sx - 0.006), 1.588, -0.006], r: [0.06 * Math.min(w, 1.12) + I, 0.074 + I, 0.064 + I], rot: [0, 0, s * 0.5], bone: s < 0 ? B.upperArmL : B.upperArmR, k: 0.05, tag: tagBase + (s < 0 ? 3 : 4) });
    }
  }
  if (want('neck')) P.push({ t: 'cone', a: [0, 1.62, -0.012], b: [0, 1.93, 0.0], ra: r.neck + 0.01 + I, rb: r.neck - 0.006 + I, bone: B.neck, k: 0.07, tag: tagBase + 2 });
  for (const [side, s] of [[-1, 0], [1, 1]] as const) {
    const ua = s ? B.upperArmR : B.upperArmL;
    const S = pos[ua], E = pos[ua + 1], W = pos[ua + 2];
    if (want('upperArm')) {
      // starts below the joint so its rounded end hides inside the shoulder cap
      P.push({ t: 'cone', a: add(S, [0, -0.045, 0]), b: E, ra: r.upperArm + 0.002 + I, rb: r.upperArm * 0.82 + I, bone: ua, k: 0.04, tag: tagBase + 3 + s });
      // biceps / triceps mass
      P.push({ t: 'ellipsoid', c: lerp(S, E, 0.45), r: [r.upperArm * 0.96 + I, 0.1 + I, r.upperArm * 1.02 + I], bone: ua, k: 0.04, tag: tagBase + 3 + s });
    }
    if (want('foreArm')) {
      // elbow, then a forearm that's fuller near the elbow and slims to the wrist
      P.push({ t: 'sphere', c: add(E, [0, 0, -0.008]), r: r.upperArm * 0.8 + I, bone: ua + 1, k: 0.035, tag: tagBase + 5 + s });
      P.push({ t: 'cone', a: E, b: W, ra: r.foreArm + I, rb: r.wrist * 0.97 + I, bone: ua + 1, k: 0.04, tag: tagBase + 5 + s });
      P.push({ t: 'ellipsoid', c: lerp(E, W, 0.3), r: [r.foreArm * 1.02 + I, 0.085 + I, r.foreArm * 1.05 + I], bone: ua + 1, k: 0.04, tag: tagBase + 5 + s });
    }
    const th = s ? B.thighR : B.thighL;
    const H = pos[th], K = pos[th + 1], A = pos[th + 2];
    if (want('thigh')) {
      P.push({ t: 'cone', a: add(H, [0, 0.03, 0]), b: K, ra: r.thigh + I, rb: r.knee + 0.004 + I, bone: th, k: 0.06, tag: tagBase + 7 + s });
      P.push({ t: 'ellipsoid', c: add(lerp(H, K, 0.38), [side * 0.006, 0, 0.012]), r: [r.thigh * 0.95 + I, 0.19 + I, r.thigh * 0.95 + I], bone: th, k: 0.05, tag: tagBase + 7 + s });
    }
    if (want('shin')) {
      P.push({ t: 'sphere', c: add(K, [0, 0.0, 0.012]), r: r.knee + I, bone: th + 1, k: 0.04, tag: tagBase + 9 + s });
      P.push({ t: 'cone', a: K, b: A, ra: r.knee * 0.95 + I, rb: r.ankle + I, bone: th + 1, k: 0.04, tag: tagBase + 9 + s });
      // calf muscle (behind, upper half)
      P.push({ t: 'ellipsoid', c: add(lerp(K, A, 0.3), [side * -0.004, 0, -0.018]), r: [r.calf + I, 0.13 + I, r.calf * 1.05 + I], bone: th + 1, k: 0.05, tag: tagBase + 9 + s });
    }
    if (want('foot')) {
      const ft = th + 2;
      // heel, arch and toes — a foot silhouette, not a ball
      P.push({ t: 'ellipsoid', c: add(A, [0, -0.045, -0.025]), r: [0.044 + I, 0.05 + I, 0.055 + I], bone: ft, k: 0.03, tag: tagBase + 11 + s });
      P.push({ t: 'ellipsoid', c: add(A, [side * 0.004, -0.06, 0.06]), r: [0.05 + I, 0.034 + I, 0.1 + I], bone: ft, k: 0.04, tag: tagBase + 11 + s });
      P.push({ t: 'ellipsoid', c: add(A, [side * 0.006, -0.072, 0.135]), r: [0.052 + I, 0.024 + I, 0.05 + I], bone: ft, k: 0.03, tag: tagBase + 11 + s });
    }
  }
  return P;
}

/** Arms melt into the shoulder but stay free of the ribs and hips below the armpit. */
export const armBlend = (y: number) => (y > 1.52 ? 0.075 : y > 1.42 ? 0.006 + 0.069 * ((y - 1.42) / 0.1) : 0.006);

/** The full nude body: trunk + legs as one part, each arm its own part, flat soles. */
export function bodyParts(J: Joints): Part[] {
  const sole = [{ o: [0, 0.003, 0] as V3, n: [0, -1, 0] as V3, k: 0.01 }];
  const trunk = bodyPrims(J, 0, ['pelvis', 'torso', 'neck', 'thigh', 'shin', 'foot']).filter((p) => p.bone !== B.upperArmL && p.bone !== B.upperArmR);
  const arm = (side: number) => bodyPrims(J, 0, ['torso', 'upperArm', 'foreArm']).filter((p) => (side < 0 ? [B.upperArmL, B.foreArmL] : [B.upperArmR, B.foreArmR]).includes(p.bone as never));
  return [
    { prims: trunk, clips: sole },
    { prims: arm(-1), kAt: (_x, y) => armBlend(y) },
    { prims: arm(1), kAt: (_x, y) => armBlend(y) },
  ];
}

/**
 * One hand (with a short wrist that tucks into the forearm). Each finger is its own part
 * that blends into the palm but stays separate from its neighbours.
 */
export function handParts(J: Joints, side: -1 | 1): Part[] {
  const s = side < 0 ? 0 : 1;
  const hb = s ? B.handR : B.handL;
  const W = J.pos[hb];
  const palmIn = -side;
  const L = handLayout(side);
  const at = (v: V3): V3 => add(W, v);
  const palm: Prim[] = [
    // wrist (overlaps the forearm end so the join is hidden inside it)
    { t: 'cone', a: at([0, 0.05, 0]), b: at([0, -0.014, 0]), ra: J.r.wrist * 0.99, rb: J.r.wrist * 0.98, bone: s ? B.foreArmR : B.foreArmL, k: 0.02 },
    // palm: soft rounded slab, thicker at the heel, a touch wider at the knuckles
    { t: 'box', c: at([palmIn * 0.002, -0.056, 0.0]), s: [0.0175, 0.042, 0.04], round: 0.016, bone: hb, k: 0.022 },
    { t: 'ellipsoid', c: at([palmIn * 0.008, -0.03, 0.022]), r: [0.017, 0.03, 0.022], bone: hb, k: 0.02 }, // thumb pad (thenar)
    { t: 'ellipsoid', c: at([palmIn * 0.006, -0.045, -0.024]), r: [0.014, 0.034, 0.014], bone: hb, k: 0.02 }, // outer palm edge
    // knuckle line
    { t: 'cone', a: at([palmIn * -0.002, -0.092, 0.029]), b: at([palmIn * -0.002, -0.09, -0.028]), ra: 0.012, rb: 0.0108, bone: hb, k: 0.016 },
  ];
  const parts: Part[] = [{ prims: palm }];
  L.forEach((f, fi) => {
    const b0 = fingerBone(s, fi, 0), b1 = fingerBone(s, fi, 1);
    const prims: Prim[] =
      fi === 0
        ? [
            { t: 'cone', a: at([palmIn * 0.004, -0.026, 0.02]), b: at(f.base), ra: 0.0145, rb: f.r0, bone: hb, k: 0.012 },
            { t: 'cone', a: at(f.base), b: at(f.mid), ra: f.r0, rb: f.r1, bone: b0, k: 0.01 },
            { t: 'cone', a: at(f.mid), b: at(f.tip), ra: f.r1, rb: f.r2, bone: b1, k: 0.008 },
          ]
        : [
            { t: 'cone', a: at(add(f.base, [0, 0.012, 0])), b: at(f.mid), ra: f.r0, rb: f.r1, bone: b0, k: 0.008 },
            // subtle knuckle bump on the back of the finger
            { t: 'sphere', c: at(add(f.mid, [palmIn * -0.003, 0, 0])), r: f.r1 * 1.02, bone: b1, k: 0.008 },
            { t: 'cone', a: at(f.mid), b: at(f.tip), ra: f.r1, rb: f.r2, bone: b1, k: 0.008 },
          ];
    parts.push({ prims, k: fi === 0 ? 0.014 : 0.01 });
  });
  return parts;
}
