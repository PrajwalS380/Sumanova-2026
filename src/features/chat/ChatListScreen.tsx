import { memo, useEffect, useMemo, useState } from 'react';
import { useT } from '@/lib/i18n';
import { streaksApi, type StreakInfo } from '@/lib/social/api';
import { rowBadges, topFriendIds } from '@/lib/badges';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BellOff, Clock3, Eye, EyeOff, Lock, MessageSquarePlus, Pin, PinOff, Search, Star, StarOff, Users, UserPlus, Bell, Info, X } from 'lucide-react';
import { TopBar, BarButton } from '@/components/TopBar';
import { Avatar } from '@/components/Avatar';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
import { Sheet, SheetItem } from '@/components/ui/Sheet';
import { useAuth } from '@/providers/AuthProvider';
import { useInbox } from '@/providers/InboxProvider';
import { useToast } from '@/providers/ToastProvider';
import { chatApi } from '@/lib/chat/api';
import { chatStatus, conversationName, type ChatStatusTone } from '@/lib/chat/preview';
import { shortTime } from '@/lib/chat/time';
import type { ConversationSummary } from '@/lib/chat/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { NewGroupSheet } from './NewGroupSheet';
import { useLongPress } from './useLongPress';
import { hiddenChats, setChatHidden } from '@/lib/hiddenChats';
import { checkPin, lockEnabled, unlockWithBiometric, lockConfig } from '@/lib/appLock';
import { PinPad } from '@/components/AppLockGate';
import { PinSetupSheet } from '@/features/settings/LockRows';

