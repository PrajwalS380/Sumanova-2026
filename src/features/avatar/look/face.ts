import { rng, step, hashStr } from './rng';

/**
 * Face & body variant generators. Each category yields exactly 100 variants,
 * built as families × parameter steps so neighbours in the grid feel related.
 */

export interface HeadP { rx: number; ry: number; rz: number; jawN: number; jawExp: number; cheeks: number; chinLow: number; topWide: number }
export interface EyeP {
  open: number; tilt: number; squash: number; lower: number; size: number; iris: number; crease: number;
  /** where the upper lid peaks: -1 inner corner … 0 centre … 1 outer corner */
  peak?: number;
  /** lower lid slant (+ lifts the outer corner) */
  lowTilt?: number;
  /** lid fold: 0 none (monolid), 1 crease, 2 hooded overhang */
  fold?: number;
  /** deep-set shadow under the brow bone, 0..1 */
  deep?: number;
  /** pupil size, 0.7 small … 1.3 large */
  pupil?: number;
  /** dark iris rim strength, 0..1 */
  ring?: number;
  /** extra width (almond / feline stretch) */
  long?: number;
}
export interface LashP { len: number; density: number; liner: number; wing: number; wingUp: number; bottom: number }
export interface BrowP { thick: number; arch: number; archPos: number; len: number; tail: number; inner: number; slits: number; feather: number }
export interface NoseP {
  tipW: number; tipS: number; bridge: number; bridgeW: number; nostril: number; up: number; len: number;
  /** bump on the bridge (Roman / aquiline) */
  hump?: number;
  /** tip hangs down (aquiline hook) */
  droop?: number;
  /** nostril wings flare outward */
  flare?: number;
}
export interface MouthP { width: number; upper: number; lower: number; bow: number; corner: number }
export interface EarP {
  size: number; out: number; point: number; lobe: number; width: number;
  /** fuller, rounder upper ear (0 narrow … 1 round) */ top?: number;
  /** helix rim thickness (0.6 thin … 1.4 rolled) */ rim?: number;
  /** lobe joined to the cheek instead of hanging free */ attached?: boolean;
}
export interface BodyP { width: number; height: number; belly: number; shoulders: number; hips: number; /** 0 masculine … 1 feminine proportions */ fem?: number }
export interface BeardP {
  stubble: number; // 0..1 opacity of stubble shell
  beard: number; // 0 none, else thickness
  cheekLine: number; // how high the beard reaches on the cheeks
  drop: number; // extra length under chin
  sides: number; // sideburn/jaw coverage
  chinOnly: number; // 1 = goatee-style chin patch
  chinW: number;
  tache: number; // 0 none, 1.. style index
  tacheW: number;
  tacheT: number;
  curl: number;
  soul: number;
  /** chinstrap: only a band along the jawline */
  band?: number;
}

export interface Variant<P> { id: number; name: string; family: string; p: P }

function build<P>(key: string, families: { name: string; n: number; make: (i: number, n: number, r: () => number) => P }[]): Variant<P>[] {
  const out: Variant<P>[] = [];
  for (const f of families) {
    const r = rng(hashStr(key + f.name));
    for (let i = 0; i < f.n; i++) out.push({ id: out.length, name: `${f.name} ${i + 1}`, family: f.name, p: f.make(i, f.n, r) });
  }
  if (out.length !== 100) throw new Error(`${key} has ${out.length} variants`);
  return out;
}

const HEAD_BASE: Record<string, [number, number, number, number, number, number, number]> = {
  // rx, ry, rz, jawN, jawExp, topWide, chinLow
  Oval: [0.35, 0.39, 0.36, 0.3, 1.6, 0, 1],
  Round: [0.37, 0.37, 0.37, 0.16, 2.2, 0, 0.98],
  Square: [0.36, 0.38, 0.36, 0.13, 3.2, 0, 1],
  Heart: [0.36, 0.385, 0.355, 0.44, 1.5, 0.07, 1.02],
  Long: [0.335, 0.41, 0.35, 0.28, 1.7, 0, 1.04],
  Diamond: [0.345, 0.395, 0.355, 0.36, 1.4, -0.05, 1.03],
  Pear: [0.355, 0.385, 0.36, 0.08, 2.6, -0.06, 1],
  Soft: [0.36, 0.38, 0.365, 0.22, 2.0, 0.02, 1],
  Wide: [0.385, 0.375, 0.37, 0.2, 2.4, 0.02, 0.98],
  Narrow: [0.325, 0.395, 0.35, 0.26, 1.8, 0, 1.02],
};

