import { describe, expect, it } from 'vitest';
import { ACCENTS, getAccent, setAccent } from './accent';

describe('accent', () => {
  it('defaults to indigo and persists a choice as CSS variables', () => {
    localStorage.removeItem('snv-accent');
    expect(getAccent().id).toBe('indigo');
    setAccent('jade');
    expect(getAccent().id).toBe('jade');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('14 140 109');
  });
  it('falls back to the default for unknown ids', () => {
    expect(setAccent('nope').id).toBe(ACCENTS[0].id);
  });
});