export default function ChatListScreen() {
  const { session } = useAuth();
  const me = session!.user.id;
  const { conversations, loading, error, pendingRequests, online, patch, refresh } = useInbox();
  const [query, setQuery] = useState('');
  const tr = useT();
  const [searching, setSearching] = useState(false);
  const [chip, setChip] = useState<'all' | 'unread' | 'groups' | 'streaks' | 'hidden'>('all');
  const [hidden, setHidden] = useState(() => (lockEnabled() ? hiddenChats(me) : new Set<string>()));
  const [askPin, setAskPin] = useState(false);
  const [pinErr, setPinErr] = useState('');
  const [setupFor, setSetupFor] = useState<ConversationSummary | null>(null);
  useEffect(() => {
    const on = () => setHidden(lockEnabled() ? hiddenChats(me) : new Set());
    window.addEventListener('snv-hidden-changed', on);
    window.addEventListener('snv-lock-changed', on);
    return () => {
      window.removeEventListener('snv-hidden-changed', on);
      window.removeEventListener('snv-lock-changed', on);
    };
  }, [me]);
  function toggleHidden(c: ConversationSummary) {
    setMenu(null);
    if (!lockEnabled()) return setSetupFor(c);
    const hide = !hidden.has(c.id);
    setChatHidden(me, c.id, hide);
    toast(hide ? 'Chat hidden — find it under Hidden with your PIN' : 'Chat is back in your list', 'success');
  }
  async function openHidden() {
    if (chip === 'hidden') return setChip('all');
    if (lockConfig()?.bio && (await unlockWithBiometric())) return setChip('hidden');
    setPinErr('');
    setAskPin(true);
  }
  const [menu, setMenu] = useState<ConversationSummary | null>(null);
  const [newGroup, setNewGroup] = useState(false);
  const [streaks, setStreaks] = useState<Record<string, StreakInfo>>({});
  const loadStreaks = () => streaksApi.mine().then((list) => setStreaks(Object.fromEntries(list.map((x) => [x.friend_id, x])))).catch(() => undefined);
  async function restoreStreak(friendId: string) {
    try {
      const n = await streaksApi.restore(friendId);
      haptic(14);
      toast(`Streak of ${n} restored`, 'success');
      void loadStreaks();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  useEffect(() => {
    void loadStreaks();
  }, [conversations.length]);
  const toast = useToast();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? conversations.filter((c) => conversationName(c).toLowerCase().includes(q) || (c.other_username ?? '').includes(q) || (c.last_body ?? '').toLowerCase().includes(q))
      : conversations;
    list = chip === 'hidden' ? list.filter((c) => hidden.has(c.id)) : list.filter((c) => !hidden.has(c.id));
    if (chip === 'unread') list = list.filter((c) => c.unread_count > 0);
    if (chip === 'groups') list = list.filter((c) => c.kind === 'group');
    if (chip === 'streaks') list = list.filter((c) => !!c.other_user_id && (streaks[c.other_user_id]?.count ?? 0) > 0);
    return { rest: list };
  }, [conversations, query, chip, streaks, hidden]);
  const unreadCount = conversations.filter((c) => c.unread_count > 0 && !hidden.has(c.id)).length;
  const top = useMemo(() => topFriendIds(Object.values(streaks)), [streaks]);

  async function setPref(c: ConversationSummary, p: Partial<ConversationSummary>, msg: string) {
    patch(c.id, p);
    setMenu(null);
    try {
      await chatApi.setPrefs(c.id, me, p);
      toast(msg, 'success');
      void refresh();
    } catch (e) {
      patch(c.id, Object.fromEntries(Object.keys(p).map((k) => [k, c[k as keyof ConversationSummary]])) as Partial<ConversationSummary>);
      toast((e as Error).message, 'error');
    }
  }

  return (
    <div className="min-h-full bg-noir pb-28">
      <TopBar
        title={tr('Chat')}
        onSearch={() => setSearching((v) => !v)}
        friendBadge={pendingRequests}
        right={
          <BarButton label="New group chat" onClick={() => setNewGroup(true)}>
            <MessageSquarePlus className="h-5 w-5" />
          </BarButton>
        }
      />
      <div className="mx-auto max-w-lg px-4">
        {searching && (
          <label className="mb-2 flex h-11 items-center gap-2 rounded-2xl bg-white px-4">
            <Search className="h-4 w-4 text-ink-mute" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('Search chats')} className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint" aria-label="Search chats" />
            <button onClick={() => { setQuery(''); setSearching(false); }} aria-label="Close search" className="text-ink-mute"><X className="h-4 w-4" /></button>
          </label>
        )}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-1" role="tablist" aria-label="Filter chats">
          {([['all', tr('All')], ['unread', unreadCount ? `${tr('Unread')} · ${unreadCount}` : tr('Unread')], ['groups', tr('Groups')], ['streaks', tr('Streaks')]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={chip === id} onClick={() => setChip(id)} className={cn('shrink-0 rounded-xl px-3.5 py-1.5 text-[13px] font-bold', chip === id ? 'bg-ink text-white' : 'bg-white text-ink')}>
              {label}
            </button>
          ))}
          {hidden.size > 0 && (
            <button role="tab" aria-selected={chip === 'hidden'} onClick={() => void openHidden()} className={cn('flex shrink-0 items-center gap-1 rounded-xl px-3.5 py-1.5 text-[13px] font-bold', chip === 'hidden' ? 'bg-ink text-white' : 'bg-white text-ink')}>
              <Lock className="h-3 w-3" /> {tr('Hidden')}
            </button>
          )}
        </div>

        {error && (
          <button onClick={() => void refresh()} className="mt-4 w-full rounded-2xl bg-ember-rose/10 px-4 py-3 text-left text-sm text-ember-rose">
            {error} — tap to retry
          </button>
        )}

        <ul className="mt-3 overflow-hidden rounded-tile bg-white px-3 py-1">
          {loading && conversations.length === 0
            ? [0, 1, 2, 3].map((i) => <li key={i} className="h-[72px] animate-pulse rounded-3xl bg-ink/[0.04]" />)
            : filtered.rest.map((c, i) => (
                <ChatRow key={c.id} c={c} me={me} index={i} streak={c.other_user_id ? streaks[c.other_user_id] : undefined} top={!!c.other_user_id && top.has(c.other_user_id)} online={c.other_user_id ? online.has(c.other_user_id) : false} onOpen={() => navigate(`/chat/${c.id}`)} onMenu={() => setMenu(c)} onRestore={c.other_user_id ? () => void restoreStreak(c.other_user_id!) : undefined} />
              ))}
        </ul>

        {!loading && conversations.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass mt-6 rounded-4xl p-8 text-center">
            <p className="font-display text-lg">{tr('Your chats live here')}</p>
            <p className="mt-2 text-sm text-ink-mute">Add friends by username, then start a conversation.</p>
            <Link to="/friends" className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-ember-gradient text-noir px-5 text-sm font-semibold shadow-glow">
              <UserPlus className="h-4 w-4" /> {tr('Find friends')}
            </Link>
          </motion.div>
        )}
      </div>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu ? conversationName(menu) : undefined}>
        {menu && (
          <div className="pb-3">
            <SheetItem icon={menu.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />} label={menu.pinned ? 'Unpin' : 'Pin to top'} onClick={() => setPref(menu, { pinned: !menu.pinned }, menu.pinned ? 'Unpinned' : 'Pinned')} />
            <SheetItem icon={menu.favourite ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />} label={menu.favourite ? 'Remove from favourites' : 'Add to favourites'} onClick={() => setPref(menu, { favourite: !menu.favourite }, menu.favourite ? 'Removed from favourites' : 'Added to favourites')} />
            <SheetItem icon={menu.muted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />} label={menu.muted ? 'Unmute' : 'Mute notifications'} onClick={() => setPref(menu, { muted: !menu.muted }, menu.muted ? 'Unmuted' : 'Muted')} />
            <SheetItem icon={hidden.has(menu.id) ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} label={hidden.has(menu.id) ? 'Unhide chat' : 'Hide chat'} onClick={() => toggleHidden(menu)} />
            <SheetItem icon={<Info className="h-4 w-4" />} label="Chat details" onClick={() => { setMenu(null); navigate(`/chat/${menu.id}/info`); }} />
          </div>
        )}
      </Sheet>
      <NewGroupSheet open={newGroup} onClose={() => setNewGroup(false)} />
      <Sheet open={askPin} onClose={() => setAskPin(false)} title="Hidden chats">
        <div className="pb-6 pt-2">
          <PinPad
            title="Enter your PIN"
            error={pinErr}
            onDone={async (pin) => {
              if (await checkPin(pin)) {
                setAskPin(false);
                setChip('hidden');
              } else setPinErr('Wrong PIN');
            }}
          />
        </div>
      </Sheet>
      <PinSetupSheet
        open={!!setupFor}
        onClose={() => setSetupFor(null)}
        onSet={() => {
          const c = setupFor;
          setSetupFor(null);
          if (c) {
            setChatHidden(me, c.id, true);
            toast('App lock is on and the chat is hidden', 'success');
          }
        }}
      />
    </div>
  );
}

