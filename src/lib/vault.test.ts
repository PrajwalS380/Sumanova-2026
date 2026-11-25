// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createVault, decryptBlob, encryptBlob, unlockVault } from './vault';

describe('My Eyes Only vault', () => {
  it('unlocks only with the right passcode and round-trips files', async () => {
    const { record, key } = await createVault('2468');
    expect(record.check).not.toContain('2468');
    await expect(unlockVault(record, '1111')).rejects.toThrow('Wrong passcode');
    const again = await unlockVault(record, '2468');
    const secret = new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/webp' });
    const sealed = await encryptBlob(key, secret);
    expect(sealed.type).toBe('application/octet-stream');
    const opened = await decryptBlob(again, sealed, 'image/webp');
    expect([...new Uint8Array(await opened.arrayBuffer())]).toEqual([1, 2, 3, 250]);
  }, 20000);
  it('rejects weak passcodes', async () => {
    await expect(createVault('12')).rejects.toThrow();
    await expect(createVault('abcd')).rejects.toThrow();
  });
});
