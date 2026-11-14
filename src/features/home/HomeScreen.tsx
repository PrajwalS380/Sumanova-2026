import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Bell, Camera, Clapperboard, Eye, EyeOff, Flame, Images, Map as MapIcon, Menu, MessageCircle, Pencil, Search, Sparkles, Users, Check } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useDrawer } from '@/components/Drawer';
import { useAuth } from '@/providers/AuthProvider';
import { useInbox } from '@/providers/InboxProvider';
import { useNotificationsOptional } from '@/providers/NotificationsProvider';
import { memoriesApi, spotlightApi, storiesApi, streaksApi, type Memory, type SpotlightVideo, type StoryRing, type StreakInfo } from '@/lib/social/api';
import { mapApi, type FriendLocation } from '@/features/map/api';
import { privateUrl, publicUrl } from '@/lib/storageUrl';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';

/**
 * Home dashboard ("Widgets" structure): a grid of live widgets the user can
 * reorder and hide. Each widget opens its full section.
 */
type WidgetId = 'snaps' | 'capture' | 'streaks' | 'online' | 'stories' | 'memory' | 'map' | 'spotlight' | 'chats';
const ALL: { id: WidgetId; label: string; wide: boolean }[] = [
  { id: 'snaps', label: 'Snaps waiting', wide: true },
  { id: 'capture', label: 'Quick capture', wide: false },
  { id: 'streaks', label: 'Streaks', wide: false },
  { id: 'online', label: 'Online now', wide: true },
  { id: 'stories', label: 'Stories', wide: true },
  { id: 'memory', label: 'Memory of the day', wide: false },
  { id: 'map', label: 'Map', wide: false },
  { id: 'chats', label: 'Unread chats', wide: false },
  { id: 'spotlight', label: 'Spotlight pick', wide: true },
];
const KEY = 'snv-home-layout-v1';
type Layout = { order: WidgetId[]; hidden: WidgetId[] };

