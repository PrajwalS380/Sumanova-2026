import { METALS, type Metal } from './palettes';
import type { Variant } from './face';

/**
 * Piercings, hearing aids and head add-ons.
 * Piercing sets: 25 original arrangements × 4 metals = 100 per zone.
 */
export type JewelKind = 'stud' | 'hoop' | 'cuff' | 'spike' | 'bar' | 'ring' | 'chain' | 'gem';
/** A single piece: where (zone-specific anchor 0..1 values) and what. */
export interface Jewel { kind: JewelKind; a: number; b: number; size: number }
export interface PiercingP { pieces: Jewel[]; metal: string; gem: string }

const METAL_LIST: Metal[] = ['gold', 'silver', 'rose', 'black'];
const GEMS = ['#f4f6ff', '#ff6b6b', '#7cc4e8', '#9fd9d0'];

function set(key: string, designs: [string, Jewel[]][]): Variant<PiercingP>[] {
  if (designs.length !== 25) throw new Error(`${key} needs 25 designs`);
  const out: Variant<PiercingP>[] = [];
  designs.forEach(([name, pieces]) =>
    METAL_LIST.forEach((m, mi) => out.push({ id: out.length, family: name, name: `${name} · ${m}`, p: { pieces, metal: METALS[m], gem: GEMS[mi] } })),
  );
  return out;
}

const J = (kind: JewelKind, a: number, b = 0, size = 1): Jewel => ({ kind, a, b, size });

/** Ear anchors: a = height along the ear rim (0 lobe … 1 top), b = depth (0 rim … 1 inner/conch). */
export const EAR_PIERCINGS = set('ear', [
  ['Lobe stud', [J('stud', 0.05)]], ['Lobe hoop', [J('hoop', 0.04)]], ['Double hoop', [J('hoop', 0.04), J('hoop', 0.12, 0, 0.8)]],
  ['Stud stack', [J('stud', 0.05), J('stud', 0.15, 0, 0.7), J('gem', 0.24, 0, 0.6)]], ['Helix cuff', [J('cuff', 0.82)]],
  ['Helix + lobe', [J('cuff', 0.82), J('hoop', 0.04)]], ['Twin cuffs', [J('cuff', 0.82), J('cuff', 0.55)]], ['Industrial', [J('bar', 0.8, 0.3)]],
  ['Industrial + hoop', [J('bar', 0.8, 0.3), J('hoop', 0.04)]], ['Conch ring', [J('ring', 0.45, 1)]], ['Conch + studs', [J('ring', 0.45, 1), J('stud', 0.05), J('stud', 0.14, 0, 0.7)]],
  ['Tragus stud', [J('gem', 0.4, 1.2, 0.8)]], ['Spike', [J('spike', 0.05)]], ['Spike + stud', [J('spike', 0.05), J('stud', 0.15)]],
  ['Chain drop', [J('chain', 0.04)]], ['Chain + cuff', [J('chain', 0.04), J('cuff', 0.82)]], ['Mini hoops', [J('hoop', 0.04, 0, 0.7), J('hoop', 0.1, 0, 0.6), J('hoop', 0.16, 0, 0.5)]],
  ['Big hoop', [J('hoop', 0.04, 0, 1.6)]], ['Gem drop', [J('gem', 0.04, 0, 1.2)]], ['Upper lobe', [J('stud', 0.15), J('stud', 0.24, 0, 0.8)]],
  ['Rook', [J('ring', 0.7, 1, 0.7)]], ['Full stack', [J('hoop', 0.04), J('stud', 0.15), J('cuff', 0.82), J('ring', 0.45, 1, 0.7)]], ['Daith', [J('ring', 0.55, 1.3, 0.8)]],
  ['Cuff pair', [J('cuff', 0.65), J('cuff', 0.75)]], ['Constellation', [J('gem', 0.05, 0, 0.7), J('gem', 0.16, 0, 0.6), J('gem', 0.6, 0, 0.5), J('gem', 0.72, 0, 0.5)]],
]);

