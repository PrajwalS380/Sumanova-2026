import type * as THREE from 'three';
import type { BodyP } from '../look/face';
import { B, armBlend, bodyPrims, type Joints, type Region } from './anatomy';
import { Field, loft, type Part, type Prim, type V3 } from './sdf';
import { GeoCache, meshField } from './mesh';
import { jointsFor } from './rig';

/**
 * Sculpted clothing. A garment is the body's own anatomy puffed out by the garment's ease,
 * cut at hems / cuffs / necklines and hollowed into a shell, so it always follows the body
 * (no clipping) and has real fabric thickness at its edges. Trims (collars, cuffs, waistbands,
 * pockets, plackets, soles) are small sculpted pieces with their own colour.
 */

export type Tone = 'c1' | 'c2' | 'c3' | 'dark' | 'light' | 'metal' | 'skin';
export interface Trim { geo: THREE.BufferGeometry; tone: Tone }
export interface GarmentGeo { main: THREE.BufferGeometry | null; trims: Trim[] }

const CELL = 0.0105;
const TRIM_CELL = 0.0055;
const T = 0.3; // pattern tile size (world units)

// ---------------------------------------------------------------------------- helpers

/** Fabric UVs: wrap around the torso / each limb, tiles of T world units. */
function clothUV(J: Joints) {
  return (x: number, y: number, z: number, tag: number): [number, number] => {
    let cx = 0, R = 0.17;
    if (tag === 3 || tag === 5) { cx = -J.sx; R = 0.06; }
    else if (tag === 4 || tag === 6) { cx = J.sx; R = 0.06; }
    else if (tag === 7 || tag === 9 || tag === 11) { cx = -J.hx; R = 0.1; }
    else if (tag === 8 || tag === 10 || tag === 12) { cx = J.hx; R = 0.1; }
    const ang = Math.atan2(x - cx, z);
    return [(ang * R) / T + 0.5, y / T];
  };
}

const plane = (o: V3, n: V3, k = 0.008) => {
  const l = Math.hypot(...n);
  return { o, n: [n[0] / l, n[1] / l, n[2] / l] as V3, k };
};

/** Where the body's front surface is (x = 0) at height y, plus an offset. */
const frontCache = new Map<string, number>();
function frontZ(J: Joints, y: number, off: number) {
  const key = `${J.bp.width}|${J.bp.belly}|${J.bp.shoulders}|${y.toFixed(3)}`;
  let z0 = frontCache.get(key);
  if (z0 === undefined) {
    const f = new Field([{ prims: bodyPrims(J, 0, ['torso', 'pelvis']) }], 0.01);
    let lo = 0, hi = 0.4;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (f.eval(0, y, m) < 0) lo = m;
      else hi = m;
    }
    z0 = lo;
    frontCache.set(key, z0);
  }
  return z0 + off;
}

function meshMain(J: Joints, parts: Part[], skinTau = 0.025) {
  const f = new Field(parts, 0.03);
  // lofted skirts / coats and fold displacement change faster than a true distance: cull conservatively
  return meshField(f, { cell: CELL, skin: skinTau, uv: clothUV(J), lipschitz: 1.8 });
}
function meshTrim(prims: Prim[], cell = TRIM_CELL, extra?: Partial<Part>) {
  const f = new Field([{ prims, ...extra }], 0.012, 0.05);
  return meshField(f, { cell, skin: 0.02, pad: cell * 2 });
}

/** A ring band (cuff / waistband / hem rib) around a vertical axis at height y. */
function band(c: V3, R: number, depth: number, h: number, tube: number, bone: number): Prim[] {
  // a squashed torus so the band hugs an oval cross-section
  return [{ t: 'fn', c, ext: [R + tube + 0.01, h / 2 + tube, depth + tube + 0.01], bone, k: 0, f: (x, y, z) => {
    const ex = (x - c[0]) / R, ez = (z - c[2]) / depth;
    const rr = Math.sqrt(ex * ex + ez * ez);
    const radial = (rr - 1) * Math.min(R, depth);
    const vy = Math.max(Math.abs(y - c[1]) - h / 2, 0);
    return Math.sqrt(radial * radial + vy * vy) - tube;
  } }];
}

// ---------------------------------------------------------------------------- tops & jackets

type Sleeve = 'none' | 'cap' | 'short' | 'elbow' | 'long';
type Neck = 'crew' | 'v' | 'scoop' | 'polo' | 'shirt' | 'camp' | 'hood' | 'high' | 'lapel' | 'denim' | 'rib';
interface TopSpec {
  ease: number;
  hem: number;
  sleeve: Sleeve;
  sleeveEase?: number;
  neck: Neck;
  /** half-width of an open front (jackets), 0 = closed */
  open?: number;
  boxy?: boolean;
  quilt?: boolean;
  fur?: boolean;
  rib?: Tone | null; // rib hem + cuffs colour
  hood?: boolean;
  pocket?: 'kangaroo' | 'chest2' | 'chest1' | null;
  placket?: 'buttons' | 'zip' | 'snaps' | null;
  belt?: boolean;
}

