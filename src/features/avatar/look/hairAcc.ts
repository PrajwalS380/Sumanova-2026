import type { HairP } from './hair';
import type { Variant } from './face';

/**
 * Hair accessories (sumanova-us-110): 10 kinds × 10 colourways = 100 items. Ids never shift
 * (id = kind index × 10 + colourway). Two can be worn at once (slots hairAcc1 / hairAcc2).
 * Every piece is original and procedural (render/HairAccessories.tsx + sculpt3d/hairAccGeo.ts).
 */
export type AccKind = 'claw' | 'snap' | 'barrette' | 'scrunchie' | 'headband' | 'bow' | 'flower' | 'gajra' | 'pins' | 'beads';
export const ACC_KINDS: AccKind[] = ['claw', 'snap', 'barrette', 'scrunchie', 'headband', 'bow', 'flower', 'gajra', 'pins', 'beads'];

/** Places on the hair an accessory can sit — produced by the groom (sculpt3d/groom.ts anchors). */
export type AnchorK = 'tie' | 'bunTop' | 'braidEnd' | 'partFront' | 'sideLeft' | 'sideRight' | 'crownBack' | 'overEarL' | 'overEarR' | 'headbandArc';
/** order = the anchor's index in the groom's anchor geometry (uv.x) — never reorder */
export const ANCHOR_KINDS: AnchorK[] = ['tie', 'bunTop', 'braidEnd', 'partFront', 'sideLeft', 'sideRight', 'crownBack', 'overEarL', 'overEarR', 'headbandArc'];

/** which anchors each kind accepts, in order of preference */
export const ACC_ANCHORS: Record<AccKind, AnchorK[]> = {
  claw: ['crownBack', 'tie'],
  snap: ['sideLeft', 'sideRight', 'partFront'],
  barrette: ['sideLeft', 'sideRight', 'crownBack'],
  scrunchie: ['tie', 'braidEnd'],
  headband: ['headbandArc'],
  bow: ['tie', 'crownBack', 'sideLeft', 'sideRight'],
  flower: ['overEarL', 'overEarR', 'bunTop', 'tie'],
  gajra: ['bunTop', 'tie', 'braidEnd'],
  pins: ['sideLeft', 'sideRight', 'bunTop'],
  beads: ['braidEnd'],
};

/** shown when the current hairstyle has none of the kind's anchors */
export const ACC_HINT: Record<AccKind, string> = {
  claw: 'Needs longer hair or a ponytail',
  snap: 'Needs hair at the sides',
  barrette: 'Needs hair at the sides',
  scrunchie: 'Needs a ponytail, bun or braid',
  headband: 'Needs hair on top',
  bow: 'Needs a ponytail or longer hair',
  flower: 'Needs hair over the ears or a bun',
  gajra: 'Needs a ponytail or bun',
  pins: 'Needs hair at the sides or a bun',
  beads: 'Needs braids',
};

export const ANCHOR_LABEL: Record<AnchorK, string> = {
  tie: 'Ponytail', bunTop: 'Bun', braidEnd: 'Braid ends', partFront: 'Front', sideLeft: 'Left', sideRight: 'Right',
  crownBack: 'Back', overEarL: 'Left ear', overEarR: 'Right ear', headbandArc: 'Top',
};

export type Finish = 'gloss' | 'matte' | 'metal' | 'pearl' | 'satin' | 'petal';
export interface AccP {
  kind: AccKind;
  /** main colour (the hairAcc1 / hairAcc2 colour key replaces it) */
  c1: string;
  /** second colour: pearls, centres, metal parts, cuffs */
  c2: string;
  /** a variant of the kind: plain / knotted headband, rose / hibiscus, gold / silver pins… */
  style: 0 | 1;
  finish: Finish;
}

const KIND_NAME: Record<AccKind, string> = {
  claw: 'Claw clip', snap: 'Snap clips', barrette: 'Pearl barrette', scrunchie: 'Scrunchie', headband: 'Headband',
  bow: 'Bow', flower: 'Flower', gajra: 'Gajra string', pins: 'Hair pins', beads: 'Braid beads',
};

