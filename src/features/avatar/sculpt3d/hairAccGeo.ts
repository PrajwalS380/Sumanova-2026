import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Field, type Prim } from './sdf';
import { meshField } from './mesh';
import { beadPrim, bowPrims, budPrims, placePrims, torusRot } from './hairDeco';
import type { AccKind, AnchorK } from '../look/hairAcc';

/**
 * Hair accessories (sumanova-us-110), sculpted in the worker: claw clips, snap clips, pearl
 * barrettes, scrunchies, headbands, bows, flowers, gajra strings, hair pins and braid beads.
 * All pieces of all worn accessories are ONE mesh; each vertex carries `accSlot`
 * (accessory 1 main / second colour, accessory 2 main / second colour) so colours are uniforms
 * (no rebuild on a colour change), and hairPivot / hairGrp so a piece on a tail swings with it.
 */
type V3 = [number, number, number];
export interface AccAnchorIn { k: AnchorK; at: V3; n: V3; d: V3; w: number; grp: number; pivot: V3 }
export interface AccItemIn { kind: AccKind; style: 0 | 1; /** 0 = hairAcc1, 1 = hairAcc2 */ slot: 0 | 1; anchors: AccAnchorIn[] }

type V = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
interface Piece { prims: Prim[]; tone: 0 | 1; a: AccAnchorIn; /** mesh cell scale (long smooth pieces can be coarser) */ cell?: number }

/** frame at an anchor: +z out of the hair, +y up along the head, +x across */
function frame(a: AccAnchorIn) {
  const o = v3(...a.at), z = v3(...a.n).normalize();
  let y = UP.clone().addScaledVector(z, -UP.dot(z));
  if (y.lengthSq() < 1e-4) y = v3(...a.d).multiplyScalar(-1).addScaledVector(z, -v3(...a.d).multiplyScalar(-1).dot(z));
  y.normalize();
  const x = v3().crossVectors(y, z).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return { o, q, x, y, z };
}

const SCALE: Record<AccKind, number> = { claw: 1.35, snap: 1.6, barrette: 1.6, scrunchie: 1, headband: 1, bow: 1.25, flower: 1.45, gajra: 1, pins: 1.7, beads: 1 };

