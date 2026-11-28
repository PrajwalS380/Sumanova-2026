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
export type TieT = 'none' | 'pony' | 'lowpony' | 'sidepony' | 'twinpony' | 'bun' | 'lowbun' | 'messybun' | 'spacebuns' | 'halfup'
  // sumanova-us-109
  | 'topknot' | 'bantu' | 'pineapple' | 'bubble' | 'halfspace';
export type BraidT = 'none' | 'single' | 'double' | 'french' | 'dutch' | 'fishtail' | 'box' | 'cornrows' | 'braidbun'
  // sumanova-us-109
  | 'sideplait' | 'flattwist' | 'fulani';
export type LocT = 'none' | 'locs' | 'twists' | 'butterfly' | 'wavylocs' | 'micro';
/** Hair-type scale (sumanova-us-109): 1 straight, 2A–2C waves, 3A–3C curls, 4A–4C coils. */
export type CurlPattern = '1' | '2A' | '2B' | '2C' | '3A' | '3B' | '3C' | '4A' | '4B' | '4C';
export const CURL_PATTERNS: CurlPattern[] = ['1', '2A', '2B', '2C', '3A', '3B', '3C', '4A', '4B', '4C'];
export interface PatternSpec { tex: HairTex; shape: 'none' | 'wave' | 'spiral' | 'zigzag'; radius: number; pitch: number; shrink: number; vol: number; clump: number; frizz: number }
/** One table drives the groom for every curl pattern (head-radius units). */
export const PATTERN_SPEC: Record<CurlPattern, PatternSpec> = {
  '1': { tex: 'straight', shape: 'none', radius: 0, pitch: 1, shrink: 1, vol: 0, clump: 1, frizz: 0 },
  '2A': { tex: 'wavy', shape: 'wave', radius: 0.03, pitch: 0.1 * 2 * Math.PI, shrink: 0.97, vol: 0.05, clump: 1, frizz: 0 },
  '2B': { tex: 'wavy', shape: 'wave', radius: 0.045, pitch: 0.08 * 2 * Math.PI, shrink: 0.94, vol: 0.1, clump: 0.95, frizz: 0 },
  '2C': { tex: 'wavy', shape: 'wave', radius: 0.06, pitch: 0.065 * 2 * Math.PI, shrink: 0.9, vol: 0.2, clump: 0.9, frizz: 1 },
  '3A': { tex: 'curly', shape: 'spiral', radius: 0.05, pitch: 0.12, shrink: 0.88, vol: 0.25, clump: 0.9, frizz: 0 },
  '3B': { tex: 'curly', shape: 'spiral', radius: 0.035, pitch: 0.08, shrink: 0.8, vol: 0.35, clump: 0.8, frizz: 0 },
  '3C': { tex: 'curly', shape: 'spiral', radius: 0.025, pitch: 0.055, shrink: 0.7, vol: 0.45, clump: 0.75, frizz: 0 },
  '4A': { tex: 'coily', shape: 'spiral', radius: 0.036, pitch: 0.05, shrink: 0.62, vol: 0.9, clump: 0.7, frizz: 0 },
  '4B': { tex: 'coily', shape: 'zigzag', radius: 0.034, pitch: 0.042, shrink: 0.52, vol: 1.1, clump: 0.65, frizz: 0 },
  '4C': { tex: 'coily', shape: 'zigzag', radius: 0.032, pitch: 0.034, shrink: 0.42, vol: 1.35, clump: 0.6, frizz: 0 },
};
/** One-line hints for the editor. */
export const PATTERN_HINT: Record<CurlPattern, string> = {
  '1': 'Straight, no curl',
  '2A': '2A: loose, barely-there waves',
  '2B': '2B: defined S-waves from mid-length',
  '2C': '2C: deep waves with some frizz',
  '3A': '3A: big, loose curls',
  '3B': '3B: springy ringlets',
  '3C': '3C: tight corkscrew curls',
  '4A': '4A: defined coils',
  '4B': '4B: Z-shaped coils',
  '4C': '4C: tight zig-zag coils, most shrinkage',
};
/** Default pattern for a texture word (old looks without a pattern keep their own path). */
export const TEX_PATTERN: Partial<Record<HairTex, CurlPattern>> = { straight: '1', wavy: '2B', curly: '3B', coily: '4A' };
export type HairTag = 'indian' | 'textured' | 'braids' | 'short' | 'long';
export const HAIR_TAGS: HairTag[] = ['indian', 'textured', 'braids', 'short', 'long'];
/** Decorations that belong to a style (paranda, gajra, ribbons, beads). Colour key: hairDeco. */
export type DecoT = 'none' | 'paranda' | 'gajra' | 'ribbon' | 'beads';
/** Hairline edges: crisp barber line-up, natural thinning with baby hairs, or styled laid edges. */
export type EdgeT = 'clean' | 'soft' | 'laid';
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
  /** how the hairline ends (sumanova-us-107) */
  edges: EdgeT;
  // ---- sumanova-us-109 (all optional: old recipes stay byte-identical)
  /** hair-type scale; overrides tex / curl with the pattern table */
  pattern?: CurlPattern;
  /** 0 … 1: sleek / oiled / pressed (flat to the scalp, glossier) */
  sleek?: number;
  /** 0 … 1: long straight ends curve under (silk press) */
  bevel?: number;
  deco?: DecoT;
  tags?: HairTag[];
  /** double braids loop back up and are tied behind the ears */
  looped?: boolean;
  /** box braids: no root knot (the braid grows out of the scalp) */
  knotless?: boolean;
  /** box braids end in loose curly pieces */
  goddess?: boolean;
  /** a lifted front section (puff and plait) */
  puff?: boolean;
}