/** Ten visibly different steps inside each face shape: width, length, jaw, cheekbones, chin. */
const HEAD_STEP = [
  { w: 0.94, h: 1.0, jaw: 1.0, cheeks: 0.25, chin: 0 },
  { w: 1.0, h: 1.0, jaw: 1.0, cheeks: 0.45, chin: 0 },
  { w: 1.06, h: 0.98, jaw: 0.9, cheeks: 0.6, chin: -0.01 },
  { w: 0.97, h: 1.04, jaw: 1.15, cheeks: 0.3, chin: 0.03 },
  { w: 1.03, h: 1.03, jaw: 0.8, cheeks: 0.75, chin: 0.01 },
  { w: 0.92, h: 1.05, jaw: 1.25, cheeks: 0.4, chin: 0.04 },
  { w: 1.08, h: 0.97, jaw: 0.85, cheeks: 0.2, chin: -0.02 },
  { w: 1.0, h: 1.06, jaw: 1.05, cheeks: 0.65, chin: 0.05 },
  { w: 1.05, h: 1.0, jaw: 1.2, cheeks: 0.85, chin: 0.02 },
  { w: 0.95, h: 0.97, jaw: 0.75, cheeks: 0.5, chin: -0.015 },
];
export const HEADS = build<HeadP>('head', Object.entries(HEAD_BASE).map(([name, b]) => ({
  name,
  n: 10,
  make: (i) => {
    const st = HEAD_STEP[i];
    return { rx: b[0] * st.w, ry: b[1] * st.h, rz: b[2], jawN: Math.min(0.6, b[3] * st.jaw), jawExp: b[4], cheeks: st.cheeks, chinLow: b[6] + st.chin, topWide: b[5] };
  },
})));

const EYE_FAM: [string, Partial<EyeP>][] = [
  // each family has its own outline; the 10 variants step through size, iris, tilt, openness and lower lid
  ['Almond', { open: -0.66, tilt: 0.06, squash: 0.8, long: 1.12, peak: 0.15, lowTilt: 0.05, fold: 1 }],
  ['Round', { open: -0.98, tilt: 0, squash: 1.06, long: 0.96, peak: 0, lowTilt: 0, fold: 1, pupil: 1.1 }],
  ['Hooded', { open: -0.46, tilt: 0.02, squash: 0.88, long: 1.04, peak: 0.25, lowTilt: 0, fold: 2 }],
  ['Upturned', { open: -0.72, tilt: 0.16, squash: 0.88, long: 1.08, peak: 0.35, lowTilt: 0.22, fold: 1 }],
  ['Downturned', { open: -0.66, tilt: -0.12, squash: 0.92, long: 1.05, peak: -0.35, lowTilt: -0.18, fold: 1 }],
  ['Monolid', { open: -0.5, tilt: 0.1, squash: 0.76, long: 1.1, peak: 0.1, lowTilt: 0.08, fold: 0 }],
  ['Doe', { open: -1.04, tilt: 0.02, squash: 1.1, long: 0.98, peak: -0.1, lowTilt: -0.04, fold: 1, pupil: 1.2, iris: 0.62 }],
  ['Feline', { open: -0.58, tilt: 0.26, squash: 0.76, long: 1.18, peak: 0.55, lowTilt: 0.3, fold: 1 }],
  ['Deep-set', { open: -0.6, tilt: 0, squash: 0.9, long: 1.0, peak: 0.05, lowTilt: 0, fold: 2, deep: 1 }],
  ['Bright', { open: -0.88, tilt: 0.08, squash: 0.98, long: 1.02, peak: 0.1, lowTilt: 0.06, fold: 1, ring: 1, pupil: 0.9 }],
];
/** Steps inside a family: 0-9 → clearly different, still recognisably the family. */
const EYE_STEP = [
  { size: 0.9, iris: -0.04, open: 0.08, tilt: 0, lower: 0 },
  { size: 1.0, iris: 0, open: 0, tilt: 0, lower: 0 },
  { size: 1.1, iris: 0.04, open: -0.06, tilt: 0, lower: 0.1 },
  { size: 0.96, iris: 0.02, open: 0.04, tilt: 0.06, lower: -0.1 },
  { size: 1.04, iris: -0.02, open: -0.1, tilt: -0.05, lower: 0.15 },
  { size: 0.92, iris: 0.06, open: -0.04, tilt: 0.04, lower: 0.25 },
  { size: 1.08, iris: -0.06, open: 0.1, tilt: 0.02, lower: -0.15 },
  { size: 1.0, iris: 0.08, open: 0.05, tilt: -0.08, lower: 0.05 },
  { size: 1.14, iris: 0, open: -0.12, tilt: 0.05, lower: 0.3 },
  { size: 0.86, iris: 0.03, open: 0.12, tilt: -0.03, lower: -0.2 },
];
export const EYE_SHAPES = build<EyeP>('eyes', EYE_FAM.map(([name, b]) => ({
  name,
  n: 10,
  make: (i) => {
    const st = EYE_STEP[i];
    return {
      open: (b.open ?? -0.7) + st.open,
      tilt: (b.tilt ?? 0) + st.tilt,
      squash: b.squash ?? 0.92,
      lower: 1.4 + st.lower,
      size: 0.94 * st.size,
      iris: (b.iris ?? 0.57) + st.iris,
      crease: b.fold === 0 ? 0 : 1,
      peak: (b.peak ?? 0) + ((i % 3) - 1) * 0.12,
      lowTilt: (b.lowTilt ?? 0) + st.tilt * 0.6,
      fold: b.fold ?? 1,
      deep: b.deep ?? (i === 8 ? 0.35 : 0),
      pupil: (b.pupil ?? 1) * (i % 2 ? 1.08 : 0.94),
      ring: b.ring ?? (i >= 5 ? 0.8 : 0.45),
      long: b.long ?? 1,
    };
  },
})));

