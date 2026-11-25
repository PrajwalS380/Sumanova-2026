import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, ChevronLeft, Loader2, MessageCircle, Settings } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { chatApi } from '@/lib/chat/api';
import { friendBirthdays, type FriendBirthday } from '@/lib/birthdays';
import { formatDayMonth, matchScore, monthDay, signFor, SIGNS } from '@/lib/zodiac';
import { cn } from '@/lib/cn';

type Tab = 'birthdays' | 'zodiac';

const when = (d: number) => (d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`);

/** Celebrations (wireframe 9c): friends' birthdays (day + month only) and zodiac signs. */
export default function BirthdaysScreen() {
  const { settings } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'zodiac' ? 'zodiac' : 'birthdays';
  const [list, setList] = useState<FriendBirthday[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const mine = monthDay(settings?.date_of_birth);
  const mySign = mine ? signFor(mine.month, mine.day) : null;
  const [pickSign, setPickSign] = useState<string | null>(null);

  useEffect(() => {
    void friendBirthdays().then(setList).catch((e: Error) => {
      setList([]);
      toast(e.message, 'error');
    });
  }, [toast]);

  const today = useMemo(() => (list ?? []).filter((b) => b.inDays === 0), [list]);
  const upcoming = useMemo(() => (list ?? []).filter((b) => b.inDays > 0 && b.inDays <= 60), [list]);
  const recent = useMemo(() => (list ?? []).filter((b) => b.inDays >= 335).sort((a, b) => b.inDays - a.inDays), [list]);
  const later = useMemo(() => (list ?? []).filter((b) => b.inDays > 60 && b.inDays < 335), [list]);

  async function wish(b: FriendBirthday) {
    setOpening(b.user_id);
    try {
      navigate(`/chat/${await chatApi.getOrCreateDirect(b.user_id)}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setOpening(null);
    }
  }

  const bySign = useMemo(() => {
    const m: Record<string, FriendBirthday[]> = {};
    for (const b of list ?? []) (m[b.sign.id] ??= []).push(b);
    return m;
  }, [list]);
  const selected = SIGNS.find((s) => s.id === (pickSign ?? mySign?.id)) ?? null;

  return (
    <div className="min-h-full bg-noir pb-12">
      <header className="flex items-center gap-2 px-3.5 pb-2 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-2xl bg-white active:scale-90"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-center text-lg font-extrabold">Celebrations</h1>
        <Link to="/settings" aria-label="Birthday settings" className="grid h-10 w-10 place-items-center rounded-2xl bg-white"><Settings className="h-5 w-5" /></Link>
      </header>
      <div className="mx-auto max-w-md px-3.5">
        <div role="tablist" className="flex gap-1 rounded-2xl bg-white p-1">
          {(['birthdays', 'zodiac'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setParams(t === 'zodiac' ? { tab: t } : {}, { replace: true })} className={cn('h-9 flex-1 rounded-xl text-sm font-extrabold', tab === t ? 'bg-[#111111] text-white' : 'text-ink-mute')}>
              {t === 'birthdays' ? 'Birthdays' : 'Zodiac signs'}
            </button>
          ))}
        </div>

        {list === null ? (
          <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div>
        ) : tab === 'birthdays' ? (
          <>
            {!mine && (
              <Link to="/settings" className="mt-3 block rounded-tile bg-white p-3.5 text-sm font-semibold">🎂 Add your birthday in Settings so friends can celebrate you (they only ever see day and month).</Link>
            )}
            {today.map((b) => (
              <div key={b.user_id} className={cn('mt-3 rounded-tile bg-ember-rose p-4 text-white', GHOST_HOST)}>
                <Ghost url={b.avatar_url} size={180} opacity={0.3} className="-bottom-10 -right-8 top-auto" />
                <span className="eyebrow text-white/85">Today 🎂</span>
                <div className="mt-1 flex items-center gap-3">
                  <Avatar name={b.display_name} url={b.avatar_url} aura={b.aura_color} size={58} />
                  <span className="font-display text-[26px] leading-none">{b.display_name}’s birthday</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link to="/" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-extrabold text-ink"><Camera className="h-4 w-4" />Send a snap</Link>
                  <button onClick={() => void wish(b)} disabled={opening === b.user_id} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111111] px-3.5 py-2 text-sm font-extrabold text-white">
                    {opening === b.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}Wish in chat
                  </button>
                </div>
              </div>
            ))}
            <List title="Coming up" items={upcoming} empty={list.length === 0 ? 'When friends add their birthday, it shows up here.' : 'No birthdays in the next two months.'} onWish={wish} opening={opening} />
            {recent.length > 0 && <List title="Recent celebrations" items={recent} recent onWish={wish} opening={opening} />}
            {later.length > 0 && <List title="Later this year" items={later} onWish={wish} opening={opening} />}
          </>
        ) : (
          <>
            {mySign ? (
              <div className={cn('mt-3 rounded-tile bg-[#111111] p-4 text-white', GHOST_HOST)}>
                <Ghost size={200} opacity={0.14} className="-right-6 -top-10"><span className="text-[170px] font-black leading-none">{mySign.glyph}</span></Ghost>
                <span className="eyebrow text-white/70">Your sign</span>
                <div className="mt-1 font-display text-[34px] leading-none">{mySign.glyph} {mySign.name}</div>
                <p className="mt-1 text-sm font-semibold text-white/75">{formatDayMonth(...mySign.from)} – {formatDayMonth(...mySign.to)} · {mySign.element}</p>
              </div>
            ) : (
              <Link to="/settings" className="mt-3 block rounded-tile bg-white p-3.5 text-sm font-semibold">Add your birthday in Settings to see your sign and matches.</Link>
            )}
            <h2 className="eyebrow mt-4 px-1">Friends by sign</h2>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {SIGNS.map((s) => {
                const n = bySign[s.id]?.length ?? 0;
                return (
                  <button key={s.id} onClick={() => setPickSign(s.id)} aria-pressed={selected?.id === s.id} className={cn('flex flex-col items-center gap-0.5 rounded-2xl bg-white px-1 py-2.5', GHOST_HOST, selected?.id === s.id && 'ring-[3px] ring-ink')}>
                    <Ghost size={70} opacity={0.08} className="-right-3 -top-3"><span className="text-[60px] font-black leading-none">{s.glyph}</span></Ghost>
                    <span className="text-[22px] leading-none">{s.glyph}</span>
                    <span className="text-[11px] font-extrabold">{s.name}</span>
                    <span className="text-[10px] font-bold text-ink-mute">{n ? `${n} friend${n > 1 ? 's' : ''}` : '—'}</span>
                  </button>
                );
              })}
            </div>
            {selected && (
              <div className="mt-3 overflow-hidden rounded-tile bg-white px-3 py-1">
                {(bySign[selected.id] ?? []).length === 0 ? (
                  <p className="px-1 py-3 text-sm text-ink-mute">No friends with {selected.name} yet.</p>
                ) : (
                  bySign[selected.id].map((b) => {
                    const m = mySign ? matchScore(mySign, b.sign) : null;
                    return (
                      <Link key={b.user_id} to={`/u/${b.username}`} className={cn('flex items-center gap-3 py-2.5', GHOST_HOST)}>
                        <Ghost url={b.avatar_url} />
                        <Avatar name={b.display_name} url={b.avatar_url} aura={b.aura_color} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-extrabold">{b.display_name}</span>
                          <span className="block text-xs font-semibold text-ink-mute">{b.sign.glyph} {b.sign.name}{m ? ` · ${m.line}` : ''}</span>
                        </span>
                        {m && <span className="rounded-xl bg-ember-rose/15 px-2 py-1 text-xs font-extrabold text-[#C0186A]">{m.score}%</span>}
                      </Link>
                    );
                  })
                )}
              </div>
            )}
            <p className="mt-3 px-1 text-xs font-semibold text-ink-mute">Match scores are just for fun.</p>
          </>
        )}
      </div>
    </div>
  );
}

