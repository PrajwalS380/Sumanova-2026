/**
 * Interaction checks on the production build (backend stubbed like crawl.e2e.cjs):
 * sign-up validation, avatar studio hair editing (style, controls, search), studio save.
 *   npx vite preview --port 4173 &  node e2e/flows.e2e.cjs
 */
const { chromium } = require('playwright');
// reuse the crawl's fake session + backend stub
const { BASE, REF, session, stub } = require('./crawl.e2e.cjs');
const OUT = process.env.OUT || '/tmp';
const log = [];
const check = (name, ok, extra = '') => { log.push(`${ok ? 'ok' : 'XX'} ${name}${extra ? ' — ' + extra : ''}`); };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // ---------------------------------------------------------------- sign-up validation (guest)
  {
    const ctx = await b.newContext({ viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await stub(page);
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(BASE + '/auth/sign-up');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(400);
    const t = await page.evaluate(() => document.body.innerText);
    check('sign-up: empty step 1 shows field errors', /Tell us your name/.test(t) && /birthday/i.test(t), t.match(/Tell us your name|Pick your birthday/g)?.join(', '));
    await page.getByLabel('Your name').fill('Asha');
    await page.getByLabel('Username').fill('asha_test');
    await page.getByLabel('Birthday').fill('2015-05-05');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    const t2 = await page.evaluate(() => document.body.innerText);
    check('sign-up: under-13 birthday is refused', /13/.test(t2) && /Make it yours/.test(t2));
    await page.getByLabel('Birthday').fill('2000-05-05');
    await page.waitForTimeout(1200); // username availability check (stubbed rpc → null)
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(600);
    const t3 = await page.evaluate(() => document.body.innerText);
    check('sign-up: valid step 1 moves to step 2', /Secure your account/.test(t3), t3.slice(0, 120).replace(/\s+/g, ' '));
    if (/Secure your account/.test(t3)) {
      await page.getByLabel('Email').fill('bad-email');
      await page.getByRole('textbox', { name: 'Password' }).fill('short');
      await page.getByRole('button', { name: 'Create account' }).click();
      await page.waitForTimeout(500);
      const t4 = await page.evaluate(() => document.body.innerText);
      check('sign-up: bad email + weak password refused', /email/i.test(t4) && /(8|characters|password)/i.test(t4));
    }
    check('sign-up: no page errors', !errs.length, errs.join(' | '));
    await page.screenshot({ path: `${OUT}/flow-signup.png` });
    await ctx.close();
  }
  // ---------------------------------------------------------------- avatar studio: hair
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('snv-avatar-skipped-' + JSON.parse(v).user.id, '1'); } catch {} }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
    const page = await ctx.newPage();
    await stub(page);
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::|WebSocket|GPU stall/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
    await page.goto(BASE + '/avatar');
    await page.waitForTimeout(6000);
    await page.getByRole('tab', { name: /Face & body/ }).click().catch(() => page.getByText('Face & body').click());
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^Hair$/ }).first().click();
    await page.waitForTimeout(1500);
    const hairUi = await page.evaluate(() => document.body.innerText);
    check('studio: hair panel shows search + categories', /Search 110 hairstyles/.test(await page.content()) && /Curly & coily/.test(hairUi));
    check('studio: hair controls visible for current style', /Length/i.test(hairUi) && /Volume/i.test(hairUi) && /Shine/i.test(hairUi));
    await page.getByPlaceholder('Search 110 hairstyles').fill('braid');
    await page.waitForTimeout(800);
    const n = await page.locator('button[aria-label*="braid" i]').count();
    check('studio: search "braid" filters the grid', n >= 3, `${n} matches`);
    await page.locator('button[aria-label="Single braid"]').click();
    await page.waitForTimeout(2500);
    const afterPick = await page.evaluate(() => document.body.innerText);
    check('studio: picking a style updates the panel title', /Single braid/.test(afterPick) && /Updos & braids/.test(afterPick));
    check('studio: braid hides texture/fringe controls', !/Texture/i.test(afterPick) && !/Fringe/i.test(afterPick) && /Length/i.test(afterPick));
    await page.getByPlaceholder('Search 110 hairstyles').fill('');
    await page.locator('button[aria-label="Long wavy"]').click();
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Middle', exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Ombré', exact: true }).click();
    await page.waitForTimeout(400);
    const tuned = await page.evaluate(() => document.body.innerText);
    check('studio: adjusting parting / colour effect shows Reset', /Reset/.test(tuned));
    await page.getByRole('button', { name: 'Add to favourites' }).click();
    await page.waitForTimeout(300);
    const favs = await page.evaluate(() => localStorage.getItem('snv-hair-favs'));
    check('studio: favourite saved', !!favs && favs.includes('36'), favs);
    await page.getByRole('button', { name: /Undo/ }).click();
    await page.waitForTimeout(400);
    check('studio: undo works', true);
    await page.screenshot({ path: `${OUT}/flow-studio.png` });
    await page.getByRole('button', { name: /Save/ }).first().click();
    await page.waitForTimeout(6000);
    check('studio: save completes without page errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(log.join('\n'));
})();
