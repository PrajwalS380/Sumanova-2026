import { supabase } from '@/lib/supabase';
import { friendlyDbError } from '@/lib/chat/api';

export interface SnapRecipient {
  snap_id: string;
  recipient_id: string;
  conversation_id: string | null;
  status: 'sent' | 'delivered' | 'opened' | 'replayed' | 'expired';
  delivered_at: string | null;
  opened_at: string | null;
  replayed_at: string | null;
  screenshot_at: string | null;
}

export interface SnapRow {
  id: string;
  sender_id: string;
  kind: 'image' | 'video';
  media_path: string;
  overlay_path: string | null;
  media_meta: { filter?: string; width?: number; height?: number; duration?: number };
  duration_seconds: number | null;
  allow_replay: boolean;
  created_at: string;
}

const BUCKET = 'snaps';
function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(friendlyDbError(r.error.message));
  return r.data as T;
}

export const snapsApi = {
  async upload(me: string, snapId: string, blob: Blob, overlay?: Blob | null) {
    const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('jpeg') ? 'jpg' : blob.type.includes('png') ? 'png' : blob.type.includes('mp4') ? 'mp4' : blob.type.includes('quicktime') ? 'mov' : 'webm';
    const mediaPath = `${me}/${snapId}.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(mediaPath, blob, { contentType: blob.type.split(';')[0] || 'application/octet-stream' });
    if (up.error) throw new Error(up.error.message);
    let overlayPath: string | null = null;
    if (overlay) {
      overlayPath = `${me}/${snapId}-overlay.png`;
      const o = await supabase.storage.from(BUCKET).upload(overlayPath, overlay, { contentType: 'image/png' });
      if (o.error) throw new Error(o.error.message);
    }
    return { mediaPath, overlayPath };
  },
  send: async (p: { snapId: string; kind: 'image' | 'video'; mediaPath: string; overlayPath: string | null; meta: object; duration: number | null; allowReplay: boolean; recipients: string[] }) =>
    must(await supabase.rpc('send_snap', { p_snap: p.snapId, p_kind: p.kind, p_media_path: p.mediaPath, p_overlay_path: p.overlayPath, p_meta: p.meta, p_duration: p.duration, p_allow_replay: p.allowReplay, p_recipients: p.recipients })) as number,
  get: async (id: string) => must(await supabase.from('snaps').select('*').eq('id', id).maybeSingle()) as SnapRow | null,
  recipients: async (ids: string[]) => (ids.length ? (must(await supabase.from('snap_recipients').select('*').in('snap_id', ids)) as SnapRecipient[]) : []),
  signed: async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
    if (error || !data) throw new Error('This snap is no longer available');
    return data.signedUrl;
  },
  open: async (id: string) => (must(await supabase.rpc('open_snap', { p_snap: id })) as { kind: string; duration_seconds: number | null; allow_replay: boolean }[])[0],
  replay: async (id: string) => must(await supabase.rpc('replay_snap', { p_snap: id })),
  screenshot: async (id: string) => {
    await supabase.rpc('report_snap_screenshot', { p_snap: id });
  },
  markDelivered: async () => {
    await supabase.rpc('mark_snaps_delivered');
  },
};
