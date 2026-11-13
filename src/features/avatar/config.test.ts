import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, normalizeAvatar, randomAvatar, shade, skinWithUndertone } from './config';

describe('avatar config', () => {
  it('random avatars are always valid', () => {
    for (let i = 0; i < 50; i++) {
      const a = randomAvatar();
      expect(normalizeAvatar(a)).toEqual(a);
    }
  });
  it('normalize rejects junk and clamps numbers', () => {
    const n = normalizeAvatar({ skin: 'javascript:alert(1)', face: { width: 99, shape: 'triangle' }, hair: { style: '<script>' }, expression: 'evil' });
    expect(n.skin).toBe(DEFAULT_AVATAR.skin);
    expect(n.face.width).toBe(1.2);
    expect(n.face.shape).toBe('oval');
    expect(n.hair.style).toBe(DEFAULT_AVATAR.hair.style);
    expect(n.expression).toBe('happy');
  });
  it('colour helpers stay valid hex', () => {
    expect(shade('#ffffff', 0.5)).toBe('#ffffff');
    expect(shade('#000000', -0.5)).toBe('#000000');
    expect(skinWithUndertone('#d9a074', 'cool')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