/** 10 colourways per kind: [name, c1, c2, style, finish] */
const WAYS: Record<AccKind, [string, string, string, 0 | 1, Finish][]> = {
  claw: [['Tortoise', '#6b3a1e', '#c58a4a', 0, 'gloss'], ['Ink', '#141414', '#3a3a3a', 0, 'gloss'], ['Milk', '#f3eee4', '#d9cfbf', 0, 'matte'], ['Blush', '#f2b8c6', '#e48aa1', 0, 'matte'], ['Sage', '#9bb59a', '#6f8f6d', 0, 'matte'], ['Lilac', '#b9a3e3', '#8f74c9', 1, 'gloss'], ['Amber', '#e0a040', '#a86a1c', 1, 'gloss'], ['Ocean', '#3f7fbf', '#21507f', 1, 'gloss'], ['Cherry', '#c1272d', '#7a1218', 1, 'gloss'], ['Gold', '#d8b25a', '#a8822a', 1, 'metal']],
  snap: [['Gold', '#d9b45a', '#a8822a', 0, 'metal'], ['Silver', '#c9cdd3', '#8d939b', 0, 'metal'], ['Black', '#1c1c1c', '#555555', 0, 'gloss'], ['Pastel pink', '#f6b3c9', '#ffffff', 1, 'gloss'], ['Pastel blue', '#a9cdf2', '#ffffff', 1, 'gloss'], ['Mint', '#9fe0c6', '#ffffff', 1, 'gloss'], ['Lemon', '#f2e27a', '#ffffff', 1, 'gloss'], ['Coral', '#ff7f6a', '#ffffff', 1, 'gloss'], ['Rose gold', '#e3a68f', '#b97a64', 0, 'metal'], ['Rainbow', '#7b5cff', '#ff5c9a', 1, 'gloss']],
  barrette: [['Pearl gold', '#d9b45a', '#f4efe6', 0, 'metal'], ['Pearl silver', '#c9cdd3', '#f4efe6', 0, 'metal'], ['Blush pearl', '#e3a68f', '#f7dfe4', 0, 'metal'], ['Black pearl', '#1c1c1c', '#3d3d45', 0, 'gloss'], ['Ivory', '#f0e9dc', '#ffffff', 1, 'pearl'], ['Rose', '#d98a9c', '#fdf3f5', 1, 'pearl'], ['Blue pearl', '#2f4f8f', '#e8eef9', 1, 'gloss'], ['Green pearl', '#2f6f4f', '#eaf5ee', 1, 'gloss'], ['Wine', '#6d1a2e', '#f3e6ea', 1, 'gloss'], ['Bronze', '#a0703a', '#efe2cc', 0, 'metal']],
  scrunchie: [['Black satin', '#1d1d1f', '#2a2a2d', 0, 'satin'], ['Pink satin', '#f3a7bd', '#e98aa6', 0, 'satin'], ['Champagne', '#efd9b0', '#dcc08c', 0, 'satin'], ['Red velvet', '#9c1b2c', '#6f1220', 1, 'matte'], ['Navy', '#1f2f5c', '#141f3d', 1, 'matte'], ['Leopard', '#c98f4a', '#3a2412', 1, 'matte'], ['Lavender', '#c2b0ec', '#a28fd8', 0, 'satin'], ['Sage', '#a8c2a2', '#8aa884', 1, 'matte'], ['Mustard', '#d8a429', '#b5851c', 1, 'matte'], ['Ivory', '#f6f0e4', '#e4dccb', 0, 'satin']],
  headband: [['Black', '#1c1c1c', '#333333', 0, 'matte'], ['Tan', '#c49a6c', '#a07a50', 0, 'matte'], ['Red', '#c42a33', '#8f1c23', 0, 'satin'], ['Navy', '#22335f', '#18244a', 0, 'satin'], ['Cream', '#efe6d4', '#d9ceb8', 0, 'matte'], ['Knotted black', '#1c1c1c', '#333333', 1, 'satin'], ['Knotted pink', '#f0a3b8', '#d97f98', 1, 'satin'], ['Knotted green', '#3c7a52', '#2a5a3b', 1, 'satin'], ['Knotted gold', '#d9b45a', '#b48f3a', 1, 'metal'], ['Knotted plaid', '#8a2b2b', '#2b3f6f', 1, 'matte']],
  bow: [['Black velvet', '#151515', '#2a2a2a', 0, 'matte'], ['Red', '#d3202f', '#a3141f', 0, 'satin'], ['Pink', '#f39ab4', '#e07898', 0, 'satin'], ['White', '#f8f6f2', '#e6e2da', 0, 'satin'], ['Navy', '#203260', '#162447', 0, 'satin'], ['Sky', '#9cc9f0', '#79acd9', 1, 'satin'], ['Lilac', '#c6b0ee', '#a68fd9', 1, 'satin'], ['Gingham', '#e05a6a', '#ffffff', 1, 'matte'], ['Emerald', '#1f7a55', '#14573c', 1, 'satin'], ['Gold', '#d9b45a', '#b48f3a', 1, 'metal']],
  flower: [['Red rose', '#c8102e', '#3e7b3a', 0, 'petal'], ['Pink rose', '#f28cab', '#3e7b3a', 0, 'petal'], ['White rose', '#f7f3ea', '#3e7b3a', 0, 'petal'], ['Yellow rose', '#f6c945', '#3e7b3a', 0, 'petal'], ['Peach rose', '#f8b48a', '#3e7b3a', 0, 'petal'], ['Red hibiscus', '#e3263b', '#f6d24a', 1, 'petal'], ['Pink hibiscus', '#f06aa0', '#f6d24a', 1, 'petal'], ['Orange hibiscus', '#f47a2a', '#f6d24a', 1, 'petal'], ['White hibiscus', '#f8f4ec', '#e8456a', 1, 'petal'], ['Lilac hibiscus', '#b48ae0', '#f6d24a', 1, 'petal']],
  gajra: [['Jasmine', '#fbfaf3', '#f2e6b8', 0, 'petal'], ['Jasmine & rose', '#fbfaf3', '#d4243a', 1, 'petal'], ['Kanakambaram', '#f6a14a', '#f8d9a8', 0, 'petal'], ['Marigold', '#f5a316', '#e07b0c', 0, 'petal'], ['Rose buds', '#d4243a', '#f7c6cf', 0, 'petal'], ['Jasmine & marigold', '#fbfaf3', '#f5a316', 1, 'petal'], ['Pink buds', '#f39ab4', '#fde3ea', 0, 'petal'], ['Mogra double', '#fffdf6', '#efe2b5', 1, 'petal'], ['Crossandra', '#f27a3a', '#fbe0c6', 1, 'petal'], ['Lilac buds', '#c6b0ee', '#efe8fb', 0, 'petal']],
  pins: [['Gold', '#d9b45a', '#a8822a', 0, 'metal'], ['Silver', '#c9cdd3', '#8d939b', 0, 'metal'], ['Black', '#1c1c1c', '#444444', 0, 'gloss'], ['Rose gold', '#e3a68f', '#b97a64', 0, 'metal'], ['Gold pearl', '#d9b45a', '#f4efe6', 1, 'metal'], ['Silver pearl', '#c9cdd3', '#f4efe6', 1, 'metal'], ['Gold star', '#d9b45a', '#fff2b0', 1, 'metal'], ['Silver star', '#c9cdd3', '#eef4ff', 1, 'metal'], ['Bronze', '#a0703a', '#6d4a22', 0, 'metal'], ['Copper pearl', '#c2703f', '#f4efe6', 1, 'metal']],
  beads: [['Gold cuffs', '#d9b45a', '#a8822a', 1, 'metal'], ['Silver cuffs', '#c9cdd3', '#8d939b', 1, 'metal'], ['White beads', '#f6f2ea', '#d8d0c2', 0, 'gloss'], ['Rainbow beads', '#ff5c7a', '#4bb6ff', 0, 'gloss'], ['Wood beads', '#9a6a3c', '#6e4826', 0, 'matte'], ['Black beads', '#1c1c1c', '#3a3a3a', 0, 'gloss'], ['Pink beads', '#f39ab4', '#ffffff', 0, 'gloss'], ['Turquoise', '#2bb5b0', '#e7d7a8', 0, 'gloss'], ['Cowrie & gold', '#f2ead8', '#d9b45a', 1, 'pearl'], ['Copper cuffs', '#c2703f', '#8a4a22', 1, 'metal']],
};

