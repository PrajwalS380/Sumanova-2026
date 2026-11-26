// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { BODIES, HEADS, NOSES, EARS } from '../look/face';
import { HAIRSTYLES, hairId } from '../look/hair';
import { headFromParams } from '../sculptV2';
import { bodyGeometry, feetGeometry, handsGeometry } from './rig';
import { bottomGeometry, dressGeometry, shoeGeometry, topGeometry } from './garments';
import { groomHair } from './groom';
import { headGeometry } from './head';

/** Every edge of a closed surface is shared by exactly two triangles; a hole leaves boundary edges. */
function holes(g: THREE.BufferGeometry) {
  const ix = g.getIndex()!;
  const m = new Map<number, number>();
  const n = g.getAttribute('position').count;
  for (let t = 0; t < ix.count; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = ix.getX(t + e), b = ix.getX(t + ((e + 1) % 3));
      const k = a < b ? a * n + b : b * n + a;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  let open = 0;
  for (const v of m.values()) if (v === 1) open++;
  return open;
}

describe('sculpted meshes are watertight (no see-through holes)', () => {
  const bp = BODIES[22].p;
  const h = headFromParams(HEADS[0].p, 0);
  const cases: [string, () => THREE.BufferGeometry][] = [
    ['body', () => bodyGeometry(bp)],
    ['hands', () => handsGeometry(bp)],
    ['bare feet with toes', () => feetGeometry(bp)],
    ['tee', () => topGeometry(bp, 'Tee', 0).main!],
    ['puffer over sweatshirt', () => topGeometry(bp, 'Puffer', 1, 'Sweatshirt').main!],
    ['trench', () => topGeometry(bp, 'Trench', 1, 'Tee').main!],
    ['baggy jeans', () => bottomGeometry(bp, 'Baggy jeans').main!],
    ['saree', () => dressGeometry(bp, 'Saree').main!],
    ['tiered dress', () => dressGeometry(bp, 'Tiered').main!],
    ['combat boots', () => shoeGeometry(bp, 'Combat boot').main!],
    // the scalp layer under the strands must be closed (no scalp showing through)
    ['scalp layer: long wavy', () => groomHair(h, HAIRSTYLES[hairId('Long wavy')].p, 1, false).base!],
    ['scalp layer: rounded afro', () => groomHair(h, HAIRSTYLES[hairId('Rounded afro')].p, 1, false).base!],
    ['head with nose + ears', () => headGeometry(h, NOSES[0].p, EARS[0].p)],
  ];
  for (const [name, make] of cases) it(name, () => expect(holes(make())).toBe(0));
}, 120000);
