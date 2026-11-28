import * as THREE from 'three';
import { deform, skullDir, skullDist, smooth, wobble, type HeadShape } from '../sculpt';
import type { HairP } from '../look/hair';
import { rng, hashStr } from '../look/rng';
import { Field, type Prim } from './sdf';
import { GeoCache, meshField } from './mesh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The hair groom: hair is GROWN, not assembled.
 *
 *  1. A thin scalp layer (signed-distance cap, cut at a natural hairline with temple recesses)
 *     so the scalp never shows between strands.
 *  2. Hundreds of strand CLUMPS: each one a spline grown from a root on the scalp along a comb
 *     field (parting, fringe, quiff, sweep…), held just above the head and the layers under it,
 *     pulled by gravity once it leaves the head, kept off the face, neck and shoulders, then
 *     waved / curled / coiled. Every clump is a tapered, flattened ribbon with a pointed or blunt
 *     tip, and carries its strand direction (`hairT`), root→tip position and a random id so the
 *     material can draw fine strands, highlights and anisotropic shine along the hair.
 *  3. Structures: ponytails (strands gathered to a tie + a hanging tail), buns (strands wound
 *     round a ball), three-strand plaits (single, double, French, Dutch, fishtail, box braids,
 *     cornrows), locs and rope twists, and afros (a sculpted volume covered in coils).
 *
 * Head-local units (the head group's), front = +z, up = +y.
 * Vertex colour = (shade, t root→tip, clump random). uv = (across the clump, t).
 */

export interface GroomOut {
  strands: THREE.BufferGeometry | null;
  /** thin alpha-cut strand cards riding on the locks (fine strands + flyaways, sumanova-us-106) */
  cards?: THREE.BufferGeometry | null;
  base: THREE.BufferGeometry | null;
  fade: THREE.BufferGeometry | null;
  band: THREE.BufferGeometry | null;
}

const cache = new GeoCache<GroomOut>(16);

/** Lock guides + scalp layer of a style (input of the offline Blender bake, tools/hair-bake). */
export function groomGuides(h: HeadShape, p: HairP, seed: number) {
  const g = new Groomer(h, p, seed, false);
  g.m.guides = [];
  const out = g.build();
  return { guides: g.m.guides, base: out.base, fade: out.fade, band: out.band };
}
export function groomHair(h: HeadShape, p: HairP, seed: number, hatOn: boolean): GroomOut {
  return cache.get(`${JSON.stringify(h)}|${JSON.stringify(p)}|${seed}|${hatOn}`, () => new Groomer(h, p, seed, hatOn).build());
}

type V = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);

/** Ribbon / tube geometry accumulated for all clumps (one draw call). */
/** A lock's guide (for the offline Blender bake): centre-line, width and thickness along it. */
export interface LockGuide { pts: number[]; w: number[]; flat: number; rand: number; t0: number; t1: number }

class StrandMesh {
  /** when set, every lock's guide is recorded too (offline baking) */
  guides: LockGuide[] | null = null;
  pos: number[] = [];
  nor: number[] = [];
  tan: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  get count() { return this.pos.length / 3; }

