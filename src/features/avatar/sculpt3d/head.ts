import * as THREE from 'three';
import { skullDist, surfaceZ, type HeadShape } from '../sculpt';
import type { EarP, NoseP } from '../look/face';
import { Field, smax, type Part, type Prim, type V3 } from './sdf';
import { GeoCache, meshField } from './mesh';

/**
 * The sculpted head: skull + face in one surface, with the nose (bridge, rounded tip, nostril
 * wings, carved nostrils) and the ears (rim, hollow bowl, lobe) growing out of it with soft
 * blends — instead of separate spheres placed on a ball. Head-local units (like Face.tsx).
 */

const cache = new GeoCache<THREE.BufferGeometry>(24);
export function headGeometry(h: HeadShape, nose: NoseP | null, ears: EarP): THREE.BufferGeometry {
  return cache.get(`${JSON.stringify(h)}|${JSON.stringify(nose)}|${JSON.stringify(ears)}`, () => build(h, nose, ears));
}

/** Head-local nose anchor (matches Face.tsx: noseY from the eye line and nose length). */
export const noseYFor = (nose: NoseP) => -0.025 - 0.12 * nose.len;

function build(h: HeadShape, nose: NoseP | null, ears: EarP): THREE.BufferGeometry {
  const skull: Prim = {
    t: 'fn', c: [0, 0, 0], ext: [h.rx * 1.25, h.ry * 1.25, h.rz * 1.25], bone: 0, k: 0, f: (x, y, z) => {
      return skullDist(h, x, y, z);
    },
  };
  const parts: Part[] = [{ prims: [skull] }];

  // ------------------------------------------------------------ facial structure
  // Soft fullness under the skin: the apples of the cheeks (kept clear of the mouth, which is drawn
  // on the analytic face surface — anything that bulges there hides the lips and teeth). They sit just under
  // the skull surface, so only their smooth blend shows (a few mm) — the cartoon features
  // (eyes, brows, mouth) still sit exactly on the face, and hair / hats / glasses still fit.
  const ex = 0.127 * (h.rx / 0.35), ey = -0.025;
  const at = (x: number, y: number, inset: number): V3 => [x, y, surfaceZ(h, x, y) - inset];
  const soft: Prim[] = [];
  // (very soft and broad, so the cheek reads as a smooth curve, not a bump)
  for (const s of [-1, 1]) soft.push({ t: 'ellipsoid', c: at(s * (ex + 0.03), ey - 0.085, 0.052), r: [0.07, 0.05, 0.045], rot: [0, s * 0.5, 0], bone: 0, k: 0.035 });
  parts.push({ prims: soft, k: 0.028 });

  // ------------------------------------------------------------ nose (same placement as before)
  if (nose) {
    const p = nose;
    const y = noseYFor(p);
    const z = surfaceZ(h, 0, y);
    const S = 1.18; // the old nose group's scale, about the origin, then nudged back onto the face
    const T = (c: V3): V3 => [c[0] * S, c[1] * S - y * 0.18, c[2] * S - z * 0.18];
    const hump = p.hump ?? 0, droop = p.droop ?? 0, flare = p.flare ?? 0;
    const tipY = y + p.up * 0.008 - droop * 0.009;
    const prims: Prim[] = [];
    // bridge: a soft ridge from between the eyes down to the tip
    const top = T([0, y + 0.085, surfaceZ(h, 0, y + 0.085) - 0.012]);
    const tip = T([0, tipY + 0.006, z + 0.014]);
    prims.push({ t: 'cone', a: top, b: tip, ra: 0.012 * p.bridgeW + p.bridge * 0.004, rb: 0.02 * p.tipW, k: 0.016, bone: 0 });
    // a bump on the bridge (Roman / aquiline profile)
    if (hump > 0) {
      const hy = y + 0.04;
      prims.push({ t: 'ellipsoid', c: T([0, hy, surfaceZ(h, 0, hy) + 0.004 + hump * 0.006]), r: [0.012 * p.bridgeW * S, 0.016 * S, 0.01 * S], k: 0.014, bone: 0 });
    }
    // a defined nose: a soft bulb at the tip with a little shadow line under it (the columella)
    prims.push({ t: 'ellipsoid', c: T([0, tipY - 0.014 * p.tipS, z - 0.002]), r: [0.011 * p.tipW * S, 0.01 * S, 0.016 * S], k: 0.01, bone: 0 });
    // rounded tip
    prims.push({ t: 'ellipsoid', c: T([0, tipY, z + 0.012]), r: [0.034 * p.tipW * S, 0.031 * p.tipS * S, 0.038 * p.tipS * S], rot: [-p.up * 0.3, 0, 0], k: 0.014, bone: 0 });
    // nostril wings (alae)
    for (const s of [-1, 1]) prims.push({ t: 'ellipsoid', c: T([s * 0.027 * p.tipW * p.nostril * (1 + flare * 0.18), y - 0.004, z - 0.008]), r: [0.017 * p.nostril * S * (1 + flare * 0.22), 0.016 * S, 0.022 * S], k: 0.012, bone: 0 });
    parts.push({ prims, k: 0.03 });
    // nostril openings, carved under the tip
    const holes: Prim[] = [];
    for (const s of [-1, 1]) holes.push({ t: 'ellipsoid', c: T([s * 0.013 * p.tipW, tipY - 0.024 * p.tipS, z + 0.005]), r: [0.0085 * p.nostril, 0.006, 0.011], rot: [0.5, 0, s * 0.4], k: 0, bone: 0 });
    parts.push({ prims: holes, subtract: true, k: 0.004 });
  }

  // ------------------------------------------------------------ ears
  const x0 = h.rx * 0.97;
  for (const s of [-1, 1]) {
    // sits proud of the skull (the ear root blends into the head; the shell stands out from it)
    const pos = new THREE.Vector3(s * (x0 + 0.026), -0.035, -0.024);
    const rot = new THREE.Euler(0, s * (0.32 + ears.out * 0.5), s * -0.08, 'XYZ');
    const sz = ears.size;
    const sc = new THREE.Vector3(sz * ears.width, sz, sz);
    const inv = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(rot), sc).invert();
    const L = new THREE.Vector3();
    const ell = (px: number, py: number, pz: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) => {
      const ax = (px - cx) / rx, ay = (py - cy) / ry, az = (pz - cz) / rz;
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const k1 = Math.sqrt((ax / rx) ** 2 + (ay / ry) ** 2 + (az / rz) ** 2);
      return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
    };
    const unit = Math.min(sc.x, sc.y);
    const ear: Prim = {
      t: 'fn', c: [pos.x, pos.y, pos.z], ext: [0.08 * sz, 0.12 * sz, 0.09 * sz], bone: 0, k: 0, f: (x, y, z) => {
        L.set(x, y, z).applyMatrix4(inv);
        // outer ear: a flattened, slightly curved shell
        let d = ell(L.x, L.y, L.z, 0, 0, 0, 0.022, 0.07, 0.048);
        // root: joins the ear to the side of the head
        d = Math.min(d, ell(L.x, L.y, L.z, -s * 0.026, -0.006, 0.006, 0.03, 0.045, 0.03));
        if (ears.lobe > 0.4) d = Math.min(d, ell(L.x, L.y, L.z, 0, -0.066, 0.006, 0.022, 0.026 * ears.lobe, 0.019));
        if (ears.point > 0) d = Math.min(d, ell(L.x, L.y, L.z, 0, 0.068 + 0.02 * ears.point, -0.012, 0.016, 0.03 * ears.point + 0.01, 0.018));
        // the bowl (concha) carved into the outward face, leaving a rolled rim (helix) around it
        const bowl = ell(L.x, L.y, L.z, s * 0.021, 0.006, 0.008, 0.014, 0.05, 0.032);
        d = smax(d, -bowl, 0.008);
        return d * unit;
      },
    };
    parts.push({ prims: [ear], k: 0.018 });
  }

  const f = new Field(parts, 0.02, 0.06);
  return meshField(f, { cell: 0.0052 });
}
