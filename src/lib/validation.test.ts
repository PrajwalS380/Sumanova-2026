import { describe, expect, it } from 'vitest';
import { ageOn, friendlyAuthError, passwordStrength, signInSchema, signUpSchema, usernameProblem } from './validation';

describe('usernameProblem (mirrors DB constraint)', () => {
  it.each(['nova', 'a_b.c', 'user123', 'abc', 'x'.repeat(20)])('accepts %s', (u) => {
    expect(usernameProblem(u)).toBeNull();
  });
  it.each([
    ['ab', 'At least 3 characters'],
    ['x'.repeat(21), 'At most 20 characters'],
    ['has space', 'Use letters, numbers, dots and underscores'],
    ['emoji😀', 'Use letters, numbers, dots and underscores'],
    ['_lead', "Can't start or end with . or _"],
    ['trail.', "Can't start or end with . or _"],
  ])('rejects %s', (u, msg) => {
    expect(usernameProblem(u)).toBe(msg);
  });
  it('is case-insensitive (uppercase is normalised)', () => {
    expect(usernameProblem('NovaUser')).toBeNull();
  });
});

describe('ageOn', () => {
  const today = new Date('2026-11-13T12:00:00');
  it('counts birthdays correctly', () => {
    expect(ageOn('2013-11-13', today)).toBe(13);
    expect(ageOn('2013-11-14', today)).toBe(12);
    expect(ageOn('2000-01-01', today)).toBe(26);
  });
});

describe('signUpSchema', () => {
  const ok = { email: 'a@b.co', password: 'abc12345', username: 'nova_1', displayName: 'Nova', dateOfBirth: '2000-05-05' };
  it('accepts valid input', () => {
    expect(signUpSchema.safeParse(ok).success).toBe(true);
  });
  it('rejects under-13 users', () => {
    const r = signUpSchema.safeParse({ ...ok, dateOfBirth: new Date().toISOString().slice(0, 10) });
    expect(r.success).toBe(false);
  });
  it('requires letters and numbers in password', () => {
    expect(signUpSchema.safeParse({ ...ok, password: 'abcdefgh' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, password: '12345678' }).success).toBe(false);
  });
  it('rejects bad emails', () => {
    expect(signInSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });
});

describe('passwordStrength', () => {
  it('scores increase with complexity', () => {
    expect(passwordStrength('abc').score).toBe(0);
    expect(passwordStrength('Abcdefgh1!xyz').score).toBe(4);
  });
});

describe('friendlyAuthError', () => {
  it('maps known Supabase messages', () => {
    expect(friendlyAuthError('Invalid login credentials')).toMatch(/don’t match/);
    expect(friendlyAuthError('Database error saving new user')).toMatch(/username/);
    expect(friendlyAuthError('Email rate limit exceeded')).toMatch(/Too many/);
  });
});
