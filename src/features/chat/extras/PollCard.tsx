import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { pollApi, tally, type PollVote } from '@/lib/chat/extras';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';

/** A chat poll: tap an option to vote (tap another to change). Results update live for everyone. */
export function PollCard({ messageId, question, options, local }: { messageId: string; question: string; options: string[]; local: boolean }) {
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const toast = useToast();
  const [votes, setVotes] = useState<PollVote[]>([]);

  useEffect(() => {
    if (local) return;
    let alive = true;
    const load = () => void pollApi.votes(messageId).then((v) => alive && setVotes(v)).catch(() => undefined);
    load();
    const ch = supabase
      .channel(`poll:${messageId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `message_id=eq.${messageId}` }, load)
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, [messageId, local]);

  const t = tally(votes, options.length, me);
  async function vote(i: number) {
    if (local || t.mine === i) return;
    haptic(10);
    const prev = votes;
    setVotes([...votes.filter((v) => v.user_id !== me), { message_id: messageId, user_id: me, option: i }]);
    try {
      await pollApi.vote(messageId, i);
    } catch (e) {
      setVotes(prev);
      toast((e as Error).message, 'error');
    }
  }

  const voted = t.mine !== null;
  return (
    <div className="w-[260px] max-w-full rounded-[22px] bg-white p-3.5 text-ink shadow-[0_1px_0_rgba(17,17,17,.06)]">
      <div className="flex items-start gap-2">
        <NovaEmoji id="chat" size={26} />
        <p className="flex-1 text-[15px] font-extrabold leading-snug">{question}</p>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {options.map((o, i) => {
          const pct = t.total ? Math.round((t.counts[i] / t.total) * 100) : 0;
          return (
            <li key={i}>
              <button onClick={() => void vote(i)} disabled={local} className={cn('relative isolate flex w-full items-center gap-2 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-transform active:scale-[0.98]', t.mine === i ? 'ring-2 ring-ink' : 'ring-1 ring-ink/10')}>
                {voted && <span className="absolute inset-y-0 left-0 -z-10 bg-ember-flame/15 transition-[width] duration-500" style={{ width: `${pct}%` }} />}
                <span className="flex-1">{o}</span>
                {t.mine === i && <Check className="h-4 w-4" />}
                {voted && <span className="tabular-nums text-ink-mute">{pct}%</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] font-semibold text-ink-mute">{local ? 'Sending…' : `${t.total} vote${t.total === 1 ? '' : 's'}${voted ? ' · tap to change' : ' · tap to vote'}`}</p>
    </div>
  );
}
