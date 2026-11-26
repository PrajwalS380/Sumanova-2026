import type { Variant } from './face';

/**
 * Hairstyle library. Every style is a hand-authored GROOM RECIPE — not a parameter step of a
 * shared mesh: where hair grows (hairline, fades, mohawk strips), how it is combed (flow, parting,
 * fringe), how long each region is, its volume and texture (straight → coily), and how it is tied
 * (ponytails, buns, plaits, cornrows, locs, twists). `sculpt3d/groom.ts` grows spline strands
 * from these recipes; the hair material (`render/SculptHair.tsx`) shades them along their
 * direction and applies the colour treatment (`paint`).
 */

export type HairCat = 'Short' | 'Medium' | 'Long' | 'Updos & braids' | 'Curly & coily' | 'Creative';
export const HAIR_CATS: HairCat[] = ['Short', 'Medium', 'Long', 'Updos & braids', 'Curly & coily', 'Creative'];

export type HairTex = 'straight' | 'wavy' | 'curly' | 'coily' | 'textured';
/** How the hair is combed from the root. */
export type HairFlow = 'down' | 'back' | 'forward' | 'up' | 'side' | 'out' | 'messy' | 'hawk';
export type PartT = 'none' | 'left' | 'right' | 'middle' | 'zigzag';
export type FringeT = 'none' | 'straight' | 'curtain' | 'side' | 'wispy' | 'textured';
export type FadeT = 'none' | 'taper' | 'low' | 'mid' | 'high' | 'skin' | 'undercut' | 'sides' | 'buzz';
export type TieT = 'none' | 'pony' | 'lowpony' | 'sidepony' | 'twinpony' | 'bun' | 'lowbun' | 'messybun' | 'spacebuns' | 'halfup';
export type BraidT = 'none' | 'single' | 'double' | 'french' | 'dutch' | 'fishtail' | 'box' | 'cornrows' | 'braidbun';
export type LocT = 'none' | 'locs' | 'twists' | 'butterfly' | 'wavylocs';
/** Colour treatment of the style (the colours themselves come from the colour rail). */
export type PaintT = 'none' | 'twotone' | 'ombre' | 'highlights' | 'streaks' | 'split' | 'lowlights';

export interface HairP {
  cat: HairCat;
  /** strand length per region, in head radii (crown/top, sides, back, fringe) */
  top: number;
  side: number;
  back: number;
  fringeLen: number;
  /** volume: lift off the scalp + bulk (0 sleek … 1.5 big) */
  vol: number;
  tex: HairTex;
  /** strength of the texture (wave height / curl tightness) 0 … 1 */
  curl: number;
  flow: HairFlow;
  part: PartT;
  fringe: FringeT;
  fade: FadeT;
  tie: TieT;
  braid: BraidT;
  loc: LocT;
  /** big rounded volume (afros) 0 … 1 */
  afro: number;
  /** varied lengths (layers, shags, wolf cuts) 0 … 1 */
  layers: number;
  /** tousled, random strand directions 0 … 1 */
  messy: number;
  /** longer on one side −1 … 1 */
  asym: number;
  /** 0 blunt cut … 1 piecey, pointed tips */
  tips: number;
  /** clump size multiplier (chunky vs fine) */
  clump: number;
  /** front lift (quiffs, pompadours) 0 … 1 */
  lift: number;
  /** hairline height: −1 low … 1 high / receding */
  line: number;
  /** tail / braid length (head radii) when tied or braided */
  tail: number;
  paint: PaintT;
}

const D: HairP = {
  cat: 'Short', top: 0.35, side: 0.2, back: 0.22, fringeLen: 0.3, vol: 0.4, tex: 'straight', curl: 0.5, flow: 'back', part: 'none', fringe: 'none',
  fade: 'none', tie: 'none', braid: 'none', loc: 'none', afro: 0, layers: 0.2, messy: 0.1, asym: 0, tips: 0.5, clump: 1, lift: 0, line: 0, tail: 1.6, paint: 'none',
};