const D: HairP = {
  cat: 'Short', top: 0.35, side: 0.2, back: 0.22, fringeLen: 0.3, vol: 0.4, tex: 'straight', curl: 0.5, flow: 'back', part: 'none', fringe: 'none',
  fade: 'none', tie: 'none', braid: 'none', loc: 'none', afro: 0, layers: 0.2, messy: 0.1, asym: 0, tips: 0.5, clump: 1, lift: 0, line: 0, tail: 1.6, paint: 'none', edges: 'soft',
};

type R = Partial<HairP>;
const S = (cat: HairCat, name: string, r: R): [string, HairP] => [name, { ...D, cat, ...r }];

/** The library: 110 distinct, named styles. Ids are stable (saved avatars refer to them). */
const LIB: [string, HairP][] = [
  // ------------------------------------------------------------------ short
  S('Short', 'Classic short', { top: 0.32, side: 0.16, back: 0.16, flow: 'side', part: 'left', vol: 0.35, tips: 0.35, fade: 'taper' }),
  S('Short', 'Textured crop', { top: 0.3, side: 0.12, back: 0.12, flow: 'forward', fringe: 'textured', fringeLen: 0.26, vol: 0.5, messy: 0.35, tips: 0.85, fade: 'mid', tex: 'textured' }),
  S('Short', 'French crop', { top: 0.26, side: 0.12, back: 0.12, flow: 'forward', fringe: 'straight', fringeLen: 0.2, vol: 0.3, tips: 0.4, fade: 'high' }),
  S('Short', 'Caesar cut', { top: 0.2, side: 0.12, back: 0.12, flow: 'forward', fringe: 'straight', fringeLen: 0.14, vol: 0.15, tips: 0.25, fade: 'low', clump: 0.75, edges: 'clean' }),
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
  // ------------------------------------------------------------------ sumanova-us-109: every hair type (ids 110–139)
  // South-Asian
  S('Updos & braids', 'Long plait with paranda', { braid: 'single', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'middle', vol: 0.15, tail: 2.4, tips: 0.4, sleek: 0.5, deco: 'paranda', tags: ['indian', 'braids', 'long'] }),
  S('Updos & braids', 'Jooda with gajra', { tie: 'lowbun', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'middle', vol: 0.1, sleek: 0.7, deco: 'gajra', tags: ['indian'] }),
  S('Updos & braids', 'Oiled middle-part plait', { braid: 'single', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'middle', vol: 0.05, tail: 2.1, tips: 0.35, sleek: 1, tags: ['indian', 'braids', 'long'] }),
  S('Updos & braids', 'Twin plaits with ribbons', { braid: 'double', looped: true, top: 0.4, side: 0.3, back: 0.3, flow: 'down', part: 'middle', vol: 0.12, tail: 1.3, tips: 0.4, sleek: 0.4, deco: 'ribbon', tags: ['indian', 'braids'] }),
  S('Updos & braids', 'Side plait over shoulder', { braid: 'sideplait', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'left', vol: 0.2, tail: 2.0, tips: 0.45, tags: ['indian', 'braids', 'long'] }),
  S('Updos & braids', 'Joora top knot', { tie: 'topknot', top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'none', vol: 0.05, sleek: 0.8, tags: ['indian'] }),
  S('Updos & braids', 'Puff and plait', { braid: 'single', puff: true, top: 0.4, side: 0.3, back: 0.3, flow: 'back', part: 'none', vol: 0.3, tail: 1.8, tips: 0.4, tags: ['indian', 'braids'] }),
  S('Long', 'Waist-length straight', { top: 0.9, side: 2.6, back: 2.9, flow: 'down', part: 'middle', vol: 0.3, tips: 0.35, sleek: 0.6, tags: ['indian', 'long'] }),
  // Afro & textured
  S('Curly & coily', 'Bantu knots', { tie: 'bantu', tex: 'coily', curl: 1, pattern: '4B', top: 0.3, side: 0.3, back: 0.3, flow: 'out', vol: 0.2, tags: ['textured', 'short'] }),
  S('Curly & coily', 'Finger coils', { tex: 'coily', curl: 0.9, pattern: '4A', top: 0.45, side: 0.36, back: 0.38, flow: 'out', vol: 0.9, clump: 0.8, tips: 0.4, tags: ['textured', 'short'] }),
  S('Curly & coily', 'Short two-strand twists', { loc: 'twists', top: 0.5, side: 0.45, back: 0.5, flow: 'out', part: 'none', vol: 0.4, tags: ['textured', 'short'] }),
  S('Updos & braids', 'Flat twists', { braid: 'flattwist', top: 0.4, side: 0.3, back: 0.3, flow: 'back', vol: 0, tail: 0.6, tags: ['textured', 'braids'] }),
  S('Curly & coily', 'Pineapple puff', { tie: 'pineapple', tex: 'coily', curl: 1, pattern: '4C', top: 0.4, side: 0.3, back: 0.3, flow: 'back', vol: 0.2, edges: 'laid', tags: ['textured'] }),
  S('Curly & coily', 'Tapered TWA', { tex: 'coily', curl: 1, pattern: '4C', afro: 0.25, top: 0.32, side: 0.18, back: 0.2, flow: 'out', vol: 0.8, fade: 'taper', tags: ['textured', 'short'] }),
  S('Curly & coily', 'Wash-and-go curls', { tex: 'curly', curl: 0.9, pattern: '3C', top: 0.7, side: 0.85, back: 0.9, flow: 'down', part: 'middle', vol: 1, clump: 0.8, tips: 0.4, tags: ['textured'] }),
  S('Curly & coily', 'Sisterlocks', { loc: 'micro', top: 0.85, side: 1.15, back: 1.25, flow: 'down', part: 'middle', vol: 0.3, tags: ['textured', 'long'] }),
  S('Updos & braids', 'Knotless braids', { braid: 'box', knotless: true, top: 0.4, side: 1.6, back: 1.8, flow: 'down', part: 'middle', vol: 0.25, tail: 1.8, tags: ['textured', 'braids', 'long'] }),
  S('Updos & braids', 'Goddess braids', { braid: 'box', knotless: true, goddess: true, top: 0.4, side: 1.5, back: 1.7, flow: 'down', part: 'middle', vol: 0.3, tail: 1.7, tags: ['textured', 'braids', 'long'] }),
  S('Updos & braids', 'Fulani-inspired braids', { braid: 'fulani', top: 0.4, side: 1.3, back: 1.5, flow: 'down', part: 'middle', vol: 0.2, tail: 1.5, deco: 'beads', tags: ['textured', 'braids', 'long'] }),
  S('Creative', 'Coily frohawk', { flow: 'hawk', tex: 'coily', curl: 1, pattern: '4B', top: 0.55, side: 0.05, back: 0.35, lift: 0.6, vol: 1, clump: 0.8, fade: 'taper', tags: ['textured'] }),
  // Waves & curls
  S('Medium', 'Wavy lob', { tex: 'wavy', curl: 0.6, pattern: '2B', top: 0.62, side: 0.95, back: 0.9, flow: 'down', part: 'left', vol: 0.55, tips: 0.5 }),
  S('Long', 'Beach waves', { tex: 'wavy', curl: 0.7, pattern: '2C', top: 0.8, side: 1.6, back: 1.75, flow: 'down', part: 'middle', vol: 0.65, messy: 0.3, tips: 0.65, tags: ['long'] }),
  S('Medium', 'Curly shag', { tex: 'curly', curl: 0.6, pattern: '3A', top: 0.62, side: 0.85, back: 0.9, flow: 'down', part: 'none', fringe: 'textured', fringeLen: 0.42, layers: 0.9, vol: 1, tips: 0.6, tags: ['textured'] }),
  S('Long', 'Spiral curls', { tex: 'curly', curl: 0.85, pattern: '3B', top: 0.8, side: 1.8, back: 2.0, flow: 'down', part: 'middle', vol: 1.1, clump: 0.8, tips: 0.4, tags: ['textured', 'long'] }),
  S('Long', 'Silk press', { pattern: '1', top: 0.85, side: 1.7, back: 1.9, flow: 'down', part: 'middle', vol: 0.35, tips: 0.2, sleek: 0.8, bevel: 1, tags: ['long'] }),
  // Everyday & trendy
  S('Updos & braids', 'Bob with baby bangs', { top: 0.55, side: 0.72, back: 0.66, flow: 'down', part: 'none', fringe: 'straight', fringeLen: 0.22, vol: 0.35, tips: 0.05, clump: 1.15 }),
  S('Updos & braids', 'Man bun with fade', { tie: 'bun', top: 0.5, side: 0.06, back: 0.06, flow: 'back', vol: 0.25, fade: 'skin', tags: ['short'] }),
  S('Updos & braids', 'Slick-back bun', { tie: 'lowbun', top: 0.45, side: 0.3, back: 0.3, flow: 'back', part: 'none', vol: 0.05, sleek: 0.85 }),
  S('Updos & braids', 'Bubble ponytail', { tie: 'bubble', top: 0.4, side: 0.3, back: 0.3, flow: 'back', vol: 0.2, tail: 2.0, tips: 0.5 }),
  S('Updos & braids', 'Half-up space buns', { tie: 'halfspace', top: 0.6, side: 1.4, back: 1.6, flow: 'down', part: 'middle', vol: 0.45, tips: 0.5 }),
];

