import { supabase } from '@/lib/supabase';
import type { ConversationSummary, Friend, FriendRequest, Member, Message, PublicProfile, Reaction, SearchResult } from './types';

/** Thin, typed wrappers over the RPCs/tables. Every call throws on error. */
function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(friendlyDbError(res.error.message));
  return res.data as T;
}

export function friendlyDbError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('could not find the function') || m.includes('does not exist')) return 'This action is still being enabled. Try again soon.';
  if (m.includes('only accepts messages from friends')) return 'They only accept messages from friends.';
  if (m.includes('cannot message')) return 'You can’t message this person.';
  if (m.includes('too many')) return 'You’re going a bit fast — try again in a while.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'You’re offline. We’ll retry when you’re back.';
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}

export const chatApi = {
  listConversations: async () => must(await supabase.rpc('list_conversations')) as ConversationSummary[],
  getOrCreateDirect: async (userId: string) => must(await supabase.rpc('get_or_create_direct', { p_user: userId })) as string,
  createGroup: async (title: string, members: string[]) => must(await supabase.rpc('create_group', { p_title: title, p_members: members })) as string,
  updateGroup: async (id: string, patch: { title?: string; avatarUrl?: string; disappearMode?: string }) =>
    must(await supabase.rpc('update_group', { p_conversation: id, p_title: patch.title ?? null, p_avatar_url: patch.avatarUrl ?? null, p_disappear_mode: patch.disappearMode ?? null })),
  addMembers: async (id: string, users: string[]) => must(await supabase.rpc('add_group_members', { p_conversation: id, p_members: users })),
  removeMember: async (id: string, user: string) => must(await supabase.rpc('remove_group_member', { p_conversation: id, p_user: user })),
  setRole: async (id: string, user: string, role: 'admin' | 'member') => must(await supabase.rpc('set_member_role', { p_conversation: id, p_user: user, p_role: role })),
  leave: async (id: string) => must(await supabase.rpc('leave_conversation', { p_conversation: id })),
  deleteGroup: async (id: string) => must(await supabase.rpc('delete_group', { p_conversation: id })),
  clear: async (id: string) => must(await supabase.rpc('clear_conversation', { p_conversation: id })),
  markRead: async (id: string) => {
    await supabase.rpc('mark_read', { p_conversation: id });
  },
  markDelivered: async () => {
    await supabase.rpc('mark_delivered');
  },
  setPrefs: async (id: string, userId: string, patch: Partial<Pick<ConversationSummary, 'pinned' | 'muted' | 'favourite' | 'theme'>>) =>
    must(await supabase.from('conversation_members').update(patch).eq('conversation_id', id).eq('user_id', userId)),

  conversation: async (id: string) => must(await supabase.from('conversations').select('*').eq('id', id).maybeSingle()),
  members: async (id: string) => must(await supabase.from('conversation_members').select('conversation_id,user_id,role,last_read_at,last_delivered_at,joined_at').eq('conversation_id', id)) as Member[],
  profiles: async (ids: string[]) => (ids.length ? (must(await supabase.from('profiles').select('id,username,display_name,avatar_url,aura_color').in('id', ids)) as PublicProfile[]) : []),

  messages: async (id: string, before?: string, limit = 40) => {
    let q = supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).limit(limit);
    if (before) q = q.lt('created_at', before);
    return (must(await q) as Message[]).reverse();
  },
  messageById: async (id: string) => must(await supabase.from('messages').select('*').eq('id', id).maybeSingle()) as Message | null,
  send: async (m: Pick<Message, 'conversation_id' | 'client_id' | 'kind' | 'body' | 'media_path' | 'media_meta' | 'reply_to_id' | 'forwarded'>, senderId: string) => {
    const res = await supabase.from('messages').insert({ ...m, sender_id: senderId }).select().single();
    // Duplicate client_id means the message already reached the server (retry after a dropped response).
    if (res.error?.code === '23505') {
      return must(await supabase.from('messages').select('*').eq('sender_id', senderId).eq('client_id', m.client_id).single()) as Message;
    }
    return must(res) as Message;
  },
  edit: async (id: string, body: string) => must(await supabase.rpc('edit_message', { p_message: id, p_body: body })),
  remove: async (id: string) => must(await supabase.rpc('delete_message', { p_message: id })) as string | null,

  reactions: async (messageIds: string[]) => (messageIds.length ? (must(await supabase.from('message_reactions').select('message_id,user_id,emoji').in('message_id', messageIds)) as Reaction[]) : []),
  react: async (messageId: string, userId: string, emoji: string) => must(await supabase.from('message_reactions').upsert({ message_id: messageId, user_id: userId, emoji })),
  unreact: async (messageId: string, userId: string) => must(await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId)),

  lastSeen: async (userId: string) => {
    const { data } = await supabase.from('user_presence').select('last_seen_at').eq('user_id', userId).maybeSingle();
    return (data?.last_seen_at as string | undefined) ?? null;
  },
  touchPresence: async () => {
    await supabase.rpc('touch_presence');
  },
};

export const friendsApi = {
  search: async (q: string) => must(await supabase.rpc('search_users', { p_query: q })) as SearchResult[],
  list: async () => must(await supabase.rpc('list_friends')) as Friend[],
  requests: async () => must(await supabase.from('friend_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })) as FriendRequest[],
  send: async (userId: string) => must(await supabase.rpc('send_friend_request', { p_user: userId })) as 'sent' | 'accepted' | 'already_friends',
  respond: async (id: string, accept: boolean) => must(await supabase.rpc('respond_friend_request', { p_request: id, p_accept: accept })),
  cancel: async (id: string) => must(await supabase.rpc('cancel_friend_request', { p_request: id })),
  remove: async (userId: string) => must(await supabase.rpc('remove_friend', { p_user: userId })),
  block: async (userId: string) => must(await supabase.rpc('block_user', { p_user: userId })),
  unblock: async (userId: string) => must(await supabase.rpc('unblock_user', { p_user: userId })),
  blocked: async () => must(await supabase.from('blocks').select('blocked_id,created_at')) as { blocked_id: string; created_at: string }[],
  report: async (userId: string | null, reason: string, details?: string, messageId?: string) =>
    must(await supabase.rpc('report_user', { p_user: userId, p_reason: reason, p_details: details ?? null, p_message: messageId ?? null })),
};
