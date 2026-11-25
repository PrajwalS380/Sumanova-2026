import { describe, expect, it } from 'vitest';
import { avatarSkipped } from './AvatarOnboardingScreen';
import { PRESETS } from './look/presets';

describe('avatar onboarding', () => {
  it('remembers Skip per account on this device', () => {
    localStorage.clear();
    expect(avatarSkipped('u1')).toBe(false);
    localStorage.setItem('snv-avatar-skipped-u1', '1');
    expect(avatarSkipped('u1')).toBe(true);
    expect(avatarSkipped('u2')).toBe(false);
  });
  it('has a pre-rendered picture slot for every starter character', () => {
    expect(PRESETS.length).toBe(12);
  });
});
