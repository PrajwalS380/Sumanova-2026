import type { AvatarConfig as V1 } from '../config';
import { SKIN, HAIR, EYES, BROWS as BROW_COLS, LIPS, CLOTH } from './palettes';
import { HEADS, EYE_SHAPES, LASHES, BROWS, NOSES, MOUTHS, EARS, BODIES, BEARDS } from './face';
import { HAIRSTYLES } from './hair';
import { TOPS, OUTERWEAR, BOTTOMS, DRESSES, SHOES, SOCKS, BAGS, HATS, GLASSES } from './fashion';
import { EAR_PIERCINGS, NOSE_PIERCINGS, BROW_PIERCINGS, LIP_PIERCINGS, TONGUE_PIERCINGS, HEARING, HEAD_EXTRAS } from './extras';
import type { Variant } from './face';

export type Expression = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'laughing' | 'crying' | 'winking' | 'blushing' | 'sleeping' | 'tongue';
export type Pose = 'standing' | 'sitting' | 'dancing' | 'waving' | 'walking' | 'thumbsup' | 'celebrating';

/** Every pickable slot. `null` means "none" for optional slots. */
export const SLOTS = {
  head: HEADS, eyes: EYE_SHAPES, lashes: LASHES, brows: BROWS, nose: NOSES, mouth: MOUTHS, ears: EARS, body: BODIES,
  hair: HAIRSTYLES, beard: BEARDS,
  earL: EAR_PIERCINGS, earR: EAR_PIERCINGS, nosePierce: NOSE_PIERCINGS, browPierce: BROW_PIERCINGS, lipPierce: LIP_PIERCINGS, tonguePierce: TONGUE_PIERCINGS,
  hearingL: HEARING, hearingR: HEARING, headExtra: HEAD_EXTRAS,
  top: TOPS, outer: OUTERWEAR, bottom: BOTTOMS, dress: DRESSES, shoes: SHOES, socks: SOCKS, bag: BAGS, hat: HATS, glasses: GLASSES,
} as const satisfies Record<string, Variant<unknown>[]>;
export type Slot = keyof typeof SLOTS;
export type SlotParams<S extends Slot> = (typeof SLOTS)[S][number]['p'];

/** Colour keys a user can change. */
export const COLOR_KEYS = ['hair', 'hairTip', 'eyes', 'brows', 'beard', 'lips', 'shadow', 'blush', 'liner', 'top', 'outer', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'hat'] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export interface Look {
  v: 2;
  skin: string;
  pick: Partial<Record<Slot, number | null>>;
  color: Partial<Record<ColorKey, string | null>>;
  tune: { eyeSize: number; eyeGap: number; face: number }; // -1 … 1
  expression: Expression;
  pose: Pose;
}

/** Optional slots that can be removed with "Deselect". */
export const OPTIONAL: Slot[] = ['hair', 'beard', 'lashes', 'earL', 'earR', 'nosePierce', 'browPierce', 'lipPierce', 'tonguePierce', 'hearingL', 'hearingR', 'headExtra', 'top', 'outer', 'bottom', 'dress', 'socks', 'bag', 'hat', 'glasses', 'shoes'];

export const DEFAULT_LOOK: Look = {
  v: 2,
  skin: SKIN[34],
  pick: { head: 0, eyes: 0, lashes: 0, brows: 11, nose: 10, mouth: 0, ears: 10, body: 22, hair: 21, beard: null, top: 0, outer: null, bottom: 0, dress: null, shoes: 0, socks: null, bag: null, hat: null, glasses: null },
  color: { hair: HAIR[3], hairTip: null, eyes: EYES[3], brows: BROW_COLS[2], beard: HAIR[2], lips: LIPS[0], shadow: null, blush: null, liner: null },
  tune: { eyeSize: 0, eyeGap: 0, face: 0 },
  expression: 'happy',
  pose: 'standing',
};

