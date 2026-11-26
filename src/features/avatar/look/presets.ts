import { DEFAULT_LOOK, SLOTS, type ColorKey, type Look, type Slot } from './config';
import { HAIR, SKIN } from './palettes';
import { hairId } from './hair';
import type { Pattern } from './fashion';

/**
 * Ready-made, original starter characters. Each one is just a normal Look
 * (variant ids + colours), so everything stays editable afterwards.
 * Ids are looked up by family/cut name so catalogue re-ordering can't break them.
 */
function id(slot: Slot, family: string, n = 0, pattern?: Pattern): number {
  const list = SLOTS[slot] as readonly { id: number; family: string; p: unknown }[];
  const fam = list.filter((v) => v.family === family && (!pattern || (v.p as { pattern?: string }).pattern === pattern));
  const v = fam[Math.min(n, fam.length - 1)];
  if (!v) throw new Error(`preset: no ${slot} "${family}"`);
  return v.id;
}

interface Spec {
  name: string;
  skin: number; // SKIN index
  hair: string | null; // hairstyle name
  hairColor: number | string; // HAIR index or hex
  tip?: string;
  beard?: [string, number];
  lashes?: [string, number];
  wear: Partial<Record<'top' | 'outer' | 'bottom' | 'dress' | 'shoes' | 'hat' | 'glasses', [string, Pattern?, number?]>>;
  colors?: Partial<Record<ColorKey, string>>;
  body?: number;
}

const SPECS: Spec[] = [
  { name: 'Aarav', skin: 46, hair: 'Side-parted short', hairColor: 1, beard: ['Stubble', 3], wear: { top: ['Tee', 'solid'], outer: ['Denim jacket', 'solid'], bottom: ['Straight jeans', 'denimDark'], shoes: ['Low sneaker', 'solid'] }, colors: { top: '#f4f1ec', outer: '#5b7fae', bottom: '#2d3a58', shoes: '#f6f3ee' } },
  { name: 'Meera', skin: 41, hair: 'Long wavy', hairColor: 0, lashes: ['Full', 4], wear: { top: ['Long sleeve', 'solid'], bottom: ['Wide trousers', 'solid'], shoes: ['Loafer', 'solid'] }, colors: { top: '#b4532a', bottom: '#efe6d6', shoes: '#3a2418', lips: '#b25b5b' } },
  { name: 'Kofi', skin: 86, hair: 'Cornrows', hairColor: 0, beard: ['Short beard', 2], wear: { outer: ['Hoodie', 'solid'], bottom: ['Joggers', 'solid'], shoes: ['High-top', 'solid'], glasses: ['Round', undefined, 0] }, colors: { outer: '#6f7680', bottom: '#4a4f57', shoes: '#1d1d20' } },
  { name: 'Zoe', skin: 4, hair: 'Straight fringe bob', hairColor: 22, tip: '#f08fb8', lashes: ['Natural', 6], wear: { top: ['Crop top', 'solid'], outer: ['Bomber', 'solid'], bottom: ['Baggy jeans', 'denimLight'], shoes: ['Runner', 'solid'] }, colors: { top: '#efe9f6', outer: '#5d6b3a', bottom: '#9db6d8', shoes: '#f4f1ec' } },
  { name: 'Ishaan', skin: 53, hair: 'Voluminous quiff', hairColor: 0, beard: ['Short beard', 5], wear: { top: ['Tee', 'solid'], outer: ['Biker', 'solid'], bottom: ['Skinny jeans', 'solid'], shoes: ['Chelsea boot', 'solid'] }, colors: { top: '#efece6', outer: '#1d1b1c', bottom: '#2b3140', shoes: '#4a2e1e' } },
  { name: 'Lina', skin: 12, hair: 'Messy bun', hairColor: 11, lashes: ['Natural', 2], wear: { top: ['Sweatshirt', 'solid'], bottom: ['Cargo', 'solid'], shoes: ['Low sneaker', 'solid'] }, colors: { top: '#9db89a', bottom: '#b9a27c', shoes: '#f6f3ee' } },
  { name: 'Rohan', skin: 62, hair: 'Short curly', hairColor: 2, wear: { top: ['Tee', 'solid'], outer: ['Varsity', 'solid'], bottom: ['Chinos', 'solid'], shoes: ['Runner', 'solid'] }, colors: { top: '#f1ede6', outer: '#7a1f2b', bottom: '#d8c7a6', shoes: '#f4f1ec' } },
  { name: 'Priya', skin: 50, hair: 'Middle-parted long', hairColor: 0, lashes: ['Winged', 6], wear: { dress: ['Saree', 'solid'], shoes: ['Sandal', 'solid'] }, colors: { dress: '#b0204f', shoes: '#c9a75a', lips: '#a33a4a' } },
  { name: 'Sam', skin: 22, hair: 'Undercut', hairColor: 37, wear: { top: ['Tee', 'solid'], outer: ['Puffer', 'solid'], bottom: ['Joggers', 'solid'], shoes: ['Combat boot', 'solid'] }, colors: { top: '#e9e6e0', outer: '#202326', bottom: '#3a3d42', shoes: '#1d1917' } },
  { name: 'Nia', skin: 92, hair: 'Natural afro', hairColor: 0, lashes: ['Full', 2], wear: { dress: ['Shirt dress', 'solid'], outer: ['Denim jacket', 'solid'], shoes: ['Slip-on', 'solid'] }, colors: { dress: '#e8b04a', outer: '#7d9cc4', shoes: '#f4f1ec', lips: '#8a3b3b' } },
  { name: 'Kabir', skin: 60, hair: 'Crew cut', hairColor: 1, beard: ['Full beard', 4], wear: { top: ['Polo', 'solid'], bottom: ['Chinos', 'solid'], shoes: ['Loafer', 'solid'], glasses: ['Aviator', undefined, 2] }, colors: { top: '#1f2f55', bottom: '#cdb892', shoes: '#4a2e1e' } },
  { name: 'Maya', skin: 31, hair: 'Pixie cut', hairColor: 31, lashes: ['Cat liner', 3], wear: { top: ['Boxy tee', 'solid'], bottom: ['Flared jeans', 'denim'], shoes: ['Slip-on', 'solid'] }, colors: { top: '#1c1b1f', bottom: '#5d7fae', shoes: '#f4f1ec' } },
];

function build(s: Spec): Look {
  const l: Look = structuredClone(DEFAULT_LOOK);
  l.skin = SKIN[s.skin];
  l.pick = { ...l.pick, hair: s.hair ? hairId(s.hair) : null, beard: s.beard ? id('beard', s.beard[0], s.beard[1]) : null, lashes: s.lashes ? id('lashes', s.lashes[0], s.lashes[1]) : null };
  l.pick.top = l.pick.outer = l.pick.bottom = l.pick.dress = l.pick.hat = l.pick.glasses = null;
  for (const [slot, w] of Object.entries(s.wear) as [keyof Spec['wear'], [string, Pattern?, number?]][]) l.pick[slot] = id(slot, w[0], w[2] ?? 0, w[1]);
  const hc = typeof s.hairColor === 'number' ? HAIR[s.hairColor] : s.hairColor;
  l.color = { ...l.color, hair: hc, brows: hc, beard: hc, hairTip: s.tip ?? null, ...s.colors };
  if (s.body != null) l.pick.body = s.body;
  return l;
}

export const PRESETS: { name: string; look: Look }[] = SPECS.map((s) => ({ name: s.name, look: build(s) }));
