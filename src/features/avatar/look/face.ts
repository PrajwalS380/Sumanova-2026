import { rng, step, hashStr } from './rng';

/**
 * Face & body variant generators. Each category yields exactly 100 variants,
 * built as families × parameter steps so neighbours in the grid feel related.
 */

export interface HeadP { rx: number; ry: number; rz: number; jawN: number; jawExp: number; cheeks: number; chinLow: number; topWide: number }
export interface EyeP { open: number; tilt: number; squash: number; lower: number; size: number; iris: number; crease: number }
export interface LashP { len: number; density: number; liner: number; wing: number; wingUp: number; bottom: number }
export interface BrowP { thick: number; arch: number; archPos: number; len: number; tail: number; inner: number; slits: number; feather: number }
export interface NoseP { tipW: number; tipS: number; bridge: number; bridgeW: number; nostril: number; up: number; len: number }
export interface MouthP { width: number; upper: number; lower: number; bow: number; corner: number }
export interface EarP { size: number; out: number; point: number; lobe: number; width: number }
export interface BodyP { width: number; height: number; belly: number; shoulders: number; hips: number }
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

export const HEADS = build<HeadP>('head', Object.entries(HEAD_BASE).map(([name, b]) => ({
  name,
  n: 10,
  make: (i) => {
    const w = step(i % 5, 5, 0.95, 1.05);
    const j = i < 5 ? 0 : 1;
    return { rx: b[0] * w, ry: b[1] * (j ? 1.02 : 0.99), rz: b[2], jawN: b[3] * (j ? 0.85 : 1.1), jawExp: b[4], cheeks: step(i % 5, 5, 0.2, 0.7), chinLow: b[6] + (j ? 0.03 : 0), topWide: b[5] };
  },
})));

