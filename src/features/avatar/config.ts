/** Structured avatar definition. Stored as JSON in public.avatars.config. */
export interface AvatarConfig {
  v: 1;
  skin: string;
  undertone: 'warm' | 'neutral' | 'cool';
  face: { shape: 'oval' | 'round' | 'square' | 'heart' | 'long'; width: number; height: number; jaw: number; cheeks: number; chin: number; forehead: number };
  eyes: { shape: 'almond' | 'round' | 'hooded' | 'upturned'; size: number; color: string; brow: 'soft' | 'straight' | 'arched' | 'bold'; browColor: string; lashes: boolean };
  nose: { shape: 'button' | 'straight' | 'wide' | 'pointed'; size: number; width: number };
  mouth: { shape: 'full' | 'thin' | 'heart'; size: number; color: string; smile: 'grin' | 'soft' | 'neutral' | 'smirk' };
  hair: { style: HairStyle; color: string };
  facialHair: { style: 'none' | 'stubble' | 'moustache' | 'goatee' | 'short' | 'full'; color: string };
  body: { height: number; build: 'slim' | 'average' | 'athletic' | 'broad'; posture: 'relaxed' | 'proud' };
  outfit: Outfit;
  accessories: { glasses: 'none' | 'round' | 'square' | 'sunglasses'; hat: 'none' | 'cap' | 'beanie'; earrings: boolean; necklace: boolean; watch: boolean; bag: boolean; bindi: boolean };
  expression: Expression;
  pose: Pose;
}

export type HairStyle = 'bald' | 'buzz' | 'short' | 'quiff' | 'curly' | 'wavy' | 'long' | 'bun' | 'ponytail' | 'afro' | 'braids';
export type Expression = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'laughing' | 'crying' | 'winking' | 'blushing' | 'sleeping';
export type Pose = 'standing' | 'sitting' | 'dancing' | 'waving' | 'walking' | 'thumbsup' | 'celebrating';

export interface Outfit {
  top: 'tshirt' | 'shirt' | 'hoodie' | 'jacket' | 'kurta' | 'saree' | 'blazer';
  topColor: string;
  bottom: 'trousers' | 'jeans' | 'shorts' | 'skirt' | 'dhoti';
  bottomColor: string;
  shoes: 'sneakers' | 'boots' | 'sandals' | 'formal';
  shoeColor: string;
}

export const SKIN_TONES = ['#fde3cf', '#f6cfae', '#ecb98f', '#d9a074', '#c68555', '#a86b42', '#8a5532', '#6b3f24', '#4e2c19', '#3a2012'];
export const EYE_COLORS = ['#3b2414', '#5a3a22', '#7a5230', '#4c6b3c', '#3f6f8f', '#6b8fb5', '#7a7a7a', '#2a2a35'];
export const HAIR_COLORS = ['#141010', '#2f1d14', '#4e2f1f', '#7a4a2a', '#a8703f', '#d6a35c', '#e8cf9a', '#b5b5b5', '#f2f2f2', '#9b2c3a', '#5b3fa8', '#1f8a8a', '#e05fa2'];
export const LIP_COLORS = ['#b86b6b', '#c4776e', '#9f4f55', '#d2848a', '#8a4a4a', '#c95b7a', '#a33a4a'];
export const CLOTH_COLORS = ['#f5f5f7', '#16161f', '#7c3aed', '#14b8a6', '#fb7185', '#f59e0b', '#2563eb', '#16a34a', '#dc2626', '#9ca3af', '#7c4a2d', '#ec4899', '#1e3a8a', '#fde68a'];