const TOPS: Record<string, TopSpec> = {
  Tee: { ease: 0.012, hem: 0.98, sleeve: 'short', neck: 'crew' },
  'V-neck': { ease: 0.012, hem: 0.98, sleeve: 'short', neck: 'v' },
  'Boxy tee': { ease: 0.024, hem: 0.95, sleeve: 'elbow', sleeveEase: 0.022, neck: 'crew', boxy: true },
  'Long sleeve': { ease: 0.012, hem: 0.97, sleeve: 'long', neck: 'crew' },
  Polo: { ease: 0.014, hem: 0.97, sleeve: 'short', neck: 'polo', placket: 'buttons' },
  Shirt: { ease: 0.018, hem: 0.95, sleeve: 'long', neck: 'shirt', placket: 'buttons', pocket: 'chest1' },
  'Lounge shirt': { ease: 0.022, hem: 0.96, sleeve: 'short', sleeveEase: 0.02, neck: 'camp', placket: 'buttons', pocket: 'chest1' },
  Sweatshirt: { ease: 0.026, hem: 0.96, sleeve: 'long', sleeveEase: 0.02, neck: 'rib', boxy: true, rib: 'dark' },
  Tank: { ease: 0.01, hem: 0.98, sleeve: 'none', neck: 'scoop' },
  'Crop top': { ease: 0.011, hem: 1.24, sleeve: 'short', neck: 'crew' },
  // jackets (worn over a top: ease is bumped above the top's)
  Puffer: { ease: 0.05, hem: 0.92, sleeve: 'long', sleeveEase: 0.034, neck: 'high', quilt: true, placket: 'zip' },
  Bomber: { ease: 0.038, hem: 0.98, sleeve: 'long', sleeveEase: 0.026, neck: 'rib', rib: 'dark', placket: 'zip' },
  'Denim jacket': { ease: 0.032, hem: 0.99, sleeve: 'long', sleeveEase: 0.02, neck: 'denim', open: 0.03, pocket: 'chest2', placket: 'buttons' },
  Biker: { ease: 0.03, hem: 1.0, sleeve: 'long', sleeveEase: 0.018, neck: 'lapel', open: 0.022, placket: 'zip' },
  'Shaggy coat': { ease: 0.058, hem: 0.66, sleeve: 'long', sleeveEase: 0.036, neck: 'lapel', open: 0.05, fur: true },
  'Zip hoodie': { ease: 0.036, hem: 0.95, sleeve: 'long', sleeveEase: 0.024, neck: 'crew', open: 0.018, hood: true, rib: 'c1', placket: 'zip' },
  Hoodie: { ease: 0.04, hem: 0.93, sleeve: 'long', sleeveEase: 0.026, neck: 'crew', boxy: true, hood: true, rib: 'c1', pocket: 'kangaroo' },
  Trench: { ease: 0.042, hem: 0.46, sleeve: 'long', sleeveEase: 0.024, neck: 'lapel', open: 0.04, belt: true, placket: 'buttons' },
  Blazer: { ease: 0.034, hem: 0.88, sleeve: 'long', sleeveEase: 0.02, neck: 'lapel', open: 0.045, placket: 'buttons', pocket: 'chest1' },
  Varsity: { ease: 0.04, hem: 0.97, sleeve: 'long', sleeveEase: 0.026, neck: 'rib', rib: 'c3', placket: 'snaps' },
};
export const topSpec = (cut: string) => TOPS[cut] ?? TOPS.Tee;

const SLEEVE_END: Record<Sleeve, number> = { none: 0, cap: 1.56, short: 1.43, elbow: 1.3, long: 1.11 };

const topCache = new GeoCache<GarmentGeo>(40);
const bodyKey = (bp: BodyP) => `${bp.width.toFixed(3)}|${bp.belly.toFixed(3)}|${bp.shoulders.toFixed(3)}|${bp.hips.toFixed(3)}`;

/**
 * A top or jacket. `layer` 1 = worn over `under` (a top), so its ease is bumped above it.
 */
export function topGeometry(bp: BodyP, cut: string, layer: 0 | 1, under?: string): GarmentGeo {
  return topCache.get(`${bodyKey(bp)}|${cut}|${layer}|${under ?? ''}`, () => buildTop(jointsFor(bp), cut, layer, under));
}

