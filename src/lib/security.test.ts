import { describe, expect, it } from 'vitest';
import { deviceLabel, sessionIdOf } from './security';
import { TROPHIES, trophyProgress, type TrophyStats } from './trophies';

describe('security helpers', () => {
  it('labels devices without fingerprinting', () => {
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')).toBe('Android · Chrome');
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari');
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36 Edg/120')).toBe('Windows · Edge');
  });
  it('reads the session id from a token', () => {
    const payload = btoa(JSON.stringify({ session_id: 'abc-123' })).replace(/=+$/, '');
    expect(sessionIdOf(`x.${payload}.y`)).toBe('abc-123');
    expect(sessionIdOf('garbage')).toBeNull();
  });
});

describe('trophies', () => {
  const zero: TrophyStats = { snaps_sent: 0, snaps_received: 0, stories: 0, best_streak: 0, friends: 0, spotlight_videos: 0, spotlight_likes: 0, explored: 0, groups: 0, calls: 0, memories: 0, score: 0 };
  it('earns and tracks progress', () => {
    const first = TROPHIES.find((t) => t.id === 'first-snap')!;
    expect(trophyProgress(first, zero).earned).toBe(false);
    expect(trophyProgress(first, { ...zero, snaps_sent: 1 }).earned).toBe(true);
    const week = TROPHIES.find((t) => t.id === 'streak-7')!;
    expect(trophyProgress(week, { ...zero, best_streak: 3 }).pct).toBeCloseTo(3 / 7);
    expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(TROPHIES.length);
  });
});
