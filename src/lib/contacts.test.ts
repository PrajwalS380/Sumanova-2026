import { describe, expect, it } from 'vitest';
import { normalizePhone, sha256Hex } from './contacts';

describe('contacts', () => {
  it('normalises address-book numbers to E.164', () => {
    expect(normalizePhone('98765 43210', '91')).toBe('+919876543210');
    expect(normalizePhone('098765-43210', '91')).toBe('+919876543210');
    expect(normalizePhone('+91 98765 43210', '1')).toBe('+919876543210');
    expect(normalizePhone('0091 9876543210', '1')).toBe('+919876543210');
    expect(normalizePhone('919876543210', '1')).toBe('+919876543210');
    expect(normalizePhone('(415) 555-2671', '1')).toBe('+14155552671');
    expect(normalizePhone('123', '91')).toBeNull();
    expect(normalizePhone('', '91')).toBeNull();
  });
  it('hashes exactly like the server (sha256 of +digits, hex)', async () => {
    // Same value Postgres gives for encode(digest('+919876543210','sha256'),'hex').
    expect(await sha256Hex('+919876543210')).toBe('f3a47ce5ce3d4ca8ad15225a245b2759022f79489f5c62719b8c9490f7aab90e');
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