function buildTop(J: Joints, cut: string, layer: 0 | 1, under?: string): GarmentGeo {
  const sp = topSpec(cut);
  const below = layer && under ? topSpec(under) : null;
  const ease = layer ? Math.max(sp.ease, (below?.ease ?? 0.012) + 0.016) : sp.ease;
  const sEase = layer ? Math.max(sp.sleeveEase ?? ease * 0.7, (below?.sleeveEase ?? 0.012) + 0.012) : sp.sleeveEase ?? Math.min(ease, 0.016);
  const parts: Part[] = [];
  const trims: Trim[] = [];

  // --- body of the garment
  const trunk = bodyPrims(J, ease, ['torso', 'pelvis']).filter((p) => (sp.sleeve === 'none' ? p.bone !== B.upperArmL && p.bone !== B.upperArmR : true));
  if (sp.boxy || below?.boxy) {
    // roomy: a straight-hanging block over the ribs instead of following the waist
    const W = J.bp.width;
    trunk.push({ t: 'ellipsoid', c: [0, 1.25, 0.005], r: [(0.2 + ease) * W, 0.33, 0.135 + ease + J.bp.belly * 0.05], bone: B.chest, k: 0.08, tag: 1 });
  }
  // the hem drapes over whatever trousers are worn (the widest hips + thighs), never under them
  if (sp.hem < 1.06) trunk.push(...bodyPrims(J, Math.max(ease, 0.042) + (layer ? 0.016 : 0), ['thigh']).map((p) => ({ ...p, k: 0.06 })));
  const clips = [plane([0, sp.hem, 0], [0, -1, 0], 0.01)];
  // neckline
  const neckY = sp.neck === 'high' ? 1.79 : sp.neck === 'scoop' ? 1.63 : sp.neck === 'v' ? 1.69 : 1.705;
  if (sp.neck !== 'high') clips.push(plane([0, neckY, 0.02], [0, 1, sp.neck === 'scoop' ? 0.9 : 0.5], 0.01));
  const quilt = sp.quilt ? (_x: number, y: number) => -0.011 * Math.pow(Math.abs(Math.sin((Math.PI * (y - sp.hem)) / 0.09)), 0.6) : null;
  const fur = sp.fur ? (x: number, y: number, z: number) => -0.006 * (Math.sin(x * 150 + y * 40) * Math.sin(z * 140 - y * 30) + Math.sin(y * 210 + x * 60) * 0.5) : null;
  const drape = (_x: number, y: number) => -0.0025 * Math.sin(y * 70) * Math.max(0, Math.min(1, (1.25 - y) / 0.2));
  parts.push({ prims: trunk, clips, disp: quilt ?? fur ?? drape });

  // long coats: a skirt below the hips
  if (sp.hem < 0.85) {
    const W = J.bp.width, hp = J.bp.hips;
    const f = loft(sp.hem, 1.0, [[sp.hem, 0.23 * hp * W + ease + (0.85 - sp.hem) * 0.12], [0.85, 0.2 * hp * W + ease], [1.0, 0.17 * hp * W + ease]], [[sp.hem, 0.16 + ease], [1.0, 0.115 + ease]], [[sp.hem, -0.01], [1.0, -0.012]]);
    parts.push({ prims: [{ t: 'fn', f, c: [0, (sp.hem + 1) / 2, 0], ext: [0.36, (1 - sp.hem) / 2 + 0.01, 0.25], bone: B.pelvis, k: 0, tag: 1 }], k: 0.05, disp: fur ?? ((x, y, z) => -0.004 * Math.sin(Math.atan2(x, z) * 9) * Math.max(0, (0.9 - y) * 3)) });
  }

  // --- sleeves
  if (sp.sleeve !== 'none') {
    const end = SLEEVE_END[sp.sleeve];
    for (const side of [-1, 1] as const) {
      const regions: Region[] = sp.sleeve === 'long' || sp.sleeve === 'elbow' ? ['upperArm', 'foreArm'] : ['upperArm'];
      const bones = side < 0 ? [B.upperArmL, B.foreArmL] : [B.upperArmR, B.foreArmR];
      const prims = bodyPrims(J, sEase, regions).filter((p) => bones.includes(p.bone as never));
      // looser sleeves open up toward the cuff on boxy cuts
      const elbowFold = (_x: number, y: number) => -0.003 * Math.sin(y * 95) * Math.exp(-(((y - 1.33) / 0.05) ** 2));
      parts.push({ prims, clips: [plane([0, end, 0], [0, -1, 0], 0.008)], kAt: (_x, y) => armBlend(y), disp: quilt ?? fur ?? elbowFold });
      if (sp.rib && sp.sleeve === 'long') trims.push({ geo: meshTrim(band([side * (J.sx + 0.008), end + 0.02, -0.006], J.r.wrist + sEase + 0.006, J.r.wrist + sEase + 0.006, 0.035, 0.006, bones[1])), tone: sp.rib });
    }
  }

  // --- open fronts and necklines (the garment is solid: its inside lies within the body,
  //     where the skin hides it — a hollow shell thinner than a grid cell can't be meshed)
  if (sp.open) {
    parts.push({ prims: [{ t: 'box', c: [0, (sp.hem + 1.8) / 2, 0.3], s: [sp.open, (1.8 - sp.hem) / 2 + 0.02, 0.2], round: 0.004, bone: B.chest }], subtract: true, k: 0.006 });
  }
  if (sp.neck === 'v') parts.push({ prims: [{ t: 'box', c: [0, 1.7, 0.16], s: [0.05, 0.09, 0.08], round: 0.002, rot: [0, 0, Math.PI / 4], bone: B.chest }], subtract: true, k: 0.006 });

  const main = meshMain(J, parts);

  // --- trims
  const fz = (y: number, o = 0) => frontZ(J, y, ease + o);
  if (sp.neck === 'crew' || sp.neck === 'rib') trims.push({ geo: meshTrim([{ t: 'torus', c: [0, 1.7, 0.012], R: J.r.neck + 0.022 + ease * 0.5, r: sp.neck === 'rib' ? 0.012 : 0.0075, rot: [0.42, 0, 0], bone: B.chest }]), tone: sp.neck === 'rib' && sp.rib ? sp.rib : 'dark' });
  if (sp.neck === 'v') {
    for (const s of [-1, 1]) trims.push({ geo: meshTrim([{ t: 'cone', a: [s * 0.07, 1.705, fz(1.66, -0.004)], b: [0, 1.615, fz(1.6, 0.002)], ra: 0.006, rb: 0.006, bone: B.chest }]), tone: 'dark' });
  }
  if (sp.neck === 'polo' || sp.neck === 'shirt' || sp.neck === 'camp' || sp.neck === 'denim') {
    const tone: Tone = sp.neck === 'polo' ? 'c2' : sp.neck === 'denim' ? 'dark' : 'light';
    const spread = sp.neck === 'camp' ? 0.55 : 0.35;
    const prims: Prim[] = [{ t: 'torus', c: [0, 1.725, 0.0], R: J.r.neck + 0.018, r: 0.011, rot: [0.3, 0, 0], bone: B.neck }];
    // collar points lie on the chest, angled from the neck toward the front
    for (const s of [-1, 1]) prims.push({ t: 'ellipsoid', c: [s * 0.05, 1.672, fz(1.672, 0.006)], r: [0.022, 0.05, 0.0055], rot: [-0.55, s * 0.25, s * (0.55 + spread * 0.5)], bone: B.chest, k: 0.006 });
    trims.push({ geo: meshTrim(prims, TRIM_CELL, { k: 0 }), tone });
  }
  if (sp.neck === 'high') trims.push({ geo: meshTrim(band([0, 1.775, -0.008], J.r.neck + 0.03, J.r.neck + 0.03, 0.08, 0.012, B.neck)), tone: 'c1' });
  if (sp.neck === 'lapel') {
    for (const s of [-1, 1]) trims.push({ geo: meshTrim([{ t: 'box', c: [s * (sp.open! + 0.04), 1.5, fz(1.5, 0.006)], s: [0.04, 0.14, 0.005], round: 0.004, rot: [-0.08, s * -0.3, s * 0.38], bone: B.chest }]), tone: 'dark' });
  }
  if (sp.hood) {
    trims.push({ geo: meshTrim([{ t: 'ellipsoid', c: [0, 1.73, -0.1], r: [0.13, 0.1, 0.085], bone: B.chest, k: 0.02 }, { t: 'torus', c: [0, 1.715, 0.0], R: J.r.neck + 0.03, r: 0.022, rot: [0.5, 0, 0], bone: B.chest, k: 0.03 }], 0.007), tone: 'c1' });
    if (!sp.open) for (const s of [-1, 1]) trims.push({ geo: meshTrim([{ t: 'cone', a: [s * 0.03, 1.66, fz(1.64, 0.006)], b: [s * 0.032, 1.53, fz(1.53, 0.008)], ra: 0.004, rb: 0.0035, bone: B.chest }]), tone: 'light' });
  }
  if (sp.rib) trims.push({ geo: meshTrim(band([0, sp.hem + 0.025, -0.008], 0.17 * J.bp.hips * J.bp.width + ease + 0.005, 0.12 + ease + 0.005, 0.04, 0.007, B.pelvis)), tone: sp.rib });
  if (sp.placket && !(sp.open && sp.placket === 'buttons' && cut !== 'Denim jacket')) {
    const top = sp.neck === 'polo' ? 1.67 : 1.68, bot = sp.neck === 'polo' ? 1.52 : sp.hem + 0.03;
    const pts: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      const y = top + ((bot - top) * i) / 6;
      pts.push([sp.open ? -sp.open - 0.012 : 0, y, fz(Math.max(y, 1.0), 0.004)]);
    }
    const prims: Prim[] = [];
    for (let i = 0; i < 6; i++) prims.push({ t: 'cone', a: pts[i], b: pts[i + 1], ra: sp.placket === 'zip' ? 0.005 : 0.0045, rb: sp.placket === 'zip' ? 0.005 : 0.0045, bone: pts[i][1] > 1.2 ? B.chest : B.pelvis, k: 0.004 });
    trims.push({ geo: meshTrim(prims), tone: sp.placket === 'zip' ? 'metal' : 'dark' });
    if (sp.placket !== 'zip') {
      const n = sp.neck === 'polo' ? 2 : 5;
      const btn: Prim[] = [];
      for (let i = 0; i < n; i++) {
        const y = top - 0.03 - (i * (top - bot - 0.06)) / Math.max(1, n - 1);
        btn.push({ t: 'ellipsoid', c: [sp.open ? -sp.open - 0.012 : 0, y, fz(Math.max(y, 1.0), 0.009)], r: [0.008, 0.008, 0.004], bone: y > 1.2 ? B.chest : B.pelvis });
      }
      trims.push({ geo: meshTrim(btn, 0.003), tone: sp.placket === 'snaps' ? 'metal' : 'light' });
    }
  }
  if (sp.pocket === 'kangaroo') trims.push({ geo: meshTrim([{ t: 'box', c: [0, 1.08, fz(1.08, 0.004)], s: [0.11, 0.055, 0.008], round: 0.007, bone: B.pelvis }]), tone: 'dark' });
  if (sp.pocket === 'chest1' || sp.pocket === 'chest2') {
    for (const s of sp.pocket === 'chest2' ? [-1, 1] : [-1]) trims.push({ geo: meshTrim([{ t: 'box', c: [s * 0.085, 1.48, fz(1.48, 0.0) - 0.012], s: [0.036, 0.04, 0.006], round: 0.005, rot: [-0.05, s * 0.3, 0], bone: B.chest }]), tone: 'dark' });
  }
  if (sp.belt) trims.push({ geo: meshTrim(band([0, 1.16, 0.0], 0.16 * J.bp.width + ease + 0.006, 0.105 + ease + 0.006, 0.035, 0.006, B.pelvis)), tone: 'dark' });
  return { main, trims };
}

