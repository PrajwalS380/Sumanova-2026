import * as THREE from 'three';
import type { Field, V3 } from './sdf';

export interface MeshOptions {
  /** grid cell size (world units). Smaller = finer detail, more triangles. */
  cell: number;
  /** extra margin around the field's bounds */
  pad?: number;
  /** clamp the meshed region (e.g. only the head area of a hair field) */
  bounds?: { min: V3; max: V3 };
  /** compute skinIndex/skinWeight from the volumes' bones (blend softness, world units) */
  skin?: number;
  /** per-vertex UV (x, y, z, tag, normal) — for fabric patterns */
  uv?: (x: number, y: number, z: number, tag: number, n: V3) => [number, number];
  /**
   * How much faster than 1 unit/unit the field may change (lofts + displacement exceed 1).
   * Raises the culling margin so no block that holds surface is skipped (which leaves holes).
   */
  lipschitz?: number;
  /** take skin weights from another field (e.g. clothing borrows the body's) where it lies within `within` of it */
  weightField?: { field: Field; tau: number; within: number; /** limb bones a vertex may only borrow if its own surface belongs to a limb (by volume tag) */ limbs?: number[]; limbTag?: (tag: number) => boolean; /** decide limb surfaces by the field's limb parts (Part.limb) */ byPart?: boolean; /** below this height a limb surface follows only limb bones */ limbOnlyBelow?: number; /** only borrow above this height */ minY?: number };
  /** per-vertex colour (x, y, z, tag, normal) — e.g. hair root→tip */
  color?: (x: number, y: number, z: number, tag: number, n: V3) => [number, number, number];
}

/**
 * Narrow-band Surface Nets: one vertex per surface cell, projected onto the exact surface,
 * with normals from the field's gradient — a smooth, watertight, evenly spaced mesh.
 */
