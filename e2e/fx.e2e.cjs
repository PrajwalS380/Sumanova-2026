// Run: npx vite --config vite.fx-test.config.ts & node e2e/fx.e2e.cjs
const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('PASS:', m); };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:5196/');
  const r = await p.evaluate(() => window.run());
  console.log(r);
  assert(r.musicRms > 0.01 && Math.abs(r.musicSeconds - 4) < 0.1, 'music track renders real sound');
  assert(r.fastSeconds > 1 && r.fastSeconds < 2.2, `2x speed halves the clip (${r.clipSeconds.toFixed(1)}s → ${r.fastSeconds.toFixed(1)}s)`);
  assert(r.reverseSeconds > 2 && r.reverseSeconds < 4.2 && r.reverseBytes > 10000, `reverse produces a full-length video (${r.reverseSeconds.toFixed(1)}s)`);
  await b.close();
})();
