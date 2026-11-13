import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { chatApi } from '@/lib/chat/api';
import { removeMedia, uploadMedia } from '@/lib/chat/media';
import { backoffDelay, mergeMessages, outbox } from '@/lib/chat/outbox';
import type { DisappearMode, LocalMessage, Member, MediaMeta, Message, MessageKind, PublicProfile, Reaction } from '@/lib/chat/types';
import { useInbox } from '@/providers/InboxProvider';

export interface ConversationInfo {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  avatar_url: string | null;
  disappear_mode: DisappearMode;
  created_by: string | null;
}

const PAGE = 40;
const uuid = () => crypto.randomUUID();

/**
 * All state for one open conversation. Postgres is the source of truth; local
 * messages only exist until the server confirms them (matched by client_id).
 */
export function useConversation(conversationId: string, me: string) {
  const inbox = useInbox();
  const [info, setInfo] = useState<ConversationInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [people, setPeople] = useState<Record<string, PublicProfile>>({});
  const [server, setServer] = useState<LocalMessage[]>([]);
  const [local, setLocal] = useState<LocalMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);
  const visible = useRef(!document.hidden);

  // ---------- initial load ----------
  const loadPeople = useCallback(async (ids: string[]) => {
    const missing = ids.filter((id) => id && !people[id]);
    if (!missing.length) return;
    const profs = await chatApi.profiles(missing);
    setPeople((p) => ({ ...p, ...Object.fromEntries(profs.map((x) => [x.id, x])) }));
  }, [people]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [conv, mem, msgs] = await Promise.all([chatApi.conversation(conversationId), chatApi.members(conversationId), chatApi.messages(conversationId, undefined, PAGE)]);
      if (!conv) throw new Error('This chat doesn’t exist or you’re no longer a member.');
      setInfo(conv as ConversationInfo);
      setMembers(mem);
      setServer(msgs);
      setHasMore(msgs.length === PAGE);
      const profs = await chatApi.profiles(mem.map((m) => m.user_id));
      setPeople(Object.fromEntries(profs.map((x) => [x.id, x])));
      setReactions(await chatApi.reactions(msgs.map((m) => m.id)));
      // Restore unsent text messages from a previous session.
      const pending = outbox.forConversation(conversationId).map((m) => ({ ...m, sender_id: me, disappear_mode: 'never', expires_at: null, edited_at: null, deleted_at: null, local: 'failed' }) as LocalMessage);
      setLocal(pending);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [conversationId, me]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback(() => {
    if (visible.current) void chatApi.markRead(conversationId);
  }, [conversationId]);

  useEffect(() => {
    inbox.setActive(conversationId);
    markRead();
    const onVis = () => {
      visible.current = !document.hidden;
      if (visible.current) markRead();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      inbox.setActive(null);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, markRead]);

  // ---------- realtime ----------
  useEffect(() => {
    const off = inbox.subscribeMessages(({ eventType, new: n }) => {
      const m = n as Message;
      if (!m || m.conversation_id !== conversationId) return;
      if (eventType === 'INSERT') {
        setServer((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        setLocal((l) => l.filter((x) => x.client_id !== m.client_id));
        if (m.sender_id && m.sender_id !== me) {
          setTyping((t) => {
            const { [m.sender_id as string]: _, ...rest } = t;
            return rest;
          });
          markRead();
        }
        if (m.sender_id) void loadPeople([m.sender_id]);
      } else if (eventType === 'UPDATE') {
        setServer((list) => list.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
      }
    });

    const ch = supabase
      .channel(`conv:${conversationId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const uid = (payload as { user_id: string }).user_id;
        if (uid && uid !== me) setTyping((t) => ({ ...t, [uid]: Date.now() }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${conversationId}` }, (p) => {
        if (p.eventType === 'DELETE') {
          const old = p.old as Partial<Member>;
          setMembers((ms) => ms.filter((x) => x.user_id !== old.user_id));
          return;
        }
        const row = p.new as Member;
        setMembers((ms) => (ms.some((x) => x.user_id === row.user_id) ? ms.map((x) => (x.user_id === row.user_id ? { ...x, ...row } : x)) : [...ms, row]));
        void loadPeople([row.user_id]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (p) => {
        if (p.eventType === 'DELETE') {
          const old = p.old as Partial<Reaction>;
          setReactions((rs) => rs.filter((r) => !(r.message_id === old.message_id && r.user_id === old.user_id)));
        } else {
          const r = p.new as Reaction;
          setReactions((rs) => [...rs.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id)), r]);
        }
      })
      .subscribe((status) => {
        // Reconnected after a drop: fetch anything newer than what we have.
        if (status === 'SUBSCRIBED') void catchUp();
      });
    channelRef.current = ch;
    return () => {
      off();
      void supabase.removeChannel(ch);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, me]);

  const catchUp = useCallback(async () => {
    try {
      const latest = await chatApi.messages(conversationId, undefined, PAGE);
      setServer((list) => {
        const ids = new Set(list.map((m) => m.id));
        const merged = [...list, ...latest.filter((m) => !ids.has(m.id))].sort((a, b) => a.created_at.localeCompare(b.created_at));
        return merged.map((m) => latest.find((x) => x.id === m.id) ?? m);
      });
    } catch {
      /* offline: next reconnect will retry */
    }
  }, [conversationId]);

  // Tick for expiring messages and stale typing indicators.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setTyping((ty) => Object.fromEntries(Object.entries(ty).filter(([, at]) => Date.now() - at < 4000)));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // ---------- pagination ----------
  const loadOlder = useCallback(async () => {
    if (!hasMore || !server.length) return;
    const older = await chatApi.messages(conversationId, server[0].created_at, PAGE);
    setHasMore(older.length === PAGE);
    setServer((list) => [...older.filter((o) => !list.some((x) => x.id === o.id)), ...list]);
    const rs = await chatApi.reactions(older.map((m) => m.id));
    setReactions((r) => [...r, ...rs]);
  }, [conversationId, hasMore, server]);

  // ---------- sending ----------
  const attempts = useRef(new Map<string, number>());

  const deliver = useCallback(
    async (m: LocalMessage) => {
      try {
        let mediaPath = m.media_path;
        if (m.localBlob && !mediaPath) {
          mediaPath = await uploadMedia(conversationId, me, m.client_id, m.localBlob);
          setLocal((l) => l.map((x) => (x.client_id === m.client_id ? { ...x, media_path: mediaPath } : x)));
        }
        const saved = await chatApi.send({ conversation_id: conversationId, client_id: m.client_id, kind: m.kind, body: m.body, media_path: mediaPath, media_meta: m.media_meta, reply_to_id: m.reply_to_id, forwarded: m.forwarded }, me);
        outbox.remove(m.client_id);
        attempts.current.delete(m.client_id);
        setServer((list) => (list.some((x) => x.id === saved.id) ? list : [...list, saved]));
        setLocal((l) => l.filter((x) => x.client_id !== m.client_id));
        if (m.localUrl) setTimeout(() => URL.revokeObjectURL(m.localUrl!), 30_000);
      } catch (e) {
        const msg = (e as Error).message;
        const n = (attempts.current.get(m.client_id) ?? 0) + 1;
        attempts.current.set(m.client_id, n);
        setLocal((l) => l.map((x) => (x.client_id === m.client_id ? { ...x, local: 'failed' } : x)));
        outbox.put({ ...m, local: 'failed' });
        // Permanent errors (blocked, not allowed) shouldn't loop.
        const permanent = /can.t message|not a member|only accepts|violates|cannot/i.test(msg);
        if (!permanent && n < 6 && navigator.onLine) {
          setTimeout(() => {
            setLocal((l) => {
              const cur = l.find((x) => x.client_id === m.client_id);
              if (cur) void deliverRef.current({ ...cur, local: 'sending' });
              return l.map((x) => (x.client_id === m.client_id ? { ...x, local: 'sending' } : x));
            });
          }, backoffDelay(n));
        }
        throw e;
      }
    },
    [conversationId, me],
  );
  const deliverRef = useRef(deliver);
  deliverRef.current = deliver;

  // Flush the outbox when the connection comes back.
  useEffect(() => {
    const flush = () => {
      setLocal((l) => {
        l.filter((x) => x.local === 'failed').forEach((x) => void deliverRef.current({ ...x, local: 'sending' }).catch(() => undefined));
        return l.map((x) => (x.local === 'failed' ? { ...x, local: 'sending' } : x));
      });
    };
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);

  const send = useCallback(
    (input: { kind: MessageKind; body?: string | null; blob?: Blob; meta?: MediaMeta; replyTo?: string | null; forwarded?: boolean; mediaPath?: string | null }) => {
      const m: LocalMessage = {
        id: `local-${uuid()}`,
        conversation_id: conversationId,
        sender_id: me,
        client_id: uuid(),
        kind: input.kind,
        body: input.body ?? null,
        media_path: input.mediaPath ?? null,
        media_meta: input.meta ?? {},
        reply_to_id: input.replyTo ?? null,
        forwarded: input.forwarded ?? false,
        disappear_mode: info?.disappear_mode ?? 'never',
        expires_at: null,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        local: 'sending',
        localBlob: input.blob,
        localUrl: input.blob ? URL.createObjectURL(input.blob) : undefined,
      };
      setLocal((l) => [...l, m]);
      outbox.put(m);
      void deliver(m).catch(() => undefined);
    },
    [conversationId, deliver, info?.disappear_mode, me],
  );

  const retry = useCallback((clientId: string) => {
    setLocal((l) => {
      const m = l.find((x) => x.client_id === clientId);
      if (m) void deliverRef.current({ ...m, local: 'sending' }).catch(() => undefined);
      return l.map((x) => (x.client_id === clientId ? { ...x, local: 'sending' } : x));
    });
  }, []);

  const discard = useCallback((clientId: string) => {
    outbox.remove(clientId);
    setLocal((l) => l.filter((x) => x.client_id !== clientId));
  }, []);

  const edit = useCallback(async (id: string, body: string) => {
    const prev = server.find((m) => m.id === id);
    setServer((list) => list.map((m) => (m.id === id ? { ...m, body, edited_at: new Date().toISOString() } : m)));
    try {
      await chatApi.edit(id, body);
    } catch (e) {
      if (prev) setServer((list) => list.map((m) => (m.id === id ? prev : m)));
      throw e;
    }
  }, [server]);

  const remove = useCallback(async (id: string) => {
    const path = await chatApi.remove(id);
    setServer((list) => list.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString(), body: null, media_path: null } : m)));
    if (path) void removeMedia(path);
  }, []);

  const react = useCallback(async (messageId: string, emoji: string) => {
    const mine = reactions.find((r) => r.message_id === messageId && r.user_id === me);
    if (mine?.emoji === emoji) {
      setReactions((rs) => rs.filter((r) => !(r.message_id === messageId && r.user_id === me)));
      try {
        await chatApi.unreact(messageId, me);
      } catch (e) {
        setReactions((rs) => [...rs, mine]);
        throw e;
      }
      return;
    }
    setReactions((rs) => [...rs.filter((r) => !(r.message_id === messageId && r.user_id === me)), { message_id: messageId, user_id: me, emoji }]);
    await chatApi.react(messageId, me, emoji);
  }, [me, reactions]);

  const notifyTyping = useCallback(() => {
    const t = Date.now();
    if (t - lastTypingSent.current < 2000) return;
    lastTypingSent.current = t;
    void channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { user_id: me } });
  }, [me]);

  const messages = useMemo(
    () => mergeMessages(server, local).filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now),
    [server, local, now],
  );

  return {
    info, setInfo, members, people, messages, reactions, loading, error, hasMore, typing: Object.keys(typing),
    loadOlder, send, retry, discard, edit, remove, react, notifyTyping, reload: load,
  };
}
