import { describe, expect, it } from 'vitest';
import { ACCENTS, getAccent, setAccent } from './accent';

describe('accent', () => {
  it('defaults to ink (Bento black) and persists a choice as CSS variables', () => {
    localStorage.removeItem('snv-accent');
    expect(getAccent().id).toBe('ink');
    setAccent('jade');
    expect(getAccent().id).toBe('jade');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('14 154 106');
  });
  it('falls back to the default for unknown ids (e.g. the old "indigo")', () => {
    localStorage.setItem('snv-accent', 'indigo');
    expect(getAccent().id).toBe('ink');
    expect(setAccent('nope').id).toBe(ACCENTS[0].id);
  });
});
