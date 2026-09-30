/* Wayward store bridge (Android and iOS, packaging layer).
   Gives shop.js real purchases and rewarded ads through the adapter it already expects:
     window.WaywardBilling = { products(), purchase(id), restore() }   (+ active(), manage())
     window.WaywardAds     = { show() }                                 (+ privacyOptions())
   Purchases: Google Play Billing / StoreKit 2 via @capgo/native-purchases.
   Ads: AdMob rewarded ads via @capacitor-community/admob, after Google's consent form (UMP) and, on iOS,
   Apple's tracking question (ATT).
   Loaded right after native.js and before app.js/shop.js, and only when the web book contains shop.js.
   Inside a plain browser it does nothing, so shop.js keeps its own test mocks there.
   Settings (product ids, ad units, test mode) come from window.WAYWARD_STORE, written at build time from
   app/store-config.json. No secrets live here. */
(function () {
  'use strict';
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform() || !cap.nativePromise) return;
  var CFG = window.WAYWARD_STORE || {};
  var platform = cap.getPlatform();
  var PRODUCTS = CFG.products || [];

  // The store build always shows the shop: shop.js v2 reads this switch when it starts.
  try { localStorage.setItem('wayward.shop.dev', '1'); } catch (e) {}
  // Links in the shop: the privacy policy everywhere, Apple's standard terms of use only on iPhone.
  var LINKS = CFG.links || {};
  window.WAYWARD_LINKS = { privacy: LINKS.privacy, terms: platform === 'ios' ? LINKS.termsIos : LINKS.termsAndroid };

  function call(plugin, method, opts) { return cap.nativePromise(plugin, method, opts || {}); }
  function conf(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return { id: id, kind: 'inapp', type: 'book' }; }
  function ids(kind) { return PRODUCTS.filter(function (p) { return (p.kind === 'subs') === (kind === 'subs'); }).map(function (p) { return p.id; }); }

  /* ---------------- purchases ---------------- */
  var billingOk = null;
  function billingSupported() {
    if (!billingOk) billingOk = call('NativePurchases', 'isBillingSupported').then(function (r) { return !!(r && r.isBillingSupported); }).catch(function () { return false; });
    return billingOk;
  }
  function query(kind) { // one query at a time: the billing client does not like parallel product queries
    var list = ids(kind);
    if (!list.length) return Promise.resolve([]);
    return call('NativePurchases', 'getProducts', { productIdentifiers: list, productType: kind }).then(function (r) { return (r && r.products) || []; });
  }
  function owned() { // product ids the store says this user owns right now
    var opts = platform === 'ios' ? { onlyCurrentEntitlements: true } : {};
    return call('NativePurchases', 'getPurchases', opts).then(function (r) {
      var out = {};
      ((r && r.purchases) || []).forEach(function (t) {
        if (!t || !t.productIdentifier) return;
        if (platform === 'android' && t.purchaseState !== undefined && String(t.purchaseState) !== '1' && String(t.purchaseState).toUpperCase() !== 'PURCHASED') return;
        if (t.revocationDate) return;
        if (t.isActive === false) return;
        out[t.productIdentifier] = true;
      });
      return Object.keys(out);
    });
  }

  window.WaywardBilling = {
    products: function () {
      return billingSupported().then(function (ok) {
        if (!ok) return [];
        var found = [];
        return query('inapp').then(function (a) { found = found.concat(a); return query('subs'); }).then(function (b) {
          found = found.concat(b);
          return found.map(function (p) { var c = conf(p.identifier); return { id: p.identifier, type: c.type, price: p.priceString, period: c.period }; });
        });
      });
    },
    purchase: function (id) {
      var c = conf(id);
      var o = { productIdentifier: id, productType: c.kind === 'subs' ? 'subs' : 'inapp' };
      if (c.kind === 'subs' && platform === 'android' && c.plan) o.planIdentifier = c.plan;
      return call('NativePurchases', 'purchaseProduct', o).then(function (t) {
        if (!t || !t.productIdentifier) throw new Error('purchase not confirmed');
        return t;
      });
    },
    restore: function () {
      var sync = platform === 'ios' ? call('NativePurchases', 'restorePurchases').catch(function () {}) : Promise.resolve();
      return sync.then(owned);
    },
    active: owned,   // for shop.js: re-check the Pass on start without a restore sync
    manage: function () { return call('NativePurchases', 'manageSubscriptions'); }
  };

  /* ---------------- rewarded ads ---------------- */
  var AD = CFG.ads || {};
  var unit = (AD[platform] || {}).rewarded;
  var testing = !!AD.testing;
  var adsInit = null;
  function initAds() {
    if (adsInit) return adsInit;
    var info = null;
    adsInit = call('AdMob', 'initialize', { initializeForTesting: testing })
      .then(function () { return call('AdMob', 'requestConsentInfo', {}); })
      .then(function (i) {
        info = i;
        if (i && i.isConsentFormAvailable && i.status === 'REQUIRED') return call('AdMob', 'showConsentForm').then(function (j) { info = j || info; });
      })
      .then(function () {
        if (platform !== 'ios') return;
        return call('AdMob', 'trackingAuthorizationStatus').then(function (s) {
          if (s && s.status === 'notDetermined') return call('AdMob', 'requestTrackingAuthorization');
        }).catch(function () {});
      })
      .then(function () { return info || {}; })
      .catch(function (e) { adsInit = null; throw e; });
    return adsInit;
  }

  window.WaywardAds = {
    show: function () {
      if (!unit) return Promise.reject(new Error('no ad unit'));
      return initAds().then(function (info) {
        if (info && info.canRequestAds === false) throw new Error('no consent for ads');
        return new Promise(function (resolve, reject) {
          var rewarded = false, done = false, subs = [];
          function finish(ok, err) {
            if (done) return; done = true;
            subs.forEach(function (s) { try { s.remove(); } catch (e) {} });
            if (ok) resolve(); else reject(err || new Error('ad closed early'));
          }
          function on(ev, fn) { subs.push(cap.addListener('AdMob', ev, fn)); }
          on('onRewardedVideoAdReward', function () { rewarded = true; });
          on('onRewardedVideoAdDismissed', function () { finish(rewarded); });
          on('onRewardedVideoAdFailedToShow', function (e) { finish(false, e); });
          call('AdMob', 'prepareRewardVideoAd', { adId: unit, isTesting: testing, immersiveMode: true })
            .then(function () { return call('AdMob', 'showRewardVideoAd', { adId: unit }); })
            .catch(function (e) { finish(false, e); });
          setTimeout(function () { finish(rewarded, new Error('ad timeout')); }, 180000);
        });
      });
    },
    privacyOptions: function () { return initAds().then(function () { return call('AdMob', 'showPrivacyOptionsForm'); }); }
  };
})();
