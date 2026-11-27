import type { BodyP } from '../look/face';
import { loft2, type Prim, type Part, type V3 } from './sdf';

/**
 * The sculpted base body — a premium stylised adult, masculine or feminine (`bp.fem`).
 *
 * Everything is ONE continuous skin, sculpted from anatomical masses that melt into each other:
 * a lofted trunk with separate front / back profiles (chest, upper back, lumbar curve, seat),
 * clavicles, pecs or a soft chest, shoulder blades, a spine groove, a muscular neck, deltoids,
 * biceps / triceps, elbows, a flattened wrist, quads, hamstrings, kneecaps, two-headed calves
 * and ankle bones. Hands and feet (fingers, toes, nails) are meshed separately at a finer
 * resolution and tuck invisibly into the wrist / ankle. Every mass is tied to a skeleton bone.
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

/** Rest-pose arm abduction (radians): the skin is sculpted with the arms this far from the sides. */
export const REST_ARM = 0.17;

/** Head centre in body space (the face/hair rig hangs off it) and its scale. */
export const HEAD_Y = 2.03;
export const HEAD_SCALE = 0.8;

export interface Joints {
  /** world-space rest position of every bone */
  pos: V3[];
  bp: BodyP;
  /** 0 masculine … 1 feminine */
  fem: number;
  /** frequently used radii */
  r: { upperArm: number; foreArm: number; wrist: number; thigh: number; knee: number; calf: number; ankle: number; neck: number };
  /** x of the shoulder / hip joints (left side is −x) */
  sx: number;
  hx: number;
  /** hand / foot scale */
  handS: number;
  footS: number;
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const mirror = (v: V3, side: number): V3 => [v[0] * side, v[1], v[2]];
export { add, lerp };

export function joints(bp: BodyP): Joints {
  const F = bp.fem ?? 0;
  const w = bp.width, sh = bp.shoulders, hp = bp.hips;
  const sx = (0.224 - 0.024 * F) * sh * w + 0.012;
  const hx = (0.104 + 0.006 * F) * hp * w;
  const handS = 1.16 - 0.12 * F, footS = 1.06 - 0.1 * F;
  const pos: V3[] = new Array(BONE_COUNT);
  pos[B.pelvis] = [0, 1.05, 0];
  pos[B.chest] = [0, 1.36, 0];
  pos[B.neck] = [0, 1.72, -0.01];
  pos[B.head] = [0, 1.86, 0];
  for (const [side, s] of [[-1, 0], [1, 1]] as const) {
    const ua = s ? B.upperArmR : B.upperArmL;
    pos[ua] = [side * sx, 1.612, -0.008];
    // relaxed A-pose: the arms are sculpted angled away from the body (REST_ARM), so the arm
    // and the hip never touch in the source mesh — no skin webbing when the arm moves
    const ux = Math.sin(REST_ARM), uy = Math.cos(REST_ARM);
    pos[ua + 1] = [side * (sx + 0.008 + 0.282 * ux), 1.612 - 0.282 * uy, -0.016];
    pos[ua + 2] = [side * (sx + 0.012 + 0.542 * ux), 1.612 - 0.542 * uy, 0.0];
    const th = s ? B.thighR : B.thighL;
    pos[th] = [side * hx, 0.985, 0];
    pos[th + 1] = [side * (hx - 0.004), 0.56, 0.008];
    pos[th + 2] = [side * (hx + 0.002), 0.105, -0.014];
    const wr = pos[ua + 2];
    const h = handLayout(side, handS);
    for (let f = 0; f < 5; f++) {
      pos[fingerBone(s, f, 0)] = add(wr, h[f].base);
      pos[fingerBone(s, f, 1)] = add(wr, h[f].mid);
    }
  }
  const k = Math.min(w, 1.14);
  const mF = 1 - 0.12 * F; // feminine limbs are slimmer, thighs fuller
  return {
    pos,
    bp,
    fem: F,
    sx,
    hx,
    handS,
    footS,
    r: {
      upperArm: 0.061 * k * mF,
      foreArm: 0.053 * k * mF,
      wrist: 0.04 * Math.min(w, 1.06) * (1 - 0.1 * F),
      thigh: (0.104 + 0.012 * F) * Math.min(w * hp, 1.22),
      knee: 0.072 * k * (1 - 0.06 * F),
      calf: 0.079 * k * (1 - 0.06 * F),
      ankle: 0.046 * k * (1 - 0.08 * F),
      neck: (0.094 - 0.014 * F) * k,
    },
  };
}

// ---------------------------------------------------------------------------- hand layout

interface FingerLayout { base: V3; mid: V3; dip: V3; tip: V3; r0: number; r1: number; r2: number }
/** Finger joints relative to the wrist for one side (rest pose, palm toward the body). */
export function handLayout(side: number, S = 1): FingerLayout[] {
  // z = front/back (index in front), x toward the body = palm side, y down along the hand
  const palmIn = -side; // palm faces the thigh: +x for the left hand, −x for the right
  const F = (z: number, len: number, r: number, spread: number): FingerLayout => {
    const base: V3 = scl([palmIn * 0.003, -0.094, z], S);
    const dir: V3 = [palmIn * 0.08, -1, spread];
    const n = Math.hypot(...dir);
    const d: V3 = [dir[0] / n, dir[1] / n, dir[2] / n];
    const L = len * S;
    // phalanx lengths ≈ 0.45 : 0.3 : 0.25 of the finger, curling slightly toward the palm
    const mid = add(base, scl(d, L * 0.45));
    const dip = add(mid, add(scl(d, L * 0.3), [palmIn * 0.002 * S, 0, 0]));
    const tip = add(dip, add(scl(d, L * 0.25), [palmIn * 0.003 * S, 0, 0]));
    return { base, mid, dip, tip, r0: r * 0.9 * S, r1: r * 0.8 * S, r2: r * 0.72 * S };
  };
  const tb: V3 = scl([palmIn * 0.014, -0.046, 0.034], S);
  const tm: V3 = scl([palmIn * 0.027, -0.081, 0.055], S);
  const td: V3 = scl([palmIn * 0.03, -0.101, 0.06], S);
  const tt: V3 = scl([palmIn * 0.032, -0.118, 0.062], S);
  return [
    { base: tb, mid: tm, dip: td, tip: tt, r0: 0.0128 * S, r1: 0.0112 * S, r2: 0.0098 * S },
    F(0.0285, 0.08, 0.0108, 0.1),
    F(0.0095, 0.089, 0.0112, 0.02),
    F(-0.0095, 0.083, 0.0106, -0.06),
    F(-0.027, 0.066, 0.0094, -0.15),
  ];
}

// ---------------------------------------------------------------------------- body volumes

/**
 * Body volumes. `inf` inflates everything (clothing is the same anatomy, puffed out a little).
 * `only` picks regions, so a garment can reuse just the torso, arms or legs.
 */
export type Region = 'torso' | 'neck' | 'upperArm' | 'foreArm' | 'thigh' | 'shin' | 'foot' | 'pelvis';

export function bodyPrims(J: Joints, inf = 0, only?: Region[], tagBase = 0): Prim[] {
  const { pos, bp, r } = J;
  const F = J.fem;
  const w = bp.width, hp = bp.hips, sh = bp.shoulders, bl = bp.belly;
  const want = (g: Region) => !only || only.includes(g);
  const P: Prim[] = [];
  const I = inf;
  // muscle detail fades out on clothing (it shouldn't show through a puffer)
  // clothing keeps the body's forms (so it never shows skin through), softened as it loosens
  const detail = Math.max(0, 1 - inf / 0.02);
  // tags: 1 torso, 2 neck, 3 upper arm L, 4 upper arm R, 5 forearm L, 6 forearm R, 7 thigh L, 8 thigh R, 9 shin L, 10 shin R, 11 foot L, 12 foot R, 13 pelvis

  if (want('torso') || want('pelvis')) {
    // The trunk, lofted from the hips to the neck. Width, front depth and back depth follow
    // their own curves: wide hips → waist → ribcage → chest → sloping shoulders, with the chest
    // forward, the upper back rounded, the lower back curving in and the seat behind.
    const lo = want('pelvis') ? 0.9 : 1.12, hi = want('torso') ? 1.75 : 1.16;
    const W = w;
    const f = loft2(
      lo,
      hi,
      [
        [0.9, 0.06 * hp * W], [0.94, (0.13 + 0.012 * F) * hp * W], [0.99, (0.176 + 0.018 * F) * hp * W], [1.05, (0.17 + 0.016 * F) * hp * W],
        [1.14, (0.146 - 0.012 * F + bl * 0.02) * W], [1.21, (0.14 - 0.026 * F + bl * 0.03) * W], [1.3, (0.155 - 0.012 * F + bl * 0.02) * W],
        [1.42, (0.162 - 0.014 * F) * sh * W], [1.52, (0.172 - 0.02 * F) * sh * W], [1.6, (0.182 - 0.026 * F) * sh * W],
        [1.66, (0.15 - 0.018 * F) * sh], [1.71, 0.1 - 0.008 * F], [1.75, 0.078 - 0.008 * F],
      ],
      [
        [0.9, 0.04], [0.94, 0.07], [0.99, 0.09], [1.08, 0.094 + bl * 0.05], [1.16, 0.09 + bl * 0.07], [1.24, 0.088 + bl * 0.06],
        [1.33, 0.096 + bl * 0.02], [1.43, 0.112 + 0.006 * F], [1.52, 0.108], [1.6, 0.088], [1.67, 0.072], [1.75, 0.064],
      ],
      [
        [0.9, 0.05], [0.94, 0.1 + 0.01 * F], [0.99, 0.124 + 0.016 * F], [1.05, 0.11 + 0.01 * F], [1.13, 0.088], [1.2, 0.084],
        [1.3, 0.094], [1.42, 0.108], [1.52, 0.114], [1.6, 0.104], [1.67, 0.08], [1.75, 0.066],
      ],
    );
    const ext: V3 = [0.22 * Math.max(sh, hp) * W + bl * 0.04 + I + 0.02, (hi - lo) / 2 + 0.01, 0.16 + bl * 0.08 + I];
    // clothing ease stays off the sides at armpit height: a garment wider than the armpit would fuse
    // with its sleeves and stretch into a web when the arms lift
    const pit = (x: number, y: number) => {
      const ty = Math.max(0, 1 - Math.abs(y - 1.47) / 0.13);
      const tx = Math.min(1, Math.max(0, (Math.abs(x) - 0.1) / 0.06));
      return ty * ty * (3 - 2 * ty) * tx;
    };
    P.push({ t: 'fn', f: inf ? (x, y, z) => f(x, y, z) - I * (1 - 0.85 * pit(x, y)) : f, c: [0, (lo + hi) / 2, 0], ext, bone: B.chest, k: 0.05, tag: tagBase + 1 });
    // lower trunk follows the pelvis (skin weights)
    P.push({ t: 'ellipsoid', c: [0, 1.04, -0.01], r: [0.11 * hp * W + I, 0.08 + I, 0.07 + I], bone: B.pelvis, k: 0.06, tag: tagBase + 13 });
  }
  if (want('pelvis')) {
    // seat
    for (const s of [-1, 1]) P.push({ t: 'ellipsoid', c: [s * (0.06 + 0.008 * F) * hp * w, 0.97, -0.052 - 0.008 * F], r: [0.072 * hp + 0.008 * F + I, 0.088 + I, 0.07 + 0.01 * F + I], bone: B.pelvis, k: 0.07, tag: tagBase + 13 });
  }
  if (want('torso')) {
    for (const s of [-1, 1]) {
      if (detail > 0) {
        if (F < 0.5) {
          // pectorals: a broad, flat plane with a soft lower edge
          P.push({ t: 'ellipsoid', c: [s * 0.072 * sh * w, 1.47, 0.07], r: [0.07 * sh + I, 0.052 + I, 0.04 + I], rot: [0, s * 0.25, s * -0.15], bone: B.chest, k: 0.045 * detail, tag: tagBase + 1 });
        } else {
          // feminine chest: a gentle, neutral volume (mannequin-like)
          P.push({ t: 'ellipsoid', c: [s * 0.066 * w, 1.43, 0.07], r: [0.062 + I, 0.058 + I, 0.052 + I], rot: [0.2, s * 0.25, 0], bone: B.chest, k: 0.05 * detail, tag: tagBase + 1 });
        }
        // shoulder blades
        P.push({ t: 'ellipsoid', c: [s * 0.084 * sh * w, 1.5, -0.094], r: [0.056 + I, 0.07 + I, 0.022 + I], rot: [0, s * -0.35, s * 0.15], bone: B.chest, k: 0.05 * detail, tag: tagBase + 1 });
        // collarbones
        P.push({ t: 'cone', a: [s * 0.03, 1.69, 0.045], b: [s * (J.sx - 0.03), 1.655, 0.02], ra: 0.011 + I, rb: 0.012 + I, bone: B.chest, k: 0.03 * detail, tag: tagBase + 1 });
      }
      // shoulder cap (deltoid) — rounds the shoulder into the arm (no "ball joint")
      P.push({ t: 'ellipsoid', c: [s * (J.sx - 0.006), 1.588, -0.008], r: [0.058 * Math.min(w, 1.14) * (1 - 0.1 * F) + I, 0.07 + I, 0.062 + I], rot: [0, 0, s * 0.5], bone: s < 0 ? B.upperArmL : B.upperArmR, k: 0.06, tag: tagBase + (s < 0 ? 3 : 4) });
    }
  }
  if (want('neck')) {
    P.push({ t: 'cone', a: [0, 1.6, -0.016], b: [0, 1.93, 0.0], ra: r.neck + 0.012 + I, rb: r.neck - 0.006 + I, bone: B.neck, k: 0.07, tag: tagBase + 2 });
    if (detail > 0) {
      // the two neck muscles running from behind the ears down to the collarbone notch
      for (const s of [-1, 1]) P.push({ t: 'cone', a: [s * 0.05, 1.9, -0.012], b: [s * 0.016, 1.68, 0.052], ra: 0.016 + I, rb: 0.012 + I, bone: B.neck, k: 0.03 * detail, tag: tagBase + 2 });
      // nape / trapezius rise behind
      P.push({ t: 'ellipsoid', c: [0, 1.7, -0.055], r: [0.09 + I, 0.06 + I, 0.04 + I], bone: B.chest, k: 0.05 * detail, tag: tagBase + 2 });
    }
  }
  for (const [side, s] of [[-1, 0], [1, 1]] as const) {
    const ua = s ? B.upperArmR : B.upperArmL;
    const S = pos[ua], E = pos[ua + 1], Wr = pos[ua + 2];
    if (want('upperArm')) {
      // starts below the joint so its rounded end hides inside the shoulder cap
      P.push({ t: 'cone', a: add(S, [0, -0.045, 0]), b: E, ra: r.upperArm + I, rb: r.upperArm * 0.78 + I, bone: ua, k: 0.04, tag: tagBase + 3 + s });
      // biceps (front) and triceps (back) — the arm reads round-but-shaped, not as a tube
      P.push({ t: 'ellipsoid', c: add(lerp(S, E, 0.52), [0, 0, 0.014]), r: [r.upperArm * 0.86 + I, 0.085 + I, r.upperArm * 0.8 + I], bone: ua, k: 0.04, tag: tagBase + 3 + s });
      P.push({ t: 'ellipsoid', c: add(lerp(S, E, 0.38), [side * 0.004, 0, -0.016]), r: [r.upperArm * 0.84 + I, 0.1 + I, r.upperArm * 0.8 + I], bone: ua, k: 0.04, tag: tagBase + 3 + s });
    }
    if (want('foreArm')) {
      // elbow: a soft joint with the point of the elbow behind
      P.push({ t: 'sphere', c: add(E, [0, 0, -0.006]), r: r.upperArm * 0.76 + I, bone: ua + 1, k: 0.035, tag: tagBase + 5 + s });
      if (detail > 0) P.push({ t: 'ellipsoid', c: add(E, [0, 0.004, -0.04]), r: [0.018 + I, 0.022 + I, 0.014 + I], bone: ua + 1, k: 0.02 * detail, tag: tagBase + 5 + s });
      // forearm: full near the elbow (outer muscle bulge), slimming into a flattened wrist
      P.push({ t: 'cone', a: E, b: add(Wr, [0, 0.03, 0]), ra: r.foreArm + I, rb: r.wrist * 0.82 + I, bone: ua + 1, k: 0.04, tag: tagBase + 5 + s });
      P.push({ t: 'ellipsoid', c: add(lerp(E, Wr, 0.28), [side * 0.008, 0, 0.004]), r: [r.foreArm * 0.96 + I, 0.09 + I, r.foreArm * 1.04 + I], bone: ua + 1, k: 0.04, tag: tagBase + 5 + s });
      P.push({ t: 'ellipsoid', c: add(Wr, [0, 0.05, 0]), r: [r.wrist * 0.74 + I, 0.06 + I, r.wrist * 1.0 + I], bone: ua + 1, k: 0.03, tag: tagBase + 5 + s });
    }
    const th = s ? B.thighR : B.thighL;
    const H = pos[th], K = pos[th + 1], A = pos[th + 2];
    if (want('thigh')) {
      P.push({ t: 'cone', a: add(H, [0, 0.0, 0]), b: K, ra: r.thigh + I, rb: r.knee + 0.004 + I, bone: th, k: 0.06, tag: tagBase + 7 + s });
      // quads (front, outer sweep) and hamstrings (back); inner thigh fullness
      P.push({ t: 'ellipsoid', c: add(lerp(H, K, 0.45), [side * 0.008, 0, 0.022]), r: [r.thigh * 0.86 + I, 0.19 + I, r.thigh * 0.78 + I], bone: th, k: 0.06, tag: tagBase + 7 + s });
      P.push({ t: 'ellipsoid', c: add(lerp(H, K, 0.38), [0, 0, -0.024]), r: [r.thigh * 0.82 + I, 0.2 + I, r.thigh * 0.74 + I], bone: th, k: 0.05, tag: tagBase + 7 + s });
      P.push({ t: 'ellipsoid', c: add(lerp(H, K, 0.3), [side * -0.01, 0, 0]), r: [r.thigh * 0.7 + 0.01 * F + I, 0.16 + I, r.thigh * 0.8 + I], bone: th, k: 0.05, tag: tagBase + 7 + s });
    }
    if (want('shin')) {
      // knee: joint mass + kneecap in front
      P.push({ t: 'sphere', c: add(K, [0, 0, 0.006]), r: r.knee + I, bone: th + 1, k: 0.04, tag: tagBase + 9 + s });
      if (detail > 0) P.push({ t: 'ellipsoid', c: add(K, [0, 0.01, 0.05]), r: [0.034 + I, 0.04 + I, 0.022 + I], bone: th + 1, k: 0.03 * detail, tag: tagBase + 9 + s });
      // shin to ankle; the calf has an inner (lower, fuller) and outer head
      P.push({ t: 'cone', a: K, b: add(A, [0, inf ? 0.02 : 0.05, 0]), ra: r.knee * 0.92 + I, rb: r.ankle * (inf ? 1 : 0.86) + I, bone: th + 1, k: 0.04, tag: tagBase + 9 + s });
      P.push({ t: 'ellipsoid', c: add(lerp(K, A, 0.3), [side * -0.014, 0, -0.022]), r: [r.calf * 0.74 + I, 0.12 + I, r.calf * 0.86 + I], bone: th + 1, k: 0.05, tag: tagBase + 9 + s });
      P.push({ t: 'ellipsoid', c: add(lerp(K, A, 0.25), [side * 0.016, 0, -0.018]), r: [r.calf * 0.66 + I, 0.11 + I, r.calf * 0.8 + I], bone: th + 1, k: 0.05, tag: tagBase + 9 + s });
    }
    if (want('foot')) {
      // the foot mass for clothing (socks): heel, arch and forefoot. (The bare foot with toes
      // is meshed finely on its own — see footParts.)
      const ft = th + 2, fs = J.footS;
      P.push({ t: 'ellipsoid', c: add(A, [0, -0.05, -0.028 * fs]), r: [0.044 * fs + I, 0.05 + I, 0.055 * fs + I], bone: ft, k: 0.03, tag: tagBase + 11 + s });
      P.push({ t: 'ellipsoid', c: add(A, [side * 0.004, -0.064, 0.06 * fs]), r: [0.05 * fs + I, 0.034 + I, 0.1 * fs + I], bone: ft, k: 0.04, tag: tagBase + 11 + s });
      P.push({ t: 'ellipsoid', c: add(A, [side * 0.006, -0.076, 0.14 * fs]), r: [0.054 * fs + I, 0.024 + I, 0.055 * fs + I], bone: ft, k: 0.03, tag: tagBase + 11 + s });
    }
  }
  return P;
}

/** Legs melt into the hips and seat, but stay separate from each other below the crotch. */
export const legBlend = (y: number) => (y > 1.0 ? 0.07 : y > 0.9 ? 0.006 + 0.064 * ((y - 0.9) / 0.1) : 0.006);

/** Half-width of the hips (widest point) — arms hanging by the sides must clear it. */
export const hipHalfWidth = (bp: BodyP) => (0.178 + 0.018 * (bp.fem ?? 0)) * bp.hips * bp.width;
/** Extra arm abduction (radians) so the hands hang clear of wide hips. */
export const hipArmClearance = (bp: BodyP) => Math.max(0, (hipHalfWidth(bp) - 0.17) / 0.5);

/** Arms melt into the shoulder but stay free of the ribs and hips below the armpit. */
export const armBlend = (y: number) => (y > 1.52 ? 0.075 : y > 1.42 ? 0.006 + 0.069 * ((y - 1.42) / 0.1) : 0.006);

/** The base skin: trunk + legs as one part, each arm its own part. Feet & hands are separate. */
export function bodyParts(J: Joints): Part[] {
  const all = bodyPrims(J, 0, ['pelvis', 'torso', 'neck', 'thigh', 'shin']);
  const legBones = (side: number) => (side < 0 ? [B.thighL, B.shinL] : [B.thighR, B.shinR]) as number[];
  const isLeg = (p: { bone?: number }) => legBones(-1).includes(p.bone as number) || legBones(1).includes(p.bone as number);
  const trunk = all.filter((p) => p.bone !== B.upperArmL && p.bone !== B.upperArmR && !isLeg(p));
  const leg = (side: number) => all.filter((p) => legBones(side).includes(p.bone as number));
  const arm = (side: number) => bodyPrims(J, 0, ['torso', 'upperArm', 'foreArm']).filter((p) => (side < 0 ? [B.upperArmL, B.foreArmL] : [B.upperArmR, B.foreArmR]).includes(p.bone as never));
  return [
    { prims: trunk },
    { prims: arm(-1), kAt: (_x, y) => armBlend(y) },
    { prims: arm(1), kAt: (_x, y) => armBlend(y) },
    // each leg is its own part: it melts into the hip, but the two legs never web together
    { prims: leg(-1), kAt: (_x, y) => legBlend(y) },
    { prims: leg(1), kAt: (_x, y) => legBlend(y) },
  ];
}

// ---------------------------------------------------------------------------- hands

/**
 * One hand (with a short wrist that tucks into the forearm). Each finger is its own part that
 * blends into the palm but stays separate from its neighbours: three phalanges with soft joint
 * creases, a rounded pad under the tip, and knuckles on the back of the hand.
 */
export function handParts(J: Joints, side: -1 | 1): Part[] {
  const s = side < 0 ? 0 : 1;
  const hb = s ? B.handR : B.handL;
  const Wp = J.pos[hb];
  const S = J.handS;
  const palmIn = -side;
  const L = handLayout(side, S);
  const at = (v: V3): V3 => add(Wp, v);
  const v = (x: number, y: number, z: number): V3 => at(scl([x, y, z], S));
  const palm: Prim[] = [
    // wrist (overlaps the forearm end so the join is hidden inside it); flattened like a real wrist
    { t: 'ellipsoid', c: at([0, 0.03, 0]), r: [J.r.wrist * 0.8, 0.05, J.r.wrist * 1.06], bone: s ? B.foreArmR : B.foreArmL, k: 0.02 },
    { t: 'ellipsoid', c: at([0, -0.012, 0]), r: [J.r.wrist * 0.74, 0.03, J.r.wrist * 1.12], bone: hb, k: 0.02 },
    // palm: a soft slab, thicker at the heel, a touch wider at the knuckles
    { t: 'box', c: v(palmIn * 0.002, -0.056, 0.0), s: [0.0168 * S, 0.042 * S, 0.039 * S], round: 0.015 * S, bone: hb, k: 0.022 },
    { t: 'ellipsoid', c: v(palmIn * 0.01, -0.034, 0.024), r: [0.018 * S, 0.032 * S, 0.023 * S], rot: [0.35, 0, 0], bone: hb, k: 0.024 }, // thumb pad (thenar)
    { t: 'ellipsoid', c: v(palmIn * 0.007, -0.048, -0.024), r: [0.014 * S, 0.034 * S, 0.014 * S], bone: hb, k: 0.02 }, // outer palm edge
    // knuckles: four bumps across the back of the hand
    ...[0.0285, 0.0095, -0.0095, -0.027].map((z, i): Prim => ({ t: 'sphere', c: v(palmIn * -0.006, -0.092, z * (1 - i * 0.02)), r: (0.0112 - i * 0.0006) * S, bone: hb, k: 0.016 })),
  ];
  const parts: Part[] = [{ prims: palm }];
  L.forEach((f, fi) => {
    const b0 = fingerBone(s, fi, 0), b1 = fingerBone(s, fi, 1);
    const pad = (c: V3, r: number, b: number): Prim => ({ t: 'ellipsoid', c: add(c, [palmIn * r * 0.35, 0, 0]), r: [r * 0.75, r * 1.25, r * 0.9], bone: b, k: 0.006 });
    const prims: Prim[] =
      fi === 0
        ? [
            { t: 'cone', a: v(palmIn * 0.004, -0.026, 0.02), b: at(f.base), ra: 0.0145 * S, rb: f.r0, bone: hb, k: 0.012 },
            { t: 'cone', a: at(f.base), b: at(f.mid), ra: f.r0, rb: f.r1, bone: b0, k: 0.009 },
            { t: 'cone', a: at(f.mid), b: at(f.dip), ra: f.r1, rb: f.r1 * 0.98, bone: b1, k: 0.006 },
            { t: 'cone', a: at(f.dip), b: at(f.tip), ra: f.r1 * 0.98, rb: f.r2, bone: b1, k: 0.006 },
            pad(at(lerp(f.dip, f.tip, 0.55)), f.r2 * 0.8, b1),
          ]
        : [
            { t: 'cone', a: at(add(f.base, [0, 0.012 * S, 0])), b: at(f.mid), ra: f.r0, rb: f.r1, bone: b0, k: 0.007 },
            // the middle joint is a hair fuller (a soft crease either side of it)
            { t: 'sphere', c: at(add(f.mid, [palmIn * -0.002 * S, 0, 0])), r: f.r1 * 1.03, bone: b1, k: 0.006 },
            { t: 'cone', a: at(f.mid), b: at(f.dip), ra: f.r1 * 0.97, rb: f.r1 * 0.9, bone: b1, k: 0.006 },
            { t: 'sphere', c: at(f.dip), r: f.r1 * 0.92, bone: b1, k: 0.005 },
            { t: 'cone', a: at(f.dip), b: at(f.tip), ra: f.r1 * 0.88, rb: f.r2 * 0.92, bone: b1, k: 0.005 },
            pad(at(lerp(f.dip, f.tip, 0.6)), f.r2 * 0.78, b1),
          ];
    parts.push({ prims, k: fi === 0 ? 0.02 : 0.01 });
  });
  return parts;
}

/** Fingernails (and toenails): thin rounded plates on the backs of the fingertips. */
export function nailPrims(J: Joints, side: -1 | 1): Prim[] {
  const s = side < 0 ? 0 : 1;
  const Wp = J.pos[s ? B.handR : B.handL];
  const palmIn = -side;
  return handLayout(side, J.handS).map((f, fi) => {
    const c = add(Wp, lerp(f.dip, f.tip, 0.55));
    const dir = [f.tip[0] - f.dip[0], f.tip[1] - f.dip[1], f.tip[2] - f.dip[2]];
    const tilt = Math.atan2(dir[2], -dir[1]);
    return {
      t: 'ellipsoid' as const,
      c: add(c, [palmIn * -f.r2 * 0.66, 0, 0]),
      r: [f.r2 * 0.2, f.r2 * 1.0, f.r2 * 0.7] as V3,
      rot: [tilt, 0, fi === 0 ? palmIn * 0.5 : 0] as V3,
      bone: fingerBone(s, fi, 1),
      k: 0,
    };
  });
}

// ---------------------------------------------------------------------------- feet

/**
 * One bare foot, finely sculpted: heel, a raised arch on the inside, the ball of the foot and
 * five toes (the big toe fuller, the others stepping down and curling slightly), with the ankle
 * tucked up into the shin.
 */
export function footParts(J: Joints, side: -1 | 1): Part[] {
  const s = side < 0 ? 0 : 1;
  const th = s ? B.thighR : B.thighL;
  const ft = th + 2;
  const A = J.pos[ft];
  const S = J.footS;
  const inner = -side; // the big toe / arch side faces the other foot
  const v = (x: number, y: number, z: number): V3 => add(A, [x * S, y, z * S]);
  // the shin's radius at a height above the ankle (matches bodyPrims' shin cone)
  const K = J.pos[th + 1];
  const rK = J.r.knee * 0.92, rA = J.r.ankle * 0.86, yA = A[1] + 0.05;
  const shinR = (dy: number) => rA + ((rK - rA) * (A[1] + dy - yA)) / (K[1] - yA);
  const sole: Prim[] = [
    // ankle stub (hidden inside the shin) and the instep rising from it
    // ankle sleeve: follows the shin's own taper a hair outside it, so the two meshes meet
    // tangentially (no seam); the flare into the foot comes from the heel / instep below
    { t: 'cone', a: add(A, [0, 0.11, 0]), b: add(A, [0, 0.01, 0]), ra: shinR(0.11) + 0.0008, rb: shinR(0.01) + 0.0008, bone: th + 1, k: 0.0 },
    // ankle bones: the inner one sits higher and further forward than the outer one
    ...[-1, 1].map((m): Prim => ({ t: 'sphere', c: add(A, [side * m * J.r.ankle * 0.78, 0.012 + (m === -1 ? 0.01 : 0), m === -1 ? 0.006 : -0.004]), r: 0.0095, bone: th + 1, k: 0.025 })),
    { t: 'ellipsoid', c: v(0, -0.05, -0.028), r: [0.04 * S, 0.046, 0.048 * S], bone: ft, k: 0.035 }, // heel
    { t: 'ellipsoid', c: v(inner * 0.004, -0.06, 0.05), r: [0.046 * S, 0.042, 0.085 * S], rot: [-0.25, 0, 0], bone: ft, k: 0.04 }, // instep / arch
    { t: 'ellipsoid', c: v(-inner * 0.012, -0.08, 0.06), r: [0.03 * S, 0.022, 0.07 * S], bone: ft, k: 0.03 }, // outer edge (flat on the ground)
    { t: 'ellipsoid', c: v(0, -0.08, 0.128), r: [0.052 * S, 0.024, 0.04 * S], bone: ft, k: 0.03 }, // ball of the foot
  ];
  const parts: Part[] = [{ prims: sole, clips: [{ o: [0, 0.002, 0], n: [0, -1, 0], k: 0.006 }] }];
  // toes: big toe on the inside, then four smaller ones stepping back along the curve
  const toes: [number, number, number, number][] = [
    // x (from foot centre, toward the inner side), z of the toe base, length, radius
    [0.03, 0.15, 0.05, 0.0145],
    [0.008, 0.152, 0.042, 0.0105],
    [-0.012, 0.148, 0.036, 0.0098],
    [-0.029, 0.14, 0.031, 0.0092],
    [-0.043, 0.128, 0.026, 0.0086],
  ];
  for (const [tx, tz, len, rad] of toes) {
    const base = v(inner * tx, -0.084, tz);
    const tip = v(inner * tx * 1.05, -0.093, tz + len);
    parts.push({
      prims: [
        { t: 'cone', a: base, b: tip, ra: rad * S, rb: rad * 0.9 * S, bone: ft, k: 0.006 },
        { t: 'ellipsoid', c: add(lerp(base, tip, 0.85), [0, -0.002, 0]), r: [rad * 0.95 * S, rad * 0.8, rad * 0.9 * S], bone: ft, k: 0.006 },
      ],
      k: 0.009,
      clips: [{ o: [0, 0.002, 0], n: [0, -1, 0], k: 0.004 }],
    });
  }
  return parts;
}

/**
 * Armpit skinning: blend the upper-arm and chest bones across the armpit (like a hand-rigged
 * character), so lifting an arm stretches the side smoothly instead of tearing a web between
 * arm-owned and chest-owned vertices. Works on any skinned geometry (skin, tops, jackets).
 */
export function softenArmpits(geo: import('three').BufferGeometry, J: Joints) {
  const P = geo.getAttribute('position');
  const I = geo.getAttribute('skinIndex');
  const W = geo.getAttribute('skinWeight');
  if (!P || !I || !W) return geo;
  const sm = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const x0 = J.sx - 0.075; // where the side of the chest turns into the arm
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i);
    const ax = Math.abs(x);
    // armpit band: from just below the shoulder down the upper ribs
    const band = sm(1.28, 1.38, y) * (1 - sm(1.55, 1.64, y));
    if (band <= 0 || ax < x0 - 0.09 || ax > J.sx + 0.08) continue;
    const arm = x < 0 ? B.upperArmL : B.upperArmR;
    const b0 = I.getX(i);
    if (b0 !== arm && b0 !== B.chest && b0 !== B.pelvis) continue;
    // how much of the arm's motion this vertex takes: none on the chest, all on the arm
    const tArm = sm(x0 - 0.06, x0 + 0.06, ax);
    const own = b0 === arm ? 1 : 0;
    const w = own + (tArm - own) * band;
    I.setXYZW(i, arm, B.chest, 0, 0);
    W.setXYZW(i, w, 1 - w, 0, 0);
  }
  I.needsUpdate = true;
  W.needsUpdate = true;
  return geo;
}
