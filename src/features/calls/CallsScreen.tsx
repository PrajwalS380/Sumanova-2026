import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Phone, PhoneMissed, Video } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { callsApi, type CallHistoryItem } from '@/lib/calls/api';
import { formatDuration, shortTime } from '@/lib/chat/time';
import { useCalls } from '@/providers/CallProvider';
import { useToast } from '@/providers/ToastProvider';
import { cn } from '@/lib/cn';

export default function CallsScreen() {
  const [items, setItems] = useState<CallHistoryItem[] | null>(null);
  const { startCall, state } = useCalls();
  const toast = useToast();

  useEffect(() => {
    callsApi.history().then(setItems).catch((e) => { toast((e as Error).message, 'error'); setItems([]); });
  }, [state, toast]);

  return (
    <div className="pb-16">
      <ScreenHeader title="Calls" />
      <div className="mx-auto max-w-lg px-4">
        {items === null ? (
          <ul className="space-y-2">{[0, 1, 2].map((i) => <li key={i} className="h-16 animate-pulse rounded-3xl bg-ink/[0.04]" />)}</ul>
        ) : items.length === 0 ? (
          <div className="glass mt-6 rounded-4xl p-8 text-center">
            <p className="font-display text-lg">No calls yet</p>
            <p className="mt-2 text-sm text-ink-mute">Open a chat with a friend and tap the phone or video icon.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((c, i) => {
              const missed = !c.outgoing && ['missed', 'cancelled', 'busy'].includes(c.status);
              const dur = c.answered_at && c.ended_at ? (new Date(c.ended_at).getTime() - new Date(c.answered_at).getTime()) / 1000 : null;
              return (
                <motion.li key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }} className="flex items-center gap-3 rounded-3xl p-2.5 hover:bg-ink/[0.04]">
                  <Avatar name={c.other_display_name} url={c.other_avatar_url} aura={c.other_aura} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate font-semibold', missed && 'text-ember-rose')}>{c.other_display_name}</p>
                    <p className="flex items-center gap-1 text-xs text-ink-mute">
                      {missed ? <PhoneMissed className="h-3.5 w-3.5 text-ember-rose" /> : c.outgoing ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5 text-ember-sage" />}
                      {c.kind === 'video' ? 'Video' : 'Voice'} · {shortTime(c.started_at)}{dur ? ` · ${formatDuration(dur)}` : c.status === 'declined' ? ' · declined' : ''}
                    </p>
                  </div>
                  <button onClick={() => void startCall(c.conversation_id, c.kind)} aria-label={`Call ${c.other_display_name}`} className="grid h-10 w-10 place-items-center rounded-full bg-ink/10 text-ember-sage active:scale-90">
                    {c.kind === 'video' ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
        <p className="mt-8 px-2 text-center text-xs text-ink-faint">Calls connect directly between devices and are encrypted in transit. Some strict networks may block calls.</p>
      </div>
    </div>
  );
}
