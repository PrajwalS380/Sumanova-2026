import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Image as ImageIcon, Paintbrush, Shirt, Sparkles, Users } from 'lucide-react';
import { AvatarFigure } from '@/components/AvatarFigure';
import { Scene, SCENES } from '@/components/Scene';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { haptic } from '@/lib/haptics';
import type { SceneId } from '@/lib/types';
import { cn } from '@/lib/cn';
import { avatarApi } from './api';

const ACTIONS = [
  { to: '/avatar', label: 'Edit look', sub: 'Hair, face, outfit', icon: Paintbrush, bg: 'bg-[#111111] text-white' },
  { to: '/avatar?mode=saved', label: 'Try a new look', sub: 'Characters & saved outfits', icon: Sparkles, bg: 'bg-ember-rose text-white' },
  { to: '/avatar/duo', label: 'Duo', sub: 'Pose with a friend', icon: Users, bg: 'bg-ember-sky text-white' },
  { to: '/profile/photo', label: 'Profile picture', sub: 'Avatar face or selfie', icon: ImageIcon, bg: 'bg-white text-ink' },
];

/** My avatar (wireframe 8): my full-body avatar in my scene, scene picker, ways to restyle. */
export default function AvatarHomeScreen() {
  const { profile, setProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const scene = profile.profile_scene ?? 'dusk';

  async function pickScene(id: SceneId) {
    if (!profile || id === scene || busy) return;
    haptic(8);
    const before = profile;
    setProfile({ ...profile, profile_scene: id });
    setBusy(true);
    try {
      await avatarApi.setLook(profile.id, { profile_scene: id });
    } catch (e) {
      setProfile(before);
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-noir pb-10">
      <div className="relative h-[430px]">
        <Scene id={scene} className="absolute inset-0" />
        <header className="relative z-10 flex items-center gap-2 px-3.5 pt-safe">
          <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-2xl bg-white/90 active:scale-90"><ChevronLeft className="h-5 w-5" /></button>
          <h1 className="flex-1 text-center text-lg font-extrabold text-ink"><span className="rounded-xl bg-white/90 px-3 py-1.5">My avatar</span></h1>
          <Link to="/avatar" className="rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-extrabold text-white">Edit</Link>
        </header>
        <Link to="/avatar" aria-label="Edit my avatar" className="absolute bottom-0 left-1/2 -translate-x-1/2 active:scale-[0.98]">
          <AvatarFigure name={profile.display_name} bodyUrl={profile.avatar_body_url} faceUrl={profile.avatar_face_url ?? profile.avatar_url} aura={profile.aura_color} height={340} />
        </Link>
      </div>

      <div className="mx-auto max-w-md px-3.5 pt-3">
        <h2 className="eyebrow px-1">Scene</h2>
        <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Profile scene">
          {SCENES.map((s) => (
            <button key={s.id} role="radio" aria-checked={scene === s.id} onClick={() => void pickScene(s.id)} className={cn('overflow-hidden rounded-2xl bg-white p-1 text-[11px] font-extrabold transition-shadow', scene === s.id ? 'ring-[3px] ring-ink' : '')}>
              <Scene id={s.id} className="h-14 rounded-xl" />
              <span className="block py-1">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {ACTIONS.map((a) => (
            <Link key={a.label} to={a.to} className={cn('rounded-tile p-3.5', a.bg, GHOST_HOST)}>
              <Ghost size={96} opacity={0.14} className="-bottom-6 -right-5 top-auto"><a.icon className="h-full w-full" strokeWidth={1.4} /></Ghost>
              <a.icon className="h-6 w-6" />
              <span className="mt-6 block text-[17px] font-black tracking-tight">{a.label}</span>
              <span className="block text-xs font-semibold opacity-75">{a.sub}</span>
            </Link>
          ))}
        </div>
        <Link to="/avatar" className={cn('mt-2 flex items-center gap-3 rounded-tile bg-white p-3.5', GHOST_HOST)}>
          <Ghost size={96} opacity={0.08} className="-right-4 -top-5"><Shirt className="h-full w-full" strokeWidth={1.4} /></Ghost>
          <Shirt className="h-6 w-6" />
          <span className="flex-1"><span className="block font-extrabold">Wardrobe</span><span className="block text-xs text-ink-mute">Hundreds of original outfits — all free</span></span>
        </Link>
      </div>
    </div>
  );
}
