import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Check, Trash2 } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { supabase } from '@/lib/supabase';
import { squareAvatar } from '@/lib/image';
import { AURA, type AuraColor, type Profile } from '@/lib/types';
import { firstError, profileSchema } from '@/lib/validation';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';

export default function EditProfileScreen() {
  const { profile, setProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [aura, setAura] = useState<AuraColor>(profile?.aura_color ?? 'violet');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  if (!profile) return null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast('That image is too large (max 15 MB)', 'error');
    setUploading(true);
    try {
      const blob = await squareAvatar(file);
      const path = `${profile!.id}/avatar-${Date.now()}.webp`;
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err) {
      toast((err as Error).message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse({ displayName, bio });
    setErrors(firstError(parsed));
    if (!parsed.success) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: parsed.data.displayName, bio: parsed.data.bio.trim() || null, aura_color: aura, avatar_url: avatarUrl })
      .eq('id', profile!.id)
      .select()
      .single();
    setBusy(false);
    if (error) return toast(error.message, 'error');
    // Remove superseded avatar files (best effort).
    if (profile!.avatar_url && profile!.avatar_url !== avatarUrl) {
      const old = profile!.avatar_url.split('/avatars/')[1];
      if (old) void supabase.storage.from('avatars').remove([old]);
    }
    setProfile(data as Profile);
    toast('Profile updated', 'success');
    navigate(-1);
  }

  return (
    <div className="pb-16">
      <ScreenHeader title="Edit profile" back />
      <form onSubmit={save} className="mx-auto max-w-sm space-y-6 px-5" noValidate>
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative active:scale-95" aria-label="Change photo">
            <Avatar name={displayName || profile.display_name} url={avatarUrl} aura={aura} size={112} />
            <span className={cn('absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full bg-aurora-gradient ring-4 ring-night', uploading && 'animate-pulse')}>
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
          {avatarUrl && (
            <button type="button" onClick={() => setAvatarUrl(null)} className="mt-3 flex items-center gap-1 text-xs text-ink-mute hover:text-aurora-coral">
              <Trash2 className="h-3.5 w-3.5" /> Remove photo
            </button>
          )}
        </div>

        <div className="space-y-3">
          <Field label="Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} error={errors.displayName} maxLength={40} />
          <div>
            <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-aurora-iris/70">
              <label htmlFor="bio" className="block px-4 pt-2 text-[11px] font-medium uppercase tracking-wider text-ink-mute">
                Bio
              </label>
              <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} className="block w-full resize-none bg-transparent px-4 pb-3 pt-1 text-ink outline-none" placeholder="A line about you" />
            </div>
            <p className="mt-1 px-1 text-right text-xs text-ink-faint">{bio.length}/160</p>
          </div>
          <p className="px-1 text-xs text-ink-mute">Username @{profile.username} is permanent for now.</p>
        </div>

        <div>
          <p className="mb-3 px-1 text-sm font-medium">Aura colour</p>
          <div className="flex justify-between">
            {(Object.keys(AURA) as AuraColor[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  haptic(5);
                  setAura(k);
                }}
                aria-label={AURA[k].label}
                aria-pressed={aura === k}
                className={cn('grid h-11 w-11 place-items-center rounded-full transition-transform', aura === k ? 'scale-110 ring-2 ring-white' : 'ring-1 ring-white/10')}
                style={{ background: `linear-gradient(135deg, ${AURA[k].from}, ${AURA[k].to})` }}
              >
                {aura === k && <Check className="h-5 w-5 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" block size="lg" loading={busy} disabled={uploading}>
          Save changes
        </Button>
      </form>
    </div>
  );
}