export const HAIR_ACCESSORIES: Variant<AccP>[] = ACC_KINDS.flatMap((kind, ki) =>
  WAYS[kind].map(([name, c1, c2, style, finish], wi) => ({ id: ki * 10 + wi, name: `${KIND_NAME[kind]} · ${name}`, family: KIND_NAME[kind], p: { kind, c1, c2, style, finish } })),
);

const BUN_TIES = ['bun', 'lowbun', 'messybun', 'spacebuns', 'topknot', 'pineapple', 'halfspace'];

/**
 * Anchors a hairstyle offers (kept in step with the groom's anchor output — see
 * sculpt3d/groom.ts `anchorGeometry()` and look/hairAcc.test.ts).
 */
export function hairAnchors(p: HairP | null | undefined): Set<AnchorK> {
  if (!p) return new Set();
  const s = new Set<AnchorK>(['headbandArc']);
  if (p.fade === 'buzz') return s;
  const tied = p.tie !== 'none' && p.tie !== 'bantu' && p.braid !== 'cornrows';
  if (tied) s.add('tie');
  if (tied && BUN_TIES.includes(p.tie) && p.braid !== 'braidbun') s.add('bunTop');
  if (p.braid === 'braidbun') s.add('bunTop');
  if (['single', 'fishtail', 'double', 'sideplait', 'french', 'dutch', 'box', 'cornrows'].includes(p.braid) && !(p.braid === 'box' && p.goddess)) s.add('braidEnd');
  // scalp places: any style with hair at least on top of the head (not cornrows / flat twists)
  if (p.braid !== 'cornrows' && p.braid !== 'flattwist' && p.braid !== 'fulani' && p.tie !== 'bantu') {
    s.add('crownBack');
    if (p.afro === 0) {
      s.add('partFront');
      s.add('sideLeft');
      s.add('sideRight');
      s.add('overEarL');
      s.add('overEarR');
    }
  }
  return s;
}

/** the anchor an accessory uses on a style (the wanted one if it fits), or null = unsupported */
export function accAnchor(kind: AccKind, available: Set<AnchorK>, want?: AnchorK | null): AnchorK | null {
  const ok = ACC_ANCHORS[kind].filter((a) => available.has(a));
  if (want && ok.includes(want)) return want;
  return ok[0] ?? null;
}

/** anchors still drawn under a hat (outside the hat volume): low ties and braid ends */
export const ANCHORS_UNDER_HAT: AnchorK[] = ['tie', 'braidEnd'];
