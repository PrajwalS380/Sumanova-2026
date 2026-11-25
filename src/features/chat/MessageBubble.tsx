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
import { SnapTile, type SnapTileState } from '@/features/snaps/SnapTile';
import { parseNovaSticker } from '@/components/emoji/novaEmoji';
import { NovaSticker } from '@/components/emoji/NovaSticker';
import { PollCard } from './extras/PollCard';
import { LocationCard } from './extras/LocationCard';
import { HangoutCard } from './extras/HangoutCard';
import { GameCard } from './extras/GameCard';
import { E2EText } from './extras/E2EText';
import { ReactionGlyph } from './extras/AvatarReaction';

export type Receipt = 'sending' | 'failed' | 'sent' | 'delivered' | 'seen' | null;

interface Props {
  m: LocalMessage;
  mine: boolean;
  sender?: PublicProfile;
  people?: Record<string, PublicProfile>;
  showSender: boolean;
  groupedWithPrev: boolean;
  groupedWithNext: boolean;
  reply?: LocalMessage | null;
  replySender?: string;
  reactions: Reaction[];
  receipt: Receipt;
  bubbleGradient: string;
  bubbleInk?: string;
  onMenu: (m: LocalMessage) => void;
  onReplyTap: (id: string) => void;
  onRetry: (clientId: string) => void;
  onOpenImage: (url: string) => void;
  onQuickReact: (m: LocalMessage) => void;
  snap?: { state: SnapTileState; screenshot: boolean; onOpen: () => void };
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
        <span className="max-w-[90%] rounded-xl bg-white px-3 py-1 text-center text-xs font-semibold text-ink-mute [overflow-wrap:anywhere]">{m.body}</span>
      </div>
    );
  }

  const avatarSticker = m.kind === 'image' && !!m.media_meta?.sticker;
  const isMedia = (m.kind === 'image' && !avatarSticker) || m.kind === 'video';
  const isSticker = m.kind === 'sticker' || m.kind === 'snap' || m.kind === 'poll' || m.kind === 'location' || m.kind === 'hangout' || m.kind === 'game' || avatarSticker;
  const deleted = !!m.deleted_at;
  const counts = p.reactions.reduce<Record<string, number>>((acc, r) => ((acc[r.emoji] = (acc[r.emoji] ?? 0) + 1), acc), {});
  const r = 'rounded-[20px]';
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
      <div className={cn('flex min-w-0 max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
        {p.showSender && !mine && !p.groupedWithPrev && p.sender && <span className="mb-1 ml-3 text-[11px] font-semibold text-ink-mute">{p.sender.display_name}</span>}
        <div
          {...press}
          onDoubleClick={() => !m.local && !deleted && p.onQuickReact(m)}
          className={cn(
            'relative select-none touch-manipulation',
            !isSticker && !isMedia && cn(r, corner, topCorner, 'px-3.5 py-2', mine ? 'text-white' : 'bg-white text-ink'),
            isMedia && cn('overflow-hidden p-1', r, corner, topCorner, mine ? '' : 'bg-white'),
            deleted && 'bg-transparent italic text-ink-mute ring-1 ring-ink/10',
            m.local === 'failed' && 'opacity-70',
          )}
          style={mine && !isSticker && !deleted ? { background: p.bubbleGradient, color: p.bubbleInk } : undefined}
        >
          {m.forwarded && !deleted && (
            <span className="mb-1 flex items-center gap-1 text-[11px] opacity-70">
              <CornerUpRight className="h-3 w-3" /> Forwarded
            </span>
          )}
          {p.reply && !deleted && (
            <button onClick={() => p.onReplyTap(p.reply!.id)} className={cn('mb-1.5 block w-full rounded-xl border-l-2 px-2.5 py-1.5 text-left text-xs', mine ? 'border-ink/70 bg-black/15' : 'border-ember-amber bg-ink/5')}>
              <span className="block font-semibold opacity-90">{p.replySender}</span>
              <span className="line-clamp-2 opacity-75">{p.reply.deleted_at ? 'Deleted message' : p.reply.body?.startsWith('e2e:') ? 'Encrypted message' : p.reply.body ?? (p.reply.kind === 'image' ? '📷 Photo' : p.reply.kind === 'video' ? '🎬 Video' : p.reply.kind === 'voice' ? '🎙️ Voice note' : '')}</span>
            </button>
          )}
          {deleted ? (
            <span className="text-sm">Message deleted</span>
          ) : m.kind === 'text' ? (
            m.body?.startsWith('e2e:') ? <E2EText body={m.body} mine={mine} senderId={m.sender_id} conversationId={m.conversation_id} /> : <p className="whitespace-pre-wrap text-[15px] leading-snug [overflow-wrap:anywhere]">{m.body}</p>
          ) : m.kind === 'snap' ? (
            p.snap ? <SnapTile kind={m.body ?? 'image'} state={p.snap.state} screenshot={p.snap.screenshot} mine={mine} onOpen={p.snap.onOpen} /> : null
          ) : m.kind === 'sticker' ? (
            parseNovaSticker(m.body) ? (
              <NovaSticker s={parseNovaSticker(m.body)!} size={104} className="pb-1" />
            ) : m.body?.startsWith('nova:') ? (
              <span className="text-sm text-ink-mute">Sticker</span>
            ) : (
              <span className="block max-w-full pb-1 text-[64px] leading-none [overflow-wrap:anywhere] drop-shadow-[0_6px_20px_rgba(0,0,0,0.35)]" role="img" aria-label="Sticker">{m.body}</span>
            )
          ) : m.kind === 'hangout' && m.media_meta?.hangout_id ? (
            <HangoutCard hangoutId={m.media_meta.hangout_id} />
          ) : m.kind === 'game' ? (
            <GameCard messageId={m.id} meta={m.media_meta ?? {}} people={p.people ?? {}} local={!!m.local} />
          ) : m.kind === 'poll' ? (
            <PollCard messageId={m.id} question={m.body ?? ''} options={m.media_meta?.options ?? []} local={!!m.local} />
          ) : m.kind === 'location' ? (
            <LocationCard messageId={m.id} meta={m.media_meta ?? {}} mine={mine} local={!!m.local} name={mine ? 'You' : p.sender?.display_name ?? 'Friend'} createdAt={m.created_at} />
          ) : avatarSticker ? (
            <span className="block w-[150px]"><ImageView path={m.media_path} localUrl={m.localUrl} meta={m.media_meta} onOpen={() => undefined} /></span>
          ) : m.kind === 'image' ? (
            <ImageView path={m.media_path} localUrl={m.localUrl} meta={m.media_meta} onOpen={p.onOpenImage} />
          ) : m.kind === 'video' ? (
            <VideoView path={m.media_path} localUrl={m.localUrl} meta={m.media_meta} />
          ) : m.kind === 'voice' ? (
            <VoiceView path={m.media_path} localUrl={m.localUrl} meta={m.media_meta} mine={mine} />
          ) : null}
          {isMedia && m.body && <p className="px-2 pb-1 pt-1.5 text-[14px] [overflow-wrap:anywhere]">{m.body}</p>}
        </div>

        {p.reactions.length > 0 && (
          <div className={cn('relative z-10 -mt-1.5 flex flex-wrap gap-1', mine ? 'mr-2' : 'ml-2')}>
            {/* Avatar reactions show each person's own avatar; others group by emoji. */}
            {p.reactions.filter((r) => r.emoji.startsWith('av:')).map((r) => (
              <span key={r.user_id} className="flex items-center rounded-full bg-white p-0.5 shadow-sm"><ReactionGlyph value={r.emoji} userId={r.user_id} size={20} /></span>
            ))}
            {Object.entries(counts).filter(([e]) => !e.startsWith('av:')).map(([e, n]) => (
              <span key={e} className="flex items-center gap-0.5 rounded-xl bg-white px-1.5 py-0.5 text-xs shadow-sm">
                <ReactionGlyph value={e} userId="" size={16} />
                {n > 1 && <span className="text-[10px] text-ink-mute">{n}</span>}
              </span>
            ))}
          </div>
        )}

        {(!p.groupedWithNext || m.local || p.receipt) && (
          <div className={cn('mt-1 flex items-center gap-1 px-1 text-[10px] text-ink-faint', mine ? 'flex-row-reverse' : '')}>
            {m.local === 'failed' ? (
              <button onClick={() => p.onRetry(m.client_id)} className="flex items-center gap-1 text-ember-rose">
                <AlertCircle className="h-3 w-3" /> Not sent · <RotateCw className="h-3 w-3" /> Retry
              </button>
            ) : (
              <>
                {mine && p.receipt && <ReceiptIcon r={p.receipt} />}
                {!m.local && <span>{clockTime(m.created_at)}</span>}
                {m.edited_at && !deleted && <span>· edited</span>}
                {m.disappear_mode === 'after_view' && <Eye className="h-3 w-3 text-ember-peach" />}
                {m.disappear_mode === '24h' && <Clock3 className="h-3 w-3 text-ember-peach" />}
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
  if (r === 'seen') return <span className="flex items-center gap-0.5 text-ember-sage"><CheckCheck className="h-3.5 w-3.5" /> Seen</span>;
  if (r === 'delivered') return <span className="flex items-center gap-0.5"><CheckCheck className="h-3.5 w-3.5" /> Delivered</span>;
  if (r === 'sent') return <span className="flex items-center gap-0.5"><Check className="h-3.5 w-3.5" /> Sent</span>;
  return null;
}
