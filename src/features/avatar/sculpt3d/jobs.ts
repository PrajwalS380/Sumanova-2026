import * as THREE from 'three';
import type { BodyP } from '../look/face';
import type { HairP } from '../look/hair';
import type { HeadShape } from '../sculpt';
import { bodyGeometry, feetGeometry, handsGeometry, nailsGeometry } from './rig';
import { bottomGeometry, dressGeometry, shoeGeometry, sockGeometry, topGeometry, type GarmentGeo, type Tone } from './garments';
import { groomHair } from './groom';
import { headGeometry } from './head';
import type { EarP, NoseP } from '../look/face';

/** Every sculpted piece is described by a small, serialisable job (so it can run in a worker). */
export type Job =
  | { k: 'body'; bp: BodyP }
  | { k: 'hands'; bp: BodyP }
  | { k: 'feet'; bp: BodyP }
  | { k: 'top'; bp: BodyP; cut: string; layer: 0 | 1; under?: string }
  | { k: 'bottom'; bp: BodyP; cut: string }
  | { k: 'dress'; bp: BodyP; cut: string }
  | { k: 'socks'; bp: BodyP; cut: string }
  | { k: 'shoes'; bp: BodyP; cut: string }
  | { k: 'hair'; h: HeadShape; p: HairP; seed: number; hatOn: boolean }
  | { k: 'head'; h: HeadShape; nose: NoseP | null; ears: EarP };

/** Bump when any sculpt builder changes its output (invalidates the on-device cache). */
export const SCULPT_VERSION = 60;

const r3 = (n: number) => Math.round(n * 1000) / 1000;
export function jobKey(j: Job): string {
  const bp = 'bp' in j ? `${r3(j.bp.width)},${r3(j.bp.height)},${r3(j.bp.belly)},${r3(j.bp.shoulders)},${r3(j.bp.hips)},${j.bp.fem ?? 0}` : '';
  switch (j.k) {
    case 'body':
    case 'hands':
    case 'feet':
      return `${j.k}|${bp}`;
    case 'top':
      return `top|${bp}|${j.cut}|${j.layer}|${j.under ?? ''}`;
    case 'head':
      return `head|${JSON.stringify(j.h)}|${JSON.stringify(j.nose)}|${JSON.stringify(j.ears)}`;
    case 'hair':
      return `hair|${JSON.stringify(j.h)}|${JSON.stringify(j.p)}|${j.seed}|${j.hatOn ? 1 : 0}`;
    default:
      return `${j.k}|${bp}|${j.cut}`;
  }
}

/** Result: named geometries (main, trims…, fade, band) with an optional tone per piece. */
export interface Piece { geo: THREE.BufferGeometry; tone?: Tone; role: 'main' | 'trim' | 'fade' | 'band' | 'base' }
export type Result = Piece[];

const fromGarment = (g: GarmentGeo): Result => [...(g.main ? [{ geo: g.main, role: 'main' as const }] : []), ...g.trims.map((t) => ({ geo: t.geo, tone: t.tone, role: 'trim' as const }))];

export function runJob(j: Job): Result {
  switch (j.k) {
    case 'body': return [{ geo: bodyGeometry(j.bp), role: 'main' }];
    case 'head': return [{ geo: headGeometry(j.h, j.nose, j.ears), role: 'main' }];
    case 'hands': return [{ geo: handsGeometry(j.bp), role: 'main' }, { geo: nailsGeometry(j.bp), role: 'trim' }];
    case 'feet': return [{ geo: feetGeometry(j.bp), role: 'main' }];
    case 'top': return fromGarment(topGeometry(j.bp, j.cut, j.layer, j.under));
    case 'bottom': return fromGarment(bottomGeometry(j.bp, j.cut));
    case 'dress': return fromGarment(dressGeometry(j.bp, j.cut));
    case 'socks': return fromGarment(sockGeometry(j.bp, j.cut));
    case 'shoes': return fromGarment(shoeGeometry(j.bp, j.cut));
    case 'hair': {
      const o = groomHair(j.h, j.p, j.seed, j.hatOn);
      const out: Result = [];
      if (o.strands) out.push({ geo: o.strands, role: 'main' });
      if (o.base) out.push({ geo: o.base, role: 'base' });
      if (o.fade) out.push({ geo: o.fade, role: 'fade' });
      if (o.band) out.push({ geo: o.band, role: 'band' });
      return out;
    }
  }
}