/** Tags on existing recipes (discovery only: they don't change the groom). */
const OLD_TAGS: Record<string, HairTag[]> = {
  'Natural afro': ['textured'], 'Rounded afro': ['textured'], 'Tight coils': ['textured', 'short'], 'Loose curls': ['textured'],
  Ringlets: ['textured'], 'Curly bob': ['textured'], 'Curly fringe': ['textured'], 'Curly undercut': ['textured', 'short'],
  'Textured coils': ['textured'], 'Twist-out': ['textured'], 'Short locs': ['textured', 'short'], 'Medium locs': ['textured'],
  'Long locs': ['textured', 'long'], 'Wavy locs': ['textured', 'long'], 'Rope twists': ['textured', 'long'], 'Box braids': ['textured', 'braids', 'long'],
  Cornrows: ['textured', 'braids'], 'Butterfly locs': ['textured', 'long'], 'Long coils': ['textured', 'long'], 'Curly top fade': ['textured', 'short'],
  'Afro puff': ['textured'], 'Single braid': ['braids', 'indian'], 'Double braids': ['braids', 'indian'], 'French braid': ['braids'],
  'Dutch braid': ['braids'], 'Fishtail braid': ['braids'], 'Braided bun': ['braids'], 'Low bun': ['indian'], 'Middle-parted long': ['indian', 'long'],
  'Buzz cut': ['short'], 'Crew cut': ['short'], 'Classic short': ['short'], 'Textured crop': ['short'], 'Long straight': ['long'], 'Long wavy': ['long'],
};
for (const [name, p] of LIB) if (OLD_TAGS[name]) p.tags = OLD_TAGS[name];

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
  /** −1 … 1 (lower … higher / receding hairline) */
  line?: number;
  edges?: EdgeT;
  /** hair-type scale (sumanova-us-109) */
  pattern?: CurlPattern;
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
    line: !shaved,
    // laid edges are common on afros, puffs, coils and cornrows too
    edges: !shaved,
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
    // a new texture word drops the recipe's own pattern (unless one is picked below)
    if (t.tex !== p.tex) delete q.pattern;
  }
  if (c.tex && t.pattern) {
    q.pattern = t.pattern;
    q.tex = PATTERN_SPEC[t.pattern].tex;
    if (q.tex !== p.tex) q.curl = q.tex === 'coily' ? 0.9 : q.tex === 'curly' ? 0.75 : q.tex === 'wavy' ? 0.55 : p.curl;
  }
  if (c.part && t.part) q.part = t.part;
  if (c.fringe && t.fringe) {
    q.fringe = t.fringe;
    if (t.fringe !== 'none' && p.fringe === 'none') q.fringeLen = t.fringe === 'curtain' ? 0.6 : t.fringe === 'side' ? 0.6 : 0.42;
  }
  if (c.paint && t.paint) q.paint = t.paint;
  if (c.line && t.line) q.line = Math.max(-1, Math.min(1.2, p.line + t.line));
  if (c.edges && t.edges) q.edges = t.edges;
  return q;
}

