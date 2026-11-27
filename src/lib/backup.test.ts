import { beforeEach, describe, expect, it } from 'vitest';
import { backupKeyAllowed, makeBackup, readText, restoreBackup } from './backup';

describe('settings backup', () => {
  beforeEach(() => localStorage.clear());
  it('never includes secrets', () => {
    expect(backupKeyAllowed('snv-theme')).toBe(true);
    for (const k of ['sb-x-auth-token', 'snv-accounts', 'snv-lock', 'snv-secret-abc', 'snv-device-key', 'other']) expect(backupKeyAllowed(k)).toBe(false);
  });
  it('round-trips settings and skips unsafe keys on restore', async () => {
    localStorage.setItem('snv-theme', 'dark');
    localStorage.setItem('snv-lock', '{"hash":"x"}');
    const blob = makeBackup();
    const text = await readText(blob);
    expect(text).toContain('snv-theme');
    expect(text).not.toContain('snv-lock');
    localStorage.clear();
    const evil = new Blob([JSON.stringify({ app: 'SUMANOVA', kind: 'settings-backup', version: 1, items: { 'snv-theme': 'dark', 'sb-token': 'x', 'snv-lock': 'y' } })]);
    expect(await restoreBackup(evil)).toBe(1);
    expect(localStorage.getItem('snv-theme')).toBe('dark');
    expect(localStorage.getItem('sb-token')).toBeNull();
    await expect(restoreBackup(new Blob(['nope']))).rejects.toThrow();
  });
});
