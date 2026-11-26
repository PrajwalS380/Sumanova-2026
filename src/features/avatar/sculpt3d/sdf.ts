/**
 * Signed-distance sculpting. Shapes are described as smooth volumes (capsules that taper,
 * ellipsoids, rounded boxes, tori) that blend into each other with a soft "clay" union, so a
 * body, a hand or a hairstyle becomes ONE continuous surface instead of parts placed side by
 * side. `mesh.ts` turns a field into a smooth polygon mesh.
 *
 * Coordinates are the avatar's world units (feet at y = 0, about 2.3 tall).
 */

export type V3 = [number, number, number];

interface PrimBase {
  /** blend radius with the rest of its part (0 = hard union) */
  k?: number;
  /** skeleton bone this volume belongs to (skin weights) */
  bone?: number;
  /** free tag (garment region, hair lock id …) handed to UV / colour callbacks */
  tag?: number;
}
export type Prim =
  | (PrimBase & { t: 'sphere'; c: V3; r: number })
  /** tapered capsule from a (radius ra) to b (radius rb) */
  | (PrimBase & { t: 'cone'; a: V3; b: V3; ra: number; rb: number })
  | (PrimBase & { t: 'ellipsoid'; c: V3; r: V3; rot?: V3 })
  | (PrimBase & { t: 'box'; c: V3; s: V3; round: number; rot?: V3 })
  /** torus around local y: major radius R, tube radius r */
  | (PrimBase & { t: 'torus'; c: V3; R: number; r: number; rot?: V3 })
  /** any custom distance function, bounded by a sphere (c, br) */
  | (PrimBase & { t: 'fn'; f: (x: number, y: number, z: number) => number; c: V3; /** half-size of its bounding box */ ext: V3 });

/** half-space clip: keeps the side where dot(p - o, n) <= 0 */
export interface Clip { o: V3; n: V3; k?: number }

export interface Part {
  prims: Prim[];
  /** blend radius of this part into the whole */
  k?: number;
  /** position-dependent blend radius (e.g. arms melt into the shoulder but not into the ribs) */
  kAt?: (x: number, y: number, z: number) => number;
  clips?: Clip[];
  /** carve this part out of the whole instead of adding it */
  subtract?: boolean;
  /** surface displacement (folds, curls, texture) — keep it small (≪ cell size × 3) */
  disp?: (x: number, y: number, z: number) => number;
}

// ---------------------------------------------------------------------------- compiled prims

const enum K { Sphere, Cone, Ellipsoid, Box, Torus, Fn }

interface CPrim {
  kind: K;
  part: number;
  k: number;
  bone: number;
  tag: number;
  // bounding sphere
  bx: number; by: number; bz: number; br: number;
  /** bounding box half-size (defaults to br on every axis) */
  ex: number; ey: number; ez: number;
  // params
  ax: number; ay: number; az: number; bx2: number; by2: number; bz2: number; ra: number; rb: number;
  // ellipsoid / box / torus
  sx: number; sy: number; sz: number; round: number;
  m: number[] | null; // world → local rotation (row-major 3x3)
  fn: ((x: number, y: number, z: number) => number) | null;
}

function rotMatrix(r: V3 | undefined): number[] | null {
  if (!r || (r[0] === 0 && r[1] === 0 && r[2] === 0)) return null;
  // local → world = three.js Euler 'XYZ' (Rx · Ry · Rz); we need world → local = its transpose.
  const a = Math.cos(r[0]), b = Math.sin(r[0]), c = Math.cos(r[1]), d = Math.sin(r[1]), e = Math.cos(r[2]), f = Math.sin(r[2]);
  const M00 = c * e, M01 = -c * f, M02 = d;
  const M10 = a * f + b * e * d, M11 = a * e - b * f * d, M12 = -b * c;
  const M20 = b * f - a * e * d, M21 = b * e + a * f * d, M22 = a * c;
  return [M00, M10, M20, M01, M11, M21, M02, M12, M22];
}

