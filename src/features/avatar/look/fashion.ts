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

/**
 * Every item in a category must look different from every other one — even after the user
 * picks their own colour from the rail (which only replaces the main colour, c1). So within a
 * cut each item gets a different, clearly visible pattern, and the trim colours (c2/c3, used
 * for prints, soles, ribbing, hat bands …) rotate too. Cuts keep their 10-id blocks, so saved
 * avatars keep the same garment cut. Checked by e2e/avatar-harness/dupes.ts.
 */
const BOLD: Pattern[] = ['stripes', 'plaid', 'camo', 'dots', 'hearts', 'stars', 'tiedye', 'colorblock', 'fairisle', 'floral', 'leopard', 'argyle', 'chevron', 'paisley', 'gradient', 'checker', 'zebra', 'gingham'];
/** Strong trim / print colours: light, dark and brights, so prints stay visible on any main colour. */
const ACCENT = ['#f6f1ea', '#18151a', '#e5484d', '#ffb547', '#2563eb', '#3fae8c', '#f0b3d8', '#7a4ea0', '#fde68a', '#4fa3d9', '#c4572d', '#9bbf5a'];
/** Default main colours (before the user picks one): wearable first, a few brights. */
const MAIN = ['#2d3a58', '#f4f1ec', '#6f7680', '#9db89a', '#b9a27c', '#7a1f2b', '#1d1d20', '#5b7fae', '#e8b04a', '#c98a9a', '#3d5a6c', '#efe6d6', '#5d6b3a', '#b4532a'];
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

function grid(key: string, cuts: string[], firsts: (cut: string, ci: number) => Pattern[] = () => ['solid'], pool: Pattern[] = BOLD): Variant<Wear>[] {
  const out: Variant<Wear>[] = [];
  cuts.forEach((cut, ci) => {
    const head = firsts(cut, ci);
    const rest = pool.filter((p) => !head.includes(p));
    // a different slice of the pool per cut, so neighbouring cuts don't share the same prints
    const looks = [...head, ...Array.from({ length: 10 - head.length }, (_, j) => rest[(j + ci * 5) % rest.length])];
    looks.forEach((pattern, j) => {
      const c1 = MAIN[(ci * 3 + j) % MAIN.length];
      // trims contrast with the default colour and differ item to item
      let c2 = ACCENT[(j * 5 + ci) % ACCENT.length];
      if (Math.abs(lum(c2) - lum(c1)) < 0.25) c2 = ACCENT[(j * 5 + ci + 1) % ACCENT.length];
      if (Math.abs(lum(c2) - lum(c1)) < 0.25) c2 = lum(c1) > 0.5 ? '#18151a' : '#f6f1ea';
      const c3 = ACCENT[(j * 7 + ci + 3) % ACCENT.length];
      out.push({ id: out.length, family: cut, name: `${cut} · ${LOOK_NAME[pattern]}`, p: { cut, pattern, c1, c2, c3 } });
    });
  });
  if (out.length !== cuts.length * 10) throw new Error(`${key} has ${out.length}`);
  const seen = new Set<string>();
  for (const v of out) {
    const k = `${v.p.cut}|${v.p.pattern}`;
    if (seen.has(k)) throw new Error(`${key}: duplicate ${k}`);
    seen.add(k);
  }
  return out;
}

export const LOOK_NAME: Record<Pattern, string> = {
  solid: 'Solid', stripes: 'Stripes', pinstripe: 'Pinstripe', plaid: 'Plaid', gingham: 'Gingham', camo: 'Camo', dots: 'Dots', hearts: 'Hearts',
  stars: 'Stars', tiedye: 'Tie-dye', colorblock: 'Colour block', fairisle: 'Fair isle', floral: 'Floral', leopard: 'Spots', denim: 'Denim',
  denimLight: 'Light wash', denimDark: 'Dark wash', knit: 'Knit', emblem: 'Emblem', argyle: 'Argyle', chevron: 'Chevron', paisley: 'Paisley',
  gradient: 'Gradient', checker: 'Checker', zebra: 'Stripe wild',
};

export const TOPS = grid('top', ['Tee', 'V-neck', 'Boxy tee', 'Long sleeve', 'Polo', 'Shirt', 'Lounge shirt', 'Sweatshirt', 'Tank', 'Crop top'], (cut) =>
  cut === 'Tee' || cut === 'Boxy tee' || cut === 'Sweatshirt' ? ['solid', 'emblem'] : ['solid'],
);

export const OUTERWEAR = grid('outer', ['Puffer', 'Bomber', 'Denim jacket', 'Biker', 'Shaggy coat', 'Zip hoodie', 'Hoodie', 'Trench', 'Blazer', 'Varsity'], (cut) =>
  cut === 'Denim jacket' ? ['solid', 'denim', 'denimLight'] : ['solid'],
);

const JEANS = ['Straight jeans', 'Flared jeans', 'Baggy jeans', 'Skinny jeans'];
export const BOTTOMS = grid('bottom', [...JEANS, 'Cargo', 'Joggers', 'Chinos', 'Shorts', 'Lounge pants', 'Wide trousers'], (cut) =>
  JEANS.includes(cut) ? ['denim', 'denimLight', 'denimDark', 'solid'] : cut === 'Shorts' ? ['solid', 'denim'] : ['solid'],
);

export const DRESSES = grid('dress', ['Slip', 'A-line', 'Maxi', 'Saree', 'Lehenga', 'Bodycon', 'Shirt dress', 'Anarkali', 'Tiered', 'Wrap']);

export const SHOES = grid('shoes', ['Low sneaker', 'High-top', 'Runner', 'Slip-on', 'Loafer', 'Chelsea boot', 'Combat boot', 'Sandal', 'Slide', 'Cosy slipper']);

export const SOCKS = grid('socks', ['Crew', 'Knee', 'Ankle', 'Calf', 'Sport crew', 'Sport knee', 'Ribbed crew', 'Slouch', 'Over-knee', 'Trainer']);

export const BAGS = grid('bag', ['Crossbody', 'Tote', 'Backpack', 'Baguette', 'Bucket', 'Belt bag', 'Clutch', 'Duffle', 'Bowling', 'Mini top-handle']);

export const HATS = grid('hat', ['Cap', 'Beanie', 'Bucket hat', 'Fedora', 'Beret', 'Trapper', 'Hard hat', 'Festive hat', 'Headband', 'Pagdi']);

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
