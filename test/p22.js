// p22 timed moment: fog canvas exists during the moment and is destroyed after leaving (MCREEP fix)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:8768/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  const count = () => p.evaluate(() => document.querySelectorAll('canvas.fx-creep').length);
  const res = {};
  for (const exit of ['choice', 'back', 'timeout']) {
    await p.evaluate(() => { window.__wayward.goTo(22); }); await p.waitForTimeout(1200);
    res[exit + ':screen'] = await p.evaluate(() => window.__wayward.current());
    res[exit + ':during'] = await count();
    if (exit === 'choice') { for (let i = 0; i < 40 && !(await p.evaluate(() => !document.querySelector('#mDecide').hidden)); i++) { await p.evaluate(() => document.querySelector('#mSkip').click()); await p.waitForTimeout(300); } await p.evaluate(() => document.querySelector('.mchoice').click()); }
    if (exit === 'back') await p.evaluate(() => window.__wayward.show('library'));
    if (exit === 'timeout') { for (let i = 0; i < 40 && !(await p.evaluate(() => !document.querySelector('#mDecide').hidden)); i++) { await p.evaluate(() => document.querySelector('#mSkip').click()); await p.waitForTimeout(300); } await p.waitForTimeout(15000); }
    await p.waitForTimeout(1500);
    res[exit + ':after'] = await count(); res[exit + ':screenAfter'] = await p.evaluate(() => window.__wayward.current());
  }
  console.log(JSON.stringify(res), 'errors', errs.length);
  const ok = ['choice', 'back', 'timeout'].every(k => res[k + ':during'] === 1 && res[k + ':after'] === 0) && !errs.length;
  console.log(ok ? 'PASS p22 fog stops after the moment' : 'FAIL');
  await b.close();
})();
