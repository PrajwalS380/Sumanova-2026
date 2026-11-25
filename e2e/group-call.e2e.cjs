// Real 3-way mesh group call between Chromium tabs (fake camera/mic), using the app's
// GroupCallSession: everyone connects to everyone, a late joiner gets linked, mute is
// signalled, and leaving closes the leaver's links on the others.
// Run: npx vite --config vite.call-test.config.ts & node e2e/group-call.e2e.cjs
const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('PASS:', m); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const open = async (id) => { const p = await ctx.newPage(); await p.goto(`http://localhost:5199/?group=${id}&kind=video`); await p.evaluate(() => window.ready); return p; };
  const linked = (p, n) => p.waitForFunction((n) => (window.peers || []).filter((x) => x.state === 'connected' && x.tracks === 2).length === n, n, { timeout: 20000 }).then(() => true).catch(() => false);
  const a = await open('aaa'); const b = await open('bbb');
  assert(await linked(a, 1) && await linked(b, 1), 'two people connect with audio+video');
  const c = await open('ccc'); // joins late
  const all = await Promise.all([linked(a, 2), linked(b, 2), linked(c, 2)]);
  assert(all.every(Boolean), 'late joiner: all three connected to each other');
  await b.evaluate(() => window.session.setMuted(true));
  const muted = (p) => p.waitForFunction(() => (window.peers || []).find((x) => x.id === 'bbb')?.audio === false, null, { timeout: 5000 }).then(() => true).catch(() => false);
  assert((await muted(a)) && (await muted(c)), 'mute is shown to everyone');
  await a.evaluate(() => window.session.leave());
  const gone = (p) => p.waitForFunction(() => !(window.peers || []).some((x) => x.id === 'aaa'), null, { timeout: 5000 }).then(() => true).catch(() => false);
  assert((await gone(b)) && (await gone(c)), 'leaver is removed for the others');
  assert(await linked(b, 1) && await linked(c, 1), 'the other two stay connected');
  await browser.close();
})();