function compile(p: Prim, part: number): CPrim {
  const base: CPrim = { kind: K.Sphere, part, k: p.k ?? 0, bone: p.bone ?? 0, tag: p.tag ?? 0, bx: 0, by: 0, bz: 0, br: 0, ex: -1, ey: -1, ez: -1, ax: 0, ay: 0, az: 0, bx2: 0, by2: 0, bz2: 0, ra: 0, rb: 0, sx: 0, sy: 0, sz: 0, round: 0, m: null, fn: null };
  switch (p.t) {
    case 'sphere':
      Object.assign(base, { kind: K.Sphere, ax: p.c[0], ay: p.c[1], az: p.c[2], ra: p.r, bx: p.c[0], by: p.c[1], bz: p.c[2], br: p.r });
      break;
    case 'cone': {
      const [ax, ay, az] = p.a, [bx, by, bz] = p.b;
      const len = Math.hypot(bx - ax, by - ay, bz - az);
      Object.assign(base, { kind: K.Cone, ax, ay, az, bx2: bx, by2: by, bz2: bz, ra: p.ra, rb: p.rb, bx: (ax + bx) / 2, by: (ay + by) / 2, bz: (az + bz) / 2, br: len / 2 + Math.max(p.ra, p.rb) });
      break;
    }
    case 'ellipsoid':
      Object.assign(base, { kind: K.Ellipsoid, ax: p.c[0], ay: p.c[1], az: p.c[2], sx: p.r[0], sy: p.r[1], sz: p.r[2], m: rotMatrix(p.rot), bx: p.c[0], by: p.c[1], bz: p.c[2], br: Math.max(...p.r) });
      break;
    case 'box':
      Object.assign(base, { kind: K.Box, ax: p.c[0], ay: p.c[1], az: p.c[2], sx: p.s[0], sy: p.s[1], sz: p.s[2], round: p.round, m: rotMatrix(p.rot), bx: p.c[0], by: p.c[1], bz: p.c[2], br: Math.hypot(...p.s) });
      break;
    case 'fn':
      Object.assign(base, { kind: K.Fn, fn: p.f, bx: p.c[0], by: p.c[1], bz: p.c[2], br: Math.max(...p.ext), ex: p.ext[0], ey: p.ext[1], ez: p.ext[2] });
      break;
    case 'torus':
      Object.assign(base, { kind: K.Torus, ax: p.c[0], ay: p.c[1], az: p.c[2], ra: p.R, rb: p.r, m: rotMatrix(p.rot), bx: p.c[0], by: p.c[1], bz: p.c[2], br: p.R + p.r });
      break;
  }
  if (base.ex < 0) base.ex = base.ey = base.ez = base.br;
  return base;
}

/** Distance from a point to one compiled primitive. */
function primDist(q: CPrim, x: number, y: number, z: number): number {
  switch (q.kind) {
    case K.Sphere:
      { const dx = x - q.ax, dy = y - q.ay, dz = z - q.az; return Math.sqrt(dx * dx + dy * dy + dz * dz) - q.ra; }
    case K.Cone:
      return roundCone(x, y, z, q);
    case K.Ellipsoid: {
      let px = x - q.ax, py = y - q.ay, pz = z - q.az;
      if (q.m) {
        const m = q.m;
        const lx = m[0] * px + m[1] * py + m[2] * pz, ly = m[3] * px + m[4] * py + m[5] * pz, lz = m[6] * px + m[7] * py + m[8] * pz;
        px = lx; py = ly; pz = lz;
      }
      const ax = px / q.sx, ay = py / q.sy, az = pz / q.sz;
      const bx = ax / q.sx, by = ay / q.sy, bz = az / q.sz;
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
      return k1 < 1e-9 ? -Math.min(q.sx, q.sy, q.sz) : (k0 * (k0 - 1)) / k1;
    }
    case K.Box: {
      let px = x - q.ax, py = y - q.ay, pz = z - q.az;
      if (q.m) {
        const m = q.m;
        const lx = m[0] * px + m[1] * py + m[2] * pz, ly = m[3] * px + m[4] * py + m[5] * pz, lz = m[6] * px + m[7] * py + m[8] * pz;
        px = lx; py = ly; pz = lz;
      }
      const qx = Math.abs(px) - q.sx + q.round, qy = Math.abs(py) - q.sy + q.round, qz = Math.abs(pz) - q.sz + q.round;
      const mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0, mz = qz > 0 ? qz : 0;
      return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - q.round;
    }
    case K.Torus: {
      let px = x - q.ax, py = y - q.ay, pz = z - q.az;
      if (q.m) {
        const m = q.m;
        const lx = m[0] * px + m[1] * py + m[2] * pz, ly = m[3] * px + m[4] * py + m[5] * pz, lz = m[6] * px + m[7] * py + m[8] * pz;
        px = lx; py = ly; pz = lz;
      }
      const t = Math.sqrt(px * px + pz * pz) - q.ra;
      return Math.sqrt(t * t + py * py) - q.rb;
    }
    case K.Fn:
      return q.fn!(x, y, z);
  }
}

