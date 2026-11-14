import { supabase } from '@/lib/supabase';
import { friendlyDbError } from '@/lib/chat/api';
import { normalizeLook, type Look, type Slot, type ColorKey } from './look/config';

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(friendlyDbError(r.error.message));
  return r.data as T;
}

/** A saved wardrobe look: only the fashion slots and their colours. */
export interface SavedOutfit {
  pick: Partial<Record<Slot, number | null>>;
  color: Partial<Record<ColorKey, string | null>>;
}
export const FASHION_SLOTS: Slot[] = ['top', 'outer', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'hat', 'glasses'];

export const avatarApi = {
  async get(userId: string): Promise<Look | null> {
    const row = must(await supabase.from('avatars').select('config').eq('user_id', userId).maybeSingle()) as { config: unknown } | null;
    return row ? normalizeLook(row.config) : null;
  },
  async save(userId: string, look: Look) {
    must(await supabase.from('avatars').upsert({ user_id: userId, config: look }, { onConflict: 'user_id' }));
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
  outfits: async () => {
    const rows = must(await supabase.from('avatar_outfits').select('id,name,outfit,created_at').order('created_at', { ascending: false })) as { id: string; name: string; outfit: unknown }[];
    // Older rows used a different shape; only keep the ones that are v2 outfits.
    return rows.filter((r) => typeof r.outfit === 'object' && r.outfit !== null && 'pick' in (r.outfit as object)).map((r) => ({ id: r.id, name: r.name, outfit: r.outfit as SavedOutfit }));
  },
  saveOutfit: async (userId: string, name: string, outfit: SavedOutfit) => must(await supabase.from('avatar_outfits').insert({ user_id: userId, name, outfit })),
};
