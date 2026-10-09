// Unit test of app/store.js with a fake Capacitor bridge (the real plugins only exist on a phone).
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../app/store.js', 'utf8');
const cfg = JSON.parse(fs.readFileSync(__dirname + '/../app/store-config.json', 'utf8'));
function make(platform, script) {
  const calls = [], listeners = {};
  const cap = {
    isNativePlatform: () => true, getPlatform: () => platform,
    nativePromise: (p, m, o) => { calls.push([p, m, o]); return Promise.resolve(script(p, m, o, listeners)); },
    addListener: (p, ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); return { remove: () => { listeners[ev] = listeners[ev].filter(f => f !== fn); } }; }
  };
  const win = { Capacitor: cap, WAYWARD_STORE: cfg };
  vm.runInNewContext(src, { window: win, setTimeout: st, Promise, Object, String, Error });
  return { win, calls, listeners };
}
const st = (fn, ms) => { const h = setTimeout(fn, ms); if (ms > 1000 && h.unref) h.unref(); return h; };
const fire = (l, ev, arg) => (l[ev] || []).slice().forEach(f => f(arg));
let fails = 0; const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); if (!cond) fails++; };
(async () => {
  // products + purchase on Android
  let t = make('android', (p, m, o) => {
    if (m === 'isBillingSupported') return { isBillingSupported: true };
    if (m === 'getProducts') return { products: o.productIdentifiers.map(id => ({ identifier: id, priceString: id.startsWith('pass_m') ? '€ 4,99' : '€ 1,99' })) };
    if (m === 'purchaseProduct') return { productIdentifier: o.productIdentifier, transactionId: 'GPA.1' };
    if (m === 'getPurchases') return { purchases: [{ productIdentifier: 'book_sea', purchaseState: '1' }, { productIdentifier: 'book_ash', purchaseState: '0' }, { productIdentifier: 'pass_lifetime', purchaseState: 'PURCHASED' }] };
  });
  const prods = await t.win.WaywardBilling.products();
  ok('products: all ' + cfg.products.length + ' items with prices', prods.length === cfg.products.length && cfg.products.length === 14 && prods.every(p => p.price), JSON.stringify(prods.map(p => p.id + ' ' + p.price)));
  const q = t.calls.filter(c => c[1] === 'getProducts');
  ok('products: inapp and subs queried one after another', q.length === 2 && q[0][2].productType === 'inapp' && q[1][2].productType === 'subs');
  await t.win.WaywardBilling.purchase('pass_monthly');
  const pc = t.calls.find(c => c[1] === 'purchaseProduct')[2];
  ok('purchase: Pass monthly as subscription with base plan', pc.productType === 'subs' && pc.planIdentifier === 'monthly', JSON.stringify(pc));
  const owned = await t.win.WaywardBilling.restore();
  ok('restore: only purchased items', JSON.stringify(owned.sort()) === JSON.stringify(['book_sea', 'pass_lifetime']), JSON.stringify(owned));
  // iOS restore: sync first, revoked and expired left out
  t = make('ios', (p, m, o) => {
    if (m === 'getPurchases') return { purchases: [{ productIdentifier: 'book_sea' }, { productIdentifier: 'pass_monthly', isActive: false }, { productIdentifier: 'book_ash', revocationDate: '2026-09-01' }] };
  });
  const iosOwned = await t.win.WaywardBilling.restore();
  ok('iOS restore: restorePurchases first, then current entitlements', t.calls[0][1] === 'restorePurchases' && t.calls[1][2].onlyCurrentEntitlements === true);
  ok('iOS restore: expired Pass and revoked book left out', JSON.stringify(iosOwned) === '["book_sea"]', JSON.stringify(iosOwned));
  // ads: consent required -> form, reward then dismiss -> resolve
  let consentShown = false;
  t = make('android', (p, m, o, l) => {
    if (m === 'requestConsentInfo') return { status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false };
    if (m === 'showConsentForm') { consentShown = true; return { status: 'OBTAINED', canRequestAds: true }; }
    if (m === 'showRewardVideoAd') { setTimeout(() => { fire(l, 'onRewardedVideoAdReward', { amount: 1 }); fire(l, 'onRewardedVideoAdDismissed'); }, 10); return { amount: 1 }; }
    return {};
  });
  let r = await t.win.WaywardAds.show().then(() => 'resolved', e => 'rejected: ' + e.message);
  ok('ad watched in full: consent form first, then resolves', consentShown && r === 'resolved', r);
  const prep = t.calls.find(c => c[1] === 'prepareRewardVideoAd')[2];
  ok('ad uses the rewarded unit from the config, live ads for the store release (isTesting false)', prep.adId === cfg.ads.android.rewarded && prep.isTesting === false);
  // ads: closed early -> reject; initialize only once
  t = make('ios', (p, m, o, l) => {
    if (m === 'requestConsentInfo') return { status: 'NOT_REQUIRED', canRequestAds: true };
    if (m === 'trackingAuthorizationStatus') return { status: 'notDetermined' };
    if (m === 'showRewardVideoAd') { setTimeout(() => fire(l, 'onRewardedVideoAdDismissed'), 10); return new Promise(() => {}); }
    return {};
  });
  r = await t.win.WaywardAds.show().then(() => 'resolved', e => 'rejected: ' + e.message);
  ok('ad closed early: rejects (no reward)', r.startsWith('rejected'), r);
  ok('iOS: asks the tracking question once, after consent', t.calls.some(c => c[1] === 'requestTrackingAuthorization'));
  await t.win.WaywardAds.show().catch(() => {});
  ok('AdMob initialised only once', t.calls.filter(c => c[1] === 'initialize').length === 1);
  // no consent -> no ad request
  t = make('android', (p, m) => m === 'requestConsentInfo' ? { status: 'REQUIRED', isConsentFormAvailable: true } : m === 'showConsentForm' ? { status: 'REQUIRED', canRequestAds: false } : {});
  r = await t.win.WaywardAds.show().then(() => 'resolved', e => 'rejected: ' + e.message);
  ok('no consent: no ad is requested', r.startsWith('rejected') && !t.calls.some(c => c[1] === 'prepareRewardVideoAd'), r);
  // plain browser: bridge stays out of the way
  const win = { Capacitor: undefined };
  vm.runInNewContext(src, { window: win, setTimeout: st, Promise, Object, String, Error });
  ok('web: no WaywardBilling/WaywardAds (shop.js keeps its mocks)', !win.WaywardBilling && !win.WaywardAds);
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