export const LASHES = build<LashP>('lashes', [
  { name: 'Natural', n: 20, make: (i) => ({ len: step(i % 5, 5, 0.25, 0.55), density: 0.6, liner: i < 10 ? 0.3 : 0.6, wing: 0, wingUp: 0, bottom: i % 2 ? 0.3 : 0 }) },
  { name: 'Full', n: 20, make: (i) => ({ len: step(i % 5, 5, 0.55, 0.85), density: 1, liner: step(Math.floor(i / 5), 4, 0.4, 1), wing: 0, wingUp: 0, bottom: i % 2 ? 0.5 : 0.2 }) },
  { name: 'Winged', n: 20, make: (i) => ({ len: step(i % 4, 4, 0.3, 0.7), density: 0.8, liner: 1, wing: step(Math.floor(i / 4), 5, 0.25, 0.75), wingUp: 0.45, bottom: 0 }) },
  { name: 'Cat liner', n: 20, make: (i) => ({ len: step(i % 4, 4, 0.4, 0.8), density: 0.9, liner: 1.4, wing: step(Math.floor(i / 4), 5, 0.5, 1), wingUp: 0.65, bottom: i % 2 ? 0.4 : 0 }) },
  { name: 'Dramatic', n: 20, make: (i) => ({ len: step(i % 5, 5, 0.85, 1.25), density: 1.3, liner: step(Math.floor(i / 5), 4, 0.8, 1.6), wing: i % 2 ? 0.4 : 0, wingUp: 0.5, bottom: 0.6 }) },
]);