type R = Partial<HairP>;
const S = (cat: HairCat, name: string, r: R): [string, HairP] => [name, { ...D, cat, ...r }];

/** The library: 110 distinct, named styles. Ids are stable (saved avatars refer to them). */
const LIB: [string, HairP][] = [
  // ------------------------------------------------------------------ short
  S('Short', 'Classic short', { top: 0.32, side: 0.16, back: 0.16, flow: 'side', part: 'left', vol: 0.35, tips: 0.35, fade: 'taper' }),
  S('Short', 'Textured crop', { top: 0.3, side: 0.12, back: 0.12, flow: 'forward', fringe: 'textured', fringeLen: 0.26, vol: 0.5, messy: 0.35, tips: 0.85, fade: 'mid', tex: 'textured' }),
  S('Short', 'French crop', { top: 0.26, side: 0.12, back: 0.12, flow: 'forward', fringe: 'straight', fringeLen: 0.2, vol: 0.3, tips: 0.4, fade: 'high' }),
  S('Short', 'Caesar cut', { top: 0.2, side: 0.12, back: 0.12, flow: 'forward', fringe: 'straight', fringeLen: 0.14, vol: 0.15, tips: 0.25, fade: 'low', clump: 0.75 }),
  S('Short', 'Crew cut', { top: 0.2, side: 0.08, back: 0.08, flow: 'up', lift: 0.3, vol: 0.35, tips: 0.6, fade: 'taper', clump: 0.8 }),
  S('Short', 'Buzz cut', { fade: 'buzz', top: 0, side: 0, back: 0, vol: 0 }),
  S('Short', 'High fade', { top: 0.3, side: 0.05, back: 0.05, flow: 'up', lift: 0.45, vol: 0.5, tips: 0.6, fade: 'high' }),
  S('Short', 'Mid fade', { top: 0.32, side: 0.06, back: 0.06, flow: 'side', part: 'right', vol: 0.45, tips: 0.5, fade: 'mid' }),
  S('Short', 'Low fade', { top: 0.3, side: 0.1, back: 0.1, flow: 'forward', fringe: 'textured', fringeLen: 0.2, vol: 0.4, tips: 0.6, fade: 'low' }),
  S('Short', 'Skin fade', { top: 0.28, side: 0.04, back: 0.04, flow: 'messy', messy: 0.55, vol: 0.55, tips: 0.75, fade: 'skin', tex: 'textured' }),
  S('Short', 'Taper fade', { top: 0.3, side: 0.1, back: 0.1, flow: 'back', vol: 0.4, tips: 0.45, fade: 'taper' }),
  S('Short', 'Side-parted short', { top: 0.36, side: 0.16, back: 0.16, flow: 'side', part: 'left', vol: 0.45, tips: 0.3, fade: 'none', line: 0.1 }),
  S('Short', 'Slicked-back short', { top: 0.38, side: 0.14, back: 0.16, flow: 'back', vol: 0.25, messy: 0, tips: 0.2, fade: 'mid', clump: 1.2 }),
  S('Short', 'Messy short', { top: 0.34, side: 0.18, back: 0.18, flow: 'messy', messy: 0.85, vol: 0.6, tips: 0.8, tex: 'textured' }),
  S('Short', 'Spiky textured', { top: 0.32, side: 0.1, back: 0.1, flow: 'out', lift: 0.8, vol: 0.9, tips: 1, clump: 1.1, fade: 'mid' }),
  S('Short', 'Short quiff', { top: 0.42, side: 0.1, back: 0.1, flow: 'up', lift: 0.75, vol: 0.7, tips: 0.45, fade: 'mid' }),
  S('Short', 'Ivy League', { top: 0.36, side: 0.12, back: 0.12, flow: 'side', part: 'left', lift: 0.25, vol: 0.4, tips: 0.35, fade: 'taper' }),
  S('Short', 'Undercut', { top: 0.6, side: 0.03, back: 0.05, flow: 'back', lift: 0.35, vol: 0.5, tips: 0.35, fade: 'undercut' }),
  S('Short', 'Short curly', { top: 0.3, side: 0.18, back: 0.18, flow: 'out', tex: 'curly', curl: 0.8, vol: 0.7, tips: 0.4, clump: 0.8, fade: 'taper' }),
  S('Short', 'Short wavy', { top: 0.38, side: 0.2, back: 0.2, flow: 'side', part: 'right', tex: 'wavy', curl: 0.6, vol: 0.55, tips: 0.5 }),

  // ------------------------------------------------------------------ medium
  S('Medium', 'Medium layered', { top: 0.6, side: 0.62, back: 0.66, flow: 'down', part: 'left', layers: 0.7, vol: 0.55, tips: 0.6 }),
  S('Medium', 'Side-swept', { top: 0.62, side: 0.5, back: 0.5, flow: 'side', part: 'right', fringe: 'side', fringeLen: 0.55, vol: 0.5, tips: 0.6 }),
  S('Medium', 'Middle part', { top: 0.6, side: 0.62, back: 0.6, flow: 'down', part: 'middle', vol: 0.45, tips: 0.45 }),
  S('Medium', 'Curtains', { top: 0.6, side: 0.52, back: 0.5, flow: 'down', part: 'middle', fringe: 'curtain', fringeLen: 0.55, vol: 0.55, tips: 0.6 }),
  S('Medium', 'Textured messy', { top: 0.55, side: 0.5, back: 0.5, flow: 'messy', messy: 0.8, vol: 0.75, tips: 0.85, tex: 'textured', layers: 0.5 }),
  S('Medium', 'Medium wavy', { top: 0.62, side: 0.66, back: 0.68, flow: 'down', part: 'left', tex: 'wavy', curl: 0.7, vol: 0.7, tips: 0.55 }),
  S('Medium', 'Modern mullet', { top: 0.42, side: 0.25, back: 0.95, flow: 'forward', fringe: 'textured', fringeLen: 0.3, vol: 0.6, tips: 0.8, layers: 0.6, fade: 'taper', tex: 'textured' }),
  S('Medium', 'Wolf cut', { top: 0.5, side: 0.6, back: 0.85, flow: 'messy', fringe: 'curtain', fringeLen: 0.45, messy: 0.55, vol: 0.9, layers: 1, tips: 0.9, tex: 'textured' }),
  S('Medium', 'Shag', { top: 0.55, side: 0.7, back: 0.85, flow: 'down', part: 'middle', fringe: 'wispy', fringeLen: 0.36, vol: 0.8, layers: 0.95, tips: 0.85, tex: 'wavy', curl: 0.35 }),
  S('Medium', 'Medium slick-back', { top: 0.66, side: 0.4, back: 0.55, flow: 'back', vol: 0.3, tips: 0.25, clump: 1.25 }),
  S('Medium', 'Voluminous quiff', { top: 0.62, side: 0.12, back: 0.14, flow: 'up', lift: 1, vol: 1, tips: 0.45, fade: 'mid' }),
  S('Medium', 'Pompadour', { top: 0.7, side: 0.12, back: 0.18, flow: 'up', lift: 1.2, vol: 1.1, tips: 0.25, fade: 'low', clump: 1.2 }),
  S('Medium', 'Brushed back', { top: 0.6, side: 0.3, back: 0.36, flow: 'back', lift: 0.45, vol: 0.6, tips: 0.4 }),
  S('Medium', 'Layered fringe', { top: 0.55, side: 0.55, back: 0.6, flow: 'down', part: 'none', fringe: 'straight', fringeLen: 0.4, layers: 0.7, vol: 0.55, tips: 0.7 }),
  S('Medium', 'Asymmetric', { top: 0.58, side: 0.6, back: 0.5, flow: 'side', part: 'left', fringe: 'side', fringeLen: 0.62, asym: 0.7, vol: 0.5, tips: 0.55 }),

  // ------------------------------------------------------------------ long
  S('Long', 'Long straight', { top: 0.8, side: 1.7, back: 1.85, flow: 'down', part: 'middle', vol: 0.35, tips: 0.35, cat: 'Long' }),
  S('Long', 'Long wavy', { top: 0.8, side: 1.6, back: 1.75, flow: 'down', part: 'left', tex: 'wavy', curl: 0.75, vol: 0.75, tips: 0.55 }),
  S('Long', 'Long curly', { top: 0.7, side: 1.4, back: 1.55, flow: 'down', part: 'middle', tex: 'curly', curl: 0.75, vol: 1, tips: 0.5, clump: 0.85 }),
  S('Long', 'Long layered', { top: 0.8, side: 1.5, back: 1.75, flow: 'down', part: 'left', layers: 0.9, vol: 0.6, tips: 0.7 }),
  S('Long', 'Middle-parted long', { top: 0.85, side: 1.75, back: 1.9, flow: 'down', part: 'middle', vol: 0.3, tips: 0.3 }),
  S('Long', 'Side-parted long', { top: 0.85, side: 1.7, back: 1.85, flow: 'down', part: 'right', vol: 0.45, tips: 0.4 }),
  S('Long', 'Curtain bangs long', { top: 0.8, side: 1.6, back: 1.8, flow: 'down', part: 'middle', fringe: 'curtain', fringeLen: 0.62, vol: 0.5, tips: 0.5 }),
  S('Long', 'Voluminous long', { top: 0.85, side: 1.6, back: 1.8, flow: 'down', part: 'left', tex: 'wavy', curl: 0.45, vol: 1.2, tips: 0.55, layers: 0.5 }),
  S('Long', 'Side-swept long', { top: 0.85, side: 1.6, back: 1.8, flow: 'side', part: 'left', fringe: 'side', fringeLen: 0.7, vol: 0.55, tips: 0.5, asym: 0.25 }),
  S('Long', 'Feathered layers', { top: 0.8, side: 1.45, back: 1.7, flow: 'down', part: 'middle', fringe: 'curtain', fringeLen: 0.7, layers: 1, vol: 0.75, tips: 0.8, tex: 'wavy', curl: 0.3 }),
  S('Long', 'Butterfly cut', { top: 0.75, side: 1.3, back: 1.7, flow: 'down', part: 'middle', fringe: 'curtain', fringeLen: 0.55, layers: 1, vol: 1, tips: 0.75, tex: 'wavy', curl: 0.35 }),
  S('Long', 'Mermaid waves', { top: 0.9, side: 2.0, back: 2.2, flow: 'down', part: 'middle', tex: 'wavy', curl: 0.9, vol: 0.8, tips: 0.6 }),
  S('Long', 'Boho waves', { top: 0.85, side: 1.8, back: 2.0, flow: 'down', part: 'left', tex: 'wavy', curl: 0.65, messy: 0.35, vol: 0.85, tips: 0.75, layers: 0.4 }),
  S('Long', 'Sleek straight', { top: 0.85, side: 1.8, back: 1.95, flow: 'down', part: 'middle', vol: 0.1, tips: 0.15, clump: 1.25, messy: 0 }),
  S('Long', 'Textured long', { top: 0.8, side: 1.5, back: 1.7, flow: 'messy', messy: 0.5, tex: 'textured', vol: 0.8, tips: 0.85, layers: 0.6 }),

  // ------------------------------------------------------------------ updos & braids
  S('Updos & braids', 'High ponytail', { tie: 'pony', top: 0.4, side: 0.3, back: 0.3, flow: 'back', vol: 0.25, tail: 1.9, tips: 0.5 }),
  S('Updos & braids', 'Low ponytail', { tie: 'lowpony', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'middle', vol: 0.2, tail: 1.7, tips: 0.5 }),
  S('Updos & braids', 'Side ponytail', { tie: 'sidepony', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'left', vol: 0.3, tail: 1.5, tex: 'wavy', curl: 0.45, tips: 0.55 }),
  S('Updos & braids', 'Double ponytails', { tie: 'twinpony', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'middle', vol: 0.25, tail: 1.3, tips: 0.55 }),
  S('Updos & braids', 'High bun', { tie: 'bun', top: 0.4, side: 0.3, back: 0.3, flow: 'back', vol: 0.2, tips: 0.4 }),
  S('Updos & braids', 'Low bun', { tie: 'lowbun', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'middle', vol: 0.15, tips: 0.4 }),
  S('Updos & braids', 'Messy bun', { tie: 'messybun', top: 0.4, side: 0.3, back: 0.3, flow: 'back', vol: 0.35, messy: 0.6, tips: 0.7, fringe: 'wispy', fringeLen: 0.42 }),
  S('Updos & braids', 'Space buns', { tie: 'spacebuns', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'middle', vol: 0.2, tips: 0.4 }),
  S('Updos & braids', 'Braided bun', { braid: 'braidbun', tie: 'bun', top: 0.4, side: 0.3, back: 0.3, flow: 'back', vol: 0.15, tips: 0.4 }),
  S('Updos & braids', 'French braid', { braid: 'french', top: 0.4, side: 0.3, back: 0.3, flow: 'back', vol: 0.15, tail: 1.8, tips: 0.4 }),
  S('Updos & braids', 'Dutch braid', { braid: 'dutch', top: 0.4, side: 0.3, back: 0.3, flow: 'back', vol: 0.15, tail: 1.8, tips: 0.4 }),
  S('Updos & braids', 'Fishtail braid', { braid: 'fishtail', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'left', vol: 0.2, tail: 1.9, tips: 0.4 }),
  S('Updos & braids', 'Single braid', { braid: 'single', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'middle', vol: 0.2, tail: 2.0, tips: 0.4 }),
  S('Updos & braids', 'Double braids', { braid: 'double', top: 0.4, side: 0.3, back: 0.3, flow: 'down', part: 'middle', vol: 0.15, tail: 1.7, tips: 0.4 }),
  S('Updos & braids', 'Box braids', { braid: 'box', top: 0.4, side: 1.6, back: 1.8, flow: 'down', part: 'middle', vol: 0.3, tail: 1.8 }),
  S('Updos & braids', 'Cornrows', { braid: 'cornrows', top: 0.4, side: 0.3, back: 0.3, flow: 'back', vol: 0, tail: 0.8 }),
  S('Updos & braids', 'Butterfly locs', { loc: 'butterfly', top: 0.6, side: 1.4, back: 1.6, flow: 'down', part: 'middle', vol: 0.4 }),
  S('Updos & braids', 'Shoulder bob', { top: 0.6, side: 0.95, back: 0.9, flow: 'down', part: 'left', vol: 0.45, tips: 0.35 }),
  S('Updos & braids', 'Blunt bob', { top: 0.55, side: 0.78, back: 0.72, flow: 'down', part: 'middle', fringe: 'straight', fringeLen: 0.42, vol: 0.35, tips: 0.05, clump: 1.15 }),
  S('Updos & braids', 'Layered bob', { top: 0.55, side: 0.8, back: 0.7, flow: 'down', part: 'right', layers: 0.8, vol: 0.6, tips: 0.7 }),
  S('Updos & braids', 'Pixie cut', { top: 0.4, side: 0.2, back: 0.18, flow: 'side', part: 'left', fringe: 'side', fringeLen: 0.42, vol: 0.45, tips: 0.75, fade: 'taper' }),
  S('Updos & braids', 'Long bangs', { top: 0.75, side: 1.5, back: 1.7, flow: 'down', part: 'none', fringe: 'straight', fringeLen: 0.45, vol: 0.4, tips: 0.35 }),
  S('Updos & braids', 'Side bangs', { top: 0.7, side: 1.2, back: 1.4, flow: 'down', part: 'right', fringe: 'side', fringeLen: 0.6, vol: 0.45, tips: 0.5 }),
  S('Updos & braids', 'Straight fringe bob', { top: 0.55, side: 0.85, back: 0.8, flow: 'down', part: 'none', fringe: 'straight', fringeLen: 0.4, vol: 0.4, tips: 0.2 }),
  S('Updos & braids', 'Wispy bangs', { top: 0.7, side: 1.3, back: 1.5, flow: 'down', part: 'none', fringe: 'wispy', fringeLen: 0.42, vol: 0.45, tips: 0.6 }),

  // ------------------------------------------------------------------ curly & coily
  S('Curly & coily', 'Natural afro', { afro: 0.7, tex: 'coily', curl: 0.9, top: 0, side: 0, back: 0, vol: 1, line: -0.1 }),
  S('Curly & coily', 'Rounded afro', { afro: 1, tex: 'coily', curl: 1, top: 0, side: 0, back: 0, vol: 1.2 }),
  S('Curly & coily', 'Tight coils', { tex: 'coily', curl: 1, top: 0.3, side: 0.24, back: 0.24, flow: 'out', vol: 0.8, clump: 0.7, tips: 0.4 }),
  S('Curly & coily', 'Loose curls', { tex: 'curly', curl: 0.55, top: 0.62, side: 0.6, back: 0.62, flow: 'down', part: 'left', vol: 0.9, tips: 0.5 }),
  S('Curly & coily', 'Ringlets', { tex: 'curly', curl: 0.95, top: 0.65, side: 0.9, back: 0.95, flow: 'down', part: 'middle', vol: 0.8, clump: 0.7, tips: 0.4 }),
  S('Curly & coily', 'Curly bob', { tex: 'curly', curl: 0.75, top: 0.55, side: 0.7, back: 0.65, flow: 'down', part: 'right', vol: 1, tips: 0.5 }),
  S('Curly & coily', 'Curly fringe', { tex: 'curly', curl: 0.8, top: 0.48, side: 0.3, back: 0.3, flow: 'forward', fringe: 'textured', fringeLen: 0.4, vol: 0.85, fade: 'taper' }),
  S('Curly & coily', 'Curly undercut', { tex: 'curly', curl: 0.85, top: 0.5, side: 0.04, back: 0.05, flow: 'out', vol: 0.9, fade: 'skin' }),
  S('Curly & coily', 'Textured coils', { tex: 'coily', curl: 0.8, top: 0.5, side: 0.35, back: 0.4, flow: 'out', vol: 1, clump: 0.85, fade: 'taper' }),
  S('Curly & coily', 'Twist-out', { tex: 'curly', curl: 0.7, top: 0.6, side: 0.55, back: 0.6, flow: 'out', vol: 1.1, clump: 1.3, tips: 0.35 }),
  S('Curly & coily', 'Short locs', { loc: 'locs', top: 0.35, side: 0.3, back: 0.32, flow: 'out', vol: 0.4, fade: 'taper' }),
  S('Curly & coily', 'Medium locs', { loc: 'locs', top: 0.8, side: 0.8, back: 0.9, flow: 'down', part: 'none', vol: 0.4 }),
  S('Curly & coily', 'Long locs', { loc: 'locs', top: 0.9, side: 1.6, back: 1.8, flow: 'down', part: 'middle', vol: 0.4 }),
  S('Curly & coily', 'Wavy locs', { loc: 'wavylocs', top: 0.85, side: 1.4, back: 1.6, flow: 'down', part: 'left', vol: 0.45 }),
  S('Curly & coily', 'Rope twists', { loc: 'twists', top: 0.8, side: 1.2, back: 1.4, flow: 'down', part: 'middle', vol: 0.35 }),

  // ------------------------------------------------------------------ creative
  S('Creative', 'Two-tone', { top: 0.6, side: 1.0, back: 1.0, flow: 'down', part: 'middle', vol: 0.45, tips: 0.5, paint: 'twotone' }),
  S('Creative', 'Ombré waves', { top: 0.8, side: 1.6, back: 1.75, flow: 'down', part: 'left', tex: 'wavy', curl: 0.6, vol: 0.7, tips: 0.55, paint: 'ombre' }),
  S('Creative', 'Highlighted layers', { top: 0.75, side: 1.3, back: 1.5, flow: 'down', part: 'right', layers: 0.9, vol: 0.65, tips: 0.7, paint: 'highlights' }),
  S('Creative', 'Colour streaks', { top: 0.7, side: 1.1, back: 1.2, flow: 'down', part: 'left', vol: 0.5, tips: 0.5, paint: 'streaks' }),
  S('Creative', 'Pastel bob', { top: 0.55, side: 0.8, back: 0.75, flow: 'down', part: 'none', fringe: 'straight', fringeLen: 0.4, vol: 0.5, tips: 0.3, paint: 'ombre' }),
  S('Creative', 'Split dye', { top: 0.7, side: 1.4, back: 1.6, flow: 'down', part: 'middle', vol: 0.45, tips: 0.45, paint: 'split' }),
  S('Creative', 'Asymmetric bob', { top: 0.55, side: 0.8, back: 0.55, flow: 'side', part: 'left', fringe: 'side', fringeLen: 0.55, asym: 1, vol: 0.45, tips: 0.25 }),
  S('Creative', 'Long-top undercut', { top: 0.95, side: 0.03, back: 0.05, flow: 'side', part: 'left', fringe: 'side', fringeLen: 0.85, vol: 0.55, tips: 0.5, fade: 'undercut' }),
  S('Creative', 'Mohawk', { flow: 'hawk', top: 0.6, side: 0, back: 0.5, lift: 1, vol: 1, tips: 1, clump: 1.2, fade: 'skin' }),
  S('Creative', 'Faux hawk', { flow: 'hawk', top: 0.42, side: 0.08, back: 0.2, lift: 0.7, vol: 0.8, tips: 0.85, fade: 'mid', messy: 0.3 }),
  // ------------------------------------------------------------------ extras (beyond the first 100)
  S('Short', 'Buzz with line-up', { fade: 'buzz', top: 0, side: 0, back: 0, vol: 0, line: 0.15 }),
  S('Short', 'Curly top fade', { tex: 'coily', curl: 0.9, top: 0.32, side: 0.04, back: 0.04, flow: 'out', vol: 0.9, fade: 'high' }),
  S('Medium', 'Surfer waves', { top: 0.62, side: 0.6, back: 0.6, flow: 'messy', tex: 'wavy', curl: 0.55, messy: 0.5, vol: 0.7, tips: 0.75 }),
  S('Medium', 'Middle part flow', { top: 0.66, side: 0.75, back: 0.72, flow: 'down', part: 'middle', fringe: 'curtain', fringeLen: 0.65, vol: 0.55, tips: 0.45 }),
  S('Long', 'Zigzag part waves', { top: 0.85, side: 1.6, back: 1.8, flow: 'down', part: 'zigzag', tex: 'wavy', curl: 0.5, vol: 0.6, tips: 0.5 }),
  S('Long', 'Long coils', { tex: 'coily', curl: 0.8, top: 0.8, side: 1.2, back: 1.35, flow: 'down', part: 'middle', vol: 1.2, clump: 0.75 }),
  S('Updos & braids', 'Half-up', { tie: 'halfup', top: 0.6, side: 1.4, back: 1.6, flow: 'down', part: 'middle', vol: 0.45, tips: 0.5, tex: 'wavy', curl: 0.35 }),
  S('Updos & braids', 'Top knot', { tie: 'messybun', top: 0.5, side: 0.06, back: 0.06, flow: 'back', vol: 0.3, messy: 0.3, fade: 'undercut' }),
  S('Curly & coily', 'Afro puff', { tie: 'bun', tex: 'coily', curl: 1, top: 0.4, side: 0.3, back: 0.3, flow: 'back', vol: 0.3, afro: 0 }),
  S('Creative', 'Lowlight shag', { top: 0.55, side: 0.7, back: 0.85, flow: 'down', part: 'middle', fringe: 'wispy', fringeLen: 0.38, vol: 0.8, layers: 0.95, tips: 0.85, tex: 'wavy', curl: 0.35, paint: 'lowlights' }),
];