/**
 * Like `loft`, but the front and back of each slice have their own depth (chest vs upper back,
 * belly vs lumbar curve, seat) — a torso seen from the side is not symmetric.
 */
export function loft2(y0: number, y1: number, wKeys: [number, number][], fKeys: [number, number][], bKeys: [number, number][]) {
  const front = loft(y0, y1, wKeys, fKeys);
  const back = loft(y0, y1, wKeys, bKeys);
  return (x: number, y: number, z: number) => (z >= 0 ? front(x, y, z) : back(x, y, z));
}

/**
 * A "lofted" volume: horizontal elliptical slices whose half-width, half-depth and z-offset
 * follow smooth profiles along y — how a sculptor blocks in a torso or a skirt.
 * Profiles are [y, value] keys (ascending y), interpolated with smoothstep.
 */
export function loft(y0: number, y1: number, wKeys: [number, number][], dKeys: [number, number][], zKeys: [number, number][] = [[y0, 0]]) {
  // Catmull-Rom through the keys: smooth slopes everywhere (no flat "terraces" at the keys)
  const at = (keys: [number, number][], y: number) => {
    const n = keys.length;
    if (y <= keys[0][0]) return keys[0][1];
    if (y >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 1;
    while (keys[i][0] < y) i++;
    const [ya, a] = keys[i - 1], [yb, b] = keys[i];
    const slope = (j: number) => {
      const l = keys[Math.max(0, j - 1)], r = keys[Math.min(n - 1, j + 1)];
      return (r[1] - l[1]) / (r[0] - l[0]);
    };
    const hh = yb - ya, t = (y - ya) / hh;
    const m0 = slope(i - 1) * hh, m1 = slope(i) * hh;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b + (t3 - t2) * m1;
  };
  // pre-sampled every 2 mm: evaluation is then a cheap linear lookup
  const N = Math.max(2, Math.ceil((y1 - y0) / 0.002) + 1);
  const LW = new Float32Array(N), LD = new Float32Array(N), LZ = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const yy = y0 + ((y1 - y0) * i) / (N - 1);
    LW[i] = at(wKeys, yy);
    LD[i] = at(dKeys, yy);
    LZ[i] = at(zKeys, yy);
  }
  return (x: number, y: number, z: number) => {
    const yc = Math.min(y1, Math.max(y0, y));
    const fi = ((yc - y0) / (y1 - y0)) * (N - 1);
    const i0 = Math.min(N - 2, Math.floor(fi)), t = fi - i0;
    const w = LW[i0] + (LW[i0 + 1] - LW[i0]) * t, d = LD[i0] + (LD[i0 + 1] - LD[i0]) * t, zc = LZ[i0] + (LZ[i0 + 1] - LZ[i0]) * t;
    const ex = x / w, ez = (z - zc) / d;
    const r = Math.sqrt(ex * ex + ez * ez);
    const px = ex * w, pz = ez * d;
    // distance to the ellipse slice (scaled by the local radius — close to a true distance)
    const side = (r - 1) * (r > 1e-6 ? Math.sqrt(px * px + pz * pz) / r : Math.min(w, d));
    const cap = Math.max(y0 - y, y - y1);
    if (cap <= 0) return side;
    const sp = side > 0 ? side : 0;
    return Math.sqrt(sp * sp + cap * cap) + Math.min(Math.max(side, cap), 0);
  };
}

/** Inigo Quilez's exact round-cone distance. */
function roundCone(px: number, py: number, pz: number, q: CPrim): number {
  const bax = q.bx2 - q.ax, bay = q.by2 - q.ay, baz = q.bz2 - q.az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = q.ra - q.rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - q.ax, pay = py - q.ay, paz = pz - q.az;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - q.rb;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - q.ra;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - q.ra;
}

/** Polynomial smooth minimum — the "clay" blend. */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

// ---------------------------------------------------------------------------- field

const FAR = 1e3;

/**
 * A compiled sculpt: evaluate distance anywhere, fast (prims are bucketed in a grid so
 * each point only looks at the volumes near it).
 */
