// SUMANOVA link previews (Supabase Edge Function, free tier). POST { url } with the user's JWT.
// Fetches the page server-side (so the person's phone doesn't open unknown sites), reads its
// title / description / image tags and caches the result in public.link_previews for 7 days.
// Guards: http(s) only, default ports, public IP addresses only (checked on every redirect),
// 5 s timeout, first 512 KB of HTML only.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

function privateV4(ip: string) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}
function privateV6(ip: string) {
  const s = ip.toLowerCase();
  if (s === '::' || s === '::1') return true;
  if (s.startsWith('::ffff:')) return privateV4(s.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s) || s.startsWith('64:ff9b') || s.startsWith('2001:db8');
}
async function safeHost(host: string) {
  if (/^[\d.]+$/.test(host)) return !privateV4(host);
  if (host.includes(':') || host.startsWith('[')) return false; // no raw IPv6 literals
  if (!host.includes('.') || /\.(local|internal|localhost)$/i.test(host) || host === 'localhost') return false;
  const v4 = await Deno.resolveDns(host, 'A').catch(() => [] as string[]);
  const v6 = await Deno.resolveDns(host, 'AAAA').catch(() => [] as string[]);
  if (!v4.length && !v6.length) return false;
  return v4.every((ip) => !privateV4(ip)) && v6.every((ip) => !privateV6(ip));
}
function checkUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.port && u.port !== '80' && u.port !== '443') return null;
    if (u.username || u.password) return null;
    u.hash = '';
    return u;
  } catch {
    return null;
  }
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) % 0x110000)).replace(/\s+/g, ' ').trim();
function meta(html: string, names: string[]) {
  for (const n of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (c) return decode(c);
  }
  return null;
}

async function fetchPage(start: URL) {
  let u = start;
  for (let hop = 0; hop < 4; hop++) {
    if (!(await safeHost(u.hostname))) throw new Error('blocked host');
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(u, { redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': 'SUMANOVA-LinkPreview/1.0', accept: 'text/html,application/xhtml+xml' } }).finally(() => clearTimeout(t));
    if (r.status >= 300 && r.status < 400) {
      const next = checkUrl(new URL(r.headers.get('location') ?? '', u).toString());
      await r.body?.cancel();
      if (!next) throw new Error('bad redirect');
      u = next;
      continue;
    }
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('html')) {
      await r.body?.cancel();
      throw new Error('not a page');
    }
    const reader = r.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < 512 * 1024) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      // the tags we need are in <head>
      if (new TextDecoder().decode(value).includes('</head>')) break;
    }
    await reader.cancel().catch(() => undefined);
    const buf = new Uint8Array(size);
    let o = 0;
    for (const c of chunks) {
      buf.set(c.subarray(0, Math.min(c.length, size - o)), o);
      o += c.length;
    }
    return { html: new TextDecoder().decode(buf), final: u };
  }
  throw new Error('too many redirects');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  // signed-in users only
  const auth = req.headers.get('authorization') ?? '';
  const { data: who } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!who?.user) return json(401, { error: 'Sign in first' });

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid request' });
  }
  const u = checkUrl(String(body.url ?? '').slice(0, 2048));
  if (!u) return json(400, { error: 'Not a web link' });
  const key = u.toString();

  const { data: cached } = await admin.from('link_previews').select('*').eq('url', key).maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < 7 * 864e5) return json(200, cached);

  let row: Record<string, unknown> = { url: key, ok: false, title: null, description: null, image: null, site: u.hostname.replace(/^www\./, ''), fetched_at: new Date().toISOString() };
  try {
    const { html, final } = await fetchPage(u);
    const title = meta(html, ['og:title', 'twitter:title']) ?? (html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)![1]) : null);
    const description = meta(html, ['og:description', 'twitter:description', 'description']);
    let image = meta(html, ['og:image', 'og:image:url', 'twitter:image']);
    if (image) {
      const iu = checkUrl(new URL(image, final).toString());
      image = iu && iu.protocol === 'https:' ? iu.toString() : null;
    }
    const site = meta(html, ['og:site_name']) ?? final.hostname.replace(/^www\./, '');
    row = { ...row, ok: !!title, title: title?.slice(0, 200) ?? null, description: description?.slice(0, 300) ?? null, image: image?.slice(0, 1000) ?? null, site: site.slice(0, 80) };
  } catch {
    /* unreachable / blocked: cache the miss so we don't retry for a week */
  }
  await admin.from('link_previews').upsert(row);
  return json(200, row);
});
