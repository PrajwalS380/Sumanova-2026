// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ACC_ANCHORS, ACC_KINDS, HAIR_ACCESSORIES, accAnchor, hairAnchors, type AnchorK } from './hairAcc';
import { HAIRSTYLES, hairId } from './hair';
import { HEADS } from './face';
import { headFromParams } from '../sculptV2';
import { groomHair } from '../sculpt3d/groom';
import { hairAccGeometry, readAnchors } from '../sculpt3d/hairAccGeo';
import { accItems } from '../render/HairAccessories';
import { normalizeLook, SLOTS, COLOR_KEYS, OPTIONAL } from './config';

// sumanova-us-110: hair accessories
describe('hair accessory catalogue', () => {
  it('has 100 items with stable ids and unique names', () => {
    expect(HAIR_ACCESSORIES).toHaveLength(100);
    HAIR_ACCESSORIES.forEach((v, i) => {
      expect(v.id).toBe(i);
      expect(v.p.kind).toBe(ACC_KINDS[Math.floor(i / 10)]);
    });
    expect(new Set(HAIR_ACCESSORIES.map((v) => v.name)).size).toBe(100);
  });

  it('every kind lists at least one anchor; a style without it is unsupported', () => {
    for (const k of ACC_KINDS) expect(ACC_ANCHORS[k].length).toBeGreaterThan(0);
    const buzz = hairAnchors(HAIRSTYLES[hairId('Buzz cut')].p);
    expect(accAnchor('scrunchie', buzz)).toBeNull();
    expect(accAnchor('beads', hairAnchors(HAIRSTYLES[hairId('Long straight')].p))).toBeNull();
    expect(accAnchor('beads', hairAnchors(HAIRSTYLES[hairId('Box braids')].p))).toBe('braidEnd');
    expect(accAnchor('flower', hairAnchors(HAIRSTYLES[hairId('Long straight')].p), 'overEarR')).toBe('overEarR');
    expect(accAnchor('flower', hairAnchors(HAIRSTYLES[hairId('Long straight')].p), 'braidEnd')).toBe('overEarL');
    expect(hairAnchors(null).size).toBe(0);
  });

  it('slots, colour keys and the chosen place are normalised', () => {
    expect(SLOTS.hairAcc1).toBe(HAIR_ACCESSORIES);
    expect(OPTIONAL).toContain('hairAcc2');
    expect(COLOR_KEYS).toContain('hairAcc1');
    expect(COLOR_KEYS).toContain('hairMid');
    const l = normalizeLook({ v: 2, pick: { hairAcc1: 12, hairAcc2: 400 }, color: { hairAcc1: '#ff0000', hairMid: 'red' }, accAt: { hairAcc1: 'sideRight', hairAcc2: 'moon' } });
    expect(l.pick.hairAcc1).toBe(12);
    expect(l.pick.hairAcc2).toBeNull();
    expect(l.color.hairAcc1).toBe('#ff0000');
    expect(l.color.hairMid ?? null).toBeNull();
    expect(l.accAt).toEqual({ hairAcc1: 'sideRight' });
    // old looks gain nothing
    expect(normalizeLook({ v: 2, pick: {}, color: {} }).accAt).toBeUndefined();
  });
});

describe('groom anchors', () => {
  const h = headFromParams(HEADS[0].p as never, 0 as never);
  const anchorsOf = (name: string, seed = 7) => readAnchors(groomHair(h, HAIRSTYLES[hairId(name)].p, seed, false).anchors);
  const STYLES = ['High ponytail', 'Messy bun', 'Single braid', 'Box braids', 'Long straight', 'Curtains', 'Pixie cut', 'Natural afro'];

  it('every anchor the style promises is produced, on the hair surface', () => {
    for (const name of STYLES) {
      const all = anchorsOf(name);
      const got = new Set(all.map((a) => a.k));
      for (const k of hairAnchors(HAIRSTYLES[hairId(name)].p)) expect([name, k, got.has(k)]).toEqual([name, k, true]);
      // scalp anchors stand off the scalp by at least the cap layer
      for (const a of all.filter((x) => (['partFront', 'sideLeft', 'sideRight', 'crownBack', 'overEarL', 'overEarR', 'headbandArc'] as AnchorK[]).includes(x.k))) {
        expect(Math.hypot(...a.at)).toBeGreaterThan(0.95 * Math.min(h.rx, h.ry, h.rz));
      }
    }
  });

  it('anchors are deterministic for a seed', () => {
    expect(anchorsOf('High ponytail', 3)).toEqual(anchorsOf('High ponytail', 3));
  });

  it('every kind builds on a fitting style within the triangle budget (two at once ≤ 6k)', () => {
    const fit: Record<string, string> = { claw: 'Long straight', snap: 'Curtains', barrette: 'Long straight', scrunchie: 'High ponytail', headband: 'Long straight', bow: 'High ponytail', flower: 'Messy bun', gajra: 'Messy bun', pins: 'Messy bun', beads: 'Box braids' };
    for (const kind of ACC_KINDS) {
      for (const style of [0, 1]) {
        const id = ACC_KINDS.indexOf(kind) * 10 + HAIR_ACCESSORIES.slice(ACC_KINDS.indexOf(kind) * 10, ACC_KINDS.indexOf(kind) * 10 + 10).findIndex((v) => v.p.style === style);
        const items = accItems([{ id }], anchorsOf(fit[kind]), false, h.ry);
        expect([kind, items.length]).toEqual([kind, 1]);
        const g = hairAccGeometry(items, h.rx)!;
        const tris = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
        expect([kind, style, tris <= 3200]).toEqual([kind, style, true]);
        expect(g.getAttribute('accSlot')).toBeTruthy();
      }
    }
  });
}, 300000);
