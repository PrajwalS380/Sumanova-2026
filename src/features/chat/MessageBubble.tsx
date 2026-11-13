import { memo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check, CheckCheck, Clock3, CornerUpRight, Eye, RotateCw } from 'lucide-react';
import type { LocalMessage, PublicProfile, Reaction } from '@/lib/chat/types';
import { clockTime } from '@/lib/chat/time';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';
import { Avatar } from '@/components/Avatar';
import { ImageView, VideoView, VoiceView } from './MediaView';
import { useLongPress } from './useLongPress';

export type Receipt = 'sending' | 'failed' | 'sent' | 'delivered' | 'seen' | null;

interface Props {
  m: LocalMessage;
  mine: boolean;
  sender?: PublicProfile;
  showSender: boolean;
  groupedWithPrev: boolean;
  groupedWithNext: boolean;
  reply?: LocalMessage | null;
  replySender?: string;
  reactions: Reaction[];
  receipt: Receipt;
  bubbleGradient: string;
  onMenu: (m: LocalMessage) => void;
  onReplyTap: (id: string) => void;
  onRetry: (clientId: string) => void;
  onOpenImage: (url: string) => void;
  onQuickReact: (m: LocalMessage) => void;
}

export const MessageBubble = memo(function MessageBubble(p: Props) {
  const { m, mine } = p;
  const press = useLongPress(() => {
    if (m.local || m.deleted_at) return;
    haptic(12);
    p.onMenu(m);
  });

  if (m.kind === 'system') {
    return (
      <div className="my-3 flex justify-center px-6">
        <span className="rounded-full bg-white/5 px-3 py-1 text-center text-xs text-ink-mute">{m.body}</span>
      </div>
    );
  }

  const isMedia = m.kind === 'image' || m.kind === 'video';
  const isSticker = m.kind === 'sticker';
  const deleted = !!m.deleted_at;
  const counts = p.reactions.reduce<Record<string, number>>((acc, r) => ((acc[r.emoji] = (acc[r.emoji] ?? 0) + 1), acc), {});
  const r = 'rounded-[1.4rem]';
  const corner = mine ? (p.groupedWithNext ? 'rounded-br-md' : 'rounded-br-[0.5rem]') : p.groupedWithNext ? 'rounded-bl-md' : 'rounded-bl-[0.5rem]';
  const topCorner = p.groupedWithPrev ? (mine ? 'rounded-tr-md' : 'rounded-tl-md') : '';

  return (
    <motion.div
      layout="position"
      initial={m.local ? { opacity: 0, y: 12, scale: 0.96 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 36 }}
      className={cn('flex items-end gap-2 px-3 [content-visibility:auto] [contain-intrinsic-size:auto_60px]', mine ? 'justify-end' : 'justify-start', p.groupedWithPrev ? 'mt-0.5' : 'mt-3')}
      id={`msg-${m.id}`}
    >
      {!mine && p.showSender && <span className="w-7 shrink-0">{!p.groupedWithNext && p.sender && <Avatar name={p.sender.display_name} url={p.sender.avatar_url} aura={p.sender.aura_color} size={28} ring={false} />}</span>}
      <div className={cn('flex max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
        {p.showSender && !mine && !p.groupedWithPrev && p.sender && <span className="mb-1 ml-3 text-[11px] font-semibold text-ink-mute">{p.sender.display_name}</span>}
        <div
          {...press}
          onDoubleClick={() => !m.local && !deleted && p.onQuickReact(m)}
          className={cn(
            'relative select-none touch-manipulation',
            !isSticker && !isMedia && cn(r, corner, topCorner, 'px-3.5 py-2', mine ? 'text-white' : 'bg-white/[0.08] text-ink ring-1 ring-white/[0.06]'),
            isMedia && cn('overflow-hidden p-1', r, corner, topCorner, mine ? '' : 'bg-white/[0.06]'),
            deleted && 'bg-transparent italic text-ink-mute ring-1 ring-white/10',
            m.local === 'failed' && 'opacity-70',
          )}
          style={mine && !isSticker && !deleted ? { background: p.bubbleGradient } : undefined}
        >
          {m.forwarded && !deleted && (
            <span className="mb-1 flex items-center gap-1 text-[11px] opacity-70">
              <CornerUpRight className="h-3 w-3" /> Forwarded
            </span>
          )}
          {p.reply && !deleted && (
            <button onClick={() => p.onReplyTap(p.reply!.id)} className={cn('mb-1.5 block w-full rounded-xl border-l-2 px-2.5 py-1.5 text-left text-xs', mine ? 'border-white/70 bg-black/15' : 'border-aurora-iris bg-white/5')}>
              <span className="block font-semibold opacity-90">{p.replySender}</span>
              <span className="line-clamp-2 opacity-75">{p.reply.deleted_at ? 'Deleted message' : p.reply.body ?? (p.reply.kind === 'image' ? '📷 Photo' : p.reply.kind === 'video' ? '🎬 Video' : p.reply.kind === 'voice' ? '🎙️ Voice note' : '')}</span>
            </button>
          )}
          {deleted ? (
            <span className="text-sm">Message deleted</span>
          ) : m.kind === 'text' ? (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.body}</p>
          ) : m.kind === 'sticker' ? (
            <span className="block pb-1 text-[64px] leading-none drop-shadow-[0_6px_20px_rgba(0,0,0,0.35)]" role="img" aria-label="Sticker">{m.body}</span>
          ) : m.kind === 'image' ? (
            <ImageView path={m.media_path} localUrl={m.localUrl} meta={m.media_meta} onOpen={p.onOpenImage} />
          ) : m.kind === 'video' ? (
            <VideoView path={m.media_path} localUrl={m.localUrl} meta={m.media_meta} />
          ) : m.kind === 'voice' ? (
            <VoiceView path={m.media_path} localUrl={m.localUrl} meta={m.media_meta} mine={mine} />
          ) : null}
          {isMedia && m.body && <p className="px-2 pb-1 pt-1.5 text-[14px]">{m.body}</p>}
        </div>

        {Object.keys(counts).length > 0 && (
          <div className={cn('relative z-10 -mt-1.5 flex gap-1', mine ? 'mr-2' : 'ml-2')}>
            {Object.entries(counts).map(([e, n]) => (
              <span key={e} className="flex items-center gap-0.5 rounded-full bg-night-700 px-1.5 py-0.5 text-xs ring-1 ring-white/10">
                {e}
                {n > 1 && <span className="text-[10px] text-ink-mute">{n}</span>}
              </span>
            ))}
          </div>
        )}

        {(!p.groupedWithNext || m.local || p.receipt) && (
          <div className={cn('mt-1 flex items-center gap-1 px-1 text-[10px] text-ink-faint', mine ? 'flex-row-reverse' : '')}>
            {m.local === 'failed' ? (
              <button onClick={() => p.onRetry(m.client_id)} className="flex items-center gap-1 text-aurora-coral">
                <AlertCircle className="h-3 w-3" /> Not sent · <RotateCw className="h-3 w-3" /> Retry
              </button>
            ) : (
              <>
                {mine && p.receipt && <ReceiptIcon r={p.receipt} />}
                {!m.local && <span>{clockTime(m.created_at)}</span>}
                {m.edited_at && !deleted && <span>· edited</span>}
                {m.disappear_mode === 'after_view' && <Eye className="h-3 w-3 text-aurora-peach" />}
                {m.disappear_mode === '24h' && <Clock3 className="h-3 w-3 text-aurora-peach" />}
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});

function ReceiptIcon({ r }: { r: Receipt }) {
  if (r === 'sending') return <span className="h-2.5 w-2.5 animate-spin rounded-full border border-ink-faint border-t-transparent" aria-label="Sending" />;
  if (r === 'seen') return <span className="flex items-center gap-0.5 text-aurora-mint"><CheckCheck className="h-3.5 w-3.5" /> Seen</span>;
  if (r === 'delivered') return <span className="flex items-center gap-0.5"><CheckCheck className="h-3.5 w-3.5" /> Delivered</span>;
  if (r === 'sent') return <span className="flex items-center gap-0.5"><Check className="h-3.5 w-3.5" /> Sent</span>;
  return null;
}