export const HAIRSTYLES: Variant<HairP>[] = LIB.map(([name, p], id) => ({ id, name, family: p.cat, p }));

/** Style id by name (presets, selfie suggestions, old-avatar migration). */
export function hairId(name: string): number {
  const i = HAIRSTYLES.findIndex((v) => v.name === name);
  if (i < 0) throw new Error('unknown hairstyle ' + name);
  return i;
}

// ---------------------------------------------------------------------------- customisation

/** Per-avatar adjustments on top of the chosen style (only the meaningful ones are offered). */
export interface HairTune {
  /** −1 … 1 (shorter … longer) */
  length?: number;
  /** −1 … 1 (flatter … fuller) */
  volume?: number;
  tex?: HairTex;
  part?: PartT;
  fringe?: FringeT;
  paint?: PaintT;
  /** 0 … 1 */
  gloss?: number;
}

/** Which controls make sense for a style (e.g. no parting on a buzz cut, no fringe on cornrows). */
export function hairControls(p: HairP) {
  const shaved = p.fade === 'buzz';
  const structured = p.braid !== 'none' || p.loc !== 'none' || p.afro > 0;
  return {
    length: !shaved && p.braid !== 'cornrows',
    volume: !shaved && p.braid !== 'cornrows',
    tex: !shaved && !structured,
    part: !shaved && p.afro === 0 && p.flow !== 'hawk' && p.braid !== 'cornrows',
    fringe: !shaved && !structured && p.flow !== 'hawk',
    paint: !shaved,
  };
}

