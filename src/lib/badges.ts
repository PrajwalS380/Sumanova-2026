import type { StreakInfo } from './social/api';
import type { NovaEmojiId } from '@/components/emoji/novaEmoji';

/** Small emoji markers shown next to a friend's name in the chat list (our own set). */
export interface RowBadge { id: NovaEmojiId; label: string }

/** Friends with the 3 longest live streaks are your "top friends". */
export function topFriendIds(streaks: StreakInfo[], n = 3): Set<string> {
  return new Set(
    streaks
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count || b.best - a.best)
      .slice(0, n)
      .map((s) => s.friend_id),
  );
}

export function rowBadges(streak: StreakInfo | undefined, top: boolean): RowBadge[] {
  const out: RowBadge[] = [];
  if (top) out.push({ id: 'star', label: 'Top friend' });
  if (streak && streak.count >= 100) out.push({ id: 'hundred', label: '100+ day streak' });
  else if (streak && streak.best >= 30) out.push({ id: 'trophy', label: '30-day streak legends' });
  return out;
}
