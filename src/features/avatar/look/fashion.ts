import { CLOTH } from './palettes';
import type { Variant } from './face';

/**
 * Wardrobe catalogue. Every category = 10 original cuts × 10 looks
 * (pattern + colourway) = 100 items. No brand names, logos or paid items.
 */
export type Pattern =
  | 'solid' | 'stripes' | 'pinstripe' | 'plaid' | 'gingham' | 'camo' | 'dots' | 'hearts' | 'stars' | 'tiedye'
  | 'colorblock' | 'fairisle' | 'floral' | 'leopard' | 'denim' | 'denimLight' | 'denimDark' | 'knit' | 'emblem'
  | 'argyle' | 'chevron' | 'paisley' | 'gradient' | 'checker' | 'zebra';

export interface Wear { cut: string; pattern: Pattern; c1: string; c2: string; c3: string }

const C = (i: number) => CLOTH[((i % CLOTH.length) + CLOTH.length) % CLOTH.length];

function grid(key: string, cuts: string[], looks: [Pattern, number, number, number][]): Variant<Wear>[] {
  const out: Variant<Wear>[] = [];
  cuts.forEach((cut, ci) => {
    looks.forEach(([pattern, a, b, c], li) => {
      // rotate colourways per cut so the grid never repeats exactly
      const shift = ci * 3;
      out.push({ id: out.length, family: cut, name: `${cut} · ${LOOK_NAME[pattern]}`, p: { cut, pattern, c1: C(a + shift), c2: C(b + shift), c3: C(c + shift) } });
      void li;
    });
  });
  if (out.length !== 100) throw new Error(`${key} has ${out.length}`);
  return out;
}

export const LOOK_NAME: Record<Pattern, string> = {
  solid: 'Solid', stripes: 'Stripes', pinstripe: 'Pinstripe', plaid: 'Plaid', gingham: 'Gingham', camo: 'Camo', dots: 'Dots', hearts: 'Hearts',
  stars: 'Stars', tiedye: 'Tie-dye', colorblock: 'Colour block', fairisle: 'Fair isle', floral: 'Floral', leopard: 'Spots', denim: 'Denim',
  denimLight: 'Light wash', denimDark: 'Dark wash', knit: 'Knit', emblem: 'Emblem', argyle: 'Argyle', chevron: 'Chevron', paisley: 'Paisley',
  gradient: 'Gradient', checker: 'Checker', zebra: 'Stripe wild',
};

const TEE_LOOKS: [Pattern, number, number, number][] = [
  ['solid', 0, 9, 20], ['stripes', 0, 37, 46], ['plaid', 46, 9, 0], ['gingham', 0, 34, 0], ['emblem', 35, 20, 9],
  ['camo', 26, 15, 8], ['dots', 8, 0, 21], ['hearts', 0, 45, 44], ['tiedye', 43, 34, 21], ['colorblock', 8, 0, 20],
];
export const TOPS = grid('top', ['Tee', 'V-neck', 'Boxy tee', 'Long sleeve', 'Polo', 'Shirt', 'Lounge shirt', 'Sweatshirt', 'Tank', 'Crop top'], TEE_LOOKS);

export const OUTERWEAR = grid('outer', ['Puffer', 'Bomber', 'Denim jacket', 'Biker', 'Shaggy coat', 'Zip hoodie', 'Hoodie', 'Trench', 'Blazer', 'Varsity'], [
  ['solid', 35, 0, 9], ['solid', 8, 20, 0], ['colorblock', 36, 0, 20], ['camo', 26, 15, 8], ['solid', 12, 0, 8],
  ['knit', 2, 13, 8], ['solid', 45, 0, 8], ['gradient', 21, 46, 8], ['plaid', 38, 8, 20], ['solid', 27, 0, 9],
]);

export const BOTTOMS = grid('bottom', ['Straight jeans', 'Flared jeans', 'Baggy jeans', 'Skinny jeans', 'Cargo', 'Joggers', 'Chinos', 'Shorts', 'Lounge pants', 'Wide trousers'], [
  ['denim', 37, 0, 0], ['denimLight', 35, 0, 0], ['denimDark', 38, 0, 0], ['solid', 8, 0, 0], ['solid', 2, 0, 0],
  ['plaid', 46, 8, 0], ['gingham', 8, 0, 0], ['camo', 26, 15, 8], ['fairisle', 47, 0, 26], ['pinstripe', 39, 1, 0],
]);

