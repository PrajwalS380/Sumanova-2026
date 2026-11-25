import * as THREE from 'three';
import { deform, hairline, smooth, wobble, type HeadShape } from '../sculpt';
import type { HairP } from '../look/hair';
import { rng, hashStr } from '../look/rng';
import { Field, smin, type Part, type Prim, type V3 } from './sdf';
import { GeoCache, meshField } from './mesh';

/**
 * Sculpted hair: ONE organic mesh per hairstyle. A cap that follows the scalp (cut at a
 * natural hairline) plus tapered, curved locks grown along the style's flow, all blended in
 * a distance field — so locks melt into the mass with soft grooves between them instead of
 * looking like strips or blocks. Curls are helices, braids interlocking lobes, buns and
 * afros sculpted volumes. Coordinates are head-local (the head group's units).
 *
 * The vertex colour channel stores (shade, root→tip, 0); the material mixes the user's colours.
 */

interface Out { geo: THREE.BufferGeometry | null; fade: THREE.BufferGeometry | null; band: THREE.BufferGeometry | null }

const cache = new GeoCache<Out>(24);
export function hairGeometry(h: HeadShape, p: HairP, seed: number, hatOn: boolean): Out {
  const key = `${JSON.stringify(h)}|${JSON.stringify(p)}|${seed}|${hatOn}`;
  return cache.get(key, () => build(h, p, seed, hatOn));
}

/** Approximate distance to the head surface (radial; exact on the surface, smooth near it). */
function headDist(h: HeadShape) {
  const v = new THREE.Vector3();
  return (x: number, y: number, z: number) => {
    const r = Math.sqrt(x * x + y * y + z * z) || 1e-6;
    deform(h, x / r, y / r, z / r, v);
    return r - v.length();
  };
}

