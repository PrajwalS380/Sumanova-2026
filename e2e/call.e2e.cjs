// Real WebRTC call between two Chromium tabs (fake camera/mic), using the app's
// CallSession. Verifies negotiation, media flow, mute signalling and hangup.
const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('PASS:', m); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  for (const kind of ['video', 'voice']) {
    const caller = await ctx.newPage();
    const callee = await ctx.newPage();
    await caller.goto(`http://localhost:5199/?role=caller&kind=${kind}`);
    await caller.waitForFunction(() => window.ready);
    await caller.evaluate(() => window.ready);
    await callee.goto(`http://localhost:5199/?role=callee&kind=${kind}`);
    await callee.evaluate(() => window.ready);
    const connected = (p) => p.waitForFunction(() => window.phases.includes('connected'), null, { timeout: 15000 }).then(() => true).catch(() => false);
    const [a, b] = await Promise.all([connected(caller), connected(callee)]);
    assert(a && b, `${kind}: both peers reach "connected"`);
    const tracks = await Promise.all([caller.evaluate(() => window.remoteTracks), callee.evaluate(() => window.remoteTracks)]);
    assert(tracks.every((t) => t === (kind === 'video' ? 2 : 1)), `${kind}: remote tracks received (${tracks})`);
    // Media actually flowing: inbound bytes increase.
    const bytes = () => callee.evaluate(async () => { let n = 0; const pc = window.session.pc; (await pc.getStats()).forEach((r) => { if (r.type === 'inbound-rtp') n += r.bytesReceived; }); return n; });
    const b1 = await bytes(); await callee.waitForTimeout(1500); const b2 = await bytes();
    assert(b2 > b1, `${kind}: media bytes flowing (${b1} → ${b2})`);
    await caller.evaluate(() => window.session.setMuted(true));
    await callee.waitForFunction(() => window.remoteMedia && window.remoteMedia.audio === false, null, { timeout: 5000 }).then(() => assert(true, `${kind}: mute state signalled`)).catch(() => assert(false, `${kind}: mute state signalled`));
    await caller.evaluate(() => window.session.hangup());
    await callee.waitForFunction(() => window.hungUp, null, { timeout: 5000 }).then(() => assert(true, `${kind}: hangup received`)).catch(() => assert(false, `${kind}: hangup received`));
    const stopped = await caller.evaluate(() => window.phases.at(-1));
    assert(stopped === 'ended', `${kind}: caller cleaned up`);
    await callee.evaluate(() => window.session.close());
    await caller.close(); await callee.close();
  }
  await browser.close();
})();