const ChatRow = memo(function ChatRow({ c, me, index, online, streak, top, onOpen, onMenu, onRestore }: { c: ConversationSummary; me: string; index: number; online: boolean; streak?: StreakInfo; top?: boolean; onOpen: () => void; onMenu: () => void; onRestore?: () => void }) {
  const press = useLongPress(() => {
    haptic(12);
    onMenu();
  });
  const unread = c.unread_count > 0;
  const name = conversationName(c);
  const status = chatStatus(c, me);
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 10) * 0.025 }} className="flex items-center gap-2">
      <button
        {...press}
        onClick={() => !press.wasLongPress() && onOpen()}
        className={cn('flex min-w-0 flex-1 select-none items-center gap-3 px-1 py-2.5 text-left transition-colors active:bg-ink/[0.04]', GHOST_HOST)}
      >
        <Ghost url={c.kind === 'group' ? c.avatar_url : c.other_avatar_url} />
        <span className="relative">
          {c.kind === 'group' && !c.avatar_url ? (
            <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[#DDE8FF] text-ember-sky">
              <Users className="h-5 w-5" />
            </span>
          ) : (
            <Avatar name={name} url={c.kind === 'group' ? c.avatar_url : c.other_avatar_url} aura={c.other_aura ?? 'violet'} size={54} />
          )}
          {online && <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-ember-sage ring-[3px] ring-noir" aria-label="Online" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn('truncate text-base', unread ? 'font-extrabold text-ink' : 'font-semibold')}>{name}</span>
            {rowBadges(streak, !!top).map((b) => <NovaEmoji key={b.id} id={b.id} size={17} label={b.label} />)}
            {c.pinned && <Pin className="h-3 w-3 shrink-0 text-ink-faint" />}
            {c.muted && <BellOff className="h-3 w-3 shrink-0 text-ink-faint" />}
            {c.disappear_mode !== 'never' && (c.disappear_mode === 'after_view' ? <Eye className="h-3 w-3 shrink-0 text-ink-faint" /> : <Clock3 className="h-3 w-3 shrink-0 text-ink-faint" />)}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-mute">
            <StatusMark tone={status.tone} />
            <span className={cn('truncate', TONE_TEXT[status.tone])}>{status.label}</span>
            <span className="shrink-0">· {shortTime(c.last_created_at ?? c.last_message_at)}</span>
            {streak && streak.count > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 font-extrabold text-[#c2410c]" aria-label={`${streak.count} day streak${streak.expiring ? ', ending soon' : ''}`}>
                {streak.count}
                <NovaEmoji id="flame" size={15} />
                {streak.expiring && <NovaEmoji id="hourglass" size={14} label="Ending soon" />}
              </span>
            )}
          </span>
        </span>
      </button>
      {streak?.restorable && onRestore && (
        <button onClick={onRestore} className="shrink-0 rounded-xl bg-ember-gold px-3 py-2 text-xs font-extrabold text-ink active:scale-95" aria-label={`Restore your ${streak.best}-day streak with ${name}`}>
          ↻ Restore
        </button>
      )}
    </motion.li>
  );
});

const TONE_TEXT: Record<ChatStatusTone, string> = { snap: 'font-extrabold text-ember-rose', chat: 'font-extrabold text-ember-sky', sent: 'text-ink-mute', received: 'text-ink-mute', none: 'text-ink-mute' };

/** Small square status mark: filled = new for you, outlined = already seen or sent by you. */
function StatusMark({ tone }: { tone: ChatStatusTone }) {
  if (tone === 'none') return null;
  const cls = { snap: 'bg-ember-rose border-ember-rose', chat: 'bg-ember-sky border-ember-sky', sent: 'border-ember-rose', received: 'border-ink-faint' }[tone];
  return <span aria-hidden className={cn('h-[11px] w-[11px] shrink-0 rounded-[3px] border-2', cls)} />;
}

