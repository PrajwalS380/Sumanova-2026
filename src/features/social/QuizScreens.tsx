import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Loader2, Plus, Trophy, X } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { Avatar } from '@/components/Avatar';
import { quizApi, type Quiz, type QuizQuestion, type QuizResult, type QuizRow } from '@/lib/social/fun';
import { cn } from '@/lib/cn';

const Back = ({ to = '/stories' }: { to?: string }) => {
  const navigate = useNavigate();
  return (
    <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(to))} aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl bg-white"><ChevronLeft className="h-5 w-5" /></button>
  );
};

/** /quizzes — friends' "how well do you know me" quizzes and mine. */
export function QuizzesScreen() {
  const { session } = useAuth();
  const me = session!.user.id;
  const [list, setList] = useState<Quiz[] | null>(null);
  useEffect(() => void quizApi.list().then(setList).catch(() => setList([])), []);
  const mine = list?.filter((q) => q.owner_id === me) ?? [];
  const theirs = list?.filter((q) => q.owner_id !== me) ?? [];
  return (
    <div className="min-h-full bg-noir px-4 pb-28 pt-safe">
      <div className="flex items-center gap-3 py-3"><Back /><h1 className="font-display text-2xl">Quizzes</h1></div>
      <Link to="/quiz/new" className="flex items-center gap-3 rounded-tile bg-[#111111] p-4 text-white">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Plus className="h-5 w-5" /></span>
        <span><span className="block font-extrabold">Make “How well do you know me?”</span><span className="block text-xs text-white/70">3–10 questions. Friends play, you see their scores.</span></span>
      </Link>
      {list === null ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div>
      ) : (
        <>
          <h2 className="mt-5 px-1 text-[17px] font-extrabold">From friends</h2>
          {theirs.length === 0 && <p className="px-1 py-3 text-sm text-ink-mute">No quizzes from friends yet.</p>}
          <ul className="mt-2 space-y-2">{theirs.map((q) => <QuizRowLink key={q.id} q={q} />)}</ul>
          {mine.length > 0 && <h2 className="mt-5 px-1 text-[17px] font-extrabold">Mine</h2>}
          <ul className="mt-2 space-y-2">{mine.map((q) => <QuizRowLink key={q.id} q={q} />)}</ul>
        </>
      )}
    </div>
  );
}
function QuizRowLink({ q }: { q: Quiz }) {
  return (
    <li>
      <Link to={`/quiz/${q.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3.5">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#FF4F9A]/15 text-[#E0408A]"><Trophy className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate font-extrabold">{q.title}</span><span className="block text-xs text-ink-mute">{q.questions.length} questions</span></span>
      </Link>
    </li>
  );
}

/** /quiz/new */
export function QuizNewScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [title, setTitle] = useState('How well do you know me?');
  const [qs, setQs] = useState<(QuizQuestion & { a: number })[]>([
    { q: 'My favourite food?', options: ['', ''], a: 0 },
    { q: 'Where would I travel first?', options: ['', ''], a: 0 },
    { q: 'My go-to weekend plan?', options: ['', ''], a: 0 },
  ]);
  const [busy, setBusy] = useState(false);
  const set = (i: number, p: Partial<QuizQuestion & { a: number }>) => setQs(qs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function save() {
    const clean = qs.map((x) => ({ q: x.q.trim(), options: x.options.map((o) => o.trim()), a: x.a }));
    if (clean.some((x) => !x.q || x.options.some((o) => !o))) return toast('Fill in every question and option', 'error');
    setBusy(true);
    try {
      const id = await quizApi.create(title.trim() || 'My quiz', clean.map(({ q, options }) => ({ q, options })), clean.map((x) => x.a));
      toast('Quiz is live for your friends', 'success');
      navigate(`/quiz/${id}`, { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-noir px-4 pb-32 pt-safe">
      <div className="flex items-center gap-3 py-3"><Back to="/quizzes" /><h1 className="font-display text-2xl">New quiz</h1></div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} aria-label="Quiz title" className="h-12 w-full rounded-2xl bg-white px-4 text-[16px] font-extrabold outline-none" />
      <p className="mt-2 px-1 text-xs text-ink-mute">Tap the circle next to the right answer. Only you can see which one it is.</p>
      <ol className="mt-3 space-y-3">
        {qs.map((x, i) => (
          <li key={i} className="rounded-tile bg-white p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-ink-mute">{i + 1}.</span>
              <input value={x.q} onChange={(e) => set(i, { q: e.target.value })} maxLength={120} placeholder="Question" aria-label={`Question ${i + 1}`} className="h-10 min-w-0 flex-1 rounded-xl bg-[#F1F1F4] px-3 text-[15px] font-bold outline-none" />
              {qs.length > 3 && <button onClick={() => setQs(qs.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`} className="grid h-9 w-9 place-items-center rounded-xl text-ink-mute"><X className="h-4 w-4" /></button>}
            </div>
            <div className="mt-2 space-y-1.5">
              {x.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <button onClick={() => set(i, { a: k })} aria-label={`Mark option ${k + 1} as right`} aria-pressed={x.a === k} className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full border-2', x.a === k ? 'border-ember-jade bg-ember-jade text-white' : 'border-ink/20')}>{x.a === k && <Check className="h-4 w-4" />}</button>
                  <input value={o} onChange={(e) => set(i, { options: x.options.map((y, m) => (m === k ? e.target.value : y)) })} maxLength={60} placeholder={`Option ${k + 1}`} aria-label={`Question ${i + 1} option ${k + 1}`} className="h-10 min-w-0 flex-1 rounded-xl bg-[#F1F1F4] px-3 text-sm font-semibold outline-none" />
                  {x.options.length > 2 && <button onClick={() => set(i, { options: x.options.filter((_, m) => m !== k), a: x.a === k ? 0 : x.a > k ? x.a - 1 : x.a })} aria-label={`Remove option ${k + 1}`} className="grid h-8 w-8 place-items-center text-ink-mute"><X className="h-4 w-4" /></button>}
                </div>
              ))}
              {x.options.length < 4 && <button onClick={() => set(i, { options: [...x.options, ''] })} className="px-1 text-sm font-extrabold text-ember-flame">+ Option</button>}
            </div>
          </li>
        ))}
      </ol>
      {qs.length < 10 && <button onClick={() => setQs([...qs, { q: '', options: ['', ''], a: 0 }])} className="mt-3 flex h-12 w-full items-center justify-center gap-1 rounded-2xl bg-white text-[15px] font-extrabold"><Plus className="h-4 w-4" /> Add question</button>}
      <button onClick={() => void save()} disabled={busy} className="mt-3 h-14 w-full rounded-2xl bg-ink text-[16px] font-extrabold text-white disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Share with friends'}</button>
    </div>
  );
}

