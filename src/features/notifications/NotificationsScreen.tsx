import { motion } from 'framer-motion';
import { AtSign, Bell, CheckCheck, Flame, Heart, MessageCircle, PhoneMissed, Sparkles, UserPlus, Users } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useNotifications } from '@/providers/NotificationsProvider';
import { shortTime } from '@/lib/chat/time';
import { cn } from '@/lib/cn';

const ICON: Record<string, typeof Bell> = {
  friend_request: UserPlus, friend_accepted: Users, missed_call: PhoneMissed, snap: Sparkles, story_reaction: Heart,
  story_reply: MessageCircle, mention: AtSign, comment: MessageCircle, follow: UserPlus, streak: Flame,
};

export default function NotificationsScreen() {
  const { items, unread, markAllRead, open } = useNotifications();
  return (
    <div className="pb-16">
      <ScreenHeader title="Activity" back right={unread > 0 ? <button onClick={() => void markAllRead()} className="glass flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold"><CheckCheck className="h-4 w-4" /> Mark read</button> : undefined} />
      <div className="mx-auto max-w-lg px-4">
        {items.length === 0 ? (
          <div className="glass mt-6 rounded-4xl p-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-ink-mute" />
            <p className="mt-3 font-display text-lg">All caught up</p>
            <p className="mt-1 text-sm text-ink-mute">Friend requests, missed calls, snaps, mentions and streak reminders show up here.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((n, i) => {
              const I = ICON[n.kind] ?? Bell;
              return (
                <motion.li key={n.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}>
                  <button onClick={() => open(n)} className={cn('flex w-full items-start gap-3 rounded-3xl p-3 text-left transition-colors active:bg-white/10', n.read_at ? 'hover:bg-white/[0.04]' : 'bg-white/[0.07]')}>
                    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', n.kind === 'missed_call' ? 'bg-aurora-coral/15 text-aurora-coral' : n.kind === 'streak' ? 'bg-aurora-gold/15 text-aurora-gold' : 'bg-aurora-violet/15 text-aurora-iris')}><I className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', n.read_at ? 'text-ink-soft' : 'font-semibold text-white')}>{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-ink-mute">{n.body}</span>}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[11px] text-ink-faint">{shortTime(n.created_at)}</span>
                      {!n.read_at && <span className="h-2 w-2 rounded-full bg-aurora-mint" />}
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
