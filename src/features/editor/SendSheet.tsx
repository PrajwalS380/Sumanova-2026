import { useEffect, useState } from 'react';
import { Check, Loader2, Repeat2, Send } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Avatar } from '@/components/Avatar';
import { Toggle } from '@/components/ui/Toggle';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { friendsApi } from '@/lib/chat/api';
import { snapsApi } from '@/lib/snaps/api';
import type { Friend } from '@/lib/chat/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';

export interface Prepared {
  kind: 'image' | 'video';
  blob: Blob;
  overlay: Blob | null;
  meta: Record<string, unknown>;
  duration: number | null;
}

export function SendSheet({ prepared, onClose, onSent }: { prepared: Prepared | null; onClose: () => void; onSent: () => void }) {
  const { session } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [replay, setReplay] = useState(true);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (prepared && !friends) friendsApi.list().then(setFriends).catch(() => setFriends([]));
  }, [prepared, friends]);

  const toggle = (id: string) => {
    haptic(5);
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  async function send() {
    if (!prepared || !picked.size) return;
    setSending(true);
    try {
      const snapId = crypto.randomUUID();
      const { mediaPath, overlayPath } = await snapsApi.upload(me, snapId, prepared.blob, prepared.overlay);
      const n = await snapsApi.send({ snapId, kind: prepared.kind, mediaPath, overlayPath, meta: prepared.meta, duration: prepared.duration, allowReplay: replay, recipients: [...picked] });
      haptic([10, 40, 10]);
      toast(`Snap sent to ${n} ${n === 1 ? 'friend' : 'friends'} ✦`, 'success');
      onSent();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  }

  const list = (friends ?? []).filter((f) => !query || f.display_name.toLowerCase().includes(query.toLowerCase()) || f.username.includes(query.toLowerCase()));

  return (
    <Sheet open={!!prepared} onClose={onClose} title="Send to">
      <div className="px-5 pb-5">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search friends" className="mb-3 h-11 w-full rounded-2xl bg-white/5 px-4 text-[15px] outline-none ring-1 ring-white/10 focus:ring-aurora-iris/60" aria-label="Search friends" />
        {friends === null ? (
          <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-mute" /></div>
        ) : friends.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-mute">Add friends to send snaps. You can still save this to your device.</p>
        ) : (
          <ul className="max-h-[38vh] space-y-1 overflow-y-auto">
            {list.map((f) => {
              const on = picked.has(f.id);
              return (
                <li key={f.id}>
                  <button onClick={() => toggle(f.id)} aria-pressed={on} className={cn('flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors', on ? 'bg-white/10' : 'hover:bg-white/5')}>
                    <Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={42} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{f.display_name}</span>
                      <span className="block truncate text-xs text-ink-mute">@{f.username}</span>
                    </span>
                    <span className={cn('grid h-6 w-6 place-items-center rounded-full ring-1', on ? 'bg-aurora-gradient ring-transparent' : 'ring-white/25')}>{on && <Check className="h-4 w-4" />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="glass mt-3 overflow-hidden rounded-2xl">
          <Toggle label="Allow one replay" description="They can replay once within 5 minutes of opening" checked={replay} onChange={setReplay} />
        </div>
        <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-ink-mute">
          <Repeat2 className="h-3.5 w-3.5" /> {prepared?.kind === 'image' ? (prepared.duration ? `Shows for ${prepared.duration}s` : 'No time limit') : 'Plays once through'} · opens once · auto-expires after 30 days if unopened
        </p>
        <button onClick={() => void send()} disabled={!picked.size || sending} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-aurora-gradient font-semibold text-white shadow-glow transition-transform active:scale-[0.98] disabled:opacity-50">
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Send{picked.size ? ` to ${picked.size}` : ''} <Send className="h-4 w-4" /></>}
        </button>
      </div>
    </Sheet>
  );
}
