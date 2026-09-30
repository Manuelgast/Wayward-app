/* ==========================================================================
   shop.js v2 — Wayward: free endings, a daily allowance, rewarded ads, books and the Pass (T11)
   Model: Manuel 28-09 15:30 + W28 A + W26 A.
   - Free endings per book: Book I 8, Books II–IV 4 each (books.js freeEndings).
   - Every day, for all books you do not own together: 2 new endings or 6 new pages ("fases": a page with a
     choice), whichever runs out first. Rereading what you have read, and the first page, is always free.
   - A rewarded ad gives +2 endings and +6 pages for today, max 5 ads a day; ads also work once a book's free
     endings are used up.
   - A book €2 (book_<sku>), the Pass €5 a month (pass_monthly) or €20 for life (pass_lifetime): no limits.
   - All endings of a book found = that book is free for ever. Your progress always stays.
   - Hints and riddles are free (no candles).
   Switched OFF by default: then nothing is added to the page and every call runs the action for free.
   Switch: ?shop=1, localStorage 'wayward.shop.dev' = '1', or tap the credits title 5x (app.js).
   App build (launch, W27 A): store.js sets window.WAYWARD_SHOP = true before shop.js loads; then the shop is on
   for everyone and the test switch is hidden (it only shows without native WaywardBilling).

   STORE / AD ADAPTERS (the launch chat's store.js, loaded before shop.js in the app build)
     window.WaywardBilling = { products(), purchase(id), restore() -> [ids], active() -> [ids], manage() }
     window.WaywardAds = { show() -> resolves when a rewarded ad was watched in full, privacyOptions() }
   Product ids: book_mountain, book_sea, book_stardust, book_ash (one-off), pass_monthly (subscription),
   pass_lifetime (one-off). Without adapters: MockBilling (a confirm card, nothing is charged) and MockAds
   (a 5 s test ad; 1 s with ?fxlow=1).

   ENTITLEMENTS (localStorage 'wayward.shop.v2')
     { v: 2, owned: { book_sea: true, ... }, passUntil: ms, lifetime: bool,
       day: 'YYYY-MM-DD', free: { endings, pages }, ad: { endings, pages }, adsToday: n, used: { bookId: n } }
   ========================================================================== */
