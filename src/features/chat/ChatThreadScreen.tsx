import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, Copy, CornerUpRight, Flag, Info, Loader2, PencilLine, Phone, Reply, Trash2, Users, Video } from 'lucide-react';
import { useCalls } from '@/providers/CallProvider';
import { Avatar } from '@/components/Avatar';
import { Sheet, SheetItem } from '@/components/ui/Sheet';
import { useAuth } from '@/providers/AuthProvider';
import { useInbox } from '@/providers/InboxProvider';
import { useToast } from '@/providers/ToastProvider';
import { chatApi, friendsApi } from '@/lib/chat/api';
import { signedUrl } from '@/lib/chat/media';
import { conversationName } from '@/lib/chat/preview';
import { dayLabel, lastSeenLabel } from '@/lib/chat/time';
import type { LocalMessage, Member } from '@/lib/chat/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { Composer } from './Composer';
import { MessageBubble, type Receipt } from './MessageBubble';
import { CHAT_THEMES, QUICK_REACTIONS } from './themes';
import { useConversation } from './useConversation';
import { useSnapStatuses } from '@/features/snaps/useSnapStatuses';
import { snapTileState } from '@/features/snaps/SnapTile';
import { SnapViewer } from '@/features/snaps/SnapViewer';
import { streaksApi, type FriendshipProfile } from '@/lib/social/api';