export class Field {
  readonly prims: CPrim[] = [];
  readonly parts: Part[];
  private bucket: Map<number, Int32Array> = new Map();
  private grid: (Int32Array | null)[] = [];
  private g0: V3 = [0, 0, 0];
  private gn: V3 = [0, 0, 0];
  private cell: number;
  readonly min: V3;
  readonly max: V3;
  /** scratch: per-prim distance of the last `eval` (for weights / tags) */
  private lastIdx: Int32Array = new Int32Array(0);
  private lastD: Float64Array = new Float64Array(0);
  /** per-part distance and blend radius at the last evaluated point */
  private partD: Float64Array;
  private partK: Float64Array;
  private partSeen: Uint8Array;
  lastCount = 0;

  constructor(parts: Part[], band: number, cell = 0.08) {
    this.parts = parts;
    parts.forEach((pt, i) => pt.prims.forEach((p) => this.prims.push(compile(p, i))));
    this.cell = cell;
    const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
    const maxK = Math.max(0, ...parts.map((p) => (p.kAt ? 0.08 : p.k ?? 0)));
    this.prims.forEach((q, i) => {
      const m = q.k + maxK + band;
      const rx = q.ex + m, ry = q.ey + m, rz = q.ez + m;
      lo[0] = Math.min(lo[0], q.bx - rx); lo[1] = Math.min(lo[1], q.by - ry); lo[2] = Math.min(lo[2], q.bz - rz);
      hi[0] = Math.max(hi[0], q.bx + rx); hi[1] = Math.max(hi[1], q.by + ry); hi[2] = Math.max(hi[2], q.bz + rz);
      const x0 = Math.floor((q.bx - rx) / cell), x1 = Math.floor((q.bx + rx) / cell);
      const y0 = Math.floor((q.by - ry) / cell), y1 = Math.floor((q.by + ry) / cell);
      const z0 = Math.floor((q.bz - rz) / cell), z1 = Math.floor((q.bz + rz) / cell);
      for (let a = x0; a <= x1; a++) for (let b = y0; b <= y1; b++) for (let c = z0; c <= z1; c++) {
        const key = this.key(a, b, c);
        const cur = this.bucket.get(key);
        if (!cur) this.bucket.set(key, Int32Array.of(i));
        else {
          const n = new Int32Array(cur.length + 1);
          n.set(cur);
          n[cur.length] = i;
          this.bucket.set(key, n);
        }
      }
    });
    this.min = lo;
    this.max = hi;
    // flatten the bucket map into a dense array over the bounds (fast lookup in eval)
    this.g0 = [Math.floor(lo[0] / cell), Math.floor(lo[1] / cell), Math.floor(lo[2] / cell)];
    this.gn = [Math.floor(hi[0] / cell) - this.g0[0] + 1, Math.floor(hi[1] / cell) - this.g0[1] + 1, Math.floor(hi[2] / cell) - this.g0[2] + 1];
    this.grid = new Array(this.gn[0] * this.gn[1] * this.gn[2]).fill(null);
    for (let a = 0; a < this.gn[0]; a++) for (let b = 0; b < this.gn[1]; b++) for (let c = 0; c < this.gn[2]; c++) {
      this.grid[(c * this.gn[1] + b) * this.gn[0] + a] = this.bucket.get(this.key(a + this.g0[0], b + this.g0[1], c + this.g0[2])) ?? null;
    }
    this.lastIdx = new Int32Array(this.prims.length);
    this.lastD = new Float64Array(this.prims.length);
    this.partD = new Float64Array(parts.length);
    this.partK = new Float64Array(parts.length);
    this.partSeen = new Uint8Array(parts.length);
  }

  private key(a: number, b: number, c: number) {
    return ((a + 512) * 1024 + (b + 512)) * 1024 + (c + 512);
  }

