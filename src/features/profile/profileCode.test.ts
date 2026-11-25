import { describe, expect, it } from 'vitest';
import { profileLink, usernameFromCode } from './ProfileCodeScreen';

describe('profile code', () => {
  it('round-trips a username through the link', () => {
    expect(usernameFromCode(profileLink('prajwal'))).toBe('prajwal');
    expect(usernameFromCode(profileLink('diya.rao_1'))).toBe('diya.rao_1');
  });
  it('accepts @handles and ignores junk', () => {
    expect(usernameFromCode('@Kiran')).toBe('kiran');
    expect(usernameFromCode('https://example.com/other')).toBeNull();
    expect(usernameFromCode('not a code at all')).toBeNull();
  });
});