export default function ChatThreadScreen() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const me = session!.user.id;
  const navigate = useNavigate();
  const toast = useToast();
  const inbox = useInbox();
  const conv = useConversation(id, me);
  const calls = useCalls();
  const summary = inbox.conversations.find((c) => c.id === id);
  const theme = CHAT_THEMES[summary?.theme ?? 'aurora'];
  const [menu, setMenu] = useState<LocalMessage | null>(null);
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const [editing, setEditing] = useState<LocalMessage | null>(null);
  const [forwarding, setForwarding] = useState<LocalMessage | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [snapView, setSnapView] = useState<{ id: string; mode: 'open' | 'replay' | 'own' } | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);

  const info = conv.info;
  const isGroup = info?.kind === 'group';
  const other = !isGroup ? conv.members.find((m) => m.user_id !== me) : undefined;
  const otherProfile = other ? conv.people[other.user_id] : undefined;
  const title = isGroup ? info?.title ?? 'Group' : otherProfile?.display_name ?? summary?.other_display_name ?? '';
  const online = other ? inbox.online.has(other.user_id) : false;

  useEffect(() => {
    if (!other || online) return;
    void chatApi.lastSeen(other.user_id).then(setLastSeen);
  }, [other, online]);

  // Infinite scroll upwards (list is column-reverse, so the "top" is the end).
  useEffect(() => {
    const el = topSentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || loadingOlder || !conv.hasMore) return;
      setLoadingOlder(true);
      try {
        await conv.loadOlder();
      } finally {
        setLoadingOlder(false);
      }
    }, { root: scroller.current, rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [conv, loadingOlder]);

  const snapIds = useMemo(() => conv.messages.filter((m) => m.kind === 'snap').map((m) => (m.media_meta as { snap_id?: string }).snap_id ?? '').filter(Boolean), [conv.messages]);
  const snapStatus = useSnapStatuses(snapIds);

  const byId = useMemo(() => new Map(conv.messages.map((m) => [m.id, m])), [conv.messages]);
  const reactionsBy = useMemo(() => {
    const map = new Map<string, typeof conv.reactions>();
    for (const r of conv.reactions) map.set(r.message_id, [...(map.get(r.message_id) ?? []), r]);
    return map;
  }, [conv.reactions]);

  // Receipt only on my latest message: Seen/Delivered/Sent based on the other members' watermarks.
  const lastMine = useMemo(() => [...conv.messages].reverse().find((m) => m.sender_id === me && m.kind !== 'system'), [conv.messages, me]);
  const receiptFor = useCallback(
    (m: LocalMessage): Receipt => {
      if (m.local) return m.local === 'failed' ? 'failed' : 'sending';
      if (m.id !== lastMine?.id) return null;
      const others = conv.members.filter((x: Member) => x.user_id !== me);
      if (!others.length) return 'sent';
      if (others.every((x) => x.last_read_at >= m.created_at)) return 'seen';
      if (others.some((x) => x.last_delivered_at >= m.created_at)) return 'delivered';
      return 'sent';
    },
    [conv.members, lastMine, me],
  );

  const scrollToBottom = () => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const jumpTo = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return toast('That message is further back', 'info');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.animate([{ background: 'rgba(255,181,71,.25)' }, { background: 'transparent' }], { duration: 1200 });
  };

  async function safe(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      if (ok) toast(ok, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function forwardTo(targetId: string) {
    const m = forwarding;
    setForwarding(null);
    if (!m) return;
    await safe(async () => {
      let blob: Blob | undefined;
      if (m.media_path) blob = await (await fetch(await signedUrl(m.media_path))).blob();
      const clientId = crypto.randomUUID();
      let mediaPath: string | null = null;
      if (blob) {
        const { uploadMedia } = await import('@/lib/chat/media');
        mediaPath = await uploadMedia(targetId, me, clientId, blob);
      }
      await chatApi.send({ conversation_id: targetId, client_id: clientId, kind: m.kind, body: m.body, media_path: mediaPath, media_meta: m.media_meta, reply_to_id: null, forwarded: true }, me);
    }, 'Forwarded');
  }

  const disabledReason = conv.error ? conv.error : null;
  const typingNames = conv.typing.map((u) => conv.people[u]?.display_name.split(' ')[0]).filter(Boolean);

  // Render newest-first inside a column-reverse scroller: the browser keeps us pinned to the bottom.
  const rows = useMemo(() => {
    const list = conv.messages;
    const out: { key: string; node: 'day' | 'msg'; m?: LocalMessage; label?: string; prev?: LocalMessage; next?: LocalMessage }[] = [];
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const prev = list[i - 1];
      if (!prev || dayLabel(prev.created_at) !== dayLabel(m.created_at)) out.push({ key: `day-${m.created_at}`, node: 'day', label: dayLabel(m.created_at) });
      out.push({ key: m.client_id ?? m.id, node: 'msg', m, prev, next: list[i + 1] });
    }
    return out.reverse();
  }, [conv.messages]);

  const close = (a: LocalMessage, b?: LocalMessage) => !!b && b.kind !== 'system' && a.kind !== 'system' && a.sender_id === b.sender_id && Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 3 * 60_000;

  return (
    <div className="fixed inset-0 flex flex-col bg-noir" style={{ backgroundImage: theme.wallpaper }}>
      {/* Header */}
      <header className="glass-strong z-30 flex items-center gap-2 rounded-b-[1.75rem] px-2 pb-2.5 pt-safe">
        <button onClick={() => navigate('/chat')} className="grid h-10 w-10 place-items-center rounded-full" aria-label="Back to chats">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <Link to={`/chat/${id}/info`} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-1 pr-2 active:bg-ink/5">
          {isGroup ? (
            info?.avatar_url ? <Avatar name={title} url={info.avatar_url} size={40} /> : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-ember-flame/50 to-ember-jade/50"><Users className="h-5 w-5" /></span>
            )
          ) : (
            <span className="relative">
              <Avatar name={title || '?'} url={otherProfile?.avatar_url} aura={otherProfile?.aura_color} size={40} />
              {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-ember-sage ring-2 ring-noir-800" />}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold">{title}</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={typingNames.length ? 'typing' : 'status'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="block truncate text-xs" style={{ color: typingNames.length ? theme.accent : undefined }}>
                {typingNames.length ? (
                  <span className="flex items-center gap-1">{isGroup ? `${typingNames.join(', ')} typing` : 'typing'}<TypingDots /></span>
                ) : isGroup ? (
                  <span className="text-ink-mute">{conv.members.length} members</span>
                ) : online ? (
                  <span className="text-ember-sage">Online</span>
                ) : (
                  <span className="text-ink-mute">{lastSeenLabel(lastSeen) || `@${otherProfile?.username ?? ''}`}</span>
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </Link>
        {!isGroup && info && (
          <>
            <button onClick={() => void calls.startCall(id, 'voice')} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft active:scale-90" aria-label="Voice call">
              <Phone className="h-5 w-5" />
            </button>
            <button onClick={() => void calls.startCall(id, 'video')} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft active:scale-90" aria-label="Video call">
              <Video className="h-5 w-5" />
            </button>
          </>
        )}
        {isGroup && (
          <Link to={`/chat/${id}/info`} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft" aria-label="Chat details">
            <Info className="h-5 w-5" />
          </Link>
        )}
      </header>
      {!isGroup && summary?.other_user_id && <InfoStrip friendId={summary.other_user_id} />}

      {/* Messages */}
      <div
        ref={scroller}
        onScroll={(e) => setAtBottom((e.currentTarget as HTMLDivElement).scrollTop > -120)}
        className="flex flex-1 flex-col-reverse overflow-y-auto overscroll-contain pb-2"
      >
        {conv.loading ? (
          <div className="grid flex-1 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div>
        ) : (
          <>
            <AnimatePresence>
              {typingNames.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="ml-3 mt-2 w-fit rounded-full bg-ink/[0.08] px-4 py-3">
                  <TypingDots />
                </motion.div>
              )}
            </AnimatePresence>
            {rows.map((r) =>
              r.node === 'day' ? (
                <div key={r.key} className="sticky top-2 z-10 my-3 flex justify-center">
                  <span className="glass rounded-full px-3 py-1 text-[11px] font-medium text-ink-soft">{r.label}</span>
                </div>
              ) : (
                <Fragment key={r.key}>
                  <MessageBubble
                    m={r.m!}
                    mine={r.m!.sender_id === me}
                    sender={r.m!.sender_id ? conv.people[r.m!.sender_id] : undefined}
                    showSender={isGroup}
                    groupedWithPrev={close(r.m!, r.prev)}
                    groupedWithNext={close(r.m!, r.next)}
                    reply={r.m!.reply_to_id ? byId.get(r.m!.reply_to_id) ?? null : null}
                    replySender={r.m!.reply_to_id ? (byId.get(r.m!.reply_to_id)?.sender_id === me ? 'You' : conv.people[byId.get(r.m!.reply_to_id)?.sender_id ?? '']?.display_name) : undefined}
                    reactions={reactionsBy.get(r.m!.id) ?? []}
                    receipt={r.m!.sender_id === me ? receiptFor(r.m!) : null}
                    bubbleGradient={theme.mine}
                    bubbleInk={theme.ink}
                    onMenu={setMenu}
                    onReplyTap={jumpTo}
                    onRetry={conv.retry}
                    onOpenImage={setViewer}
                    onQuickReact={(m) => { haptic(10); void safe(() => conv.react(m.id, '❤️')); }}
                    snap={r.m!.kind === 'snap' ? (() => {
                      const sid = (r.m!.media_meta as { snap_id?: string }).snap_id ?? '';
                      const mineSnap = r.m!.sender_id === me;
                      const st = snapTileState(mineSnap, snapStatus.rows.filter((x) => x.snap_id === sid), snapStatus.snaps[sid], me);
                      return { ...st, onOpen: () => setSnapView({ id: sid, mode: mineSnap ? 'own' : st.state === 'replayable' ? 'replay' : 'open' }) };
                    })() : undefined}
                  />
                </Fragment>
              ),
            )}
            <div ref={topSentinel} className="h-1" />
            {loadingOlder && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-ink-mute" /></div>}
            {!conv.hasMore && conv.messages.length > 0 && <p className="py-6 text-center text-xs text-ink-faint">This is the beginning of your chat ✦</p>}
            {conv.messages.length === 0 && !conv.error && (
              <div className="m-auto flex flex-col items-center gap-3 px-8 py-16 text-center">
                <Avatar name={title || '?'} url={isGroup ? info?.avatar_url : otherProfile?.avatar_url} aura={otherProfile?.aura_color} size={84} />
                <p className="font-display text-lg">{title}</p>
                <p className="text-sm text-ink-mute">Say hi — or send a sticker to break the ice.</p>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {!atBottom && (
          <motion.button initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} onClick={scrollToBottom} aria-label="Jump to latest" className="glass-strong absolute bottom-28 right-4 z-30 grid h-11 w-11 place-items-center rounded-full">
            <ChevronDown className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <Composer
        onSend={(m) => { conv.send(m); scrollToBottom(); }}
        onEdit={conv.edit}
        onTyping={conv.notifyTyping}
        replyTo={replyTo}
        replyName={replyTo ? (replyTo.sender_id === me ? 'yourself' : conv.people[replyTo.sender_id ?? '']?.display_name) : undefined}
        editing={editing}
        onCancel={() => { setReplyTo(null); setEditing(null); }}
        accent={theme.accent}
        disabled={disabledReason}
      />

      {/* Long-press menu */}
      <Sheet open={!!menu} onClose={() => setMenu(null)}>
        {menu && (
          <div className="pb-3">
            <div className="flex justify-around px-4 pb-3">
              {QUICK_REACTIONS.map((e) => {
                const active = conv.reactions.some((r) => r.message_id === menu.id && r.user_id === me && r.emoji === e);
                return (
                  <button key={e} onClick={() => { haptic(10); void safe(() => conv.react(menu.id, e)); setMenu(null); }} className={cn('grid h-12 w-12 place-items-center rounded-full text-2xl transition-transform active:scale-90', active ? 'bg-ink/15 ring-1 ring-ink/30' : 'hover:bg-ink/5')} aria-label={`React ${e}`}>
                    {e}
                  </button>
                );
              })}
            </div>
            <SheetItem icon={<Reply className="h-4 w-4" />} label="Reply" onClick={() => { setReplyTo(menu); setMenu(null); }} />
            {menu.body && menu.kind === 'text' && <SheetItem icon={<Copy className="h-4 w-4" />} label="Copy text" onClick={() => { void navigator.clipboard?.writeText(menu.body ?? ''); toast('Copied', 'success'); setMenu(null); }} />}
            {menu.kind !== 'snap' && <SheetItem icon={<CornerUpRight className="h-4 w-4" />} label="Forward" onClick={() => { setForwarding(menu); setMenu(null); }} />}
            {menu.sender_id === me && menu.kind === 'text' && Date.now() - new Date(menu.created_at).getTime() < 86_400_000 && (
              <SheetItem icon={<PencilLine className="h-4 w-4" />} label="Edit" onClick={() => { setEditing(menu); setMenu(null); }} />
            )}
            {menu.sender_id === me && (
              <SheetItem danger icon={<Trash2 className="h-4 w-4" />} label="Delete for everyone" onClick={() => { const m = menu; setMenu(null); void safe(() => conv.remove(m.id), 'Message deleted'); }} />
            )}
            {menu.sender_id !== me && (
              <SheetItem danger icon={<Flag className="h-4 w-4" />} label="Report message" onClick={() => { const m = menu; setMenu(null); void safe(() => friendsApi.report(m.sender_id, 'inappropriate', undefined, m.id), 'Reported. Thanks for keeping SUMANOVA safe.'); }} />
            )}
          </div>
        )}
      </Sheet>

      {/* Forward picker */}
      <Sheet open={!!forwarding} onClose={() => setForwarding(null)} title="Forward to">
        <ul className="px-3 pb-4">
          {inbox.conversations.filter((c) => c.id !== id).map((c) => (
            <li key={c.id}>
              <button onClick={() => void forwardTo(c.id)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-ink/5">
                <Avatar name={conversationName(c)} url={c.kind === 'group' ? c.avatar_url : c.other_avatar_url} aura={c.other_aura ?? 'violet'} size={40} />
                <span className="truncate font-medium">{conversationName(c)}</span>
              </button>
            </li>
          ))}
          {inbox.conversations.length <= 1 && <p className="py-6 text-center text-sm text-ink-mute">No other chats yet.</p>}
        </ul>
      </Sheet>

      {snapView && <SnapViewer snapId={snapView.id} mode={snapView.mode} onClose={() => setSnapView(null)} />}

      {/* Image viewer */}
      <AnimatePresence>
        {viewer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] grid place-items-center bg-black/95" onClick={() => setViewer(null)}>
            <motion.img initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} src={viewer} alt="Photo" className="max-h-full max-w-full object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="typing">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-current" animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  );
}

/** Slim strip under the header: streak, snaps shared and how long you've been friends. */
function InfoStrip({ friendId }: { friendId: string }) {
  const [f, setF] = useState<FriendshipProfile | null>(null);
  useEffect(() => {
    let alive = true;
    void streaksApi.friendship(friendId).then((p) => alive && setF(p)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [friendId]);
  if (!f) return null;
  const since = new Date(f.friends_since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return (
    <div className="mx-3 mt-2 flex items-center justify-around rounded-2xl bg-white/70 px-3 py-1.5 text-[11px] font-bold text-ink-soft ring-1 ring-ink/[0.06]">
      <span className={cn(f.streak_expiring && 'text-ember-rose')}>🔥 {f.streak} streak{f.streak_expiring ? ' · ending' : ''}</span>
      <span>{f.snaps_exchanged} snaps</span>
      <span>Friends since {since}</span>
    </div>
  );
}
