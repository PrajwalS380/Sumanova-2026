import * as THREE from 'three';
import type { Prim } from './sdf';

/**
 * Hair decoration builders shared by the groom's style decorations (sumanova-us-109: gajra,
 * ribbon bows, braid beads) and the hair-accessory slot (sumanova-us-110) — one copy only.
 * Every builder returns SDF prims; callers mesh them (and add motion attributes).
 */
type V = THREE.Vector3;
type V3 = [number, number, number];
const arr = (v: V): V3 => [v.x, v.y, v.z];

/** Euler angles (XYZ) that turn local +y (a torus' axis) to `axis`. */
export function torusRot(axis: V): V3 {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}

/** one jasmine bud standing off a surface at `c` along `out`: a white bud and its cream centre */
export function budPrims(c: V, out: V, R: number, scale = 1): { white: Prim; centre: Prim } {
  const tip = c.clone().addScaledVector(out, 0.11 * R * scale);
  const cc = tip.clone().addScaledVector(out, 0.012 * R * scale);
  return {
    white: { t: 'cone', a: arr(c), b: arr(tip), ra: 0.07 * R * scale, rb: 0.045 * R * scale, bone: 0 },
    centre: { t: 'sphere', c: arr(cc), r: 0.032 * R * scale, bone: 0 },
  };
}

/** a ribbon bow centred on `c`, facing +z (two loops, a knot and two tails) */
export function bowPrims(c: V, R: number, s = 1): Prim[] {
  return [
    { t: 'ellipsoid', c: [c.x - 0.11 * R * s, c.y + 0.01 * R * s, c.z], r: [0.12 * R * s, 0.08 * R * s, 0.03 * R * s], rot: [0, 0, 0.35], bone: 0 },
    { t: 'ellipsoid', c: [c.x + 0.11 * R * s, c.y + 0.01 * R * s, c.z], r: [0.12 * R * s, 0.08 * R * s, 0.03 * R * s], rot: [0, 0, -0.35], bone: 0 },
    { t: 'sphere', c: [c.x, c.y, c.z], r: 0.045 * R * s, bone: 0 },
    { t: 'box', c: [c.x - 0.05 * R * s, c.y - 0.16 * R * s, c.z], s: [0.03 * R * s, 0.12 * R * s, 0.01 * R * s], rot: [0, 0, 0.25], round: 0.004 * R * s, bone: 0 },
    { t: 'box', c: [c.x + 0.05 * R * s, c.y - 0.16 * R * s, c.z], s: [0.03 * R * s, 0.12 * R * s, 0.01 * R * s], rot: [0, 0, -0.25], round: 0.004 * R * s, bone: 0 },
  ];
}

/** a cylinder bead threaded on a braid end (`at` = the end, `dir` = along the braid, `w` = braid half-width) */
export function beadPrim(at: V, dir: V, w: number, R: number, len = 1): Prim {
  const a = at.clone().addScaledVector(dir, -0.02 * R * len), b = at.clone().addScaledVector(dir, 0.05 * R * len);
  return { t: 'cone', a: arr(a), b: arr(b), ra: w * 0.85, rb: w * 0.85, bone: 0 };
}

/**
 * Move prims built in a local frame (origin 0, +z = out of the hair, +y = up the head) to `o`,
 * rotated by `q`. Rotated prims keep their own rotation (composed with the frame's).
 */
export function placePrims(prims: Prim[], o: V, q: THREE.Quaternion): Prim[] {
  const P = (v: V3): V3 => arr(new THREE.Vector3(...v).applyQuaternion(q).add(o));
  const R = (rot: V3 | undefined): V3 => {
    const e = new THREE.Euler().setFromQuaternion(q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot ?? [0, 0, 0]), 'XYZ'))), 'XYZ');
    return [e.x, e.y, e.z];
  };
  return prims.map((p): Prim => {
    switch (p.t) {
      case 'sphere': return { ...p, c: P(p.c) };
      case 'cone': return { ...p, a: P(p.a), b: P(p.b) };
      case 'ellipsoid': return { ...p, c: P(p.c), rot: R(p.rot) };
      case 'box': return { ...p, c: P(p.c), rot: R(p.rot) };
      case 'torus': return { ...p, c: P(p.c), rot: R(p.rot) };
      default: return p;
    }
  });
}
