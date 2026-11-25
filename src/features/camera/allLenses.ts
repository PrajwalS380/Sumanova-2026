import { LENSES, type Lens } from './lenses';
import { FRAME_LENSES, type FrameLens, type LensCategory } from './frameLenses';

/** Every camera lens, for the lens browser: face stickers (overlay) and full-frame effects. */
export type AnyLens = (Lens & { kind: 'overlay'; category: LensCategory; needs: ('face' | 'selfie' | 'hair')[] }) | (FrameLens & { kind: 'frame' });

const CAT: Record<string, LensCategory> = {
  shades: 'Faces', kitty: 'Faces', hearts: 'Faces', halo: 'Faces', puppy: 'Faces', bunny: 'Faces', devil: 'Faces', alien: 'Faces', emojime: 'Faces',
  crown: 'Fun', flowercrown: 'Fun', butterflies: 'World', novarain: 'World', aurora: 'Beauty', blush: 'Beauty', wow: 'Fun',
};

export const ALL_LENSES: AnyLens[] = [
  ...LENSES.map((l) => ({ ...l, kind: 'overlay' as const, category: CAT[l.id] ?? 'Fun', needs: ['face' as const] })),
  ...FRAME_LENSES.map((l) => ({ ...l, kind: 'frame' as const })),
];
export const LENS_CATEGORIES: LensCategory[] = ['Fun', 'Faces', 'Beauty', 'Background', 'Hair', 'Warp', 'World'];
export const lensById = (id: string | null) => (id ? ALL_LENSES.find((l) => l.id === id) ?? null : null);

/** Search by name or category ("blur", "hair", "pink"…). */
export function searchLenses(q: string, cat: LensCategory | 'All' = 'All') {
  const s = q.trim().toLowerCase();
  return ALL_LENSES.filter((l) => (cat === 'All' || l.category === cat) && (!s || l.name.toLowerCase().includes(s) || l.category.toLowerCase().includes(s) || l.id.includes(s)));
}
