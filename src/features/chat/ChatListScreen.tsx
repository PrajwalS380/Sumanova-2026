import { memo, useEffect, useMemo, useState } from 'react';
import { streaksApi, type StreakInfo } from '@/lib/social/api';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BellOff, Clock3, Eye, Phone, Pin, PinOff, Search, Star, StarOff, Users, UserPlus, Bell, Info } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { Sheet, SheetItem } from '@/components/ui/Sheet';
import { useAuth } from '@/providers/AuthProvider';
import { useInbox } from '@/providers/InboxProvider';
import { useToast } from '@/providers/ToastProvider';
import { chatApi } from '@/lib/chat/api';
import { conversationName, previewText } from '@/lib/chat/preview';
import { shortTime } from '@/lib/chat/time';
import type { ConversationSummary } from '@/lib/chat/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { NewGroupSheet } from './NewGroupSheet';
import { useLongPress } from './useLongPress';

export default function ChatListScreen() {
  const { session } = useAuth();
  const me = session!.user.id;
  const { conversations, loading, error, pendingRequests, online, patch, refresh } = useInbox();
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<ConversationSummary | null>(null);
  const [newGroup, setNewGroup] = useState(false);
  const [streaks, setStreaks] = useState<Record<string, StreakInfo>>({});
  useEffect(() => {
    void streaksApi.mine().then((list) => setStreaks(Object.fromEntries(list.map((x) => [x.friend_id, x])))).catch(() => undefined);
  }, [conversations.length]);
  const toast = useToast();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? conversations.filter((c) => conversationName(c).toLowerCase().includes(q) || (c.other_username ?? '').includes(q) || (c.last_body ?? '').toLowerCase().includes(q))
      : conversations;
    return {
      favourites: q ? [] : list.filter((c) => c.favourite),
      rest: list,
    };
  }, [conversations, query]);

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
    <div className="pb-36">
      <ScreenHeader
        title="Chat"
        kicker={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
        right={
          <div className="flex gap-2">
            <Link to="/calls" className="glass grid h-10 w-10 place-items-center rounded-full" aria-label="Call history">
              <Phone className="h-5 w-5" />
            </Link>
            <button onClick={() => setNewGroup(true)} className="glass grid h-10 w-10 place-items-center rounded-full" aria-label="New group">
              <Users className="h-5 w-5" />
            </button>
            <Link to="/friends" className="glass relative grid h-10 w-10 place-items-center rounded-full" aria-label={`Friends${pendingRequests ? `, ${pendingRequests} requests` : ''}`}>
              <UserPlus className="h-5 w-5" />
              {pendingRequests > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ember-rose px-1 text-[10px] font-bold">{pendingRequests}</span>}
            </Link>
          </div>
        }
      />
      <div className="mx-auto max-w-lg px-4">
        <label className="glass flex h-11 items-center gap-2 rounded-2xl px-4">
          <Search className="h-4 w-4 text-ink-mute" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint" aria-label="Search chats" />
        </label>

        {filtered.favourites.length > 0 && (
          <div className="no-scrollbar -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {filtered.favourites.map((c) => (
              <Link key={c.id} to={`/chat/${c.id}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5 active:scale-95">
                <span className="relative">
                  <Avatar name={conversationName(c)} url={c.kind === 'group' ? c.avatar_url : c.other_avatar_url} aura={c.other_aura ?? 'violet'} size={58} />
                  {c.unread_count > 0 && <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-ember-sage ring-2 ring-noir" />}
                </span>
                <span className="w-full truncate text-center text-[11px] text-ink-soft">{conversationName(c).split(' ')[0]}</span>
              </Link>
            ))}
          </div>
        )}

        {error && (
          <button onClick={() => void refresh()} className="mt-4 w-full rounded-2xl bg-ember-rose/10 px-4 py-3 text-left text-sm text-ember-rose">
            {error} — tap to retry
          </button>
        )}

        <ul className="mt-4 space-y-1.5">
          {loading && conversations.length === 0
            ? [0, 1, 2, 3].map((i) => <li key={i} className="h-[72px] animate-pulse rounded-3xl bg-ink/[0.04]" />)
            : filtered.rest.map((c, i) => (
                <ChatRow key={c.id} c={c} me={me} index={i} streak={c.other_user_id ? streaks[c.other_user_id] : undefined} online={c.other_user_id ? online.has(c.other_user_id) : false} onOpen={() => navigate(`/chat/${c.id}`)} onMenu={() => setMenu(c)} />
              ))}
        </ul>

        {!loading && conversations.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass mt-6 rounded-4xl p-8 text-center">
            <p className="font-display text-lg">Your chats live here</p>
            <p className="mt-2 text-sm text-ink-mute">Add friends by username, then start a conversation.</p>
            <Link to="/friends" className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-ember-gradient text-noir px-5 text-sm font-semibold shadow-glow">
              <UserPlus className="h-4 w-4" /> Find friends
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
            <SheetItem icon={<Info className="h-4 w-4" />} label="Chat details" onClick={() => { setMenu(null); navigate(`/chat/${menu.id}/info`); }} />
          </div>
        )}
      </Sheet>
      <NewGroupSheet open={newGroup} onClose={() => setNewGroup(false)} />
    </div>
  );
}

const ChatRow = memo(function ChatRow({ c, me, index, online, streak, onOpen, onMenu }: { c: ConversationSummary; me: string; index: number; online: boolean; streak?: StreakInfo; onOpen: () => void; onMenu: () => void }) {
  const press = useLongPress(() => {
    haptic(12);
    onMenu();
  });
  const unread = c.unread_count > 0;
  const name = conversationName(c);
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 10) * 0.025 }}>
      <button
        {...press}
        onClick={() => !press.wasLongPress() && onOpen()}
        className={cn('flex w-full select-none items-center gap-3 rounded-3xl p-2.5 text-left transition-colors active:bg-ink/10', unread ? 'bg-ink/[0.06]' : 'hover:bg-ink/[0.04]')}
      >
        <span className="relative">
          {c.kind === 'group' && !c.avatar_url ? (
            <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br from-ember-flame/40 to-ember-jade/40 ring-1 ring-ink/10">
              <Users className="h-5 w-5" />
            </span>
          ) : (
            <Avatar name={name} url={c.kind === 'group' ? c.avatar_url : c.other_avatar_url} aura={c.other_aura ?? 'violet'} size={52} />
          )}
          {online && <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-ember-sage ring-[3px] ring-noir" aria-label="Online" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn('truncate text-[15px]', unread ? 'font-bold text-ink' : 'font-semibold')}>{name}</span>
            {c.pinned && <Pin className="h-3 w-3 shrink-0 text-ink-faint" />}
            {c.muted && <BellOff className="h-3 w-3 shrink-0 text-ink-faint" />}
            {c.disappear_mode !== 'never' && (c.disappear_mode === 'after_view' ? <Eye className="h-3 w-3 shrink-0 text-ember-peach" /> : <Clock3 className="h-3 w-3 shrink-0 text-ember-peach" />)}
          </span>
          <span className={cn('mt-0.5 block truncate text-[13px]', unread ? 'text-ink' : 'text-ink-mute')}>{previewText(c, me)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="flex items-center gap-1.5">
            {streak && streak.count > 0 && <span className="text-[11px] font-semibold text-ember-peach" aria-label={`${streak.count} day streak`}>🔥{streak.count}{streak.expiring && '⏳'}</span>}
            <span className={cn('text-[11px]', unread ? 'text-ember-sage' : 'text-ink-faint')}>{shortTime(c.last_created_at ?? c.last_message_at)}</span>
          </span>
          {unread ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ember-gradient text-noir px-1.5 text-[11px] font-bold">{c.unread_count > 99 ? '99+' : c.unread_count}</span>
          ) : (
            <span className="h-5" />
          )}
        </span>
      </button>
    </motion.li>
  );
});
