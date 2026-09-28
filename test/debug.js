const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://localhost:8766/index.html');
  await p.evaluate(() => localStorage.setItem('wayward.prefs.v1', JSON.stringify({ speed: 'instant' })));
  await p.reload(); await p.waitForTimeout(2500);
  await p.click('#heroHit'); await p.waitForTimeout(1200); await p.click('#coverGo');
  for (const t of [3000, 6000, 10000]) {
    await p.waitForTimeout(t === 3000 ? 3000 : 3500);
    const st = await p.evaluate(() => {
      const vis = (el) => el && el.offsetParent !== null;
      return { screen: document.querySelector('.screen:not([hidden])')?.id, tome: document.getElementById('tome')?.className,
        turnOn: document.querySelector('#turnBtn.on') ? 1 : 0, choices: [...document.querySelectorAll('.choice')].map(c => c.dataset.to + (vis(c) ? 'v' : 'h') + getComputedStyle(c.closest('.after') || c).opacity),
        overlays: [...document.querySelectorAll('canvas,[class*=smoke],[class*=veil]')].filter(vis).map(e => e.className || e.tagName).slice(0, 6) };
    });
    console.log(t, JSON.stringify(st));
    await p.screenshot({ path: `/tmp/claude-0/dbg-${t}.png` });
  }
  await b.close();
})();
