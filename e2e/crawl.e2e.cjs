/**
 * End-to-end crawl of every screen in the production build with the backend stubbed
 * (this sandbox can't reach Supabase). Signs in a fake user by seeding a session, answers
 * REST / RPC / auth calls with empty-but-valid data, and records per screen: page errors,
 * console errors, error-boundary text, and horizontal overflow (phone width).
 *   npm run build && npx vite preview --port 4173 &  node e2e/crawl.e2e.cjs
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const REF = 'wssfbcscijpwfohhkerz';
const UID = '00000000-0000-4000-8000-00000000c0de';
const now = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aal: 'aal1', exp: now + 86400, iat: now, email: 'tester@example.invalid', session_id: 's1' })}.sig`;
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'tester@example.invalid', app_metadata: {}, user_metadata: { username: 'tester' }, factors: [], created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: 'bearer', expires_in: 86400, expires_at: now + 86400, refresh_token: 'r1', user };
const profile = { id: UID, username: 'tester', display_name: 'Test User', bio: '', avatar_url: null, avatar_body_url: null, avatar_face_url: null, avatar_config: null, profile_scene: null, photo_mode: 'avatar', created_at: new Date().toISOString(), last_seen_at: new Date().toISOString() };
const settings = { user_id: UID, date_of_birth: '2000-01-01', theme: 'light', notifications: {}, created_at: new Date().toISOString() };
const privacy = { user_id: UID, ghost_mode: true, show_birthday: true, find_by_phone: true };

const ROUTES = ['/', '/chat', '/chat/00000000-0000-4000-8000-0000000000aa', '/chat/00000000-0000-4000-8000-0000000000aa/info', '/friends', '/birthdays', '/trophies', '/albums', '/avatar/cam', '/calls', '/notifications', '/avatar', '/avatar/duo', '/avatar/home', '/avatar/selfie', '/stories', '/stories/archive', '/u/someone', '/map', '/spotlight', '/memories', '/profile', '/profile/edit', '/profile/photo', '/profile/code', '/settings', '/accounts', '/onboarding/avatar'];
const GUEST = ['/auth/welcome', '/auth/sign-in', '/auth/sign-up', '/auth/forgot', '/auth/reset', '/auth/two-step'];

async function stub(page) {
  await page.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p.startsWith('/auth/v1/user')) return json(user);
    if (p.startsWith('/auth/v1/token')) return json(session);
    if (p.startsWith('/auth/v1/factors')) return json({ all: [], totp: [] });
    if (p.startsWith('/auth/v1')) return json({});
    if (p.startsWith('/rest/v1/rpc/')) return json(single ? null : []);
    if (p.startsWith('/rest/v1/')) {
      const t = p.split('/')[3];
      if (single) return json(t === 'profiles' ? profile : t === 'user_settings' ? settings : t === 'privacy_settings' ? privacy : null);
      // maybeSingle() asks for a list: answer the signed-in user's own rows
      const own = { profiles: profile, user_settings: settings, privacy_settings: privacy }[t];
      if (own && req.method() === 'GET' && u.search.includes(UID)) return json([own]);
      if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '0-0/0' }, body: '' });
      return json(req.method() === 'GET' ? [] : null, req.method() === 'GET' ? 200 : 201);
    }
    if (p.startsWith('/storage/v1/object/list')) return json([]);
    if (p.startsWith('/storage/v1')) return json({ signedURL: null, signedUrl: null }, 200);
    if (p.startsWith('/functions/v1')) return json({});
    return route.abort();
  });
}

module.exports = { BASE, REF, session, stub };
if (require.main === module) (async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const results = [];
  for (const [label, vp] of [['phone', { width: 360, height: 740 }], ['desktop', { width: 1280, height: 860 }]]) {
    for (const [mode, list] of [['guest', GUEST], ['signed-in', ROUTES]]) {
      const ctx = await b.newContext({ viewport: vp, permissions: ['geolocation', 'camera', 'microphone', 'notifications'], geolocation: { latitude: 12.97, longitude: 77.59 } });
      if (mode === 'signed-in') await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('snv-avatar-skipped-' + JSON.parse(v).user.id, '1'); } catch {} }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
      for (const r of list) {
        const page = await ctx.newPage();
        await stub(page);
        const errs = [];
        page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 220)));
        page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|ERR_FAILED|net::|WebSocket|GPU stall|websocket/i.test(t)) errs.push('CONSOLE ' + t.slice(0, 220)); } });
        try {
          await page.goto(BASE + r, { timeout: 60000, waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(label === 'phone' ? 3500 : 2500);
          const info = await page.evaluate(() => ({
            url: location.pathname,
            boundary: /something went wrong|unexpected error/i.test(document.body.innerText),
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            text: document.body.innerText.slice(0, 80).replace(/\s+/g, ' '),
          }));
          if (label === 'phone') await page.screenshot({ path: `${process.env.OUT || '/tmp'}/crawl-${mode}-${r.replace(/[/]/g, '_') || 'root'}.png` });
          results.push({ label, mode, r, ...info, errs });
        } catch (e) {
          results.push({ label, mode, r, url: '-', errs: ['NAV ' + e.message.slice(0, 160)] });
        }
        await page.close();
      }
      await ctx.close();
    }
  }
  await b.close();
  let bad = 0;
  for (const x of results) {
    const flag = x.errs.length || x.boundary || x.overflow > 1;
    if (flag) bad++;
    console.log(`${flag ? 'XX' : 'ok'} ${x.label} ${x.mode} ${x.r} -> ${x.url}${x.boundary ? ' [ERROR SCREEN]' : ''}${x.overflow > 1 ? ' [overflow ' + x.overflow + 'px]' : ''}`);
    for (const e of x.errs) console.log('    ' + e);
  }
  console.log(`\n${results.length} screen loads, ${bad} with problems`);
})();
