import { supabase } from './supabase';

const BUCKETS = ['avatars', 'snaps', 'stories', 'memories', 'spotlight'] as const;

/** Lists every object under a prefix (paged) so we can remove a user's files. */
async function listAll(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error || !data?.length) break;
    out.push(...data.filter((f) => f.id).map((f) => `${prefix}/${f.name}`));
    if (data.length < 100) break;
  }
  return out;
}

/**
 * Deletes the user's files from every bucket, then the account itself
 * (all database rows cascade from auth.users).
 */
export async function deleteMyAccount(userId: string) {
  for (const b of BUCKETS) {
    const files = await listAll(b, userId);
    for (let i = 0; i < files.length; i += 100) await supabase.storage.from(b).remove(files.slice(i, i + 100));
  }
  // Chat media lives under <conversation>/<user>/…; remove what the user uploaded.
  const { data: convs } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', userId);
  for (const c of convs ?? []) {
    const files = await listAll('chat-media', `${c.conversation_id}/${userId}`);
    if (files.length) await supabase.storage.from('chat-media').remove(files);
  }
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    if (/could not find|does not exist/i.test(error.message)) throw new Error('Account deletion is still being enabled on the server. Please try again later.');
    throw new Error(error.message);
  }
}
