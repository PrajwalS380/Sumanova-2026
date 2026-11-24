import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';
import { SLOTS, type Slot } from './config';

describe('starter characters', () => {
  it('all resolve to valid catalogue ids', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(12);
    for (const { look } of PRESETS) {
      for (const [slot, id] of Object.entries(look.pick)) {
        if (id == null) continue;
        expect(SLOTS[slot as Slot][id], `${slot} ${id}`).toBeTruthy();
      }
      expect(look.pick.dress != null && (look.pick.top != null || look.pick.bottom != null)).toBe(false);
    }
  });
});
