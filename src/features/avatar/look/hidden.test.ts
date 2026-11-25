import { describe, expect, it } from 'vitest';
import { SLOTS, type Slot } from './config';
import { HIDDEN, isHidden } from './hidden';
import { PRESETS } from './presets';

describe('wardrobe look-alikes', () => {
  it('only hides real catalogue items and never a whole cut', () => {
    for (const [slot, ids] of Object.entries(HIDDEN) as [Slot, readonly number[]][]) {
      const list = SLOTS[slot] as readonly { id: number; family: string }[];
      for (const id of ids) expect(list[id], `${slot} ${id}`).toBeDefined();
      for (const fam of new Set(list.map((v) => v.family))) {
        expect(list.some((v) => v.family === fam && !isHidden(slot, v.id)), `${slot} ${fam} keeps an item`).toBe(true);
      }
    }
  });
  it('starter characters only wear items that are shown in the editor', () => {
    for (const p of PRESETS)
      for (const slot of ['top', 'outer', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'hat', 'glasses'] as Slot[]) {
        const id = p.look.pick[slot];
        if (id != null) expect(isHidden(slot, id), `${p.name} ${slot} ${id}`).toBe(false);
      }
  });
  it('every cut offers a different pattern for each item', () => {
    for (const slot of ['top', 'outer', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'hat'] as Slot[]) {
      const list = SLOTS[slot] as readonly { p: { cut: string; pattern: string } }[];
      const keys = list.map((v) => `${v.p.cut}|${v.p.pattern}`);
      expect(new Set(keys).size, slot).toBe(keys.length);
    }
  });
});
