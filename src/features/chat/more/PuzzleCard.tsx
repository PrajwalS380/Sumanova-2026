import { useEffect, useMemo, useState } from 'react';
import { Brain, Loader2, Pencil, Puzzle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { puzzleApi } from '@/lib/social/fun';
import type { MediaMeta, PublicProfile } from '@/lib/chat/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';

type PMeta = MediaMeta & { puzzle?: 'trivia' | 'scramble' | 'draw'; question?: string; letters?: string; hint?: string; length?: number; strokes?: number[][]; solved_by?: string; solved_name?: string; answer?: string };

/** Draws the drawing-guess strokes (0..1000 coordinates) as an SVG. */
export function StrokesSvg({ strokes, className }: { strokes: number[][]; className?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" className={className} aria-label="Drawing">
      {strokes.map((s, i) => (
        <polyline key={i} points={s.reduce<string[]>((acc, v, k) => (k % 2 ? (acc[acc.length - 1] += `,${v}`, acc) : [...acc, `${v}`]), []).join(' ')} fill="none" stroke="#111" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** Chat puzzle: trivia (one try), word scramble or drawing guess (8 tries). First right answer wins. */
export function PuzzleCard({ messageId, meta, senderId, local, people }: { messageId: string; meta: PMeta; senderId: string | null; local: boolean; people: Record<string, PublicProfile> }) {
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const toast = useToast();
  const [guesses, setGuesses] = useState<{ user_id: string; correct: boolean }[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (local) return;
    let alive = true;
    const load = () => void puzzleApi.guesses(messageId).then((g) => alive && setGuesses(g)).catch(() => undefined);
    load();
    const ch = supabase.channel(`puzzle:${messageId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'puzzle_guesses', filter: `message_id=eq.${messageId}` }, load).subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, [messageId, local]);

  const mineTries = guesses.filter((g) => g.user_id === me).length;
  const solved = !!meta.solved_by;
  const maker = senderId === me;
  const limit = meta.puzzle === 'trivia' ? 1 : 8;
  const out = !solved && !maker && mineTries >= limit;
  const winner = meta.solved_by ? (meta.solved_by === me ? 'You' : meta.solved_name ?? people[meta.solved_by]?.display_name ?? 'Someone') : null;

  async function guess(g: string) {
    if (!g.trim() || busy) return;
    setBusy(true);
    try {
      const ok = await puzzleApi.guess(messageId, g.trim());
      haptic(ok ? [10, 40, 10] : 20);
      toast(ok ? 'Correct! You got it 🎉' : 'Not quite — try again', ok ? 'success' : 'info');
      setText('');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const icon = meta.puzzle === 'trivia' ? <Brain className="h-4.5 w-4.5" /> : meta.puzzle === 'draw' ? <Pencil className="h-4.5 w-4.5" /> : <Puzzle className="h-4.5 w-4.5" />;
  const blanks = useMemo(() => Array.from({ length: meta.length ?? 0 }), [meta.length]);
  return (
    <div className="w-[270px] max-w-full rounded-[22px] bg-white p-3.5 text-ink shadow-[0_1px_0_rgba(17,17,17,.06)]" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#8C6BFF]/15 text-[#7452F0]">{icon}</span>
        <p className="flex-1 text-[15px] font-extrabold">{meta.puzzle === 'trivia' ? 'Trivia' : meta.puzzle === 'draw' ? 'Guess the drawing' : 'Word puzzle'}</p>
        <span className="text-[11px] font-bold text-ink-mute">{guesses.length} guess{guesses.length === 1 ? '' : 'es'}</span>
      </div>
      {meta.puzzle === 'trivia' && <p className="mt-2 text-sm font-bold">{meta.question}</p>}
      {meta.puzzle === 'scramble' && <p className="mt-2 text-center font-display text-3xl tracking-[0.25em]">{meta.letters}</p>}
      {meta.puzzle === 'draw' && meta.strokes && <div className="mt-2 rounded-2xl bg-[#F6F6F8]"><StrokesSvg strokes={meta.strokes} className="aspect-square w-full" /></div>}
      {meta.hint && <p className="mt-1 text-xs text-ink-mute">Hint: {meta.hint}</p>}
      {meta.puzzle !== 'trivia' && !solved && <p className="mt-1.5 flex justify-center gap-1" aria-label={`${meta.length} letters`}>{blanks.map((_, i) => <span key={i} className="h-1 w-4 rounded-full bg-ink/25" />)}</p>}

      {solved ? (
        <p className="mt-3 rounded-xl bg-ember-jade/12 px-3 py-2 text-sm font-bold text-ember-jade">{winner} solved it: <span className="uppercase">{meta.puzzle === 'trivia' ? meta.options?.[Number(meta.answer)] : meta.answer}</span></p>
      ) : maker ? (
        <p className="mt-3 text-xs font-semibold text-ink-mute">Waiting for someone to get it…</p>
      ) : out ? (
        <p className="mt-3 text-xs font-semibold text-ink-mute">No guesses left — waiting for the others.</p>
      ) : local ? null : meta.puzzle === 'trivia' ? (
        <div className="mt-2 grid gap-1.5">
          {(meta.options ?? []).map((o, i) => (
            <button key={i} disabled={busy} onClick={() => void guess(String(i))} className="rounded-xl px-3 py-2.5 text-left text-sm font-bold ring-1 ring-ink/10 active:scale-[0.98]">{o}</button>
          ))}
        </div>
      ) : (
        <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void guess(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={40} placeholder={`Your guess (${limit - mineTries} left)`} aria-label="Your guess" className="h-10 min-w-0 flex-1 rounded-xl bg-[#F1F1F4] px-3 text-sm font-bold outline-none" />
          <button type="submit" disabled={busy || !text.trim()} className={cn('h-10 rounded-xl bg-ink px-3 text-sm font-extrabold text-white disabled:opacity-40')}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guess'}</button>
        </form>
      )}
    </div>
  );
}
