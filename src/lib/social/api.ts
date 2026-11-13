import { supabase } from '@/lib/supabase';
import { friendlyDbError } from '@/lib/chat/api';
import { extFor, uploadTo } from '@/lib/storageUrl';
import type { AuraColor } from '@/lib/types';

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(friendlyDbError(r.error.message));
  return r.data as T;
}

// ---------------- Stories ----------------
export type Audience = 'friends' | 'everyone' | 'custom' | 'group';
export interface Story {
  id: string;
  user_id: string;
  kind: 'image' | 'video' | 'text';
  media_path: string | null;
  overlay_path: string | null;
  text_body: string | null;
  background: string | null;
  media_meta: { filter?: string; duration?: number; width?: number; height?: number };
  audience: Audience;
  created_at: string;
  expires_at: string;
  deleted_at: string | null;
}
export interface StoryRing {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  aura_color: AuraColor;
  story_count: number;
  unseen: boolean;
  latest_at: string;
  is_me: boolean;
  is_friend: boolean;
}
export interface StoryViewer {
  viewer_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  aura_color: AuraColor;
  viewed_at: string;
  reaction: string | null;
}

export const storiesApi = {
  feed: async () => must(await supabase.rpc('story_feed')) as StoryRing[],
  ofUser: async (userId: string, includeExpired = false) => {
    let q = supabase.from('stories').select('*').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: true });
    if (!includeExpired) q = q.gt('expires_at', new Date().toISOString());
    return must(await q) as Story[];
  },
  archive: async (userId: string) => must(await supabase.from('stories').select('*').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(200)) as Story[],
  async post(me: string, p: { kind: Story['kind']; blob?: Blob; overlay?: Blob | null; text?: string; background?: string; meta?: object; audience: Audience; custom?: string[]; group?: string | null }) {
    const id = crypto.randomUUID();
    let mediaPath: string | null = null;
    let overlayPath: string | null = null;
    if (p.blob) mediaPath = await uploadTo('stories', `${me}/${id}.${extFor(p.blob.type)}`, p.blob);
    if (p.overlay) overlayPath = await uploadTo('stories', `${me}/${id}-overlay.png`, p.overlay);
    must(await supabase.rpc('post_story', { p_story: id, p_kind: p.kind, p_media_path: mediaPath, p_overlay_path: overlayPath, p_text: p.text ?? null, p_background: p.background ?? null, p_meta: p.meta ?? {}, p_audience: p.audience, p_custom: p.custom ?? null, p_group: p.group ?? null }));
    return id;
  },
  view: async (id: string, reaction?: string) => must(await supabase.rpc('view_story', { p_story: id, p_reaction: reaction ?? null })),
  reply: async (id: string, text: string) => must(await supabase.rpc('reply_to_story', { p_story: id, p_text: text })) as string,
  remove: async (id: string) => must(await supabase.rpc('remove_story', { p_story: id })),
  viewers: async (id: string) => must(await supabase.rpc('story_viewers', { p_story: id })) as StoryViewer[],
  highlights: async (userId: string) => must(await supabase.from('highlights').select('id,title,created_at, highlight_items(story_id)').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false })) as { id: string; title: string; highlight_items: { story_id: string }[] }[],
  createHighlight: async (title: string, stories: string[]) => must(await supabase.rpc('create_highlight', { p_title: title, p_stories: stories })) as string,
  addToHighlight: async (h: string, s: string) => must(await supabase.rpc('add_to_highlight', { p_highlight: h, p_story: s })),
  removeHighlight: async (h: string) => must(await supabase.rpc('remove_highlight', { p_highlight: h })),
  byIds: async (ids: string[]) => (ids.length ? (must(await supabase.from('stories').select('*').in('id', ids).order('created_at')) as Story[]) : []),
};

// ---------------- Streaks & friendship ----------------
export interface StreakInfo { friend_id: string; count: number; best: number; expiring: boolean; restorable: boolean }
export interface FriendshipProfile {
  friends_since: string;
  streak: number;
  best_streak: number;
  streak_expiring: boolean;
  snaps_exchanged: number;
  messages_exchanged: number;
  is_best_friend: boolean;
  anniversary_today: boolean;
  badges: string[];
}
export const streaksApi = {
  mine: async () => must(await supabase.rpc('my_streaks')) as StreakInfo[],
  restore: async (friend: string) => must(await supabase.rpc('restore_streak', { p_friend: friend })) as number,
  friendship: async (friend: string) => (must(await supabase.rpc('friendship_profile', { p_friend: friend })) as FriendshipProfile[])[0] ?? null,
  bestFriends: async () => must(await supabase.rpc('best_friends')) as { friend_id: string; score: number }[],
};

