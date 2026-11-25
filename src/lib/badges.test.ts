import { describe, expect, it } from 'vitest';
import { rowBadges, topFriendIds } from './badges';

const s = (id: string, count: number, best = count) => ({ friend_id: id, count, best, expiring: false, restorable: false });

describe('friendship badges', () => {
  it('picks the three longest live streaks as top friends', () => {
    const top = topFriendIds([s('a', 5), s('b', 0, 90), s('c', 40), s('d', 12), s('e', 2)]);
    expect([...top].sort()).toEqual(['a', 'c', 'd']);
  });
  it('labels long streaks', () => {
    expect(rowBadges(s('a', 120), true).map((b) => b.emoji)).toEqual(['⭐', '💯']);
    expect(rowBadges(s('a', 3, 45), false).map((b) => b.emoji)).toEqual(['🏆']);
    expect(rowBadges(undefined, false)).toEqual([]);
  });
});