// ---------------------------------------------------------------------------- bottoms

interface BottomSpec { thigh: number; shin: number; flare?: number; end: number; cuff?: boolean; cargo?: boolean; denim?: boolean; bunch?: number }
const BOTTOMS: Record<string, BottomSpec> = {
  'Straight jeans': { thigh: 0.014, shin: 0.02, end: 0.105, denim: true, bunch: 0.4 },
  'Flared jeans': { thigh: 0.012, shin: 0.012, flare: 0.05, end: 0.09, denim: true },
  'Baggy jeans': { thigh: 0.034, shin: 0.045, end: 0.08, denim: true, bunch: 1 },
  'Skinny jeans': { thigh: 0.007, shin: 0.006, end: 0.11, denim: true },
  Cargo: { thigh: 0.026, shin: 0.03, end: 0.1, cargo: true, bunch: 0.7 },
  Joggers: { thigh: 0.022, shin: 0.02, end: 0.13, cuff: true, bunch: 0.8 },
  Chinos: { thigh: 0.014, shin: 0.016, end: 0.11 },
  Shorts: { thigh: 0.02, shin: 0, end: 0.69 },
  'Lounge pants': { thigh: 0.026, shin: 0.03, end: 0.095, bunch: 0.6 },
  'Wide trousers': { thigh: 0.03, shin: 0.05, flare: 0.02, end: 0.07 },
};
export const bottomSpec = (cut: string) => BOTTOMS[cut] ?? BOTTOMS.Chinos;