const EYE_FAM: [string, Partial<EyeP>][] = [
  ['Almond', { open: -0.68, tilt: 0.06, squash: 0.86 }],
  ['Round', { open: -0.92, tilt: 0, squash: 1.04 }],
  ['Hooded', { open: -0.42, tilt: 0.02, squash: 0.9, crease: 0 }],
  ['Upturned', { open: -0.72, tilt: 0.18, squash: 0.9 }],
  ['Downturned', { open: -0.66, tilt: -0.14, squash: 0.92 }],
  ['Monolid', { open: -0.5, tilt: 0.08, squash: 0.8, crease: 0 }],
  ['Doe', { open: -1.0, tilt: 0.02, squash: 1.08 }],
  ['Feline', { open: -0.6, tilt: 0.26, squash: 0.8 }],
  ['Deep-set', { open: -0.55, tilt: 0, squash: 0.9 }],
  ['Bright', { open: -0.85, tilt: 0.08, squash: 0.98 }],
];
export const EYE_SHAPES = build<EyeP>('eyes', EYE_FAM.map(([name, b]) => ({
  name,
  n: 10,
  make: (i) => ({
    open: (b.open ?? -0.7) + ((i % 5) - 2) * 0.05,
    tilt: (b.tilt ?? 0) + (i >= 5 ? 0.04 : 0),
    squash: (b.squash ?? 0.92) * (1 + ((i % 5) - 2) * 0.02),
    lower: 1.4 - (i % 3) * 0.12,
    size: 0.94 + (i % 5) * 0.03,
    iris: i >= 5 ? 0.6 : 0.56,
    crease: b.crease ?? 1,
  }),
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
export const BROWS = build<BrowP>('brows', BROW_FAM.map(([name, b]) => ({
  name,
  n: 10,
  make: (i) => ({
    thick: (b.thick ?? 1) * step(i % 5, 5, 0.8, 1.2),
    arch: b.arch ?? 0.012,
    archPos: b.archPos ?? 0.6,
    len: i >= 5 ? 1.1 : 0.95,
    tail: (b.tail ?? 0.012) + (i % 2) * 0.004,
    inner: name === 'Slit' ? 1 : 1 + ((i % 3) - 1) * 0.15,
    slits: name === 'Slit' ? 1 + (i % 2) : 0,
    feather: b.feather ?? 0,
  }),
})));

const NOSE_FAM: [string, Partial<NoseP>][] = [
  ['Button', { tipW: 0.95, tipS: 0.85, bridge: 0, up: 0.4 }],
  ['Straight', { tipW: 1, tipS: 1, bridge: 0.6 }],
  ['Roman', { tipW: 1, tipS: 1.05, bridge: 1, up: -0.3 }],
  ['Snub', { tipW: 1.05, tipS: 0.9, bridge: 0.2, up: 0.7 }],
  ['Wide', { tipW: 1.35, tipS: 1.05, bridge: 0.4, nostril: 1.35 }],
  ['Narrow', { tipW: 0.8, tipS: 0.95, bridge: 0.6, nostril: 0.85 }],
  ['Aquiline', { tipW: 0.95, tipS: 1.1, bridge: 1.1, up: -0.5, len: 1.1 }],
  ['Rounded', { tipW: 1.15, tipS: 1.15, bridge: 0.3 }],
  ['Flat', { tipW: 1.25, tipS: 0.9, bridge: 0.05, nostril: 1.3 }],
  ['Petite', { tipW: 0.85, tipS: 0.78, bridge: 0.15, up: 0.3, len: 0.9 }],
];
export const NOSES = build<NoseP>('nose', NOSE_FAM.map(([name, b]) => ({
  name,
  n: 10,
  make: (i) => ({
    tipW: (b.tipW ?? 1) * step(i % 5, 5, 0.92, 1.08),
    tipS: (b.tipS ?? 1) * (i >= 5 ? 1.06 : 0.97),
    bridge: b.bridge ?? 0.5,
    bridgeW: step(i % 5, 5, 0.85, 1.15),
    nostril: (b.nostril ?? 1) * (i >= 5 ? 1.05 : 1),
    up: b.up ?? 0,
    len: (b.len ?? 1) * (1 + ((i % 3) - 1) * 0.04),
  }),
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
  make: (i) => ({
    size: [1, 1, 0.95, 1.15, 0.85, 1.05, 1.05, 1.05, 0.95, 1.2][f] * step(i % 5, 5, 0.92, 1.08),
    out: [0.3, 0.45, 0.4, 0.4, 0.3, 0.55, 0.45, 0.4, 0.15, 0.7][f] + (i >= 5 ? 0.15 : 0),
    point: f === 6 ? 0.6 + (i % 5) * 0.1 : 0,
    lobe: f === 7 ? 1 : f === 4 ? 0.3 : 0.6,
    width: [1, 1, 1.15, 0.9, 0.95, 1.2, 0.9, 1, 0.95, 1.15][f],
  }),
})));

export const BODIES = build<BodyP>('body', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((f) => ({
  name: ['Slim', 'Lean', 'Average', 'Athletic', 'Curvy', 'Broad', 'Soft', 'Tall slim', 'Petite', 'Strong'][f],
  n: 10,
  make: (i) => ({
    width: [0.86, 0.92, 1, 1.06, 1.04, 1.14, 1.1, 0.9, 0.9, 1.18][f] * step(i % 5, 5, 0.97, 1.03),
    height: [1, 1, 1, 1.02, 0.98, 1.02, 0.98, 1.07, 0.92, 1.03][f] + (i >= 5 ? 0.02 : -0.01),
    belly: [0, 0, 0.15, 0, 0.25, 0.25, 0.6, 0, 0.1, 0.2][f] + (i % 5) * 0.04,
    shoulders: [0.92, 0.96, 1, 1.12, 0.96, 1.12, 1, 0.94, 0.92, 1.18][f],
    hips: [0.94, 0.96, 1, 1, 1.2, 1.05, 1.12, 0.94, 0.96, 1.05][f] + (i >= 5 ? 0.04 : 0),
  }),
})));

const B0: BeardP = { stubble: 0, beard: 0, cheekLine: 0.3, drop: 0, sides: 1, chinOnly: 0, chinW: 0.3, tache: 0, tacheW: 1, tacheT: 1, curl: 0, soul: 0 };
export const BEARDS = build<BeardP>('beard', [
  { name: 'Stubble', n: 12, make: (i) => ({ ...B0, stubble: step(i % 6, 6, 0.25, 0.7), cheekLine: i >= 6 ? 0.36 : 0.26 }) },
  { name: 'Moustache', n: 14, make: (i) => ({ ...B0, tache: 1 + (i % 7), tacheW: i >= 7 ? 1.15 : 0.95, tacheT: 1 + (i % 3) * 0.2, curl: i % 7 === 4 ? 1 : 0 }) },
  { name: 'Goatee', n: 14, make: (i) => ({ ...B0, beard: 0.05, chinOnly: 1, chinW: step(i % 7, 7, 0.16, 0.34), drop: i >= 7 ? 0.05 : 0, tache: i % 2 ? 2 : 0, soul: i % 7 === 0 ? 1 : 0 }) },
  { name: 'Chinstrap', n: 10, make: (i) => ({ ...B0, beard: 0.03, cheekLine: 0.05, sides: 1, tache: i >= 5 ? 1 : 0, chinW: 0.2, drop: 0, stubble: (i % 5) * 0.08 }) },
  { name: 'Short beard', n: 16, make: (i) => ({ ...B0, beard: step(i % 4, 4, 0.03, 0.06), cheekLine: step(Math.floor(i / 4), 4, 0.12, 0.26), tache: 1 + (i % 3), stubble: 0.3 }) },
  { name: 'Full beard', n: 16, make: (i) => ({ ...B0, beard: step(i % 4, 4, 0.06, 0.1), cheekLine: step(Math.floor(i / 4), 4, 0.16, 0.28), drop: step(i % 4, 4, 0.02, 0.1), tache: 3, stubble: 0.3 }) },
  { name: 'Long beard', n: 10, make: (i) => ({ ...B0, beard: 0.1, cheekLine: 0.24, drop: step(i % 5, 5, 0.14, 0.32), tache: 3 + (i % 2), curl: i >= 5 ? 0.6 : 0 }) },
  { name: 'Mutton chops', n: 8, make: (i) => ({ ...B0, beard: 0.06, cheekLine: 0.32, sides: 1.3, chinOnly: -1, tache: i % 2 ? 1 : 0 }) },
]);
