/**
 * Step 1 of the offline hair bake (free: Node + Blender).
 * Exports each headline style's lock guides and scalp layer for the standard head to JSON,
 * which tools/hair-bake/bake.py turns into finished, sculpted, texture-baked hair (.glb).
 *   npx vite-node tools/hair-bake/export.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { HAIRSTYLES, hairId } from '../../src/features/avatar/look/hair';
import { HEADS } from '../../src/features/avatar/look/face';
import { headFromParams } from '../../src/features/avatar/sculptV2';
import { groomGuides } from '../../src/features/avatar/sculpt3d/groom';
import { BAKE_CANDIDATES } from '../../src/features/avatar/look/bakedHair';

const out = 'tools/hair-bake/guides';
mkdirSync(out, { recursive: true });
const h = headFromParams(HEADS[0].p as never, 0 as never);
for (const name of BAKE_CANDIDATES) {
  const id = hairId(name);
  const g = groomGuides(h, HAIRSTYLES[id].p, id);
  const base = g.base ? { pos: Array.from(g.base.getAttribute('position').array as Float32Array), idx: Array.from(g.base.getIndex()!.array) } : null;
  writeFileSync(`${out}/${id}.json`, JSON.stringify({ id, name, head: h, guides: g.guides, base }));
  console.log(id, name, g.guides.length, 'locks');
}
