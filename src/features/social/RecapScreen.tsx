import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, Loader2, X } from 'lucide-react';
import { recapApi, type Recap } from '@/lib/social/fun';
import { Avatar } from '@/components/Avatar';
import { LogoMark } from '@/components/Logo';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BG = ['#FF4F9A', '#111111', '#3D7BFF', '#12A577', '#8C6BFF', '#E0700B', '#111111'];

/** /recap — your year on SUMANOVA, as tap-through cards (your own numbers only). */
export default function RecapScreen() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  const [r, setR] = useState<Recap | null | undefined>(undefined);
  const [i, setI] = useState(0);
  useEffect(() => void recapApi.get(year).then(setR).catch(() => setR(null)), [year]);

  if (r === undefined) return <div className="grid h-full place-items-center bg-[#111111]"><Loader2 className="h-7 w-7 animate-spin text-white/60" /></div>;
  if (!r) return <div className="grid h-full place-items-center bg-noir p-8 text-center text-sm text-ink-mute">Couldn’t load your recap — check your connection.</div>;

  const cards: { big: string; small: string; extra?: JSX.Element }[] = [
    { big: `${year}`, small: 'Your year on SUMANOVA. Tap to see it.' },
    { big: r.messages.toLocaleString(), small: 'messages you sent' },
    { big: r.snaps.toLocaleString(), small: `snaps sent · ${r.stories.toLocaleString()} stories posted` },
    { big: r.memories.toLocaleString(), small: 'moments saved to Memories' },
    { big: `${r.best_streak}🔥`, small: `your best streak · ${r.new_friends} new friend${r.new_friends === 1 ? '' : 's'} this year` },
    {
      big: r.top_friends.length ? 'Your people' : 'Your people',
      small: r.top_friends.length ? 'who you talked to most' : 'Chat with friends and they’ll show up here',
      extra: (
        <div className="mt-6 space-y-3">
          {r.top_friends.map((f, k) => (
            <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left">
              <span className="font-display text-2xl">{k + 1}</span>
              <Avatar name={f.display_name} url={f.avatar_url} size={44} ring={false} />
              <span className="flex-1 truncate text-lg font-extrabold">{f.display_name}</span>
              <span className="text-sm text-white/70">{f.n.toLocaleString()}</span>
            </div>
          ))}
        </div>
      ),
    },
    { big: r.busiest_month ? MONTHS[r.busiest_month - 1] : '—', small: 'was your chattiest month. See you next year ✦' },
  ];
  const c = cards[i];
  return (
    <div className="fixed inset-0 z-50 flex flex-col text-white" style={{ background: BG[i % BG.length], transition: 'background .4s' }}>
      <div className="flex gap-1 px-3 pt-[calc(var(--safe-top)+10px)]">
        {cards.map((_, k) => <span key={k} className={k <= i ? 'h-1 flex-1 rounded-full bg-white' : 'h-1 flex-1 rounded-full bg-white/30'} />)}
      </div>
      <div className="flex items-center justify-between px-3 pt-3">
        <LogoMark size={34} />
        <button onClick={() => navigate(-1)} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15"><X className="h-5 w-5" /></button>
      </div>
      <div className="relative flex-1">
        <button className="absolute inset-y-0 left-0 z-10 w-1/3" aria-label="Previous" onClick={() => setI((k) => Math.max(0, k - 1))} />
        <button className="absolute inset-y-0 right-0 z-10 w-2/3" aria-label="Next" onClick={() => (i < cards.length - 1 ? setI(i + 1) : navigate(-1))} />
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} className="flex h-full flex-col justify-center px-8 text-center">
            <p className="font-display text-[clamp(3rem,16vw,6rem)] leading-none">{c.big}</p>
            <p className="mt-4 text-lg font-bold text-white/85">{c.small}</p>
            {c.extra}
          </motion.div>
        </AnimatePresence>
      </div>
      {i > 0 && <button onClick={() => setI(i - 1)} aria-label="Back" className="absolute bottom-[calc(var(--safe-bottom)+20px)] left-4 z-20 grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><ChevronLeft className="h-5 w-5" /></button>}
    </div>
  );
}
