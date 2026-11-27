import { describe, expect, it } from 'vitest';
import { lookup, normKey } from './i18nDom';

describe('screen translation lookup', () => {
  const d = new Map([
    ["Couldn't save — check your connection", 'सेव नहीं हुआ'],
    ['{n} friends', '{n} दोस्त'],
    ['Collage · photo {n} of {n}', 'कोलाज · फ़ोटो {n} / {n}'],
  ]);
  it('matches curly quotes and extra spaces', () => {
    expect(normKey('Couldn’t  save — check your connection')).toBe("Couldn't save — check your connection");
    expect(lookup(d, ' Couldn’t save — check your connection ')).toBe('सेव नहीं हुआ');
  });
  it('fills numbers into patterns in order', () => {
    expect(lookup(d, '12 friends')).toBe('12 दोस्त');
    expect(lookup(d, 'Collage · photo 2 of 4')).toBe('कोलाज · फ़ोटो 2 / 4');
  });
  it('leaves unknown text and non-words alone', () => {
    expect(lookup(d, 'hello there')).toBeNull();
    expect(lookup(d, '12:30')).toBeNull();
  });
});