/** The style with the avatar's adjustments applied (what the groom builder actually grows). */
export function tuneHair(p: HairP, t: HairTune | null | undefined): HairP {
  if (!t) return p;
  const c = hairControls(p);
  const q = { ...p };
  if (c.length && t.length) {
    const k = Math.max(0.35, 1 + t.length * (p.side > 1 ? 0.35 : 0.5));
    q.top *= k; q.side *= k; q.back *= k; q.tail *= k;
  }
  if (c.volume && t.volume) {
    q.vol = Math.max(0, p.vol + t.volume * 0.5);
    q.afro = p.afro > 0 ? Math.max(0.3, p.afro + t.volume * 0.3) : 0;
  }
  if (c.tex && t.tex) {
    q.tex = t.tex;
    if (t.tex !== p.tex) q.curl = t.tex === 'coily' ? 0.9 : t.tex === 'curly' ? 0.75 : 0.55;
  }
  if (c.part && t.part) q.part = t.part;
  if (c.fringe && t.fringe) {
    q.fringe = t.fringe;
    if (t.fringe !== 'none' && p.fringe === 'none') q.fringeLen = t.fringe === 'curtain' ? 0.6 : t.fringe === 'side' ? 0.6 : 0.42;
  }
  if (c.paint && t.paint) q.paint = t.paint;
  return q;
}