  /**
   * One clump along `pts`: elliptical cross-section (`w` across, `w * flat` through), the flat
   * side facing `out(p)` (away from the head), width profile `wAt(t)`, shade profile `shadeAt`.
   */
  add(pts: V[], o: { wAt: (t: number) => number; flat: number; radial: number; out: (p: V, o: V) => void; shadeAt: (t: number, p: V) => number; rand: number; tStart?: number; tEnd?: number }) {
    const n = pts.length;
    if (n < 2) return;
    if (this.guides) this.guides.push({ pts: pts.flatMap((q) => [q.x, q.y, q.z]), w: pts.map((_, i) => o.wAt(i / (n - 1))), flat: o.flat, rand: o.rand, t0: o.tStart ?? 0, t1: o.tEnd ?? 1 });
    const base = this.count;
    const T = v3(), N = v3(), B = v3(), off = v3(), nn = v3();
    const R = o.radial;
    const t0 = o.tStart ?? 0, t1 = o.tEnd ?? 1;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      T.subVectors(b, a);
      if (T.lengthSq() < 1e-12) T.set(0, -1, 0);
      T.normalize();
      o.out(pts[i], N);
      N.addScaledVector(T, -N.dot(T));
      if (N.lengthSq() < 1e-8) N.set(T.y, -T.x, 0.3);
      N.normalize();
      B.crossVectors(T, N).normalize();
      const t = t0 + ((t1 - t0) * i) / (n - 1);
      const w = Math.max(1e-4, o.wAt(i / (n - 1)));
      const th = w * o.flat;
      const sh = o.shadeAt(i / (n - 1), pts[i]);
      for (let j = 0; j < R; j++) {
        const ang = (j / R) * Math.PI * 2;
        const c = Math.cos(ang), s = Math.sin(ang);
        off.copy(B).multiplyScalar(c * w).addScaledVector(N, s * th);
        this.pos.push(pts[i].x + off.x, pts[i].y + off.y, pts[i].z + off.z);
        nn.copy(B).multiplyScalar(c / w).addScaledVector(N, s / th).normalize();
        // flatten the shading normal toward the outward side: ribbons read as layered hair, not tubes
        nn.lerp(N, 0.35).normalize();
        this.nor.push(nn.x, nn.y, nn.z);
        this.tan.push(T.x, T.y, T.z);
        this.uv.push(j / R, t);
        this.col.push(sh, t, o.rand);
      }
    }
    for (let i = 0; i < n - 1; i++)
      for (let j = 0; j < R; j++) {
        const a = base + i * R + j, b = base + i * R + ((j + 1) % R), c = a + R, d = b + R;
        this.idx.push(a, c, b, b, c, d);
      }
  }

  geometry() {
    if (!this.count) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('hairT', new THREE.Float32BufferAttribute(this.tan, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Strand cards: flat strips laid on a lock's outer face (and a few loose flyaways off the
 * silhouette). Their fragment shader cuts fine tapered strands out of them (alpha test), so the
 * broad sculpted locks keep the silhouette while the surface reads as groomed, fine hair.
 */
class CardMesh {
  pos: number[] = [];
  nor: number[] = [];
  tan: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  get count() { return this.pos.length / 3; }
  /** a strip through `centres` (one per path point), `across` = half-width direction × width */
  strip(centres: V[], across: V[], nrm: V[], tan: V[], shade: number[], t0: number, t1: number, rand: number) {
    const base = this.count;
    const n = centres.length;
    for (let i = 0; i < n; i++) {
      const t = t0 + ((t1 - t0) * i) / (n - 1);
      for (const s of [-1, 1]) {
        const c = centres[i], a = across[i];
        this.pos.push(c.x + a.x * s, c.y + a.y * s, c.z + a.z * s);
        this.nor.push(nrm[i].x, nrm[i].y, nrm[i].z);
        this.tan.push(tan[i].x, tan[i].y, tan[i].z);
        this.uv.push(s < 0 ? 0 : 1, t);
        this.col.push(shade[i], t, rand);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      // wound so the front face looks outward (away from the head)
      this.idx.push(a, b, c, b, d, c);
    }
  }
  geometry() {
    if (!this.count) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('hairT', new THREE.Float32BufferAttribute(this.tan, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

export class Groomer {
  R: number;
  r: () => number;
  m = new StrandMesh();
  cards = new CardMesh();
  band: Prim[] = [];
  /** thickness of the scalp layer (strands start just above it) */
  cap: number;
  browY: number;
  constructor(public h: HeadShape, public p: HairP, public seed: number, public hatOn: boolean) {
    this.R = h.rx;
    this.r = rng(hashStr('groom') + seed * 7919);
    this.cap = 0.045 * this.R;
    this.browY = 0.075 * (h.ry / 0.39);
  }

  // ------------------------------------------------------------------ head & body geometry
  sd(p: V) { return skullDist(this.h, p.x, p.y, p.z); }
  /** point on the scalp in unit direction u */
  scalp(u: V, lift = 0) { return deform(this.h, u.x, u.y, u.z, v3()).addScaledVector(u, lift); }
  /** keep p at least `min` above the head (radial push) */
  keepOff(p: V, min: number) {
    const d = this.sd(p);
    if (d < min) {
      const L = p.length() || 1e-6;
      p.multiplyScalar((L + (min - d)) / L);
    }
  }
  /** neck, shoulders, upper back and chest (approximate, head-local) */
  keepOffBody(p: V, pad: number, preferFront = false) {
    const { h } = this;
    const k = h.rx / 0.35;
    // neck: a cylinder under the jaw
    if (p.y < -h.ry * 0.55 && p.y > -0.62 * k) {
      const cz = -0.03 * k, rr = 0.15 * k + pad;
      const dx = p.x, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d < rr) { const f = rr / Math.max(d, 1e-4); p.x = dx * f; p.z = cz + dz * f; }
    }
    // shoulders / torso: an elliptic cylinder below the shoulder line, sloping shoulders above it
    const shoulderTop = -0.5 * k - 0.16 * k * ((Math.max(0, Math.abs(p.x) - 0.14 * k) / (0.24 * k)) ** 2);
    if (p.y < shoulderTop + pad && Math.abs(p.x) < 0.44 * k) {
      const cz = -0.02 * k, hz = 0.19 * k + pad, hx = 0.42 * k + pad;
      const ex = p.x / hx, ez = (p.z - cz) / hz;
      const e = ex * ex + ez * ez;
      if (e < 1) {
        // drape over the front or the back (whichever side the strand is on)
        const s = preferFront || p.z - cz >= 0 ? 1 : -1;
        p.z = cz + s * hz * Math.sqrt(Math.max(0, 1 - ex * ex));
      }
    }
  }
  /** the face: only fringe strands may fall in front of it, and not below `stopY` */
  faceHalf(y: number) {
    const { h } = this;
    const u = Math.min(1, Math.abs(y) / (h.ry * (y < 0 ? h.chinLow : 1)));
    return h.rx * 0.98 * Math.sqrt(Math.max(0, 1 - u * u)) * (y < 0 ? 1 - 0.25 * u : 1) + 0.02 * this.R;
  }

  // ------------------------------------------------------------------ hairline & fades
  /** unit-sphere height of the hairline at azimuth az */
  lineAt(az: number) {
    const { p } = this;
    // an anatomical hairline, by |azimuth| / π: forehead → temple corners → sideburn in front of
    // the ear → an arc over the ear → behind the ear down to the nape
    const a = Math.abs(az) / Math.PI;
    const lift = p.line * 0.1;
    const K: [number, number][] = [[0, 0.5 + lift], [0.16, 0.47 + lift], [0.27, 0.4 + lift * 1.6], [0.36, 0.12], [0.42, -0.22], [0.46, -0.05], [0.5, 0.13], [0.56, 0.1], [0.62, -0.28], [0.72, -0.56], [0.86, -0.7], [1, -0.74]];
    let y = K[K.length - 1][1];
    for (let i = 1; i < K.length; i++)
      if (a <= K[i][0]) {
        const t = (a - K[i - 1][0]) / (K[i][0] - K[i - 1][0]);
        y = K[i - 1][1] + (K[i][1] - K[i - 1][1]) * t * t * (3 - 2 * t);
        break;
      }
    // temple recesses (unless a fringe covers them) and a gentle widow's-peak dip in the middle
    const temple = p.fringe !== 'none' ? 0 : 0.06 * Math.exp(-(((a - 0.22) / 0.06) ** 2)) * (1 + p.line);
    return y + temple - 0.02 * Math.exp(-((az / 0.15) ** 2));
  }
  /** shaved (faded) at this unit height / azimuth? */
  faded(uy: number, az: number) {
    const f = this.p.fade;
    if (f === 'none') return false;
    if (f === 'buzz') return true;
    const sides = Math.abs(az) > 0.55;
    const lvl = { taper: -0.55, low: -0.3, mid: -0.05, high: 0.2, skin: 0.22, undercut: 0.3, sides: 0.3 }[f];
    return sides && uy < lvl;
  }

  /** 0 at a fade line … 1 a little above it (barber's graduation) */
  fadeBlend(uy: number, az: number) {
    const f = this.p.fade;
    if (f === 'none' || f === 'buzz' || Math.abs(az) < 0.55) return 1;
    const lvl = { taper: -0.55, low: -0.3, mid: -0.05, high: 0.2, skin: 0.22, undercut: 0.3, sides: 0.3 }[f];
    if (f === 'undercut' || f === 'sides') return 1; // a hard disconnected line
    return 0.35 + 0.65 * smooth(lvl, lvl + 0.3, uy);
  }

  // ------------------------------------------------------------------ build
  build(): GroomOut {
    const { p } = this;
    if (p.fade !== 'buzz') {
      if (p.afro > 0) this.afro();
      else if (p.braid === 'cornrows') this.cornrows();
      else if (p.braid === 'box') this.boxBraids();
      else if (p.loc !== 'none') this.locs();
      // tied and braided styles gather their own scalp hair (see ties / gatherTo)
      else if (p.tie === 'none' && p.braid === 'none') {
        this.scalpStrands();
        this.shellCards();
      }
      if (p.tie !== 'none' && p.braid !== 'cornrows') this.ties();
      if (p.braid !== 'none' && p.braid !== 'box' && p.braid !== 'cornrows') this.braids();
    }
    if (p.fade !== 'buzz' && !this.hatOn) this.edges();
    const fade = this.fadeShell(), edge = this.hatOn ? null : this.edgeShell(), part = this.hatOn || p.fade === 'buzz' ? null : this.partShell();
    const shells = [fade, edge, part].filter((g): g is THREE.BufferGeometry => !!g);
    return { strands: this.m.geometry(), cards: this.cards.geometry(), base: this.baseCap(), fade: shells.length > 1 ? mergeGeometries(shells) : shells[0] ?? null, band: this.bandGeo() };
  }

  /**
   * Barbered sides and back (short cuts): the smooth shell gets a dense coat of short combed strand
   * cards lying on it, so it reads as close-cut hair from every angle — never a bare helmet.
   */
  shellCards() {
    const { p, R, r } = this;
    const longest = Math.max(p.top, p.side, p.back);
    const cutShort = longest < 0.75 && p.tex !== 'coily' && p.tex !== 'curly';
    if (!cutShort || this.hatOn) return;
    const N = 700;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const u = v3();
    for (let k = 0; k < N; k++) {
      const y = 1 - (k / (N - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * k;
      u.set(Math.cos(th) * rad, y, Math.sin(th) * rad);
      const az = Math.atan2(u.x, u.z);
      const line = this.lineAt(az);
      const a = Math.abs(az) / Math.PI;
      const frontness = Math.max(0, 1 - a * 2.4) * smooth(0.95, 0.5, u.y);
      if (u.y < line + 0.02 || u.y > 0.62 || frontness > 0.45 || this.faded(u.y, az)) continue;
      const fb = this.fadeBlend(u.y, az);
      if (fb < 0.3) continue;
      const pts = this.grow(u, (0.16 + r() * 0.06) * fb, { fringe: false, layer: 0, liftK: 0.05 });
      // the shell surface here (see baseCap): cap + the barbered shell thickness
      const shellAt = (q: V) => {
        const uy = skullDir(this.h, q.x, q.y, q.z)[1];
        return this.cap + 0.035 * R * smooth(line, line + 0.25, uy) * (1 - smooth(0.35, 0.7, uy));
      };
      for (const q of pts) this.keepOff(q, shellAt(q) - 0.002 * R);
      if (pts.length < 3) continue;
      this.addCards(pts, 0.05 * R * (0.85 + r() * 0.3), 0.25, 0.4, r(), 0, 1);
    }
  }

  /** the scalp layer under the strands (no gaps where the scalp could show) */
  baseCap() {
    const { h, p, R } = this;
    if (p.fade === 'buzz') return null;
    const afro = p.afro;
    // afro volume tapers down to the hairline (no flat 'brim' over the forehead)
    // curls, coils and locs: a fuller, darker layer under them so gaps read as hair, not scalp
    const textured = (p.tex === 'curly' || p.tex === 'coily' || p.loc !== 'none') && afro === 0;
    // short barbered cuts: the sides and back are a full, smooth sculpted mass (a few locks on top of it)
    const cutShort = Math.max(p.top, p.side, p.back) < 0.75 && p.tex !== 'coily' && p.tex !== 'curly' && p.afro === 0 && p.loc === 'none' && p.braid === 'none' && p.tie === 'none';
    const shell = (uy: number, az: number) => (cutShort ? 0.035 * R * smooth(this.lineAt(az), this.lineAt(az) + 0.25, uy) * (1 - smooth(0.35, 0.7, uy)) : 0);
    // tied-back hair: a fuller layer that thins out smoothly to the hairline (no ledge at the nape)
    // the hair layer thins smoothly to ~20 % at the hairline (no raised ledge on the forehead)
    const edgeBand = p.edges === 'clean' ? 0.05 : 0.1;
    const taper = (uy: number, az: number) => 0.2 + 0.8 * smooth(this.lineAt(az), this.lineAt(az) + edgeBand, uy);
    const thick = (uy: number, az = 0) => taper(uy, az) * (shell(uy, az) + this.cap * (p.braid === 'cornrows' ? 0.2 : p.tie !== 'none' || p.braid !== 'none' ? 0.6 + 1.6 * smooth(this.lineAt(az), this.lineAt(az) + 0.3, uy) : textured ? 1 + 1.2 * smooth(this.lineAt(az), this.lineAt(az) + 0.25, uy) : 1)) + (afro > 0 ? afro * R * (0.5 + 0.35 * Math.max(0, uy)) * smooth(this.lineAt(az), this.lineAt(az) + 0.45, uy) : 0);
    const prim: Prim = {
      t: 'fn', c: [0, h.ry * 0.2, -h.rz * 0.05], ext: [R * (1.3 + afro * 0.9), h.ry * (1.3 + afro * 0.9), h.rz * (1.4 + afro * 0.9)], bone: 0, k: 0,
      f: (x, y, z) => {
        const [dx, uy, dz] = skullDir(h, x, y, z), az = Math.atan2(dx, dz);
        let d = skullDist(h, x, y, z) - thick(uy, az);
        if (afro > 0) {
          // a rounder silhouette than the skull: blend toward a sphere over the crown
          const sph = Math.hypot(x, y - h.ry * 0.18, z + h.rz * 0.08) - R * (1.05 + afro * 0.62);
          d = Math.min(d, Math.max(sph + 0.04 * R, (this.lineAt(az) + 0.3 - uy) * h.ry));
          // cloud-like coil clusters over the whole volume
          if (d < 0.1 * R) d += 0.03 * R * wobble(x * 5 / R, y * 5 / R, z * 5 / R) + 0.014 * R * wobble(z * 13 / R, x * 13 / R, y * 13 / R);
        }
        const below = (this.lineAt(az) - uy) * h.ry * 0.9;
        const shaved = this.faded(uy + 0.05, az) ? 0.02 * R : -1;
        const hawk = p.flow === 'hawk' ? (Math.abs(x) - 0.2 * R) : -1;
        // the parting: a narrow groove in the hair layer, so the scalp shows along the part
        const pg = this.partGap(x, y / h.ry, z);
        return Math.max(d, below, shaved, hawk, pg);
      },
    };
    const f = new Field([{ prims: [prim] }], 0.02 * R, 0.06 * R);
    const geo = meshField(f, { cell: (afro > 0 ? 0.01 : 0.008) * (R / 0.35), lipschitz: afro > 0 ? 2 : 1.4, color: () => [afro > 0 ? 0.8 : textured ? 0.5 : cutShort || p.tie !== 'none' || p.braid !== 'none' ? 0.74 : 0.62, afro > 0 ? 0.5 : 0, 0.5] });
    // the scalp layer is shaded like hair combed back and down (the material needs a direction)
    const P = geo.getAttribute('position');
    const tan = new Float32Array(P.count * 3);
    const q = v3(), d = v3();
    for (let i = 0; i < P.count; i++) {
      q.set(P.getX(i), P.getY(i), P.getZ(i)).normalize();
      d.set(0, -0.6, -1).addScaledVector(q, -q.dot(d.set(0, -0.6, -1))).normalize();
      if (!Number.isFinite(d.x)) d.set(0, -1, 0);
      tan.set([d.x, d.y, d.z], i * 3);
    }
    geo.setAttribute('hairT', new THREE.BufferAttribute(tan, 3));
    // uv: around the head (fine strand striations run down the scalp layer, like combed hair) and
    // colour.g = height from the crown to the hairline (darker at the roots, as on the locks)
    const uv = new Float32Array(P.count * 2);
    const C = geo.getAttribute('color');
    for (let i = 0; i < P.count; i++) {
      const [ux, uyy, uz] = skullDir(h, P.getX(i), P.getY(i), P.getZ(i));
      const az = Math.atan2(ux, uz);
      uv[i * 2] = (az / (Math.PI * 2) + 0.5) * 9;
      const line = this.lineAt(az);
      const t = Math.min(1, Math.max(0, (1 - uyy) / Math.max(0.2, 1 - line)));
      uv[i * 2 + 1] = t;
      if (C && afro === 0) C.setY(i, 0.25 + 0.6 * t);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geo;
  }

  /** > 0 inside the parting groove (scalp shows), for the hair layer's SDF; −1 elsewhere */
  partGap(x: number, uyHead: number, z: number) {
    const { h, R, p } = this;
    if (p.part === 'none' || p.afro > 0 || p.braid === 'cornrows' || p.flow === 'hawk') return -1;
    const px = this.partX(z);
    if (Number.isNaN(px) || uyHead < 0.3) return -1;
    // widest at the front hairline, closing toward the crown (the part ends naturally)
    const gap = 0.016 * R * smooth(-0.35, -0.1, z / h.rz);
    if (gap <= 1e-5) return -1;
    return gap - Math.abs(x - px);
  }
  /** a root inside the parting (no locks grow there) */
  inPart(u: V, halfW: number) {
    const { p, R, h } = this;
    if (p.part === 'none') return false;
    const az = Math.atan2(u.x, u.z);
    if (!(u.y > this.lineAt(az) + 0.02 && u.y > 0.3 && u.z > -0.3)) return false;
    const px = this.partX(u.z * h.rz);
    if (Number.isNaN(px)) return false;
    return Math.abs(u.x * h.rx - px) < halfW * R;
  }

  /**
   * Hairline density shell: fine hair-coloured stubble in a thin band below and at the hairline,
   * densest at the hairline and fading out onto the skin — the hair grows out of the skin instead of
   * stopping at an edge. Rendered with the clipper-stubble material (density = colour.r).
   */
  edgeShell() {
    const { h, p, R } = this;
    if (p.fade === 'buzz') return null;
    const [w, maxDens] = p.edges === 'clean' ? [0.025, 0.9] : p.edges === 'laid' ? [0.05, 0.8] : [0.06, 0.7];
    const f = new Field([{ prims: [{ t: 'fn', c: [0, 0, 0], ext: [R * 1.2, h.ry * 1.2, h.rz * 1.3], bone: 0, k: 0, f: (x, y, z) => {
      const [dx, uy, dz] = skullDir(h, x, y, z), az = Math.atan2(dx, dz);
      const line = this.lineAt(az);
      const skip = this.faded(uy, az) || (p.flow === 'hawk' && Math.abs(x) > 0.2 * R);
      return Math.max(skullDist(h, x, y, z) - 0.004 * R, (line - w - uy) * h.ry, (uy - line - 0.03) * h.ry, skip ? 1 : -1);
    } }] }], 0.02 * R, 0.1 * R);
    return meshField(f, { cell: 0.008 * (R / 0.35), color: (x, y, z) => {
      const [dx, uy, dz] = skullDir(h, x, y, z), az = Math.atan2(dx, dz);
      const line = this.lineAt(az);
      return [smooth(line - w, line, uy) * maxDens, 0, 0];
    } });
  }

  /** a faint strip of fine hair along the parting, so it reads as scalp between hair, not a bare stripe */
  partShell() {
    const { h, R } = this;
    if (this.partGap(0, 0.5, 0) === -1 && this.partGap(this.partX(0), 0.5, 0) === -1) return null;
    const f = new Field([{ prims: [{ t: 'fn', c: [0, 0, 0], ext: [R * 1.2, h.ry * 1.2, h.rz * 1.3], bone: 0, k: 0, f: (x, y, z) => {
      const g = this.partGap(x, y / h.ry, z);
      const [dx, uy, dz] = skullDir(h, x, y, z);
      return Math.max(skullDist(h, x, y, z) - 0.003 * R, g === -1 ? 1 : -g - 0.002 * R, (this.lineAt(Math.atan2(dx, dz)) + 0.01 - uy) * h.ry);
    } }] }], 0.02 * R, 0.1 * R);
    return meshField(f, { cell: 0.006 * (R / 0.35), color: () => [0.3, 0, 0] });
  }

  /** unit scalp direction from azimuth + unit height */
  dirAt(az: number, uy: number) {
    const rad = Math.sqrt(Math.max(0, 1 - uy * uy));
    return v3(Math.sin(az) * rad, uy, Math.cos(az) * rad);
  }

  /**
   * The hairline edges (sumanova-us-107): fine baby hairs (soft), sleek gelled swoops (laid) or
   * nothing (clean, a crisp line-up). Curly / coily / afro hair gets a row of tiny baby curls.
   */
  edges() {
    const { p, R, r } = this;
    if (p.edges === 'clean') return;
    const curlyKind = p.tex === 'coily' || p.tex === 'curly' || p.afro > 0;
    if (p.edges === 'soft') {
      if (p.braid === 'cornrows') return;
      if (curlyKind) {
        const coily = p.tex === 'coily' || p.afro > 0;
        for (let az = -1.15; az <= 1.15; az += coily ? 0.07 : 0.09) {
          const uy = this.lineAt(az) + 0.035 + r() * 0.03;
          const u = this.dirAt(az, uy);
          if (this.faded(u.y, az)) continue;
          let pts = this.grow(u, 0.16 + r() * 0.08, { fringe: false, layer: 0.9, liftK: 0.6 });
          pts = this.texture(this.resample(pts, 0.01 * R), r() * 6, coily ? 'coily' : 'curly', 1);
          this.emit(pts, R * (coily ? 0.045 : 0.06) * p.clump, { flat: 0.95, tip: 0.5, radial: 5, cards: false });
        }
        return;
      }
      // fine, flat baby hairs along the forehead and temples
      // drawn on the skin: each starts just inside the hairline and lies down onto the forehead /
      // temple, curving a little to one side (never into the sideburns or onto the brows)
      for (let az = -1.05; az <= 1.05; az += 0.045 + r() * 0.02) {
        const line = this.lineAt(az);
        if (this.faded(line, az)) continue;
        const len = 0.02 + r() * 0.03, bend = (r() - 0.5) * 0.08 + Math.sign(az) * 0.03;
        const pts: V[] = [];
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          const q = this.scalp(this.dirAt(az + bend * t * t, line + 0.012 - len * t), this.cap * 0.12 + 0.003 * R);
          pts.push(q);
        }
        if (pts.some((q) => q.y < this.browY + 0.04 * R)) continue;
        this.emit(pts, 0.016 * R, { flat: 0.45, tip: 0.05, radial: 4, cards: false, shade: 1.05 });
      }
      return;
    }
    // laid: sleek S-wave swoops of gelled baby hair, drawn directly on the skin at the temples and
    // forehead corners (+ a small one in the centre)
    const roots = [0.3, 0.5, 0.7, 0.9, 1.1];
    const swoops: [number, number][] = [[0, 1]];
    for (const a of roots) swoops.push([a, 1], [-a, -1]);
    for (const [az0, side] of swoops) {
      // one broad, flat gelled ribbon + two fine strands along its edges (fine strands alone are
      // thinner than a pixel at avatar sizes)
      const strands = 3;
      const amp = az0 === 0 ? 0.6 : 1;
      for (let k = 0; k < strands; k++) {
        const pts: V[] = [];
        const off = (k - 1) * 0.012 * R;
        for (let i = 0; i <= 14; i++) {
          const t = i / 14;
          const az = az0 + side * 0.16 * t * (az0 === 0 ? 0.6 : 1);
          const uy = this.lineAt(az0) + 0.01 - 0.05 * amp * Math.sin(0.9 * Math.PI * t) + 0.02 * t * t;
          const q = this.scalp(this.dirAt(az, uy), this.cap * 0.15 + 0.004 * R);
          q.y += off;
          pts.push(q);
        }
        // never onto the brows, eyes or ears
        if (pts.some((q) => q.y < this.browY + 0.03 * R)) continue;
        this.emit(pts, k === 1 ? 0.03 * R : 0.012 * R, { flat: k === 1 ? 0.22 : 0.5, tip: 0.1, radial: k === 1 ? 6 : 4, cards: false, shade: 1.08 });
      }
    }
  }

  /** short stubble shell over shaved / faded areas */
  fadeShell() {
    const { h, p, R } = this;
    if (p.fade === 'none' && p.flow !== 'hawk') return null;
    const f = new Field([{ prims: [{ t: 'fn', c: [0, 0, 0], ext: [R * 1.2, h.ry * 1.2, h.rz * 1.3], bone: 0, k: 0, f: (x, y, z) => {
      const [dx, uy, dz] = skullDir(h, x, y, z), az = Math.atan2(dx, dz);
      const shaved = this.faded(uy, az) || (p.flow === 'hawk' && Math.abs(x) > 0.2 * R);
      return Math.max(skullDist(h, x, y, z) - 0.005 * R, (this.lineAt(az) - 0.02 - uy) * h.ry, shaved ? -1 : 1);
    } }] }], 0.02 * R, 0.1 * R);
    const lvl = { none: 0, taper: -0.55, low: -0.3, mid: -0.05, high: 0.2, skin: 0.22, undercut: 0.3, sides: 0.3, buzz: 1 }[p.fade];
    return meshField(f, { cell: 0.009 * (R / 0.35), color: (x, y, z) => {
      const uy = skullDir(h, x, y, z)[1];
      // density: full stubble near the hair, fading to skin at the bottom (skin fades go all the way)
      const dens = p.fade === 'buzz' ? 0.85 : p.fade === 'undercut' || p.fade === 'sides' ? 0.6 : smooth(lvl - (p.fade === 'skin' ? 0.35 : 0.6), lvl, uy);
      return [dens, 0, 0];
    } });
  }

  bandGeo() {
    if (!this.band.length) return null;
    return meshField(new Field([{ prims: this.band }], 0.01, 0.05), { cell: 0.004 * (this.R / 0.35) });
  }

  // ------------------------------------------------------------------ comb field
  /** where the part line sits (x, head-local); NaN = no part */
  partX(z: number) {
    const { p, R } = this;
    switch (p.part) {
      case 'left': return 0.42 * R;
      case 'right': return -0.42 * R;
      case 'middle': return 0;
      case 'zigzag': return 0.07 * R * Math.sign(Math.sin(z / (0.09 * R)));
      default: return NaN;
    }
  }

  /** initial comb direction at a root (unit dir u on the scalp) */
  comb(u: V, root: V, fringe: boolean, out: V) {
    const { p, r } = this;
    const proj = (v: V) => v.addScaledVector(u, -v.dot(u)).normalize();
    const px = this.partX(root.z);
    const away = Number.isNaN(px) ? Math.sign(root.x || 1) : Math.sign(root.x - px || 1);
    if (fringe) {
      switch (p.fringe) {
        case 'curtain': out.set(away * 0.75, -1, 0.35); break;
        case 'side': out.set(p.part === 'right' ? 1 : -1, -0.65, 0.3); break;
        default: out.set((r() - 0.5) * 0.2, -1, 0.45);
      }
      return proj(out);
    }
    const front = smooth(0.1, 0.75, u.z);
    switch (p.flow) {
      case 'back': out.set(0, 0.15, -1); break;
      case 'forward': out.set(0, -0.2, 1).lerp(v3(0, -1, -0.2), smooth(0.2, -0.6, u.z)); break;
      // quiff: the front sweeps up and back; everything behind the hairline is combed straight back
      case 'up': out.set(0, 1, -0.55).lerp(v3(0, 0.05, -1), smooth(0.62, 0.3, u.z)); break;
      case 'side': {
        const sweep = p.part === 'right' ? 1 : -1;
        // the small side of the part falls away from it (otherwise the sweep buries the part)
        if (!Number.isNaN(px) && Math.sign(root.x - px) === -sweep && u.y > 0.2) out.set(away * 0.9, -0.5, 0.1);
        else out.set(sweep, -0.25, 0.1).lerp(v3(away, -0.8, -0.3), smooth(-0.1, -0.6, u.z));
        break;
      }
      case 'out': out.copy(u).multiplyScalar(1.5).add(v3(0, 0.6, -0.2)); break;
      case 'hawk': out.set(-root.x * 2, 1.2, -0.15); break;
      case 'messy': out.set((r() - 0.5) * 2, -0.3 + r() * 0.6, 0.6 + (r() - 0.5)); break;
      default: {
        // natural fall: away from the part over the crown, down the sides and back
        if (Number.isNaN(px)) {
          // no part: radiate from the crown whorl
          const crown = v3(0, 0.85, -0.45).normalize();
          out.copy(u).sub(crown).addScaledVector(UP, -0.3);
          // a gentle whorl around the crown (direction per avatar), no bald spot
          const ang = Math.acos(Math.max(-1, Math.min(1, u.dot(crown))));
          out.addScaledVector(v3().crossVectors(crown, u), 0.6 * (this.seed % 2 ? -1 : 1) * Math.exp(-((ang / 0.35) ** 2)));
          if (out.lengthSq() < 1e-4) out.set(0, 0, -1);
        } else out.set(away * (0.85 - 0.5 * (1 - front)), -0.55, -0.4 - 0.15 * front);
      }
    }
    if (p.messy > 0) out.add(v3((r() - 0.5) * 1.6, (r() - 0.5), (r() - 0.5) * 1.6).multiplyScalar(p.messy));
    return proj(out);
  }

  // ------------------------------------------------------------------ strand growth
  /**
   * Grow one clump from scalp direction u. Returns the polyline (before texture displacement).
   * `lenR` is the strand length in head radii.
   */
  grow(u: V, lenR: number, o: { fringe: boolean; layer: number; target?: V; liftK?: number; front?: boolean }) {
    const { h, p, R } = this;
    const L = lenR * R;
    const root = this.scalp(u, this.cap * 0.4);
    const d = this.comb(u, root, o.fringe, v3());
    const n = Math.max(4, Math.min(26, Math.round(L / (0.06 * R)) + 3));
    const ds = L / (n - 1);
    const pts: V[] = [root.clone()];
    const cur = root.clone();
    // volume: strands rise off the head as they go — crown layers sit over the lower ones
    const lift = (0.05 + p.vol * 0.1) * R * (o.liftK ?? 1);
    const hug = (s: number) => this.cap + 0.004 * R + lift * Math.min(1, s / (0.5 * R)) + o.layer * 0.012 * R;
    const longHair = L > 0.9 * R;
    const fringeStop = this.browY + (p.fringe === 'curtain' || p.fringe === 'side' ? -0.02 : 0.015) * (R / 0.35);
    const nrm = v3(), tmp = v3();
    for (let i = 1; i < n; i++) {
      const s = i * ds;
      nrm.copy(cur).normalize();
      if (o.target) {
        // gathered toward a tie: follow the scalp straight to it
        tmp.subVectors(o.target, cur);
        if (tmp.length() < ds * 1.2) { pts.push(o.target.clone()); break; }
        d.lerp(tmp.normalize(), 0.45);
      } else {
        // on the head the strand follows the surface (with a little lift); off it, gravity wins
        const onHead = this.sd(cur) < hug(s) + 0.05 * R;
        const g = (longHair ? 0.12 : 0.05) * (p.flow === 'up' || p.flow === 'out' || p.flow === 'hawk' ? 0.25 : 1) * (onHead ? 0.6 : 1.6) * (p.tex === 'coily' ? 0.3 : 1);
        d.y -= g * (ds / (0.05 * R));
        if (p.flow === 'up' || p.flow === 'hawk') {
          // quiffs / hawks: lift at the front, roll back over the top
          const rise = (p.lift + 0.3) * smooth(0.5, 0, s / L);
          d.addScaledVector(nrm, rise * (p.flow === 'hawk' ? 0.25 : 0.16));
          // quiffs curl back over the top as they grow (a rolled wave, not upright spikes)
          if (p.flow === 'up') d.addScaledVector(v3(0, -0.1, -1), 0.22 * smooth(0.15, 0.6, s / L));
        }
        if (p.flow === 'out') d.addScaledVector(nrm, 0.08);
      }
      d.normalize();
      cur.addScaledVector(d, ds);
      if (!o.target) {
        this.keepOff(cur, hug(s));
        // keep strands off the face: fringe stops above the brows, the rest frames the face
        const azc = Math.atan2(cur.x, cur.z);
        const faceAz = 0.82; // the face spans about ±47° around the front
        if (cur.y < this.browY + 0.05 * R && cur.y > -h.ry * 1.05 && Math.abs(azc) < faceAz && cur.z > 0) {
          if (o.fringe) {
            const inside = Math.abs(cur.x) < 0.55 * h.rx;
            if (cur.y < fringeStop && (inside || cur.y < -0.1 * h.ry)) { pts.push(cur.clone()); break; }
          } else {
            // slide round the head to the edge of the face (same distance from the axis)
            const rr = Math.hypot(cur.x, cur.z), sa = Math.sign(azc || u.x || 1) * faceAz;
            cur.x = Math.sin(sa) * rr;
            cur.z = Math.cos(sa) * rr;
            d.y -= 0.5;
            d.addScaledVector(v3(Math.sin(sa), 0, Math.cos(sa)), -Math.max(0, d.x * Math.sin(sa) + d.z * Math.cos(sa)));
            d.normalize();
          }
        }
        // under the jaw, in front of the ears: stop the lock (it would crumple between jaw and neck)
        if (cur.y < -h.ry * 0.55 && cur.z > -0.05 * h.rz && Math.hypot(cur.x, cur.z) < h.rx * 1.05) {
          // front locks of long hair hang just outside the jaw line instead of stopping there
          if (o.front && cur.y > -h.ry * 1.1) {
            const rr = Math.hypot(cur.x, cur.z) || 1e-4, f = (h.rx * 1.06) / rr;
            cur.x *= f;
            cur.z *= f;
          } else if (!o.front) { pts.push(cur.clone()); break; }
        }
        // front side locks of long hair drape forward over the shoulders onto the chest
        // (the comb sends hair back; past the cheek these locks are turned forward instead)
        if (o.front && cur.y < -h.ry * 0.2) {
          d.z = Math.max(d.z, 0.22);
          d.normalize();
        }
        this.keepOffBody(cur, 0.02 * R + o.layer * 0.008 * R, o.front);
      } else this.keepOff(cur, this.cap * (this.p.braid === 'cornrows' ? 1 : 2.1) + 0.002 * R); // on top of the (thicker) tied-back layer
      pts.push(cur.clone());
    }
    return pts;
  }

  /** waves / curls / coils / texture displaced around the grown path */
  texture(pts: V[], phase: number, tex = this.p.tex, amount = this.p.curl) {
    const { R } = this;
    if (pts.length < 3) return pts;
    const out: V[] = [];
    const T = v3(), N = v3(), B = v3();
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i) s += pts[i].distanceTo(pts[i - 1]);
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      T.subVectors(b, a).normalize();
      N.copy(pts[i]).normalize().addScaledVector(T, -N.dot(T)).normalize();
      B.crossVectors(T, N).normalize();
      const ramp = smooth(0, 0.12 * R, s);
      const q = pts[i].clone();
      // waves and curls follow the height on the head (not the distance along each lock), so
      // neighbouring locks wave together and the outside reads as one smooth, rippled mass
      const yy = -pts[i].y;
      if (tex === 'wavy') {
        q.addScaledVector(B, Math.sin(yy / (0.075 * R) + phase) * 0.045 * R * amount * ramp);
      } else if (tex === 'curly') {
        const th = yy / ((0.05 - 0.02 * amount) * R) + phase, A = (0.035 + 0.035 * amount) * R * ramp;
        q.addScaledVector(B, Math.cos(th) * A).addScaledVector(N, Math.sin(th) * A * 0.8);
      } else if (tex === 'coily') {
        const th = s / ((0.02 - 0.008 * amount) * R) + phase, A = (0.022 + 0.012 * amount) * R * smooth(0, 0.04 * R, s);
        q.addScaledVector(B, Math.cos(th) * A).addScaledVector(N, Math.sin(th) * A);
      } else if (tex === 'textured') {
        q.addScaledVector(B, Math.sin(s / (0.11 * R) + phase) * 0.018 * R * ramp).addScaledVector(N, Math.sin(s / (0.07 * R) + phase * 1.7) * 0.01 * R * ramp);
      }
      out.push(q);
    }
    // coils/curls need more points along the path to stay round
    return out;
  }

  /** resample a polyline to roughly `step` spacing (curls need dense points) */
  resample(pts: V[], step: number) {
    if (pts.length < 2) return pts;
    if (pts.length === 2) pts = [pts[0], pts[0].clone().lerp(pts[1], 0.5), pts[1]];
    const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const L = c.getLength();
    const n = Math.max(3, Math.min(160, Math.ceil(L / step) + 1));
    return c.getSpacedPoints(n - 1);
  }

  /** emit a hair clump along a grown path */
  emit(pts: V[], w0: number, o: { flat?: number; tip?: number; rand?: number; radial?: number; shade?: number; tStart?: number; tEnd?: number; /** strand cards on this lock (default: main locks) */ cards?: boolean; /** 0 … 1: thin root (locks at the hairline) */ rootThin?: number }) {
    const { R } = this;
    const rand = o.rand ?? this.r();
    const flat = o.flat ?? 0.34;
    const tipK = o.tip ?? 0.2; // width left at the tip (0 = pointed)
    this.m.add(pts, {
      // a sculpted lock: full through the body, swelling a little, tapering to a point
      // locks rooted at the hairline start thin and fill out along their length (a soft edge
      // instead of a full-width lock overhanging the forehead)
      wAt: (t) => w0 * (1.15 - 0.15 * smooth(0, 0.35, t)) * (1 - (1 - tipK) * Math.pow(smooth(0.25, 1, t), 1.3)) * (1 - (o.rootThin ?? 0) * 0.75 * (1 - smooth(0, 0.35, t))),
      flat,
      radial: o.radial ?? 4,
      // below the head centre locks face outward horizontally (no twisting under the jaw)
      out: (q, out) => out.set(q.x, q.y > 0 ? q.y : q.y * 0.15, q.z).normalize(),
      shadeAt: (t, q) => Math.min(1, (o.shade ?? 1) * (0.62 + 0.38 * smooth(this.cap, this.cap + 0.05 * R, this.sd(q)) * (0.85 + 0.15 * t))),
      rand: rand,
      tStart: o.tStart,
      tEnd: o.tEnd,
    });
    // fine strand cards on the lock's outer face (main locks only; sub-locks / flyaways are already fine)
    if (o.cards !== false && this.p.tex !== 'coily' && w0 > 0.03 * R && pts.length >= 3) this.addCards(pts, w0, flat, tipK, rand, o.tStart ?? 0, o.tEnd ?? 1, o.rootThin ?? 0);
  }

  /** two strand cards along the outer face of a lock, running a little past its tip; sometimes a flyaway */
  addCards(all: V[], w0: number, flat: number, tipK: number, rand: number, t0: number, t1: number, rootThin = 0) {
    const { R, r } = this;
    // a thin strip needs far fewer segments than the lock under it (≤ 12 points)
    const stride = Math.max(1, Math.ceil(all.length / 12));
    const pts = all.filter((_, i) => i % stride === 0 || i === all.length - 1);
    const n = pts.length;
    const wAt = (t: number) => w0 * (1.15 - 0.15 * smooth(0, 0.35, t)) * (1 - (1 - tipK) * Math.pow(smooth(0.25, 1, t), 1.3)) * (1 - rootThin * 0.75 * (1 - smooth(0, 0.35, t)));
    const T = v3(), N = v3(), B = v3();
    const frames: { T: V; N: V; B: V; w: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      T.subVectors(b, a);
      if (T.lengthSq() < 1e-12) T.set(0, -1, 0);
      T.normalize();
      const q = pts[i];
      N.set(q.x, q.y > 0 ? q.y : q.y * 0.15, q.z).normalize();
      N.addScaledVector(T, -N.dot(T));
      if (N.lengthSq() < 1e-8) N.set(T.y, -T.x, 0.3);
      N.normalize();
      B.crossVectors(T, N).normalize();
      frames.push({ T: T.clone(), N: N.clone(), B: B.clone(), w: Math.max(1e-4, wAt(i / (n - 1))) });
    }
    // run the cards a little past the tip: the ends of the hair break up into fine strands
    const ext = pts[n - 1].clone().addScaledVector(frames[n - 1].T, pts[n - 1].distanceTo(pts[0]) * 0.06);
    const path = [...pts, ext];
    const fr = [...frames, { ...frames[n - 1], w: frames[n - 1].w * 0.6 }];
    const m = path.length;
    for (const side of [-0.45, 0.45]) {
      const c: V[] = [], acr: V[] = [], nr: V[] = [], tn: V[] = [], sh: number[] = [];
      for (let i = 0; i < m; i++) {
        const f = fr[i];
        // on the outer face (just above the lock's flattened surface), toward one edge
        const lift = f.w * flat * 0.96 + 0.0025 * R;
        c.push(path[i].clone().addScaledVector(f.B, side * f.w * 0.9).addScaledVector(f.N, lift * Math.sqrt(1 - side * side)));
        acr.push(f.B.clone().multiplyScalar(f.w * 0.5));
        nr.push(f.N);
        tn.push(f.T);
        sh.push(1);
      }
      this.cards.strip(c, acr, nr, tn, sh, t0, Math.min(1.06, t1 + 0.06), (rand + (side > 0 ? 0.37 : 0.71)) % 1);
    }
    // a loose flyaway off the silhouette on some locks (outer half only, never over the face)
    if (r() < 0.16 + this.p.messy * 0.2 && pts[0].z < 0.4 * R) {
      const c: V[] = [], acr: V[] = [], nr: V[] = [], tn: V[] = [], sh: number[] = [];
      const start = Math.floor(m * 0.35);
      const drift = (r() - 0.5) * 2;
      for (let i = start; i < m; i++) {
        const f = fr[i], k = (i - start) / Math.max(1, m - 1 - start);
        c.push(path[i].clone().addScaledVector(f.N, f.w * flat + 0.004 * R + k * k * 0.05 * R).addScaledVector(f.B, drift * k * f.w));
        acr.push(f.B.clone().multiplyScalar(f.w * 0.35 * (1 - 0.5 * k)));
        nr.push(f.N);
        tn.push(f.T);
        sh.push(1);
      }
      if (c.length >= 3) this.cards.strip(c, acr, nr, tn, sh, 0.35, 1.04, (rand + 0.13) % 1);
    }
  }

  // ------------------------------------------------------------------ styles
  /** loose hair grown from the whole scalp (the majority of styles) */
  scalpStrands(only?: (u: V, uy: number, az: number) => boolean) {
    const { p, R, h, r } = this;
    const coily = p.tex === 'coily', curly = p.tex === 'curly';
    const longest = Math.max(p.top, p.side, p.back);
    // density: finer clumps for short / coily hair, broader for long straight hair
    // long coils / curls: fewer, chunkier clumps keep the mesh light
    // few, broad sculpted locks (a stylised groom), not hundreds of thin strands
    const N = Math.round((coily ? (longest > 0.8 ? 150 : 260) : curly ? (longest > 0.8 ? 150 : 190) : longest > 1 ? 150 : longest < 0.5 ? 170 : 215) * (this.hatOn ? 0.6 : 1));
    const golden = Math.PI * (3 - Math.sqrt(5));
    const u = v3();
    for (let k = 0; k < N * 2.2; k++) {
      const y = 1 - (k / (N * 2.2 - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * k + (r() - 0.5) * 0.35;
      u.set(Math.cos(th) * rad, y, Math.sin(th) * rad);
      const az = Math.atan2(u.x, u.z);
      const line = this.lineAt(az);
      if (u.y < line || this.faded(u.y, az)) continue;
      if (p.flow === 'hawk' && Math.abs(u.x) > 0.2) continue;
      if (this.hatOn && u.y > 0.35) continue;
      if (only && !only(u, u.y, az)) continue;
      if (this.inPart(u, 0.06)) continue;
      // regions: front (fringe zone), sides, back, crown
      const a = Math.abs(az) / Math.PI;
      const frontness = Math.max(0, 1 - a * 2.4) * smooth(0.95, 0.5, u.y);
      const sideness = Math.sin(Math.PI * a) * smooth(0.75, 0.0, u.y);
      const backness = smooth(0.35, 0.9, a) * smooth(0.9, 0.2, u.y);
      let L = p.top * (1 - Math.max(sideness, backness)) + p.side * sideness + p.back * backness;
      L = Math.max(L, Math.min(p.side, p.back) * smooth(0.5, -0.2, u.y));
      // long hair is long from the crown too (only layers / fringes are shorter)
      if (p.side > 1) L = Math.max(L, Math.min(p.side, p.back) * 0.9);
      // fringe band: the front strands just above the hairline
      const fringe = p.fringe !== 'none' && frontness > 0.35 && u.y < line + 0.32 && Math.abs(u.x) < 0.75;
      // medium cuts: sides and back fall to the chin / neck (head radii are short on a stylised head)
      if (longest >= 0.45 && longest <= 1.05 && !coily && !curly) L *= 1 + 0.4 * Math.max(sideness, backness);
      if (fringe) L = p.fringeLen * (p.fringe === 'wispy' ? 0.75 + r() * 0.45 : 0.9 + r() * 0.2);
      if (p.asym) L *= 1 + p.asym * 0.45 * Math.max(-1, Math.min(1, u.x * 2.5));
      L *= 1 - p.layers * 0.45 * r() * smooth(-0.2, 0.6, u.y);
      L *= 0.93 + r() * 0.14;
      if (this.hatOn) L = Math.min(L, Math.max(p.side, 0.2));
      // short cuts: locks overlap like feathers (longer than they are wide), sweeping one way
      // short cuts: the top gets long sweeping locks (sculpted clumps); sides and back stay short
      // and tight to the head, like a real barbered cut
      const topZone = u.y > 0.42 || frontness > 0.5;
      const cutShort = longest < 0.75 && p.tex !== 'coily' && p.tex !== 'curly';
      if (L < 0.5 && !fringe) L = cutShort && !topZone ? Math.min(L, 0.2) + 0.08 : L * 1.5 + 0.1;
      // graduated into a fade: strands shorten toward the shaved line
      L *= this.fadeBlend(u.y, az);
      if (L < 0.05) continue;
      const layer = smooth(line, 1, u.y); // crown strands lie on top
      // combed short cuts lie flat on the head (lift only for quiffs / spikes / messy styles)
      const standUp = p.flow === 'up' || p.flow === 'out' || p.flow === 'hawk' || p.flow === 'messy';
      const shortCut = L < 0.75 && !standUp && !coily && !curly;
      const tight = cutShort && !topZone;
      // the smooth shell carries the sides; only every third lock is drawn there (combed texture)
      if (tight && r() < 0.25) continue;
      // about half of the hair in front of the ears falls forward over the shoulders (long styles)
      const front = L > 1.0 && !fringe && u.z > -0.05 && Math.abs(u.x) > 0.45 && r() < 0.6;
      let pts = this.grow(u, front ? L * 1.3 : L, { fringe, layer, liftK: tight ? 0.08 : shortCut ? 0.3 : 1, front });
      // barbered sides / back: the short locks lie ON the smooth shell (not inside it), so the back of
      // the head shows combed hair texture instead of a bare helmet
      if (tight) for (let i = 1; i < pts.length; i++) this.keepOff(pts[i], this.cap + 0.03 * R * smooth(line, line + 0.25, skullDir(this.h, pts[i].x, pts[i].y, pts[i].z)[1]));
      // roots by the hairline rise out of the scalp layer (no stepped edge)
      if (!fringe) this.bury(pts, u);
      const step = coily ? 0.012 * R : curly ? 0.02 * R : 0.04 * R;
      // long waves / curls: neighbouring locks nearly in phase (one coherent ripple); short: varied
      const coherent = longest > 0.8 && (p.tex === 'wavy' || curly);
      if (p.tex !== 'straight') pts = this.texture(this.resample(pts, step), coherent ? r() * 0.9 : r() * Math.PI * 2);
      const short = L < 0.45;
      // medium cuts (jaw to shoulder): full, chunky locks — not thin tails
      const medium = longest >= 0.45 && longest <= 1.05 && !coily && !curly;
      const w0 = R * p.clump * (coily ? (longest > 0.8 ? 0.11 : 0.085) : curly ? (longest > 0.8 ? 0.2 : 0.14) : p.fringe === 'wispy' && fringe ? 0.13 : tight ? 0.16 : cutShort ? 0.3 : medium && !fringe ? 0.38 : short ? 0.22 : 0.3) * (0.85 + r() * 0.3);
      // quiffs / pompadours: one smooth rolled wave of broad locks (not flame-like spikes)
      const roll = p.flow === 'up' && p.tips < 0.7;
      const tip = p.fringe === 'straight' && fringe ? 0.4 : roll ? 0.55 : tight ? 0.5 : medium && !fringe ? Math.max(0.14, 0.3 - 0.2 * p.tips) : shortCut ? 0.32 - 0.15 * p.tips : Math.max(0.03, 0.3 - 0.3 * p.tips);
      // locks next to the hairline or the parting start thin, so the edge and the part stay visible
      const edgeK = fringe ? 0 : Math.max(smooth(line + 0.14, line + 0.02, u.y) * (p.edges === 'clean' ? 0.7 : 1), this.inPart(u, 0.16) ? 0.85 : 0);
      this.emit(pts, w0, { flat: coily ? 0.95 : curly ? 0.75 : short ? 0.3 : medium ? 0.55 : 0.42 + p.tips * 0.1, tip, radial: coily ? 5 : 7, rootThin: edgeK });
      // detail: finer locks riding on top of the main one and fanning apart toward the tips
      // (piecey, separated ends and layered depth — the sculpted-groom look)
      if (!coily && !tight) this.subLocks(pts, roll ? w0 * 1.2 : w0, { n: curly ? (longest > 0.8 ? 0 : 1) : roll ? 1 : shortCut ? 1 : short ? 2 : 3, flat: curly ? 0.75 : 0.5, spread: shortCut ? 0.3 : short ? 0.55 : 0.8 });
      // fly-aways: a few fine single strands lifting off the surface
      if (!coily && u.z < 0.3 && r() < 0.035 + p.messy * 0.05 && L > 0.2) {
        const fp = this.texture(this.resample(this.grow(u, L * (1 + r() * 0.15), { fringe, layer: layer + 0.6, liftK: 1.5 }), 0.03 * R), r() * 6, 'textured', 1);
        this.emit(fp, 0.006 * R, { flat: 1, tip: 0.3, radial: 3, shade: 1.05 });
      }
    }
    void h;
  }

  /**
   * Finer locks following a main lock: each starts part-way along it, sits a little above it,
   * drifts sideways (more toward the tip, so the ends fan apart) and ends in a sharp point.
   */
  subLocks(pts: V[], w0: number, o: { n: number; flat: number; spread: number }) {
    const { r } = this;
    if (pts.length < 4) return;
    const T = v3(), N = v3(), B = v3();
    for (let k = 0; k < o.n; k++) {
      const side = (k % 2 ? 1 : -1) * (0.35 + r() * 0.45);
      const start = Math.floor((pts.length - 1) * (0.05 + r() * 0.3));
      const endT = 0.72 + r() * 0.36; // some end before, some run past the main tip
      const out: V[] = [];
      const n = pts.length;
      for (let i = start; i < n; i++) {
        const t = (i - start) / Math.max(1, n - 1 - start);
        if (t > endT) break;
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        T.subVectors(b, a).normalize();
        N.copy(pts[i]).normalize().addScaledVector(T, -N.dot(T)).normalize();
        B.crossVectors(T, N).normalize();
        const fan = side * w0 * (0.45 + o.spread * t * t);
        out.push(pts[i].clone().addScaledVector(B, fan).addScaledVector(N, w0 * (0.12 + 0.1 * Math.sin(Math.PI * t))));
      }
      if (out.length < 3) continue;
      this.emit(out, w0 * (0.32 + r() * 0.14), { flat: o.flat, tip: 0.02, radial: 5, shade: 1.06, tStart: (start / (n - 1)), tEnd: Math.min(1, start / (n - 1) + endT * (1 - start / (n - 1))) });
    }
  }

  /** big round afro: a sculpted volume covered in small coils */
  afro() {
    const { p, R, h, r } = this;
    const N = 1500;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const u = v3();
    for (let k = 0; k < N; k++) {
      const y = 1 - (k / (N - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * k;
      u.set(Math.cos(th) * rad, y, Math.sin(th) * rad);
      const az = Math.atan2(u.x, u.z);
      if (u.y < this.lineAt(az) - 0.03) continue;
      // root on the outer surface of the volume (same shape as the base cap)
      const thick = p.afro * R * (0.5 + 0.35 * Math.max(0, u.y)) * smooth(this.lineAt(az), this.lineAt(az) + 0.45, u.y);
      const onHead = this.scalp(u, this.cap + thick);
      const sph = v3(0, h.ry * 0.18, -h.rz * 0.08).addScaledVector(u, R * (1.05 + p.afro * 0.62) - 0.04 * R);
      const useSph = u.y > this.lineAt(az) + 0.3 && sph.length() > onHead.length();
      const root = (useSph ? sph : onHead).addScaledVector(u, -0.05 * R);
      const pts: V[] = [];
      const L = (0.07 + 0.05 * r()) * R;
      const dir = u.clone().add(v3((r() - 0.5) * 0.6, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6)).normalize();
      for (let i = 0; i < 6; i++) pts.push(root.clone().addScaledVector(dir, (L * i) / 5));
      this.emit(this.texture(this.resample(pts, 0.012 * R), r() * 6, 'coily', 1), 0.045 * R, { flat: 1, tip: 0.8, radial: 4, shade: 1.1, cards: false });
    }
    // defined coil clusters: bigger springy tufts over the surface, catching light on their tops
    const M = 150;
    for (let k = 0; k < M; k++) {
      const y = 1 - (k / (M - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      u.set(Math.cos(golden * k * 1.7) * rad, y, Math.sin(golden * k * 1.7) * rad);
      const az = Math.atan2(u.x, u.z);
      if (u.y < this.lineAt(az) + 0.08) continue;
      const thick = p.afro * R * (0.5 + 0.35 * Math.max(0, u.y)) * smooth(this.lineAt(az), this.lineAt(az) + 0.45, u.y);
      const onHead = this.scalp(u, this.cap + thick);
      const sph = v3(0, h.ry * 0.18, -h.rz * 0.08).addScaledVector(u, R * (1.05 + p.afro * 0.62) - 0.04 * R);
      const root = (u.y > this.lineAt(az) + 0.3 && sph.length() > onHead.length() ? sph : onHead).addScaledVector(u, -0.02 * R);
      // a short, wide spiral lying along the surface
      const t1 = v3().crossVectors(u, UP);
      if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0);
      t1.normalize().applyAxisAngle(u, r() * Math.PI * 2);
      const pts: V[] = [];
      for (let i = 0; i <= 26; i++) {
        const t = i / 26, th = t * Math.PI * 4.5;
        const t2 = v3().crossVectors(u, t1);
        pts.push(root.clone().addScaledVector(t1, (t - 0.5) * 0.09 * R + Math.cos(th) * 0.032 * R).addScaledVector(t2, Math.sin(th) * 0.032 * R).addScaledVector(u, (Math.sin(th) * 0.5 + 0.5) * 0.03 * R));
      }
      this.emit(pts, 0.026 * R, { flat: 1, tip: 0.7, radial: 5, shade: 1.15, cards: false });
    }
  }

  /** locs, wavy locs, butterfly locs and rope twists (round, hanging ropes) */
  locs() {
    const { p, R, r } = this;
    const N = p.top < 0.5 ? 190 : 160;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const u = v3();
    for (let k = 0; k < N * 2.2; k++) {
      const y = 1 - (k / (N * 2.2 - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      u.set(Math.cos(golden * k) * rad, y, Math.sin(golden * k) * rad);
      const az = Math.atan2(u.x, u.z);
      if (u.y < this.lineAt(az) || this.faded(u.y, az)) continue;
      const a = Math.abs(az) / Math.PI;
      const L = (p.top * (1 - a) + p.back * a) * (0.9 + r() * 0.2) * (u.y > 0.5 ? 1 : 0.95);
      let pts = this.resample(this.grow(u, Math.max(p.side * smooth(0.7, 0.2, u.y), L), { fringe: false, layer: smooth(0, 1, u.y), liftK: 1.4 }), 0.02 * R);
      const w = 0.058 * R * (0.9 + r() * 0.2);
      if (p.loc === 'twists') {
        // two strands twisted round each other
        for (const ph of [0, Math.PI]) {
          const q = this.texture(pts, ph + k, 'coily', 0).map((v, i) => {
            const t = i / (pts.length - 1);
            const T = pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
            const N = v.clone().normalize().addScaledVector(T, -v.clone().normalize().dot(T)).normalize();
            const B = T.clone().cross(N);
            const th = t * 14 + ph;
            return v.clone().addScaledVector(B, Math.cos(th) * w * 0.55).addScaledVector(N, Math.sin(th) * w * 0.55);
          });
          this.emit(q, w * 0.62, { flat: 0.95, tip: 0.55, radial: 5, cards: false });
        }
        continue;
      }
      if (p.loc === 'wavylocs') pts = this.texture(pts, r() * 6, 'wavy', 1);
      const bumpy = p.loc === 'butterfly';
      this.m.add(pts, {
        wAt: (t) => w * (1 - 0.25 * t) * (bumpy ? 1 + 0.35 * Math.max(0, Math.sin(t * 40)) : 1 + 0.06 * Math.sin(t * 60)),
        flat: 0.95,
        radial: 6,
        out: (q, o) => o.copy(q).normalize(),
        shadeAt: (t) => 0.75 + 0.25 * t,
        rand: r(),
      });
    }
  }

  // ------------------------------------------------------------------ ties
  tiePoints(): V[] {
    const { h, p } = this;
    const back = (y: number, side = 0) => {
      const uy = y / h.ry;
      const rr = Math.sqrt(Math.max(0.05, 1 - uy * uy));
      return v3(side * h.rx * rr, y, -h.rz * rr * (side ? 0.6 : 1.04));
    };
    switch (p.tie) {
      case 'pony': return [back(h.ry * 0.5)];
      case 'lowpony': return [back(-h.ry * 0.5)];
      case 'sidepony': return [v3(h.rx * 0.82, -h.ry * 0.45, -h.rz * 0.42)];
      case 'twinpony': return [-1, 1].map((s) => v3(s * h.rx * 0.9, h.ry * 0.05, -h.rz * 0.4));
      case 'bun': return [back(h.ry * 0.62)];
      case 'lowbun': return [back(-h.ry * 0.42)];
      case 'messybun': return [v3(0, h.ry * 1.0, -h.rz * 0.32)];
      case 'spacebuns': return [-1, 1].map((s) => v3(s * h.rx * 0.6, h.ry * 0.86, -h.rz * 0.12));
      case 'halfup': return [back(h.ry * 0.3)];
      default: return [];
    }
  }

  ties() {
    const { p, R, r } = this;
    const pts = this.tiePoints();
    if (!pts.length) return;
    const halfup = p.tie === 'halfup';
    if (halfup) this.scalpStrands((u) => u.y < 0.35);
    // scalp: every root combed straight to the nearest tie point (sleek, tight to the head)
    const N = 190;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const u = v3();
    for (let k = 0; k < N * 2.2; k++) {
      const y = 1 - (k / (N * 2.2 - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      u.set(Math.cos(golden * k + (r() - 0.5) * 0.3) * rad, y, Math.sin(golden * k) * rad);
      const az = Math.atan2(u.x, u.z);
      if (u.y < this.lineAt(az) || this.faded(u.y, az)) continue;
      if (halfup && u.y < 0.35) continue;
      const root = this.scalp(u);
      const target = pts.reduce((a, b) => (a.distanceTo(root) < b.distanceTo(root) ? a : b));
      const dist = root.distanceTo(target) / R;
      const path = this.grow(u, dist * 1.6 + 0.1, { fringe: false, layer: 0.8, target, liftK: 0.2 });
      // the lock emerges from inside the scalp layer (no stepped edge along the hairline / nape)
      this.bury(path, u);
      this.emit(path, 0.21 * R * (0.85 + r() * 0.3), { flat: 0.22, tip: 0.75 });
    }
    // fringe / face-framing pieces stay loose
    if (p.fringe !== 'none') this.scalpStrands((uu, uy) => uu.z > 0.55 && uy < 0.85);
    for (const T of pts) {
      const n = T.clone().normalize();
      const isBun = p.tie === 'bun' || p.tie === 'lowbun' || p.tie === 'messybun' || p.tie === 'spacebuns';
      if (isBun && p.braid === 'braidbun') continue; // the plait wound into a bun is built in braids()
      if (isBun) this.bun(T, n, p.tie === 'spacebuns' ? 0.3 : p.tie === 'messybun' ? 0.4 : 0.37);
      else this.tail(T, n, p.tie === 'twinpony' ? 0.6 : 1);
      // the tie: a scrunchie / hair tie wrapping the gathered hair
      if (p.braid !== 'braidbun') this.band.push({ t: 'torus', c: [T.x + n.x * 0.03 * R, T.y + n.y * 0.03 * R, T.z + n.z * 0.03 * R], R: 0.085 * R * (isBun ? 1.4 : 1), r: 0.032 * R, rot: eulerFromAxis(n), bone: 0 });
    }
  }

  /** a ponytail: a bundle of clumps from the tie, falling with gravity */
  tail(T: V, n: V, thick: number) {
    const { p, R, r } = this;
    const K = Math.round(80 * thick);
    const side = v3().crossVectors(n, UP).normalize();
    const up = v3().crossVectors(side, n).normalize();
    for (let i = 0; i < K; i++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.15 * R * thick;
      const root = T.clone().addScaledVector(n, 0.05 * R).addScaledVector(side, Math.cos(a) * rr).addScaledVector(up, Math.sin(a) * rr);
      const d = n.clone().multiplyScalar(0.8).addScaledVector(UP, 0.35).addScaledVector(side, Math.cos(a) * 0.2).normalize();
      const L = p.tail * R * (0.85 + r() * 0.25);
      const steps = 22, ds = L / steps;
      const pts: V[] = [root.clone()];
      const cur = root.clone();
      for (let s = 1; s < steps; s++) {
        d.y -= 0.16;
        d.normalize();
        cur.addScaledVector(d, ds);
        this.keepOff(cur, this.cap + 0.04 * R);
        this.keepOffBody(cur, 0.03 * R + rr * 0.3);
        // the tail fans out a little toward the ends
        cur.addScaledVector(side, Math.cos(a) * 0.004 * R).addScaledVector(up, Math.sin(a) * 0.002 * R);
        pts.push(cur.clone());
      }
      const q = p.tex === 'straight' ? pts : this.texture(this.resample(pts, 0.015 * R), r() * 6);
      this.emit(q, 0.15 * R * (0.85 + r() * 0.3), { flat: p.tex === 'curly' || p.tex === 'coily' ? 0.8 : 0.5, tip: 0.5 - 0.45 * p.tips, rand: r() });
    }
  }

  /** a bun: strands wound around a ball */
  bun(T: V, n: V, size: number) {
    const { p, R, r } = this;
    const rb = size * R;
    const C = T.clone().addScaledVector(n, rb * 0.75);
    const a1 = v3().crossVectors(n, UP);
    if (a1.lengthSq() < 1e-4) a1.set(1, 0, 0);
    a1.normalize();
    const a2 = v3().crossVectors(n, a1).normalize();
    const K = 34;
    const messy = p.tie === 'messybun' ? 1 : 0;
    for (let k = 0; k < K; k++) {
      const pts: V[] = [];
      const ph = (k / K) * Math.PI * 2;
      const tilt = (r() - 0.5) * 1.6;
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const th = ph + t * Math.PI * 2.2;
        const psi = tilt * Math.sin(t * Math.PI) + (t - 0.5) * 0.6;
        const rr = rb * (0.82 + 0.18 * Math.sin(t * Math.PI)) * (1 + messy * 0.12 * Math.sin(t * 9 + k));
        pts.push(C.clone().addScaledVector(a1, Math.cos(th) * Math.cos(psi) * rr).addScaledVector(a2, Math.sin(th) * Math.cos(psi) * rr).addScaledVector(n, Math.sin(psi) * rr * 0.75));
      }
      const q = p.tex === 'coily' ? this.texture(this.resample(pts, 0.012 * R), k, 'coily', 1) : pts;
      this.emit(q, 0.1 * R, { flat: 0.5, tip: 0.6, rand: r() });
    }
    // a messy bun has loose loops and a few escaping pieces
    if (messy)
      for (let k = 0; k < 10; k++) {
        const d = v3(r() - 0.5, r() - 0.2, r() - 0.5).normalize();
        const s = C.clone().addScaledVector(d, rb * 0.9);
        const pts = [s, s.clone().addScaledVector(d, 0.15 * R).add(v3(0, 0.05 * R, 0)), s.clone().addScaledVector(d, 0.24 * R).add(v3(0, -0.02 * R, 0))];
        this.emit(this.resample(pts, 0.02 * R), 0.035 * R, { flat: 0.5, tip: 0.2 });
      }
  }

  // ------------------------------------------------------------------ plaits
  /**
   * A three-strand plait along `path` (strands cross over the middle in turn). `w` = plait
   * half-width; `freq` crossings per head radius; fishtail = 2 thinner strands, faster.
   */
  plait(path: V[], w: number, o: { fishtail?: boolean; raised?: number; taper?: number; out?: (p: V, o: V) => void } = {}) {
    const { R } = this;
    if (path.length < 3) return;
    const pts = this.resample(path, 0.014 * R);
    const strands = o.fishtail ? 4 : 3;
    const freq = (o.fishtail ? 2.2 : 1.1) / w;
    const outF = o.out ?? ((q: V, out: V) => out.copy(q).normalize());
    let L = 0;
    const ls = pts.map((v, i) => (i ? (L += v.distanceTo(pts[i - 1])) : 0));
    for (let k = 0; k < strands; k++) {
      const ph = (k / strands) * Math.PI * 2;
      const T = v3(), N = v3(), B = v3();
      const q = pts.map((v, i) => {
        T.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
        outF(v, N);
        N.addScaledVector(T, -N.dot(T)).normalize();
        B.crossVectors(T, N).normalize();
        const t = ls[i] / L;
        const ww = w * (1 - (o.taper ?? 0.35) * t);
        const th = ls[i] * freq + ph;
        // side to side across the plait, over (out) when crossing the middle, under at the edges
        return v.clone().addScaledVector(B, Math.sin(th) * ww * 0.85).addScaledVector(N, Math.cos(2 * th) * ww * 0.35 + (o.raised ?? 0) * ww);
      });
      this.emit(q, w * (o.fishtail ? 0.42 : 0.55), { flat: 0.6, tip: 0.6, radial: 5, rand: k / strands, cards: false });
    }
    // the ends below the tie
    const end = pts[pts.length - 1];
    const T = end.clone().sub(pts[pts.length - 2]).normalize();
    for (let k = 0; k < 7; k++) {
      const s = end.clone().add(v3((this.r() - 0.5) * w, 0, (this.r() - 0.5) * w * 0.5));
      this.emit([s, s.clone().addScaledVector(T, 0.1 * R), s.clone().addScaledVector(T, 0.2 * R).add(v3((this.r() - 0.5) * 0.04 * R, 0, 0))], w * 0.3, { flat: 0.5, tip: 0.15 });
    }
    this.band.push({ t: 'torus', c: [end.x, end.y, end.z], R: w * 0.75, r: 0.022 * R, rot: eulerFromAxis(T), bone: 0 });
  }

  braids() {
    const { h, p, R } = this;
    const hang = (start: V, len: number, drift: V) => {
      // a hanging path from start, falling under gravity, kept off head and body
      const pts: V[] = [start.clone()];
      const cur = start.clone(), d = drift.clone().normalize();
      const n = 24;
      for (let i = 1; i < n; i++) {
        d.y -= 0.2;
        d.normalize();
        cur.addScaledVector(d, (len * R) / n);
        this.keepOff(cur, this.cap + 0.06 * R);
        this.keepOffBody(cur, 0.07 * R);
        pts.push(cur.clone());
      }
      return pts;
    };
    switch (p.braid) {
      case 'single': {
        this.gatherTo([v3(0, -h.ry * 0.45, -h.rz * 0.98)]);
        this.plait(hang(v3(0, -h.ry * 0.45, -h.rz * 1.02), p.tail, v3(0, -1, -0.3)), 0.2 * R);
        break;
      }
      case 'fishtail': {
        this.gatherTo([v3(h.rx * 0.55, -h.ry * 0.5, -h.rz * 0.6)]);
        this.plait(hang(v3(h.rx * 0.62, -h.ry * 0.55, -h.rz * 0.55), p.tail, v3(0.25, -1, 0.35)), 0.2 * R, { fishtail: true });
        break;
      }
      case 'double': {
        const ends = [-1, 1].map((s) => v3(s * h.rx * 0.88, -h.ry * 0.45, -h.rz * 0.35));
        this.gatherTo(ends);
        for (const e of ends) this.plait(hang(e, p.tail, v3(Math.sign(e.x) * 0.1, -1, 0.45)), 0.17 * R);
        break;
      }
      case 'french':
      case 'dutch': {
        // the plait runs over the scalp from the front hairline to the nape, then hangs
        const over: V[] = [];
        for (let i = 0; i <= 14; i++) {
          // an arc in the mid-plane: θ = angle from straight up, + toward the face, − toward the nape
          const th = 0.75 - (i / 14) * 3.0;
          over.push(this.scalp(v3(0, Math.cos(th), Math.sin(th)).normalize(), this.cap + 0.05 * R));
        }
        const nape = over[over.length - 1];
        this.gatherTo(over, true);
        this.plait([...over, ...hang(nape, p.tail, v3(0, -1, -0.25)).slice(1)], 0.1 * R, { raised: p.braid === 'dutch' ? 0.6 : 0, taper: 0.5 });
        break;
      }
      case 'braidbun': {
        const T = this.tiePoints()[0];
        if (!T) break;
        const n = T.clone().normalize();
        const a1 = v3().crossVectors(n, UP).normalize(), a2 = v3().crossVectors(n, a1).normalize();
        const C = T.clone().addScaledVector(n, 0.14 * R);
        const spiral: V[] = [];
        for (let i = 0; i <= 60; i++) {
          const t = i / 60, th = t * Math.PI * 4.2, rr = 0.28 * R * (1 - t * 0.8);
          spiral.push(C.clone().addScaledVector(a1, Math.cos(th) * rr).addScaledVector(a2, Math.sin(th) * rr).addScaledVector(n, 0.12 * R * Math.sin(t * Math.PI) + 0.06 * R * t));
        }
        this.plait(spiral, 0.075 * R, { taper: 0.4, out: (q, o) => o.copy(q).sub(C).normalize().lerp(n, 0.5).normalize() });
        break;
      }
    }
  }

  /** sink the first part of a gathered lock under the scalp layer, rising out of it gradually */
  bury(path: V[], u: V) {
    const { R } = this;
    const near = smooth(0.32, 0, u.y - this.lineAt(Math.atan2(u.x, u.z))); // only close to the hairline
    if (near <= 0) return;
    for (let i = 0; i < Math.min(4, path.length); i++) {
      const k = (1 - i / 4) * near;
      const L = path[i].length() || 1;
      path[i].multiplyScalar((L - 0.05 * R * k) / L);
    }
  }

  /** comb the whole scalp toward the nearest of these points (hair feeding into plaits) */
  gatherTo(targets: V[], along = false) {
    const { R, r } = this;
    const N = 180;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const u = v3();
    for (let k = 0; k < N * 2.2; k++) {
      const y = 1 - (k / (N * 2.2 - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      u.set(Math.cos(golden * k) * rad, y, Math.sin(golden * k) * rad);
      const az = Math.atan2(u.x, u.z);
      if (u.y < this.lineAt(az) || this.faded(u.y, az)) continue;
      const root = this.scalp(u);
      let target = targets[0];
      let best = Infinity;
      for (const t of targets) {
        const d = t.distanceTo(root);
        if (d < best) { best = d; target = t; }
      }
      if (along) {
        // French / Dutch: hair is fed in diagonally (toward a point further back along the plait)
        const i = targets.indexOf(target);
        target = targets[Math.min(targets.length - 1, i + 2)];
      }
      const path = this.grow(u, (root.distanceTo(target) / R) * 1.6 + 0.1, { fringe: false, layer: 0, target, liftK: 0.2 });
      // the lock emerges from inside the scalp layer (no stepped edge along the hairline / nape)
      this.bury(path, u);
      this.emit(path, 0.21 * R * (0.85 + r() * 0.3), { flat: 0.22, tip: 0.75 });
    }
  }

  cornrows() {
    const { h, R } = this;
    // rows from the front hairline back over the head to the nape, each a small flat plait
    for (let row = -6; row <= 6; row++) {
      const az0 = row * 0.165;
      const path: V[] = [];
      for (let i = 0; i <= 22; i++) {
        const t = i / 22;
        // from the front hairline over the crown to the nape (rows converge a little toward the back)
        const th = 0.85 - t * 3.1;
        const uu = v3(Math.sin(az0) * (1 - t * 0.35), Math.cos(th), Math.sin(th)).normalize();
        if (uu.y < this.lineAt(Math.atan2(uu.x, uu.z)) + 0.02) continue;
        path.push(this.scalp(uu, this.cap * 0.2 + 0.018 * R));
      }
      if (path.length > 3) this.plait(path, 0.042 * R, { taper: 0.1 });
    }
    // the rows end in short braids at the nape
    void h;
  }

  boxBraids() {
    const { p, R, r } = this;
    const N = 52;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const u = v3();
    for (let k = 0; k < N * 2.4; k++) {
      const y = 1 - (k / (N * 2.4 - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      u.set(Math.cos(golden * k) * rad, y, Math.sin(golden * k) * rad);
      const az = Math.atan2(u.x, u.z);
      if (u.y < this.lineAt(az)) continue;
      const a = Math.abs(az) / Math.PI;
      const L = (p.side * (1 - a) + p.back * a) * (0.92 + r() * 0.14);
      const path = this.grow(u, Math.max(0.8, L), { fringe: false, layer: smooth(0, 1, u.y), liftK: 1.2 });
      this.plait(path, 0.038 * R, { taper: 0.25 });
    }
  }
}

/** Euler angles (XYZ) that turn +z… the torus' axis… to `axis` (tori lie in their local XY plane). */
function eulerFromAxis(axis: V): [number, number, number] {
  const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), axis.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}
