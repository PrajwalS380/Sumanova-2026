import { useMemo } from 'react';
import * as THREE from 'three';
import { deform, hairline, shellGeometry, smooth, wobble, lathe, type HeadShape } from '../sculpt';
import type { HairP } from '../look/hair';
import { rng, hashStr } from '../look/rng';
import { taperTube, mergeAll } from '../look/tube';

/**
 * Hair = a sculpted base cap + hundreds of tapered, slightly flattened locks
 * grown from the scalp along a flow field, coloured root → tip (ombré-ready).
 */
export function Hair({ h, p, color, tip, seed, hatOn }: { h: HeadShape; p: HairP; color: string; tip: string | null; seed: number; hatOn: boolean }) {
  const geo = useMemo(() => buildHair(h, p, color, tip ?? null, seed, hatOn), [h, p, color, tip, seed, hatOn]);
  const base = useMemo(() => new THREE.Color(color), [color]);
  const sheen = useMemo(() => '#' + base.clone().lerp(new THREE.Color('#ffe8d0'), 0.18).getHexString(), [base]);
  return (
    <group>
      {geo.shell && (
        <mesh geometry={geo.shell} castShadow>
          <meshPhysicalMaterial color={geo.shellColor} roughness={0.55} sheen={0.3} sheenRoughness={0.4} sheenColor={sheen} />
        </mesh>
      )}
      {geo.fade && (
        <mesh geometry={geo.fade}>
          <meshStandardMaterial color={color} roughness={0.95} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
      {geo.locks && (
        <mesh geometry={geo.locks} castShadow>
          <meshPhysicalMaterial vertexColors roughness={0.42} sheen={0.35} sheenRoughness={0.4} sheenColor={sheen} side={THREE.DoubleSide} />
        </mesh>
      )}
      {geo.extras.map((e, i) => (
        <mesh key={i} geometry={e} castShadow>
          <meshPhysicalMaterial vertexColors={!!e.getAttribute('color')} color={e.getAttribute('color') ? '#ffffff' : color} roughness={0.45} sheen={0.8} sheenColor={sheen} />
        </mesh>
      ))}
    </group>
  );
}

interface Built { shell: THREE.BufferGeometry | null; shellColor: string; fade: THREE.BufferGeometry | null; locks: THREE.BufferGeometry | null; extras: THREE.BufferGeometry[] }

const UP = new THREE.Vector3(0, 1, 0);

export function buildHair(h: HeadShape, p: HairP, color: string, tip: string | null, seed: number, hatOn: boolean): Built {
  const r = rng(hashStr('locks') + seed);
  const root = new THREE.Color(color);
  const tipC = tip ? new THREE.Color(tip) : root.clone().lerp(new THREE.Color('#ffffff'), 0.08);
  const mask = (uy: number, az: number) => {
    const line = hairline(az, p.front, p.back, p.side);
    return smooth(line - 0.05, line + 0.05, uy);
  };
  const isUndercut = (uy: number, az: number) => p.undercut > 0 && Math.abs(az) > 0.75 && Math.abs(az) < 2.7 && uy < 0.42 + (1 - p.undercut) * -0.25;

  // 1. Base cap
  const afro = p.afro;
  const shell = shellGeometry(h, (ux, uy, uz, az) => {
    if (afro > 0) {
      const line = hairline(az, p.front, p.back, p.side);
      const m = smooth(line - 0.2, line + 0.2, uy);
      return 0.985 + (0.015 + afro * (0.75 + 0.25 * uy) + 0.045 * wobble(ux, uy, uz, 2.4) + 0.02 * wobble(uz, ux, uy, 5)) * m;
    }
    const m = mask(uy, az);
    let off = hatOn ? Math.min(p.shell, 0.03) : p.shell;
    if (isUndercut(uy, az)) off = 0.004;
    return 0.985 + (off + 0.015) * m;
  }, 96, 64);
  const fade = p.undercut > 0 ? shellGeometry(h, (_ux, uy, _uz, az) => {
    const m = mask(uy, az) * (isUndercut(uy, az) ? 1 : 0);
    return 0.97 + 0.034 * m;
  }, 64, 40) : null;

  // 2. Locks
  const locks: THREE.BufferGeometry[] = [];
  const extras: THREE.BufferGeometry[] = [];
  const v = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Vector3(), nrm = new THREE.Vector3(), tan = new THREE.Vector3();
  const surfR = (pt: THREE.Vector3) => {
    tmp.copy(pt).normalize();
    return deform(h, tmp.x, tmp.y, tmp.z, new THREE.Vector3()).length();
  };
  const count = hatOn ? Math.min(p.count, 120) : p.count;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const N = count * 3;
  let made = 0;
  for (let k = 0; k < N && made < count; k++) {
    // fibonacci sphere sample, jittered
    const y = 1 - (k / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * k + r() * 0.3;
    const ux = Math.cos(th) * rad, uz = Math.sin(th) * rad, uy = y;
    const az = Math.atan2(ux, uz);
    if (mask(uy, az) < 0.6 || isUndercut(uy, az)) continue;
    if (hatOn && uy > 0.25) continue;
    made++;
    const a = Math.abs(az) / Math.PI; // 0 front … 1 back
    const frontness = Math.max(0, 1 - a * 2.2) * smooth(0.95, 0.55, uy);
    const sideness = Math.sin(Math.PI * a) * smooth(0.6, 0.1, uy);
    let L = p.top * (1 - a) * (uy > 0.4 ? 1 : 0.7) + p.backL * a + p.sides * sideness;
    if (p.fringe > 0) L = Math.max(L * (1 - frontness), p.fringe * frontness + L * (1 - frontness));
    if (p.layers) L *= 0.55 + 0.45 * r() + 0.2 * p.layers * (1 - uy);
    L *= 0.85 + 0.3 * r();
    if (hatOn) L = Math.min(L, Math.max(p.sides, 0.12));
    L *= h.rx; // scale with head size

    deform(h, ux, uy, uz, v, 1 + p.shell * 0.6);
    nrm.set(ux, uy, uz).normalize();
    // tangent pointing "backwards" around the head (toward az = π) and sideways (toward ±x)
    const tBack = new THREE.Vector3(ux * uy, -(1 - uy * uy), uz * uy); // downhill on sphere
    if (tBack.lengthSq() < 0.02) tBack.set(0, 0, -1); // crown: fall backwards
    tBack.normalize();
    tan.set(Math.sin(az + Math.PI / 2), 0, Math.cos(az + Math.PI / 2)); // around y
    switch (p.flow) {
      case 'back':
        dir.set(0, 0.25, -1).addScaledVector(nrm, p.lift * 0.6);
        break;
      case 'forward':
        dir.set(0, 0.1, 1).addScaledVector(nrm, p.lift * 0.6).addScaledVector(tBack, 0.4);
        break;
      case 'up':
        dir.copy(nrm).multiplyScalar(0.6 + p.lift).add(v.clone().set(0, 0.6, -0.6)).addScaledVector(UP, 0.3);
        break;
      case 'side':
        dir.set(p.sweep >= 0 ? 1 : -1, 0.15, 0.25).addScaledVector(nrm, p.lift * 0.5).addScaledVector(tBack, 0.3);
        break;
      case 'part': {
        const side = az - p.part >= 0 ? 1 : -1;
        dir.copy(tan).multiplyScalar(side).addScaledVector(nrm, p.lift * 0.4).addScaledVector(tBack, 0.6);
        break;
      }
      case 'out':
        dir.copy(nrm).multiplyScalar(1 + p.lift).addScaledVector(tBack, 0.3);
        break;
      default: {
        // falling hair: front locks part away from the face, the rest falls down the back/sides
        const away = Math.sign(az - p.part || ux || 1);
        const sideFall = tmp.copy(tan).multiplyScalar(away).addScaledVector(UP, -0.6);
        const fr = smooth(0.1, 0.6, uz);
        dir.copy(tBack).multiplyScalar(1 - fr).addScaledVector(sideFall, fr * 1.2).addScaledVector(nrm, 0.25 + p.lift * 0.3);
      }
    }
    if (p.sweep && p.flow !== 'side') dir.x += p.sweep * 0.4 * frontness;
    // fringe locks fall over the forehead
    if (frontness > 0.4 && p.fringe > 0) dir.lerp(tmp.set(p.part ? Math.sign(-ux) * 0.2 : 0, -0.7, 0.5), 0.7);
    dir.normalize();

    const steps = p.curl > 0.8 ? 16 : 10;
    const seg = L / steps;
    const pts: THREE.Vector3[] = [v.clone()];
    const cur = v.clone();
    const d = dir.clone();
    const curlPhase = r() * Math.PI * 2;
    const gravity = 0.02 + (p.flow === 'down' || p.locs ? 0.16 : 0.06) * Math.min(1, L / (0.3 * h.rx));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      d.y -= gravity * (p.flow === 'up' || p.flow === 'out' ? 0.3 : 1);
      if (p.flow === 'up' && t < 0.6) d.addScaledVector(UP, 0.05);
      d.normalize();
      cur.addScaledVector(d, seg);
      if (p.curl > 0) {
        const ang = curlPhase + t * p.curlF * Math.PI * 2;
        tmp.set(Math.cos(ang), Math.sin(ang) * 0.5, Math.sin(ang)).multiplyScalar(p.curl * (p.curl > 0.8 ? 0.05 : 0.07) * h.rx * Math.min(1, t * 3));
        cur.add(tmp);
      }
      // fringe stops above the brows; everything else stays off the face
      const browY = h.ry * 0.16;
      if (cur.z > h.rz * 0.25 && cur.y < h.ry * 0.42 && cur.y > -h.ry * 1.05) {
        const isFringe = p.fringe > 0 && frontness > 0.4;
        if (isFringe && cur.y < browY) {
          // fringe ends just above the brows (tapered tip, no pile-up)
          if (pts.length >= 3) break;
          cur.y = browY;
        } else if (!isFringe && Math.abs(cur.x) < h.rx * 0.9 && cur.y < h.ry * 0.3) {
          const sx = Math.sign(cur.x || ux || 1);
          cur.x += (sx * h.rx * 0.9 - cur.x) * 0.45;
          d.x += sx * 0.25;
          d.z -= 0.15;
        }
      }
      // keep outside the scalp
      const minR = surfR(cur) * (1.015 + p.shell * 0.4);
      const len = cur.length();
      if (len < minR && cur.y > -h.ry * 0.85) cur.multiplyScalar(minR / len);
      // keep long hair off the shoulders/neck
      if (cur.y < -h.ry * 0.7) {
        const hr = Math.hypot(cur.x, cur.z);
        const minH = h.rx * (cur.z < 0 ? 0.75 : 0.9);
        if (hr < minH) {
          const f = minH / Math.max(hr, 1e-3);
          cur.x *= f;
          cur.z *= f;
        }
      }
      pts.push(cur.clone());
    }
    const w = (p.locs ? 0.1 : 0.15) * p.width * h.rx * (0.75 + 0.5 * r()) * (p.locs ? 1 : 0.5 + 0.5 * Math.min(1, L / (0.45 * h.rx)));
    const tipK = p.locs ? 0.75 : 1 - p.spiky * 0.95;
    const jitter = 0.94 + r() * 0.12;
    const rootJ = root.clone().multiplyScalar(jitter);
    const tipJ = tipC.clone().multiplyScalar(jitter);
    locks.push(
      taperTube(pts, {
        radius: (t) => w * (1 - (1 - tipK) * Math.pow(t, 1.3)) * (t < 0.08 ? 0.6 + t * 5 : 1),
        flat: p.locs ? 1 : p.curl > 0.8 ? 0.75 : 0.42,
        radial: p.locs ? 6 : 5,
        segments: p.curl > 0.8 ? 28 : 14,
        color: (t) => rootJ.clone().lerp(tipJ, smooth(0.35, 1, t)),
        hint: (pt, out) => out.copy(pt).normalize(),
      }),
    );
  }

  // 3. Ties, buns and braids
  const addLump = (c: THREE.Vector3, rad: number, sx = 1, sy = 1, sz = 1) => {
    const g = new THREE.SphereGeometry(rad, 28, 20);
    const pp = g.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
      const k = 1 + 0.08 * wobble(x / rad, y / rad, z / rad, 2.2) + 0.03 * Math.sin(Math.atan2(x, z) * 9 + y * 30);
      pp.setXYZ(i, c.x + x * k * sx, c.y + y * k * sy, c.z + z * k * sz);
    }
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    extras.push(colorize(g, root));
  };
  const tail = (from: THREE.Vector3, len: number, thick: number, bend: number, n = 26) => {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * thick;
      const start = from.clone().add(tmp.set(Math.cos(a) * rr, Math.sin(a) * rr * 0.6, -Math.abs(Math.sin(a)) * rr * 0.4));
      const pts = [start];
      const c = start.clone();
      for (let s = 1; s <= 8; s++) {
        const t = s / 8;
        c.add(tmp.set(Math.cos(a) * thick * 0.12 * t, -len / 8, -bend * (1 - t) * 0.04));
        pts.push(c.clone());
      }
      locks.push(taperTube(pts, { radius: (t) => thick * 0.35 * (1 - 0.85 * t), flat: 0.5, radial: 5, segments: 12, color: (t) => root.clone().lerp(tipC, t), hint: (pt, out) => out.copy(pt).sub(from).setY(0).normalize() }));
    }
  };
  const tieY = -h.ry * 0.2 + p.tieH * h.ry * 1.1;
  const tieZ = -Math.sqrt(Math.max(0.05, 1 - (tieY / h.ry) ** 2)) * h.rz * 1.08;
  switch (p.tie) {
    case 'pony':
    case 'lowpony': {
      const c = new THREE.Vector3(0, tieY, tieZ - 0.01);
      extras.push(colorize(new THREE.TorusGeometry(0.04 * h.rx * 2.4, 0.014, 8, 20).translate(c.x, c.y, c.z), new THREE.Color('#ff7a3d')));
      tail(c.clone().add(tmp.set(0, 0, -0.03)), (p.tie === 'pony' ? 0.75 : 0.6) * h.rx * 2, 0.05 * h.rx * 2.4, 1);
      break;
    }
    case 'bun':
    case 'topbun':
      addLump(new THREE.Vector3(0, p.tie === 'topbun' ? h.ry * 1.08 : tieY, p.tie === 'topbun' ? -h.rz * 0.25 : tieZ - 0.06), 0.15 * h.rx * 2.4 * 0.45, 1, 0.85, 1);
      break;
    case 'spacebuns':
      for (const s of [-1, 1]) addLump(new THREE.Vector3(s * h.rx * 0.68, h.ry * 0.8, -h.rz * 0.15), 0.12 * h.rx * 2.4 * 0.42);
      break;
    case 'half': {
      const c = new THREE.Vector3(0, h.ry * 0.45, -h.rz * 0.98);
      addLump(c, 0.06, 1, 0.8, 0.8);
      break;
    }
    case 'braids':
    case 'braid':
    case 'cornrows': {
      const sides = p.tie === 'braid' ? [0] : [-1, 1];
      for (const s of sides) {
        const start = p.tie === 'braid' ? new THREE.Vector3(0, -h.ry * 0.1, -h.rz * 1.02) : new THREE.Vector3(s * h.rx * 0.88, -h.ry * 0.15, -h.rz * 0.15);
        const end = p.tie === 'braid' ? new THREE.Vector3(0, -h.ry * 2.2, -h.rz * 1.25) : new THREE.Vector3(s * h.rx * 0.85, -h.ry * 2.1, h.rz * 0.45);
        const curve = new THREE.CatmullRomCurve3([start, start.clone().lerp(end, 0.4).add(tmp.set(s * 0.04, 0, s ? 0.05 : -0.08)), end]);
        const n = 12;
        for (let i = 0; i < n; i++) {
          const c = curve.getPoint(i / (n - 1));
          const sc = 0.055 * h.rx * 2.4 * 0.42 * (1 - i * 0.03);
          const g = new THREE.SphereGeometry(1, 14, 10).scale(sc * 1.15, sc * 0.95, sc).rotateZ((i % 2 ? 0.5 : -0.5)).translate(c.x, c.y, c.z);
          g.deleteAttribute('uv');
          extras.push(colorize(g, root.clone().lerp(tipC, i / n)));
        }
        const bandAt = curve.getPoint(1);
        extras.push(colorize(new THREE.TorusGeometry(0.02, 0.008, 6, 14).rotateX(Math.PI / 2).translate(bandAt.x, bandAt.y + 0.02, bandAt.z), new THREE.Color('#e9c46a')));
      }
      if (p.tie === 'cornrows') {
        for (let row = -3; row <= 3; row++) {
          const az0 = row * 0.22;
          const pts: THREE.Vector3[] = [];
          for (let s = 0; s <= 10; s++) {
            const t = s / 10;
            const uy = 0.55 - t * 1.0;
            const azz = az0 * (1 - t * 0.3) + (t > 0.5 ? 0 : 0);
            const rad = Math.sqrt(Math.max(0, 1 - uy * uy));
            const back = Math.PI * t * 0.9;
            const dx = Math.sin(azz) * rad, dz = Math.cos(back) * rad;
            pts.push(deform(h, dx, uy * Math.cos(back * 0.2) + (t > 0.2 ? 0 : 0), dz * (t < 0.5 ? 1 : 1), new THREE.Vector3(), 1.035));
          }
          locks.push(taperTube(pts, { radius: () => 0.016, flat: 0.8, radial: 6, segments: 30, color: () => root.clone(), hint: (pt, out) => out.copy(pt).normalize() }));
        }
      }
      break;
    }
    default:
      break;
  }
  if (p.locs && p.tie === 'topbun') addLump(new THREE.Vector3(0, h.ry * 1.05, -h.rz * 0.2), 0.11);

  const shellColor = '#' + root.clone().multiplyScalar(0.9).getHexString();
  const locksGeo = mergeAll(locks);
  return { shell: p.count === 0 && afro === 0 && p.shell < 0.02 ? shell : shell, shellColor, fade, locks: locksGeo, extras };
}

function colorize(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export { lathe };
