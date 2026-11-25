import { useEffect, useState } from 'react';
import { BookImage, Check, ChevronLeft, Clapperboard, Loader2, Repeat2, Search, Send, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
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

  const names = [toStory ? 'My story' : null, toMemories ? 'Memories' : null, toSpotlight ? 'Spotlight' : null, ...(friends ?? []).filter((f) => picked.has(f.id)).map((f) => f.display_name.split(' ')[0])].filter(Boolean);

  if (!prepared) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white text-ink">
      <header className="flex items-center gap-2 px-3.5 pb-3 pt-safe">
        <button onClick={onClose} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-[#F1F1F4] active:scale-90"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-center text-lg font-extrabold">Send to</h1>
        <span className="w-10" aria-hidden />
      </header>
      <div className="flex-1 overflow-y-auto pb-28">
        <div className="px-4">
          <label className="flex h-11 items-center gap-2.5 rounded-full bg-[#F1F1F4] px-3.5">
            <Search className="h-[18px] w-[18px] text-ink-mute" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search friends" aria-label="Search friends" className="flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-ink-mute" />
          </label>
        </div>

        <h2 className={H2}>Stories</h2>
        <Row on={toStory} onClick={() => setToStory((v) => !v)} icon={<Sparkles className="h-[22px] w-[22px]" />} tint="bg-ember-flame/[0.12] text-ember-flame" title="My story" sub="Visible for 24 hours" />
        {toStory && <div className="px-4 pb-2"><AudiencePicker value={audience} onChange={setAudience} /></div>}
        <Row on={toMemories} onClick={() => setToMemories((v) => !v)} icon={<BookImage className="h-[22px] w-[22px]" />} tint="bg-[#d8f5ea] text-ember-jade" title="Memories" sub="Only you can see these" />
        {prepared.kind === 'video' && <Row on={toSpotlight} onClick={() => setToSpotlight((v) => !v)} icon={<Clapperboard className="h-[22px] w-[22px]" />} tint="bg-[#fff1e6] text-[#C2410C]" title="Spotlight" sub="Public to everyone on SUMANOVA" />}
        {toSpotlight && prepared.kind === 'video' && (
          <div className="space-y-2 px-4 pb-2">
            <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 300))} placeholder="Add a caption for Spotlight" className="h-11 w-full rounded-full bg-[#F1F1F4] px-4 text-[15px] outline-none" />
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize', category === c ? 'bg-ink text-white' : 'bg-[#F1F1F4]')}>{c}</button>
              ))}
            </div>
          </div>
        )}

        <h2 className={H2}>Recents</h2>
        {friends === null ? (
          <div className="grid h-20 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-mute" /></div>
        ) : friends.length === 0 ? (
          <p className="px-4 py-5 text-sm text-ink-mute">Add friends to send snaps.</p>
        ) : (
          list.map((f) => (
            <button key={f.id} onClick={() => toggle(f.id)} aria-pressed={picked.has(f.id)} className={cn('flex w-full items-center gap-3 px-4 py-2 text-left active:bg-ink/[0.04]', GHOST_HOST)}>
              <Ghost url={f.avatar_url} />
              <Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={48} />
              <span className="min-w-0 flex-1"><span className="block truncate font-extrabold">{f.display_name}</span><span className="block truncate text-xs text-ink-mute">@{f.username}</span></span>
              <Tick on={picked.has(f.id)} />
            </button>
          ))
        )}
        {picked.size > 0 && (
          <div className="mx-4 mt-3 overflow-hidden rounded-2xl bg-[#ECECEF]">
            <Toggle label="Allow one replay" description="They can replay once within 5 minutes of opening" checked={replay} onChange={setReplay} />
            <p className="flex items-center gap-1.5 px-4 pb-3 text-xs text-ink-mute">
              <Repeat2 className="h-3.5 w-3.5" /> {prepared.kind === 'image' ? (prepared.duration ? `Shows for ${prepared.duration}s` : 'No time limit') : 'Plays once through'} · opens once
            </p>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-ember-flame px-4 pb-[max(1.75rem,var(--safe-bottom))] pt-3.5 text-white">
        <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{names.length ? names.join(', ') : 'Pick friends or your story'}</span>
        <button onClick={() => void send()} disabled={!anything || sending} aria-label="Send" className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white text-ember-flame disabled:opacity-60">
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-[22px] w-[22px]" />}
        </button>
      </div>
    </div>
  );
}

const H2 = 'px-4 pb-1 pt-3.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-mute';

function Tick({ on }: { on: boolean }) {
  return (
    <span className={cn('grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-2', on ? 'border-ember-flame bg-ember-flame text-white' : 'border-[#c3cbe0]')}>
      {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );
}

function Row({ on, onClick, icon, tint, title, sub }: { on: boolean; onClick: () => void; icon: React.ReactNode; tint: string; title: string; sub: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="flex w-full items-center gap-3 px-4 py-2 text-left active:bg-ink/[0.04]">
      <span className={cn('grid h-12 w-12 place-items-center rounded-full', tint)}>{icon}</span>
      <span className="min-w-0 flex-1"><span className="block font-extrabold">{title}</span><span className="block text-xs text-ink-mute">{sub}</span></span>
      <Tick on={on} />
    </button>
  );
}

