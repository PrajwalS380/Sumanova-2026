import { supabase } from '@/lib/supabase';
import { friendlyDbError } from '@/lib/chat/api';
import type { AuraColor } from '@/lib/types';

export type CallKind = 'voice' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'missed' | 'cancelled' | 'ended' | 'failed' | 'busy';

export interface CallRow {
  id: string;
  conversation_id: string;
  caller_id: string | null;
  kind: CallKind;
  status: CallStatus;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  is_group?: boolean;
}

export interface CallHistoryItem {
  id: string;
  conversation_id: string;
  kind: CallKind;
  status: CallStatus;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  outgoing: boolean;
  other_id: string;
  other_username: string;
  other_display_name: string;
  other_avatar_url: string | null;
  other_aura: AuraColor;
  is_group?: boolean;
}

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(friendlyDbError(r.error.message));
  return r.data as T;
}

export const callsApi = {
  start: async (conversationId: string, kind: CallKind) => must(await supabase.rpc('start_call', { p_conversation: conversationId, p_kind: kind })) as string,
  answer: async (id: string) => must(await supabase.rpc('answer_call', { p_call: id })),
  end: async (id: string, reason: 'hangup' | 'timeout' | 'failed' | 'declined' | 'busy' = 'hangup') => must(await supabase.rpc('end_call', { p_call: id, p_reason: reason })),
  get: async (id: string) => must(await supabase.from('calls').select('*').eq('id', id).maybeSingle()) as CallRow | null,
  /** Live call in a conversation I'm part of (for the group "Join" banner). */
  liveIn: async (conversationId: string) => (must(await supabase.from('calls').select('*').eq('conversation_id', conversationId).in('status', ['ringing', 'accepted']).order('started_at', { ascending: false }).limit(1)) as CallRow[])[0] ?? null,
  inCall: async (callId: string) => must(await supabase.from('call_participants').select('user_id,joined_at,left_at').eq('call_id', callId)) as { user_id: string; joined_at: string | null; left_at: string | null }[],
  active: async () => (must(await supabase.from('calls').select('*').in('status', ['ringing', 'accepted']).order('started_at', { ascending: false }).limit(5)) as CallRow[]),
  history: async () => must(await supabase.rpc('list_calls', { p_limit: 100 })) as CallHistoryItem[],
};