export const LABELS = {
  face: { oval: 'Oval', round: 'Round', square: 'Square', heart: 'Heart', long: 'Long' },
  eyeShape: { almond: 'Almond', round: 'Round', hooded: 'Hooded', upturned: 'Upturned' },
  brow: { soft: 'Soft', straight: 'Straight', arched: 'Arched', bold: 'Bold' },
  nose: { button: 'Button', straight: 'Straight', wide: 'Wide', pointed: 'Pointed' },
  lips: { full: 'Full', thin: 'Thin', heart: 'Heart' },
  smile: { grin: 'Grin', soft: 'Soft', neutral: 'Neutral', smirk: 'Smirk' },
  hair: { bald: 'Bald', buzz: 'Buzz', short: 'Short', quiff: 'Quiff', curly: 'Curly', wavy: 'Wavy', long: 'Long', bun: 'Bun', ponytail: 'Ponytail', afro: 'Afro', braids: 'Braids' },
  facialHair: { none: 'None', stubble: 'Stubble', moustache: 'Moustache', goatee: 'Goatee', short: 'Short beard', full: 'Full beard' },
  build: { slim: 'Slim', average: 'Average', athletic: 'Athletic', broad: 'Broad' },
  posture: { relaxed: 'Relaxed', proud: 'Proud' },
  top: { tshirt: 'T-shirt', shirt: 'Shirt', hoodie: 'Hoodie', jacket: 'Jacket', kurta: 'Kurta', saree: 'Saree', blazer: 'Blazer' },
  bottom: { trousers: 'Trousers', jeans: 'Jeans', shorts: 'Shorts', skirt: 'Skirt', dhoti: 'Dhoti' },
  shoes: { sneakers: 'Sneakers', boots: 'Boots', sandals: 'Sandals', formal: 'Formal' },
  glasses: { none: 'None', round: 'Round', square: 'Square', sunglasses: 'Sunglasses' },
  hat: { none: 'None', cap: 'Cap', beanie: 'Beanie' },
  expression: { neutral: '😐 Neutral', happy: '😊 Happy', sad: '😢 Sad', angry: '😠 Angry', surprised: '😮 Surprised', laughing: '😂 Laughing', crying: '😭 Crying', winking: '😉 Winking', blushing: '☺️ Blushing', sleeping: '😴 Sleeping' },
  pose: { standing: 'Standing', sitting: 'Sitting', dancing: 'Dancing', waving: 'Waving', walking: 'Walking', thumbsup: 'Thumbs up', celebrating: 'Celebrating' },
} as const;

export const DEFAULT_AVATAR: AvatarConfig = {
  v: 1,
  skin: '#d9a074',
  undertone: 'warm',
  face: { shape: 'oval', width: 1, height: 1, jaw: 0.5, cheeks: 0.4, chin: 0.5, forehead: 0.5 },
  eyes: { shape: 'almond', size: 1, color: '#4e2f1f', brow: 'soft', browColor: '#2f1d14', lashes: true },
  nose: { shape: 'button', size: 1, width: 1 },
  mouth: { shape: 'full', size: 1, color: '#b86b6b', smile: 'soft' },
  hair: { style: 'short', color: '#2f1d14' },
  facialHair: { style: 'none', color: '#2f1d14' },
  body: { height: 1, build: 'average', posture: 'relaxed' },
  outfit: { top: 'hoodie', topColor: '#7c3aed', bottom: 'jeans', bottomColor: '#1e3a8a', shoes: 'sneakers', shoeColor: '#f5f5f7' },
  accessories: { glasses: 'none', hat: 'none', earrings: false, necklace: false, watch: false, bag: false, bindi: false },
  expression: 'happy',
  pose: 'standing',
};