/** Nose anchors: a = -1 left nostril … 0 septum/centre … 1 right nostril, b = height (0 nostril … 1 bridge). */
export const NOSE_PIERCINGS = set('nose', [
  ['Left stud', [J('stud', -1)]], ['Right stud', [J('stud', 1)]], ['Left hoop', [J('hoop', -1)]], ['Right hoop', [J('hoop', 1)]], ['Septum ring', [J('ring', 0)]],
  ['Septum clicker', [J('ring', 0, 0, 1.2)]], ['Septum + studs', [J('ring', 0), J('stud', -1), J('stud', 1)]], ['Twin studs', [J('stud', -1), J('stud', 1)]], ['Twin hoops', [J('hoop', -1), J('hoop', 1)]],
  ['High nostril', [J('stud', -1, 0.4)]], ['Nostril pair', [J('stud', -1), J('stud', -1, 0.4, 0.7)]], ['Bridge bar', [J('bar', 0, 1)]], ['Bridge + septum', [J('bar', 0, 1), J('ring', 0)]],
  ['Gem left', [J('gem', -1, 0, 1.2)]], ['Gem right', [J('gem', 1, 0, 1.2)]], ['Spiked septum', [J('spike', 0)]], ['Chain nath', [J('chain', -1)]],
  ['Big hoop', [J('hoop', -1, 0, 1.4)]], ['Septum + hoop', [J('ring', 0), J('hoop', 1)]], ['Mini studs', [J('stud', -1, 0, 0.6), J('stud', 1, 0, 0.6)]],
  ['Nath hoop', [J('hoop', -1, 0, 1.8)]], ['Tri-gem', [J('gem', -1), J('gem', 1), J('ring', 0)]], ['Bridge gems', [J('gem', 0, 1, 0.7)]], ['Septum gem', [J('gem', 0, 0, 0.9)]], ['Asymmetric', [J('hoop', 1), J('stud', -1, 0.3)]],
]);

/** Brow anchors: a = side (-1 left, 1 right), b = position along brow (0 inner … 1 tail). */
export const BROW_PIERCINGS = set('brow', [
  ['Bar outer', [J('bar', 1, 0.85)]], ['Bar outer L', [J('bar', -1, 0.85)]], ['Ring outer', [J('ring', 1, 0.85)]], ['Ring outer L', [J('ring', -1, 0.85)]], ['Twin rings', [J('ring', 1, 0.8), J('ring', 1, 0.95, 0.8)]],
  ['Stud pair', [J('stud', 1, 0.75), J('stud', 1, 0.95)]], ['Stud trio', [J('stud', 1, 0.6), J('stud', 1, 0.78), J('stud', 1, 0.95)]], ['Inner bar', [J('bar', 1, 0.1)]], ['Both outer', [J('bar', 1, 0.85), J('bar', -1, 0.85)]],
  ['Spike', [J('spike', 1, 0.85)]], ['Spike pair', [J('spike', 1, 0.75), J('spike', 1, 0.95)]], ['Gem', [J('gem', 1, 0.85)]], ['Gem trio', [J('gem', 1, 0.65), J('gem', 1, 0.8), J('gem', 1, 0.95)]],
  ['Ring + stud', [J('ring', 1, 0.9), J('stud', 1, 0.7)]], ['Mid bar', [J('bar', 1, 0.5)]], ['Chain', [J('chain', 1, 0.85)]], ['Gems both', [J('gem', 1, 0.85), J('gem', -1, 0.85)]],
  ['Rings both', [J('ring', 1, 0.85), J('ring', -1, 0.85)]], ['Arc studs', [J('stud', 1, 0.5), J('stud', 1, 0.65), J('stud', 1, 0.8), J('stud', 1, 0.95)]], ['Anti-brow', [J('stud', 1, 1.2)]],
  ['Tiny ring', [J('ring', 1, 0.85, 0.6)]], ['Big ring', [J('ring', 1, 0.85, 1.4)]], ['Spike L', [J('spike', -1, 0.85)]], ['Gem L', [J('gem', -1, 0.85)]], ['Mixed', [J('ring', 1, 0.85), J('gem', -1, 0.85)]],
]);

