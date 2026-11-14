import * as THREE from 'three';

export interface TubeOpts {
  /** radius at t (0 root … 1 tip) */
  radius: (t: number) => number;
  /** cross-section flattening along the binormal (1 = round) */
  flat?: number;
  radial?: number;
  segments?: number;
  /** optional vertex colour at t (for ombré / tips) */
  color?: (t: number) => THREE.Color;
  /** writes a direction the flat side should face (e.g. away from the scalp) */
  hint?: (p: THREE.Vector3, out: THREE.Vector3) => void;
}

/** Tapered tube along points: the workhorse for hair locks, brows, lashes, horns and jewellery. */
export function taperTube(points: THREE.Vector3[], o: TubeOpts): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const segs = o.segments ?? Math.max(6, points.length * 3);
  const radial = o.radial ?? 6;
  const frames = o.hint ? null : curve.computeFrenetFrames(segs, false);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  const T = new THREE.Vector3(), HN = new THREE.Vector3(), HB = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    const r = Math.max(0, o.radius(t));
    let N: THREE.Vector3, B: THREE.Vector3;
    if (o.hint) {
      curve.getTangentAt(t, T);
      o.hint(P, HN);
      HN.addScaledVector(T, -HN.dot(T));
      if (HN.lengthSq() < 1e-8) HN.set(T.y, -T.x, 0);
      HN.normalize();
      HB.crossVectors(T, HN).normalize();
      // flattened axis = HN (points away from the scalp), wide axis = HB
      N = HB;
      B = HN;
    } else {
      N = frames!.normals[i];
      B = frames!.binormals[i];
    }
    const c = o.color?.(t);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a) * r, cy = Math.sin(a) * r * (o.flat ?? 1);
      pos.push(P.x + N.x * cx + B.x * cy, P.y + N.y * cx + B.y * cy, P.z + N.z * cx + B.z * cy);
      if (c) col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + ((j + 1) % radial), c2 = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial);
      idx.push(a, c2, b, b, c2, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Merge many small indexed geometries (same attributes) into a single draw call. */
export function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!geos.length) return null;
  let vCount = 0, iCount = 0;
  const hasColor = geos.every((g) => !!g.getAttribute('color'));
  for (const g of geos) {
    vCount += g.getAttribute('position').count;
    iCount += g.getIndex()!.count;
  }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), col = hasColor ? new Float32Array(vCount * 3) : null;
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const n = g.getAttribute('normal') as THREE.BufferAttribute;
    pos.set(p.array as Float32Array, vo * 3);
    nor.set(n.array as Float32Array, vo * 3);
    if (col) col.set((g.getAttribute('color') as THREE.BufferAttribute).array as Float32Array, vo * 3);
    const gi = g.getIndex()!.array;
    for (let k = 0; k < gi.length; k++) idx[io + k] = gi[k] + vo;
    vo += p.count;
    io += gi.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/** Points along a quadratic-ish arc, handy for horns, lashes and wings. */
export function arc(from: THREE.Vector3, ctrl: THREE.Vector3, to: THREE.Vector3, n = 8): THREE.Vector3[] {
  const c = new THREE.QuadraticBezierCurve3(from, ctrl, to);
  return c.getPoints(n);
}
