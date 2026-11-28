// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HAIRSTYLES, hairId, normalizeHairTune, tuneHair } from './hair';
import { Groomer } from '../sculpt3d/groom';
import { HEADS } from './face';
import { headFromParams } from '../sculptV2';

// sumanova-us-107: hairline height, edges (clean / soft / laid) and visible partings
describe('hair tune: hairline + edges', () => {
  const long = HAIRSTYLES[hairId('Long straight')].p;
  const buzz = HAIRSTYLES[hairId('Buzz with line-up')].p;

  it('every style defaults to soft edges unless it is a barber line-up', () => {
    expect(long.edges).toBe('soft');
    expect(HAIRSTYLES[hairId('Caesar cut')].p.edges).toBe('clean');
  });

  it('applies line / edges only where the style allows them', () => {
    const t = tuneHair(long, { line: 0.5, edges: 'laid' });
    expect(t.edges).toBe('laid');
    expect(t.line).toBeCloseTo(long.line + 0.5);
    // a buzz cut has no hairline control
    const b = tuneHair(buzz, { line: 0.5, edges: 'laid' });
    expect(b.line).toBe(buzz.line);
    expect(b.edges).toBe(buzz.edges);
  });

  it('clamps the hairline', () => {
    expect(tuneHair({ ...long, line: 1 }, { line: 1 }).line).toBe(1.2);
    expect(tuneHair({ ...long, line: -0.5 }, { line: -1 }).line).toBe(-1);
  });

  it('normalizeHairTune keeps valid and drops invalid values (old looks stay valid)', () => {
    expect(normalizeHairTune({ line: 0.4, edges: 'laid' })).toEqual({ line: 0.4, edges: 'laid' });
    expect(normalizeHairTune({ line: 7 })).toEqual({ line: 1 });
    expect(normalizeHairTune({ edges: 'spiky', line: 'high' })).toBeUndefined();
    expect(normalizeHairTune({ length: 0.2 })).toEqual({ length: 0.2 });
  });
});

describe('groom: edges and partings', () => {
  const h = headFromParams(HEADS[0].p as never, 0 as never);
  const grow = (name: string, patch: object) => {
    const g = new Groomer(h, { ...HAIRSTYLES[hairId(name)].p, ...patch }, 1, false);
    return g;
  };

  it('clean edges add no baby hairs; soft and laid do, and laid stays above the brows', () => {
    const counts = (['clean', 'soft', 'laid'] as const).map((edges) => {
      const g = grow('Slicked-back short', { edges });
      const before = g.m.count;
      g.edges();
      if (edges === 'laid') for (let i = before * 3 + 1; i < g.m.pos.length; i += 3) expect(g.m.pos[i]).toBeGreaterThan(g.browY);
      return g.m.count - before;
    });
    expect(counts[0]).toBe(0);
    expect(counts[1]).toBeGreaterThan(0);
    expect(counts[2]).toBeGreaterThan(0);
  });

  it('no lock grows from inside a middle parting', () => {
    const g = grow('Long straight', { part: 'middle' });
    const roots: [number, number, number][] = [];
    const emit = g.emit.bind(g);
    g.emit = (pts, w0, o) => {
      roots.push([pts[0].x, pts[0].y, pts[0].z]);
      return emit(pts, w0, o);
    };
    g.scalpStrands();
    // roots on the top/front of the head keep clear of the part line at x = 0
    expect(roots.length).toBeGreaterThan(50);
    const inBand = roots.filter(([x, y, z]) => Math.abs(x) < 0.03 * g.R && y > 0.15 && z > 0);
    expect(inBand).toEqual([]);
    const inPart = g.inPart.bind(g);
    expect(inPart(g.dirAt(0, 0.7), 0.06)).toBe(true);
    expect(inPart(g.dirAt(0.6, 0.7), 0.06)).toBe(false);
  });
}, 60000);
