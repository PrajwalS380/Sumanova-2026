/**
 * Responsive audit: opens every signed-in screen at narrow phone widths against a mocked
 * backend and reports anything that sticks out past the screen edge (the bug that hid the
 * send button on curved / narrow phones).
 *
 *   VITE_SUPABASE_URL=https://mock.supabase.test VITE_SUPABASE_PUBLISHABLE_KEY=x npx vite build --outDir <dir>
 *   node e2e/responsive.e2e.cjs <dir> [outDirForScreenshots]
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = process.argv[2];
const SHOTS = process.argv[3];
const ME = '11111111-1111-4111-8111-111111111111';
const PEER = '22222222-2222-4222-8222-222222222222';
const CONV = '33333333-3333-4333-8333-333333333333';
const now = Date.now();
const iso = (m) => new Date(now - m * 60000).toISOString();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(now / 1000) + 86400 * 30;
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME, exp, aal: 'aal1', amr: [{ method: 'password', timestamp: 1 }], role: 'authenticated', session_id: 's' })}.sig`;
const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'me@example.test', app_metadata: {}, user_metadata: {}, factors: [], created_at: iso(9999) };
const profile = { id: ME, username: 'averyverylongusername_2026', display_name: 'Prajwal With A Fairly Long Display Name', avatar_url: null, aura_color: 'rose', bio: 'Hi', birthday: '2000-01-01', snap_score: 12345, profile_scene: null, created_at: iso(9999) };
const peer = { id: PEER, username: 'itursh19', display_name: 'Shru', avatar_url: null, aura_color: 'violet' };
const msg = (i, sender, kind, body, extra = {}) => ({ id: `44444444-4444-4444-8444-${String(i).padStart(12, '0')}`, conversation_id: CONV, sender_id: sender, client_id: `c${i}`, kind, body, media_path: null, media_meta: {}, reply_to_id: null, forwarded: false, disappear_mode: 'never', expires_at: null, edited_at: null, deleted_at: null, created_at: iso(60 - i), ...extra });
const messages = [
  msg(1, PEER, 'text', 'Hey! how are you doing today, this is a reasonably long message to test wrapping across the bubble width'),
  msg(2, ME, 'text', 'https://example.com/a/really/long/link/without/any/spaces/that/should/never/widen/the/screen/0123456789'),
  msg(3, ME, 'sticker', 'nova:party'),
  msg(4, PEER, 'text', 'Supercalifragilisticexpialidocious_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  msg(5, ME, 'text', 'Deleted', { deleted_at: iso(1) }),
  msg(6, PEER, 'poll', 'Where should we go this weekend with everyone?'),
  msg(7, ME, 'text', 'ok 👍'),
].reverse();
const convSummary = { id: CONV, kind: 'direct', title: null, avatar_url: null, disappear_mode: 'never', last_message_at: iso(1), pinned: false, muted: false, favourite: false, theme: 'aurora', role: 'member', other_user_id: PEER, other_username: peer.username, other_display_name: peer.display_name, other_avatar_url: null, other_aura: peer.aura_color, member_count: 2, unread_count: 3, last_body: 'A very long last message preview that should be truncated rather than pushing the row wider than the screen', last_kind: 'text', last_sender_id: PEER, last_deleted: false, last_created_at: iso(1) };
const friend = { id: PEER, username: peer.username, display_name: peer.display_name, avatar_url: null, aura_color: peer.aura_color, streak_count: 12, best_friend: true, since: iso(9999) };

function table(name, wantsObject) {
  const one = (o) => (wantsObject ? o : [o]);
  switch (name) {
    case 'profiles': return wantsObject ? profile : [profile, peer];
    case 'user_settings': return one({ user_id: ME, reduce_motion: false, haptics: true, theme: 'light' });
    case 'privacy_settings': return one({ user_id: ME, show_birthday: true, map_visibility: 'friends', who_can_message: 'friends' });
    case 'conversations': return one({ id: CONV, kind: 'direct', title: null, avatar_url: null, disappear_mode: 'never', created_at: iso(9999), created_by: ME });
    case 'conversation_members': return [{ conversation_id: CONV, user_id: ME, role: 'member', last_read_at: iso(0), last_delivered_at: iso(0), joined_at: iso(9999) }, { conversation_id: CONV, user_id: PEER, role: 'member', last_read_at: iso(0), last_delivered_at: iso(0), joined_at: iso(9999) }];
    case 'messages': return wantsObject ? null : messages;
    default: return wantsObject ? null : [];
  }
}
function rpc(name) {
  if (name === 'list_conversations') return [convSummary];
  if (name === 'list_friends') return [friend];
  return [];
}

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, resp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      let f = path.join(DIST, p);
      if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
      const ext = path.extname(f);
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' }[ext] || 'application/octet-stream';
      resp.writeHead(200, { 'content-type': type });
      fs.createReadStream(f).pipe(resp);
    });
    srv.listen(0, () => res(srv));
  });
}

const ROUTES = ['/', '/chat', `/chat/${CONV}`, `/chat/${CONV}/info`, '/friends', '/birthdays', '/trophies', '/albums', '/calls', '/notifications', '/avatar/home', '/stories', '/stories/archive', `/u/${peer.username}`, '/map', '/spotlight', '/memories', '/profile', '/profile/edit', '/profile/photo', '/profile/code', '/settings', '/accounts', '/onboarding/avatar'];
const AUTH_ROUTES = ['/auth/welcome', '/auth/sign-in', '/auth/sign-up', '/auth/forgot', '/auth/two-step'];
const WIDTHS = [320, 360, 393];
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

(async () => {
  const srv = await serve();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  let problems = 0;
  for (const signedIn of [true, false]) {
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: true, isMobile: true });
      await ctx.route('https://mock.supabase.test/**', async (route) => {
        const u = new URL(route.request().url());
        const accept = route.request().headers()['accept'] || '';
        const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
        if (u.pathname.startsWith('/auth/v1/user')) return json(user);
        if (u.pathname.startsWith('/auth/v1/factors')) return json([]);
        if (u.pathname.startsWith('/auth/v1')) return json({});
        if (u.pathname.startsWith('/rest/v1/rpc/')) return json(rpc(u.pathname.split('/').pop()));
        if (u.pathname.startsWith('/rest/v1/')) return json(table(u.pathname.split('/').pop(), accept.includes('vnd.pgrst.object')));
        return route.fulfill({ status: 404, body: '' });
      });
      await ctx.route(/tile\.openstreetmap\.org|overpass/, (r) => r.fulfill({ status: 404, body: '' }));
      if (signedIn) {
        await ctx.addInitScript(([s]) => {
          localStorage.setItem('sb-mock-auth-token', s);
          localStorage.setItem('snv-onboarded', '1');
        }, [JSON.stringify({ access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp, user })]);
      }
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('    pageerror:', String(e.message).slice(0, 200)));
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|WebSocket|net::/.test(m.text())) console.log('    console:', m.text().slice(0, 300)); });
      for (const r of (signedIn ? ROUTES : AUTH_ROUTES).filter((x) => !ONLY || ONLY.test(x))) {
        await page.goto(base + r, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
        await page.waitForTimeout(1600);
        if (r.startsWith('/chat/') && !r.endsWith('info')) {
          // Type a long message so the "send" state is measured too.
          await page.locator('textarea[aria-label="Message"]').fill('typing a message to show the send button').catch(() => undefined);
          await page.waitForTimeout(400);
        }
        const res = await page.evaluate((W) => {
          const out = [];
          const docW = document.documentElement.scrollWidth;
          for (const el of document.querySelectorAll('body *')) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' && el.closest('[aria-hidden]')) continue;
            const b = el.getBoundingClientRect();
            if (b.width === 0 || b.height === 0) continue;
            // Skip things inside a horizontal scroller (rails are meant to scroll) or clipped by an ancestor.
            let clipped = false;
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              const ps = getComputedStyle(p);
              // Only deliberate side-scrolling rails and clipped cards count — not vertical lists.
              const cls = typeof p.className === 'string' ? p.className : '';
              if (/overflow-x-(auto|scroll)|overflow-hidden|overflow-clip/.test(cls) || p.tagName === 'svg') {
                const pb = p.getBoundingClientRect();
                if (pb.right <= W + 1 && pb.left >= -1) { clipped = true; break; }
              }
            }
            if (clipped) continue;
            const interactive = el.matches('button, a, input, textarea, select, [role=button]');
            if ((b.right > W + 1 || b.left < -1) && (interactive || el.children.length === 0)) {
              out.push(`${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''}.${String(el.className).slice(0, 60)} → ${Math.round(b.left)}..${Math.round(b.right)}`);
            }
          }
          return { docW, out: out.slice(0, 8), total: out.length };
        }, w);
        const bad = res.docW > w + 1 || res.total > 0;
        if (bad) {
          problems++;
          console.log(`✗ ${w}px ${r}  pageWidth=${res.docW}  overflowing=${res.total}`);
          for (const o of res.out) console.log('    ', o);
        } else console.log(`✓ ${w}px ${r}`);
        if (SHOTS && (w === 320 || bad)) await page.screenshot({ path: path.join(SHOTS, `${w}${r.replace(/[/:]/g, '_') || '_home'}.png`) }).catch(() => undefined);
      }
      await ctx.close();
    }
  }
  await browser.close();
  srv.close();
  console.log(problems ? `\n${problems} screen/width combos overflow` : '\nAll screens fit.');
  process.exit(problems ? 1 : 0);
})();
