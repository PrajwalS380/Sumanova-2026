/**
 * Hair motion contact sheets (sumanova-us-108): for each style, 8 frames 120 ms apart while the
 * figure dances (or &shake=yaw turns its head), composed into one PNG per run.
 *   npx vite --config vite.avatar-test.config.ts   (port 5199)
 *   node e2e/hair-motion.e2e.cjs <out> [pose|shake=yaw] [ids=35,50,…] [turn radians]
 */
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] ?? 'hair-motion.png';
  const mode = process.argv[3] ?? 'dancing';
  const ids = (process.argv[4] ?? '35,36,50,0').split(',');
  const turn = process.argv[5] ?? (mode.startsWith('shake=') ? '3.14' : '2.6');
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const rows = [];
  for (const id of ids) {
    const p = await b.newPage({ viewport: { width: 320, height: 420 } });
    const extra = mode.startsWith('shake=') ? `&${mode}&turn=${turn}` : `&pose=${mode}&turn=${turn}`;
    await p.goto(`http://localhost:5199/?slot=hair&ids=${id}&size=320&cam=0,1.95,3.0,0,1.75,0${extra}`, { timeout: 180000 });
    await p.waitForTimeout(25000);
    const frames = [];
    for (let i = 0; i < 8; i++) {
      // software GL can be busy mid-frame: retry the grab
      let shot = null;
      for (let k = 0; k < 5 && !shot; k++) shot = await p.screenshot({ type: 'jpeg', quality: 80, timeout: 120000 }).catch(() => null);
      if (shot) frames.push(shot.toString('base64'));
      await p.waitForTimeout(120);
    }
    rows.push(frames);
    await p.close();
  }
  // frames → <out>.frames/<row>-<i>.jpg (compose with any image tool; see CLAUDE.md)
  const fs = require('fs');
  const dir = out + '.frames';
  fs.mkdirSync(dir, { recursive: true });
  rows.forEach((r, ri) => r.forEach((f, fi) => fs.writeFileSync(`${dir}/${ri}-${fi}.jpg`, Buffer.from(f, 'base64'))));
  await b.close();
  console.log('frames', out + '.frames');
})();