function List({ title, items, empty, recent, onWish, opening }: { title: string; items: FriendBirthday[]; empty?: string; recent?: boolean; onWish: (b: FriendBirthday) => void; opening: string | null }) {
  return (
    <>
      <h2 className="eyebrow mt-4 px-1">{title}</h2>
      <div className="mt-2 overflow-hidden rounded-tile bg-white px-3 py-1">
        {items.length === 0 ? (
          <p className="px-1 py-3 text-sm text-ink-mute">{empty}</p>
        ) : (
          items.map((b) => (
            <div key={b.user_id} className={cn('flex items-center gap-3 py-2.5', GHOST_HOST)}>
              <Ghost url={b.avatar_url} />
              <Link to={`/u/${b.username}`}><Avatar name={b.display_name} url={b.avatar_url} aura={b.aura_color} size={46} /></Link>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold">{b.display_name}</span>
                <span className="block text-xs font-semibold text-ink-mute">{formatDayMonth(b.month, b.day)} · {b.sign.glyph} {b.sign.name}</span>
              </span>
              <span className={cn('rounded-xl px-2 py-1 text-[11px] font-extrabold', recent ? 'bg-ink/[0.06] text-ink-mute' : 'bg-ember-gold/25 text-[#8A5A00]')}>{recent ? `${365 - b.inDays}d ago` : when(b.inDays)}</span>
              <button onClick={() => onWish(b)} disabled={opening === b.user_id} aria-label={`Message ${b.display_name}`} className="grid h-9 w-9 place-items-center rounded-xl bg-ink/[0.06]">
                {opening === b.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
