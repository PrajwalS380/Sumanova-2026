import { rng, hashStr, step } from './rng';
import type { Variant } from './face';

/**
 * Hairstyle recipes. A style = a sculpted base cap (hairline + thickness) plus
 * hundreds of tapered "locks" grown from the scalp along a flow field.
 * 20 families × 5 = 100 styles.
 */
export type Flow = 'back' | 'forward' | 'side' | 'up' | 'down' | 'out' | 'part';
export type Tie = 'none' | 'pony' | 'lowpony' | 'bun' | 'topbun' | 'spacebuns' | 'half' | 'braids' | 'braid' | 'cornrows';

export interface HairP {
  front: number; back: number; side: number; // hairline (unit-sphere height)
  shell: number; // base cap thickness (fraction of head radius)
  top: number; sides: number; backL: number; fringe: number; // lock lengths (head-radius units)
  part: number; // parting azimuth in radians (0 = none)
  flow: Flow;
  sweep: number; // sideways sweep -1..1
  lift: number; // root lift / volume
  curl: number; curlF: number;
  width: number; // lock width
  spiky: number; // 0 soft … 1 sharp tips
  count: number;
  undercut: number; // 0 none … 1 shaved sides
  tie: Tie;
  tieH: number;
  afro: number; // big rounded volume
  locs: number; // rope-like locks
  layers: number; // layered/shag shaping
}

const D: HairP = { front: 0.5, back: -0.48, side: 0.12, shell: 0.03, top: 0.3, sides: 0.18, backL: 0.2, fringe: 0, part: 0, flow: 'back', sweep: 0, lift: 0.3, curl: 0, curlF: 3, width: 1, spiky: 0.5, count: 220, undercut: 0, tie: 'none', tieH: 0.5, afro: 0, locs: 0, layers: 0 };

