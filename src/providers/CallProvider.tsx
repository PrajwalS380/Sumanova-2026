import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { callsApi, type CallKind, type CallRow } from '@/lib/calls/api';
import { CallSession, type CallPhase, type Quality } from '@/lib/calls/session';
import { GroupCallSession, type GroupPeer } from '@/lib/calls/group';
import { RING_TIMEOUT_MS } from '@/lib/calls/config';
import { startRingtone, stopRingtone } from '@/lib/calls/ringtone';
import { chatApi } from '@/lib/chat/api';
import type { PublicProfile } from '@/lib/chat/types';
import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';

const CallOverlay = lazy(() => import('@/features/calls/CallOverlay'));

export interface CallState {
  call: CallRow;
  role: 'caller' | 'callee';
  peer: PublicProfile | null;
  phase: CallPhase | 'incoming';
  detail?: string;
  local: MediaStream | null;
  remote: MediaStream | null;
  remoteMedia: { audio: boolean; video: boolean };
  quality: Quality;
  muted: boolean;
  videoOn: boolean;
  connectedAt: number | null;
  /** Group calls: the group, people in the call and everyone's profile. */
  group?: { title: string; avatar: string | null; peers: GroupPeer[]; people: Record<string, PublicProfile> };
}

interface CallApi {
  state: CallState | null;
  startCall: (conversationId: string, kind: CallKind) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  switchCamera: () => Promise<void>;
  /** Join a live group call from its chat. */
  joinCall: (call: CallRow) => Promise<void>;
}

const Ctx = createContext<CallApi | null>(null);
const TERMINAL = new Set(['declined', 'missed', 'cancelled', 'ended', 'failed', 'busy']);