/** pieces of one accessory on one anchor (prims in head space) */
function build(kind: AccKind, style: 0 | 1, a: AccAnchorIn, R: number): Piece[] {
  const out: Piece[] = [];
  const F = frame(a);
  // small pieces are drawn a little larger than life so they read at avatar scale; the mesh cell
  // grows with them (same triangle count)
  const k = SCALE[kind];
  const local = (prims: Prim[], tone: 0 | 1) => out.push({ prims: placePrims(prims, F.o, F.q), tone, a, cell: k });
  const world = (prims: Prim[], tone: 0 | 1) => out.push({ prims, tone, a, cell: k });
  const s = R * k;
  switch (kind) {
    case 'claw': {
      // a curved two-jaw clip standing on the hair: body + teeth biting in, a hinge bar
      const lift = a.k === 'tie' ? 0.05 * s : 0.02 * s;
      local([
        { t: 'box', c: [0, 0.02 * s, lift + 0.05 * s], s: [0.17 * s, 0.05 * s, 0.035 * s], round: 0.025 * s, rot: [0.5, 0, 0], bone: 0 },
        { t: 'box', c: [0, -0.04 * s, lift + 0.05 * s], s: [0.17 * s, 0.05 * s, 0.035 * s], round: 0.025 * s, rot: [-0.5, 0, 0], bone: 0 },
        ...[-0.12, -0.06, 0, 0.06, 0.12].flatMap((x): Prim[] => [
          { t: 'cone', a: [x * s, 0.05 * s, lift + 0.03 * s], b: [x * s, 0.07 * s, lift - 0.03 * s], ra: 0.018 * s, rb: 0.01 * s, bone: 0 },
          { t: 'cone', a: [x * s, -0.07 * s, lift + 0.03 * s], b: [x * s, -0.09 * s, lift - 0.03 * s], ra: 0.018 * s, rb: 0.01 * s, bone: 0 },
        ]),
      ], 0);
      local([{ t: 'cone', a: [-0.16 * s, -0.01 * s, lift + 0.1 * s], b: [0.16 * s, -0.01 * s, lift + 0.1 * s], ra: (style ? 0.026 : 0.018) * s, rb: (style ? 0.026 : 0.018) * s, bone: 0 }], 1);
      break;
    }
    case 'snap': {
      // a pair of slim snap clips laid diagonally on the hair
      for (const k of [-1, 1]) {
        const cy = k * 0.06 * s, cx = k * 0.02 * s;
        local([{ t: 'box', c: [cx, cy, 0.016 * s], s: [0.13 * s, 0.022 * s, 0.01 * s], round: 0.009 * s, rot: [0, 0, 0.45], bone: 0 }], 0);
        if (style) local([{ t: 'sphere', c: [cx + 0.12 * s * Math.cos(0.45), cy + 0.12 * s * Math.sin(0.45), 0.024 * s], r: 0.026 * s, bone: 0 }], 1);
      }
      break;
    }
    case 'barrette': {
      // a slim bar with a row of pearls (style 1: a bigger, fuller pearl row)
      local([{ t: 'box', c: [0, 0, 0.014 * s], s: [0.17 * s, 0.022 * s, 0.01 * s], round: 0.008 * s, rot: [0, 0, 0.3], bone: 0 }], 0);
      const n = style ? 7 : 5, pr = (style ? 0.03 : 0.026) * s;
      local(Array.from({ length: n }, (_, i): Prim => {
        const t = (i / (n - 1) - 0.5) * 0.3 * s;
        return { t: 'sphere', c: [t * Math.cos(0.3), t * Math.sin(0.3), 0.03 * s], r: pr, bone: 0 };
      }), 1);
      break;
    }
    case 'scrunchie': {
      // a gathered fabric ring round the tie / braid end: a soft torus with puffs
      const n = v3(...a.n).normalize();
      const c = v3(...a.at).addScaledVector(n, a.k === 'braidEnd' ? -0.05 * s : 0.01 * s);
      const RR = a.w * (a.k === 'braidEnd' ? 1.25 : 1.1) + 0.03 * s, rr = (a.k === 'braidEnd' ? 0.032 : 0.048) * s;
      const rot = torusRot(n);
      world([{ t: 'torus', c: [c.x, c.y, c.z], R: RR, r: rr, rot, bone: 0 }], 0);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
      const puffs: Prim[] = [];
      for (let i = 0; i < 10; i++) {
        const th = (i / 10) * Math.PI * 2;
        const p = v3(Math.cos(th) * RR, 0, Math.sin(th) * RR).applyQuaternion(q).add(c);
        puffs.push({ t: 'sphere', c: [p.x, p.y, p.z], r: rr * 1.18, bone: 0 });
      }
      world(puffs, style ? 1 : 0);
      break;
    }
    case 'headband': {
      // one anchor per point along the arc — built by the caller (see headband())
      break;
    }
    case 'bow': {
      const sc = a.k === 'tie' ? 1.05 : 0.8;
      local(placePrims(bowPrims(v3(0, 0, 0), s, sc), v3(0, 0, (a.k === 'tie' ? 0.07 : 0.03) * s), new THREE.Quaternion()), 0);
      if (style) local([{ t: 'sphere', c: [0, 0, (a.k === 'tie' ? 0.1 : 0.06) * s], r: 0.04 * s * sc, bone: 0 }], 1);
      break;
    }
    case 'flower': {
      const lift = (a.k === 'tie' ? 0.06 : 0.035) * s;
      if (style === 0) {
        // a rose: a bud centre wrapped by two rings of cupped petals, two leaves
        const pet: Prim[] = [{ t: 'ellipsoid', c: [0, 0, lift + 0.05 * s], r: [0.045 * s, 0.045 * s, 0.05 * s], bone: 0 }];
        for (const [n, rr, sz, tilt, off] of [[5, 0.045, 0.05, 0.9, 0], [7, 0.085, 0.06, 1.2, 0.4]] as const) {
          for (let i = 0; i < n; i++) {
            const th = (i / n) * Math.PI * 2 + off;
            pet.push({ t: 'ellipsoid', c: [Math.cos(th) * rr * s, Math.sin(th) * rr * s, lift + 0.03 * s], r: [sz * s, 0.018 * s, sz * 0.85 * s], rot: [tilt, 0, th + Math.PI / 2], bone: 0 });
          }
        }
        local(pet, 0);
        local([
          { t: 'ellipsoid', c: [0.13 * s, -0.06 * s, lift - 0.01 * s], r: [0.07 * s, 0.03 * s, 0.01 * s], rot: [0, 0, -0.5], bone: 0 },
          { t: 'ellipsoid', c: [-0.12 * s, -0.08 * s, lift - 0.01 * s], r: [0.065 * s, 0.028 * s, 0.01 * s], rot: [0, 0, 0.6], bone: 0 },
        ], 1);
      } else {
        // a hibiscus: five broad open petals and a long stamen
        const pet: Prim[] = [];
        for (let i = 0; i < 5; i++) {
          const th = (i / 5) * Math.PI * 2 + 0.3;
          pet.push({ t: 'ellipsoid', c: [Math.cos(th) * 0.08 * s, Math.sin(th) * 0.08 * s, lift + 0.015 * s], r: [0.085 * s, 0.06 * s, 0.012 * s], rot: [0, -0.25, th], bone: 0 });
        }
        local(pet, 0);
        local([
          { t: 'cone', a: [0, 0, lift + 0.02 * s], b: [0.03 * s, 0.05 * s, lift + 0.12 * s], ra: 0.012 * s, rb: 0.008 * s, bone: 0 },
          { t: 'sphere', c: [0.03 * s, 0.05 * s, lift + 0.125 * s], r: 0.02 * s, bone: 0 },
        ], 1);
      }
      break;
    }
    case 'gajra': {
      // a ring of buds: round the bun (bunTop), round the tail just past the tie, or round a braid end
      const n = v3(...a.n).normalize();
      const centre = a.k === 'bunTop' ? v3(...a.at).addScaledVector(n, -1.07 * a.w) : v3(...a.at).addScaledVector(n, a.k === 'tie' ? 0.07 * s : -0.06 * s);
      const rr = a.k === 'bunTop' ? a.w * 1.02 : a.w * 1.1 + 0.03 * s;
      const a1 = v3().crossVectors(n, UP);
      if (a1.lengthSq() < 1e-4) a1.set(1, 0, 0);
      a1.normalize();
      const a2 = v3().crossVectors(n, a1).normalize();
      const count = a.k === 'braidEnd' ? 6 : 9, sc = a.k === 'braidEnd' ? 0.6 : 0.78;
      for (let i = 0; i < count; i++) {
        const th = (i / count) * Math.PI * 2;
        const dir = a1.clone().multiplyScalar(Math.cos(th)).addScaledVector(a2, Math.sin(th));
        const c = centre.clone().addScaledVector(dir, rr);
        const bud = budPrims(c, dir.clone().addScaledVector(n, 0.3).normalize(), s, sc);
        const alt = style === 1 && i % 3 === 1;
        out.push({ prims: [bud.white], tone: alt ? 1 : 0, a, cell: 1.3 }, { prims: [bud.centre], tone: 1, a, cell: 1.3 });
      }
      break;
    }
    case 'pins': {
      if (style === 0) {
        // two crossed bobby pins
        for (const r of [0.55, -0.35]) local([{ t: 'box', c: [0, 0, 0.012 * s], s: [0.12 * s, 0.012 * s, 0.008 * s], round: 0.006 * s, rot: [0, 0, r], bone: 0 }], 0);
      } else {
        // three pins, each tipped with a pearl / star
        for (const [i, r] of [0.25, 0.6, 0.95].entries()) {
          const off = (i - 1) * 0.05 * s, L = 0.11 * s;
          local([{ t: 'box', c: [off, off * 0.5, 0.012 * s], s: [L, 0.011 * s, 0.008 * s], round: 0.005 * s, rot: [0, 0, r], bone: 0 }], 0);
          local([{ t: 'sphere', c: [off + Math.cos(r) * L, off * 0.5 + Math.sin(r) * L, 0.022 * s], r: 0.026 * s, bone: 0 }], 1);
        }
      }
      break;
    }
    case 'beads': {
      const at = v3(...a.at), d = v3(...a.d).normalize();
      if (style === 1) {
        // a metal cuff with a contrast rim
        world([beadPrim(at.clone().addScaledVector(d, -0.03 * s), d, a.w * 1.25, s, 1.2)], 0);
        world([{ t: 'torus', c: [at.x, at.y, at.z], R: a.w * 1.05, r: 0.008 * s, rot: torusRot(d), bone: 0 }], 1);
      } else {
        // one bead per braid end, alternating the two colours
        world([beadPrim(at.clone().addScaledVector(d, -0.03 * s), d, a.w * 1.2, s, 0.9)], (Math.round(a.at[0] * 1e3) & 1) as 0 | 1);
      }
      break;
    }
  }
  return out;
}