type Fam = { name: string; make: (i: number, r: () => number) => Partial<HairP> };
const FAMILIES: Fam[] = [
  { name: 'Buzz', make: (i) => ({ shell: step(i, 5, 0.012, 0.035), count: 0, front: 0.55 - i * 0.02 }) },
  { name: 'Crew', make: (i) => ({ top: step(i, 5, 0.14, 0.26), sides: 0.07, backL: 0.08, flow: 'forward', lift: 0.25, count: 260, undercut: i % 2 ? 0.5 : 0.2, spiky: 0.4 }) },
  { name: 'Textured crop', make: (i) => ({ top: step(i, 5, 0.26, 0.4), sides: 0.08, backL: 0.1, flow: 'forward', fringe: step(i, 5, 0.12, 0.26), lift: 0.4, spiky: 0.75, count: 300, undercut: 0.6, front: 0.46 }) },
  { name: 'Quiff', make: (i) => ({ top: step(i, 5, 0.4, 0.62), sides: 0.09, backL: 0.1, flow: 'up', lift: 0.9, sweep: (i % 3) * 0.2, undercut: i >= 2 ? 0.8 : 0.4, spiky: 0.5, count: 280 }) },
  { name: 'Side part', make: (i) => ({ top: step(i, 5, 0.3, 0.5), sides: 0.12, backL: 0.14, flow: 'part', part: 0.45, sweep: 0.8, lift: 0.45, spiky: 0.35, count: 280, undercut: i >= 3 ? 0.4 : 0 }) },
  { name: 'Slick back', make: (i) => ({ top: step(i, 5, 0.32, 0.55), sides: 0.14, backL: 0.2, flow: 'back', lift: 0.2, spiky: 0.2, count: 260, undercut: i % 2 ? 0.7 : 0 }) },
  { name: 'Curtains', make: (i) => ({ top: step(i, 5, 0.4, 0.62), sides: 0.3, backL: 0.26, flow: 'part', part: 0.0001, fringe: step(i, 5, 0.28, 0.42), lift: 0.4, spiky: 0.45, count: 320, front: 0.44 }) },
  { name: 'Spiky', make: (i) => ({ top: step(i, 5, 0.28, 0.5), sides: 0.1, backL: 0.1, flow: 'out', lift: 1, spiky: 1, width: 1.2, count: 160 + i * 20, undercut: 0.3 }) },
  { name: 'Undercut', make: (i) => ({ top: step(i, 5, 0.5, 0.8), sides: 0.03, backL: 0.05, flow: 'side', sweep: 0.9, fringe: step(i, 5, 0.3, 0.55), lift: 0.6, undercut: 1, spiky: 0.65, count: 300 }) },
  { name: 'Curly', make: (i) => ({ top: step(i, 5, 0.22, 0.5), sides: step(i, 5, 0.16, 0.4), backL: step(i, 5, 0.18, 0.45), flow: 'out', curl: 1, curlF: 5 + i, lift: 0.6, spiky: 0.2, width: 1.3, count: 340, shell: 0.06, front: 0.44 }) },
  { name: 'Afro', make: (i) => ({ afro: step(i, 5, 0.3, 0.62), shell: 0.04, count: 0, front: 0.36, back: -0.42, side: 0.06 }) },
  { name: 'Locs', make: (i) => ({ locs: 1, top: step(i, 5, 0.45, 1.2), sides: step(i, 5, 0.4, 1.1), backL: step(i, 5, 0.5, 1.3), flow: 'down', width: 0.8, count: 90, spiky: 0.1, tie: i === 4 ? 'topbun' : 'none', front: 0.48 }) },
  { name: 'Pixie', make: (i) => ({ top: step(i, 5, 0.25, 0.42), sides: 0.12, backL: 0.12, flow: 'side', sweep: 0.7, fringe: step(i, 5, 0.22, 0.4), spiky: 0.6, count: 300, front: 0.45 }) },
  { name: 'Bob', make: (i) => ({ top: 0.5, sides: step(i, 5, 0.55, 0.8), backL: step(i, 5, 0.5, 0.75), flow: 'down', fringe: i % 2 ? 0.34 : 0, part: i % 2 ? 0 : 0.35, lift: 0.3, spiky: 0.3, count: 360, front: 0.42, side: 0 }) },
  { name: 'Lob', make: (i) => ({ top: 0.55, sides: step(i, 5, 0.85, 1.05), backL: step(i, 5, 0.85, 1.05), flow: 'down', part: 0.3 - i * 0.12, lift: 0.3, curl: i >= 3 ? 0.4 : 0, spiky: 0.35, count: 380, front: 0.42, side: -0.02, layers: 0.4 }) },
  { name: 'Long straight', make: (i) => ({ top: 0.6, sides: step(i, 5, 1.2, 1.7), backL: step(i, 5, 1.2, 1.8), flow: 'down', part: i % 2 ? 0.0001 : 0.32, fringe: i === 4 ? 0.36 : 0, lift: 0.25, spiky: 0.4, count: 400, front: 0.42, side: -0.04 }) },
  { name: 'Long wavy', make: (i) => ({ top: 0.6, sides: step(i, 5, 1.1, 1.6), backL: step(i, 5, 1.2, 1.7), flow: 'down', part: 0.28, curl: 0.55, curlF: 2.5 + i * 0.3, lift: 0.4, spiky: 0.35, count: 400, front: 0.42, side: -0.04, width: 1.15 }) },
  { name: 'Shag', make: (i) => ({ top: 0.45, sides: step(i, 5, 0.5, 0.9), backL: step(i, 5, 0.6, 1.0), flow: 'down', fringe: 0.32, layers: 1, curl: 0.25, lift: 0.55, spiky: 0.8, count: 380, front: 0.44 }) },
  { name: 'Tied', make: (i) => ({ top: 0.35, sides: 0.15, backL: 0.15, flow: 'back', tie: (['pony', 'lowpony', 'bun', 'topbun', 'spacebuns'] as const)[i], tieH: [0.55, 0.05, 0.4, 0.85, 0.7][i], lift: 0.1, spiky: 0.2, count: 220, front: 0.5, shell: 0.035 }) },
  { name: 'Braided', make: (i) => ({ top: 0.3, sides: 0.15, backL: 0.15, flow: 'back', tie: (['braids', 'braid', 'cornrows', 'half', 'braids'] as const)[i], tieH: 0.3, lift: 0.1, spiky: 0.2, count: i === 2 ? 0 : 200, front: 0.48, shell: i === 2 ? 0.03 : 0.035, locs: i === 4 ? 1 : 0 }) },
];

export const HAIRSTYLES: Variant<HairP>[] = (() => {
  const out: Variant<HairP>[] = [];
  for (const f of FAMILIES) {
    const r = rng(hashStr('hair' + f.name));
    for (let i = 0; i < 5; i++) out.push({ id: out.length, name: `${f.name} ${i + 1}`, family: f.name, p: { ...D, ...f.make(i, r) } });
  }
  return out;
})();

/** `null` on the config means bald. */
