// Store build (app/www): does the library header fit on common phone widths with the shop on?
// Checks that the language pill and the settings button are fully on screen and do not overlap the WAYWARD wordmark (T28),
// and (1.2) that the shop tab and every other tab of the bottom bar, and the profile chip, fit on screen. Usage: node test/header-fit.js  (serves app/www on :8776)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const srv = spawn('python3', ['-m', 'http.server', '8776', '--bind', '127.0.0.1'], { cwd: process.env.WWW || path.join(__dirname, '..', 'app', 'www'), stdio: 'ignore' });
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) fails++; };
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const lang of ['en', 'nl']) {
    for (const w of [360, 390, 412]) {
      const ctx = await b.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await ctx.addInitScript((lang) => {
        window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {}, addListener: () => ({ remove() {} }),
          nativePromise: (pl, m) => Promise.resolve(m === 'isBillingSupported' ? { isBillingSupported: true } : m === 'getProducts' ? { products: [] } : m === 'getPurchases' ? { purchases: [] } : {}) };
        localStorage.setItem('wayward.prefs.v1', JSON.stringify({ lang, music: false, sfx: false, speed: 'fast', introDay: '2000-1-1', turns: 30 }));
      }, lang);
      const p = await ctx.newPage();
      await p.goto('http://127.0.0.1:8776/index.html'); await p.waitForTimeout(2500);
      await p.evaluate(() => window.__wayward && window.__wayward.show && window.__wayward.show('library')); await p.waitForTimeout(800);
      const r = await p.evaluate(() => {
        const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), w: Math.round(b.width) }; };
        const head = document.querySelector('#library .lib-head');
        return { vw: document.documentElement.clientWidth, brand: box(head && head.querySelector('.brand')), word: box(head && head.querySelector('.brand .gold-foil')),
          lang: box(head && head.querySelector('.lang-pill')), shop: box(document.getElementById('shopTab')), set: box(head && head.querySelector('.lib-tools [data-settings]')),
          tabs: [...document.querySelectorAll('.tabbar:not([hidden]) button, .tabbar:not([hidden]) [data-tab]')].filter(e => e.offsetParent).map(box), chip: box(document.getElementById('profChip')) };
      });
      const tag = `${lang} ${w}px`;
      ok(`${tag}: shop tab present and on screen`, !!r.shop && r.shop.w > 0 && r.shop.l >= 0 && r.shop.r <= r.vw, JSON.stringify(r.shop));
      ok(`${tag}: all ${r.tabs.length} tabs on screen`, r.tabs.length >= 5 && r.tabs.every(t => t.l >= 0 && t.r <= r.vw && t.w >= 44), JSON.stringify(r.tabs.map(t => t.w)));
      ok(`${tag}: profile chip on screen`, !!r.chip && r.chip.l >= 0 && r.chip.r <= r.vw, JSON.stringify(r.chip));
      ok(`${tag}: settings button fully on screen`, !!r.set && r.set.l >= 0 && r.set.r <= r.vw, JSON.stringify(r.set) + ' vw ' + r.vw);
      ok(`${tag}: language pill clear of the wordmark`, !!r.lang && !!r.word && r.lang.l >= r.word.r - 1, `word ends ${r.word && r.word.r}, pill starts ${r.lang && r.lang.l}`);
      await ctx.close();
    }
  }
  await b.close(); srv.kill();
  console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