const BROW_FAM: [string, Partial<BrowP>][] = [
  ['Straight', { arch: 0.002, archPos: 0.5, tail: 0.004 }],
  ['Soft arch', { arch: 0.012, archPos: 0.6 }],
  ['High arch', { arch: 0.026, archPos: 0.62 }],
  ['Angled', { arch: 0.02, archPos: 0.7, tail: 0.02 }],
  ['Rounded', { arch: 0.018, archPos: 0.5 }],
  ['Flat thick', { arch: 0.004, thick: 1.5 }],
  ['Thin', { arch: 0.014, thick: 0.55 }],
  ['Bushy', { arch: 0.01, thick: 1.7, feather: 1 }],
  ['Feathered', { arch: 0.014, feather: 1 }],
  ['Slit', { arch: 0.012, slits: 1 }],
];
/** Ten clearly different steps inside each brow family (thickness, arch, length, inner head, tail). */
const BROW_STEP = [
  { thick: 0.75, arch: 0, pos: 0, len: 0.95, inner: 1, tail: 0 },
  { thick: 0.9, arch: 0.003, pos: 0.04, len: 1.0, inner: 1.15, tail: 0.002 },
  { thick: 1.05, arch: -0.002, pos: -0.04, len: 1.05, inner: 0.9, tail: 0.004 },
  { thick: 1.2, arch: 0.005, pos: 0.06, len: 1.0, inner: 1.3, tail: 0 },
  { thick: 0.85, arch: 0.008, pos: 0.08, len: 1.1, inner: 0.85, tail: 0.006 },
  { thick: 1.3, arch: -0.004, pos: -0.06, len: 0.92, inner: 1.2, tail: 0.002 },
  { thick: 1.0, arch: 0.006, pos: 0.02, len: 1.12, inner: 1.05, tail: 0.008 },
  { thick: 0.7, arch: 0.01, pos: 0.1, len: 1.05, inner: 0.95, tail: 0.004 },
  { thick: 1.4, arch: 0.002, pos: 0, len: 1.08, inner: 1.35, tail: 0.003 },
  { thick: 1.1, arch: -0.006, pos: -0.08, len: 0.98, inner: 1.1, tail: 0.01 },
];
export const BROWS = build<BrowP>('brows', BROW_FAM.map(([name, b]) => ({
  name,
  n: 10,
  make: (i) => {
    const st = BROW_STEP[i];
    return {
      thick: (b.thick ?? 1) * st.thick,
      arch: Math.max(0, (b.arch ?? 0.012) + st.arch),
      archPos: Math.min(0.8, Math.max(0.35, (b.archPos ?? 0.6) + st.pos)),
      len: st.len,
      tail: (b.tail ?? 0.012) + st.tail,
      inner: name === 'Slit' ? 1 : st.inner,
      slits: name === 'Slit' ? 1 + (i % 2) : 0,
      feather: b.feather ?? (i === 8 ? 0.4 : 0),
    };
  },
})));

const NOSE_FAM: [string, Partial<NoseP>][] = [
  ['Button', { tipW: 0.92, tipS: 0.88, bridge: 0, up: 0.45, len: 0.9 }],
  ['Straight', { tipW: 0.95, tipS: 1, bridge: 0.6, len: 1.02 }],
  ['Roman', { tipW: 1, tipS: 1.02, bridge: 1, up: -0.2, hump: 0.9, len: 1.08 }],
  ['Snub', { tipW: 1.05, tipS: 0.92, bridge: 0.15, up: 0.8, len: 0.92 }],
  ['Wide', { tipW: 1.3, tipS: 1.05, bridge: 0.35, nostril: 1.3, flare: 1 }],
  ['Narrow', { tipW: 0.78, tipS: 0.95, bridge: 0.7, nostril: 0.82, len: 1.06 }],
  ['Aquiline', { tipW: 0.92, tipS: 1.08, bridge: 1.1, up: -0.55, hump: 1, droop: 1, len: 1.12 }],
  ['Rounded', { tipW: 1.18, tipS: 1.2, bridge: 0.3, flare: 0.3 }],
  ['Flat', { tipW: 1.22, tipS: 0.86, bridge: 0, nostril: 1.28, flare: 0.7, len: 0.94 }],
  ['Petite', { tipW: 0.82, tipS: 0.76, bridge: 0.12, up: 0.3, len: 0.86 }],
];
/** Ten different steps inside each nose family. */
const NOSE_STEP = [
  { w: 0.9, s: 0.95, bw: 0.85, up: 0, len: 0, n: 1 },
  { w: 1.0, s: 1.0, bw: 1.0, up: 0, len: 0, n: 1 },
  { w: 1.1, s: 1.04, bw: 1.1, up: 0.1, len: 0.03, n: 1.05 },
  { w: 0.95, s: 1.08, bw: 0.9, up: -0.12, len: 0.05, n: 0.95 },
  { w: 1.05, s: 0.92, bw: 1.15, up: 0.2, len: -0.04, n: 1.1 },
  { w: 0.88, s: 1.02, bw: 0.8, up: 0.05, len: 0.06, n: 0.9 },
  { w: 1.14, s: 1.1, bw: 1.2, up: -0.05, len: 0, n: 1.15 },
  { w: 1.0, s: 0.9, bw: 0.95, up: 0.25, len: -0.06, n: 1 },
  { w: 0.93, s: 1.12, bw: 1.05, up: -0.2, len: 0.08, n: 0.92 },
  { w: 1.08, s: 0.98, bw: 0.88, up: 0.12, len: -0.02, n: 1.08 },
];
export const NOSES = build<NoseP>('nose', NOSE_FAM.map(([name, b]) => ({
  name,
  n: 10,
  make: (i) => {
    const st = NOSE_STEP[i];
    return {
      tipW: (b.tipW ?? 1) * st.w,
      tipS: (b.tipS ?? 1) * st.s,
      bridge: b.bridge ?? 0.5,
      bridgeW: st.bw,
      nostril: (b.nostril ?? 1) * st.n,
      up: (b.up ?? 0) + st.up,
      len: (b.len ?? 1) + st.len,
      hump: b.hump ?? (i === 8 ? 0.35 : 0),
      droop: b.droop ?? 0,
      flare: b.flare ?? 0,
    };
  },
})));

