import { describe, expect, it } from 'vitest';
import { ALL_LENSES, LENS_CATEGORIES, lensById, searchLenses } from './allLenses';
import { TRACKS } from '@/lib/music/tracks';
import { TEMPLATES } from '@/lib/snaps/templates';

describe('lens catalogue', () => {
  it('has unique ids and every category is filled', () => {
    const ids = ALL_LENSES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of LENS_CATEGORIES) expect(ALL_LENSES.some((l) => l.category === c), c).toBe(true);
    expect(ALL_LENSES.length).toBeGreaterThanOrEqual(38);
  });
  it('searches by name and category', () => {
    expect(searchLenses('blur').map((l) => l.id)).toContain('bg-blur');
    expect(searchLenses('', 'Hair').every((l) => l.category === 'Hair')).toBe(true);
    expect(searchLenses('puppy').length).toBeGreaterThan(0);
    expect(lensById('bg-space')?.kind).toBe('frame');
    expect(lensById('shades')?.kind).toBe('overlay');
  });
  it('background and hair lenses ask for the right masks', () => {
    expect(lensById('bg-beach')?.needs).toEqual(['selfie']);
    expect(lensById('hair-pink')?.needs).toEqual(['hair']);
  });
});

describe('music and templates', () => {
  it('tracks are complete and unique', () => {
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
    for (const t of TRACKS) {
      expect(t.chords.length).toBeGreaterThan(0);
      expect(t.bpm).toBeGreaterThan(50);
      expect(t.melody.length % 8).toBe(0);
    }
  });
  it('templates have unique ids', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });
});
