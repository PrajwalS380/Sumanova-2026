import type { NovaEmojiId } from '@/components/emoji/novaEmoji';

export interface TrophyStats {
  snaps_sent: number; snaps_received: number; stories: number; best_streak: number; friends: number; spotlight_videos: number;
  spotlight_likes: number; explored: number; groups: number; calls: number; memories: number; score: number;
}
export interface Trophy { id: string; name: string; how: string; icon: NovaEmojiId; value: (s: TrophyStats) => number; goal: number }

/** Our own trophy case (original names and art), earned from real activity. */
export const TROPHIES: Trophy[] = [
  { id: 'first-snap', name: 'First Light', how: 'Send your first snap', icon: 'camera', value: (s) => s.snaps_sent, goal: 1 },
  { id: 'snap-100', name: 'Shutterbug', how: 'Send 100 snaps', icon: 'camera', value: (s) => s.snaps_sent, goal: 100 },
  { id: 'snap-1000', name: 'Lens Legend', how: 'Send 1,000 snaps', icon: 'star', value: (s) => s.snaps_sent, goal: 1000 },
  { id: 'story-1', name: 'Storyteller', how: 'Post your first story', icon: 'sparkle', value: (s) => s.stories, goal: 1 },
  { id: 'story-50', name: 'Main Character', how: 'Post 50 stories', icon: 'crown', value: (s) => s.stories, goal: 50 },
  { id: 'streak-7', name: 'Week of Fire', how: 'Reach a 7-day streak', icon: 'flame', value: (s) => s.best_streak, goal: 7 },
  { id: 'streak-30', name: 'Unbreakable', how: 'Reach a 30-day streak', icon: 'trophy', value: (s) => s.best_streak, goal: 30 },
  { id: 'streak-100', name: 'Century Flame', how: 'Reach a 100-day streak', icon: 'hundred', value: (s) => s.best_streak, goal: 100 },
  { id: 'friends-5', name: 'Squad Up', how: 'Make 5 friends', icon: 'hearts', value: (s) => s.friends, goal: 5 },
  { id: 'friends-25', name: 'Social Star', how: 'Make 25 friends', icon: 'smitten', value: (s) => s.friends, goal: 25 },
  { id: 'group-1', name: 'Group Chat Hero', how: 'Join a group chat', icon: 'chat', value: (s) => s.groups, goal: 1 },
  { id: 'calls-10', name: 'Ring Ring', how: 'Have 10 calls you started answered', icon: 'wow', value: (s) => s.calls, goal: 10 },
  { id: 'spot-1', name: 'Spotlit', how: 'Post a Spotlight video', icon: 'shades', value: (s) => s.spotlight_videos, goal: 1 },
  { id: 'spot-likes', name: 'Crowd Favourite', how: 'Get 1,000 likes on Spotlight', icon: 'hearts', value: (s) => s.spotlight_likes, goal: 1000 },
  { id: 'explore-10', name: 'Wanderer', how: 'Explore 10 areas on the map', icon: 'butterfly', value: (s) => s.explored, goal: 10 },
  { id: 'explore-100', name: 'Globetrotter', how: 'Explore 100 areas on the map', icon: 'alien', value: (s) => s.explored, goal: 100 },
  { id: 'memories-50', name: 'Keeper', how: 'Save 50 memories', icon: 'flower', value: (s) => s.memories, goal: 50 },
  { id: 'score-1000', name: 'Nova Rising', how: 'Reach a snap score of 1,000', icon: 'nova', value: (s) => s.score, goal: 1000 },
];

export function trophyProgress(t: Trophy, s: TrophyStats) {
  const v = Math.max(0, Number(t.value(s)) || 0);
  return { value: v, earned: v >= t.goal, pct: Math.min(1, v / t.goal) };
}