const MOUTH_FAM: [string, Partial<MouthP>][] = [
  ['Balanced', {}], ['Full', { upper: 1.3, lower: 1.4 }], ['Thin', { upper: 0.65, lower: 0.75 }], ['Heart', { upper: 1.15, lower: 0.9, bow: 1 }],
  ['Wide', { width: 1.2 }], ['Petite', { width: 0.85, upper: 0.9, lower: 1 }], ['Pouty', { upper: 1.1, lower: 1.55 }], ['Bow', { bow: 1.2, upper: 1.2 }],
  ['Upturned', { corner: 0.4 }], ['Downturned', { corner: -0.35 }],
];
export const MOUTHS = build<MouthP>('mouth', MOUTH_FAM.map(([name, b]) => ({
  name,
  n: 10,
  make: (i) => ({
    width: (b.width ?? 1) * step(i % 5, 5, 0.92, 1.08),
    upper: (b.upper ?? 1) * (i >= 5 ? 1.08 : 0.96),
    lower: (b.lower ?? 1) * (i >= 5 ? 1.08 : 0.96),
    bow: b.bow ?? 0.5,
    corner: b.corner ?? 0,
  }),
})));

export const EARS = build<EarP>('ears', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((f) => ({
  name: ['Neat', 'Classic', 'Round', 'Long', 'Small', 'Wide', 'Elfin', 'Lobed', 'Flat', 'Bold'][f],
  n: 10,
  make: (i) => {
    const k = i % 5;
    return {
      size: [1, 1, 0.95, 1.15, 0.82, 1.05, 1.05, 1.05, 0.95, 1.22][f] * step(k, 5, 0.9, 1.1),
      out: [0.3, 0.45, 0.4, 0.4, 0.3, 0.55, 0.45, 0.4, 0.12, 0.75][f] + (i >= 5 ? 0.18 : 0),
      point: f === 6 ? 0.5 + k * 0.13 : 0,
      lobe: f === 7 ? 1 + k * 0.12 : f === 4 ? 0.3 : f === 3 ? 0.9 : 0.45 + (k % 3) * 0.12,
      width: [1, 1, 1.18, 0.86, 0.95, 1.22, 0.88, 1, 0.95, 1.15][f] * step(k, 5, 1.05, 0.95),
      top: [0.4, 0.5, 1, 0.2, 0.6, 0.8, 0, 0.4, 0.3, 0.7][f],
      rim: [1, 1.15, 1.1, 1, 0.8, 1.2, 0.85, 1, 0.65, 1.4][f] * (i >= 5 ? 1.1 : 1),
      attached: f === 0 || f === 4 || (f !== 7 && i >= 5 && k % 2 === 1),
    };
  },
})));

