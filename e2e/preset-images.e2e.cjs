/**
 * Re-render the starter-character pictures (public/presets/N.webp) from the current renderer.
 *   npx vite --config vite.avatar-test.config.ts   (port 5199)
 *   node e2e/preset-images.e2e.cjs <outDir>        → N.png, then crop/convert (see CLAUDE.md)
 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.goto('http://localhost:5199/?presetImages=1' + (process.argv[3] ? '&' + process.argv[3] : ''));
  await p.waitForFunction(() => document.title === 'done', null, { timeout: 600000 });
  const list = await p.evaluate(() => window.__presets);
  list.forEach((d, i) => fs.writeFileSync(`${out}/${i}.raw`, Buffer.from(d.split(',')[1], 'base64')));
  console.log('rendered', list.length);
  await b.close();
})();
