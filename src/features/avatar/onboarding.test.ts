import { describe, expect, it } from 'vitest';
import { avatarSkipped, PICTURED } from './AvatarOnboardingScreen';
import { PRESETS } from './look/presets';

describe('avatar onboarding', () => {
  it('remembers Skip per account on this device', () => {
    localStorage.clear();
    expect(avatarSkipped('u1')).toBe(false);
    localStorage.setItem('snv-avatar-skipped-u1', '1');
    expect(avatarSkipped('u1')).toBe(true);
    expect(avatarSkipped('u2')).toBe(false);
  });
  it('only offers characters that exist and have a picture', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    for (const i of PICTURED) {
      expect(PRESETS[i]).toBeTruthy();
      expect(fs.existsSync(`public/presets/${i}.webp`)).toBe(true);
    }
  });
});
