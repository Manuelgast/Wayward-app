// Update 1.2 in the store build (app/www) with a fake Capacitor bridge (purchases and rewarded ads):
// - only Books I-IV on the shelf, no sealed stories, Book I open and II-IV locked for a new reader
// - a locked book gives 3 sample pages, then the unlock gate; 3 rewarded ads (through the native ad bridge) unlock it
// - the daily chest opens after the daily goal; the profile and the collection render (4 books, no seals, no blanks)
// - a reader coming from 1.1.3 keeps every book he had started or bought open
// - no page errors, no missing files, no network outside the app
// Usage: node test/update-1.2.js   (serves app/www on :8777; screenshots in test/out-1.2/)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'out-1.2'); fs.mkdirSync(OUT, { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', '8777', '--bind', '127.0.0.1'], { cwd: path.join(__dirname, '..', 'app', 'www'), stdio: 'ignore' });
const BASE = 'http://127.0.0.1:8777/index.html';
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' — ' + (typeof x === 'string' ? x : JSON.stringify(x)) : '')); if (!c) fails++; };
const FAKE = (o) => {
  window.__calls = []; const L = {};
  const fire = (ev, a) => (L[ev] || []).slice().forEach(f => f(a));
  window.Capacitor = {
    isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {},
    addListener: (pl, ev, fn) => { (L[ev] = L[ev] || []).push(fn); return { remove() { L[ev] = (L[ev] || []).filter(f => f !== fn); } }; },
    nativePromise: (pl, m, a) => {
      window.__calls.push(pl + '.' + m);
      if (m === 'isBillingSupported') return Promise.resolve({ isBillingSupported: true });
      if (m === 'getProducts') return Promise.resolve({ products: a.productIdentifiers.map(id => ({ identifier: id, priceString: '€ 1,99' })) });
      if (m === 'getPurchases') return Promise.resolve({ purchases: (o.owned || []).map(id => ({ productIdentifier: id, purchaseState: '1' })) });
      if (m === 'requestConsentInfo') return Promise.resolve({ status: 'OBTAINED', canRequestAds: true, isConsentFormAvailable: false });
      if (m === 'showRewardVideoAd') { setTimeout(() => { fire('onRewardedVideoAdReward', { amount: 1 }); fire('onRewardedVideoAdDismissed'); }, 30); return Promise.resolve({ amount: 1 }); }
      return Promise.resolve({});
    }
  };
  localStorage.setItem('wayward.prefs.v1', JSON.stringify(Object.assign({ lang: o.lang || 'en', introDay: '2999-1-1', speed: 'fast', music: false, sfx: false }, o.prefs || {})));
  Object.keys(o.store || {}).forEach(k => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(o.store[k])); });
};
async function page(b, w, o) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(FAKE, o);
  const p = await ctx.newPage(), log = { errs: [], bad: [], ext: [] };
  p.on('pageerror', e => log.errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) log.bad.push(r.status() + ' ' + r.url()); });
  p.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1:8777') && !u.startsWith('data:') && !u.startsWith('blob:')) log.ext.push(u); });
  await p.goto(BASE); await p.waitForTimeout(2500);
  return { p, ctx, log };
}
const shelf = (p) => p.evaluate(() => [...document.querySelectorAll('.shelf .book[data-bookid]')].filter(e => e.offsetParent).map(e => e.getAttribute('data-bookid') + (e.classList.contains('locked') ? ':locked' : ':open')));
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  // ---- a new reader
  for (const [lang, w] of [['en', 390], ['nl', 360]]) {
    const { p, ctx, log } = await page(b, w, { lang });
    const tag = `[new ${lang} ${w}]`;
    await p.evaluate(() => window.__wayward.show('library')); await p.waitForTimeout(800);
    const sh = await shelf(p);
    ok(`${tag} shelf: Book I open, II-IV locked, nothing else`, JSON.stringify(sh) === JSON.stringify(['hollow-mountain:open', 'drowned-lighthouse:locked', 'station-nine:locked', 'ash-orchid:locked']), sh);
    ok(`${tag} no sealed stories in the app`, await p.evaluate(() => document.getElementById('sealRow').hidden && document.getElementById('sealHead').hidden));
    ok(`${tag} shop on (store build)`, await p.evaluate(() => window.WaywardShop.enabled()));
    ok(`${tag} daily chest waits for the daily goal`, await p.evaluate(() => { const r = document.querySelector('.chest-row'); return !!r && r.classList.contains('locked'); }));
    await p.screenshot({ path: `${OUT}/library-${lang}-${w}.png` });
    // Book II: lock row on the cover, 3 sample pages, then the gate
    await p.evaluate(() => document.querySelector('.shelf [data-bookid="drowned-lighthouse"]').click()); await p.waitForTimeout(1200);
    ok(`${tag} Book II cover shows the lock row`, await p.evaluate(() => !document.getElementById('coverLock').hidden), await p.evaluate(() => document.getElementById('coverLockText').textContent));
    const res = await p.evaluate(async () => {
      const bk = window.__wayward.book(), out = []; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const B = await fetch(bk.file + '.' + (document.documentElement.lang || 'en') + '.json').then(r => r.json());
      let k = String(B.start || 1); const S = B.sections; const r = [];
      while (r.length < 5) { const ch = (S[k].choices || []).filter(c => !c.hidden && !S[String(c.to)].ending); if (!ch.length) break; k = String(ch[0].to); r.push(+k); }
      for (const k2 of r) { window.WaywardShop.page(k2, () => window.__wayward.goTo(k2, { asText: true })); await sleep(700); out.push({ page: k2, at: window.__wayward.st().page, gate: !!document.querySelector('.shop-unlock') }); if (out[out.length - 1].gate) break; }
      return out;
    });
    const gateAt = res.findIndex(x => x.gate);
    ok(`${tag} 3 sample pages, then the unlock gate`, gateAt === 3 && res.slice(0, 3).every(x => x.at === x.page), res);
    await p.screenshot({ path: `${OUT}/unlock-gate-${lang}-${w}.png` });
    for (let i = 0; i < 3; i++) { await p.evaluate(() => { const x = document.querySelector('.shop-unlock [data-g="uad"]'); if (x) x.click(); }); await p.waitForTimeout(900); }
    const ent = await p.evaluate(() => JSON.parse(localStorage.getItem('wayward.shop.v2') || '{}'));
    ok(`${tag} 3 rewarded ads through the native bridge unlock Book II`, ent.unlocked && ent.unlocked['drowned-lighthouse'] === 'ads' && (await p.evaluate(() => window.__calls.filter(c => c === 'AdMob.showRewardVideoAd').length)) === 3, { unlocked: ent.unlocked });
    await p.evaluate(() => { const g = document.getElementById('shopGate'); if (g) g.remove(); });
    // daily goal (3 pages) reached -> chest ready -> open it
    await p.evaluate(() => window.__wayward.show('library')); await p.waitForTimeout(1500);
    await p.evaluate(() => { const h = document.getElementById('cardHost'); const x = h && h.querySelector('#celOk'); if (x) x.click(); }); await p.waitForTimeout(400);
    ok(`${tag} daily goal reached: chest ready`, await p.evaluate(() => { const r = document.querySelector('.chest-row'); return !!r && r.classList.contains('ready'); }));
    const sh2 = await shelf(p);
    ok(`${tag} Book II shows open on the shelf after unlocking`, sh2.indexOf('drowned-lighthouse:open') > -1, sh2);
    await p.evaluate(() => document.querySelector('.chest-row.ready').click()); await p.waitForTimeout(1600);
    ok(`${tag} chest opens with a reward and its odds`, await p.evaluate(() => !!document.querySelector('.chest-stage h3') && document.querySelectorAll('.ch-odds li').length === 5), await p.evaluate(() => (document.querySelector('.chest-stage h3') || {}).textContent));
    await p.screenshot({ path: `${OUT}/chest-${lang}-${w}.png` });
    await p.evaluate(() => document.getElementById('celOk').click()); await p.waitForTimeout(500);
    ok(`${tag} chest done for today`, await p.evaluate(() => !!document.querySelector('.chest-row.done')));
    // profile and collection
    await p.evaluate(() => window.__wayward.show('profile')); await p.waitForTimeout(900);
    ok(`${tag} profile renders with a streak`, await p.evaluate(() => document.getElementById('profBody').textContent.length > 40), await p.evaluate(() => document.getElementById('profBody').textContent.slice(0, 80)));
    await p.screenshot({ path: `${OUT}/profile-${lang}-${w}.png` });
    await p.evaluate(() => window.__wayward.show('collection')); await p.waitForTimeout(900);
    const col = await p.evaluate(() => ({ books: [...document.querySelectorAll('#colList .sb')].map(e => e.getAttribute('data-bookid')), blank: [...document.querySelectorAll('#colList .sb-cv')].filter(e => !/url\(.+\)/.test(e.style.backgroundImage)).length, seals: document.querySelectorAll('#colList .ss').length }));
    ok(`${tag} collection: Books I-IV only, every cover shown, no seals`, col.books.length === 4 && !col.blank && !col.seals, col);
    await p.screenshot({ path: `${OUT}/collection-${lang}-${w}.png`, fullPage: true });
    ok(`${tag} puzzles for Books I-IV load`, await p.evaluate(async () => { const r = await fetch('puzzles.json').then(x => x.json()); return ['hollow-mountain', 'drowned-lighthouse', 'station-nine', 'ash-orchid'].every(k => r[k]); }));
    ok(`${tag} no page errors`, !log.errs.length, log.errs.slice(0, 3));
    ok(`${tag} no missing files`, !log.bad.length, log.bad.slice(0, 5));
    ok(`${tag} no network outside the app`, !log.ext.length, log.ext.slice(0, 3));
    await ctx.close();
  }
  // ---- a reader coming from 1.1.3: started Book II, bought Book III, never opened Book IV
  {
    const store = { 'wayward.drowned-lighthouse.v1': { page: 7, visited: [1, 4, 7], found: [] }, 'wayward.hollow-mountain.v1': { page: 3, visited: [1, 3], found: [] },
      'wayward.shop.v2': { v: 2, owned: {}, passUntil: 0, lifetime: false, day: '2026-10-14', free: { endings: 0, pages: 0 }, ads: 0 } };
    const { p, ctx, log } = await page(b, 412, { lang: 'nl', owned: ['book_stardust'], store });
    await p.evaluate(() => window.__wayward.show('library')); await p.waitForTimeout(1200);
    const sh = await shelf(p);
    ok('[1.1.3 reader] started Book II and bought Book III stay open, Book IV locked', JSON.stringify(sh) === JSON.stringify(['hollow-mountain:open', 'drowned-lighthouse:open', 'station-nine:open', 'ash-orchid:locked']), sh);
    const ent = await p.evaluate(() => JSON.parse(localStorage.getItem('wayward.shop.v2') || '{}'));
    ok('[1.1.3 reader] purchase restored, progress kept', ent.owned && ent.owned.book_stardust === true && (await p.evaluate(() => JSON.parse(localStorage.getItem('wayward.drowned-lighthouse.v1')).page)) === 7, { owned: ent.owned, unlocked: ent.unlocked });
    ok('[1.1.3 reader] no page errors', !log.errs.length, log.errs.slice(0, 3));
    await p.screenshot({ path: `${OUT}/library-upgrade-nl-412.png` });
    await ctx.close();
  }
  await b.close(); srv.kill();
  console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
