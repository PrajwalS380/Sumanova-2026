import { describe, expect, it } from 'vitest';
import { daysUntil, formatDayMonth, matchScore, monthDay, signFor, SIGNS } from './zodiac';

describe('zodiac', () => {
  it('maps dates to signs, including the year wrap', () => {
    expect(signFor(11, 16).name).toBe('Scorpio');
    expect(signFor(12, 25).name).toBe('Capricorn');
    expect(signFor(1, 10).name).toBe('Capricorn');
    expect(signFor(1, 20).name).toBe('Aquarius');
    expect(signFor(3, 21).name).toBe('Aries');
    expect(signFor(11, 22).name).toBe('Sagittarius');
  });
  it('every day of the year has exactly one sign', () => {
    const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    days.forEach((n, m) => {
      for (let d = 1; d <= n; d++) expect(SIGNS).toContain(signFor(m + 1, d));
    });
  });
  it('parses dates and formats day/month without the year', () => {
    expect(monthDay('2001-11-16')).toEqual({ month: 11, day: 16 });
    expect(monthDay(null)).toBeNull();
    expect(formatDayMonth(11, 16)).toBe('Nov 16');
  });
  it('counts days to the next birthday', () => {
    const now = new Date(2026, 10, 25); // Nov 25
    expect(daysUntil(11, 25, now)).toBe(0);
    expect(daysUntil(11, 28, now)).toBe(3);
    expect(daysUntil(11, 24, now)).toBe(364);
    expect(daysUntil(2, 29, new Date(2026, 1, 27))).toBe(1); // Feb 28 in a non-leap year
  });
  it('gives a stable, bounded match score', () => {
    const a = signFor(11, 16);
    const b = signFor(12, 1);
    const r = matchScore(a, b);
    expect(r.score).toBeGreaterThanOrEqual(55);
    expect(r.score).toBeLessThanOrEqual(95);
    expect(matchScore(a, b)).toEqual(r);
  });
});