export function variant<S extends Slot>(look: Look, slot: S): (typeof SLOTS)[S][number] | null {
  const id = look.pick[slot];
  if (id == null) return null;
  const list = SLOTS[slot] as readonly Variant<unknown>[];
  return (list[id] ?? null) as (typeof SLOTS)[S][number] | null;
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const EXPRESSIONS: Expression[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'laughing', 'crying', 'winking', 'blushing', 'sleeping', 'tongue'];
const POSES: Pose[] = ['standing', 'sitting', 'dancing', 'waving', 'walking', 'thumbsup', 'celebrating'];

/** Validate untrusted JSON (from the server) into a Look, migrating v1 configs. */
export function normalizeLook(raw: unknown): Look {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.v !== 2) return fromV1(raw as V1);
  const pick: Look['pick'] = {};
  const rp = (r.pick ?? {}) as Record<string, unknown>;
  for (const s of Object.keys(SLOTS) as Slot[]) {
    const v = rp[s];
    if (v === null && OPTIONAL.includes(s)) pick[s] = null;
    else if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < SLOTS[s].length) pick[s] = v;
    else pick[s] = DEFAULT_LOOK.pick[s] ?? (OPTIONAL.includes(s) ? null : 0);
  }
  const color: Look['color'] = {};
  const rc = (r.color ?? {}) as Record<string, unknown>;
  for (const k of COLOR_KEYS) color[k] = isHex(rc[k]) ? (rc[k] as string) : rc[k] === null ? null : (DEFAULT_LOOK.color[k] ?? null);
  const t = (r.tune ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
  return {
    v: 2,
    skin: isHex(r.skin) ? r.skin : DEFAULT_LOOK.skin,
    pick,
    color,
    tune: { eyeSize: num(t.eyeSize), eyeGap: num(t.eyeGap), face: num(t.face) },
    expression: EXPRESSIONS.includes(r.expression as Expression) ? (r.expression as Expression) : 'happy',
    pose: POSES.includes(r.pose as Pose) ? (r.pose as Pose) : 'standing',
  };
}

