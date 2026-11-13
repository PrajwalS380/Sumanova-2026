import { useEffect, useState } from 'react';
import { BookImage, Check, Clapperboard, Loader2, Repeat2, Send, Sparkles } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Avatar } from '@/components/Avatar';
import { Toggle } from '@/components/ui/Toggle';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { friendsApi } from '@/lib/chat/api';
import { snapsApi } from '@/lib/snaps/api';
import { CATEGORIES, memoriesApi, spotlightApi, storiesApi, type Audience, type Category } from '@/lib/social/api';
import type { Friend } from '@/lib/chat/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { AudiencePicker } from '@/features/stories/AudiencePicker';

export interface Prepared {
  kind: 'image' | 'video';
  blob: Blob;
  overlay: Blob | null;
  meta: Record<string, unknown>;
  duration: number | null;
}

/** Grab a poster frame from a video blob (for Spotlight thumbnails). */
async function posterFrom(blob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.5, v.duration / 2 || 0);
    };
    v.onseeked = () => {
      const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => {
        URL.revokeObjectURL(url);
        resolve(b);
      }, 'image/webp', 0.8);
    };
    v.onerror = () => resolve(null);
  });
}

export function SendSheet({ prepared, onClose, onSent }: { prepared: Prepared | null; onClose: () => void; onSent: () => void }) {
  const { session } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [replay, setReplay] = useState(true);
  const [toStory, setToStory] = useState(false);
  const [audience, setAudience] = useState<Audience>('friends');
  const [toMemories, setToMemories] = useState(false);
  const [toSpotlight, setToSpotlight] = useState(false);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<Category>('everyday');
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

  const anything = picked.size > 0 || toStory || toMemories || toSpotlight;

  async function send() {
    if (!prepared || !anything) return;
    setSending(true);
    const done: string[] = [];
    try {
      if (picked.size) {
        const snapId = crypto.randomUUID();
        const { mediaPath, overlayPath } = await snapsApi.upload(me, snapId, prepared.blob, prepared.overlay);
        const n = await snapsApi.send({ snapId, kind: prepared.kind, mediaPath, overlayPath, meta: prepared.meta, duration: prepared.duration, allowReplay: replay, recipients: [...picked] });
        done.push(`${n} ${n === 1 ? 'friend' : 'friends'}`);
      }
      if (toStory) {
        await storiesApi.post(me, { kind: prepared.kind, blob: prepared.blob, overlay: prepared.overlay, meta: prepared.meta, audience });
        done.push('your story');
      }
      if (toMemories) {
        await memoriesApi.add(me, prepared.blob, prepared.kind, prepared.meta);
        done.push('Memories');
      }
      if (toSpotlight && prepared.kind === 'video') {
        await spotlightApi.publish(me, prepared.blob, await posterFrom(prepared.blob), caption, category, prepared.meta);
        done.push('Spotlight');
      }
      haptic([10, 40, 10]);
      toast(`Shared to ${done.join(', ')} ✦`, 'success');
      onSent();
    } catch (e) {
      toast(done.length ? `Shared to ${done.join(', ')}, but: ${(e as Error).message}` : (e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  }

  const list = (friends ?? []).filter((f) => !query || f.display_name.toLowerCase().includes(query.toLowerCase()) || f.username.includes(query.toLowerCase()));

  return (
    <Sheet open={!!prepared} onClose={onClose} title="Share to">
      <div className="px-5 pb-5">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Dest on={toStory} onClick={() => setToStory((v) => !v)} icon={<Sparkles className="h-5 w-5" />} label="My Story" />
          <Dest on={toMemories} onClick={() => setToMemories((v) => !v)} icon={<BookImage className="h-5 w-5" />} label="Memories" />
          <Dest on={toSpotlight} disabled={prepared?.kind !== 'video'} onClick={() => setToSpotlight((v) => !v)} icon={<Clapperboard className="h-5 w-5" />} label="Spotlight" />
        </div>
        {toStory && <div className="mb-4"><AudiencePicker value={audience} onChange={setAudience} /></div>}
        {toSpotlight && prepared?.kind === 'video' && (
          <div className="mb-4 space-y-2">
            <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 300))} placeholder="Add a caption for Spotlight" className="h-11 w-full rounded-2xl bg-white/5 px-4 text-[15px] outline-none ring-1 ring-white/10 focus:ring-aurora-iris/60" />
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs capitalize', category === c ? 'bg-white font-semibold text-night' : 'bg-white/5 text-ink-soft ring-1 ring-white/10')}>{c}</button>
              ))}
            </div>
            <p className="px-1 text-[11px] text-ink-faint">Spotlight videos are public to everyone on SUMANOVA.</p>
          </div>
        )}

        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">Friends · snap</p>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search friends" className="mb-2 h-11 w-full rounded-2xl bg-white/5 px-4 text-[15px] outline-none ring-1 ring-white/10 focus:ring-aurora-iris/60" aria-label="Search friends" />
        {friends === null ? (
          <div className="grid h-20 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-mute" /></div>
        ) : friends.length === 0 ? (
          <p className="py-5 text-center text-sm text-ink-mute">Add friends to send snaps.</p>
        ) : (
          <ul className="max-h-[30vh] space-y-1 overflow-y-auto">
            {list.map((f) => {
              const on = picked.has(f.id);
              return (
                <li key={f.id}>
                  <button onClick={() => toggle(f.id)} aria-pressed={on} className={cn('flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors', on ? 'bg-white/10' : 'hover:bg-white/5')}>
                    <Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={40} />
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
        {picked.size > 0 && (
          <>
            <div className="glass mt-3 overflow-hidden rounded-2xl">
              <Toggle label="Allow one replay" description="They can replay once within 5 minutes of opening" checked={replay} onChange={setReplay} />
            </div>
            <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-ink-mute">
              <Repeat2 className="h-3.5 w-3.5" /> {prepared?.kind === 'image' ? (prepared.duration ? `Shows for ${prepared.duration}s` : 'No time limit') : 'Plays once through'} · opens once · expires after 30 days if unopened
            </p>
          </>
        )}
        <button onClick={() => void send()} disabled={!anything || sending} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-aurora-gradient font-semibold text-white shadow-glow transition-transform active:scale-[0.98] disabled:opacity-50">
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Share <Send className="h-4 w-4" /></>}
        </button>
      </div>
    </Sheet>
  );
}

function Dest({ on, onClick, icon, label, disabled }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={on} className={cn('flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-semibold transition-all disabled:opacity-35', on ? 'bg-aurora-gradient text-white shadow-glow' : 'bg-white/5 ring-1 ring-white/10')}>
      {icon}
      {label}
    </button>
  );
}