/** a headband through the arc points, lifted onto the hair; style 1 adds a top knot */
function headband(style: 0 | 1, pts: AccAnchorIn[], R: number): Piece[] {
  const s = R;
  const P = pts.map((a) => v3(...a.at).addScaledVector(v3(...a.n), 0.022 * s));
  const prims: Prim[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const end = i === 0 || i === P.length - 2;
    const a = P[i], b = P[i + 1];
    prims.push({ t: 'cone', a: [a.x, a.y, a.z], b: [b.x, b.y, b.z], ra: (i === 0 ? 0.02 : 0.034) * s, rb: (end && i !== 0 ? 0.02 : 0.034) * s, bone: 0 });
  }
  const out: Piece[] = [{ prims, tone: 0, a: pts[0], cell: 1.3 }];
  if (style === 1) {
    const top = pts[Math.floor(pts.length / 2)];
    const F = frame(top);
    out.push({ prims: placePrims([
      { t: 'ellipsoid', c: [0, 0, 0.05 * s], r: [0.07 * s, 0.05 * s, 0.045 * s], bone: 0 },
      { t: 'ellipsoid', c: [-0.07 * s, 0, 0.035 * s], r: [0.06 * s, 0.035 * s, 0.03 * s], rot: [0, 0, 0.3], bone: 0 },
      { t: 'ellipsoid', c: [0.07 * s, 0, 0.035 * s], r: [0.06 * s, 0.035 * s, 0.03 * s], rot: [0, 0, -0.3], bone: 0 },
    ], F.o, F.q), tone: 0, a: top });
  }
  return out;
}

