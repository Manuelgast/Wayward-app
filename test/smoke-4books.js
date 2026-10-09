// Smoke test of the store build (app/www) with all four books, in EN and NL, in mobile Chromium with a fake
// Capacitor bridge (store mode: shop on, as on the phone). For each book: open it from the library shelf,
// open the cover, get past an opening scene, turn a page, make a choice, and check that the choice landed.
// Fails on any page error, console error or failed request.  Usage: node test/smoke-4books.js  (serves app/www on :8773)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const PORT = 8773;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: path.join(__dirname, '..', 'app', 'www'), stdio: 'ignore' });
const BOOKS = [['shelfBook', 'hollow-mountain'], ['shelfBook2', 'drowned-lighthouse'], ['shelfBook3', 'station-nine'], ['shelfBook4', 'ash-orchid']];
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) fails++; };

// one step through the reader: skip a scene, finish the ink, turn a page, or (when wanted) pick a choice
async function step(p, wantChoice) {
  return p.evaluate((wantChoice) => {
    const W = window.__wayward, vis = (el) => !!el && el.offsetParent !== null && !el.closest('[hidden]');
    const cur = W.current();
    if (cur === 'moment') { const m = [...document.querySelectorAll('#moment .mchoice')].find(vis); if (m && wantChoice) { m.click(); return { did: 'choice', to: +m.getAttribute('data-to'), from: W.R.p }; } return { did: 'wait-moment' }; }
    if (cur !== 'reader') return { did: 'wait:' + cur };
    if (document.querySelector('#tome.scene')) { const s = document.getElementById('ilSkip'); if (vis(s)) { s.click(); return { did: 'skip-scene' }; } return { did: 'wait-scene' }; }
    const wipe = document.querySelector('.wipe-hint button'); if (vis(wipe)) { wipe.click(); return { did: 'skip-wipe' }; }
    if (W.R.mode !== 'read' || W.R.turning) return { did: 'wait-mode' };
    if (W.R.revealing) { W.finishReveal(); return { did: 'reveal' }; }
    const c = [...document.querySelectorAll('#leafTop .choice:not(.locked)')].find(e => vis(e) && getComputedStyle(e.closest('.after') || e).opacity !== '0');
    if (c && wantChoice) { const to = +c.getAttribute('data-to'), from = W.R.p; c.click(); return { did: 'choice', to, from }; }
    const t = document.querySelector('#turnBtn.on'); if (vis(t)) { const i = W.R.idx; t.click(); return { did: 'turn', from: i }; }
    if (W.R.idx < W.R.sheets.length - 1) { const i = W.R.idx; W.turnSheet(1); return { did: 'turn', from: i }; }
    return { did: c ? 'choice-ready' : 'idle' };
  }, wantChoice);
}