function loadLayout(): Layout {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Layout | null;
    if (raw && Array.isArray(raw.order)) {
      const known = ALL.map((w) => w.id);
      const order = raw.order.filter((id) => known.includes(id));
      for (const id of known) if (!order.includes(id)) order.push(id);
      return { order, hidden: (raw.hidden ?? []).filter((id) => known.includes(id)) };
    }
  } catch {
    /* storage unavailable */
  }
  return { order: ALL.map((w) => w.id), hidden: [] };
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const drawer = useDrawer();
  const activity = useNotificationsOptional()?.unread ?? 0;
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(layout));
    } catch {
      /* ignore */
    }
  }, [layout]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);
  const visible = layout.order.filter((id) => !layout.hidden.includes(id));
  const move = (id: WidgetId, d: -1 | 1) =>
    setLayout((l) => {
      const order = [...l.order];
      const i = order.indexOf(id), j = i + d;
      if (j < 0 || j >= order.length) return l;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...l, order };
    });
  const toggle = (id: WidgetId) => setLayout((l) => ({ ...l, hidden: l.hidden.includes(id) ? l.hidden.filter((x) => x !== id) : [...l.hidden, id] }));

  return (
    <div className="px-4 pb-16 pt-safe">
      <div className="flex items-center gap-2 pt-1">
        <button onClick={drawer.open} aria-label="Open menu" className="glass grid h-10 w-10 place-items-center rounded-2xl"><Menu className="h-5 w-5" /></button>
        <Link to="/friends" className="glass flex h-10 flex-1 items-center gap-2 rounded-2xl px-3 text-sm text-ink-mute"><Search className="h-4 w-4" /> Search friends</Link>
        <Link to="/notifications" aria-label={`Activity${activity ? `, ${activity} new` : ''}`} className="glass relative grid h-10 w-10 place-items-center rounded-2xl">
          <Bell className="h-5 w-5" />
          {activity > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ember-rose px-1 text-[10px] font-bold text-white">{activity > 9 ? '9+' : activity}</span>}
        </Link>
        <Link to="/profile" aria-label="Your profile"><Avatar name={profile?.display_name ?? 'Me'} url={profile?.avatar_url} aura={profile?.aura_color} size={40} ring={false} /></Link>
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className="eyebrow text-ember-flame">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="font-display text-[40px] leading-[1.05]">
            {greeting},<br />
            <span className="italic text-ember">{profile?.display_name.split(' ')[0] ?? 'friend'}</span>
          </h1>
        </div>
        <button onClick={() => { haptic(6); setEditing((v) => !v); }} className={cn('flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold', editing ? 'bg-ember-cream text-noir' : 'glass text-ink-soft')}>
          {editing ? <><Check className="h-4 w-4" /> Done</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
        </button>
      </div>

      <motion.div layout className="mt-5 grid grid-cols-2 gap-3">
        {visible.map((id) => {
          const w = ALL.find((x) => x.id === id)!;
          return (
            <motion.div layout key={id} className={cn('relative', w.wide && 'col-span-2', editing && 'animate-none')} transition={{ type: 'spring', stiffness: 400, damping: 36 }}>
              <div className={cn(editing && 'pointer-events-none opacity-80')}>
                <WidgetBody id={id} />
              </div>
              {editing && (
                <div className="absolute right-2 top-2 flex gap-1">
                  <IconBtn label={`Move ${w.label} up`} onClick={() => move(id, -1)}><ArrowUp className="h-4 w-4" /></IconBtn>
                  <IconBtn label={`Move ${w.label} down`} onClick={() => move(id, 1)}><ArrowDown className="h-4 w-4" /></IconBtn>
                  <IconBtn label={`Hide ${w.label}`} onClick={() => toggle(id)}><EyeOff className="h-4 w-4" /></IconBtn>
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {editing && layout.hidden.length > 0 && (
        <div className="glass mt-5 rounded-3xl p-4">
          <p className="eyebrow mb-3">Add widgets</p>
          <div className="flex flex-wrap gap-2">
            {layout.hidden.map((id) => (
              <button key={id} onClick={() => toggle(id)} className="flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-2 text-sm font-semibold">
                <Eye className="h-4 w-4 text-ember-flame" /> {ALL.find((w) => w.id === id)!.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-label={label} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-full bg-white text-ink shadow-card ring-1 ring-ink/10">
      {children}
    </button>
  );
}

function Card({ to, title, icon, children, className, tone, wide }: { to: string; title: string; icon: ReactNode; children: ReactNode; className?: string; tone?: 'brand'; wide?: boolean }) {
  return (
    <Link to={to} className={cn('flex h-full flex-col rounded-[26px] p-4', wide ? 'min-h-0' : 'min-h-[132px]', ' transition-transform active:scale-[0.98]', tone === 'brand' ? 'bg-ember-gradient text-white shadow-glow' : 'glass', className)}>
      <span className={cn('flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em]', tone === 'brand' ? 'text-white/85' : 'text-ink-mute')}>
        {icon} {title}
      </span>
      <div className="mt-2 flex flex-1 flex-col">{children}</div>
    </Link>
  );
}

function WidgetBody({ id }: { id: WidgetId }) {
  switch (id) {
    case 'snaps':
      return <SnapsWidget />;
    case 'capture':
      return (
        <Card to="/camera" title="Capture" icon={<Camera className="h-3.5 w-3.5" />} tone="brand">
          <span className="mt-auto font-display text-[28px] leading-none">Snap it</span>
          <span className="text-xs text-white/80">Photo, video or lens</span>
        </Card>
      );
    case 'streaks':
      return <StreaksWidget />;
    case 'online':
      return <OnlineWidget />;
    case 'stories':
      return <StoriesWidget />;
    case 'memory':
      return <MemoryWidget />;
    case 'map':
      return <MapWidget />;
    case 'chats':
      return <ChatsWidget />;
    case 'spotlight':
      return <SpotlightWidget />;
    default:
      return null;
  }
}

function SnapsWidget() {
  const { conversations } = useInbox();
  const waiting = conversations.filter((c) => c.unread_count > 0 && c.last_kind === 'snap');
  return (
    <Card to={waiting[0] ? `/chat/${waiting[0].id}` : '/chat'} wide title="Snaps waiting" icon={<Sparkles className="h-3.5 w-3.5" />}>
      {waiting.length ? (
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3">
            {waiting.slice(0, 5).map((c) => (
              <span key={c.id} className="rounded-full p-[2px] ring-ember"><Avatar name={c.other_display_name ?? c.title ?? '?'} url={c.other_avatar_url ?? c.avatar_url} aura={c.other_aura ?? 'violet'} size={46} ring={false} /></span>
            ))}
          </div>
          <span className="font-display text-[30px] leading-none">{waiting.length}</span>
          <span className="text-sm text-ink-mute">new {waiting.length === 1 ? 'snap' : 'snaps'}</span>
        </div>
      ) : (
        <p className="text-sm text-ink-mute">You're all caught up. Send someone a snap ✦</p>
      )}
    </Card>
  );
}

function StreaksWidget() {
  const [s, setS] = useState<StreakInfo[] | null>(null);
  useEffect(() => void streaksApi.mine().then(setS).catch(() => setS([])), []);
  const best = s?.slice().sort((a, b) => b.count - a.count)[0];
  const expiring = s?.filter((x) => x.expiring).length ?? 0;
  return (
    <Card to="/chat" title="Streaks" icon={<Flame className="h-3.5 w-3.5" />}>
      <span className="mt-auto font-display text-[40px] leading-none">{best?.count ?? 0}</span>
      <span className="text-xs text-ink-mute">{s === null ? 'Loading…' : best ? `best of ${s.length} streak${s.length === 1 ? '' : 's'}` : 'Start one today'}</span>
      {expiring > 0 && <span className="mt-1 text-xs font-bold text-ember-rose">{expiring} ending soon</span>}
    </Card>
  );
}

function OnlineWidget() {
  const { conversations, online } = useInbox();
  const people = conversations.filter((c) => c.kind === 'direct' && c.other_user_id && online.has(c.other_user_id));
  return (
    <Card to="/chat" wide title={`Online now · ${people.length}`} icon={<Users className="h-3.5 w-3.5" />}>
      {people.length ? (
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1">
          {people.slice(0, 8).map((c) => (
            <span key={c.id} className="flex w-14 shrink-0 flex-col items-center gap-1">
              <span className="relative"><Avatar name={c.other_display_name ?? '?'} url={c.other_avatar_url} aura={c.other_aura ?? 'violet'} size={46} /><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-ember-sage ring-2 ring-white" /></span>
              <span className="w-full truncate text-center text-[11px] font-semibold">{(c.other_display_name ?? '').split(' ')[0]}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-mute">Nobody's online right now.</p>
      )}
    </Card>
  );
}

function StoriesWidget() {
  const [rings, setRings] = useState<StoryRing[] | null>(null);
  useEffect(() => void storiesApi.feed().then(setRings).catch(() => setRings([])), []);
  const fresh = (rings ?? []).filter((r) => !r.is_me && r.unseen);
  return (
    <Card to="/stories" wide title={`Stories · ${fresh.length} new`} icon={<Sparkles className="h-3.5 w-3.5" />}>
      {fresh.length ? (
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1">
          {fresh.slice(0, 8).map((r) => (
            <span key={r.user_id} className="flex w-14 shrink-0 flex-col items-center gap-1">
              <span className="rounded-full p-[2.5px] ring-ember"><Avatar name={r.display_name} url={r.avatar_url} aura={r.aura_color} size={46} ring={false} /></span>
              <span className="w-full truncate text-center text-[11px] font-semibold">{r.display_name.split(' ')[0]}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-mute">{rings === null ? 'Loading…' : 'No new stories. Share yours?'}</p>
      )}
    </Card>
  );
}

function MemoryWidget() {
  const [m, setM] = useState<Memory | null | undefined>(undefined);
  const [url, setUrl] = useState('');
  useEffect(() => {
    void memoriesApi
      .list({})
      .then((list) => {
        const now = new Date();
        const same = list.find((x) => {
          const d = new Date(x.taken_at);
          return d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && d.getFullYear() < now.getFullYear();
        });
        setM(same ?? list.find((x) => x.kind === 'image') ?? null);
      })
      .catch(() => setM(null));
  }, []);
  useEffect(() => {
    if (m && m.kind === 'image') void privateUrl('memories', m.media_path).then(setUrl).catch(() => undefined);
  }, [m]);
  const onThisDay = m && new Date(m.taken_at).getFullYear() < new Date().getFullYear();
  return (
    <Link to="/memories" className="relative flex min-h-[132px] flex-col overflow-hidden rounded-[26px] glass p-4 active:scale-[0.98]">
      {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {url && <span className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />}
      <span className={cn('relative flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em]', url ? 'text-white' : 'text-ink-mute')}><Images className="h-3.5 w-3.5" /> Memory</span>
      <span className={cn('relative mt-auto text-sm font-semibold', url ? 'text-white' : 'text-ink-mute')}>
        {m === undefined ? 'Loading…' : m === null ? 'Save snaps to see them here' : onThisDay ? `On this day · ${new Date(m.taken_at).getFullYear()}` : new Date(m.taken_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
      </span>
    </Link>
  );
}

function MapWidget() {
  const [f, setF] = useState<FriendLocation[] | null>(null);
  useEffect(() => void mapApi.friends().then(setF).catch(() => setF([])), []);
  return (
    <Card to="/map" title="Map" icon={<MapIcon className="h-3.5 w-3.5" />} className="bg-[radial-gradient(120%_90%_at_80%_10%,#C8F2E6,transparent_60%),radial-gradient(100%_80%_at_0%_100%,#C9D8FF,transparent_60%)]">
      <span className="mt-auto font-display text-[32px] leading-none">{f?.length ?? 0}</span>
      <span className="text-xs text-ink-mute">{f === null ? 'Loading…' : f.length === 1 ? 'friend sharing' : 'friends sharing'}</span>
    </Card>
  );
}

function ChatsWidget() {
  const { unreadTotal, conversations } = useInbox();
  const chats = conversations.filter((c) => c.unread_count > 0).length;
  return (
    <Card to="/chat" title="Chats" icon={<MessageCircle className="h-3.5 w-3.5" />}>
      <span className="mt-auto font-display text-[40px] leading-none">{unreadTotal}</span>
      <span className="text-xs text-ink-mute">{unreadTotal ? `unread in ${chats} chat${chats === 1 ? '' : 's'}` : 'No unread messages'}</span>
    </Card>
  );
}

function SpotlightWidget() {
  const [v, setV] = useState<SpotlightVideo | null | undefined>(undefined);
  useEffect(() => void spotlightApi.feed({}).then((l) => setV(l[0] ?? null)).catch(() => setV(null)), []);
  return (
    <Link to="/spotlight" className="glass flex items-center gap-4 rounded-[26px] p-3 active:scale-[0.98]">
      <span className="relative h-24 w-[72px] shrink-0 overflow-hidden rounded-2xl bg-pearl-lilac">
        {v?.poster_path && <img src={publicUrl('spotlight', v.poster_path)} alt="" className="h-full w-full object-cover" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-mute"><Clapperboard className="h-3.5 w-3.5" /> Spotlight pick</span>
        <span className="mt-1 block truncate font-display text-[22px] leading-tight">{v ? v.caption || `@${v.username}` : v === null ? 'Nothing trending yet' : 'Loading…'}</span>
        {v && <span className="block text-xs text-ink-mute">@{v.username} · {v.view_count} views</span>}
      </span>
    </Link>
  );
}