// ---------------- Memories ----------------
export interface Memory {
  id: string;
  kind: 'image' | 'video';
  media_path: string;
  media_meta: { width?: number; height?: number; duration?: number; filter?: string };
  size_bytes: number;
  taken_at: string;
  favourite: boolean;
  archived: boolean;
  album_id: string | null;
}
export interface Album { id: string; title: string; created_at: string }
export const memoriesApi = {
  list: async (opts: { archived?: boolean; favourite?: boolean; album?: string | null; from?: string; to?: string; offset?: number }) => {
    let q = supabase.from('memories').select('*').eq('archived', !!opts.archived).order('taken_at', { ascending: false }).range(opts.offset ?? 0, (opts.offset ?? 0) + 59);
    if (opts.favourite) q = q.eq('favourite', true);
    if (opts.album) q = q.eq('album_id', opts.album);
    if (opts.from) q = q.gte('taken_at', opts.from);
    if (opts.to) q = q.lt('taken_at', opts.to);
    return must(await q) as Memory[];
  },
  async add(me: string, blob: Blob, kind: 'image' | 'video', meta: object = {}) {
    const id = crypto.randomUUID();
    const path = await uploadTo('memories', `${me}/${id}.${extFor(blob.type)}`, blob);
    must(await supabase.rpc('add_memory', { p_id: id, p_kind: kind, p_media_path: path, p_meta: meta, p_size: blob.size, p_taken_at: null }));
    return id;
  },
  update: async (ids: string[], patch: Partial<Pick<Memory, 'favourite' | 'archived' | 'album_id'>> & { deleted_at?: string }) => must(await supabase.from('memories').update(patch).in('id', ids)),
  async remove(items: Memory[]) {
    must(await supabase.from('memories').update({ deleted_at: new Date().toISOString() }).in('id', items.map((m) => m.id)));
    await supabase.storage.from('memories').remove(items.map((m) => m.media_path));
  },
  usage: async () => (must(await supabase.rpc('memory_usage')) as { items: number; bytes: number; max_items: number; max_bytes: number }[])[0],
  albums: async () => must(await supabase.from('albums').select('id,title,created_at').is('deleted_at', null).order('created_at', { ascending: false })) as Album[],
  createAlbum: async (me: string, title: string) => must(await supabase.from('albums').insert({ user_id: me, title }).select('id,title,created_at').single()) as Album,
  removeAlbum: async (id: string) => must(await supabase.from('albums').update({ deleted_at: new Date().toISOString() }).eq('id', id)),
};

// ---------------- Spotlight ----------------
export const CATEGORIES = ['everyday', 'comedy', 'music', 'dance', 'travel', 'food', 'sports', 'art', 'pets', 'tech', 'learn'] as const;
export type Category = (typeof CATEGORIES)[number];
export interface SpotlightVideo {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  aura_color: AuraColor;
  media_path: string;
  poster_path: string | null;
  caption: string | null;
  category: Category;
  media_meta: { width?: number; height?: number; duration?: number; filter?: string };
  like_count: number;
  comment_count: number;
  view_count: number;
  save_count: number;
  created_at: string;
  liked: boolean;
  saved: boolean;
  following: boolean;
}
export interface VideoComment { id: string; video_id: string; user_id: string; body: string; created_at: string }
export interface Creator {
  id: string; username: string; display_name: string; bio: string | null; avatar_url: string | null; aura_color: AuraColor;
  followers: number; following: number; videos: number; likes: number; is_following: boolean; is_friend: boolean; is_me: boolean;
}
export const spotlightApi = {
  feed: async (opts: { category?: Category | null; offset?: number; query?: string | null }) =>
    must(await supabase.rpc('spotlight_feed', { p_category: opts.category ?? null, p_offset: opts.offset ?? 0, p_limit: 8, p_query: opts.query || null })) as SpotlightVideo[],
  async publish(me: string, blob: Blob, poster: Blob | null, caption: string, category: Category, meta: object) {
    const id = crypto.randomUUID();
    const path = await uploadTo('spotlight', `${me}/${id}.${extFor(blob.type)}`, blob);
    const posterPath = poster ? await uploadTo('spotlight', `${me}/${id}-poster.webp`, poster) : null;
    must(await supabase.rpc('publish_spotlight', { p_id: id, p_media_path: path, p_poster_path: posterPath, p_caption: caption, p_category: category, p_meta: meta }));
    return id;
  },
  like: async (id: string, me: string) => must(await supabase.from('video_likes').insert({ video_id: id, user_id: me })),
  unlike: async (id: string, me: string) => must(await supabase.from('video_likes').delete().eq('video_id', id).eq('user_id', me)),
  save: async (id: string, me: string) => must(await supabase.from('video_saves').insert({ video_id: id, user_id: me })),
  unsave: async (id: string, me: string) => must(await supabase.from('video_saves').delete().eq('video_id', id).eq('user_id', me)),
  follow: async (me: string, them: string) => must(await supabase.from('follows').insert({ follower_id: me, followee_id: them })),
  unfollow: async (me: string, them: string) => must(await supabase.from('follows').delete().eq('follower_id', me).eq('followee_id', them)),
  view: async (id: string, ms: number) => {
    await supabase.rpc('record_view', { p_video: id, p_ms: Math.round(ms) });
  },
  comments: async (id: string) => must(await supabase.from('video_comments').select('id,video_id,user_id,body,created_at').eq('video_id', id).order('created_at', { ascending: false }).limit(100)) as VideoComment[],
  comment: async (id: string, body: string) => must(await supabase.rpc('add_comment', { p_video: id, p_body: body })) as string,
  removeComment: async (id: string) => must(await supabase.rpc('remove_comment', { p_comment: id })),
  report: async (id: string, reason: string) => must(await supabase.rpc('report_video', { p_video: id, p_reason: reason })),
  remove: async (id: string, files: (string | null)[] = []) => {
    must(await supabase.rpc('remove_spotlight', { p_id: id }));
    const paths = files.filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from('spotlight').remove(paths);
  },
  creator: async (username: string) => (must(await supabase.rpc('creator_profile', { p_username: username })) as Creator[])[0] ?? null,
  byUser: async (userId: string) => must(await supabase.from('spotlight_videos').select('id,media_path,poster_path,caption,like_count,view_count,created_at,status').eq('user_id', userId).neq('status', 'removed').order('created_at', { ascending: false }).limit(60)) as Pick<SpotlightVideo, 'id' | 'media_path' | 'poster_path' | 'caption' | 'like_count' | 'view_count' | 'created_at'>[],
  saved: async () => must(await supabase.from('video_saves').select('video_id').order('created_at', { ascending: false }).limit(60)) as { video_id: string }[],
  setInterests: async (me: string, interests: string[]) => must(await supabase.from('user_settings').update({ interests }).eq('user_id', me)),
};