  /** Signed distance (negative inside). Records per-prim distances for `weights`/`tagAt`. */
  eval(x: number, y: number, z: number): number {
    const a = Math.floor(x / this.cell) - this.g0[0], b = Math.floor(y / this.cell) - this.g0[1], c = Math.floor(z / this.cell) - this.g0[2];
    this.lastCount = 0;
    this.partSeen.fill(0);
    if (a < 0 || b < 0 || c < 0 || a >= this.gn[0] || b >= this.gn[1] || c >= this.gn[2]) return FAR;
    const list = this.grid[(c * this.gn[1] + b) * this.gn[0] + a];
    if (!list) return FAR;
    const parts = this.parts, prims = this.prims;
    let total = FAR;
    let curPart = -1;
    let acc = FAR;
    // bucket lists are in prim order, so parts arrive grouped (subtractions are the last parts)
    for (let i = 0; i <= list.length; i++) {
      const q = i < list.length ? prims[list[i]] : null;
      if (!q || q.part !== curPart) {
        if (curPart >= 0) {
          const pt = parts[curPart];
          let d = acc;
          if (pt.clips) for (const c of pt.clips) d = smax(d, (x - c.o[0]) * c.n[0] + (y - c.o[1]) * c.n[1] + (z - c.o[2]) * c.n[2], c.k ?? 0);
          if (pt.disp && d < 0.08) d += pt.disp(x, y, z);
          const kk = pt.kAt ? pt.kAt(x, y, z) : pt.k ?? 0;
          this.partD[curPart] = d;
          this.partK[curPart] = kk;
          this.partSeen[curPart] = 1;
          total = pt.subtract ? smax(total, -d, kk) : smin(total, d, kk);
        }
        if (!q) break;
        curPart = q.part;
        acc = FAR;
      }
      const d = primDist(q, x, y, z);
      this.lastIdx[this.lastCount] = list[i];
      this.lastD[this.lastCount++] = d;
      acc = q.k > 0 ? smin(acc, d, q.k) : d < acc ? d : acc;
    }
    return total;
  }

  /** Gradient (unnormalised) by central differences. */
  grad(x: number, y: number, z: number, e: number, out: V3): V3 {
    out[0] = this.eval(x + e, y, z) - this.eval(x - e, y, z);
    out[1] = this.eval(x, y + e, z) - this.eval(x, y - e, z);
    out[2] = this.eval(x, y, z + e) - this.eval(x, y, z - e);
    return out;
  }

  /**
   * Bone weights for the point last passed to `eval`: volumes close to the surface pull the
   * vertex with them, blended smoothly across joints. Returns up to 4 (bone, weight) pairs.
   */
  weights(tau: number, outIdx: number[], outW: number[]) {
    // 1. which parts own this bit of surface: a part only shares a vertex where it actually
    //    blends with its neighbour (its blend radius), so a hanging arm never drags the ribs.
    let dPartMin = Infinity;
    for (let p = 0; p < this.parts.length; p++) if (this.partSeen[p] && !this.parts[p].subtract) dPartMin = Math.min(dPartMin, this.partD[p]);
    const partW = new Map<number, number>();
    for (let p = 0; p < this.parts.length; p++) {
      if (!this.partSeen[p] || this.parts[p].subtract) continue;
      const w = Math.exp(-Math.max(0, this.partD[p] - dPartMin) / Math.max(0.002, this.partK[p] * 0.5));
      if (w > 1e-3) partW.set(p, w);
    }
    // 2. within each part, nearby volumes share the vertex smoothly (joint blending)
    const dminIn = new Map<number, number>();
    for (let i = 0; i < this.lastCount; i++) {
      const q = this.prims[this.lastIdx[i]];
      if (!partW.has(q.part)) continue;
      dminIn.set(q.part, Math.min(dminIn.get(q.part) ?? Infinity, this.lastD[i]));
    }
    const perPart = new Map<number, Map<number, number>>();
    for (let i = 0; i < this.lastCount; i++) {
      const q = this.prims[this.lastIdx[i]];
      if (!partW.has(q.part)) continue;
      const w = Math.exp(-Math.max(0, this.lastD[i] - dminIn.get(q.part)!) / tau);
      if (w < 1e-3) continue;
      let m = perPart.get(q.part);
      if (!m) perPart.set(q.part, (m = new Map()));
      m.set(q.bone, (m.get(q.bone) ?? 0) + w);
    }
    const acc = new Map<number, number>();
    for (const [p, m] of perPart) {
      const tot = [...m.values()].reduce((a, b) => a + b, 0) || 1;
      const pw = partW.get(p)!;
      for (const [bone, w] of m) acc.set(bone, (acc.get(bone) ?? 0) + (pw * w) / tot);
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, e) => s + e[1], 0) || 1;
    outIdx.length = outW.length = 0;
    for (const [b, w] of top) {
      outIdx.push(b);
      outW.push(w / sum);
    }
  }

  /** Tag of the closest (non-subtracting) volume at the last evaluated point. */
  tagAt(): number {
    let best = Infinity, tag = 0;
    for (let i = 0; i < this.lastCount; i++) {
      const q = this.prims[this.lastIdx[i]];
      if (this.parts[q.part].subtract) continue;
      if (this.lastD[i] < best) {
        best = this.lastD[i];
        tag = q.tag;
      }
    }
    return tag;
  }
}