const TEXES: HairTex[] = ['straight', 'wavy', 'curly', 'coily', 'textured'];
const PARTS: PartT[] = ['none', 'left', 'right', 'middle', 'zigzag'];
const FRINGES: FringeT[] = ['none', 'straight', 'curtain', 'side', 'wispy', 'textured'];
const PAINTS: PaintT[] = ['none', 'twotone', 'ombre', 'highlights', 'streaks', 'split', 'lowlights'];
export const HAIR_OPTIONS = { tex: TEXES, part: PARTS, fringe: FRINGES, paint: PAINTS };

/** Validate stored hair adjustments (unknown values are dropped). */
export function normalizeHairTune(raw: unknown): HairTune | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);
  const pick = <T extends string>(v: unknown, list: T[]) => (list.includes(v as T) ? (v as T) : undefined);
  const t: HairTune = { length: num(r.length, -1, 1), volume: num(r.volume, -1, 1), tex: pick(r.tex, TEXES), part: pick(r.part, PARTS), fringe: pick(r.fringe, FRINGES), paint: pick(r.paint, PAINTS), gloss: num(r.gloss, 0, 1) };
  for (const k of Object.keys(t) as (keyof HairTune)[]) if (t[k] === undefined) delete t[k];
  return Object.keys(t).length ? t : undefined;
}
