// Store build (app/www): open every page of every book and fail on any missing file (HTTP 4xx/5xx or a failed request).
// Guards the build-time pruning of unused pictures and videos. Usage: node test/assets-walk.js  (serves app/www on :8778)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
const WWW = process.env.WWW || path.join(__dirname, '..', 'app', 'www');
const srv = spawn('python3', ['-m', 'http.server', '8778', '--bind', '127.0.0.1'], { cwd: WWW, stdio: 'ignore' });
const BOOKS = [['hollow-mountain', 'book.en.json'], ['drowned-lighthouse', 'book2.en.json'], ['station-nine', 'book3.en.json'], ['ash-orchid', 'book4.en.json']];
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) fails++; };
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  let total = 0;
  for (const [book, file] of BOOKS) {
    const ids = Object.keys(JSON.parse(fs.readFileSync(path.join(WWW, file), 'utf8')).sections);
    const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript((book) => {
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {}, addListener: () => ({ remove() {} }),
        nativePromise: (pl, m) => Promise.resolve(m === 'isBillingSupported' ? { isBillingSupported: true } : m === 'getProducts' ? { products: [] } : m === 'getPurchases' ? { purchases: [] } : {}) };
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('wayward.prefs.v1', JSON.stringify({ lang: 'en', music: true, sfx: true, speed: 'fast', introDay: '2000-1-1', turns: 30, book }));
      }
    }, book);
    const p = await ctx.newPage();
    const bad = [];
    p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(/^https?:\/\/[^/]+\//, '')); });
    p.on('requestfailed', r => { const u = r.url(); if (!/favicon/.test(u)) bad.push('failed ' + u.replace(/^https?:\/\/[^/]+\//, '')); });
    await p.goto('http://127.0.0.1:8778/index.html'); await p.waitForTimeout(2500);
    await p.evaluate(() => window.__wayward && window.__wayward.show && window.__wayward.show('library')); await p.waitForTimeout(600);
    for (const id of ids) {
      await p.evaluate((id) => { try { window.__wayward.goTo(isNaN(+id) ? id : +id); } catch (e) {} }, id);
      await p.waitForTimeout(350);
    }
    await p.waitForTimeout(1500);
    total += ids.length;
    ok(`${book}: ${ids.length} pages, no missing files`, bad.length === 0, bad.slice(0, 6).join(' | '));
    await ctx.close();
  }
  await b.close(); srv.kill();
  console.log(fails ? fails + ' FAIL' : 'ALL PASS (' + total + ' pages)'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