const bottomCache = new GeoCache<GarmentGeo>(30);
export function bottomGeometry(bp: BodyP, cut: string): GarmentGeo {
  return bottomCache.get(`${bodyKey(bp)}|${cut}`, () => buildBottom(jointsFor(bp), cut));
}

function buildBottom(J: Joints, cut: string): GarmentGeo {
  const sp = bottomSpec(cut);
  const trims: Trim[] = [];
  const waist = 1.13;
  const parts: Part[] = [];
  // waist + seat: fitted (a top worn over it must stay outside)
  const hips = bodyPrims(J, 0.006, ['pelvis']);
  const W = J.bp.width, hp = J.bp.hips;
  const f = loft(0.9, waist + 0.01, [[0.9, 0.152 * hp * W + 0.008], [1.02, 0.172 * hp * W + 0.008], [waist + 0.01, 0.158 * W + J.bp.belly * 0.02 + 0.006]], [[0.9, 0.102], [1.02, 0.116], [waist + 0.01, 0.106 + J.bp.belly * 0.05]], [[0.9, -0.012], [1.02, -0.012], [waist, 0.002 + J.bp.belly * 0.02]]);
  hips.push({ t: 'fn', f, c: [0, 1.02, 0], ext: [0.26, 0.13, 0.2], bone: B.pelvis, k: 0.04, tag: 13 });
  parts.push({ prims: hips, clips: [plane([0, waist, 0.02], [0, 1, 0.12], 0.006)] });
  // legs
  for (const side of [-1, 1] as const) {
    const s = side < 0 ? 0 : 1;
    const th = s ? B.thighR : B.thighL;
    const legs = bodyPrims(J, sp.thigh, ['thigh']).filter((p) => p.bone === th);
    if (sp.end < 0.6) {
      const K = J.pos[th + 1], A = J.pos[th + 2];
      // lower leg: from the knee to the hem, opening up for flares / wide legs
      legs.push({ t: 'cone', a: [K[0], K[1] + 0.02, K[2]], b: [A[0], A[1] - 0.03, A[2] + 0.004], ra: J.r.knee + sp.shin * 0.8 + 0.008, rb: J.r.ankle + sp.shin + (sp.flare ?? 0) + 0.012, bone: th + 1, k: 0.05, tag: 9 + s });
      legs.push({ t: 'ellipsoid', c: [K[0], (K[1] + A[1]) / 2 + 0.08, K[2] - 0.01], r: [J.r.calf + sp.shin * 0.7 + 0.004, 0.15, J.r.calf + sp.shin * 0.7 + 0.006], bone: th + 1, k: 0.05, tag: 9 + s });
    }
    const bunch = sp.bunch ?? 0;
    parts.push({
      prims: legs,
      clips: [plane([0, sp.end, 0], [0, -1, 0], 0.008)],
      k: 0.04,
      // fabric gathers: soft rings at the knee, stacking folds above the shoe
      disp: (_x, y) => -0.0028 * Math.sin(y * 80) * Math.exp(-(((y - 0.56) / 0.06) ** 2)) - bunch * 0.0045 * Math.sin(y * 95) * Math.max(0, Math.min(1, (0.3 - y) / 0.15)),
    });
    if (sp.cuff) trims.push({ geo: meshTrim(band([side * J.hx, sp.end + 0.02, -0.006], J.r.ankle + 0.012, J.r.ankle + 0.012, 0.04, 0.008, th + 1)), tone: 'dark' });
    if (sp.cargo) trims.push({ geo: meshTrim([{ t: 'box', c: [side * (J.hx + J.r.thigh * 0.85 + sp.thigh), 0.74, 0.01], s: [0.012, 0.06, 0.05], round: 0.008, bone: th }]), tone: 'dark' });
  }
  const main = meshMain(J, parts);
  // waistband
  trims.push({ geo: meshTrim(band([0, waist - 0.018, 0.004 + J.bp.belly * 0.02], 0.158 * W + J.bp.belly * 0.02 + 0.011, 0.106 + J.bp.belly * 0.05 + 0.007, 0.03, 0.005, B.pelvis)), tone: sp.denim ? 'c1' : 'dark' });
  if (sp.denim) {
    // fly seam + button
    trims.push({ geo: meshTrim([{ t: 'cone', a: [0.008, waist - 0.035, frontZ(J, waist - 0.035, 0.008)], b: [0.004, 0.99, frontZ(J, 1.0, 0.004)], ra: 0.0028, rb: 0.0028, bone: B.pelvis }]), tone: 'dark' });
    trims.push({ geo: meshTrim([{ t: 'ellipsoid', c: [0, waist - 0.02, frontZ(J, waist - 0.02, 0.016)], r: [0.008, 0.008, 0.004], bone: B.pelvis }], 0.003), tone: 'metal' });
  }
  return { main, trims };
}

// ---------------------------------------------------------------------------- dresses

