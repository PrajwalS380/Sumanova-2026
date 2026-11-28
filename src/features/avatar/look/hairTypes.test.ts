// @vitest-environment node
import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { CURL_PATTERNS, HAIR_TAGS, HAIRSTYLES, PATTERN_SPEC, hairId, normalizeHairTune, tuneHair } from './hair';
import { normalizeLook, DEFAULT_LOOK } from './config';
import { Groomer, groomHair } from '../sculpt3d/groom';
import { HEADS } from './face';
import { headFromParams } from '../sculptV2';
import OLD_NAMES from './hairNames.v1.json';

// sumanova-us-109: curl patterns 1–4C + 30 new styles
describe('hair library', () => {
  it('has 140 styles, ids == index, unique names; ids 0–109 unchanged', () => {
    expect(HAIRSTYLES.length).toBe(140);
    HAIRSTYLES.forEach((v, i) => expect(v.id).toBe(i));
    expect(new Set(HAIRSTYLES.map((v) => v.name)).size).toBe(140);
    expect(HAIRSTYLES.slice(0, 110).map((v) => v.name)).toEqual(OLD_NAMES);
    expect(HAIRSTYLES[110].name).toBe('Long plait with paranda');
    expect(HAIRSTYLES[139].name).toBe('Half-up space buns');
  });

  it('tags and patterns come only from the allowed sets', () => {
    for (const v of HAIRSTYLES) {
      for (const t of v.p.tags ?? []) expect(HAIR_TAGS).toContain(t);
      if (v.p.pattern) expect(CURL_PATTERNS).toContain(v.p.pattern);
    }
    expect(HAIRSTYLES.filter((v) => v.p.tags?.includes('indian')).length).toBeGreaterThanOrEqual(8);
    expect(HAIRSTYLES.filter((v) => v.p.tags?.includes('textured')).length).toBeGreaterThanOrEqual(12);
  });

  it('a picked curl pattern sets texture; normalizeHairTune drops invalid patterns', () => {
    const p = HAIRSTYLES[hairId('Long straight')].p;
    const t = tuneHair(p, { pattern: '4C' });
    expect(t.pattern).toBe('4C');
    expect(t.tex).toBe('coily');
    expect(tuneHair(p, { pattern: '2B' }).tex).toBe('wavy');
    expect(normalizeHairTune({ pattern: '3B' })).toEqual({ pattern: '3B' });
    expect(normalizeHairTune({ pattern: '5Z' })).toBeUndefined();
  });

  it('the decoration colour is a normalised colour key', () => {
    const l = normalizeLook({ ...DEFAULT_LOOK, color: { ...DEFAULT_LOOK.color, hairDeco: '#c2185b' } });
    expect(l.color.hairDeco).toBe('#c2185b');
    expect(normalizeLook({ ...DEFAULT_LOOK, color: { ...DEFAULT_LOOK.color, hairDeco: 'red' } }).color.hairDeco ?? null).toBeNull();
  });
});

describe('groom: curl patterns and new structures', () => {
  const h = headFromParams(HEADS[0].p as never, 0 as never);
  const strip = (id: number) => {
    const p = { ...HAIRSTYLES[id].p };
    delete p.tags;
    return p;
  };

  it('old styles grow exactly as before (no pattern field)', () => {
    // hashes taken from the groom before sumanova-us-109
    const want: [number, number, string][] = [[0, 17539, '6f7f4b1f9c88'], [36, 151987, 'df2a612a8617'], [78, 92455, '18560db87e92']];
    for (const [id, n, hash] of want) {
      const pos = groomHair(h, strip(id), 3, false).strands!.getAttribute('position').array as Float32Array;
      expect(pos.length / 3).toBe(n);
      expect(createHash('md5').update(Buffer.from(pos.buffer)).digest('hex').slice(0, 12)).toBe(hash);
    }
  });

  it('4C shrinks: shorter than the same style in pattern 1', () => {
    const base = HAIRSTYLES[hairId('Long straight')].p;
    const minY = (pattern: '1' | '4C') => {
      const pos = groomHair(h, { ...base, pattern, tex: PATTERN_SPEC[pattern].tex }, 5, false).strands!.getAttribute('position').array as Float32Array;
      let m = Infinity;
      for (let i = 1; i < pos.length; i += 3) m = Math.min(m, pos[i]);
      return m;
    };
    expect(minY('4C')).toBeGreaterThan(minY('1') + 0.1);
  });

  it('Bantu knots: 9–12 knots', () => {
    const g = new Groomer(h, HAIRSTYLES[hairId('Bantu knots')].p, 1, false);
    g.build();
    expect(g.knots).toBeGreaterThanOrEqual(9);
    expect(g.knots).toBeLessThanOrEqual(12);
  });

  it('decorations: paranda, gajra, ribbons and beads are built', () => {
    for (const [name, role] of [['Long plait with paranda', 'deco'], ['Jooda with gajra', 'decoW'], ['Twin plaits with ribbons', 'deco'], ['Fulani-inspired braids', 'deco']] as const) {
      const o = groomHair(h, HAIRSTYLES[hairId(name)].p, 1, false);
      expect(o[role], name).toBeTruthy();
    }
  });
}, 300000);
