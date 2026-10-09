// End-to-end check of the store build (app/www) in Chromium with a fake Capacitor bridge:
// the shop is on, its links are right per platform, a purchase through WaywardBilling unlocks a book,
// and the page throws no errors. Usage: node test/store-e2e.js [android|ios]  (serves app/www on :8771)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const platform = process.argv[2] || 'android';
const srv = spawn('python3', ['-m', 'http.server', '8771', '--bind', '127.0.0.1'], { cwd: path.join(__dirname, '..', 'app', 'www'), stdio: 'ignore' });
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) fails++; };
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(pf => {
    window.__calls = [];
    const owned = [];
    window.Capacitor = {
      isNativePlatform: () => true, getPlatform: () => pf, Plugins: {},
      addListener: () => ({ remove() {} }),
      nativePromise: (pl, m, o) => {
        window.__calls.push(pl + '.' + m);
        if (m === 'isBillingSupported') return Promise.resolve({ isBillingSupported: true });
        if (m === 'getProducts') return Promise.resolve({ products: o.productIdentifiers.map(id => ({ identifier: id, priceString: '€ 1,99' })) });
        if (m === 'purchaseProduct') { owned.push(o.productIdentifier); return Promise.resolve({ productIdentifier: o.productIdentifier, transactionId: 'T1' }); }
        if (m === 'getPurchases') return Promise.resolve({ purchases: owned.map(id => ({ productIdentifier: id, purchaseState: '1' })) });
        return Promise.resolve({});
      }
    };
    localStorage.setItem('wayward.prefs.v1', JSON.stringify({ lang: 'en', introDay: '2999-1-1' }));
  }, platform);
  await p.goto('http://127.0.0.1:8771/index.html');
  await p.waitForTimeout(3000);
  const st = await p.evaluate(() => ({
    billing: !!window.WaywardBilling, ads: !!window.WaywardAds, shopOn: !!(window.WaywardShop && window.WaywardShop.enabled()),
    links: window.WAYWARD_LINKS, build: window.WAYWARD_BUILD
  }));
  ok('bridge present', st.billing && st.ads);
  ok('shop is on in the store build', st.shopOn);
  ok('privacy link set', !!(st.links && st.links.privacy));
  ok(platform === 'ios' ? 'Apple terms link on iOS' : 'no Apple terms link on Android', platform === 'ios' ? /apple\.com/.test(st.links.terms || '') : !st.links.terms, JSON.stringify(st.links));
  const gradle = require('fs').readFileSync(path.join(__dirname, '..', 'app', 'android', 'app', 'build.gradle'), 'utf8');
  const want = (gradle.match(/versionName "([^"]+)"/) || [])[1] + ' (' + (gradle.match(/versionCode (\d+)/) || [])[1] + ')';
  ok('version string ' + want, (st.build || '').indexOf(want) >= 0, st.build);
  await p.evaluate(() => window.WaywardShop.open());
  await p.waitForTimeout(800);
  const shop = await p.evaluate(() => { const s = document.querySelector('#shopBody'); return s ? s.innerText : ''; });
  ok('shop sheet opens', shop.length > 50, shop.slice(0, 120).replace(/\n/g, ' | '));
  ok('restore button', /Restore purchases/.test(shop));
  ok('no test-switch in store build', !/test/i.test(await p.evaluate(() => (document.querySelector('.shop-dev') || {}).innerText || '')));
  const buy = await p.$('#shopBody [data-shop="buy"][data-id^="book_"]');
  if (buy) { await buy.click(); await p.waitForTimeout(1500); }
  const after = await p.evaluate(() => ({ calls: window.__calls.filter(c => /purchase/i.test(c)), ent: localStorage.getItem('wayward.shop.v2') }));
  ok('purchase goes through the store bridge', after.calls.length > 0, JSON.stringify(after.calls));
  ok('a book is owned after the purchase', /"owned":\{"[a-z]/.test(after.ent || ''), (after.ent || '').slice(0, 80));
  ok('no page errors', !errs.length, errs.join(' | '));
  await b.close(); srv.kill();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