export const OUTFIT_PRESETS: { name: string; outfit: Outfit }[] = [
  { name: 'Casual', outfit: { top: 'tshirt', topColor: '#14b8a6', bottom: 'jeans', bottomColor: '#1e3a8a', shoes: 'sneakers', shoeColor: '#f5f5f7' } },
  { name: 'Formal', outfit: { top: 'blazer', topColor: '#16161f', bottom: 'trousers', bottomColor: '#16161f', shoes: 'formal', shoeColor: '#16161f' } },
  { name: 'Festive', outfit: { top: 'kurta', topColor: '#f59e0b', bottom: 'dhoti', bottomColor: '#fde68a', shoes: 'sandals', shoeColor: '#7c4a2d' } },
  { name: 'Saree', outfit: { top: 'saree', topColor: '#ec4899', bottom: 'skirt', bottomColor: '#ec4899', shoes: 'sandals', shoeColor: '#f59e0b' } },
  { name: 'Street', outfit: { top: 'hoodie', topColor: '#16161f', bottom: 'shorts', bottomColor: '#9ca3af', shoes: 'sneakers', shoeColor: '#dc2626' } },
  { name: 'Weekend', outfit: { top: 'jacket', topColor: '#7c4a2d', bottom: 'jeans', bottomColor: '#2563eb', shoes: 'boots', shoeColor: '#7c4a2d' } },
];

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
const range = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) * 100) / 100;
const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T)[];

export function randomAvatar(): AvatarConfig {
  const hair = pick(keys(LABELS.hair));
  return {
    v: 1,
    skin: pick(SKIN_TONES),
    undertone: pick(['warm', 'neutral', 'cool'] as const),
    face: { shape: pick(keys(LABELS.face)), width: range(0.9, 1.1), height: range(0.92, 1.08), jaw: range(0.2, 0.8), cheeks: range(0.2, 0.7), chin: range(0.3, 0.7), forehead: range(0.3, 0.7) },
    eyes: { shape: pick(keys(LABELS.eyeShape)), size: range(0.9, 1.15), color: pick(EYE_COLORS), brow: pick(keys(LABELS.brow)), browColor: pick(HAIR_COLORS.slice(0, 6)), lashes: Math.random() > 0.4 },
    nose: { shape: pick(keys(LABELS.nose)), size: range(0.85, 1.15), width: range(0.85, 1.15) },
    mouth: { shape: pick(keys(LABELS.lips)), size: range(0.9, 1.1), color: pick(LIP_COLORS), smile: pick(keys(LABELS.smile)) },
    hair: { style: hair, color: pick(HAIR_COLORS) },
    facialHair: { style: Math.random() > 0.6 ? pick(keys(LABELS.facialHair)) : 'none', color: pick(HAIR_COLORS.slice(0, 7)) },
    body: { height: range(0.94, 1.06), build: pick(keys(LABELS.build)), posture: pick(['relaxed', 'proud'] as const) },
    outfit: { top: pick(keys(LABELS.top)), topColor: pick(CLOTH_COLORS), bottom: pick(keys(LABELS.bottom)), bottomColor: pick(CLOTH_COLORS), shoes: pick(keys(LABELS.shoes)), shoeColor: pick(CLOTH_COLORS) },
    accessories: { glasses: Math.random() > 0.65 ? pick(['round', 'square', 'sunglasses'] as const) : 'none', hat: Math.random() > 0.8 ? pick(['cap', 'beanie'] as const) : 'none', earrings: Math.random() > 0.6, necklace: Math.random() > 0.75, watch: Math.random() > 0.5, bag: Math.random() > 0.8, bindi: Math.random() > 0.85 },
    expression: pick(['happy', 'neutral', 'winking', 'laughing'] as const),
    pose: 'standing',
  };
}

