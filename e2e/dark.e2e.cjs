// Screenshots key screens in dark mode (stubbed backend): node e2e/dark.e2e.cjs <outdir>
const { chromium } = require('playwright');
const { BASE, REF, session, stub } = require('./crawl.e2e.cjs');
const out = process.argv[2] || '/tmp';
const routes = (process.env.ROUTES || '/chat,/settings,/profile,/stories,/map,/auth/welcome').split(',');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([k, v, t, extra]) => {
    try {
      localStorage.setItem(k, v);
      localStorage.setItem('snv-avatar-skipped-' + JSON.parse(v).user.id, '1');
      localStorage.setItem('snv-theme', t);
      if (extra) for (const [a, b] of Object.entries(JSON.parse(extra))) localStorage.setItem(a, b);
    } catch {}
  }, [`sb-${REF}-auth-token`, JSON.stringify(session), process.env.THEME || 'dark', process.env.EXTRA || '']);
  const page = await ctx.newPage();
  await stub(page);
  for (const r of routes) {
    await page.goto(BASE + r);
    await page.waitForTimeout(1800);
    await page.screenshot({ fullPage: !!process.env.FULL, path: `${out}/${process.env.THEME || 'dark'}${r.replace(/\//g, '_')}.png` });
  }
  await b.close();
})();