export function hairAccGeometry(items: AccItemIn[], R: number): THREE.BufferGeometry | null {
  const geos: THREE.BufferGeometry[] = [];
  for (const it of items) {
    const pieces = it.kind === 'headband' ? headband(it.style, it.anchors, R) : it.anchors.flatMap((a) => build(it.kind, it.style, a, R));
    for (const pc of pieces) {
      if (!pc.prims.length) continue;
      // coarse cells keep both accessories ≤ 6k triangles
      const g = meshField(new Field([{ prims: pc.prims }], 0.004 * R, 0.03), { cell: 0.0075 * (pc.cell ?? 1) * (R / 0.35) });
      const n = g.getAttribute('position').count;
      if (!n) continue;
      const piv = new Float32Array(n * 3), grp = new Float32Array(n), slot = new Float32Array(n);
      for (let i = 0; i < n; i++) { piv.set(pc.a.pivot, i * 3); grp[i] = pc.a.grp; slot[i] = it.slot * 2 + pc.tone; }
      g.deleteAttribute('color');
      g.deleteAttribute('uv');
      g.setAttribute('hairPivot', new THREE.BufferAttribute(piv, 3));
      g.setAttribute('hairGrp', new THREE.BufferAttribute(grp, 1));
      g.setAttribute('accSlot', new THREE.BufferAttribute(slot, 1));
      geos.push(g);
    }
  }
  if (!geos.length) return null;
  return geos.length > 1 ? mergeGeometries(geos) : geos[0];
}

/** read the groom's anchor geometry back into plain anchors */
export function readAnchors(g: THREE.BufferGeometry | null | undefined): AccAnchorIn[] {
  if (!g) return [];
  const P = g.getAttribute('position').array, N = g.getAttribute('normal').array, D = g.getAttribute('hairT').array;
  const U = g.getAttribute('uv').array, PV = g.getAttribute('hairPivot').array, G = g.getAttribute('hairGrp').array;
  const kinds: AnchorK[] = ['tie', 'bunTop', 'braidEnd', 'partFront', 'sideLeft', 'sideRight', 'crownBack', 'overEarL', 'overEarR', 'headbandArc'];
  const r = (a: ArrayLike<number>, i: number): V3 => [Math.round(a[i * 3] * 1e4) / 1e4, Math.round(a[i * 3 + 1] * 1e4) / 1e4, Math.round(a[i * 3 + 2] * 1e4) / 1e4];
  const out: AccAnchorIn[] = [];
  for (let i = 0; i < P.length / 3; i++) out.push({ k: kinds[U[i * 2]], at: r(P, i), n: r(N, i), d: r(D, i), w: Math.round(U[i * 2 + 1] * 1e4) / 1e4, grp: G[i], pivot: r(PV, i) });
  return out;
}

export type { V };
