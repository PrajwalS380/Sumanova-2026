import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import type { MediaMeta, PublicProfile } from '@/lib/chat/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';

const PIECE = ['', '#FF4F9A', '#3D7BFF'];

/** Tic-tac-toe / four-in-a-row in a chat. Moves are checked on the server; the card updates live. */
export function GameCard({ messageId, meta, people, local }: { messageId: string; meta: MediaMeta; people: Record<string, PublicProfile>; local: boolean }) {
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const toast = useToast();
  const [pending, setPending] = useState<MediaMeta | null>(null);
  useEffect(() => setPending(null), [meta]);
  const m = pending ?? meta;
  const players = m.players ?? [];
  const board = m.board ?? [];
  const myIdx = players.indexOf(me);
  const myTurn = !m.winner && myIdx >= 0 && m.turn === myIdx && !local;
  const name = (id?: string) => (id === me ? 'You' : people[id ?? '']?.display_name.split(' ')[0] ?? 'Friend');
  const c4 = m.game === 'c4';

  async function move(cell: number) {
    if (!myTurn) return;
    haptic(8);
    const { data, error } = await supabase.rpc('game_move', { p_message: messageId, p_cell: cell });
    if (error) return toast(error.message, 'error');
    setPending(data as MediaMeta);
  }

  const status = m.winner === 'draw' ? 'It’s a draw!' : m.winner ? `${name(m.winner)} won!` : myTurn ? 'Your turn' : `${name(players[m.turn ?? 0])}’s turn`;
  return (
    <div className="w-[260px] max-w-full rounded-[22px] bg-white p-3 text-ink">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-sm font-black">{c4 ? 'Four in a row' : 'Tic-tac-toe'}</p>
        <p className={cn('text-xs font-extrabold', myTurn ? 'text-ember-rose' : 'text-ink-mute')}>{status}</p>
      </div>
      <div className="flex items-center gap-3 px-1 pb-2 text-[11px] font-bold text-ink-mute">
        {players.map((p, i) => <span key={p} className="flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: PIECE[i + 1] }} />{name(p)}</span>)}
      </div>
      {c4 ? (
        <div className="grid grid-cols-7 gap-1 rounded-2xl bg-ink p-1.5">
          {board.map((v, i) => (
            <button key={i} onClick={() => void move(i % 7)} disabled={!myTurn} aria-label={`Column ${(i % 7) + 1}`} className="aspect-square rounded-full" style={{ background: v ? PIECE[v] : '#2a2a2e' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {board.map((v, i) => (
            <button key={i} onClick={() => !v && void move(i)} disabled={!myTurn || !!v} aria-label={`Square ${i + 1}`} className="grid aspect-square place-items-center rounded-2xl bg-[#F1F1F4] text-3xl font-black" style={{ color: PIECE[v] }}>
              {v === 1 ? '×' : v === 2 ? '○' : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