interface DressSpec { hem: number; flare: number; sleeve: Sleeve; neck: Neck; tiers?: number; sash?: boolean; belt?: boolean; blouse?: number }
const DRESSES: Record<string, DressSpec> = {
  Slip: { hem: 0.56, flare: 0.04, sleeve: 'none', neck: 'scoop' },
  'A-line': { hem: 0.6, flare: 0.1, sleeve: 'short', neck: 'crew' },
  Maxi: { hem: 0.08, flare: 0.1, sleeve: 'none', neck: 'v' },
  Saree: { hem: 0.04, flare: 0.05, sleeve: 'short', neck: 'scoop', sash: true },
  Lehenga: { hem: 0.04, flare: 0.2, sleeve: 'short', neck: 'scoop', blouse: 1.26 },
  Bodycon: { hem: 0.58, flare: -0.02, sleeve: 'none', neck: 'scoop' },
  'Shirt dress': { hem: 0.58, flare: 0.06, sleeve: 'short', neck: 'shirt', belt: true },
  Anarkali: { hem: 0.18, flare: 0.18, sleeve: 'long', neck: 'crew' },
  Tiered: { hem: 0.36, flare: 0.14, sleeve: 'short', neck: 'crew', tiers: 3 },
  Wrap: { hem: 0.52, flare: 0.07, sleeve: 'elbow', neck: 'v', belt: true },
};
/** How far the arms must open to clear a dress's skirt (radians, 0 = none). */
export function skirtClearance(dressCut: string | null, outerCut: string | null): number {
  let a = 0;
  if (dressCut) {
    const sp = DRESSES[dressCut] ?? DRESSES['A-line'];
    a = sp.flare <= 0 ? 0.06 : 0.17 + sp.flare * 1.1;
  }
  if (outerCut) {
    const t = topSpec(outerCut);
    if (t.hem < 0.85) a = Math.max(a, 0.12);
  }
  return a;
}
const dressCache = new GeoCache<GarmentGeo>(20);
export function dressGeometry(bp: BodyP, cut: string): GarmentGeo {
  return dressCache.get(`${bodyKey(bp)}|${cut}`, () => buildDress(jointsFor(bp), cut));
}

function buildDress(J: Joints, cut: string): GarmentGeo {
  const sp = DRESSES[cut] ?? DRESSES['A-line'];
  const ease = 0.011;
  const W = J.bp.width, hp = J.bp.hips;
  const parts: Part[] = [];
  const trims: Trim[] = [];
  const bodice = bodyPrims(J, ease, ['torso', 'pelvis']).filter((p) => (sp.sleeve === 'none' ? p.bone !== B.upperArmL && p.bone !== B.upperArmR : true));
  const neckY = sp.neck === 'scoop' ? 1.63 : sp.neck === 'v' ? 1.69 : 1.705;
  const bodiceClips = [plane([0, neckY, 0.02], [0, 1, sp.neck === 'scoop' ? 0.9 : 0.5], 0.01)];
  if (sp.blouse) bodiceClips.push(plane([0, sp.blouse, 0], [0, -1, 0], 0.008));
  parts.push({ prims: bodice, clips: bodiceClips });
  // skirt: a lofted bell from the waist to the hem, clearing the legs
  const top = sp.blouse ? 1.14 : 1.1;
  const hemW = Math.max(0.215 * hp * W, 0.2 * hp * W + sp.flare + (0.6 - sp.hem) * 0.05);
  // the skirt clears the hips and thighs (widest at the seat), then falls to the hem
  const seatW = (J.hx + J.r.thigh) * 1.0 + 0.03;
  const f = loft(sp.hem, top, [[sp.hem, Math.max(hemW, seatW * 0.9) + 0.02], [Math.max(sp.hem + 0.02, 0.62), Math.max(seatW * 0.97, hemW * 0.9)], [0.93, seatW], [1.03, 0.172 * hp * W + 0.026], [top, 0.158 * W + 0.016 + J.bp.belly * 0.03]], [[sp.hem, 0.15 + sp.flare * 0.8], [0.93, 0.142 + ease], [top, 0.108 + ease + J.bp.belly * 0.05]], [[sp.hem, -0.005], [0.95, -0.014], [top, 0.0]]);
  const tiers = sp.tiers ?? 0;
  parts.push({
    prims: [{ t: 'fn', f, c: [0, (sp.hem + top) / 2, 0], ext: [hemW + 0.06, (top - sp.hem) / 2 + 0.01, 0.3], bone: B.pelvis, k: 0, tag: 1 }],
    k: 0.05,
    // soft vertical folds that deepen toward the hem (+ tier steps)
    disp: (x, y, z) => -0.006 * Math.sin(Math.atan2(x, z) * 11) * Math.max(0, Math.min(1, (0.95 - y) / 0.5)) - (tiers ? 0.012 * (((y - sp.hem) / ((top - sp.hem) / tiers)) % 1) : 0),
  });
  if (sp.sleeve !== 'none') {
    const end = SLEEVE_END[sp.sleeve];
    for (const side of [-1, 1] as const) {
      const bones = side < 0 ? [B.upperArmL, B.foreArmL] : [B.upperArmR, B.foreArmR];
      const prims = bodyPrims(J, 0.012, sp.sleeve === 'long' || sp.sleeve === 'elbow' ? ['upperArm', 'foreArm'] : ['upperArm']).filter((p) => bones.includes(p.bone as never));
      parts.push({ prims, clips: [plane([0, end, 0], [0, -1, 0], 0.008)], kAt: (_x, y) => armBlend(y) });
    }
  }
  if (sp.neck === 'v') parts.push({ prims: [{ t: 'box', c: [0, 1.7, 0.16], s: [0.05, 0.09, 0.08], round: 0.002, rot: [0, 0, Math.PI / 4], bone: B.chest }], subtract: true, k: 0.006 });
  const main = meshMain(J, parts);
  if (sp.sash) trims.push({ geo: meshTrim([{ t: 'cone', a: [0.19, 1.13, 0.05], b: [-0.12, 1.6, 0.11], ra: 0.05, rb: 0.035, bone: B.chest, k: 0.02 }, { t: 'cone', a: [-0.12, 1.6, 0.11], b: [-0.17, 1.63, -0.06], ra: 0.035, rb: 0.04, bone: B.chest, k: 0.03 }, { t: 'cone', a: [-0.17, 1.63, -0.06], b: [-0.18, 1.0, -0.15], ra: 0.04, rb: 0.07, bone: B.chest, k: 0.03 }], 0.008, { disp: (x, y) => -0.003 * Math.sin(x * 90 + y * 60) }), tone: 'c3' });
  if (sp.belt) trims.push({ geo: meshTrim(band([0, 1.15, 0.0], 0.152 * W + ease + 0.008 + J.bp.belly * 0.03, 0.106 + ease + 0.006 + J.bp.belly * 0.06, 0.03, 0.005, B.pelvis)), tone: 'c2' });
  if (sp.neck === 'shirt') {
    const prims: Prim[] = [{ t: 'torus', c: [0, 1.725, 0.0], R: J.r.neck + 0.018, r: 0.011, rot: [0.3, 0, 0], bone: B.neck }];
    for (const s of [-1, 1]) prims.push({ t: 'ellipsoid', c: [s * 0.05, 1.672, frontZ(J, 1.672, ease + 0.006)], r: [0.022, 0.05, 0.0055], rot: [-0.55, s * 0.25, s * 0.72], bone: B.chest, k: 0.006 });
    trims.push({ geo: meshTrim(prims, TRIM_CELL, { k: 0 }), tone: 'light' });
  }
  return { main, trims };
}

