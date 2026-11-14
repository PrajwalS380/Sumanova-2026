import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AvatarConfig } from './config';

/**
 * Procedural sculpting helpers for the SUMANOVA avatar.
 *
 * The head is a single smooth sphere deformed into a face shape (jaw taper,
 * cheeks, chin, fuller back). Hair, beards and hats are "shells" of that same
 * surface: inside their region they're pushed outward, outside it they sink
 * just under the skin, which gives clean hairlines without boolean cuts.
 */
export interface HeadShape {
  rx: number;
  ry: number;
  rz: number;
  jawN: number;
  jawExp: number;
  cheeks: number;
  chinLow: number;
  topWide: number;
}

export function headShape(c: AvatarConfig): HeadShape {
  const f = c.face;
  const base = { oval: [0.35, 0.39, 0.36], round: [0.37, 0.37, 0.37], square: [0.36, 0.38, 0.36], heart: [0.36, 0.385, 0.355], long: [0.335, 0.41, 0.35] }[f.shape];
  return {
    rx: base[0] * f.width,
    ry: base[1] * f.height,
    rz: base[2],
    jawN: { oval: 0.3, round: 0.16, square: 0.14, heart: 0.42, long: 0.28 }[f.shape] * (1.35 - f.jaw * 0.7),
    jawExp: f.shape === 'square' ? 3.2 : f.shape === 'round' ? 2.2 : 1.6,
    cheeks: f.cheeks,
    chinLow: 1 + (f.chin - 0.5) * 0.14,
    topWide: f.shape === 'heart' ? 0.07 : 0,
  };
}

function kxAt(h: HeadShape, uy: number, uz: number) {
  let kx = 1;
  if (uy < 0) kx -= h.jawN * Math.pow(-uy, h.jawExp);
  else kx += h.topWide * uy;
  kx += h.cheeks * 0.07 * Math.exp(-(((uy + 0.22) / 0.22) ** 2)) * Math.max(0, uz);
  return kx;
}

/** Maps a unit-sphere direction onto the deformed head surface (times `mult`). */
export function deform(h: HeadShape, ux: number, uy: number, uz: number, out: THREE.Vector3, mult = 1) {
  const kx = kxAt(h, uy, uz);
  let kz = uy < 0 ? 1 - 0.1 * uy * uy : 1;
  if (uz < 0) kz *= 1.07;
  const ky = uy < 0 ? h.chinLow : 1;
  return out.set(ux * h.rx * kx * mult, uy * h.ry * ky * mult, uz * h.rz * kz * mult);
}

/** Front-facing surface depth at head-local (x, y). */
export function surfaceZ(h: HeadShape, x: number, y: number) {
  const uy = y / (h.ry * (y < 0 ? h.chinLow : 1));
  if (Math.abs(uy) >= 1) return 0;
  let uz = 0.8;
  for (let i = 0; i < 3; i++) {
    const ux = x / (h.rx * kxAt(h, uy, uz));
    uz = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy));
  }
  return uz * h.rz * (uy < 0 ? 1 - 0.1 * uy * uy : 1);
}

/** A sphere sculpted onto the head surface, with a per-direction radial multiplier. */
export function shellGeometry(h: HeadShape, radial: (ux: number, uy: number, uz: number, az: number) => number, w = 64, hs = 48) {
  const g = new THREE.SphereGeometry(1, w, hs);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
    deform(h, ux, uy, uz, v, radial(ux, uy, uz, Math.atan2(ux, uz)));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  g.dispose();
  return m;
}

export const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Cheap deterministic 3D "noise" for curls and texture. */
export const wobble = (x: number, y: number, z: number, f = 1) => Math.sin(x * 7.1 * f + y * 3.3 * f) * Math.sin(y * 8.7 * f - z * 2.1 * f) * Math.sin(z * 6.3 * f + x * 4.7 * f);

/** Hairline height (in unit-sphere y) as a function of azimuth (0 = front). */
export function hairline(az: number, front: number, back: number, sideLift: number) {
  const a = Math.abs(az) / Math.PI;
  return front * (1 - a ** 1.5) + back * a ** 1.5 + sideLift * Math.sin(Math.PI * a);
}

/** Smooth tube following 2D points laid onto the face surface. */
export function surfaceTube(h: HeadShape, pts: [number, number][], radius: number, lift = 0.004, segments = 24) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, surfaceZ(h, x, y) + lift)));
  return new THREE.TubeGeometry(curve, segments, radius, 8, false);
}

/** A flat 2D shape bent to sit on the face surface. */
export function surfaceShape(h: HeadShape, shape: THREE.Shape, cx: number, cy: number, lift = 0.004) {
  const g = new THREE.ShapeGeometry(shape, 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + cx, y = p.getY(i) + cy;
    p.setXYZ(i, x, y, surfaceZ(h, x, y) + lift);
  }
  g.computeVertexNormals();
  return g;
}

/** Lathe from (radius, y) points listed bottom-to-top. */
export function lathe(pts: [number, number][], segs = 40, phiStart = 0, phiLength = Math.PI * 2) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs, phiStart, phiLength);
}

let blushTex: THREE.CanvasTexture | null = null;
/** Soft radial gradient used for blush and glow decals. */
export function softDot() {
  if (blushTex) return blushTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  blushTex = new THREE.CanvasTexture(c);
  return blushTex;
}

export function mix(a: string, b: string, t: number) {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}