export function CallProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const me = session?.user.id;
  const toast = useToast();
  const [state, setState] = useState<CallState | null>(null);
  const sessionRef = useRef<CallSession | null>(null);
  const groupRef = useRef<GroupCallSession | null>(null);
  const stateRef = useRef<CallState | null>(null);
  stateRef.current = state;
  const ringTimer = useRef<ReturnType<typeof setTimeout>>();

  const patch = useCallback((p: Partial<CallState>) => setState((s) => (s ? { ...s, ...p } : s)), []);

  const cleanup = useCallback((message?: string) => {
    stopRingtone();
    clearTimeout(ringTimer.current);
    sessionRef.current?.close();
    sessionRef.current = null;
    groupRef.current?.close();
    groupRef.current = null;
    if (message) {
      patch({ phase: 'ended', detail: message });
      setTimeout(() => setState(null), 1600);
    } else {
      setState(null);
    }
  }, [patch]);

  const peerFor = useCallback(async (call: CallRow): Promise<PublicProfile | null> => {
    const members = await chatApi.members(call.conversation_id).catch(() => []);
    const other = members.find((m) => m.user_id !== me);
    if (!other) return null;
    return (await chatApi.profiles([other.user_id]))[0] ?? null;
  }, [me]);

  const makeSession = useCallback((call: CallRow, role: 'caller' | 'callee') => {
    const s = new CallSession(call.id, role, call.kind, me!, {
      onPhase: (phase, detail) => {
        if (phase === 'connected') {
          stopRingtone();
          setState((st) => (st ? { ...st, phase, connectedAt: st.connectedAt ?? Date.now() } : st));
        } else if (phase === 'failed') {
          void callsApi.end(call.id, 'failed').catch(() => undefined);
          cleanup(detail ?? 'Call failed');
        } else if (phase !== 'ended') {
          patch({ phase, detail });
        }
      },
      onLocalStream: (local) => patch({ local }),
      onRemoteStream: (remote) => patch({ remote }),
      onRemoteMedia: (remoteMedia) => patch({ remoteMedia }),
      onQuality: (quality) => patch({ quality }),
      onHangup: () => cleanup('Call ended'),
    });
    sessionRef.current = s;
    return s;
  }, [cleanup, me, patch]);

  const groupInfo = useCallback(async (call: CallRow) => {
    const [{ data: conv }, members] = await Promise.all([
      supabase.from('conversations').select('title,avatar_url').eq('id', call.conversation_id).maybeSingle(),
      chatApi.members(call.conversation_id).catch(() => []),
    ]);
    const profs = await chatApi.profiles(members.map((m) => m.user_id)).catch(() => []);
    return { title: (conv?.title as string | null) ?? 'Group', avatar: (conv?.avatar_url as string | null) ?? null, peers: [] as GroupPeer[], people: Object.fromEntries(profs.map((p) => [p.id, p])) };
  }, []);

  /** Start my side of a group call (after start_call / answer_call). */
  const runGroup = useCallback(async (call: CallRow) => {
    const g = new GroupCallSession(call.id, call.kind, me!, {
      onLocalStream: (local) => patch({ local }),
      onPeers: (peers) => {
        setState((st) => {
          if (!st || !st.group) return st;
          const anyUp = peers.some((p) => p.state === 'connected');
          if (anyUp) stopRingtone();
          return { ...st, group: { ...st.group, peers }, phase: anyUp ? 'connected' : peers.length ? 'connecting' : st.role === 'caller' && !st.connectedAt ? 'ringing' : 'connecting', connectedAt: st.connectedAt ?? (anyUp ? Date.now() : null) };
        });
      },
      onError: (m) => toast(m, 'error'),
    });
    groupRef.current = g;
    await g.start();
  }, [me, patch, toast]);

  // Realtime: incoming calls and status changes of the current call.
  useEffect(() => {
    if (!me) return;
    const onRow = async (row: CallRow) => {
      const cur = stateRef.current;
      if (cur && cur.call.id === row.id) {
        patch({ call: row });
        if (row.status === 'accepted' && cur.role === 'caller' && !row.is_group) {
          stopRingtone();
          clearTimeout(ringTimer.current);
          void sessionRef.current?.onAccepted();
        }
        if (TERMINAL.has(row.status)) {
          const msg = row.status === 'declined' ? 'Call declined' : row.status === 'missed' ? 'No answer' : row.status === 'busy' ? 'They’re on another call' : 'Call ended';
          cleanup(msg);
        }
        return;
      }
      const ringingGroup = row.is_group && (row.status === 'ringing' || row.status === 'accepted') && row.caller_id !== me && !cur;
      if (ringingGroup) {
        if (Date.now() - new Date(row.started_at).getTime() > RING_TIMEOUT_MS) return;
        const mine = (await callsApi.inCall(row.id).catch(() => [])).find((p) => p.user_id === me);
        if (!mine || mine.joined_at || mine.left_at || stateRef.current) return; // not invited, already in, or declined
        const group = await groupInfo(row);
        setState({ call: row, role: 'callee', peer: null, phase: 'incoming', local: null, remote: null, remoteMedia: { audio: true, video: row.kind === 'video' }, quality: 'unknown', muted: false, videoOn: row.kind === 'video', connectedAt: null, group });
        startRingtone('incoming');
        ringTimer.current = setTimeout(() => {
          if (stateRef.current?.phase === 'incoming') {
            void callsApi.end(row.id, 'timeout').catch(() => undefined);
            cleanup('Missed group call');
          }
        }, RING_TIMEOUT_MS);
        return;
      }
      if (row.status === 'ringing' && row.caller_id !== me) {
        if (cur) {
          // Already busy: politely reject the second call.
          void callsApi.end(row.id, 'busy').catch(() => undefined);
          return;
        }
        if (Date.now() - new Date(row.started_at).getTime() > RING_TIMEOUT_MS) return;
        const peer = await peerFor(row);
        setState({ call: row, role: 'callee', peer, phase: 'incoming', local: null, remote: null, remoteMedia: { audio: true, video: row.kind === 'video' }, quality: 'unknown', muted: false, videoOn: row.kind === 'video', connectedAt: null });
        startRingtone('incoming');
        ringTimer.current = setTimeout(() => {
          if (stateRef.current?.phase === 'incoming') cleanup('Missed call');
        }, RING_TIMEOUT_MS);
      }
    };
    const ch = supabase
      .channel(`calls:${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, (p) => void onRow(p.new as CallRow))
      .subscribe();
    // App opened while a call is ringing (e.g. from a notification).
    void callsApi.active().then((rows) => rows.forEach((r) => void onRow(r))).catch(() => undefined);
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [cleanup, groupInfo, me, patch, peerFor]);

  // Group calls: close links to people whose participant row says they left (their "bye" may be lost).
  const groupCallId = state?.group ? state.call.id : null;
  useEffect(() => {
    if (!groupCallId) return;
    const ch = supabase
      .channel(`callp:${groupCallId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_participants', filter: `call_id=eq.${groupCallId}` }, (p) => {
        const row = p.new as { user_id: string; left_at: string | null };
        if (row.left_at && row.user_id !== me) groupRef.current?.removePeer(row.user_id);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [groupCallId, me]);

  // Leaving the page ends the call cleanly.
  useEffect(() => {
    const bye = () => {
      const cur = stateRef.current;
      if (cur && cur.phase !== 'incoming') {
        sessionRef.current?.hangup();
        groupRef.current?.leave();
        void callsApi.end(cur.call.id, 'hangup');
      }
    };
    window.addEventListener('pagehide', bye);
    return () => window.removeEventListener('pagehide', bye);
  }, []);

  const api = useMemo<CallApi>(() => ({
    state,
    startCall: async (conversationId, kind) => {
      if (stateRef.current) return toast('You’re already in a call', 'info');
      try {
        const id = await callsApi.start(conversationId, kind);
        const row = await callsApi.get(id);
        if (!row) throw new Error('Couldn’t start the call');
        if (row.is_group) {
          const joining = row.caller_id !== me || row.status === 'accepted';
          const group = await groupInfo(row);
          setState({ call: row, role: joining ? 'callee' : 'caller', peer: null, phase: 'preparing', local: null, remote: null, remoteMedia: { audio: true, video: row.kind === 'video' }, quality: 'unknown', muted: false, videoOn: row.kind === 'video', connectedAt: null, group });
          try {
            if (joining) await callsApi.answer(row.id);
            await runGroup(row);
          } catch (e) {
            if (!joining) await callsApi.end(id, 'failed').catch(() => undefined);
            cleanup((e as Error).message);
            return;
          }
          if (!joining) {
            patch({ phase: 'ringing' });
            startRingtone('outgoing');
            ringTimer.current = setTimeout(() => {
              const st = stateRef.current;
              if (st?.call.id === id && !st.connectedAt && !(st.group?.peers.length)) {
                void callsApi.end(id, 'timeout').catch(() => undefined);
                cleanup('Nobody joined');
              }
            }, RING_TIMEOUT_MS);
          }
          return;
        }
        const peer = await peerFor(row);
        if (row.status === 'busy') {
          toast(`${peer?.display_name ?? 'They'} ${peer ? 'is' : 'are'} on another call`, 'info');
          return;
        }
        setState({ call: row, role: 'caller', peer, phase: 'preparing', local: null, remote: null, remoteMedia: { audio: true, video: kind === 'video' }, quality: 'unknown', muted: false, videoOn: kind === 'video', connectedAt: null });
        const s = makeSession(row, 'caller');
        try {
          await s.start();
        } catch (e) {
          await callsApi.end(id, 'failed').catch(() => undefined);
          cleanup((e as Error).message);
          return;
        }
        startRingtone('outgoing');
        ringTimer.current = setTimeout(() => {
          if (stateRef.current?.call.id === id && !stateRef.current.connectedAt) {
            void callsApi.end(id, 'timeout').catch(() => undefined);
            cleanup('No answer');
          }
        }, RING_TIMEOUT_MS);
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    },
    accept: async () => {
      const cur = stateRef.current;
      if (!cur || cur.phase !== 'incoming') return;
      stopRingtone();
      clearTimeout(ringTimer.current);
      patch({ phase: 'preparing' });
      try {
        await callsApi.answer(cur.call.id);
        if (cur.call.is_group) await runGroup(cur.call);
        else await makeSession(cur.call, 'callee').start();
      } catch (e) {
        void callsApi.end(cur.call.id, 'failed').catch(() => undefined);
        cleanup((e as Error).message);
      }
    },
    decline: async () => {
      const cur = stateRef.current;
      if (!cur) return;
      stopRingtone();
      await callsApi.end(cur.call.id, 'declined').catch(() => undefined);
      cleanup();
    },
    hangup: async () => {
      const cur = stateRef.current;
      if (!cur) return;
      sessionRef.current?.hangup();
      groupRef.current?.leave();
      await callsApi.end(cur.call.id, 'hangup').catch(() => undefined);
      cleanup(cur.call.is_group ? 'You left the call' : 'Call ended');
    },
    toggleMute: () => {
      const cur = stateRef.current;
      if (!cur) return;
      sessionRef.current?.setMuted(!cur.muted);
      groupRef.current?.setMuted(!cur.muted);
      patch({ muted: !cur.muted });
    },
    toggleVideo: () => {
      const cur = stateRef.current;
      if (!cur) return;
      void sessionRef.current?.setVideo(!cur.videoOn);
      groupRef.current?.setVideo(!cur.videoOn);
      patch({ videoOn: !cur.videoOn });
    },
    switchCamera: async () => {
      try {
        await sessionRef.current?.switchCamera();
        await groupRef.current?.switchCamera();
      } catch {
        toast('Couldn’t switch camera', 'error');
      }
    },
    joinCall: async (call) => {
      if (stateRef.current) return toast('You’re already in a call', 'info');
      const group = await groupInfo(call);
      setState({ call, role: 'callee', peer: null, phase: 'preparing', local: null, remote: null, remoteMedia: { audio: true, video: call.kind === 'video' }, quality: 'unknown', muted: false, videoOn: call.kind === 'video', connectedAt: null, group });
      try {
        await callsApi.answer(call.id);
        await runGroup(call);
      } catch (e) {
        cleanup((e as Error).message);
      }
    },
  }), [cleanup, groupInfo, makeSession, me, patch, peerFor, runGroup, state, toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {state && (
        <Suspense fallback={null}>
          <CallOverlay />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}

export function useCalls() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCalls must be used inside <CallProvider>');
  return ctx;
}
