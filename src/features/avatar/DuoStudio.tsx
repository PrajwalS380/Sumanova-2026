import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Send } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { chatApi, friendsApi } from '@/lib/chat/api';
import { prepareMedia, uploadMedia } from '@/lib/chat/media';
import type { Friend } from '@/lib/chat/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { hasWebGL, type AvatarConfig, type Expression, type Pose } from './config';
import { AvatarStage, type AvatarStageHandle } from './AvatarStage';
import { avatarApi } from './api';

const SCENES: { id: string; label: string; poses: [Pose, Pose]; mood: Expression }[] = [
  { id: 'hi', label: '👋 Hey there', poses: ['waving', 'waving'], mood: 'happy' },
  { id: 'party', label: '🎉 Celebrate', poses: ['celebrating', 'celebrating'], mood: 'laughing' },
  { id: 'dance', label: '💃 Dance off', poses: ['dancing', 'dancing'], mood: 'happy' },
  { id: 'chill', label: '☕ Chill', poses: ['sitting', 'sitting'], mood: 'blushing' },
  { id: 'proud', label: '👍 Proud of you', poses: ['thumbsup', 'celebrating'], mood: 'happy' },
  { id: 'walk', label: '🚶 Let’s go', poses: ['walking', 'walking'], mood: 'happy' },
  { id: 'miss', label: '🥺 Miss you', poses: ['standing', 'standing'], mood: 'sad' },
  { id: 'wow', label: '😮 No way', poses: ['standing', 'celebrating'], mood: 'surprised' },
];

/** Paired avatar scenes ("duo stickers") rendered from both friends' saved avatars. */
export default function DuoStudio() {
  const { session } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const navigate = useNavigate();
  const stage = useRef<AvatarStageHandle>(null);
  const [mine, setMine] = useState<AvatarConfig | null | undefined>(undefined);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friend, setFriend] = useState<Friend | null>(null);
  const [theirs, setTheirs] = useState<AvatarConfig | null | undefined>(undefined);
  const [scene, setScene] = useState(SCENES[0]);
  const [sending, setSending] = useState(false);
  const gl = useMemo(hasWebGL, []);

  useEffect(() => {
    void avatarApi.get(me).then(setMine).catch(() => setMine(null));
    void friendsApi.list().then(setFriends).catch(() => undefined);
  }, [me]);

  useEffect(() => {
    if (!friend) return;
    setTheirs(undefined);
    void avatarApi.get(friend.id).then(setTheirs).catch(() => setTheirs(null));
  }, [friend]);

  const configs = useMemo(() => {
    if (!mine) return [];
    const withMood = (c: AvatarConfig) => ({ ...c, expression: scene.mood });
    return friend && theirs ? [withMood(mine), withMood(theirs)] : [withMood(mine)];
  }, [mine, theirs, friend, scene]);

  async function send() {
    if (!friend || !stage.current) return;
    setSending(true);
    try {
      const png = await stage.current.capture('full');
      const conv = await chatApi.getOrCreateDirect(friend.id);
      const prepared = await prepareMedia(png);
      const clientId = crypto.randomUUID();
      const path = await uploadMedia(conv, me, clientId, prepared.blob);
      await chatApi.send({ conversation_id: conv, client_id: clientId, kind: 'image', body: scene.label, media_path: path, media_meta: prepared.meta, reply_to_id: null, forwarded: false }, me);
      haptic([10, 40, 10]);
      toast(`Sent to ${friend.display_name}`, 'success');
      navigate(`/chat/${conv}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-night">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[55vh]" style={{ background: 'radial-gradient(70% 60% at 50% 40%, rgba(251,113,133,.25), transparent 70%), radial-gradient(60% 50% at 50% 70%, rgba(139,92,246,.25), transparent 70%)' }} />
      <header className="relative z-10 flex items-center gap-2 px-3 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Back" className="glass grid h-10 w-10 place-items-center rounded-full"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 font-display text-lg font-semibold">Duo stickers</h1>
      </header>

      <div className="relative h-[44vh] shrink-0">
        {mine === undefined ? (
          <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div>
        ) : mine === null ? (
          <div className="grid h-full place-items-center px-8 text-center">
            <div>
              <p className="font-display text-lg">Create your avatar first</p>
              <Link to="/avatar" className="mt-4 inline-flex h-11 items-center rounded-2xl bg-aurora-gradient px-5 text-sm font-semibold">Open avatar studio</Link>
            </div>
          </div>
        ) : !gl ? (
          <p className="grid h-full place-items-center px-8 text-center text-sm text-ink-mute">Duo stickers need 3D graphics, which this device doesn’t support.</p>
        ) : (
          <AvatarStage ref={stage} configs={configs} poses={[scene.poses[0], scene.poses[1]]} interactive={false} className="!h-full !w-full" />
        )}
        {friend && theirs === null && <p className="absolute inset-x-0 bottom-2 text-center text-xs text-aurora-gold">{friend.display_name} hasn’t made an avatar yet — showing just you.</p>}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-28 pt-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">Scene</p>
          <div className="flex flex-wrap gap-2">
            {SCENES.map((s) => (
              <button key={s.id} onClick={() => { haptic(5); setScene(s); }} className={cn('rounded-full px-3.5 py-2 text-sm transition-all', scene.id === s.id ? 'bg-white font-semibold text-night' : 'bg-white/[0.06] text-ink-soft ring-1 ring-white/10')}>{s.label}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">With</p>
          {friends.length === 0 ? (
            <p className="text-sm text-ink-mute">Add friends to make duo stickers.</p>
          ) : (
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {friends.map((f) => (
                <button key={f.id} onClick={() => setFriend(f)} className="flex w-16 shrink-0 flex-col items-center gap-1">
                  <span className={cn('rounded-full p-0.5 transition-all', friend?.id === f.id ? 'ring-2 ring-white' : '')}><Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={54} /></span>
                  <span className="w-full truncate text-center text-[11px] text-ink-soft">{f.display_name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-strong absolute inset-x-0 bottom-0 z-20 rounded-t-[2rem] px-4 pb-safe pt-3">
        <button onClick={() => void send()} disabled={!friend || !mine || sending || !gl} className="mb-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-aurora-gradient font-semibold shadow-glow disabled:opacity-50">
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Send{friend ? ` to ${friend.display_name.split(' ')[0]}` : ''} <Send className="h-4 w-4" /></>}
        </button>
      </div>
    </div>
  );
}
