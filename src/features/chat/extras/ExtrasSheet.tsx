import { useState } from 'react';
import { CalendarClock, ChevronLeft, Loader2, MapPin, Plus, Radio, Trash2, X } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';
import { useToast } from '@/providers/ToastProvider';
import { getPosition, scheduleApi } from '@/lib/chat/extras';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import type { ComposerSend } from '../Composer';

type View = 'menu' | 'poll' | 'live' | 'schedule';
const LIVE = [
  { min: 15, label: '15 minutes' },
  { min: 60, label: '1 hour' },
  { min: 480, label: '8 hours' },
];

/** "+" in the composer: poll, location, live location, schedule a message. */
export function ExtrasSheet({ open, onClose, onSend, conversationId, draft, onScheduled }: {
  open: boolean;
  onClose: () => void;
  onSend: (m: ComposerSend, live?: number) => void;
  conversationId: string;
  draft: string;
  onScheduled: () => void;
}) {
  const toast = useToast();
  const [view, setView] = useState<View>('menu');
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [text, setText] = useState('');
  const [when, setWhen] = useState(() => defaultWhen());

  function close() {
    onClose();
    setTimeout(() => setView('menu'), 250);
  }

  async function sendLocation(liveMin?: number) {
    setBusy(true);
    try {
      const p = await getPosition();
      const meta = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), ...(liveMin ? { live_until: new Date(Date.now() + liveMin * 60_000).toISOString(), updated_at: new Date().toISOString() } : {}) };
      onSend({ kind: 'location', body: liveMin ? 'Live location' : 'Location', meta }, liveMin);
      haptic(10);
      close();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function sendPoll() {
    const options = opts.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) return toast('Ask a question', 'error');
    if (options.length < 2) return toast('Add at least 2 options', 'error');
    onSend({ kind: 'poll', body: question.trim(), meta: { options } });
    setQuestion('');
    setOpts(['', '']);
    haptic(10);
    close();
  }

  async function schedule() {
    const body = (text || draft).trim();
    if (!body) return toast('Write the message first', 'error');
    const at = new Date(when);
    setBusy(true);
    try {
      await scheduleApi.create(conversationId, body, at);
      toast(`Scheduled for ${at.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`, 'success');
      setText('');
      onScheduled();
      close();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const title = { menu: 'Share', poll: 'New poll', live: 'Share live location', schedule: 'Schedule a message' }[view];
  return (
    <Sheet open={open} onClose={close} title={title}>
      <div className="px-4 pb-6">
        {view !== 'menu' && (
          <button onClick={() => setView('menu')} className="mb-2 flex items-center gap-1 text-sm font-bold text-ink-mute"><ChevronLeft className="h-4 w-4" /> Back</button>
        )}
        {view === 'menu' && (
          <div className="grid grid-cols-2 gap-2">
            <Tile icon={<NovaEmoji id="chat" size={34} />} label="Poll" sub="Ask the chat" onClick={() => setView('poll')} />
            <Tile icon={busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <MapPin className="h-7 w-7" />} label="Location" sub="Send where you are" onClick={() => void sendLocation()} />
            <Tile icon={<Radio className="h-7 w-7 text-ember-rose" />} label="Live location" sub="Moves with you" onClick={() => setView('live')} />
            <Tile icon={<CalendarClock className="h-7 w-7" />} label="Schedule" sub="Send it later" onClick={() => { setText(draft); setView('schedule'); }} />
          </div>
        )}

        {view === 'poll' && (
          <div className="space-y-2">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} placeholder="Ask a question" aria-label="Poll question" className="h-12 w-full rounded-2xl bg-[#F1F1F4] px-4 text-[15px] font-bold outline-none" />
            {opts.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} maxLength={80} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} className="h-11 flex-1 rounded-2xl bg-[#F1F1F4] px-4 text-[15px] font-semibold outline-none" />
                {opts.length > 2 && <button onClick={() => setOpts(opts.filter((_, j) => j !== i))} aria-label={`Remove option ${i + 1}`} className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F1F1F4] text-ink-mute"><X className="h-4 w-4" /></button>}
              </div>
            ))}
            {opts.length < 6 && <button onClick={() => setOpts([...opts, ''])} className="flex items-center gap-1.5 px-1 py-1 text-sm font-extrabold text-ember-flame"><Plus className="h-4 w-4" /> Add option</button>}
            <button onClick={sendPoll} className="mt-1 h-12 w-full rounded-2xl bg-ember-flame text-[15px] font-extrabold text-white active:scale-[0.98]">Send poll</button>
          </div>
        )}

        {view === 'live' && (
          <div className="space-y-2">
            <p className="px-1 text-sm text-ink-mute">Friends in this chat see your pin move while SUMANOVA is open on your phone. You can stop any time.</p>
            {LIVE.map((l) => (
              <button key={l.min} disabled={busy} onClick={() => void sendLocation(l.min)} className="flex h-12 w-full items-center justify-between rounded-2xl bg-[#F1F1F4] px-4 text-[15px] font-bold active:scale-[0.98] disabled:opacity-60">
                {l.label} {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>
            ))}
          </div>
        )}

        {view === 'schedule' && (
          <div className="space-y-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} placeholder="Message" aria-label="Message to schedule" className="w-full resize-none rounded-2xl bg-[#F1F1F4] px-4 py-3 text-[15px] font-semibold outline-none" />
            <label className="flex items-center gap-3 rounded-2xl bg-[#F1F1F4] px-4 py-2.5 text-[15px] font-bold">
              <span className="flex-1">Send at</span>
              <input type="datetime-local" value={when} min={toLocal(new Date(Date.now() + 60_000))} max={toLocal(new Date(Date.now() + 30 * 86_400_000))} onChange={(e) => setWhen(e.target.value)} className="bg-transparent text-right text-[15px]" aria-label="Send at" />
            </label>
            <button onClick={() => void schedule()} disabled={busy} className="h-12 w-full rounded-2xl bg-ember-flame text-[15px] font-extrabold text-white active:scale-[0.98] disabled:opacity-60">{busy ? 'Scheduling…' : 'Schedule'}</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Tile({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('flex flex-col items-start gap-3 rounded-tile bg-[#F1F1F4] p-3.5 text-left active:scale-[0.98]')}>
      {icon}
      <span><span className="block text-[15px] font-extrabold">{label}</span><span className="block text-xs text-ink-mute">{sub}</span></span>
    </button>
  );
}

const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
function defaultWhen() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  return toLocal(d);
}

/** Bar above the composer: my scheduled messages in this chat, with cancel. */
export function ScheduledList({ items, onCancel }: { items: { id: string; body: string; send_at: string }[]; onCancel: (id: string) => void }) {
  return (
    <ul className="space-y-2 px-4 pb-6">
      {items.map((s) => (
        <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-[#F1F1F4] px-3.5 py-3">
          <CalendarClock className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{s.body}</span>
            <span className="block text-xs text-ink-mute">{new Date(s.send_at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
          </span>
          <button onClick={() => onCancel(s.id)} aria-label="Cancel scheduled message" className="grid h-9 w-9 place-items-center rounded-xl bg-white text-ember-rose"><Trash2 className="h-4 w-4" /></button>
        </li>
      ))}
    </ul>
  );
}