/** Best-effort conversion of the first-generation avatar format. */
function fromV1(c: Partial<V1> | null | undefined): Look {
  if (!c || typeof c !== 'object') return structuredClone(DEFAULT_LOOK);
  const fam = <T extends { family: string }>(list: readonly T[], name: string, i = 0) => {
    const idx = list.findIndex((v) => v.family.toLowerCase().startsWith(name.toLowerCase()));
    return idx < 0 ? 0 : idx + i;
  };
  const hairMap: Record<string, [string, number] | null> = {
    bald: null, buzz: ['Buzz', 2], short: ['Crew', 3], quiff: ['Quiff', 2], curly: ['Curly', 2], wavy: ['Long wavy', 0], long: ['Long straight', 2],
    bun: ['Tied', 2], ponytail: ['Tied', 0], afro: ['Afro', 2], braids: ['Braided', 0],
  };
  const beardMap: Record<string, [string, number] | null> = { none: null, stubble: ['Stubble', 3], moustache: ['Moustache', 0], goatee: ['Goatee', 2], short: ['Short beard', 6], full: ['Full beard', 6] };
  const topMap: Record<string, string> = { tshirt: 'Tee', shirt: 'Shirt', hoodie: 'Sweatshirt', jacket: 'Tee', kurta: 'Long sleeve', saree: 'Tee', blazer: 'Shirt' };
  const hm: [string, number] | null = c.hair ? hairMap[c.hair.style] : ['Crew', 3];
  const bm = c.facialHair ? beardMap[c.facialHair.style] : null;
  const o = c.outfit;
  const look = structuredClone(DEFAULT_LOOK);
  look.skin = isHex(c.skin) ? c.skin : look.skin;
  look.pick.head = fam(HEADS, c.face?.shape ?? 'oval', 2);
  look.pick.eyes = fam(EYE_SHAPES, c.eyes?.shape ?? 'almond', 2);
  look.pick.nose = fam(NOSES, c.nose?.shape ?? 'button', 2);
  look.pick.brows = fam(BROWS, { soft: 'Soft', straight: 'Straight', arched: 'High', bold: 'Flat' }[c.eyes?.brow ?? 'soft'] ?? 'Soft', 2);
  look.pick.mouth = fam(MOUTHS, { full: 'Full', thin: 'Thin', heart: 'Heart' }[c.mouth?.shape ?? 'full'] ?? 'Balanced', 2);
  look.pick.body = fam(BODIES, { slim: 'Slim', average: 'Average', athletic: 'Athletic', broad: 'Broad' }[c.body?.build ?? 'average'] ?? 'Average', 2);
  look.pick.hair = hm ? fam(HAIRSTYLES, hm[0], hm[1]) : null;
  look.pick.beard = bm ? fam(BEARDS, bm[0], bm[1]) : null;
  look.pick.lashes = c.eyes?.lashes ? 2 : null;
  if (o) {
    if (o.top === 'saree') {
      look.pick.dress = fam(DRESSES, 'Saree', 0);
      look.pick.top = null;
      look.pick.bottom = null;
    } else {
      look.pick.top = fam(TOPS, topMap[o.top] ?? 'Tee', 0);
      if (o.top === 'jacket' || o.top === 'blazer') look.pick.outer = fam(OUTERWEAR, o.top === 'jacket' ? 'Bomber' : 'Blazer', 0);
      look.pick.bottom = o.bottom === 'skirt' || o.bottom === 'dhoti' ? fam(BOTTOMS, 'Wide', 4) : fam(BOTTOMS, o.bottom === 'shorts' ? 'Shorts' : o.bottom === 'jeans' ? 'Straight' : 'Chinos', 0);
    }
    look.pick.shoes = fam(SHOES, { sneakers: 'Low', boots: 'Chelsea', sandals: 'Sandal', formal: 'Loafer' }[o.shoes] ?? 'Low', 0);
    look.color.top = isHex(o.topColor) ? o.topColor : null;
    look.color.outer = isHex(o.topColor) ? o.topColor : null;
    look.color.dress = isHex(o.topColor) ? o.topColor : null;
    look.color.bottom = isHex(o.bottomColor) ? o.bottomColor : null;
    look.color.shoes = isHex(o.shoeColor) ? o.shoeColor : null;
  }
  const a = c.accessories;
  if (a) {
    look.pick.glasses = a.glasses === 'none' ? null : fam(GLASSES, { round: 'Round', square: 'Square', sunglasses: 'Aviator' }[a.glasses] ?? 'Round', a.glasses === 'sunglasses' ? 1 : 0);
    look.pick.hat = a.hat === 'none' ? null : fam(HATS, a.hat === 'cap' ? 'Cap' : 'Beanie', 0);
    look.pick.earL = a.earrings ? 4 : null;
    look.pick.earR = a.earrings ? 4 : null;
    look.pick.bag = a.bag ? 0 : null;
  }
  if (c.hair && isHex(c.hair.color)) look.color.hair = c.hair.color;
  if (c.facialHair && isHex(c.facialHair.color)) look.color.beard = c.facialHair.color;
  if (c.eyes && isHex(c.eyes.color)) look.color.eyes = c.eyes.color;
  if (c.eyes && isHex(c.eyes.browColor)) look.color.brows = c.eyes.browColor;
  if (c.mouth && isHex(c.mouth.color)) look.color.lips = c.mouth.color;
  look.expression = EXPRESSIONS.includes(c.expression as Expression) ? (c.expression as Expression) : 'happy';
  look.pose = POSES.includes(c.pose as Pose) ? (c.pose as Pose) : 'standing';
  return look;
}

/** Random but tasteful look. */
export function randomLook(): Look {
  const R = (n: number) => Math.floor(Math.random() * n);
  const l = structuredClone(DEFAULT_LOOK);
  l.skin = SKIN[R(SKIN.length)];
  for (const s of ['head', 'eyes', 'brows', 'nose', 'mouth', 'ears', 'body', 'hair', 'top', 'bottom', 'shoes'] as Slot[]) l.pick[s] = R(SLOTS[s].length);
  l.pick.beard = Math.random() < 0.35 ? R(100) : null;
  l.pick.lashes = Math.random() < 0.6 ? R(100) : null;
  l.pick.outer = Math.random() < 0.4 ? R(100) : null;
  l.pick.glasses = Math.random() < 0.25 ? R(100) : null;
  l.color.hair = HAIR[R(19)];
  l.color.eyes = EYES[R(EYES.length)];
  l.color.brows = l.color.hair;
  l.color.beard = l.color.hair;
  l.color.lips = LIPS[R(10)];
  for (const k of ['top', 'outer', 'bottom', 'shoes'] as ColorKey[]) l.color[k] = null;
  void CLOTH;
  return l;
}