/** five builds inside every family: leaner & taller → stockier & fuller */
const BODY_STEP = [
  { w: 0.92, h: 0.03, belly: 0, sh: 0.97, hp: -0.03 },
  { w: 0.96, h: 0.015, belly: 0.04, sh: 0.99, hp: -0.01 },
  { w: 1, h: 0, belly: 0.1, sh: 1, hp: 0 },
  { w: 1.05, h: -0.015, belly: 0.18, sh: 1.03, hp: 0.03 },
  { w: 1.1, h: -0.03, belly: 0.3, sh: 1.05, hp: 0.06 },
];
export const BODIES = build<BodyP>('body', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((f) => ({
  name: ['Slim', 'Lean', 'Average', 'Athletic', 'Curvy', 'Broad', 'Soft', 'Tall slim', 'Petite', 'Strong'][f],
  n: 10,
  make: (i) => {
    const st = BODY_STEP[i % 5];
    return {
      width: [0.86, 0.92, 1, 1.06, 1.04, 1.14, 1.1, 0.9, 0.9, 1.18][f] * st.w,
      height: [1, 1, 1, 1.02, 0.98, 1.02, 0.98, 1.07, 0.92, 1.03][f] + st.h + (i >= 5 ? -0.035 : 0.01),
      belly: [0, 0, 0.15, 0, 0.25, 0.25, 0.6, 0, 0.1, 0.2][f] + st.belly * ([3, 9].includes(f) ? 0.4 : 1),
      shoulders: [0.92, 0.96, 1, 1.12, 0.96, 1.12, 1, 0.94, 0.92, 1.18][f] * st.sh,
      hips: [0.94, 0.96, 1, 1, 1.2, 1.05, 1.12, 0.94, 0.96, 1.05][f] + st.hp + (i >= 5 ? 0.04 : 0),
      // each build comes in masculine (1–5) and feminine (6–10) proportions
      fem: i >= 5 ? 1 : 0,
    };
  },
})));

const B0: BeardP = { stubble: 0, beard: 0, cheekLine: 0.3, drop: 0, sides: 1, chinOnly: 0, chinW: 0.3, tache: 0, tacheW: 1, tacheT: 1, curl: 0, soul: 0 };
export const BEARDS = build<BeardP>('beard', [
  { name: 'Stubble', n: 12, make: (i) => ({ ...B0, stubble: step(i % 6, 6, 0.25, 0.7), cheekLine: i >= 6 ? 0.36 : 0.26 }) },
  { name: 'Moustache', n: 14, make: (i) => ({ ...B0, tache: 1 + (i % 7), tacheW: i >= 7 ? 1.15 : 0.95, tacheT: 1 + (i % 3) * 0.2, curl: i % 7 === 4 ? 1 : 0 }) },
  { name: 'Goatee', n: 14, make: (i) => ({ ...B0, beard: 0.05, chinOnly: 1, chinW: step(i % 7, 7, 0.16, 0.34), drop: i >= 7 ? 0.05 : 0, tache: i % 2 ? 2 : 0, soul: i % 7 === 0 ? 1 : 0 }) },
  { name: 'Chinstrap', n: 10, make: (i) => ({ ...B0, beard: 0.03 + (i % 5) * 0.006, cheekLine: 0.05, sides: 1, tache: i >= 5 ? 1 : 0, chinW: 0.2, drop: 0, stubble: (i % 5) * 0.08, band: 0.9 - (i % 5) * 0.1 }) },
  { name: 'Short beard', n: 16, make: (i) => ({ ...B0, beard: step(i % 4, 4, 0.03, 0.06), cheekLine: step(Math.floor(i / 4), 4, 0.12, 0.26), tache: 1 + (i % 3), stubble: 0.3 }) },
  { name: 'Full beard', n: 16, make: (i) => ({ ...B0, beard: step(i % 4, 4, 0.06, 0.1), cheekLine: step(Math.floor(i / 4), 4, 0.16, 0.28), drop: step(i % 4, 4, 0.02, 0.1), tache: 3, stubble: 0.3 }) },
  { name: 'Long beard', n: 10, make: (i) => ({ ...B0, beard: 0.1, cheekLine: 0.24, drop: step(i % 5, 5, 0.14, 0.32), tache: 3 + (i % 2), curl: i >= 5 ? 0.6 : 0 }) },
  { name: 'Mutton chops', n: 8, make: (i) => ({ ...B0, beard: 0.06, cheekLine: 0.32, sides: 1.3, chinOnly: -1, tache: i % 2 ? 1 : 0 }) },
]);