(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const lang of ['en', 'nl']) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 732 }, isMobile: true, hasTouch: true, locale: lang === 'nl' ? 'nl-NL' : 'en-US' });
    await ctx.route('**/favicon.ico', r => r.fulfill({ status: 204, body: '' })); // desktop Chromium asks for it; the app's WebView does not
    await ctx.addInitScript(l => {
      window.Capacitor = { // fake native bridge: store mode exactly as on the phone, purchases answered locally
        isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {}, addListener: () => ({ remove() {} }),
        nativePromise: (pl, m, o) => {
          if (m === 'isBillingSupported') return Promise.resolve({ isBillingSupported: true });
          if (m === 'getProducts') return Promise.resolve({ products: o.productIdentifiers.map(id => ({ identifier: id, priceString: '€2.00' })) });
          if (m === 'getPurchases') return Promise.resolve({ purchases: [] });
          return Promise.resolve({});
        }
      };
      const d = new Date(); // first-run intro already seen today: the short mist
      try { if (!localStorage.getItem('wayward.prefs.v1')) localStorage.setItem('wayward.prefs.v1', JSON.stringify({ lang: l, speed: 'fast', introDay: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() })); } catch (e) {}
    }, lang);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    p.on('response', r => { if (r.status() >= 400) errs.push('http ' + r.status() + ' ' + r.url()); });
    await p.goto(`http://127.0.0.1:${PORT}/index.html`);
    await p.waitForTimeout(2500);
    const lib = await p.evaluate(() => ({ screen: window.__wayward.current(), shop: !!(window.WaywardShop && window.WaywardShop.enabled()), lang: document.documentElement.lang, books: [...document.querySelectorAll('.shelf .book[data-bookid]')].length }));
    ok(`[${lang}] library with 4 books, store mode`, lib.screen === 'library' && lib.books === 4 && lib.shop && lib.lang === lang, JSON.stringify(lib));
    for (const [shelfId, bookId] of BOOKS) {
      const tag = `[${lang}] ${bookId}`;
      await p.evaluate(() => window.__wayward.show('library')); await p.waitForTimeout(600);
      await p.click('#' + shelfId); await p.waitForTimeout(1500);
      const cov = await p.evaluate(() => ({ screen: window.__wayward.current(), book: window.__wayward.book().id, title: (document.querySelector('#coverTitle') || {}).textContent }));
      ok(`${tag}: opens from the shelf to its cover`, cov.screen === 'cover' && cov.book === bookId, cov.title);
      await p.click('#coverGo'); await p.waitForTimeout(2500);
      let turned = 0, chose = null, trace = [];
      for (let i = 0; i < 120 && !chose; i++) {
        const r = await step(p, turned > 0 || i > 60);
        trace.push(r.did);
        if (r.did === 'turn') turned++;
        if (r.did === 'choice') chose = r;
        await p.waitForTimeout(r.did.startsWith('wait') ? 500 : 900);
      }
      // a book whose first page fits on one sheet: the choice itself turns the page
      ok(`${tag}: page turned`, turned > 0 || (chose && chose.to !== chose.from), 'turns ' + turned);
      ok(`${tag}: choice made`, !!chose, chose ? 'p' + chose.from + ' -> p' + chose.to : trace.slice(-6).join(','));
      if (chose) {
        await p.waitForTimeout(2500);
        const at = await p.evaluate(() => ({ page: window.__wayward.st().page, screen: window.__wayward.current(), shopOpen: !!document.querySelector('#shopSheet:not([hidden])') }));
        ok(`${tag}: arrived on the chosen page`, at.page === chose.to && (at.screen === 'reader' || at.screen === 'moment') && !at.shopOpen, JSON.stringify(at));
      }
    }
    ok(`[${lang}] no page errors`, !errs.length, errs.slice(0, 8).join(' | '));
    await ctx.close();
  }
  // price tiers (web book v28): a reader with 6 endings found in Book II is offered book_sea_b at the store's price,
  // the purchase goes to the store under that id, and it owns the book
  {
    const ctx = await b.newContext({ viewport: { width: 412, height: 732 }, isMobile: true, hasTouch: true });
    await ctx.route('**/favicon.ico', r => r.fulfill({ status: 204, body: '' }));
    await ctx.addInitScript(() => {
      window.__buys = []; window.__queried = [];
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {}, addListener: () => ({ remove() {} }),
        nativePromise: (pl, m, o) => {
          if (m === 'isBillingSupported') return Promise.resolve({ isBillingSupported: true });
          if (m === 'getProducts') { window.__queried.push(...o.productIdentifiers); return Promise.resolve({ products: o.productIdentifiers.map(id => ({ identifier: id, priceString: /_b$/.test(id) ? '€1,49' : /_c$/.test(id) ? '€0,99' : '€2,00' })) }); }
          if (m === 'purchaseProduct') { window.__buys.push(o.productIdentifier); return Promise.resolve({ productIdentifier: o.productIdentifier, transactionId: 'T1' }); }
          if (m === 'getPurchases') return Promise.resolve({ purchases: window.__buys.map(id => ({ productIdentifier: id, purchaseState: '1' })) });
          return Promise.resolve({});
        } };
      if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1');
        localStorage.setItem('wayward.prefs.v1', JSON.stringify({ lang: 'en', introDay: 'x' }));
        localStorage.setItem('wayward.drowned-lighthouse.v1', JSON.stringify({ trail: [], visited: [], found: [11, 47, 56, 71, 92, 19], relics: [], scenes: [] })); }
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://127.0.0.1:${PORT}/index.html`); await p.waitForTimeout(2500);
    await p.evaluate(() => window.WaywardShop.open()); await p.waitForTimeout(900);
    const offer = await p.evaluate(() => { const bt = [...document.querySelectorAll('#shopBody [data-shop="buy"]')].map(e => e.getAttribute('data-id') + '=' + e.textContent.trim()); return { bt, queried: window.__queried.length }; });
    ok('[tiers] store queried for all 14 products', offer.queried === 14, 'queried ' + offer.queried);
    ok('[tiers] Book II offered as book_sea_b at the store price', offer.bt.includes('book_sea_b=€1,49') && offer.bt.includes('book_mountain=€2,00'), offer.bt.join(' '));
    await p.click('#shopBody [data-shop="buy"][data-id="book_sea_b"]'); await p.waitForTimeout(1500);
    const after = await p.evaluate(() => ({ buys: window.__buys.slice(), owned: (JSON.parse(localStorage.getItem('wayward.shop.v2') || '{}').owned) || {} }));
    ok('[tiers] purchase goes to the store as book_sea_b and owns Book II', after.buys.join() === 'book_sea_b' && !!after.owned.book_sea, JSON.stringify(after));
    ok('[tiers] no page errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  await b.close(); srv.kill();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
