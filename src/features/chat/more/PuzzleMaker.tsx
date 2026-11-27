import { useRef, useState } from 'react';
import { Loader2, RefreshCw, Undo2 } from 'lucide-react';
import { DRAW_WORDS, SCRAMBLE_WORDS, TRIVIA, pick, puzzleApi, shuffleWord, type PuzzleKind } from '@/lib/social/fun';
import { useToast } from '@/providers/ToastProvider';
import { cn } from '@/lib/cn';

/** "+" → Puzzle: trivia (from our bank), word scramble, or draw a word for the chat to guess. */
export function PuzzleMaker({ conversationId, onDone }: { conversationId: string; onDone: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<PuzzleKind>('trivia');
  const [trivia, setTrivia] = useState(() => pick(TRIVIA));
  const [word, setWord] = useState(() => pick(SCRAMBLE_WORDS));
  const [letters, setLetters] = useState(() => shuffleWord(word));
  const [drawWord, setDrawWord] = useState(() => pick(DRAW_WORDS));
  const [strokes, setStrokes] = useState<number[][]>([]);
  const [busy, setBusy] = useState(false);
  const pad = useRef<SVGSVGElement>(null);
  const cur = useRef<number[] | null>(null);

  const pt = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)];
  };
  const size = JSON.stringify(strokes).length;

  async function send() {
    setBusy(true);
    try {
      if (kind === 'trivia') await puzzleApi.start(conversationId, 'trivia', { question: trivia.q, options: trivia.options }, String(trivia.a));
      else if (kind === 'scramble') await puzzleApi.start(conversationId, 'scramble', { letters, hint: '' }, word);
      else {
        if (!strokes.length) throw new Error('Draw something first');
        await puzzleApi.start(conversationId, 'draw', { strokes }, drawWord);
      }
      onDone();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(['trivia', 'scramble', 'draw'] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={cn('flex-1 rounded-xl py-2 text-sm font-extrabold', kind === k ? 'bg-ink text-white' : 'bg-[#F1F1F4]')}>{k === 'trivia' ? 'Trivia' : k === 'scramble' ? 'Word' : 'Draw'}</button>
        ))}
      </div>
      {kind === 'trivia' && (
        <div className="rounded-2xl bg-[#F1F1F4] p-3">
          <p className="font-extrabold">{trivia.q}</p>
          <ul className="mt-2 space-y-1 text-sm">{trivia.options.map((o, i) => <li key={o} className={cn('rounded-lg px-2 py-1', i === trivia.a && 'bg-ember-jade/15 font-bold text-ember-jade')}>{o}{i === trivia.a && ' ✓'}</li>)}</ul>
          <button onClick={() => setTrivia(pick(TRIVIA))} className="mt-2 flex items-center gap-1 text-sm font-extrabold text-ember-flame"><RefreshCw className="h-3.5 w-3.5" /> Another question</button>
          <p className="mt-1 text-xs text-ink-mute">Everyone gets one try. First right answer wins.</p>
        </div>
      )}
      {kind === 'scramble' && (
        <div className="rounded-2xl bg-[#F1F1F4] p-3 text-center">
          <p className="font-display text-3xl tracking-[0.25em]">{letters}</p>
          <p className="mt-1 text-sm text-ink-mute">The answer is <b className="text-ink">{word}</b> — only you see this.</p>
          <button onClick={() => { const w = pick(SCRAMBLE_WORDS); setWord(w); setLetters(shuffleWord(w)); }} className="mt-2 inline-flex items-center gap-1 text-sm font-extrabold text-ember-flame"><RefreshCw className="h-3.5 w-3.5" /> Another word</button>
        </div>
      )}
      {kind === 'draw' && (
        <div>
          <p className="mb-1.5 text-sm">Draw: <b className="uppercase">{drawWord}</b> <button onClick={() => { setDrawWord(pick(DRAW_WORDS)); setStrokes([]); }} className="ml-1 text-xs font-extrabold text-ember-flame">change</button></p>
          <svg
            ref={pad}
            viewBox="0 0 1000 1000"
            className="aspect-square w-full touch-none rounded-2xl bg-[#F6F6F8] ring-1 ring-ink/10"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); cur.current = pt(e); setStrokes((s) => [...s, cur.current!]); }}
            onPointerMove={(e) => {
              if (!cur.current) return;
              const [x, y] = pt(e);
              const l = cur.current;
              if (Math.hypot(x - l[l.length - 2], y - l[l.length - 1]) < 12) return;
              l.push(x, y);
              setStrokes((s) => [...s.slice(0, -1), [...l]]);
            }}
            onPointerUp={() => (cur.current = null)}
            aria-label="Drawing pad"
          >
            {strokes.map((s, i) => (
              <polyline key={i} points={s.reduce<string[]>((acc, v, k) => (k % 2 ? (acc[acc.length - 1] += `,${v}`, acc) : [...acc, `${v}`]), []).join(' ')} fill="none" stroke="#111" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
          <div className="mt-1.5 flex items-center justify-between text-xs text-ink-mute">
            <button onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length} className="flex items-center gap-1 font-bold disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
            <span className={size > 20000 ? 'text-ember-rose' : ''}>{Math.round((size / 20000) * 100)}% ink used</span>
          </div>
        </div>
      )}
      <button onClick={() => void send()} disabled={busy || (kind === 'draw' && (!strokes.length || size > 20000))} className="h-12 w-full rounded-2xl bg-ember-flame text-[15px] font-extrabold text-white disabled:opacity-40">{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Send to the chat'}</button>
    </div>
  );
}
