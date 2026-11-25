import { beforeEach, describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';
import { authStorageKey, savedAccounts } from './savedAccounts';

const profile = (id: string, username: string): Profile => ({ id, username, display_name: username, bio: null, avatar_url: null, aura_color: 'violet', created_at: '', updated_at: '' });
const session = (id: string): Session => ({ access_token: `a-${id}`, refresh_token: `r-${id}`, user: { id, email: `${id}@x.dev` } } as unknown as Session);

describe('saved accounts', () => {
  beforeEach(() => localStorage.clear());
  it('remembers accounts newest first without duplicates', () => {
    savedAccounts.remember(session('1'), profile('1', 'one'));
    savedAccounts.remember(session('2'), profile('2', 'two'));
    savedAccounts.remember(session('1'), profile('1', 'one'));
    expect(savedAccounts.list().map((a) => a.username)).toEqual(['one', 'two']);
  });
  it('drops tokens on sign-out but keeps the entry; remove deletes it', () => {
    savedAccounts.remember(session('1'), profile('1', 'one'));
    savedAccounts.forgetTokens('1');
    expect(savedAccounts.list()[0]).toMatchObject({ username: 'one', refresh_token: null, access_token: null });
    savedAccounts.remove('1');
    expect(savedAccounts.list()).toEqual([]);
  });
  it('never stores a password field', () => {
    savedAccounts.remember(session('1'), profile('1', 'one'));
    expect(localStorage.getItem('snv-accounts')).not.toMatch(/password/i);
  });
  it('derives the supabase session storage key', () => {
    expect(authStorageKey('https://abcdef.supabase.co')).toBe('sb-abcdef-auth-token');
    expect(authStorageKey('nope')).toBeNull();
  });
});
