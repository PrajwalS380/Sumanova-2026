import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AtSign, Bell, Camera, Check, ChevronLeft, Flame, Heart, MessageCircle, Phone, UserPlus, Users } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useNotifications, type AppNotification } from '@/providers/NotificationsProvider';
import { supabase } from '@/lib/supabase';
import { shortTime } from '@/lib/chat/time';
import type { PublicProfile } from '@/lib/chat/types';
import { cn } from '@/lib/cn';

/** Badge icon + colour per kind (wireframe 10). */
const BADGE: Record<string, { icon: typeof Bell; bg: string }> = {
  snap: { icon: Camera, bg: 'bg-ember-flame' },
  friend_request: { icon: UserPlus, bg: 'bg-ember-jade' },
  friend_accepted: { icon: Users, bg: 'bg-ember-jade' },
  follow: { icon: UserPlus, bg: 'bg-ember-jade' },
  streak: { icon: Flame, bg: 'bg-[#f97316]' },
  missed_call: { icon: Phone, bg: 'bg-ember-rose' },
  story_reaction: { icon: Heart, bg: 'bg-ember-plum' },
  story_reply: { icon: MessageCircle, bg: 'bg-ember-flame' },
  comment: { icon: MessageCircle, bg: 'bg-ember-flame' },
  mention: { icon: AtSign, bg: 'bg-ember-flame' },
};

export default function NotificationsScreen() {
  const { items, unread, markAllRead, open } = useNotifications();
  const navigate = useNavigate();
  const [people, setPeople] = useState<Record<string, PublicProfile>>({});

  const actorIds = useMemo(() => [...new Set(items.map((n) => n.actor_id).filter((x): x is string => !!x))], [items]);
  useEffect(() => {
    const missing = actorIds.filter((id) => !people[id]);
    if (!missing.length) return;
    void supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,aura_color')
      .in('id', missing)
      .then(({ data }) => data && setPeople((p) => ({ ...p, ...Object.fromEntries((data as PublicProfile[]).map((x) => [x.id, x])) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorIds]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = items.filter((n) => new Date(n.created_at) >= startOfToday);
  const earlier = items.filter((n) => new Date(n.created_at) < startOfToday);

  return (
    <div className="min-h-full bg-white pb-16">
      <header className="flex items-center gap-2 px-3.5 pb-1 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Back" className={CIRCLE}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-center text-lg font-extrabold">Notifications</h1>
        <button onClick={() => void markAllRead()} disabled={!unread} aria-label="Mark all as read" className={cn(CIRCLE, 'disabled:opacity-40')}><Check className="h-5 w-5" /></button>
      </header>

      {items.length === 0 ? (
        <div className="mx-4 mt-6 rounded-3xl bg-[#f4f6fd] p-8 text-center">
          <Bell className="mx-auto h-8 w-8 text-ink-mute" />
          <p className="mt-3 font-display text-lg">All caught up</p>
          <p className="mt-1 text-sm text-ink-mute">Friend requests, missed calls, snaps, mentions and streak reminders show up here.</p>
        </div>
      ) : (
        <>
          {today.length > 0 && <Group title="Today" list={today} people={people} onOpen={open} />}
          {earlier.length > 0 && <Group title="Earlier" list={earlier} people={people} onOpen={open} />}
        </>
      )}
    </div>
  );
}

function Group({ title, list, people, onOpen }: { title: string; list: AppNotification[]; people: Record<string, PublicProfile>; onOpen: (n: AppNotification) => void }) {
  return (
    <section>
      <h2 className="px-4 pb-1 pt-3.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-mute">{title}</h2>
      <ul>
        {list.map((n, i) => {
          const who = n.actor_id ? people[n.actor_id] : undefined;
          const b = BADGE[n.kind] ?? { icon: Bell, bg: 'bg-ink-mute' };
          const I = b.icon;
          // Titles usually start with the person's name; bold it like the wireframe.
          const name = who?.display_name;
          const rest = name && n.title.startsWith(name) ? n.title.slice(name.length) : null;
          return (
            <motion.li key={n.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}>
              <button onClick={() => onOpen(n)} className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-ink/[0.05]', !n.read_at && 'bg-[#f4f6ff]')}>
                <span className="relative shrink-0">
                  {who ? <Avatar name={who.display_name} url={who.avatar_url} aura={who.aura_color} size={48} /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-[#eef1fa]"><Bell className="h-5 w-5 text-ink-mute" /></span>}
                  <span className={cn('absolute -bottom-[3px] -right-[3px] grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-white text-white', b.bg)}><I className="h-3 w-3" strokeWidth={2.6} /></span>
                </span>
                <span className="min-w-0 flex-1 text-sm leading-[1.35]">
                  {rest !== null ? (<><b>{name}</b>{rest}</>) : n.title}
                  {n.body && <span className="block truncate text-ink-soft">{n.body}</span>}
                  <span className="mt-0.5 block text-xs text-ink-mute">{shortTime(n.created_at)}</span>
                </span>
                {!n.read_at && <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-ember-flame" aria-label="Unread" />}
              </button>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}

const CIRCLE = 'grid h-10 w-10 place-items-center rounded-full bg-[#eef1fa] text-ink active:scale-90';