// ---------------------------------------------------------------------------- socks & shoes

export const SOCK_TOP: Record<string, number> = { Crew: 0.26, Knee: 0.5, Ankle: 0.13, Calf: 0.36, 'Sport crew': 0.27, 'Sport knee': 0.5, 'Ribbed crew': 0.25, Slouch: 0.3, 'Over-knee': 0.68, Trainer: 0.09 };
const sockCache = new GeoCache<GarmentGeo>(20);
export function sockGeometry(bp: BodyP, cut: string): GarmentGeo {
  return sockCache.get(`${bodyKey(bp)}|${cut}`, () => {
    const J = jointsFor(bp);
    const top = SOCK_TOP[cut] ?? 0.26;
    const slouch = cut === 'Slouch';
    const parts: Part[] = [{
      prims: bodyPrims(J, 0.0035, ['shin', 'foot', 'thigh']),
      clips: [plane([0, top, 0], [0, 1, 0], 0.006), { o: [0, 0.003, 0], n: [0, -1, 0], k: 0.006 }],
      disp: slouch ? (_x, y) => -0.004 * Math.sin(y * 110) * Math.max(0, (y - 0.12) * 5) : (_x, y) => (y > top - 0.03 ? -0.0015 * Math.sin(Math.atan2(_x, y) * 60) : 0),
    }];
    return { main: meshMain(J, parts, 0.02), trims: [] };
  });
}

interface ShoeSpec { up: number; sole: number; toe: number; open?: 'sandal' | 'slide'; fluffy?: boolean; laces?: boolean; heelTab?: boolean }
const SHOES: Record<string, ShoeSpec> = {
  'Low sneaker': { up: 0.075, sole: 0.026, toe: 0.012, laces: true },
  'High-top': { up: 0.17, sole: 0.026, toe: 0.012, laces: true },
  Runner: { up: 0.07, sole: 0.034, toe: 0.01, laces: true, heelTab: true },
  'Slip-on': { up: 0.06, sole: 0.022, toe: 0.01 },
  Loafer: { up: 0.055, sole: 0.014, toe: 0.006 },
  'Chelsea boot': { up: 0.22, sole: 0.02, toe: 0.008 },
  'Combat boot': { up: 0.27, sole: 0.034, toe: 0.014, laces: true },
  Sandal: { up: 0.0, sole: 0.02, toe: 0, open: 'sandal' },
  Slide: { up: 0.0, sole: 0.026, toe: 0, open: 'slide' },
  'Cosy slipper': { up: 0.07, sole: 0.02, toe: 0.02, fluffy: true },
};
const shoeCache = new GeoCache<GarmentGeo>(20);
export function shoeGeometry(bp: BodyP, cut: string): GarmentGeo {
  return shoeCache.get(`${bodyKey(bp)}|${cut}`, () => buildShoes(jointsFor(bp), cut));
}

/**
 * A shoe "last": cross-sections (rounded rectangles in x/y) swept from heel to toe, with a
 * flat sole, a low rounded toe, a higher instep and a heel counter — a real shoe silhouette.
 */
function shoeLast(ax: number, heelZ: number, toeZ: number, sole: number, up: number, toe: number, inf: number) {
  const L = toeZ - heelZ;
  const width = (t: number) => (0.046 + 0.014 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - (t > 0.82 ? Math.pow((t - 0.82) / 0.18, 2) * 0.026 : 0)) + inf; // half width, rounding in at the toe
  const top = (t: number) => {
    // heel counter → instep (highest) → toe box (low, rounded)
    const instep = sole + 0.112 + inf;
    const toeTop = sole + 0.046 + toe + inf;
    const heel = sole + Math.max(up, 0.09) + inf * 0.5;
    if (t < 0.25) return heel + (instep - heel) * (t / 0.25);
    if (t < 0.45) return instep;
    if (t < 0.8) return instep + (toeTop - instep) * ((t - 0.45) / 0.35);
    // round the toe down to the sole
    return toeTop - Math.pow((t - 0.8) / 0.2, 2) * 0.03;
  };
  return (x: number, y: number, z: number) => {
    const t = Math.min(1, Math.max(0, (z - heelZ) / L));
    const w = width(t), tp = top(t), bot = 0;
    const hy = (tp - bot) / 2, cy = (tp + bot) / 2;
    // rounded-rectangle cross-section (corner radius r)
    const r = Math.min(w, hy) * 0.75;
    const qx = Math.abs(x - ax) - (w - r), qy = Math.abs(y - cy) - (hy - r);
    const mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0;
    const side = Math.sqrt(mx * mx + my * my) + Math.min(Math.max(qx, qy), 0) - r;
    // rounded heel and toe caps
    const capZ = z < heelZ ? heelZ - z : z > toeZ ? z - toeZ : 0;
    if (capZ <= 0) return side;
    const ss = side > 0 ? side : 0;
    return Math.sqrt(ss * ss + capZ * capZ);
  };
}