/** Accept only well-formed configs (data from the server is untrusted). */
export function normalizeAvatar(raw: unknown): AvatarConfig {
  const r = (raw ?? {}) as Partial<AvatarConfig>;
  const d = DEFAULT_AVATAR;
  const hex = (v: unknown, fb: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fb);
  const num = (v: unknown, fb: number, lo = 0, hi = 2) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);
  const oneOf = <T extends string>(v: unknown, opts: readonly T[], fb: T) => (opts.includes(v as T) ? (v as T) : fb);
  return {
    v: 1,
    skin: hex(r.skin, d.skin),
    undertone: oneOf(r.undertone, ['warm', 'neutral', 'cool'], d.undertone),
    face: { shape: oneOf(r.face?.shape, keys(LABELS.face), d.face.shape), width: num(r.face?.width, 1, 0.8, 1.2), height: num(r.face?.height, 1, 0.85, 1.15), jaw: num(r.face?.jaw, 0.5, 0, 1), cheeks: num(r.face?.cheeks, 0.4, 0, 1), chin: num(r.face?.chin, 0.5, 0, 1), forehead: num(r.face?.forehead, 0.5, 0, 1) },
    eyes: { shape: oneOf(r.eyes?.shape, keys(LABELS.eyeShape), d.eyes.shape), size: num(r.eyes?.size, 1, 0.75, 1.3), color: hex(r.eyes?.color, d.eyes.color), brow: oneOf(r.eyes?.brow, keys(LABELS.brow), d.eyes.brow), browColor: hex(r.eyes?.browColor, d.eyes.browColor), lashes: r.eyes?.lashes ?? true },
    nose: { shape: oneOf(r.nose?.shape, keys(LABELS.nose), d.nose.shape), size: num(r.nose?.size, 1, 0.7, 1.3), width: num(r.nose?.width, 1, 0.7, 1.3) },
    mouth: { shape: oneOf(r.mouth?.shape, keys(LABELS.lips), d.mouth.shape), size: num(r.mouth?.size, 1, 0.75, 1.3), color: hex(r.mouth?.color, d.mouth.color), smile: oneOf(r.mouth?.smile, keys(LABELS.smile), d.mouth.smile) },
    hair: { style: oneOf(r.hair?.style, keys(LABELS.hair), d.hair.style), color: hex(r.hair?.color, d.hair.color) },
    facialHair: { style: oneOf(r.facialHair?.style, keys(LABELS.facialHair), 'none'), color: hex(r.facialHair?.color, d.facialHair.color) },
    body: { height: num(r.body?.height, 1, 0.9, 1.1), build: oneOf(r.body?.build, keys(LABELS.build), d.body.build), posture: oneOf(r.body?.posture, ['relaxed', 'proud'], 'relaxed') },
    outfit: { top: oneOf(r.outfit?.top, keys(LABELS.top), d.outfit.top), topColor: hex(r.outfit?.topColor, d.outfit.topColor), bottom: oneOf(r.outfit?.bottom, keys(LABELS.bottom), d.outfit.bottom), bottomColor: hex(r.outfit?.bottomColor, d.outfit.bottomColor), shoes: oneOf(r.outfit?.shoes, keys(LABELS.shoes), d.outfit.shoes), shoeColor: hex(r.outfit?.shoeColor, d.outfit.shoeColor) },
    accessories: { glasses: oneOf(r.accessories?.glasses, keys(LABELS.glasses), 'none'), hat: oneOf(r.accessories?.hat, keys(LABELS.hat), 'none'), earrings: !!r.accessories?.earrings, necklace: !!r.accessories?.necklace, watch: !!r.accessories?.watch, bag: !!r.accessories?.bag, bindi: !!r.accessories?.bindi },
    expression: oneOf(r.expression, keys(LABELS.expression), 'happy'),
    pose: oneOf(r.pose, keys(LABELS.pose), 'standing'),
  };
}

/** Undertone tints the base skin slightly toward gold, neutral or rose. */
export function skinWithUndertone(skin: string, undertone: AvatarConfig['undertone']): string {
  const n = parseInt(skin.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (undertone === 'warm') { r = Math.min(255, r + 6); g = Math.min(255, g + 2); b = Math.max(0, b - 6); }
  if (undertone === 'cool') { r = Math.min(255, r + 2); b = Math.min(255, b + 8); g = Math.max(0, g - 2); }
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.min(255, Math.max(0, Math.round(c + amt * 255)));
  return `#${((1 << 24) + (f((n >> 16) & 255) << 16) + (f((n >> 8) & 255) << 8) + f(n & 255)).toString(16).slice(1)}`;
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