/** /quiz/:id — take it, or see results / leaderboard. */
export function QuizScreen() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const [quiz, setQuiz] = useState<Quiz | null | undefined>(undefined);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [board, setBoard] = useState<QuizRow[]>([]);
  const [picks, setPicks] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void quizApi.get(id).then(setQuiz).catch(() => setQuiz(null));
    void quizApi.result(id).then((r) => {
      setResult(r);
      if (r) void quizApi.board(id).then(setBoard).catch(() => undefined);
    }).catch(() => undefined);
  }, [id]);

  if (quiz === undefined) return <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div>;
  if (!quiz) return <div className="grid h-full place-items-center p-8 text-center text-sm text-ink-mute">This quiz isn’t available.</div>;
  const owner = quiz.owner_id === me;
  const done = !!result && !result.owner;

  async function submit() {
    if (picks.length !== quiz!.questions.length || picks.some((p) => p === undefined)) return toast('Answer every question', 'error');
    setBusy(true);
    try {
      setResult(await quizApi.take(id, picks));
      setBoard(await quizApi.board(id));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-noir px-4 pb-32 pt-safe">
      <div className="flex items-center gap-3 py-3"><Back to="/quizzes" /><h1 className="min-w-0 truncate font-display text-2xl">{quiz.title}</h1></div>
      {done && (
        <div className="rounded-tile bg-[#111111] p-5 text-center text-white">
          <p className="text-sm font-bold text-white/70">You got</p>
          <p className="font-display text-5xl">{result!.score}/{result!.total}</p>
        </div>
      )}
      <ol className="mt-3 space-y-3">
        {quiz.questions.map((x, i) => (
          <li key={i} className="rounded-tile bg-white p-3.5">
            <p className="font-extrabold">{i + 1}. {x.q}</p>
            <div className="mt-2 grid gap-1.5">
              {x.options.map((o, k) => {
                const right = result?.answers?.[i] === k;
                const mineWrong = done && result!.mine?.[i] === k && !right;
                return (
                  <button
                    key={k}
                    disabled={owner || done}
                    onClick={() => setPicks((p) => { const n = [...p]; n[i] = k; return n; })}
                    className={cn('rounded-xl px-3 py-2.5 text-left text-sm font-bold ring-1', right && (owner || done) ? 'bg-ember-jade/15 ring-ember-jade' : mineWrong ? 'bg-ember-rose/10 ring-ember-rose' : picks[i] === k ? 'bg-ink text-white ring-ink' : 'ring-ink/10')}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      {!owner && !done && <button onClick={() => void submit()} disabled={busy} className="mt-3 h-14 w-full rounded-2xl bg-ink text-[16px] font-extrabold text-white disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'See my score'}</button>}
      {(owner || done) && (
        <section className="mt-5">
          <h2 className="px-1 text-[17px] font-extrabold">Scores</h2>
          {board.length === 0 && <p className="px-1 py-2 text-sm text-ink-mute">{owner ? 'No one has played yet. Friends find it under Stories → Quizzes.' : 'Only you so far.'}</p>}
          <ul className="mt-2 space-y-1.5">
            {board.map((b, i) => (
              <li key={b.user_id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5">
                <span className="w-5 text-center text-sm font-extrabold text-ink-mute">{i + 1}</span>
                <Avatar name={b.display_name} url={b.avatar_url} size={34} ring={false} />
                <span className="flex-1 truncate font-bold">{b.display_name}</span>
                <span className="font-display text-lg">{b.score}/{quiz.questions.length}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
