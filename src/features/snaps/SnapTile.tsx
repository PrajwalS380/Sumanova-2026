import { Camera, Eye, Repeat2, Video } from 'lucide-react';
import type { SnapRecipient, SnapRow } from '@/lib/snaps/api';
import { cn } from '@/lib/cn';

export type SnapTileState = 'unopened' | 'opened' | 'replayable' | 'replayed' | 'expired' | 'sent' | 'delivered' | 'seen' | 'loading';

export function snapTileState(mine: boolean, rows: SnapRecipient[], snap: SnapRow | undefined, me: string, now = Date.now()): { state: SnapTileState; screenshot: boolean } {
  if (mine) {
    if (!rows.length) return { state: 'loading', screenshot: false };
    const screenshot = rows.some((r) => r.screenshot_at);
    if (rows.some((r) => r.status === 'opened' || r.status === 'replayed')) return { state: rows.some((r) => r.status === 'replayed') ? 'replayed' : 'seen', screenshot };
    if (rows.some((r) => r.status === 'delivered')) return { state: 'delivered', screenshot };
    return { state: rows.every((r) => r.status === 'expired') ? 'expired' : 'sent', screenshot };
  }
  const r = rows.find((x) => x.recipient_id === me);
  if (!r) return { state: 'loading', screenshot: false };
  if (r.status === 'sent' || r.status === 'delivered') return { state: 'unopened', screenshot: !!r.screenshot_at };
  if (r.status === 'opened' && snap?.allow_replay && r.opened_at && now - new Date(r.opened_at).getTime() < 5 * 60_000) return { state: 'replayable', screenshot: !!r.screenshot_at };
  if (r.status === 'replayed') return { state: 'replayed', screenshot: !!r.screenshot_at };
  if (r.status === 'expired') return { state: 'expired', screenshot: false };
  return { state: 'opened', screenshot: !!r.screenshot_at };
}

const LABEL: Record<SnapTileState, string> = {
  unopened: 'Tap to view',
  opened: 'Opened',
  replayable: 'Tap to replay',
  replayed: 'Replayed',
  expired: 'Expired',
  sent: 'Sent',
  delivered: 'Delivered',
  seen: 'Opened',
  loading: '…',
};

export function SnapTile({ kind, state, screenshot, mine, onOpen }: { kind: string; state: SnapTileState; screenshot: boolean; mine: boolean; onOpen: () => void }) {
  const actionable = state === 'unopened' || state === 'replayable' || mine;
  const fresh = state === 'unopened';
  const Icon = kind === 'video' ? Video : Camera;
  return (
    <button
      onClick={actionable ? onOpen : undefined}
      disabled={!actionable}
      className={cn('flex min-w-[190px] items-center gap-3 rounded-[1.4rem] px-3 py-2.5 text-left transition-transform active:scale-[0.98]', fresh ? 'bg-gradient-to-br from-ember-flame/90 to-ember-jade/80 text-white shadow-glow' : 'bg-white/[0.07] ring-1 ring-white/10')}
    >
      <span className={cn('relative grid h-10 w-10 place-items-center rounded-xl', fresh ? 'bg-white/20' : 'bg-white/5')}>
        {fresh && <span className="absolute inset-0 animate-ping rounded-xl bg-white/20" />}
        {state === 'replayable' ? <Repeat2 className="h-5 w-5" /> : state === 'seen' || state === 'opened' ? <Eye className="h-5 w-5 text-ink-mute" /> : <Icon className="h-5 w-5" />}
      </span>
      <span>
        <span className="block text-sm font-semibold">{mine ? (kind === 'video' ? 'Video snap' : 'Snap') : LABEL[state]}</span>
        <span className={cn('block text-xs', fresh ? 'text-white/80' : 'text-ink-mute')}>
          {mine ? LABEL[state] : kind === 'video' ? 'Video snap' : 'Photo snap'}
          {screenshot && ' · 📸 screenshot'}
        </span>
      </span>
    </button>
  );
}
