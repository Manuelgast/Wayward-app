// Real touch drag via CDP (compositor gesture handling, like Android WebView)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const url = process.argv[2] || 'http://localhost:8768/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', '--touch-events=enabled'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.evaluate(() => { localStorage.setItem('wayward.prefs.v1', JSON.stringify({ speed: 'fast', lang: 'en' })); localStorage.setItem('wayward.hollow-mountain.v1', JSON.stringify({ page: 1, trail: [1], visited: [1], found: [], relics: [], scenes: [], hint: 3, turns: 5 })); });
  await p.reload(); await p.waitForTimeout(2500);
  await p.click('#heroHit'); await p.waitForTimeout(1200); await p.click('#coverGo');
  for (let i = 0; i < 60; i++) { const on = await p.evaluate(() => !!document.querySelector('#turnBtn.on')); if (on) break; await p.waitForTimeout(1000); }
  await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p);
  const box = await p.locator('#pages').boundingBox();
  const events = [];
  await p.evaluate(() => { window.__ev = []; const pg = document.getElementById('pages'); ['pointerdown','pointermove','pointerup','pointercancel'].forEach(t => pg.addEventListener(t, e => window.__ev.push(t), true)); });
  const foot = async () => p.evaluate(() => [...document.querySelectorAll('#pfoot b')].map(b => b.classList.contains('on') ? 1 : 0).join(''));
  console.log('before', await foot());
  async function drag(x0, y0, x1, y1, steps = 12, dur = 300) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps }] }); await p.waitForTimeout(dur / steps); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  // drag from the lower-right part of the page to the left (like taking the corner)
  await drag(box.x + box.width * 0.9, box.y + box.height * 0.85, box.x + box.width * 0.15, box.y + box.height * 0.8);
  await p.waitForTimeout(1500);
  const ev = await p.evaluate(() => window.__ev);
  const counts = ev.reduce((a, t) => (a[t] = (a[t] || 0) + 1, a), {});
  console.log('events', JSON.stringify(counts), 'after', await foot());
  await b.close();
})();
