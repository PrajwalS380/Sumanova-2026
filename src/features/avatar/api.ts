import { supabase } from '@/lib/supabase';
import { friendlyDbError } from '@/lib/chat/api';
import { normalizeAvatar, type AvatarConfig, type Outfit } from './config';

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(friendlyDbError(r.error.message));
  return r.data as T;
}

export const avatarApi = {
  async get(userId: string): Promise<AvatarConfig | null> {
    const row = must(await supabase.from('avatars').select('config').eq('user_id', userId).maybeSingle()) as { config: unknown } | null;
    return row ? normalizeAvatar(row.config) : null;
  },
  async save(userId: string, config: AvatarConfig) {
    must(await supabase.from('avatars').upsert({ user_id: userId, config }, { onConflict: 'user_id' }));
  },
  /** Publish a rendered bust as the profile photo (public avatars bucket). */
  async publishPhoto(userId: string, png: Blob) {
    const path = `${userId}/avatar3d-${Date.now()}.png`;
    const up = await supabase.storage.from('avatars').upload(path, png, { contentType: 'image/png', cacheControl: '31536000' });
    if (up.error) throw new Error(up.error.message);
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    must(await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId));
    return url;
  },
  outfits: async () => must(await supabase.from('avatar_outfits').select('id,name,outfit,created_at').order('created_at', { ascending: false })) as { id: string; name: string; outfit: Outfit }[],
  saveOutfit: async (userId: string, name: string, outfit: Outfit) => must(await supabase.from('avatar_outfits').insert({ user_id: userId, name, outfit })),
};
