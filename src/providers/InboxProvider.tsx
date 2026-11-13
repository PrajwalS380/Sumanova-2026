import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { chatApi } from '@/lib/chat/api';
import { snapsApi } from '@/lib/snaps/api';
import type { ConversationSummary } from '@/lib/chat/types';
import { useAuth } from './AuthProvider';

interface InboxState {
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  unreadTotal: number;
  pendingRequests: number;
  online: Set<string>;
  refresh: () => Promise<void>;
  patch: (id: string, p: Partial<ConversationSummary>) => void;
  /** Conversation currently on screen: its new messages don't count as unread. */
  setActive: (id: string | null) => void;
  /** Fires for every new message the user can see (used by open threads). */
  subscribeMessages: (fn: (payload: { eventType: string; new: unknown; old: unknown }) => void) => () => void;
}

const Ctx = createContext<InboxState | null>(null);

/**
 * One Realtime connection for the whole app: new messages (RLS-filtered to the
 * user's conversations), membership changes, friend requests and online
 * presence. Threads piggy-back on it instead of opening extra channels.
 */
export function InboxProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const me = session?.user.id;
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const active = useRef<string | null>(null);
  const listeners = useRef(new Set<(p: { eventType: string; new: unknown; old: unknown }) => void>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>();

  const refresh = useCallback(async () => {
    if (!me) return;
    try {
      const list = await chatApi.listConversations();
      setConversations(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [me]);

  const refreshRequests = useCallback(async () => {
    if (!me) return;
    const { count } = await supabase.from('friend_requests').select('id', { count: 'exact', head: true }).eq('receiver_id', me).eq('status', 'pending');
    setPendingRequests(count ?? 0);
  }, [me]);

  // Coalesce bursts of events into one list refresh.
  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => void refresh(), 250);
  }, [refresh]);

  useEffect(() => {
    if (!me) return;
    void refresh();
    void refreshRequests();
    void chatApi.markDelivered();
    void snapsApi.markDelivered();
    void chatApi.touchPresence();

    const channel: RealtimeChannel = supabase
      .channel(`inbox:${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        listeners.current.forEach((fn) => fn(payload as never));
        if (payload.eventType === 'INSERT') {
          const m = payload.new as { conversation_id: string; sender_id: string | null };
          if (m.sender_id !== me && active.current !== m.conversation_id) void chatApi.markDelivered();
          if (m.sender_id !== me && (m as { kind?: string }).kind === 'snap') void snapsApi.markDelivered();
        }
        scheduleRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${me}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => void refreshRequests());

    // Presence is shared across users via one global topic.
    const presence = supabase.channel('presence:online', { config: { presence: { key: me } } });
    presence
      .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(presence.presenceState()))))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void presence.track({ at: Date.now() });
      });

    channel.subscribe((status) => {
      // After a reconnect, catch up on anything missed while offline.
      if (status === 'SUBSCRIBED') scheduleRefresh();
    });

    const heartbeat = setInterval(() => void chatApi.touchPresence(), 60_000);
    const onVisibility = () => {
      void chatApi.touchPresence();
      if (!document.hidden) {
        scheduleRefresh();
        void presence.track({ at: Date.now() });
      } else {
        void presence.untrack();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', scheduleRefresh);

    return () => {
      clearInterval(heartbeat);
      clearTimeout(refreshTimer.current);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', scheduleRefresh);
      void supabase.removeChannel(channel);
      void supabase.removeChannel(presence);
    };
  }, [me, refresh, refreshRequests, scheduleRefresh]);

  const value = useMemo<InboxState>(
    () => ({
      conversations,
      loading,
      error,
      unreadTotal: conversations.reduce((n, c) => n + (c.muted || c.id === active.current ? 0 : c.unread_count), 0),
      pendingRequests,
      online,
      refresh,
      patch: (id, p) => setConversations((list) => list.map((c) => (c.id === id ? { ...c, ...p } : c))),
      setActive: (id) => {
        active.current = id;
        if (id) setConversations((list) => list.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
      },
      subscribeMessages: (fn) => {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
      },
    }),
    [conversations, loading, error, pendingRequests, online, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInbox() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInbox must be used inside <InboxProvider>');
  return ctx;
}

/** Same as useInbox but returns null outside the provider (e.g. in tests). */
export function useInboxOptional() {
  return useContext(Ctx);
}
