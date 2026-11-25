import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ChevronLeft, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { avatarApi } from '@/features/avatar/api';
import { AURA, type AuraColor } from '@/lib/types';
import { cn } from '@/lib/cn';

/** Center-crop any picture to a 512×512 JPEG (small enough for the 2 MB bucket limit). */
async function squareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 512, 512);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not read that picture'))), 'image/jpeg', 0.86));
}

/** Profile picture (wireframe 6c): avatar face on a colour of your choice, or a selfie / gallery photo. */
export default function ProfilePhotoScreen() {
  const { profile, setProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const selfie = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!profile) return null;
  const me = profile;

  async function run(label: string, fn: () => Promise<void>, ok: string) {
    setBusy(label);
    try {
      await fn();
      toast(ok, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void run('photo', async () => {
      const url = await avatarApi.usePhoto(me.id, await squareJpeg(file));
      setProfile({ ...me, avatar_url: url, photo_mode: true });
    }, 'Profile picture updated');
  };

  const pickAura = (a: AuraColor) =>
    void run('aura', async () => {
      await avatarApi.setLook(me.id, { aura_color: a });
      setProfile({ ...me, aura_color: a });
    }, 'Colour saved');

  const useFace = () =>
    void run('face', async () => {
      const face = me.avatar_face_url ?? null;
      await avatarApi.useAvatarFace(me.id, face);
      setProfile({ ...me, avatar_url: face, photo_mode: false });
    }, 'Back to your avatar face');

  const row = cn('flex w-full items-center gap-3 rounded-tile bg-white p-3.5 text-left font-extrabold disabled:opacity-60', GHOST_HOST);

  return (
    <div className="min-h-full bg-noir pb-10">
      <header className="flex items-center gap-2 px-3.5 pb-2 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-2xl bg-white active:scale-90"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-center text-lg font-extrabold">Profile picture</h1>
        <span className="w-10" />
      </header>
      <div className="mx-auto max-w-md px-3.5">
        <div className="flex flex-col items-center pt-2">
          <span className="rounded-full bg-white p-1.5"><Avatar name={me.display_name} url={me.avatar_url} aura={me.aura_color} size={150} /></span>
          <p className="mt-2.5 text-center text-[13px] font-semibold text-ink-mute">{me.photo_mode ? 'Using a photo' : 'Using your avatar face'} — friends see this in chats, stories and the map</p>
        </div>

        <h2 className="eyebrow mt-5 px-1">Avatar face · background colour</h2>
        <div className="mt-2 grid grid-cols-6 gap-2" role="radiogroup" aria-label="Background colour">
          {(Object.keys(AURA) as AuraColor[]).map((a) => (
            <button key={a} role="radio" aria-checked={me.aura_color === a} aria-label={AURA[a].label} disabled={!!busy} onClick={() => pickAura(a)} className={cn('grid aspect-square place-items-center rounded-full bg-white', me.aura_color === a && 'ring-[3px] ring-ink')}>
              <Avatar name={me.display_name} url={me.avatar_face_url ?? (me.photo_mode ? null : me.avatar_url)} aura={a} size={46} />
            </button>
          ))}
        </div>
        {me.photo_mode && (
          <button onClick={useFace} disabled={!!busy} className={cn(row, 'mt-2')}>
            <Ghost url={me.avatar_face_url} />
            <Avatar name={me.display_name} url={me.avatar_face_url} aura={me.aura_color} size={42} />
            <span className="flex-1">Use my avatar face</span>
            {busy === 'face' && <Loader2 className="h-4 w-4 animate-spin" />}
          </button>
        )}

        <h2 className="eyebrow mt-5 px-1">Or use a photo</h2>
        <div className="mt-2 flex flex-col gap-2">
          <button onClick={() => selfie.current?.click()} disabled={!!busy} className={row}>
            <Ghost><Camera className="h-full w-full" strokeWidth={1.4} /></Ghost>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#111111] text-white"><Camera className="h-5 w-5" /></span>
            <span className="flex-1">Take a selfie<span className="block text-xs font-semibold text-ink-mute">Front camera, square crop</span></span>
            {busy === 'photo' && <Loader2 className="h-4 w-4 animate-spin" />}
          </button>
          <button onClick={() => gallery.current?.click()} disabled={!!busy} className={row}>
            <Ghost><ImageIcon className="h-full w-full" strokeWidth={1.4} /></Ghost>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#D8F5EA] text-ember-jade"><ImageIcon className="h-5 w-5" /></span>
            <span className="flex-1">Choose from gallery<span className="block text-xs font-semibold text-ink-mute">Any photo on your phone</span></span>
          </button>
          {me.photo_mode && (
            <button onClick={useFace} disabled={!!busy} className={cn(row, 'text-[#B42318]')}>
              <Ghost><Trash2 className="h-full w-full" strokeWidth={1.4} /></Ghost>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FFE4E1]"><Trash2 className="h-5 w-5" /></span>
              <span className="flex-1">Remove photo<span className="block text-xs font-semibold text-ink-mute">Go back to your avatar face</span></span>
            </button>
          )}
        </div>
        <input ref={selfie} type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} />
        <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
    </div>
  );
}
