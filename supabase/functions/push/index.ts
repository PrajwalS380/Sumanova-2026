// SUMANOVA push sender (Supabase Edge Function, free tier).
// GET  -> { publicKey }  (VAPID public key for the browser to subscribe with)
// POST -> { kind: 'notification' | 'message' | 'call', id }
//   Called by database triggers via pg_net. The body carries only an id; everything
//   else is re-read here with the service role, and only fresh, unsent items are
//   pushed — so calling this endpoint can't be abused to send arbitrary content.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };

type Cfg = { public_key: string; private_key: string; subject: string };
let cfg: Cfg | null = null;

async function config(): Promise<Cfg> {
  if (cfg) return cfg;
  let { data } = await sb.rpc('push_config');
  let row = (data as Cfg[] | null)?.[0];
  if (!row?.private_key) {
    const keys = webpush.generateVAPIDKeys();
    await sb.rpc('init_push_keys', { p_public: keys.publicKey, p_private: keys.privateKey });
    ({ data } = await sb.rpc('push_config'));
    row = (data as Cfg[] | null)?.[0];
  }
  if (!row?.private_key) throw new Error('push keys unavailable');
  webpush.setVapidDetails(row.subject, row.public_key, row.private_key);
  cfg = row;
  return row;
}

type Payload = { title: string; body?: string | null; url?: string | null; tag?: string; requireInteraction?: boolean };

async function sendToUser(userId: string, payload: Payload, ttl = 3600, urgency: 'normal' | 'high' = 'normal') {
  const { data: subs } = await sb.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: ttl, urgency });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', s.id); // subscription expired
    }
  }
  return sent;
}

const fresh = (iso: string, seconds: number) => Date.now() - new Date(iso).getTime() < seconds * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const c = await config();
    if (req.method === 'GET') return Response.json({ publicKey: c.public_key }, { headers: cors });
    const { kind, id } = await req.json();
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return new Response('bad request', { status: 400, headers: cors });

    if (kind === 'notification') {
      const { data: n } = await sb.from('notifications').select('*').eq('id', id).maybeSingle();
      if (!n || n.pushed_at || !fresh(n.created_at, 300)) return Response.json({ skipped: true }, { headers: cors });
      await sendToUser(n.user_id, { title: n.title, body: n.body, url: n.url ?? '/', tag: n.kind });
      await sb.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', id);
      return Response.json({ ok: true }, { headers: cors });
    }

    if (kind === 'message') {
      const { data: m } = await sb.from('messages').select('id,conversation_id,sender_id,kind,body,created_at').eq('id', id).maybeSingle();
      if (!m || !m.sender_id || !fresh(m.created_at, 60)) return Response.json({ skipped: true }, { headers: cors });
      const [{ data: conv }, { data: members }, { data: sender }] = await Promise.all([
        sb.from('conversations').select('kind,title').eq('id', m.conversation_id).maybeSingle(),
        sb.from('conversation_members').select('user_id,muted').eq('conversation_id', m.conversation_id),
        sb.from('profiles').select('display_name').eq('id', m.sender_id).maybeSingle(),
      ]);
      const who = sender?.display_name ?? 'Someone';
      const preview = m.kind === 'text' ? (m.body ?? '').slice(0, 140) : ({ image: '📷 Photo', video: '🎬 Video', voice: '🎙️ Voice note', sticker: `${m.body ?? ''} Sticker`, snap: '✦ New snap' } as Record<string, string>)[m.kind] ?? 'New message';
      const title = conv?.kind === 'group' ? `${who} · ${conv.title}` : who;
      for (const mem of members ?? []) {
        if (mem.user_id === m.sender_id || mem.muted) continue;
        await sendToUser(mem.user_id, { title, body: preview, url: `/chat/${m.conversation_id}`, tag: m.conversation_id }, 3600, 'high');
      }
      return Response.json({ ok: true }, { headers: cors });
    }

    if (kind === 'call') {
      const { data: call } = await sb.from('calls').select('id,kind,status,caller_id,started_at').eq('id', id).maybeSingle();
      if (!call || call.status !== 'ringing' || !fresh(call.started_at, 45)) return Response.json({ skipped: true }, { headers: cors });
      const [{ data: callee }, { data: caller }] = await Promise.all([
        sb.from('call_participants').select('user_id').eq('call_id', id).eq('role', 'callee').maybeSingle(),
        sb.from('profiles').select('display_name').eq('id', call.caller_id).maybeSingle(),
      ]);
      if (callee) await sendToUser(callee.user_id, { title: `Incoming ${call.kind} call`, body: `${caller?.display_name ?? 'Someone'} is calling you`, url: '/', tag: `call-${id}`, requireInteraction: true }, 45, 'high');
      return Response.json({ ok: true }, { headers: cors });
    }
    return new Response('unknown kind', { status: 400, headers: cors });
  } catch (e) {
    console.error('[push]', e);
    return new Response('error', { status: 500, headers: cors });
  }
});
