import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { Link } from 'react-router-dom';
import { Loader2, MessageCircleQuestion, Trophy } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { Avatar } from '@/components/Avatar';
import { dailyApi, questionOfToday, type DailyAnswer } from '@/lib/social/fun';

/** Question of the day: answer to see what your friends said. Plus a shortcut to friend quizzes. */
export function DailyQuestionCard() {
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const toast = useToast();
  const q = questionOfToday();
  const tr = useT();
  const [mine, setMine] = useState<string | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [feed, setFeed] = useState<DailyAnswer[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    void dailyApi.mine(me).then((a) => {
      setMine(a);
      if (a) void dailyApi.feed().then(setFeed).catch(() => undefined);
    }).catch(() => setMine(null));
  }, [me]);

  async function send() {
    const a = text.trim();
    if (!a) return;
    setBusy(true);
    try {
      await dailyApi.answer(q.index, a);
      setMine(a);
      setFeed(await dailyApi.feed());
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const others = feed.filter((f) => f.user_id !== me);
  return (
    <section className="mt-3 rounded-tile bg-[#111111] p-4 text-white">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/60"><MessageCircleQuestion className="h-3.5 w-3.5" /> {tr('Question of the day')}</p>
        <Link to="/quizzes" className="flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1 text-xs font-bold"><Trophy className="h-3.5 w-3.5" /> {tr('Quizzes')}</Link>
      </div>
      <p className="mt-2 font-display text-xl leading-tight">{q.text}</p>
      {mine === undefined ? (
        <Loader2 className="mt-3 h-5 w-5 animate-spin text-white/50" />
      ) : mine ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-2xl bg-white/10 px-3 py-2 text-sm"><span className="font-extrabold">You:</span> {mine}</p>
          {others.length ? (
            others.slice(0, 6).map((f) => (
              <p key={f.user_id} className="flex items-start gap-2 text-sm">
                <Avatar name={f.display_name} url={f.avatar_url} size={26} ring={false} />
                <span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-extrabold">{f.display_name.split(' ')[0]}:</span> {f.answer}</span>
              </p>
            ))
          ) : (
            <p className="text-xs text-white/60">No friends have answered yet — their answers show up here.</p>
          )}
        </div>
      ) : (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Answer to see your friends’" aria-label="Your answer" className="h-11 min-w-0 flex-1 rounded-2xl bg-white/10 px-3.5 text-[15px] font-semibold outline-none placeholder:text-white/40" />
          <button type="submit" disabled={!text.trim() || busy} className="h-11 rounded-2xl bg-white px-4 text-sm font-extrabold text-ink disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('Answer')}</button>
        </form>
      )}
    </section>
  );
}