// ---------------------------------------------------------------------------- (de)serialise

const ATTRS: [string, number, 'f' | 'u16'][] = [['position', 3, 'f'], ['normal', 3, 'f'], ['uv', 2, 'f'], ['color', 3, 'f'], ['skinIndex', 4, 'u16'], ['skinWeight', 4, 'f'], ['hairT', 3, 'f']];

/** Pack a result into one ArrayBuffer (header JSON + raw arrays) — for postMessage and Cache Storage. */
export function pack(res: Result): ArrayBuffer {
  const metas: { tone?: Tone; role: Piece['role']; attrs: { n: string; len: number; off: number }[]; index: { len: number; off: number; wide: boolean } | null }[] = [];
  const chunks: ArrayBufferView[] = [];
  let off = 0;
  const push = (a: ArrayBufferView) => {
    const o = off;
    chunks.push(a);
    off += a.byteLength;
    off = (off + 3) & ~3;
    return o;
  };
  for (const p of res) {
    const attrs: { n: string; len: number; off: number }[] = [];
    for (const [n] of ATTRS) {
      const a = p.geo.getAttribute(n) as THREE.BufferAttribute | undefined;
      if (!a) continue;
      attrs.push({ n, len: a.array.length, off: push(a.array as ArrayBufferView) });
    }
    const ix = p.geo.getIndex();
    metas.push({ tone: p.tone, role: p.role, attrs, index: ix ? { len: ix.array.length, off: push(ix.array as ArrayBufferView), wide: ix.array instanceof Uint32Array } : null });
  }
  const head = new TextEncoder().encode(JSON.stringify(metas));
  const hlen = (head.byteLength + 3) & ~3;
  const buf = new ArrayBuffer(4 + hlen + off);
  const dv = new DataView(buf);
  dv.setUint32(0, head.byteLength, true);
  new Uint8Array(buf, 4, head.byteLength).set(head);
  let cur = 0;
  for (const c of chunks) {
    new Uint8Array(buf, 4 + hlen + cur, c.byteLength).set(new Uint8Array(c.buffer, c.byteOffset, c.byteLength));
    cur += c.byteLength;
    cur = (cur + 3) & ~3;
  }
  return buf;
}

export function unpack(buf: ArrayBuffer): Result {
  const dv = new DataView(buf);
  const hl = dv.getUint32(0, true);
  const metas = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))) as ReturnType<typeof JSON.parse>;
  const base = 4 + ((hl + 3) & ~3);
  const out: Result = [];
  for (const m of metas as { tone?: Tone; role: Piece['role']; attrs: { n: string; len: number; off: number }[]; index: { len: number; off: number; wide: boolean } | null }[]) {
    const geo = new THREE.BufferGeometry();
    for (const a of m.attrs) {
      const spec = ATTRS.find((x) => x[0] === a.n)!;
      const arr = spec[2] === 'u16' ? new Uint16Array(buf, base + a.off, a.len) : new Float32Array(buf, base + a.off, a.len);
      geo.setAttribute(a.n, new THREE.BufferAttribute(arr, spec[1]));
    }
    if (m.index) geo.setIndex(new THREE.BufferAttribute(m.index.wide ? new Uint32Array(buf, base + m.index.off, m.index.len) : new Uint16Array(buf, base + m.index.off, m.index.len), 1));
    geo.computeBoundingSphere();
    out.push({ geo, tone: m.tone, role: m.role });
  }
  return out;
}