(function () {
  'use strict';
  var ENT_KEY = 'wayward.shop.v2', DEV_KEY = 'wayward.shop.dev', RECEIPT_KEY = 'wayward.mockbilling.receipts.v2';
  var PRICE = { book: 2, month: 5, lifetime: 20 };
  var DAY = { endings: 2, pages: 6 }, AD = { endings: 2, pages: 6, max: 5 };
  var MONTH_MS = 30 * 24 * 3600 * 1000;
  var AD_SECONDS = /[?&]fxlow=1/.test(location.search) ? 1 : 5;

  var STR = {
    en: {
      shopBtn: 'Shop', shopTitle: 'Wayward Shop', close: 'Close',
      todayHead: 'Free today', todayLine: '{e} endings · {p} pages left today', todayAd: '+{e} endings · +{p} pages from ads',
      todayNote: 'Every day, for the books you don’t own: 2 new endings or 6 new pages, whichever comes first. Rereading is always free.',
      adBtn: 'Watch an ad: +2 endings, +6 pages', adCount: '{n} of 5 ads today', adDone: 'No more ads today. Come back tomorrow.',
      booksHead: 'Books', bookFree: '{n} of {t} free endings left', bookFreeNone: 'Free endings used up: read on with ads, or buy it',
      bookOwned: 'Yours', bookDone: 'All endings found: free for ever', bookPassed: 'In your Pass', buy: 'Buy',
      passHead: 'Wayward Pass', passDesc: 'Every book, no limits, new books included.',
      month: '{p} a month', monthNote: 'Renews automatically every month until you cancel. Cancel any time in your Google Play or App Store subscriptions.',
      lifetime: '{p} for life', lifetimeNote: 'Pay once, keep it for ever.', passActive: 'Pass active', passLife: 'Pass for life', passUntil: 'Pass active until {d}',
      manage: 'Manage subscription', restore: 'Restore purchases', restoreDone: 'Purchases restored', restoreNone: 'Nothing to restore',
      privacy: 'Privacy policy', terms: 'Terms of use', freeFacts: 'Found every ending of a book? Then it is yours for free. Hints and riddles are always free.',
      testLabel: 'Test switch', testOff: 'Shop off',
      gateTitle: 'Your free pages for today are used up', gateEndTitle: 'This ending needs a key',
      gateBookTitle: 'The free endings of this book are used up',
      gateBody: 'Your progress stays. Tomorrow you get 2 endings and 6 pages again.',
      gateBookBody: 'Your progress stays. Watch an ad to read on, or make the book yours.',
      gateAd: 'Watch an ad: +2 endings, +6 pages', gateBuy: 'Buy {title} · {p}', gatePass: 'The Pass: every book', gateLater: 'Tomorrow',
      confirmTitle: 'Test version', confirmBody: 'Nothing is charged. In the store version this is a real purchase: {label} · {p}.', confirm: 'Confirm', cancel: 'Cancel',
      boughtBook: '{title} is yours', boughtPass: 'Welcome to the Pass',
      adTitle: 'Advertisement (test)', adWait: 'Ends in {n}…', adReward: '+2 endings · +6 pages', adFail: 'The ad did not play to the end',
      adsPrivacy: 'Ad privacy choices', pMonth: 'Pass · monthly', pLife: 'Pass · for life'
    },
    nl: {
      shopBtn: 'Winkel', shopTitle: 'Wayward-winkel', close: 'Sluiten',
      todayHead: 'Vandaag gratis', todayLine: 'Nog {e} eindes · {p} bladzijden vandaag', todayAd: '+{e} eindes · +{p} bladzijden van advertenties',
      todayNote: 'Elke dag, voor de boeken die je niet hebt: 2 nieuwe eindes of 6 nieuwe bladzijden, wat het eerst op is. Teruglezen is altijd gratis.',
      adBtn: 'Bekijk een advertentie: +2 eindes, +6 bladzijden', adCount: '{n} van 5 advertenties vandaag', adDone: 'Geen advertenties meer vandaag. Kom morgen terug.',
      booksHead: 'Boeken', bookFree: 'Nog {n} van {t} gratis eindes', bookFreeNone: 'Gratis eindes op: lees verder met advertenties, of koop het boek',
      bookOwned: 'Van jou', bookDone: 'Alle eindes gevonden: voor altijd gratis', bookPassed: 'In je Pass', buy: 'Kopen',
      passHead: 'Wayward Pass', passDesc: 'Alle boeken, zonder grenzen, ook de nieuwe.',
      month: '{p} per maand', monthNote: 'Wordt elke maand automatisch verlengd tot je opzegt. Opzeggen kan altijd bij je abonnementen in Google Play of de App Store.',
      lifetime: '{p} levenslang', lifetimeNote: 'Eén keer betalen, voor altijd.', passActive: 'Pass actief', passLife: 'Pass levenslang', passUntil: 'Pass actief tot {d}',
      manage: 'Abonnement beheren', restore: 'Aankopen herstellen', restoreDone: 'Aankopen hersteld', restoreNone: 'Niets om te herstellen',
      privacy: 'Privacybeleid', terms: 'Gebruiksvoorwaarden', freeFacts: 'Alle eindes van een boek gevonden? Dan is het voor altijd gratis. Hints en raadsels zijn altijd gratis.',
      testLabel: 'Testschakelaar', testOff: 'Winkel uit',
      gateTitle: 'Je gratis bladzijden voor vandaag zijn op', gateEndTitle: 'Dit einde vraagt een sleutel',
      gateBookTitle: 'De gratis eindes van dit boek zijn op',
      gateBody: 'Je voortgang blijft. Morgen krijg je weer 2 eindes en 6 bladzijden.',
      gateBookBody: 'Je voortgang blijft. Kijk een advertentie om verder te lezen, of maak het boek van jou.',
      gateAd: 'Bekijk een advertentie: +2 eindes, +6 bladzijden', gateBuy: 'Koop {title} · {p}', gatePass: 'De Pass: alle boeken', gateLater: 'Morgen verder',
      confirmTitle: 'Testversie', confirmBody: 'Er wordt niets afgerekend. In de winkelversie is dit een echte aankoop: {label} · {p}.', confirm: 'Bevestigen', cancel: 'Annuleren',
      boughtBook: '{title} is van jou', boughtPass: 'Welkom bij de Pass',
      adTitle: 'Advertentie (test)', adWait: 'Nog {n}…', adReward: '+2 eindes · +6 bladzijden', adFail: 'De advertentie is niet tot het eind afgespeeld',
      adsPrivacy: 'Privacykeuzes advertenties', pMonth: 'Pass · per maand', pLife: 'Pass · levenslang'
    }
  };

  var App = null, ent = null, built = false;
  function urlFlag() { return /(^|[?&])shop=1(&|$)/.test(location.search); }
  function devFlag() { try { return localStorage.getItem(DEV_KEY) === '1'; } catch (e) { return false; } }
  function enabled() { return window.WAYWARD_SHOP === true || urlFlag() || devFlag(); } // WAYWARD_SHOP: set by the app build (store.js), W27 A
  function lang() { return App ? App.lang() : 'en'; }
  function tt(k, v) { var s = (STR[lang()] && STR[lang()][k] != null) ? STR[lang()][k] : STR.en[k]; if (v) s = s.replace(/\{(\w+)\}/g, function (m, n) { return v[n] != null ? v[n] : m; }); return s; }
  function money(v) { var s = v % 1 ? v.toFixed(2) : String(v); if (lang() === 'nl') s = s.replace('.', ','); return '€' + s; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function shelf() { return (window.WAYWARD_BOOKS || []).filter(function (b) { return !b.soon; }); }
  function bookBySku(sku) { return (window.WAYWARD_BOOKS || []).filter(function (b) { return b.sku === sku; })[0]; }
  function E(s) { return App.esc(s); }

  /* ---------------- entitlements ---------------- */
  function fresh() { return { v: 2, owned: {}, passUntil: 0, lifetime: false, day: '', free: { endings: DAY.endings, pages: DAY.pages }, ad: { endings: 0, pages: 0 }, adsToday: 0, used: {} }; }
  function load() { try { var raw = localStorage.getItem(ENT_KEY); if (raw) { var o = JSON.parse(raw); if (o && o.v === 2) return Object.assign(fresh(), o); } } catch (e) {} return fresh(); }
  function persist() { try { localStorage.setItem(ENT_KEY, JSON.stringify(ent)); } catch (e) {} }
  function ensureDay() { var d = today(); if (ent.day !== d) { ent.day = d; ent.free = { endings: DAY.endings, pages: DAY.pages }; ent.ad = { endings: 0, pages: 0 }; ent.adsToday = 0; persist(); } }
  function passActive() { return ent.lifetime || ent.passUntil > Date.now(); }
  function bookState(bk) { // which of the reader's books is free for good, and how many of its free endings are left
    var st = bk.id === App.bookDef().id ? App.st() : readState(bk), book = bk.id === App.bookDef().id ? App.book() : null;
    var total = book ? Object.keys(book.sections).filter(function (k) { return book.sections[k].ending; }).length : (bk.totalEndings || 0);
    var done = total > 0 && (st.found || []).length >= total;
    return { owned: !!ent.owned[bk.sku], done: done, left: Math.max(0, (bk.freeEndings || 4) - (ent.used[bk.id] || 0)) };
  }
  function readState(bk) { try { var o = JSON.parse(localStorage.getItem(bk.store) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function unlimited(bk) { var s = bookState(bk); return passActive() || s.owned || s.done; }
  function grant(id) {
    if (id === 'pass_lifetime') ent.lifetime = true;
    else if (id === 'pass_monthly') ent.passUntil = Math.max(ent.passUntil, Date.now()) + MONTH_MS;
    else if (id.indexOf('book_') === 0) ent.owned[id] = true;
  }

  /* ---------------- the step the reader wants to take ---------------- */
  function cost(to) { // null = free; otherwise 'endings' or 'pages'
    var book = App.book(), st = App.st(), bk = App.bookDef(), sec = book && book.sections[String(to)];
    if (!sec || +to === +book.start || unlimited(bk)) return null;
    if (sec.ending) return (st.found || []).indexOf(+to) > -1 ? null : 'endings';
    return (st.visited || []).indexOf(+to) > -1 ? null : 'pages';
  }
  function spend(kind) {
    ensureDay(); var bk = App.bookDef();
    var freeOn = ent.free.endings > 0 && ent.free.pages > 0 && bookState(bk).left > 0; // 2 endings or 6 pages, whichever runs out first
    if (freeOn) { ent.free[kind]--; if (kind === 'endings') ent.used[bk.id] = (ent.used[bk.id] || 0) + 1; persist(); return true; }
    if (ent.ad[kind] > 0) { ent.ad[kind]--; persist(); return true; }
    return false;
  }
  function page(to, run) { // app.js calls this before it opens a page
    if (!enabled()) { run(); return; }
    var k = cost(to);
    if (!k || spend(k)) { run(); refresh(); return; }
    openGate(k, to, run);
  }
  function gate(kind, run) { run(); } // hints and riddles are free (W26 A)

  /* ---------------- store and ads ---------------- */
  var MockBilling = {
    products: function () { return Promise.resolve(catalog()); },
    purchase: function (id) { return confirmCard(id).then(function () { var r = receipts(); if (r.indexOf(id) < 0) r.push(id); try { localStorage.setItem(RECEIPT_KEY, JSON.stringify(r)); } catch (e) {} }); },
    restore: function () { return Promise.resolve(receipts()); },
    active: function () { return Promise.resolve(receipts()); }
  };
  function receipts() { try { var a = JSON.parse(localStorage.getItem(RECEIPT_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  var MockAds = { show: function () { return testAd(); } };
  function billing() { return window.WaywardBilling || MockBilling; }
  function ads() { return window.WaywardAds || MockAds; }
  function catalog() {
    var list = (window.WAYWARD_BOOKS || []).map(function (b) { return { id: b.sku, type: 'book', price: money(PRICE.book) }; });
    list.push({ id: 'pass_monthly', type: 'pass', period: 'month', price: money(PRICE.month) }, { id: 'pass_lifetime', type: 'pass', price: money(PRICE.lifetime) });
    return list;
  }
  function labelFor(id) { var b = bookBySku(id); return b ? bookTitle(b) : id === 'pass_monthly' ? tt('pMonth') : tt('pLife'); }
  // prices as the store shows them (local currency, from WaywardBilling.products() in the app build); our own € prices otherwise
  var STORE_PRICE = {};
  function storePrices(list) {
    if (!list) return; if (!Array.isArray(list)) list = Object.keys(list).map(function (k) { return typeof list[k] === 'object' ? Object.assign({ id: k }, list[k]) : { id: k, price: list[k] }; });
    list.forEach(function (p) { if (!p) return; var id = p.id || p.productId || p.identifier || p.productIdentifier || p.sku, pr = p.priceString || p.displayPrice || p.localizedPrice || p.formattedPrice || (typeof p.price === 'string' ? p.price : null);
      if (id && pr) STORE_PRICE[id] = String(pr); });
  }
  function pBook(sku) { return STORE_PRICE[sku] || money(PRICE.book); }
  function pMonth() { return STORE_PRICE.pass_monthly || money(PRICE.month); }
  function pLife() { return STORE_PRICE.pass_lifetime || money(PRICE.lifetime); }
  function priceFor(id) { return id === 'pass_monthly' ? tt('month', { p: pMonth() }) : id === 'pass_lifetime' ? pLife() : pBook(id); }
  function bookTitle(b) { var cur = App.bookDef(); if (cur && cur.id === b.id && App.book()) return App.book().title; return App.t(b.id === 'hollow-mountain' ? 'bookHollow' : b.id === 'drowned-lighthouse' ? 'bookLighthouse' : (b.titleKey || b.id)); }
  function buy(id, after) {
    billing().purchase(id).then(function () {
      grant(id); persist(); App.sfx('coin');
      App.toast(id.indexOf('book_') === 0 ? tt('boughtBook', { title: labelFor(id) }) : tt('boughtPass'), 1800);
      refresh(); if (after) after();
    }).catch(function () {});
  }
  function restore() {
    billing().restore().then(function (ids) {
      if (!ids || !ids.length) { App.toast(tt('restoreNone')); return; }
      ids.forEach(grant); persist(); App.toast(tt('restoreDone')); refresh();
    }).catch(function () { App.toast(tt('restoreNone')); });
  }
  function watchAd(after) {
    ensureDay(); if (ent.adsToday >= AD.max) return;
    ads().show().then(function () {
      ensureDay(); ent.adsToday++; ent.ad.endings += AD.endings; ent.ad.pages += AD.pages; persist();
      App.sfx('sparkle'); App.toast(tt('adReward'), 1500); refresh(); if (after) after();
    }).catch(function () { App.toast(tt('adFail')); });
  }

  /* ---------------- UI ---------------- */
  function css() {
    return '' +
      '.shop-ov{position:absolute;inset:0;z-index:70;background:rgba(6,4,16,.66)}' +
      '.shop-sheet{position:absolute;left:0;right:0;top:7%;bottom:0;z-index:71;display:flex;flex-direction:column;border-radius:24px 24px 0 0;background:linear-gradient(180deg,#241a48 0%,#150f34 55%,#0c0920 100%);border:1px solid rgba(255,255,255,.14);box-shadow:0 -20px 50px rgba(0,0,0,.5);animation:fadein .25s ease}' +
      '.shop-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 18px 8px}' +
      '.shop-head h3{margin:0;font-family:var(--serif);font-size:22px;font-weight:700;color:var(--gold2)}' +
      '.shop-x{width:38px;height:38px;border-radius:999px;display:grid;place-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:var(--text)}' +
      '.shop-body{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:2px 18px calc(22px + env(safe-area-inset-bottom,0px))}' +
      '.shop-sec{margin-top:18px}.shop-sec h4{margin:0 0 6px;font-family:var(--serif);font-size:17px;font-weight:700;color:var(--text)}' +
      '.shop-card{border-radius:16px;padding:13px 14px;background:rgba(10,8,24,.45);border:1px solid rgba(255,255,255,.12)}' +
      '.shop-today b{display:block;font-family:var(--serif);font-size:18px;color:var(--gold2)}.shop-today i{display:block;font-style:normal;font-size:12px;font-weight:700;color:var(--muted);margin-top:2px}' +
      '.shop-small{margin:8px 0 0;font-size:12px;line-height:1.45;color:var(--muted)}' +
      '.shop-adbtn{width:100%;margin-top:10px;min-height:44px;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:800;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.2);color:var(--text)}.shop-adbtn[disabled]{opacity:.45}' +
      '.shop-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid rgba(255,255,255,.08)}.shop-row:first-child{border-top:0}' +
      '.shop-cover{width:38px;height:54px;flex:0 0 38px;border-radius:4px;background-size:cover;background-position:center;box-shadow:0 3px 8px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.14)}' +
      '.shop-info{flex:1;min-width:0}.shop-info b{display:block;font-family:var(--serif);font-size:15.5px;line-height:1.2;color:var(--text)}.shop-info span{display:block;margin-top:2px;font-size:11.5px;font-weight:700;color:var(--muted)}' +
      '.shop-tag{flex:0 0 auto;padding:6px 11px;border-radius:999px;font-size:11.5px;font-weight:800;background:rgba(232,184,90,.14);border:1px solid rgba(232,184,90,.35);color:var(--gold2)}' +
      '.shop-buy{flex:0 0 auto;height:36px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:800;background:linear-gradient(180deg,#FDE7A8,#D9A248);color:#2A1A05;box-shadow:0 3px 0 #8A5A1C}' +
      '.shop-pass{background:linear-gradient(160deg,rgba(232,184,90,.14),rgba(124,92,255,.10));border-color:rgba(246,210,124,.4)}' +
      '.shop-plans{display:flex;gap:10px;margin-top:10px}.shop-plan{flex:1;min-width:0;border-radius:14px;padding:10px 8px;text-align:center;background:rgba(10,8,24,.5);border:1px solid rgba(255,255,255,.14);display:flex;flex-direction:column;gap:6px}' +
      '.shop-plan b{font-family:var(--serif);font-size:16px;color:var(--gold2)}.shop-plan i{font-style:normal;font-size:10.5px;line-height:1.35;color:var(--muted)}' +
      '.shop-plan button{margin-top:auto;height:34px;border-radius:999px;font-size:12.5px;font-weight:800;background:linear-gradient(180deg,#FDE7A8,#D9A248);color:#2A1A05}' +
      '.shop-links{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:14px}.shop-links a,.shop-linkbtn{font-size:12px;font-weight:700;color:var(--gold2);text-decoration:underline;text-underline-offset:2px;background:none}' +
      '.shop-foot{margin-top:18px;display:flex;flex-direction:column;gap:10px}' +
      '.shop-glass{height:40px;border-radius:999px;font-size:13px;font-weight:700;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);color:var(--text)}' +
      '.shop-dev{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;color:var(--dim)}.shop-dev button{font-size:11px;font-weight:700;color:var(--muted);text-decoration:underline;background:none}' +
      '.shop-gate{position:absolute;left:14px;right:14px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:73;padding:18px;border-radius:22px;background:linear-gradient(180deg,rgba(40,28,80,.97),rgba(14,10,34,.98));border:1px solid rgba(246,210,124,.35);box-shadow:0 20px 50px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:9px;animation:fadein .25s ease}' +
      '.shop-gate h3{margin:0;font-family:var(--serif);font-size:21px;line-height:1.15;color:var(--gold2)}.shop-gate p{margin:0 0 4px;font-family:var(--read);font-size:13.5px;line-height:1.5;color:var(--muted)}' +
      '.shop-gate .btn-gold,.shop-gate .btn-glass{width:100%}.shop-gate small{text-align:center;font-size:11px;font-weight:700;color:var(--dim)}' +
      '.shop-modal{position:absolute;inset:0;z-index:75;background:rgba(5,3,14,.75);display:grid;place-items:center;padding:24px}' +
      '.shop-mcard{width:100%;max-width:330px;padding:20px;border-radius:20px;background:#1B1440;border:1px solid rgba(255,255,255,.18);text-align:center;display:flex;flex-direction:column;gap:10px}' +
      '.shop-mcard h3{margin:0;font-family:var(--serif);font-size:20px;color:var(--gold2)}.shop-mcard p{margin:0;font-size:13px;line-height:1.5;color:var(--muted)}' +
      '.shop-adbox{height:150px;border-radius:14px;display:grid;place-items:center;background:repeating-linear-gradient(45deg,#2A2250 0 12px,#231C46 12px 24px);font-size:13px;font-weight:800;color:var(--text)}' +
      '.shop-mbtns{display:flex;gap:10px}.shop-mbtns button{flex:1}';
  }
  function build() {
    if (built) return; built = true;
    var st = document.createElement('style'); st.id = 'shopCss'; st.textContent = css(); document.head.appendChild(st);
    var tools = App.$('.lib-tools'), set = tools && tools.querySelector('[data-settings]');
    var btn = document.createElement('button'); btn.className = 'icon-btn solidbtn'; btn.id = 'shopLibBtn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>';
    if (tools) { if (set) tools.insertBefore(btn, set); else tools.appendChild(btn); }
    btn.addEventListener('click', function () { App.sfx('tap'); openShop(); });
    // Settings: the ad privacy choices (EU), only when the store build provides them
    var done = App.$('#setDone');
    if (done && window.WaywardAds && typeof window.WaywardAds.privacyOptions === 'function') {
      var pb = document.createElement('button'); pb.className = 'btn-glass sm cr-btn'; pb.id = 'shopAdsPrivacy'; done.parentNode.insertBefore(pb, done);
      pb.addEventListener('click', function () { try { window.WaywardAds.privacyOptions(); } catch (e) {} });
    }
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    refresh();
  }
  function shopHTML() {
    ensureDay();
    var h = '<div class="shop-sec"><h4>' + E(tt('todayHead')) + '</h4><div class="shop-card shop-today"><b>' + E(tt('todayLine', { e: ent.free.endings, p: ent.free.pages })) + '</b>' +
      (ent.ad.endings || ent.ad.pages ? '<i>' + E(tt('todayAd', { e: ent.ad.endings, p: ent.ad.pages })) + '</i>' : '') +
      '<p class="shop-small">' + E(tt('todayNote')) + '</p>' +
      (ent.adsToday < AD.max ? '<button class="shop-adbtn" data-shop="ad">' + E(tt('adBtn')) + '</button><p class="shop-small" style="text-align:center">' + E(tt('adCount', { n: ent.adsToday })) + '</p>' : '<p class="shop-small">' + E(tt('adDone')) + '</p>') +
      '</div></div>';
    h += '<div class="shop-sec"><h4>' + E(tt('booksHead')) + '</h4><div class="shop-card">';
    shelf().forEach(function (b) {
      var s = bookState(b), right;
      if (s.owned) right = '<span class="shop-tag">' + E(tt('bookOwned')) + '</span>';
      else if (s.done) right = '<span class="shop-tag">' + E(tt('bookDone').split(':')[0]) + '</span>';
      else if (passActive()) right = '<span class="shop-tag">' + E(tt('bookPassed')) + '</span>';
      else right = '<button class="shop-buy" data-shop="buy" data-id="' + b.sku + '">' + E(pBook(b.sku)) + '</button>';
      var sub = s.owned ? tt('bookOwned') : s.done ? tt('bookDone') : s.left > 0 ? tt('bookFree', { n: s.left, t: b.freeEndings || 4 }) : tt('bookFreeNone');
      h += '<div class="shop-row"><span class="shop-cover" style="background-image:url(' + (b.cover || '') + ')"></span><span class="shop-info"><b>' + E(bookTitle(b)) + '</b><span>' + E(sub) + '</span></span>' + right + '</div>';
    });
    h += '</div></div>';
    var pa = passActive();
    h += '<div class="shop-sec" id="shopPassSec"><h4>' + E(tt('passHead')) + '</h4><div class="shop-card shop-pass"><p class="shop-small" style="margin-top:0">' + E(tt('passDesc')) + '</p>';
    if (pa) h += '<p class="shop-small" style="color:var(--gold2);font-weight:800">' + E(ent.lifetime ? tt('passLife') : tt('passUntil', { d: new Date(ent.passUntil).toLocaleDateString(lang() === 'nl' ? 'nl-NL' : 'en-GB') })) + '</p>' +
      (!ent.lifetime && window.WaywardBilling && window.WaywardBilling.manage ? '<button class="shop-linkbtn" data-shop="manage">' + E(tt('manage')) + '</button>' : '');
    else h += '<div class="shop-plans"><div class="shop-plan"><b>' + E(tt('month', { p: pMonth() })) + '</b><i>' + E(tt('monthNote')) + '</i><button data-shop="buy" data-id="pass_monthly">' + E(tt('buy')) + '</button></div>' +
      '<div class="shop-plan"><b>' + E(tt('lifetime', { p: pLife() })) + '</b><i>' + E(tt('lifetimeNote')) + '</i><button data-shop="buy" data-id="pass_lifetime">' + E(tt('buy')) + '</button></div></div>' +
      (window.WaywardBilling && window.WaywardBilling.manage ? '<button class="shop-linkbtn" data-shop="manage" style="margin-top:10px">' + E(tt('manage')) + '</button>' : '');
    h += '</div></div>';
    var L = window.WAYWARD_LINKS || {};
    h += '<p class="shop-small">' + E(tt('freeFacts')) + '</p>' +
      '<div class="shop-foot"><button class="shop-glass" data-shop="restore">' + E(tt('restore')) + '</button>' +
      '<div class="shop-links">' + (L.privacy ? '<a href="' + E(L.privacy) + '" target="_blank" rel="noopener">' + E(tt('privacy')) + '</a>' : '') + (L.terms ? '<a href="' + E(L.terms) + '" target="_blank" rel="noopener">' + E(tt('terms')) + '</a>' : '') + '</div>' +
      (!window.WaywardBilling ? '<div class="shop-dev"><span>' + E(tt('testLabel')) + '</span><button data-shop="off">' + E(tt('testOff')) + '</button></div>' : '') + '</div>';
    return h;
  }
  function openShop(focus) {
    closeShop();
    var ov = document.createElement('div'); ov.className = 'shop-ov'; ov.id = 'shopOv';
    var sh = document.createElement('div'); sh.className = 'shop-sheet'; sh.id = 'shopSheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    sh.innerHTML = '<div class="shop-head"><h3>' + E(tt('shopTitle')) + '</h3><button class="shop-x" data-shop="close" aria-label="' + E(tt('close')) + '">✕</button></div><div class="shop-body" id="shopBody">' + shopHTML() + '</div>';
    App.app.appendChild(ov); App.app.appendChild(sh);
    ov.addEventListener('click', closeShop);
    sh.addEventListener('click', onShopClick);
    if (focus === 'pass') { var p = App.$('#shopPassSec'); if (p) p.scrollIntoView(); }
  }
  function closeShop() { ['#shopOv', '#shopSheet'].forEach(function (s) { var e = App.$(s); if (e) e.remove(); }); }
  function onShopClick(e) {
    var b = e.target.closest('[data-shop]'); if (!b) return;
    var a = b.getAttribute('data-shop');
    if (a === 'close') closeShop();
    else if (a === 'buy') { App.sfx('tap'); buy(b.getAttribute('data-id')); }
    else if (a === 'ad') watchAd();
    else if (a === 'restore') restore();
    else if (a === 'manage') { try { window.WaywardBilling.manage(); } catch (x) {} }
    else if (a === 'off') { try { localStorage.setItem(DEV_KEY, '0'); } catch (x) {} location.href = location.href.replace(/([?&])shop=1(&|$)/, '$1').replace(/[?&]$/, ''); }
  }
  function refresh() {
    var lb = App && App.$('#shopLibBtn'); if (lb) lb.setAttribute('aria-label', tt('shopBtn'));
    var pb = App && App.$('#shopAdsPrivacy'); if (pb) pb.textContent = tt('adsPrivacy');
    var body = App && App.$('#shopBody'); if (body) { var y = body.scrollTop; body.innerHTML = shopHTML(); body.scrollTop = y; }
  }

  /* the gate: a new page or ending when today's allowance (or a book's free endings) is used up */
  function openGate(kind, to, run) {
    closeGate(); ensureDay();
    var bk = App.bookDef(), bookOut = bookState(bk).left <= 0;
    var g = document.createElement('div'); g.className = 'shop-gate'; g.id = 'shopGate'; g.setAttribute('role', 'dialog');
    g.innerHTML = '<h3>' + E(bookOut ? tt('gateBookTitle') : kind === 'endings' ? tt('gateEndTitle') : tt('gateTitle')) + '</h3><p>' + E(bookOut ? tt('gateBookBody') : tt('gateBody')) + '</p>' +
      (ent.adsToday < AD.max ? '<button class="btn-gold sm" data-g="ad">' + E(tt('gateAd')) + '</button><small>' + E(tt('adCount', { n: ent.adsToday })) + '</small>' : '<small>' + E(tt('adDone')) + '</small>') +
      '<button class="btn-glass" data-g="buy">' + E(tt('gateBuy', { title: bookTitle(bk), p: pBook(bk.sku) })) + '</button>' +
      '<button class="btn-glass" data-g="pass">' + E(tt('gatePass')) + '</button>' +
      '<button class="btn-ghost" data-g="later">' + E(tt('gateLater')) + '</button>';
    App.app.appendChild(g);
    g.addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]'); if (!b) return; var a = b.getAttribute('data-g');
      if (a === 'later') { closeGate(); return; }
      if (a === 'pass') { closeGate(); openShop('pass'); return; }
      if (a === 'buy') { buy(bk.sku, function () { closeGate(); run(); }); return; }
      if (a === 'ad') watchAd(function () { closeGate(); if (!cost(to) || spend(kind)) run(); });
    });
  }
  function closeGate() { var g = App && App.$('#shopGate'); if (g) g.remove(); }

  /* the mock store: a confirm card and a test ad */
  function modal(html) { var m = document.createElement('div'); m.className = 'shop-modal'; m.innerHTML = '<div class="shop-mcard">' + html + '</div>'; App.app.appendChild(m); return m; }
  function confirmCard(id) {
    return new Promise(function (res, rej) {
      var m = modal('<h3>' + E(tt('confirmTitle')) + '</h3><p>' + E(tt('confirmBody', { label: labelFor(id), p: priceFor(id) })) + '</p><div class="shop-mbtns"><button class="btn-glass" data-m="no">' + E(tt('cancel')) + '</button><button class="btn-gold sm" data-m="yes">' + E(tt('confirm')) + '</button></div>');
      m.addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (!b) return; m.remove(); if (b.getAttribute('data-m') === 'yes') res(); else rej(new Error('cancel')); });
    });
  }
  function testAd() {
    return new Promise(function (res) {
      var n = AD_SECONDS, m = modal('<h3>' + E(tt('adTitle')) + '</h3><div class="shop-adbox" id="shopAdBox">' + E(tt('adWait', { n: n })) + '</div>');
      var iv = setInterval(function () { n--; var bx = m.querySelector('#shopAdBox'); if (n > 0) { if (bx) bx.textContent = tt('adWait', { n: n }); } else { clearInterval(iv); m.remove(); res(); } }, 1000);
    });
  }

  /* ---------------- start ---------------- */
  function init(app) {
    App = app; ent = load(); ensureDay();
    if (!enabled()) return;
    build();
    if (window.WaywardBilling && window.WaywardBilling.products) { try { Promise.resolve(window.WaywardBilling.products()).then(function (l) { storePrices(l); refresh(); }).catch(function () {}); } catch (e) {} }
    if (window.WaywardBilling && window.WaywardBilling.active) { // what the store says is active now (the Pass per month may have lapsed)
      window.WaywardBilling.active().then(function (ids) { ids = ids || []; if (ids.indexOf('pass_monthly') < 0 && !ent.lifetime) ent.passUntil = 0; ids.forEach(grant); persist(); refresh(); }).catch(function () {});
    }
  }
  window.WaywardShop = { enabled: enabled, init: init, gate: gate, page: page, open: function (f) { if (enabled()) openShop(f); },
    _ent: function () { return ent; }, _reset: function () { ent = fresh(); persist(); refresh(); } };
})();
