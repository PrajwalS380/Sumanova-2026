import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
import { DAILY_QUESTIONS, TRIVIA, questionOfToday, shuffleWord } from './fun';

describe('daily question', () => {
  it('is the same all day (UTC) and changes the next day', () => {
    const a = questionOfToday(new Date('2026-11-27T00:05:00Z'));
    const b = questionOfToday(new Date('2026-11-27T23:55:00Z'));
    const c = questionOfToday(new Date('2026-11-28T00:05:00Z'));
    expect(a).toEqual(b);
    expect(c.index).toBe((a.index + 1) % DAILY_QUESTIONS.length);
  });
});

describe('puzzles', () => {
  it('shuffles a word into the same letters, not the word itself', () => {
    for (const w of ['planet', 'mango', 'cricket']) {
      const s = shuffleWord(w);
      expect(s).not.toBe(w.toUpperCase());
      expect([...s].sort().join('')).toBe([...w.toUpperCase()].sort().join(''));
    }
  });
  it('trivia answers point at a real option', () => {
    for (const t of TRIVIA) expect(t.a).toBeLessThan(t.options.length);
  });
});
