// SUMANOVA instant sign-up (Supabase Edge Function, free tier).
// POST { email, password, username, display_name, date_of_birth }
//
// Creates an already-confirmed account so people can join without an email code
// (the free built-in mailer only reaches the project team). Every field is
// re-validated here with the same rules as the app and the database. A global
// hourly cap limits abuse. The client signs in with the password afterwards.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

const MAX_PER_HOUR = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

function age(dob: string) {
  const d = new Date(dob + 'T00:00:00Z');
  const t = new Date();
  let a = t.getUTCFullYear() - d.getUTCFullYear();
  const m = t.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && t.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json(400, { error: 'Invalid request' });
  }
  const email = String(b.email ?? '').trim().toLowerCase();
  const password = String(b.password ?? '');
  const username = String(b.username ?? '').trim().toLowerCase();
  const display = String(b.display_name ?? '').trim();
  const dob = String(b.date_of_birth ?? '');

  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { error: 'Enter a valid email' });
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return json(400, { error: 'Password needs 8+ characters with letters and numbers' });
  if (!USERNAME_RE.test(username) || /^[._]|[._]$/.test(username)) return json(400, { error: 'That username isn’t allowed' });
  if (!display || display.length > 40) return json(400, { error: 'Tell us your name (up to 40 characters)' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob)) || age(dob) < 13) return json(400, { error: 'You must be at least 13' });

  // Global throttle (cheap abuse guard on the free tier).
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if ((count ?? 0) >= MAX_PER_HOUR) return json(429, { error: 'Lots of people are joining right now — try again in a few minutes' });

  const { data: taken } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
  if (taken) return json(409, { error: 'That username is taken' });

  const { error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: display, date_of_birth: dob } });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('already') || m.includes('registered') || m.includes('exists')) return json(409, { error: 'An account with this email already exists — sign in instead' });
    return json(400, { error: 'Couldn’t create the account. Please try again.' });
  }
  return json(200, { ok: true });
});