function buildShoes(J: Joints, cut: string): GarmentGeo {
  const sp = SHOES[cut] ?? SHOES['Low sneaker'];
  const trims: Trim[] = [];
  const upper: Part[] = [];
  const soles: Prim[] = [];
  for (const side of [-1, 1] as const) {
    const s = side < 0 ? 0 : 1;
    const ft = s ? B.footR : B.footL;
    const A = J.pos[(s ? B.thighR : B.thighL) + 2];
    // sole: a rounded slab under the whole foot, a little longer and wider than it
    {
      const heelZ = A[2] - 0.066, toeZ = A[2] + 0.208;
      const fs = shoeLast(A[0] + side * 0.005, heelZ, toeZ, 0, 0, 0, 0.006);
      soles.push({ t: 'fn', f: (x, y, z) => Math.max(fs(x, 0.02, z), Math.abs(y - sp.sole / 2) - sp.sole / 2) - 0.0, c: [A[0], sp.sole / 2, (heelZ + toeZ) / 2], ext: [0.08, sp.sole, (toeZ - heelZ) / 2 + 0.03], bone: ft, k: 0.01 });
    }
    if (sp.open) continue;
    const inf = sp.fluffy ? 0.014 : 0.004;
    const heelZ = A[2] - 0.06, toeZ = A[2] + 0.2;
    const f = shoeLast(A[0] + side * 0.005, heelZ, toeZ, sp.sole * 0.6, sp.up, sp.toe, inf);
    const prims: Prim[] = [{ t: 'fn', f, c: [A[0], 0.08, (heelZ + toeZ) / 2], ext: [0.08, 0.1, (toeZ - heelZ) / 2 + 0.04], bone: ft, k: 0.03 }];
    if (sp.up > 0.09) prims.push({ t: 'cone', a: [A[0], 0.05, -0.01], b: [A[0], sp.up, -0.008], ra: J.r.ankle + 0.022, rb: J.r.ankle + (sp.up > 0.2 ? 0.026 : 0.018), bone: (s ? B.thighR : B.thighL) + 1, k: 0.03 });
    upper.push({ prims, clips: [plane([0, sp.up, -0.02], [0, 1, sp.up > 0.09 ? 0.05 : -0.35], 0.008), { o: [0, sp.sole * 0.6, 0], n: [0, -1, 0], k: 0.006 }], disp: sp.fluffy ? (x, y, z) => -0.004 * (Math.sin(x * 160 + z * 90) * Math.sin(y * 170 - z * 120)) : undefined, k: 0.01 });
  }
  const J2 = J;
  const main = upper.length ? meshMain(J2, upper, 0.02) : null;
  trims.push({ geo: meshTrim(soles, 0.006), tone: 'c2' });
  if (sp.open) {
    // straps over the bare foot
    const straps: Prim[] = [];
    for (const side of [-1, 1] as const) {
      const s = side < 0 ? 0 : 1, ft = s ? B.footR : B.footL;
      const A = J.pos[(s ? B.thighR : B.thighL) + 2];
      if (sp.open === 'slide') straps.push({ t: 'torus', c: [A[0], 0.045, 0.1], R: 0.052, r: 0.012, rot: [Math.PI / 2 - 0.2, 0, 0], bone: ft });
      else {
        straps.push({ t: 'torus', c: [A[0], 0.05, 0.12], R: 0.045, r: 0.007, rot: [Math.PI / 2 - 0.3, 0, 0], bone: ft });
        straps.push({ t: 'torus', c: [A[0], 0.075, -0.0], R: 0.05, r: 0.007, rot: [Math.PI / 2 + 0.2, 0, 0], bone: ft });
      }
    }
    trims.push({ geo: meshTrim(straps, 0.004), tone: 'c1' });
  }
  if (sp.laces) {
    const laces: Prim[] = [];
    for (const side of [-1, 1] as const) {
      const s = side < 0 ? 0 : 1, ft = s ? B.footR : B.footL;
      const A = J.pos[(s ? B.thighR : B.thighL) + 2];
      // across the instep (top of the last: flat at t 0.25–0.45, then sloping to the toe)
      const heelZ = A[2] - 0.06, L = 0.26, instep = sp.sole * 0.6 + 0.112 + 0.004, toeTop = sp.sole * 0.6 + 0.046 + sp.toe + 0.004;
      for (const t of [0.3, 0.39, 0.48, 0.57]) {
        const y = (t < 0.45 ? instep : instep + (toeTop - instep) * ((t - 0.45) / 0.35)) + 0.003;
        const z = heelZ + t * L;
        laces.push({ t: 'cone', a: [A[0] + side * 0.005 - 0.02, y - 0.004, z], b: [A[0] + side * 0.005 + 0.02, y - 0.004, z], ra: 0.004, rb: 0.004, bone: ft });
      }
    }
    trims.push({ geo: meshTrim(laces, 0.0035), tone: 'light' });
  }
  return { main, trims };
}