const TEXES: HairTex[] = ['straight', 'wavy', 'curly', 'coily', 'textured'];
const PARTS: PartT[] = ['none', 'left', 'right', 'middle', 'zigzag'];
const FRINGES: FringeT[] = ['none', 'straight', 'curtain', 'side', 'wispy', 'textured'];
const PAINTS: PaintT[] = ['none', 'twotone', 'ombre', 'highlights', 'streaks', 'split', 'lowlights'];
const EDGES: EdgeT[] = ['clean', 'soft', 'laid'];
export const HAIR_OPTIONS = { tex: TEXES, part: PARTS, fringe: FRINGES, paint: PAINTS, edges: EDGES };

/** Validate stored hair adjustments (unknown values are dropped). */
export function normalizeHairTune(raw: unknown): HairTune | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);
  const pick = <T extends string>(v: unknown, list: T[]) => (list.includes(v as T) ? (v as T) : undefined);
  const t: HairTune = { length: num(r.length, -1, 1), volume: num(r.volume, -1, 1), tex: pick(r.tex, TEXES), part: pick(r.part, PARTS), fringe: pick(r.fringe, FRINGES), paint: pick(r.paint, PAINTS), gloss: num(r.gloss, 0, 1), line: num(r.line, -1, 1), edges: pick(r.edges, EDGES), pattern: pick(r.pattern, CURL_PATTERNS) };
  for (const k of Object.keys(t) as (keyof HairTune)[]) if (t[k] === undefined) delete t[k];
  return Object.keys(t).length ? t : undefined;
}
