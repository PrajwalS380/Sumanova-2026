import { describe, expect, it } from 'vitest';
import { badgeArt, NOVA_EMOJI_IDS, novaStickerId, novaSvg } from './novaEmoji';

describe('Nova emoji', () => {
  it('every emoji is well-formed SVG', () => {
    expect(NOVA_EMOJI_IDS.length).toBeGreaterThanOrEqual(24);
    for (const id of NOVA_EMOJI_IDS) {
      const doc = new DOMParser().parseFromString(novaSvg(id), 'image/svg+xml');
      expect(doc.querySelector('parsererror'), id).toBeNull();
      expect(doc.documentElement.childElementCount, id).toBeGreaterThan(0);
    }
  });
  it('maps server badges to our artwork', () => {
    expect(badgeArt('🔥 Streak keeper')).toEqual({ id: 'flame', text: 'Streak keeper' });
    expect(badgeArt('💯 Century club').id).toBe('hundred');
    expect(badgeArt('💜 Best friends').id).toBe('hearts');
    expect(badgeArt('🎂 One year+').id).toBe('cake');
  });
  it('reads sticker bodies', () => {
    expect(novaStickerId('nova:puppy')).toBe('puppy');
    expect(novaStickerId('nova:nope')).toBeNull();
    expect(novaStickerId('🔥')).toBeNull();
  });
});
