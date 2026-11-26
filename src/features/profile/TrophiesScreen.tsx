import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TROPHIES, trophyProgress, type TrophyStats } from '@/lib/trophies';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
import { cn } from '@/lib/cn';

/** Trophy case + snap score. */
export default function TrophiesScreen() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<TrophyStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void supabase.rpc('my_trophy_stats').then(({ data, error: e }) => {
      if (e) return setError(e.message);
      // a brand-new account has no activity yet: show every trophy at zero instead of spinning
      const zero: TrophyStats = { snaps_sent: 0, snaps_received: 0, stories: 0, best_streak: 0, friends: 0, spotlight_videos: 0, spotlight_likes: 0, explored: 0, groups: 0, calls: 0, memories: 0, score: 0 };
      setStats({ ...zero, ...((data as TrophyStats[] | null)?.[0] ?? {}) });
    });
  }, []);
  const list = stats ? TROPHIES.map((t) => ({ t, p: trophyProgress(t, stats) })).sort((a, b) => Number(b.p.earned) - Number(a.p.earned) || b.p.pct - a.p.pct) : [];
  const earned = list.filter((x) => x.p.earned).length;
  return (
    <div className="min-h-full bg-noir pb-16">
      <header className="flex items-center gap-2 px-3.5 pb-3 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-2xl bg-white active:scale-90"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-center text-lg font-extrabold">Trophies</h1>
        <span className="w-10" aria-hidden />
      </header>
      <div className="mx-auto max-w-md px-4">
        {!stats ? (
          <div className="grid h-40 place-items-center">{error ? <p className="text-sm text-ink-mute">{error}</p> : <Loader2 className="h-6 w-6 animate-spin text-ink-mute" />}</div>
        ) : (
          <>
            <div className={cn('rounded-tile bg-[#111111] p-4 text-white', GHOST_HOST)}>
              <Ghost size={140} opacity={0.14} className="-right-6 -top-8"><NovaEmoji id="nova" size={140} /></Ghost>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/60">Snap score</p>
              <p className="font-display text-5xl">{stats.score.toLocaleString()}</p>
              <p className="mt-1 text-xs text-white/70">{stats.snaps_sent.toLocaleString()} sent · {stats.snaps_received.toLocaleString()} received · {stats.stories} stories</p>
              <p className="mt-3 text-sm font-extrabold">{earned} of {TROPHIES.length} trophies</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {list.map(({ t, p }) => (
                <div key={t.id} className={cn('rounded-tile bg-white p-3.5', !p.earned && 'opacity-80')}>
                  <span className={cn('inline-block', !p.earned && 'grayscale')}><NovaEmoji id={t.icon} size={44} /></span>
                  <p className="mt-2 text-[15px] font-black leading-tight">{t.name}</p>
                  <p className="text-xs text-ink-mute">{t.how}</p>
                  {p.earned ? (
                    <p className="mt-2 text-xs font-extrabold text-ember-sage">Earned</p>
                  ) : (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-ink" style={{ width: `${p.pct * 100}%` }} /></div>
                      <p className="mt-1 text-[11px] font-bold text-ink-mute">{p.value.toLocaleString()} / {t.goal.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
