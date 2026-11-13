import { supabase } from './supabase';

/** Short-lived signed URLs for private buckets, cached and de-duplicated. */
const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string>>();

export function privateUrl(bucket: string, path: string, ttl = 3600): Promise<string> {
  const key = `${bucket}/${path}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now() + 60_000) return Promise.resolve(hit.url);
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttl)
    .then(({ data, error }) => {
      inflight.delete(key);
      if (error || !data) throw new Error('Media unavailable');
      cache.set(key, { url: data.signedUrl, exp: Date.now() + ttl * 1000 });
      if (cache.size > 400) cache.delete(cache.keys().next().value as string);
      return data.signedUrl;
    })
    .catch((e) => {
      inflight.delete(key);
      throw e;
    });
  inflight.set(key, p);
  return p;
}

export function publicUrl(bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function extFor(type: string) {
  const t = type.split(';')[0];
  return ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' } as Record<string, string>)[t] ?? 'bin';
}

export async function uploadTo(bucket: string, path: string, blob: Blob) {
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type.split(';')[0] || 'application/octet-stream', cacheControl: '3600' });
  if (error) throw new Error(error.message);
  return path;
}