export function meshField(f: Field, o: MeshOptions): THREE.BufferGeometry {
  const h = o.cell;
  const pad = o.pad ?? h * 2;
  const lo = o.bounds?.min ?? f.min, hi = o.bounds?.max ?? f.max;
  const ox = lo[0] - pad, oy = lo[1] - pad, oz = lo[2] - pad;
  const S0 = 8; // block size (cells)
  const nx = Math.ceil((hi[0] + pad - ox) / h / S0) * S0 + 1;
  const ny = Math.ceil((hi[1] + pad - oy) / h / S0) * S0 + 1;
  const nz = Math.ceil((hi[2] + pad - oz) / h / S0) * S0 + 1;
  const idx = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const val = new Float32Array(nx * ny * nz);
  const done = new Uint8Array(nx * ny * nz);

  // 1-2. hierarchical culling: big blocks (8 cells), then 2-cell sub-blocks, tested at their
  //      centres (the field is ~1-Lipschitz; smooth blends add a little slack). Only nodes of
  //      sub-blocks that can hold surface are evaluated; the rest inherit the block's sign.
  const S = 8, s2 = 2;
  const margin = 1.35 * (o.lipschitz ?? 1);
  const bx = (nx - 1) / S, by = (ny - 1) / S, bz = (nz - 1) / S;
  for (let k = 0; k < bz; k++) for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
    const dc = f.eval(ox + (i + 0.5) * S * h, oy + (j + 0.5) * S * h, oz + (k + 0.5) * S * h);
    if (Math.abs(dc) > ((S * h * Math.sqrt(3)) / 2) * margin + h) {
      for (let kk = 0; kk <= S; kk++) for (let jj = 0; jj <= S; jj++) for (let ii = 0; ii <= S; ii++) {
        const id = idx(i * S + ii, j * S + jj, k * S + kk);
        if (done[id] === 0) {
          val[id] = dc;
          done[id] = 2;
        }
      }
      continue;
    }
    for (let sk = 0; sk < S / s2; sk++) for (let sj = 0; sj < S / s2; sj++) for (let si = 0; si < S / s2; si++) {
      const x0 = i * S + si * s2, y0 = j * S + sj * s2, z0 = k * S + sk * s2;
      const ds = f.eval(ox + (x0 + 1) * h, oy + (y0 + 1) * h, oz + (z0 + 1) * h);
      const near = Math.abs(ds) < ((s2 * h * Math.sqrt(3)) / 2) * margin + h * 0.5;
      for (let kk = 0; kk <= s2; kk++) for (let jj = 0; jj <= s2; jj++) for (let ii = 0; ii <= s2; ii++) {
        const id = idx(x0 + ii, y0 + jj, z0 + kk);
        if (done[id] === 1) continue;
        if (near) {
          val[id] = f.eval(ox + (x0 + ii) * h, oy + (y0 + jj) * h, oz + (z0 + kk) * h);
          done[id] = 1;
        } else if (done[id] === 0) {
          val[id] = ds;
          done[id] = 2;
        }
      }
    }
  }

  // 3. one vertex per cell with a sign change (flat index arithmetic: this loop visits every cell)
  const sx1 = nx - 1, sy1 = ny - 1, sz1 = nz - 1;
  const neg = new Uint8Array(nx * ny * nz);
  for (let q = 0; q < neg.length; q++) neg[q] = val[q] < 0 ? 1 : 0;
  const cellVert = new Int32Array(sx1 * sy1 * sz1).fill(-1);
  const off = [0, 1, nx, nx + 1, nx * ny, nx * ny + 1, nx * ny + nx, nx * ny + nx + 1];
  const EA = [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3];
  const EB = [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7];
  const pos: number[] = [];
  const corner = new Float32Array(8);
  for (let k = 0; k < sz1; k++) for (let j = 0; j < sy1; j++) {
    let base = (k * ny + j) * nx;
    let cbase = (k * sy1 + j) * sx1;
    for (let i = 0; i < sx1; i++, base++, cbase++) {
      const n0 = neg[base];
      if (n0 === neg[base + 1] && n0 === neg[base + off[2]] && n0 === neg[base + off[3]] && n0 === neg[base + off[4]] && n0 === neg[base + off[5]] && n0 === neg[base + off[6]] && n0 === neg[base + off[7]]) continue;
      for (let c = 0; c < 8; c++) corner[c] = val[base + off[c]];
      let sxx = 0, syy = 0, szz = 0, n = 0;
      for (let e = 0; e < 12; e++) {
        const a = EA[e], b = EB[e];
        const va = corner[a], vb = corner[b];
        if (va < 0 === vb < 0) continue;
        const t = va / (va - vb);
        sxx += (a & 1) + ((b & 1) - (a & 1)) * t;
        syy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
        szz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
        n++;
      }
      cellVert[cbase] = pos.length / 3;
      pos.push(ox + (i + sxx / n) * h, oy + (j + syy / n) * h, oz + (k + szz / n) * h);
    }
  }

  // 4. quads around every sign-changing grid edge
  const index: number[] = [];
  const cv = (i: number, j: number, k: number) => cellVert[(k * sy1 + j) * sx1 + i];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) index.push(a, c, b, a, d, c);
    else index.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) {
    let id = (k * ny + j) * nx + 1;
    for (let i = 1; i < nx - 1; i++, id++) {
      const v0 = neg[id];
      const ex = v0 !== neg[id + 1], ey = v0 !== neg[id + nx], ez = v0 !== neg[id + nx * ny];
      if (!ex && !ey && !ez) continue;
      const flip = v0 === 0;
      if (ex) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), flip);
      if (ey) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), flip);
      if (ez) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), flip);
    }
  }

  // 5. project onto the true surface, normals from the gradient, weights / uv / colour
  const n = pos.length / 3;
  const nor = new Float32Array(n * 3);
  const P = new Float32Array(pos);
  const g: V3 = [0, 0, 0];
  const e = h * 0.35;
  const skinIdx = o.skin ? new Uint16Array(n * 4) : null;
  const skinW = o.skin ? new Float32Array(n * 4) : null;
  const uvs = o.uv ? new Float32Array(n * 2) : null;
  const cols = o.color ? new Float32Array(n * 3) : null;
  const bi: number[] = [], bw: number[] = [];
  for (let v = 0; v < n; v++) {
    let x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    // one Newton step onto the exact surface; the same gradient gives the normal
    const d = f.eval(x, y, z);
    g[0] = f.eval(x + e, y, z) - d;
    g[1] = f.eval(x, y + e, z) - d;
    g[2] = f.eval(x, y, z + e) - d;
    const gl = Math.sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) || 1;
    const N: V3 = [g[0] / gl, g[1] / gl, g[2] / gl];
    const step = Math.max(-h * 0.6, Math.min(h * 0.6, d * (e / gl)));
    x -= N[0] * step;
    y -= N[1] * step;
    z -= N[2] * step;
    P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
    nor[v * 3] = N[0]; nor[v * 3 + 1] = N[1]; nor[v * 3 + 2] = N[2];
    if (!skinIdx && !uvs && !cols) continue;
    f.eval(x, y, z); // refresh per-prim distances for weights / tags
    if (skinIdx && skinW) {
      const wf = o.weightField;
      f.weights(o.skin!, bi, bw);
      if (wf && y > (wf.minY ?? -Infinity) && wf.field.eval(x, y, z) < wf.within) {
        const ownLimb = !wf.limbs || (wf.byPart ? f.limbAt() : wf.limbTag ? wf.limbTag(f.tagAt()) : bi.some((b, q) => bw[q] > 0.05 && wf.limbs!.includes(b)));
        const bi2: number[] = [], bw2: number[] = [];
        wf.field.weights(wf.tau, bi2, bw2);
        // a garment's body panel (e.g. a boxy sweatshirt hanging beside the arm) never follows the arm
        if (!ownLimb) for (let q = bi2.length - 1; q >= 0; q--) if (wf.limbs!.includes(bi2[q])) { bi2.splice(q, 1); bw2.splice(q, 1); }
        // …and a loose sleeve's inner side, hanging next to the ribs, never stays behind with the chest
        if (ownLimb && wf.limbs && wf.limbOnlyBelow != null && y < wf.limbOnlyBelow) {
          const hasLimb = bi2.some((b) => wf.limbs!.includes(b));
          if (hasLimb) for (let q = bi2.length - 1; q >= 0; q--) if (!wf.limbs.includes(bi2[q])) { bi2.splice(q, 1); bw2.splice(q, 1); }
          else { bi2.length = bw2.length = 0; for (let q = 0; q < bi.length; q++) if (wf.limbs.includes(bi[q])) { bi2.push(bi[q]); bw2.push(bw[q]); } }
        }
        const tot = bw2.reduce((a, b) => a + b, 0);
        if (tot > 0.2) {
          bi.length = bw.length = 0;
          for (let q = 0; q < bi2.length; q++) { bi.push(bi2[q]); bw.push(bw2[q] / tot); }
        } else if (!ownLimb && wf.limbs) {
          // the body under this panel is all arm (a jacket's side beside the arm): it stays with the chest
          let kept = 0;
          for (let q = bi.length - 1; q >= 0; q--) if (wf.limbs.includes(bi[q])) { bi.splice(q, 1); bw.splice(q, 1); } else kept += bw[q];
          if (kept > 1e-4) for (let q = 0; q < bw.length; q++) bw[q] /= kept;
          else { bi.length = bw.length = 0; bi.push(1); bw.push(1); }
        }
        f.eval(x, y, z); // restore this field's per-prim state for tags
      }
      for (let q = 0; q < 4; q++) {
        skinIdx[v * 4 + q] = bi[q] ?? 0;
        skinW[v * 4 + q] = bw[q] ?? 0;
      }
    }
    if (uvs || cols) {
      const tag = f.tagAt();
      if (uvs) uvs.set(o.uv!(x, y, z, tag, N), v * 2);
      if (cols) cols.set(o.color!(x, y, z, tag, N), v * 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (skinIdx && skinW) {
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIdx, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinW, 4));
  }
  if (uvs) geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (cols) geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Tiny LRU cache for generated geometry (meshing costs tens of ms; reuse across renders). */
export class GeoCache<T> {
  private m = new Map<string, T>();
  constructor(private max = 64) {}
  get(key: string, make: () => T): T {
    const hit = this.m.get(key);
    if (hit) {
      this.m.delete(key);
      this.m.set(key, hit);
      return hit;
    }
    const v = make();
    this.m.set(key, v);
    if (this.m.size > this.max) {
      const first = this.m.keys().next().value as string;
      // not disposed: a mounted mesh may still be drawing it (GC frees it once unused)
      this.m.delete(first);
    }
    return v;
  }
}