function build(h: HeadShape, p: HairP, seed: number, hatOn: boolean): Out {
  const r = rng(hashStr('locks') + seed);
  const hd = headDist(h);
  const R = h.rx;
  const sculpt = !p.locs;
  const prims: Prim[] = [];
  const parts: Part[] = [];
  const v = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Vector3(), nrm = new THREE.Vector3(), tan = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const isUndercut = (uy: number, az: number) => p.undercut > 0 && Math.abs(az) > 0.75 && Math.abs(az) < 2.7 && uy < 0.42 + (1 - p.undercut) * -0.25;

  // ------------------------------------------------------------------ 1. cap
  const afro = p.afro;
  const lineAt = (az: number) => {
    const temple = p.fringe > 0 ? 0 : 0.09 * Math.exp(-(((Math.abs(az) - 0.62) / 0.2) ** 2)) - 0.035 * Math.exp(-((az / 0.16) ** 2));
    // hair covers the back of the head down to the nape (only undercuts / fades sit higher)
    return hairline(az, p.front, p.undercut > 0.6 ? p.back : Math.min(p.back, -0.74), p.side) + temple;
  };
  const capThick = (uy: number, az: number) => {
    if (hatOn) return Math.min(p.shell, 0.03) * R;
    if (isUndercut(uy, az)) return 0.006 * R;
    const crown = sculpt && p.count > 0 ? 0.05 * smooth(0.25, 0.95, uy) * Math.min(1, p.top / 0.4) * (1 + p.lift * 0.6) : 0;
    return (p.shell + 0.02 + crown) * R + (afro > 0 ? afro * (0.75 + 0.25 * uy) * R : 0);
  };
  parts.push({
    prims: [{ t: 'fn', c: [0, h.ry * 0.25, -h.rz * 0.05], ext: [R * (1.5 + afro), h.ry * (1.4 + afro), h.rz * (1.6 + afro)], bone: 0, k: 0, tag: 0, f: (x, y, z) => {
      const rr = Math.sqrt(x * x + y * y + z * z) || 1e-6;
      const ux = x / rr, uy = y / rr, uz = z / rr, az = Math.atan2(ux, uz);
      const dHead = hd(x, y, z) - capThick(uy, az);
      // hairline: below the line (on the face / neck) the cap stops with a soft rounded edge
      const below = (lineAt(az) - uy) * h.ry * 0.9;
      let d = Math.max(dHead, below);
      if (afro > 0) d += 0.018 * R * wobble(ux * 3, uy * 3, uz * 3, 2.4) + 0.008 * R * wobble(uz * 9, ux * 9, uy * 9, 2);
      // soft comb grooves along the flow give the sculpted mass its texture
      else if (sculpt && p.count > 0 && !hatOn) d -= 0.006 * R * Math.sin(az * (p.flow === 'side' || p.flow === 'part' ? 11 : 15) + uy * 2.5 + (p.part || 0) * 4) * smooth(-0.2, 0.5, uy);
      return d;
    } }],
  });

  // ------------------------------------------------------------------ 2. locks
  const surfR = (pt: THREE.Vector3) => {
    tmp.copy(pt).normalize();
    return deform(h, tmp.x, tmp.y, tmp.z, new THREE.Vector3()).length();
  };
  const rawCount = sculpt && p.count > 0 ? Math.round(p.count * 0.2) + 16 : Math.round(p.count * 0.5);
  const count = hatOn ? Math.min(rawCount, 30) : rawCount;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const N = count * 3;
  let made = 0;
  const lockPrims: Prim[] = [];
  for (let k = 0; k < N && made < count; k++) {
    const y = 1 - (k / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * k + r() * 0.3;
    const ux = Math.cos(th) * rad, uz = Math.sin(th) * rad, uy = y;
    const az = Math.atan2(ux, uz);
    if (smooth(lineAt(az) - 0.05, lineAt(az) + 0.05, uy) < 0.6 || isUndercut(uy, az)) continue;
    if (hatOn && uy > 0.25) continue;
    const smoothCrown = sculpt && p.flow !== 'up' && p.flow !== 'out' && p.curl < 0.5;
    if (smoothCrown && uy > 0.66) continue;
    const a = Math.abs(az) / Math.PI;
    const frontness = Math.max(0, 1 - a * 2.2) * smooth(0.95, 0.55, uy);
    const sideness = Math.sin(Math.PI * a) * smooth(0.6, 0.1, uy);
    let L = p.top * (1 - a) * (uy > 0.4 ? 1 : 0.7) + p.backL * a + p.sides * sideness;
    if (p.fringe > 0) L = Math.max(L * (1 - frontness), p.fringe * frontness + L * (1 - frontness));
    const smoothShort = smoothCrown && L < 0.4 && !(p.fringe > 0 && frontness > 0.4) && p.spiky < 0.7;
    if (smoothShort) continue;
    made++;
    if (p.layers) L *= 0.55 + 0.45 * r() + 0.2 * p.layers * (1 - uy);
    L *= 0.94 + 0.12 * r();
    if (hatOn) L = Math.min(L, Math.max(p.sides, 0.12));
    L *= R;
    deform(h, ux, uy, uz, v, 1 + (p.shell + 0.02) * 0.6);
    nrm.set(ux, uy, uz).normalize();
    const tBack = new THREE.Vector3(ux * uy, -(1 - uy * uy), uz * uy);
    if (tBack.lengthSq() < 0.02) tBack.set(0, 0, -1);
    tBack.normalize();
    tan.set(Math.sin(az + Math.PI / 2), 0, Math.cos(az + Math.PI / 2));
    switch (p.flow) {
      case 'back': dir.set(0, 0.25, -1).addScaledVector(nrm, p.lift * 0.6); break;
      case 'forward': dir.set(0, 0.1, 1).addScaledVector(nrm, p.lift * 0.6).addScaledVector(tBack, 0.4); break;
      case 'up': dir.copy(nrm).multiplyScalar(0.6 + p.lift).add(tmp.set(0, 0.6, -0.6)).addScaledVector(UP, 0.3); break;
      case 'side': dir.set(p.sweep >= 0 ? 1 : -1, 0.15, 0.25).addScaledVector(nrm, p.lift * 0.5).addScaledVector(tBack, 0.3); break;
      case 'part': { const side = az - p.part >= 0 ? 1 : -1; dir.copy(tan).multiplyScalar(side).addScaledVector(nrm, p.lift * 0.4).addScaledVector(tBack, 0.6); break; }
      case 'out': dir.copy(nrm).multiplyScalar(1 + p.lift).addScaledVector(tBack, 0.3); break;
      default: {
        const away = Math.sign(az - p.part || ux || 1);
        const sideFall = tmp.copy(tan).multiplyScalar(away).addScaledVector(UP, -0.6);
        const fr = smooth(0.1, 0.6, uz);
        dir.copy(tBack).multiplyScalar(1 - fr).addScaledVector(sideFall, fr * 1.2).addScaledVector(nrm, 0.25 + p.lift * 0.3);
      }
    }
    if (p.sweep && p.flow !== 'side') dir.x += p.sweep * 0.4 * frontness;
    if (frontness > 0.4 && p.fringe > 0) dir.lerp(tmp.set(p.part ? Math.sign(-ux) * 0.2 : 0, -0.7, 0.5), 0.7);
    dir.normalize();

    const curly = p.curl > 0.8;
    const steps = curly ? Math.min(40, Math.ceil(p.curlF * 5)) : 7;
    const seg = L / steps;
    const pts: THREE.Vector3[] = [v.clone()];
    const cur = v.clone();
    const d = dir.clone();
    const curlPhase = r() * Math.PI * 2;
    const gravity = 0.02 + (p.flow === 'down' || p.locs ? 0.16 : 0.06) * Math.min(1, L / (0.3 * R));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      d.y -= gravity * (p.flow === 'up' || p.flow === 'out' ? 0.3 : 1);
      if (p.flow === 'up' && t < 0.6) d.addScaledVector(UP, 0.05);
      d.normalize();
      cur.addScaledVector(d, seg);
      if (p.curl > 0) {
        const ang = curlPhase + t * p.curlF * Math.PI * 2;
        tmp.set(Math.cos(ang), Math.sin(ang) * 0.5, Math.sin(ang)).multiplyScalar(p.curl * (curly ? 0.05 : 0.07) * R * Math.min(1, t * 3));
        cur.add(tmp);
      }
      const browY = h.ry * 0.16;
      if (cur.z > h.rz * 0.25 && cur.y < h.ry * 0.42 && cur.y > -h.ry * 1.05) {
        const isFringe = p.fringe > 0 && frontness > 0.4;
        if (isFringe && cur.y < browY) {
          if (pts.length >= 3) break;
          cur.y = browY;
        } else if (!isFringe && Math.abs(cur.x) < h.rx * 0.9 && cur.y < h.ry * 0.3) {
          const sx = Math.sign(cur.x || ux || 1);
          cur.x += (sx * h.rx * 0.9 - cur.x) * 0.45;
          d.x += sx * 0.25;
          d.z -= 0.15;
        }
      }
      const minR = surfR(cur) * (1.02 + (p.shell + 0.02) * 0.6);
      const len = cur.length();
      if (len < minR && cur.y > -h.ry * 0.85) cur.multiplyScalar(minR / len);
      if (cur.y < -h.ry * 0.7) {
        const hr = Math.hypot(cur.x, cur.z);
        const minH = h.rx * (cur.z < 0 ? 0.78 : 0.92);
        if (hr < minH) {
          const f = minH / Math.max(hr, 1e-3);
          cur.x *= f;
          cur.z *= f;
        }
      }
      pts.push(cur.clone());
    }
    // a lock: overlapping flattened lobes along the path — broad across, thin through, lying
    // against the head — so neighbouring locks merge into one sculpted mass with soft grooves.
    const roundish = p.locs > 0 || curly;
    const w0 = (roundish ? (p.locs ? 0.075 : 0.12) : 0.15) * p.width * R * (0.88 + 0.24 * r()) * (roundish ? 1 : 0.6 + 0.4 * Math.min(1, L / (0.45 * R)));
    const tipK = p.locs ? 0.8 : curly ? 0.75 : 1 - p.spiky * 0.85;
    const flat = roundish ? 0.9 : 0.36 + p.spiky * 0.3;
    const m = new THREE.Matrix4(), e = new THREE.Euler(), T = new THREE.Vector3(), Nn = new THREE.Vector3(), Bn = new THREE.Vector3();
    for (let i = 0; i < pts.length - 1; i++) {
      const t = (i + 0.5) / (pts.length - 1);
      const c = pts[i].clone().add(pts[i + 1]).multiplyScalar(0.5);
      T.copy(pts[i + 1]).sub(pts[i]);
      const segLen = T.length() || 1e-4;
      T.divideScalar(segLen);
      Nn.copy(c).normalize(); // away from the head centre
      Nn.addScaledVector(T, -Nn.dot(T)).normalize();
      Bn.crossVectors(T, Nn).normalize();
      m.makeBasis(Bn, T, Nn); // local x = across, y = along, z = through
      e.setFromRotationMatrix(m);
      const wid = Math.max(0.008 * R, w0 * (1 - (1 - tipK) * Math.pow(t, 1.1)) * (t < 0.1 ? 0.8 + t * 2 : 1));
      if (roundish) lockPrims.push({ t: 'cone', a: [pts[i].x, pts[i].y, pts[i].z], b: [pts[i + 1].x, pts[i + 1].y, pts[i + 1].z], ra: wid, rb: Math.max(0.006 * R, wid * 0.97), k: curly ? 0.012 * R : 0.02 * R, bone: 0, tag: made });
      else lockPrims.push({ t: 'ellipsoid', c: [c.x, c.y, c.z], r: [wid, segLen * 1.15 + wid * 0.35, wid * flat], rot: [e.x, e.y, e.z], k: 0.06 * R, bone: 0, tag: made });
    }
  }
  if (lockPrims.length) parts.push({ prims: lockPrims, k: (p.locs ? 0.02 : p.curl > 0.8 ? 0.012 : 0.045) * R });

  // ------------------------------------------------------------------ 3. ties, buns, braids, tails
  const tieY = -h.ry * 0.2 + p.tieH * h.ry * 1.1;
  const tieZ = -Math.sqrt(Math.max(0.05, 1 - (tieY / h.ry) ** 2)) * h.rz * 1.08;
  let band: V3 | null = null;
  const lump = (c: V3, rad: number, sx = 1, sy = 1, sz = 1) =>
    prims.push({ t: 'fn', c, ext: [rad * sx * 1.3, rad * sy * 1.3, rad * sz * 1.3], bone: 0, k: 0, f: (x, y, z) => {
      const lx = (x - c[0]) / sx, ly = (y - c[1]) / sy, lz = (z - c[2]) / sz;
      const rr = Math.sqrt(lx * lx + ly * ly + lz * lz);
      // a twisted bun: swirl grooves around its axis
      return (rr - rad) * Math.min(sx, sy, sz) - 0.012 * R * Math.max(0, Math.sin(Math.atan2(lx, lz) * 5 + ly * 30));
    } });
  const tail = (from: V3, len: number, thick: number, bend: number) => {
    // a ponytail: a few broad, tapering locks bundled together
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + r() * 0.5, rr = thick * (i === 0 ? 0 : 0.45);
      let c: V3 = [from[0] + Math.cos(ang) * rr, from[1] + Math.sin(ang) * rr * 0.6, from[2] - Math.abs(Math.sin(ang)) * rr * 0.3];
      for (let s = 1; s <= 6; s++) {
        const t = s / 6;
        const nxt: V3 = [c[0] + Math.cos(ang) * thick * 0.08 * t, c[1] - len / 6, c[2] - bend * (1 - t) * 0.03 * R];
        prims.push({ t: 'cone', a: c, b: nxt, ra: thick * 0.5 * (1 - 0.6 * (t - 1 / 6)), rb: thick * 0.5 * (1 - 0.6 * t), k: 0.03 * R, bone: 0, tag: 999 });
        c = nxt;
      }
    }
  };
  switch (p.tie) {
    case 'pony':
    case 'lowpony': {
      const c: V3 = [0, tieY, tieZ - 0.01];
      band = c;
      tail([c[0], c[1], c[2] - 0.035], (p.tie === 'pony' ? 0.75 : 0.6) * R * 2, 0.3 * R, 1);
      break;
    }
    case 'bun':
    case 'topbun':
      lump(p.tie === 'topbun' ? [0, h.ry * 1.08, -h.rz * 0.25] : [0, tieY, tieZ - 0.08], 0.32 * R, 1, 0.85, 1);
      break;
    case 'spacebuns':
      for (const s of [-1, 1]) lump([s * h.rx * 0.7, h.ry * 0.85, -h.rz * 0.15], 0.25 * R);
      break;
    case 'half':
      lump([0, h.ry * 0.45, -h.rz * 1.0], 0.2 * R, 1, 0.8, 0.8);
      break;
    case 'braids':
    case 'braid':
    case 'cornrows': {
      const sides = p.tie === 'braid' ? [0] : [-1, 1];
      for (const s of sides) {
        const start = p.tie === 'braid' ? new THREE.Vector3(0, -h.ry * 0.1, -h.rz * 1.02) : new THREE.Vector3(s * h.rx * 0.88, -h.ry * 0.15, -h.rz * 0.15);
        const end = p.tie === 'braid' ? new THREE.Vector3(0, -h.ry * 2.2, -h.rz * 1.25) : new THREE.Vector3(s * h.rx * 0.85, -h.ry * 2.1, h.rz * 0.45);
        const curve = new THREE.CatmullRomCurve3([start, start.clone().lerp(end, 0.4).add(tmp.set(s * 0.04, 0, s ? 0.05 : -0.08)), end]);
        // interlocking lobes, alternating left / right — reads as a plait
        const n = 16;
        for (let i = 0; i < n; i++) {
          const c = curve.getPoint(i / (n - 1));
          const tg = curve.getTangent(i / (n - 1));
          const sc = 0.14 * R * (1 - i * 0.02);
          prims.push({ t: 'ellipsoid', c: [c.x, c.y, c.z], r: [sc * 1.1, sc * 0.8, sc * 0.75], rot: [Math.atan2(tg.z, -tg.y), 0, i % 2 ? 0.55 : -0.55], k: 0.006 * R, bone: 0, tag: 998 });
        }
        if (p.tie !== 'cornrows' || true) band = band ?? [curve.getPoint(1).x, curve.getPoint(1).y + 0.02, curve.getPoint(1).z];
      }
      if (p.tie === 'cornrows') {
        for (let row = -3; row <= 3; row++) {
          const az0 = row * 0.22;
          let prev: V3 | null = null;
          for (let s = 0; s <= 10; s++) {
            const t = s / 10;
            const uy = 0.55 - t * 1.0;
            const rad = Math.sqrt(Math.max(0, 1 - uy * uy));
            const back = Math.PI * t * 0.9;
            const pt = deform(h, Math.sin(az0 * (1 - t * 0.3)) * rad, uy * Math.cos(back * 0.2), Math.cos(back) * rad, new THREE.Vector3(), 1.035);
            const cur: V3 = [pt.x, pt.y, pt.z];
            if (prev) prims.push({ t: 'cone', a: prev, b: cur, ra: 0.016, rb: 0.016, k: 0.004, bone: 0, tag: 997 });
            prev = cur;
          }
        }
      }
      break;
    }
    default:
      break;
  }
  if (p.locs && p.tie === 'topbun') lump([0, h.ry * 1.05, -h.rz * 0.2], 0.28 * R);
  if (prims.length) parts.push({ prims, k: 0.025 * R });

  // ------------------------------------------------------------------ mesh
  const long = p.sides > 0.8 || p.backL > 0.8 || p.tie === 'braids' || p.tie === 'braid' || p.tie === 'pony' || p.tie === 'lowpony' || p.locs > 0;
  const f = new Field(parts, 0.02 * R, 0.08 * R);
  const geo = meshField(f, {
    cell: (long ? 0.0105 : 0.009) * (R / 0.35),
    lipschitz: 1.6,
    color: (x, y, z, tag) => {
      // shade: deeper toward the scalp (fake occlusion between locks); t: root → tip
      const dh = hd(x, y, z);
      const shade = 0.72 + 0.28 * smooth(0.0, 0.06 * R, dh - capThick(0.5, 0) * 0.6);
      const t = tag === 0 ? 0 : smooth(h.ry * 0.3, -h.ry * 1.6, y);
      return [shade, t, 0];
    },
  });
  // undercut / fade: a soft stubble shell
  let fade: THREE.BufferGeometry | null = null;
  if (p.undercut > 0) {
    const ff = new Field([{ prims: [{ t: 'fn', c: [0, 0, 0], ext: [R * 1.2, h.ry * 1.2, h.rz * 1.3], bone: 0, k: 0, f: (x, y, z) => {
      const rr = Math.sqrt(x * x + y * y + z * z) || 1e-6;
      const uy = y / rr, az = Math.atan2(x / rr, z / rr);
      return Math.max(hd(x, y, z) - 0.008 * R, (lineAt(az) - uy) * h.ry, isUndercut(uy, az) ? -1 : 1);
    } }] }], 0.02 * R, 0.1 * R);
    fade = meshField(ff, { cell: 0.012 * (R / 0.35) });
  }
  let bandGeo: THREE.BufferGeometry | null = null;
  if (band) {
    const bf = new Field([{ prims: [{ t: 'torus', c: band, R: 0.04 * R * 2.4 * (p.tie === 'pony' || p.tie === 'lowpony' ? 1 : 0.6), r: 0.016, rot: [Math.PI / 2 - 0.3, 0, 0], bone: 0 }] }], 0.01, 0.05);
    bandGeo = meshField(bf, { cell: 0.004 });
  }
  void smin;
  return { geo, fade, band: bandGeo };
}