/** Lip anchors: a = x (-1 … 1), b = 0 lower lip, 1 upper lip / medusa. */
export const LIP_PIERCINGS = set('lip', [
  ['Labret', [J('stud', 0, 0)]], ['Medusa', [J('stud', 0, 1)]], ['Vertical', [J('stud', 0, 0), J('stud', 0, 1)]], ['Snake bites', [J('ring', -0.6, 0), J('ring', 0.6, 0)]], ['Spider bites', [J('ring', 0.5, 0, 0.7), J('ring', 0.68, 0, 0.7)]],
  ['Angel bites', [J('stud', -0.5, 1), J('stud', 0.5, 1)]], ['Side ring', [J('ring', 0.6, 0)]], ['Side ring L', [J('ring', -0.6, 0)]], ['Monroe', [J('stud', -0.65, 1)]], ['Madonna', [J('stud', 0.65, 1)]],
  ['Dahlia', [J('stud', -1, 0.5), J('stud', 1, 0.5)]], ['Centre ring', [J('ring', 0, 0)]], ['Spike labret', [J('spike', 0, 0)]], ['Spike bites', [J('spike', -0.6, 0), J('spike', 0.6, 0)]],
  ['Gem labret', [J('gem', 0, 0)]], ['Gem medusa', [J('gem', 0, 1)]], ['Cyber bites', [J('stud', 0, 0), J('stud', 0, 1, 0.8)]], ['Canine bites', [J('stud', -0.5, 0), J('stud', 0.5, 0), J('stud', -0.5, 1), J('stud', 0.5, 1)]],
  ['Shark bites', [J('ring', -0.6, 0, 0.7), J('ring', -0.45, 0, 0.7), J('ring', 0.45, 0, 0.7), J('ring', 0.6, 0, 0.7)]], ['Triple', [J('stud', -0.5, 0), J('stud', 0, 0), J('stud', 0.5, 0)]],
  ['Double ring', [J('ring', 0.55, 0), J('ring', 0.55, 0, 0.7)]], ['Gem bites', [J('gem', -0.6, 0), J('gem', 0.6, 0)]], ['Tiny labret', [J('stud', 0, 0, 0.6)]], ['Big ring', [J('ring', 0.6, 0, 1.4)]], ['Mixed', [J('ring', 0.6, 0), J('stud', 0, 1)]],
]);

/** Tongue: a = position along tongue, b = left/right offset. Shows with a tongue-out pose. */
export const TONGUE_PIERCINGS = set('tongue', [
  ['Centre', [J('stud', 0.5, 0)]], ['Forward', [J('stud', 0.75, 0)]], ['Pair', [J('stud', 0.5, -0.4), J('stud', 0.5, 0.4)]], ['Snake eyes', [J('stud', 0.85, -0.3, 0.7), J('stud', 0.85, 0.3, 0.7)]], ['Trio', [J('stud', 0.45, 0), J('stud', 0.65, -0.3), J('stud', 0.65, 0.3)]],
  ['Gem centre', [J('gem', 0.5, 0)]], ['Gem forward', [J('gem', 0.75, 0)]], ['Gem pair', [J('gem', 0.55, -0.4), J('gem', 0.55, 0.4)]], ['Spike', [J('spike', 0.55, 0)]], ['Spike pair', [J('spike', 0.55, -0.35), J('spike', 0.55, 0.35)]],
  ['Big stud', [J('stud', 0.55, 0, 1.4)]], ['Tiny stud', [J('stud', 0.55, 0, 0.6)]], ['Line', [J('stud', 0.35, 0), J('stud', 0.6, 0), J('stud', 0.85, 0, 0.7)]], ['Diagonal', [J('stud', 0.4, -0.3), J('stud', 0.7, 0.3)]],
  ['Ring tip', [J('ring', 0.95, 0, 0.7)]], ['Ring side', [J('ring', 0.6, 0.6, 0.7)]], ['Gem trio', [J('gem', 0.45, 0), J('gem', 0.65, -0.3), J('gem', 0.65, 0.3)]], ['Quad', [J('stud', 0.45, -0.3), J('stud', 0.45, 0.3), J('stud', 0.7, -0.3), J('stud', 0.7, 0.3)]],
  ['Back', [J('stud', 0.3, 0)]], ['Back pair', [J('stud', 0.3, -0.35), J('stud', 0.3, 0.35)]], ['Spike tip', [J('spike', 0.85, 0, 0.8)]], ['Gem tip', [J('gem', 0.9, 0, 0.7)]], ['Mixed', [J('gem', 0.5, 0), J('spike', 0.75, 0, 0.7)]],
  ['Bar', [J('bar', 0.55, 0)]], ['Bar pair', [J('bar', 0.5, -0.35), J('bar', 0.5, 0.35)]],
]);

