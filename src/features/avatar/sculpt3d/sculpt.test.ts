// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { Field } from './sdf';
import { meshField } from './mesh';

describe('sculpt engine', () => {
  it('meshes a sphere: points on the surface, normals outward, winding matches normals', () => {
    const f = new Field([{ prims: [{ t: 'sphere', c: [0, 1, 0], r: 0.3 }] }], 0.05);
    const g = meshField(f, { cell: 0.03 });
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), ix = g.getIndex()!;
    expect(p.count).toBeGreaterThan(300);
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getY(i) - 1, p.getZ(i));
      expect(Math.abs(r - 0.3)).toBeLessThan(0.004);
      const dot = (p.getX(i) * n.getX(i) + (p.getY(i) - 1) * n.getY(i) + p.getZ(i) * n.getZ(i)) / r;
      expect(dot).toBeGreaterThan(0.98);
    }
    let agree = 0;
    for (let t = 0; t < ix.count; t += 3) {
      const [a, b, c] = [ix.getX(t), ix.getX(t + 1), ix.getX(t + 2)];
      const ux = p.getX(b) - p.getX(a), uy = p.getY(b) - p.getY(a), uz = p.getZ(b) - p.getZ(a);
      const vx = p.getX(c) - p.getX(a), vy = p.getY(c) - p.getY(a), vz = p.getZ(c) - p.getZ(a);
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * n.getX(a) + cy * n.getY(a) + cz * n.getZ(a) > 0) agree++;
    }
    expect(agree / (ix.count / 3)).toBeGreaterThan(0.99);
  });
  it('blends two capsules into one smooth surface and weights the joint across both bones', () => {
    const f = new Field([{ prims: [
      { t: 'cone', a: [0, 1, 0], b: [0, 0.6, 0], ra: 0.06, rb: 0.05, k: 0.04, bone: 1 },
      { t: 'cone', a: [0, 0.6, 0], b: [0, 0.2, 0.05], ra: 0.05, rb: 0.04, k: 0.04, bone: 2 },
    ] }], 0.05);
    const g = meshField(f, { cell: 0.01, skin: 0.03 });
    const p = g.getAttribute('position'), sw = g.getAttribute('skinWeight');
    let mixed = 0;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getY(i) - 0.6) < 0.01) {
        if (sw.getX(i) < 0.9) mixed++;
      }
    }
    expect(mixed).toBeGreaterThan(5);
  });
});

describe('oriented volumes', () => {
  it('matches three.js Euler XYZ rotation', async () => {
    const THREE = await import('three');
    const rot: [number, number, number] = [0.4, -0.7, 1.1];
    const f = new Field([{ prims: [{ t: 'ellipsoid', c: [0, 0, 0], r: [0.02, 0.2, 0.02], rot }] }], 0.01);
    // the long (y) axis, rotated by three.js, must be inside the ellipsoid; the x axis must not
    const tip = new THREE.Vector3(0, 0.15, 0).applyEuler(new THREE.Euler(...rot, 'XYZ'));
    const side = new THREE.Vector3(0.15, 0, 0).applyEuler(new THREE.Euler(...rot, 'XYZ'));
    expect(f.eval(tip.x, tip.y, tip.z)).toBeLessThan(0);
    expect(f.eval(side.x, side.y, side.z)).toBeGreaterThan(0.05);
  });
});