export const DRESSES = grid('dress', ['Slip', 'A-line', 'Maxi', 'Saree', 'Lehenga', 'Bodycon', 'Shirt dress', 'Anarkali', 'Tiered', 'Wrap'], [
  ['solid', 46, 22, 0], ['floral', 0, 44, 26], ['paisley', 20, 22, 48], ['solid', 41, 22, 0], ['gradient', 44, 41, 22],
  ['dots', 8, 0, 0], ['stripes', 0, 36, 0], ['leopard', 12, 6, 0], ['gingham', 0, 45, 0], ['chevron', 30, 0, 21],
]);

export const SHOES = grid('shoes', ['Low sneaker', 'High-top', 'Runner', 'Slip-on', 'Loafer', 'Chelsea boot', 'Combat boot', 'Sandal', 'Slide', 'Cosy slipper'], [
  ['solid', 0, 0, 9], ['solid', 9, 0, 0], ['colorblock', 0, 20, 9], ['checker', 0, 9, 0], ['solid', 16, 0, 9],
  ['solid', 46, 0, 0], ['colorblock', 0, 36, 21], ['plaid', 46, 9, 0], ['solid', 41, 0, 9], ['solid', 3, 0, 9],
]);

export const SOCKS = grid('socks', ['Crew', 'Knee', 'Ankle', 'Calf', 'Sport crew', 'Sport knee', 'Ribbed crew', 'Slouch', 'Over-knee', 'Trainer'], [
  ['solid', 0, 0, 0], ['stripes', 0, 9, 46], ['hearts', 0, 44, 0], ['dots', 9, 0, 0], ['argyle', 38, 0, 46],
  ['stripes', 9, 0, 0], ['solid', 9, 0, 0], ['stars', 36, 22, 0], ['checker', 0, 9, 0], ['gradient', 21, 45, 0],
]);

export const BAGS = grid('bag', ['Crossbody', 'Tote', 'Backpack', 'Baguette', 'Bucket', 'Belt bag', 'Clutch', 'Duffle', 'Bowling', 'Mini top-handle'], [
  ['solid', 16, 15, 22], ['solid', 9, 0, 22], ['solid', 0, 15, 22], ['denim', 35, 0, 22], ['solid', 22, 0, 9],
  ['checker', 0, 9, 22], ['leopard', 12, 6, 22], ['solid', 44, 0, 22], ['plaid', 46, 9, 22], ['solid', 30, 0, 22],
]);

export const HATS = grid('hat', ['Cap', 'Beanie', 'Bucket hat', 'Fedora', 'Beret', 'Trapper', 'Hard hat', 'Festive hat', 'Headband', 'Pagdi'], [
  ['solid', 9, 0, 0], ['solid', 46, 0, 0], ['camo', 26, 15, 8], ['solid', 13, 9, 0], ['solid', 0, 9, 0],
  ['knit', 2, 13, 0], ['solid', 22, 9, 0], ['solid', 37, 0, 0], ['stripes', 0, 46, 0], ['gradient', 21, 45, 0],
]);

/** Glasses: frames × lens tints. c1 = frame colour, c2/c3 = lens gradient. */
export const GLASSES: Variant<Wear>[] = (() => {
  const frames = ['Aviator', 'Round', 'Square', 'Cat-eye', 'Shield visor', 'Rimless', 'Oversized', 'Sport wrap', 'Heart', 'Browline'];
  const tints: [string, string, string][] = [
    ['Clear', '#ffffff', '#ffffff'], ['Smoke', '#1c1c22', '#5a5a64'], ['Gradient', '#2a2a30', '#d8d8de'], ['Amber', '#8a4a10', '#ffb547'], ['Rose', '#c2577f', '#ffc0c8'],
    ['Ocean', '#1f3f8a', '#7cc4e8'], ['Prism', '#e5484d', '#4fa3d9'], ['Aurora', '#7a4ea0', '#5fc9a8'], ['Mirror', '#c8ccd2', '#f6f6f8'], ['Jade', '#2f5d3a', '#9fd9d0'],
  ];
  const frameCol = ['#c9a75a', '#1d1917', '#1d1917', '#2a1a14', '#d6d9de', '#d6d9de', '#0c0a09', '#e5484d', '#ff6b6b', '#3a2a1f'];
  const out: Variant<Wear>[] = [];
  frames.forEach((cut, fi) => tints.forEach(([tn, a, b]) => out.push({ id: out.length, family: cut, name: `${cut} · ${tn}`, p: { cut, pattern: 'solid', c1: frameCol[fi], c2: a, c3: b } })));
  return out;
})();