/** Hearing aids: 20 colourways. */
export interface HearingP { shell: string; accent: string }
export const HEARING: Variant<HearingP>[] = [
  ['Pearl', '#e9e2d6', '#c9a75a'], ['Silver', '#c8ccd2', '#8a8f96'], ['Graphite', '#3a3a40', '#c8ccd2'], ['Sand', '#d4b483', '#8a5532'], ['Cocoa', '#6b4a2b', '#e9c46a'],
  ['Ember', '#ff7a3d', '#ffe1a0'], ['Rose', '#f0b3c8', '#c2577f'], ['Sky', '#7cc4e8', '#1f3f8a'], ['Mint', '#9fd9d0', '#2f7f6e'], ['Plum', '#7a4ea0', '#f0b3d8'],
  ['Ruby', '#b0182a', '#ffc0c8'], ['Gold', '#e9c46a', '#8a5532'], ['Jet', '#141216', '#ff7a3d'], ['Ocean', '#2f6fbf', '#bfe3f2'], ['Lime', '#b9d86a', '#3a5a2a'],
  ['Coral', '#ff8a5c', '#fff1e0'], ['Lilac', '#c9b3e6', '#4a2a6e'], ['Teal', '#1f8a8a', '#e9e2d6'], ['Blush', '#f4c7a1', '#c08060'], ['Midnight', '#1a2340', '#7cc4e8'],
].map(([name, shell, accent], id) => ({ id, name, family: 'Hearing aid', p: { shell, accent } }));

/** Head add-ons: 10 kinds × 10 colourways. */
export interface HeadExtraP { kind: string; c1: string; c2: string }
const EXTRA_KINDS = ['Devil horns', 'Ram horns', 'Unicorn horn', 'Cat ears', 'Bunny ears', 'Halo', 'Antennae', 'Flower crown', 'Tiara', 'Leaf crown'];
const EXTRA_COLS: [string, string][] = [
  ['#d9364a', '#7a1424'], ['#f4e9da', '#c9a75a'], ['#1d1917', '#5a4a40'], ['#e9c46a', '#fff1e0'], ['#ff8a5c', '#ffd39a'],
  ['#c084b4', '#f0b3d8'], ['#7cc4e8', '#e9f4fb'], ['#5fc9a8', '#d9e8a8'], ['#b56aa6', '#7a4ea0'], ['#ff6b6b', '#ffc0c8'],
];
export const HEAD_EXTRAS: Variant<HeadExtraP>[] = EXTRA_KINDS.flatMap((kind, ki) => EXTRA_COLS.map(([c1, c2], ci) => ({ id: ki * 10 + ci, name: kind, family: kind, p: { kind, c1, c2 } })));
