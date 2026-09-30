/* Wayward prototype: The Hollow Mountain. Reader with video scenes, ink text, page turns, scenes, relics, EN/NL. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var app = $('#app');
  var I18N = window.WAYWARD_I18N, IL = window.WAYWARD_INTERLUDES || {}, FX = window.WaywardFX;
  var AU = window.WaywardAudio || { unlock: function () {}, setScene: function () {}, sfx: function () {}, setMusic: function () {}, setSfx: function () {}, setVolume: function () {}, tracks: function () {}, duck: function () {}, state: function () { return {}; } };
  var SHELF = (window.WAYWARD_BOOKS || [{ id: 'hollow-mountain', no: 1, file: 'book', relics: 'relics.json', store: 'wayward.hollow-mountain.v1', coverScene: 'mountain', veil: 'fog', ui: 'compass', creep: { 22: 'fog' }, roles: { edge: 'gilt', map: 'honestmap', secret: 'margin' } }]);
  var BK = SHELF[0]; // the book that is open on the shelf (T10: every book keeps its own progress, endings and relics)
  function bookById(id) { return SHELF.filter(function (b) { return b.id === id && !b.soon; })[0]; }
  var PREF = 'wayward.prefs.v1';
  var VEIL = 'fog'; // this book's intro veil: mist for Book I, sea spray for Book II, later ash and stardust
  var BOOKS = {}, BOOK, S, KEYS, ENDS, TOTAL_END, REL;
  var fresh = function () { return { page: null, trail: [], visited: [], found: [], finger: null, lastNew: null, relics: [], scenes: [], hint: 0 }; };
  var st = fresh();
  var prefs = { lang: /^nl\b/i.test(navigator.language || '') ? 'nl' : 'en', music: true, sfx: true, speed: 'read' };
  var lang = 'en', current = 'library', prevScreen = 'library';
  var timers = [], tick = null;
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; if (tick) { clearInterval(tick); tick = null; } }
  function loadState() { try { var raw = localStorage.getItem(BK.store); if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') Object.assign(st, o); } } catch (e) {} }
  function load() { try { var p = localStorage.getItem(PREF); if (p) Object.assign(prefs, JSON.parse(p)); } catch (e) {} BK = bookById(prefs.book) || SHELF[0]; VEIL = BK.veil || 'fog'; loadState(); }
  function save() { try { localStorage.setItem(BK.store, JSON.stringify(st)); } catch (e) {} }
  function savePrefs() { try { localStorage.setItem(PREF, JSON.stringify(prefs)); } catch (e) {} }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function t(k, v) { var s = (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k; if (v) s = s.replace(/\{(\w+)\}/g, function (m, n) { return v[n] != null ? v[n] : m; }); return s; }
  function L(o) { return o ? (o[lang] || o.en || '') : ''; }
  function strip(s) { return String(s).replace(/\[\[\w+\|([^\]]+)\]\]/g, '$1'); }
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
  var SPEED = { calm: 185, read: 138, fast: 100 };

  function particles(el) {
    var n = +(el.getAttribute('data-n') || 10), h = '';
    for (var i = 0; i < n; i++) {
      var l = (Math.random() * 100).toFixed(1), tp = (35 + Math.random() * 60).toFixed(1), d = (4 + Math.random() * 5).toFixed(1), dl = (-Math.random() * 8).toFixed(1), s = (1.5 + Math.random() * 2.5).toFixed(1);
      h += '<i style="left:' + l + '%;top:' + tp + '%;width:' + s + 'px;height:' + s + 'px;animation-duration:' + d + 's;animation-delay:' + dl + 's"></i>';
    }
    el.innerHTML = h;
  }
  function tilt(stageSel, screenSel, amt) {
    var stage = $(stageSel), scr = $(screenSel); if (!stage || !scr) return;
    scr.addEventListener('pointermove', function (e) { var r = scr.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; stage.style.transform = 'rotateY(' + (x * amt).toFixed(2) + 'deg) rotateX(' + (-y * amt * .6).toFixed(2) + 'deg)'; });
    scr.addEventListener('pointerleave', function () { stage.style.transform = ''; });
  }
  function toast(msg, ms) { var el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, ms || 1800); }

  /* ---------------- language ---------------- */
  function applyI18n() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-html]').forEach(function (el) { var k = el.getAttribute('data-i18n-html'); el.innerHTML = k === 'libTitle' ? libTitle() : t(k); });
    $$('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    $$('[data-book="title"]').forEach(function (el) { el.textContent = BOOK ? BOOK.title : ''; });
    $$('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false'); });
    $('#heroHit').setAttribute('aria-label', t('aboutBook', { title: BOOK ? BOOK.title : '' }));
    $('#shelfBook').setAttribute('aria-label', BOOK ? BOOK.title : '');
    $$('[data-soon]').forEach(function (b) { b.setAttribute('aria-label', t('soonToast', { title: t(b.getAttribute('data-title')) })); });
    $('#mapSvg').setAttribute('aria-label', t('mapAria'));
  }
  function normBook(b) {
    Object.keys(b.sections).forEach(function (k) { var s = b.sections[k]; s.choices = (s.choices || []).map(function (c) { c.to = +c.to; return c; }); if (s.moment) s.moment.default = +s.moment.default; });
    return b;
  }
  function getBook(l) {
    var key = BK.file + '.' + l;
    if (BOOKS[key]) return Promise.resolve(BOOKS[key]);
    return fetch(key + '.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (b) { BOOKS[key] = normBook(b); return BOOKS[key]; });
  }
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  var IL_HOME = {}; Object.keys(IL).forEach(function (k) { IL_HOME[k] = IL[k]; }); // Book I's scenes (i18n.js + scenes2.js)
  var ILSETS = { 'hollow-mountain': IL_HOME };
  function setIL(set) { Object.keys(IL).forEach(function (k) { delete IL[k]; }); Object.keys(set).forEach(function (k) { IL[k] = set[k]; }); }
  function fixIL(raw) { // another book's scenes: positions on its pictures, its own veil for wiping
    var out = {}; Object.keys(raw).forEach(function (k) { var il = Object.assign({}, raw[k]), sp = BK.spots && BK.spots[k];
      if (il.x == null && sp) { il.x = sp[0]; il.y = sp[1]; } if (il.x == null) { il.x = 50; il.y = 45; }
      if (il.type === 'wipe' && !il.preset) il.preset = BK.veil || 'fog'; out[k] = il; }); return out; }
  function fixRelics(r) { (r.relics || []).forEach(function (x) { var sp = BK.relicSpots && BK.relicSpots[x.id]; if (x.where === 'scene' && x.x == null && sp) { x.x = sp[0]; x.y = sp[1]; } }); return r; }
  function loadBookData() { // texts, relics and scenes of the open book
    return Promise.all([getBook(lang), getJSON(BK.relics), BK.interludes && !ILSETS[BK.id] ? getJSON(BK.interludes) : Promise.resolve(null)]).then(function (res) {
      useBook(res[0]); REL = fixRelics(res[1]); if (res[2]) ILSETS[BK.id] = fixIL(res[2]); setIL(ILSETS[BK.id] || {});
      st.visited = st.visited.filter(function (k) { return S[k]; }); st.found = st.found.filter(function (k) { return S[k]; });
      st.relics = st.relics.filter(function (id) { return relic(id); }); if (st.page && !S[st.page]) st.page = null;
      LAYOUT = null; app.dataset.book = BK.id;
    });
  }
  function switchBook(id) { // open another book from the shelf: its own progress, endings and relics
    var nb = bookById(id); if (!nb) return Promise.resolve(false);
    if (nb === BK && BOOK) return Promise.resolve(true);
    save(); BK = nb; prefs.book = nb.id; savePrefs(); VEIL = nb.veil || 'fog';
    st = fresh(); loadState(); R.p = null; BG.cur = null;
    return loadBookData().then(function () { applyI18n(); return true; });
  }
  function PN(k) { var s = S[k]; return s && s.nr ? s.nr : k; } // the page number a reader sees (1..N, no gaps); ids stay internal
  function useBook(b) {
    BOOK = b; S = {};
    Object.keys(b.sections).forEach(function (k) { S[+k] = b.sections[k]; });
    if (BK.no && !b.no) b.no = BK.no;
    KEYS = Object.keys(S).map(Number); ENDS = KEYS.filter(function (k) { return S[k].ending; }); TOTAL_END = ENDS.length;
  }
  function setLang(l) {
    if (l !== 'en' && l !== 'nl') return Promise.resolve();
    return getBook(l).then(function (b) {
      lang = l; prefs.lang = l; savePrefs(); useBook(b); LAYOUT = null; applyI18n();
      if (current === 'reader') renderReader({ keepSheet: true, instant: true });
      else if (current !== 'moment') { var r = RENDER[current]; if (r) r(); }
      if (!$('#settings').hidden) renderSettings();
    });
  }

  /* ---------------- background scene (still + video loops) ---------------- */
  var BG = { cur: null, a: $('#bgA'), b: $('#bgB'), img: $('#bgImg'), flip: false };
  var probe = document.createElement('video');
  var MP4 = !!(probe.canPlayType && probe.canPlayType('video/mp4; codecs="avc1.640028"'));
  function focusOf(scene) { return (BOOK && BOOK.scenes[scene] && BOOK.scenes[scene].focus) || '50% 50%'; }
  function bgScene(scene) {
    if (!scene) return;
    if (BG.cur === scene) { playActive(); return; }
    BG.cur = scene;
    var focus = focusOf(scene), next = BG.flip ? BG.a : BG.b, prev = BG.flip ? BG.b : BG.a, shown = false;
    BG.flip = !BG.flip;
    BG.img.style.objectPosition = focus; BG.img.src = 'img/' + scene + '.webp';
    next.style.objectPosition = focus;
    function reveal() {
      if (shown || BG.cur !== scene) return; shown = true;
      next.playbackRate = 0.85; next.classList.add('on'); prev.classList.remove('on');
      setTimeout(function () { if (!prev.classList.contains('on')) prev.pause(); }, 950);
    }
    next.onloadeddata = reveal; next.onplaying = reveal;
    if (BK.noVideo) { BG.a.classList.remove('on'); BG.b.classList.remove('on'); BG.a.pause(); BG.b.pause(); return; } // (temporary pictures, no loops yet)
    vidURL(scene).then(function (u) {
      if (BG.cur !== scene) return;
      next.src = u; next.defaultPlaybackRate = 0.85; next.playbackRate = 0.85;
      if (app.dataset.bg !== 'off') { var p = next.play(); if (p && p.catch) p.catch(function () {}); }
    });
    setTimeout(function () { if (!shown && BG.cur === scene) prev.classList.remove('on'); }, 2500); // still picture stays as fallback
  }
  var VID = {}; // scene -> object URL; small loops are fetched whole so playback never depends on server range requests
  function vidURL(scene) {
    if (VID[scene]) return VID[scene];
    var path = 'vid/' + scene + (MP4 ? '.mp4' : '.webm');
    VID[scene] = fetch(path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function (b) { return URL.createObjectURL(b); }).catch(function () { return path; });
    return VID[scene];
  }
  function activeVideo() { return BG.a.classList.contains('on') ? BG.a : BG.b.classList.contains('on') ? BG.b : null; }
  function playActive() { var v = activeVideo(); if (v && v.paused && app.dataset.bg !== 'off') { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
  function bgMode(m) { app.dataset.bg = m; if (m === 'off') { BG.a.pause(); BG.b.pause(); } else playActive(); }
  function mapPt(xp, yp, host) { // scene picture percentages -> px inside host
    var r = $('#bg').getBoundingClientRect(), hr = (host || app).getBoundingClientRect();
    var sc = Math.max(r.width / 720, r.height / 1280), w = 720 * sc, h = 1280 * sc, f = focusOf(BG.cur).split(' ').map(parseFloat);
    return { x: r.left - hr.left + (r.width - w) * f[0] / 100 + xp / 100 * w, y: r.top - hr.top + (r.height - h) * f[1] / 100 + yp / 100 * h };
  }

  /* ---------------- screens ---------------- */
  var SCREEN_BG = { library: 'off', cover: 'top', reader: 'full', moment: 'full', ending: 'top', map: 'off', endings: 'off', relics: 'off', secret: 'off' };
  var MCREEP = null; // the fog of a timed moment: its drawing loop must stop when the moment is over
  function show(id) {
    clearTimers(); stopReader();
    if (MCREEP && id !== 'moment') { MCREEP.destroy(); MCREEP = null; }
    if (id !== 'reader' && id !== 'moment') dropSmoke();
    if (id !== current) prevScreen = current;
    current = id;
    $$('.screen').forEach(function (s) { s.hidden = s.id !== id; });
    var tabbed = id === 'library' || id === 'map' || id === 'endings' || id === 'relics';
    $('#tabbar').hidden = !tabbed;
    $$('.tab').forEach(function (tb) { if (tb.getAttribute('data-tab') === id) tb.setAttribute('aria-current', 'page'); else tb.removeAttribute('aria-current'); });
    closeSheet(); closeSettings();
    bgMode(SCREEN_BG[id] || 'off');
    if (id === 'library' || id === 'cover') AU.setScene('menu');
    if (id === 'secret') AU.setScene('secret');
    var r = RENDER[id]; if (r) r();
  }

  /* ---------------- navigation ---------------- */
  var justArrived = false;
  function commit(p, opts) {
    opts = opts || {}; p = Number(p);
    if (opts.push !== false && st.trail[st.trail.length - 1] !== p) st.trail.push(p);
    st.page = p;
    R.fresh = st.visited.indexOf(p) === -1; R.arrived = true; // arrived by navigation (not a re-render): a scene may play
    if (R.fresh) st.visited.push(p);
    st.lastNew = null;
    if (S[p].ending && st.found.indexOf(p) === -1) { st.found.push(p); st.lastNew = p; }
    save();
  }
  function goTo(p, opts) {
    opts = opts || {}; commit(p, opts);
    if (S[st.page].moment && !opts.asText) show('moment'); else show('reader');
  }
  function startBook() { st.trail = []; st.page = null; save(); goTo(BOOK.start); }
  function resume() { if (st.page && S[st.page]) goTo(st.page, { push: false }); else startBook(); }
  function openBook(fn) {
    AU.unlock();
    if (reduceMotion) { fn(); return; }
    R.intro = true;
    app.classList.add('fast-bg'); setTimeout(function () { app.classList.remove('fast-bg'); }, 1800);
    introMist(function (release) { fn(); if (current !== 'reader') R.intro = false; release(); },
      function () { $('#tome').classList.remove('intro'); },
      function () { if (current === 'reader' && R.intro) { R.intro = false; afterArrive(); } else R.intro = false; });
  }
  /* the mist rolls in from every side and towards you, the book appears in a puff, and what is left of the
     smoke lingers on the pages, drifting when you touch it */
  var SMK = null, SMK_T = null;
  function dropSmoke() { clearTimeout(SMK_T); if (SMK) { SMK.destroy(); SMK = null; } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function introMist(onCovered, onBurst, onDone) {
    var W = app.clientWidth, H = app.clientHeight;
    dropSmoke();
    // the full mist once a day; after that a short breath of it
    var short = prefs.introDay === today() && !/[?&]intro=full/.test(location.search);
    if (!short) { prefs.introDay = today(); savePrefs(); }
    var T = short ? { n: 4, iv: 70, cov: 180, covA: '.6', at: 520, poof: 170, wisps: 5, puffs: 4 } : { n: 9, iv: 90, cov: 620, covA: '.78', at: 1150, poof: 260, wisps: 8, puffs: 7 };
    R.introShort = short;
    var low = /[?&]fxlow=1/.test(location.search), sm = window.WaywardSmoke && window.WaywardSmoke.create(app, { dissipation: 0.9, velDissipation: 0.35, curl: 30, pointerTarget: app, wipe: true, sim: low ? 48 : 0, dye: low ? 160 : 0, iter: low ? 4 : 0 });
    AU.sfx('fogin', short ? { gain: 0.6 } : {});
    var DYE = VEIL === 'sea' ? [0.74, 0.98, 1.02] : [0.9, 0.8, 1.3]; // lilac mist (Book I), sea spray (Book II)
    if (VEIL === 'sea') saltCrystals(short ? 14 : 28);
    if (!sm) { FX.veil(app, { preset: VEIL, onCovered: function (rel) { onCovered(function () { AU.sfx('open'); rel(); }); }, onBurst: onBurst, onDone: onDone }); return; }
    SMK = sm; sm.awake(20000);
    var cover = document.createElement('div'); cover.className = 'fx-cover'; app.appendChild(cover);
    var wrap = document.createElement('div'); wrap.className = 'fx-puffs'; app.appendChild(wrap);
    var puffs = [];
    for (var i = 0; i < T.puffs; i++) {
      var p = document.createElement('div'), a = Math.random() * 6.283, r1 = 60 + Math.random() * (W * 0.62), r0 = r1 * 0.55;
      p.className = 'fx-puff'; p.style.left = (W / 2) + 'px'; p.style.top = (H * 0.5) + 'px';
      p.style.setProperty('--x0', (Math.cos(a) * r0).toFixed(0) + 'px'); p.style.setProperty('--y0', (Math.sin(a) * r0 * 1.6).toFixed(0) + 'px');
      p.style.setProperty('--x1', (Math.cos(a) * r1).toFixed(0) + 'px'); p.style.setProperty('--y1', (Math.sin(a) * r1 * 1.7).toFixed(0) + 'px');
      p.style.setProperty('--x2', (Math.cos(a) * (W + 260)).toFixed(0) + 'px'); p.style.setProperty('--y2', (Math.sin(a) * (H + 260)).toFixed(0) + 'px');
      p.style.setProperty('--d', (1.1 + Math.random() * 0.5).toFixed(2) + 's'); p.style.animationDelay = (i * 0.05).toFixed(2) + 's';
      wrap.appendChild(p); puffs.push(p);
    }
    requestAnimationFrame(function () { puffs.forEach(function (p) { p.classList.add('go'); }); });
    var n = 0, pour = setInterval(function () { // smoke pours in from every edge
      for (var k = 0; k < 5; k++) {
        var side = Math.floor(Math.random() * 4), u = Math.random(), x = side === 0 ? u * W : side === 1 ? W + 10 : side === 2 ? u * W : -10, y = side === 0 ? -10 : side === 1 ? u * H : side === 2 ? H + 10 : u * H;
        var dx = W / 2 - x, dy = H * 0.5 - y, l = Math.hypot(dx, dy) || 1;
        var v = 0.07 + Math.random() * 0.09; sm.splat(x, y, dx / l * 1500, dy / l * 1500, [v * DYE[0], v * DYE[1], v * DYE[2]], 0.36);
      }
      if (++n >= T.n) clearInterval(pour);
    }, T.iv);
    setTimeout(function () { cover.style.opacity = T.covA; }, T.cov);
    setTimeout(function () {
      onCovered(function () {
        AU.sfx('open');
        setTimeout(function () {
          onBurst(); cover.style.opacity = '0';
          puffs.forEach(function (p) { p.classList.remove('go'); p.classList.add('out'); });
          sm.set({ dissipation: 3.2 }); // the poof: the cloud is blown apart and thins out fast
          for (var j = 0; j < 12; j++) { var a = j / 12 * 6.283 + Math.random() * 0.3; sm.splat(W / 2 + Math.cos(a) * 70, H * 0.56 + Math.sin(a) * 90, Math.cos(a) * 3000, Math.sin(a) * 3000, null, 0.26); }
          AU.sfx('whoosh', { gain: 0.8 });
          setTimeout(function () { // a few wisps stay behind on the pages, the rest is gone
            if (SMK !== sm) return;
            sm.set({ dissipation: 0.1, velDissipation: 1.2 });
            var tr = $('#tome').getBoundingClientRect(), ar = app.getBoundingClientRect();
            for (var q = 0; q < T.wisps; q++) { var g = 0.22 + Math.random() * 0.12; sm.splat(tr.left - ar.left + (0.08 + Math.random() * 0.84) * tr.width, tr.top - ar.top + (0.08 + Math.random() * 0.84) * tr.height, (Math.random() - 0.5) * 320, -70 - Math.random() * 120, [g * DYE[0] * 1.02, g * DYE[1] * 1.07, g * DYE[2] * 0.88], 0.07 + Math.random() * 0.06); }
          }, 1300);
          setTimeout(function () { cover.remove(); wrap.remove(); onDone(); }, 950);
          SMK_T = setTimeout(function () { if (SMK === sm) sm.fadeOut(3000, function () { if (SMK === sm) SMK = null; }); }, 15000);
        }, T.poof);
      });
    }, T.at);
  }
  function saltCrystals(n) { // Book II: fine salt crystals glint in the spray; your finger melts them
    var box = document.createElement('div'); box.className = 'fx-salt'; app.appendChild(box); var W = app.clientWidth, H = app.clientHeight, xs = [];
    for (var i = 0; i < n; i++) { var c = document.createElement('i'); c.className = 'fx-saltx'; var x = W * (0.08 + Math.random() * 0.84), y = H * (0.12 + Math.random() * 0.7); c.style.left = x + 'px'; c.style.top = y + 'px'; c.style.animationDelay = (Math.random() * 1.8).toFixed(2) + 's'; box.appendChild(c); xs.push([c, x, y]); }
    function melt(e) { var r = app.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top; xs.forEach(function (q) { if (!q[3] && Math.abs(q[1] - px) < 46 && Math.abs(q[2] - py) < 46) { q[3] = 1; q[0].classList.add('gone'); } }); }
    app.addEventListener('pointermove', melt); app.addEventListener('pointerdown', melt);
    setTimeout(function () { box.classList.add('out'); }, 5200);
    setTimeout(function () { app.removeEventListener('pointermove', melt); app.removeEventListener('pointerdown', melt); box.remove(); }, 6400);
  }
  function renderGrain() { // Book II's library relic: a grain of salt on the cover; hold it until it melts
    var old = $('#heroGrain'), want = BK.ui === 'grain' && REL && relic('grain') && st.relics.indexOf('grain') === -1;
    if (!want) { if (old) old.remove(); return; } if (old) return;
    var g = document.createElement('button'); g.id = 'heroGrain'; g.className = 'grain'; g.setAttribute('aria-label', L(relic('grain').name));
    g.style.left = (BK.grain || [63, 30])[0] + '%'; g.style.top = (BK.grain || [63, 30])[1] + '%'; $('#hero').appendChild(g);
    var tm = null;
    g.addEventListener('pointerdown', function (e) { e.stopPropagation(); g.classList.add('melt'); AU.sfx('tick', { gain: 0.4 }); clearTimeout(tm);
      tm = setTimeout(function () { var r = g.getBoundingClientRect(), a = app.getBoundingClientRect(); g.remove(); foundRelic('grain', { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 }); }, 1600); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { g.addEventListener(ev, function () { clearTimeout(tm); g.classList.remove('melt'); }); });
    g.addEventListener('click', function (e) { e.stopPropagation(); });
  }
  // the book's typefaces must be in before pages are measured
  var FONTS_OK = !document.fonts, FONTS_READY = document.fonts ? Promise.all(['18px "EB Garamond"', 'italic 18px "EB Garamond"', '25px "IM Fell English"', '13px "IM Fell English SC"'].map(function (f) { return document.fonts.load(f); })).then(function () { FONTS_OK = true; }, function () { FONTS_OK = true; }) : Promise.resolve();
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- library ---------------- */
  function pipsHTML() { return ENDS.map(function (k) { var f = st.found.indexOf(k) > -1; return '<b class="' + (f ? (S[k].ending.star ? 'star' : 'on') : '') + '"></b>'; }).join(''); }
  function libTitle() { // the question follows the clock, like the greeting: tonight / today (NL: vanavond, vannacht, vandaag)
    var hr = new Date().getHours();
    return t(hr < 5 ? 'libTitleNight' : hr < 18 ? 'libTitleDay' : 'libTitleEve');
  }
  function renderShelf() {
    var open = SHELF.filter(function (b) { return !b.soon; }).length;
    if ($('#shelfOpen')) $('#shelfOpen').textContent = t('shelfOpen', { n: open });
    $$('[data-bookid]').forEach(function (el) { el.classList.toggle('cur', el.getAttribute('data-bookid') === BK.id); el.setAttribute('aria-label', el.textContent.trim()); });
    if ($('#heroBookNo')) $('#heroBookNo').textContent = t('bookNo', { n: ROMAN[(BK.no || 1) - 1] });
    var hi = $('#heroStage img.layer'); if (hi && BK.coverScene) { var src = 'img/' + BK.coverScene + '.webp'; if (hi.getAttribute('src') !== src) hi.setAttribute('src', src); }
    renderGrain();
  }
  function renderLibrary() {
    renderShelf();
    var hr = new Date().getHours();
    $$('.lib-title').forEach(function (el) { el.innerHTML = libTitle(); });
    $('#greet').textContent = t(hr < 5 ? 'greetNight' : hr < 12 ? 'greetMorning' : hr < 18 ? 'greetAfternoon' : 'greetEvening');
    $('#heroPips').innerHTML = pipsHTML();
    $('#heroCount').textContent = t('endingsFound', { n: st.found.length, t: TOTAL_END });
    var started = !!st.page;
    $('#heroGoLabel').textContent = t(started ? 'resume' : 'begin');
    $('#heroPill').textContent = started ? t('pillContinue', { p: PN(st.page) }) : t('pillNew');
    renderTabBadge();
  }
  function renderTabBadge() {
    var tb = $('.tab[data-tab="relics"]'), old = tb.querySelector('.badge-n'); if (old) old.remove();
    if (st.relics.length) tb.insertAdjacentHTML('beforeend', '<span class="badge-n">' + st.relics.length + '</span>');
  }
  var compassTaps = 0, compassT = 0;
  $('#compass').addEventListener('click', function (e) {
    var now = Date.now(); if (now - compassT > 4000) compassTaps = 0; compassT = now; compassTaps++;
    this.querySelector('svg').style.transform = 'rotate(' + (compassTaps * 51.4) + 'deg)';
    AU.sfx('tap');
    if (compassTaps >= 7 && BK.ui === 'compass') { compassTaps = 0; var r = this.getBoundingClientRect(), a = app.getBoundingClientRect(); foundRelic('compass', { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 }); }
    e.stopPropagation();
  });

  /* ---------------- cover ---------------- */
  function renderCover() {
    bgScene(BK.coverScene || 'mountain');
    $('#coverKicker').textContent = BOOK.imprint + ' · ' + t('bookNo', { n: ROMAN[(BK.no || 1) - 1] });
    $('#coverTitle').innerHTML = esc(BOOK.title).replace(' ', '<br>');
    $('#coverTag').textContent = BOOK.tagline;
    $('#coverWarn').textContent = BOOK.warning;
    $('#chipEnd').textContent = t('chipEndings', { n: TOTAL_END });
    $('#chipPages').textContent = t('chipPages', { n: KEYS.length });
    var started = !!st.page;
    $('#coverGoLabel').textContent = started ? t('continueFrom', { p: PN(st.page) }) : t('openBook');
    $('#coverRestart').hidden = !started;
  }

  /* ---------------- reader ---------------- */
  var R = { p: null, sheets: [], idx: 0, rev: [], revealing: false, rt: null, turning: false, mode: 'read', fresh: true, intro: false, ctl: null, wipe: null };
  var FLOURISH = '<svg class="flourish" viewBox="0 0 342 18" aria-hidden="true"><path d="M0 9 H128 M214 9 H342" stroke="#C9B288" stroke-width="1"/><path d="M128 9 C139 1 150 1 157 9 C150 17 139 17 128 9Z" fill="none" stroke="#C9B288" stroke-width="1.1"/><path d="M214 9 C203 1 192 1 185 9 C192 17 203 17 214 9Z" fill="none" stroke="#C9B288" stroke-width="1.1"/><path d="M171 1.5 L178.5 9 L171 16.5 L163.5 9Z" fill="#D9A248"/><path d="M171 1.5 L163.5 9 L171 9Z" fill="#FFF0C0"/><path d="M171 16.5 L178.5 9 L171 9Z" fill="#8E5E1E"/></svg>';
  function tokenize(para, startIdx) { // words of the plain text; a word belongs to a relic if it starts inside a [[id|phrase]] marker
    var plain = '', eggs = [], re = /\[\[(\w+)\|([^\]]+)\]\]/g, last = 0, m;
    while ((m = re.exec(para))) { plain += para.slice(last, m.index); var a = plain.length; plain += m[2]; eggs.push([a, plain.length, m[1]]); last = re.lastIndex; }
    plain += para.slice(last);
    var out = [], wr = /\S+/g, mm, idx = startIdx;
    while ((mm = wr.exec(plain))) {
      var s0 = mm.index, e0 = s0 + mm[0].length, egg = null;
      for (var k = 0; k < eggs.length; k++) if (e0 > eggs[k][0] && s0 < eggs[k][1]) { egg = eggs[k][2]; break; }
      out.push({ w: mm[0], egg: egg, sp: out.length > 0, i: idx++ });
    }
    return { toks: out, next: idx };
  }
  function wordsHTML(toks, first) {
    var h = '';
    toks.forEach(function (k, j) {
      var sep = (j > 0 && k.sp) ? ' ' : '';
      var cls = 'w' + (k.egg ? ' egg' + (st.relics.indexOf(k.egg) > -1 ? ' got' : '') : '');
      var attrs = ' data-i="' + k.i + '"' + (k.egg ? ' data-egg="' + k.egg + '" style="--gd:' + (1.5 + (k.egg.charCodeAt(0) + k.egg.length) % 7 * 0.9).toFixed(1) + 's"' : '');
      var w = k.w;
      if (first && j === 0 && /^[A-Za-zÀ-ÿ]/.test(w)) { h += '<span class="drop" aria-hidden="true">' + esc(w.charAt(0)) + '</span>'; w = w.slice(1); if (!w) return; }
      h += sep + '<span class="' + cls + '"' + attrs + '>' + esc(w) + '</span>';
    });
    return h;
  }
  function blocksFor(p) {
    var s = S[p], blocks = [], idx = 0;
    blocks.push({ type: 'fixed', html: '<div class="phead"><div class="pcoin" aria-hidden="true">' + PN(p) + '</div><div class="ptitles"><span class="caps">' + esc(t('pageOf', { p: PN(p), title: BOOK.title })) + '</span><h2>' + esc(s.chapter) + '</h2></div></div>' + FLOURISH });
    s.text.forEach(function (para, i) { var tk = tokenize(para, idx); idx = tk.next; blocks.push({ type: 'para', toks: tk.toks, first: i === 0 }); });
    var extra = '';
    if (s.moment) extra += '<button class="minor" data-act="moment">' + esc(t('playMoment')) + '</button>';
    if (IL[p]) extra += '<button class="minor" data-act="scene">' + esc(t('replayScene')) + '</button>';
    extra = extra ? '<div class="minor-row">' + extra + '</div>' : '';
    if (s.ending) blocks.push({ type: 'fixed', html: '<div class="after endblock">' + FLOURISH + '<div class="theend">' + esc(t('theEnd')) + '</div><button class="btn-gold lg" data-act="ending">' + esc(t('seeEnding')) + '<span class="shine"></span></button>' + extra + '</div>' });
    else blocks.push({ type: 'fixed', html: '<div class="after"><div class="whatdo"><span class="caps">' + esc(t('whatDo')) + '</span><i></i></div><div class="choices">' + s.choices.map(function (c) {
      var seen = st.visited.indexOf(c.to) > -1 ? '<span class="seen">' + esc(t('readTag')) + '</span>' : '';
      return '<button class="choice" data-to="' + c.to + '"><span class="ct">' + esc(c.text) + ' <em>' + esc(t('turnTo', { p: PN(c.to) })) + '</em>' + seen + '</span><span class="coin" aria-hidden="true">' + PN(c.to) + '</span></button>';
    }).join('') + '</div>' + extra + '</div>' });
    return blocks;
  }
  var PCACHE = {};
  function pageKey(p) {
    var s = S[p], m = measurer();
    return [BK.id, p, lang, m.clientWidth, m.clientHeight, (s.choices || []).map(function (c) { return st.visited.indexOf(c.to) > -1 ? 1 : 0; }).join(''), st.relics.length].join('|');
  }
  function pagesFor(p) {
    var k = pageKey(p); if (PCACHE[k]) return PCACHE[k];
    return (PCACHE[k] = paginate(blocksFor(p), '<div class="runhead">' + esc(t('page', { p: PN(p) })) + ' · ' + esc(S[p].chapter) + '</div>'));
  }
  // lay out the pages a reader can turn to next while they are still reading, one per idle moment
  var idle = window.requestIdleCallback || function (f) { return setTimeout(function () { f({ timeRemaining: function () { return 8; } }); }, 200); };
  function preparePages(list) {
    list = list.filter(function (p) { return S[p]; });
    (function next() { if (!list.length) return; idle(function () { if (R.revealing && list.length) { setTimeout(next, 400); return; } var p = list.shift(); try { pagesFor(p); } catch (e) {} next(); }); })();
  }
  var measureLin = null;
  function measurer() {
    if (!measureLin) {
      var m = document.createElement('div'); m.className = 'leaf'; m.setAttribute('aria-hidden', 'true'); m.style.visibility = 'hidden'; m.style.zIndex = '-1';
      m.innerHTML = '<div class="face"><div class="lin"><div class="lc"></div></div></div>'; $('#pages').appendChild(m); measureLin = m.querySelector('.lin');
    }
    return measureLin;
  }
  function paginate(blocks, runhead) {
    var lin = measurer(), lc = lin.querySelector('.lc'), cs = getComputedStyle(lin);
    var avail = lin.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
    var sheets = [], cur = { html: '', scrolly: false };
    lc.innerHTML = '';
    function fits() { return lc.offsetHeight <= avail; }
    function flush() { sheets.push(cur); lc.innerHTML = runhead || ''; cur = { html: '', scrolly: false, head: lc.innerHTML }; }
    blocks.forEach(function (b) {
      if (b.type === 'fixed') {
        lc.insertAdjacentHTML('beforeend', b.html);
        if (!fits()) {
          if (cur.html && cur.html !== cur.head) { lc.lastElementChild.remove(); flush(); lc.insertAdjacentHTML('beforeend', b.html); }
          if (!fits()) cur.scrolly = true;
        }
        cur.html = lc.innerHTML;
        return;
      }
      var toks = b.toks, first = b.first;
      while (toks.length) {
        var pEl = document.createElement('p'); if (!first) pEl.className = 'cont';
        lc.appendChild(pEl);
        pEl.innerHTML = wordsHTML(toks, first);
        if (fits()) { cur.html = lc.innerHTML; toks = []; break; }
        var lo = 0, hi = toks.length; // largest k that fits
        while (lo < hi) { var mid = Math.ceil((lo + hi) / 2); pEl.innerHTML = wordsHTML(toks.slice(0, mid), first); if (fits()) lo = mid; else hi = mid - 1; }
        if (lo === 0) { pEl.remove(); if (!cur.html || cur.html === cur.head) { cur.scrolly = true; lc.insertAdjacentHTML('beforeend', '<p>' + wordsHTML(toks, first) + '</p>'); cur.html = lc.innerHTML; toks = []; break; } flush(); continue; }
        pEl.innerHTML = wordsHTML(toks.slice(0, lo), first); cur.html = lc.innerHTML;
        toks = toks.slice(lo); first = false; flush();
      }
    });
    if (cur.html) sheets.push(cur);
    lc.innerHTML = '';
    return sheets;
  }
  function paintSheet(lin, i) {
    var sh = R.sheets[i];
    lin.innerHTML = sh ? '<div class="lc">' + sh.html + '</div>' : '';
    lin.parentNode.setAttribute('data-v', 1 + ((R.p || 1) * 3 + i) % 4);
    lin.classList.toggle('scrolly', !!(sh && sh.scrolly)); lin.scrollTop = 0;
    if (sh && R.rev[i]) allOn(lin);
  }
  function allOn(lin) { $$('.w,.drop,.after', lin).forEach(function (el) { el.classList.add('on'); }); $$('.w', lin).forEach(function (el) { el.classList.add('settled'); }); $$('.egg', lin).forEach(function (el) { el.classList.add('on'); }); }
  function paintFoot() {
    var n = R.sheets.length, h = '';
    if (n > 1) for (var i = 0; i < n; i++) h += '<b class="' + (i === R.idx ? 'on' : '') + '"></b>';
    $('#pfoot').innerHTML = h;
    var can = R.idx < n - 1 && !!R.rev[R.idx] && R.mode === 'read' && !R.revealing;
    $('#turnBtn').classList.toggle('on', can); hintTurn(can);
  }
  /* how to turn: until you have turned a few pages yourself, a ghost finger drags the corner and the page lifts
     with it; after that the corner only lifts now and then when you linger */
  var PEEK_T = null;
  function hintTurn(on) {
    clearTimeout(PEEK_T); PEEK_T = null;
    var learner = (prefs.turns || 0) < 3, hint = $('#turnHint'), fing = $('#thFinger');
    if (hint) hint.classList.toggle('on', !!on && learner);
    if (fing) fing.classList.remove('go');
    if (!on) return;
    function go() {
      PEEK_T = null;
      if (current !== 'reader' || R.mode !== 'read' || R.turning || R.revealing || R.intro || R.idx >= R.sheets.length - 1) return;
      if (!CURL.active()) {
        paintSheet($('#linUnder'), R.idx + 1);
        if (learner && fing) { fing.classList.remove('go'); void fing.offsetWidth; fing.classList.add('go'); }
        setTimeout(function () { if (current === 'reader' && R.mode === 'read' && !R.turning && !CURL.active()) { CURL.peek(); AU.sfx('grab', { gain: 0.35 }); } }, learner ? 380 : 0);
      }
      PEEK_T = setTimeout(go, learner ? 5200 : 16000);
    }
    PEEK_T = setTimeout(go, learner ? 1100 : 7000);
  }
  function learnedTurn() { prefs.turns = (prefs.turns || 0) + 1; savePrefs(); }
  function renderReader(o) {
    o = o || {};
    var p = st.page, s = S[p]; if (!s) return;
    var keep = o.keepSheet && R.p === p ? R.idx : 0;
    R.p = p; R.mode = 'read'; R.turning = false; CURL.end();
    bgScene(s.scene); AU.setScene(s.scene);
    var tome = $('#tome');
    tome.classList.remove('look', 'scene'); edgeClass(tome); tome.setAttribute('data-scene', s.scene);
    var lt = BK.light && BK.light[s.scene]; if (lt) { tome.style.setProperty('--lt1', lt[0]); tome.style.setProperty('--lt2', lt[1]); } else { tome.style.removeProperty('--lt1'); tome.style.removeProperty('--lt2'); }
    if (R.intro) tome.classList.add('intro');
    $('#lookUi').classList.remove('on'); $('#hot').classList.remove('on'); $('#rLook').setAttribute('aria-pressed', 'false');
    renderFinger();
    var go = function () {
      R.sheets = pagesFor(p);
      var instant = o.instant || (!R.fresh && !(prefs.firstRead && R.arrived)); // 'read as if for the first time': a page you arrive at is written out again
      R.rev = R.sheets.map(function () { return instant; });
      R.idx = Math.min(keep, R.sheets.length - 1);
      $('#linUnder').innerHTML = '';
      paintSheet($('#linTop'), R.idx); paintFoot();
      prefetchChoices(s);
      if (R.intro) return; // the intro mist decides when reading starts
      afterArrive();
    };
    if (!FONTS_OK) { var done = false; var run = function () { if (!done) { done = true; if (current === 'reader' && R.p === p) go(); } }; FONTS_READY.then(run, run); setTimeout(run, 2500); }
    else go();
  }
  function afterArrive() { // scene first (the full one the first time, a short one on a later visit), then ink
    var p = R.p, arrived = R.arrived; R.arrived = false;
    var go = function () { if (R.rev[R.idx]) afterReveal(); else startReveal(); };
    if (IL[p] && R.forceScene === p) { R.forceScene = null; runScene(p, go); } // (a timed moment's scene, replayed because of 'read as if for the first time')
    else if (IL[p] && st.scenes.indexOf(p) === -1 && (arrived || !R.rev[R.idx])) runScene(p, go);
    else if (IL[p] && arrived && R.idx === 0) runScene(p, go, prefs.firstRead ? undefined : { short: true }); // the full scene again when the reader asked for it
    else go();
  }
  function prefetchChoices(s) {
    if (!BK.noVideo) (s.choices || []).forEach(function (c) { var sc = S[c.to] && S[c.to].scene; if (sc && sc !== s.scene) vidURL(sc); });
    preparePages((s.choices || []).map(function (c) { return c.to; }));
  }
  function startReveal() {
    clearTimeout(R.rt);
    var lin = $('#linTop'), words = $$('.w:not(.on)', lin), drop = $('.drop:not(.on)', lin), base = SPEED[prefs.speed] || SPEED.read, k = 0;
    if (!words.length) { finishReveal(); return; }
    R.revealing = true; $('#turnBtn').classList.remove('on'); hintTurn(false);
    function next() {
      if (!R.revealing) return;
      if (k >= words.length) { R.revealing = false; afterReveal(); return; }
      var w = words[k++], txt = w.textContent, d = base;
      w.classList.add('on');
      if (/[.!?…]["”’)]*$/.test(txt)) d *= 1.8; else if (/[,;:—–]["”’)]*$/.test(txt)) d *= 1.25;
      if (!w.nextElementSibling || w.nextElementSibling.tagName === 'P') d *= 1.35;
      R.rt = setTimeout(next, d);
    }
    R.rt = setTimeout(function () { if (drop) drop.classList.add('on'); next(); }, 380);
  }
  function finishReveal() { clearTimeout(R.rt); R.revealing = false; allOn($('#linTop')); afterReveal(); }
  function afterReveal() {
    R.rev[R.idx] = true;
    var lin = $('#linTop');
    $$('.after', lin).forEach(function (el, i) { setTimeout(function () { el.classList.add('on'); }, 120 + i * 120); });
    $$('.egg', lin).forEach(function (el) { el.classList.add('on'); });
    var mine = R.p + ':' + R.idx;
    setTimeout(function () { if (R.p + ':' + R.idx === mine && !R.revealing) $$('.w.on', lin).forEach(function (el) { el.classList.add('settled'); }); }, 1500);
    paintFoot(); scheduleOmen();
  }
  /* omens: now and then the world around the book stirs */
  var OMENS = window.WaywardOmens ? window.WaywardOmens.create({ app: app, pages: $('#pages'), tome: $('#tome'), layer: $('#omLayer'), sfx: function (n, o) { AU.sfx(n, o); }, flutter: function () { if (!R.turning && R.mode === 'read') CURL.flutter(); } }) : null;
  var omenT = null, lastOmen = 0;
  function scheduleOmen() {
    if (!OMENS || omenT) return;
    var wait = lastOmen ? 30000 + Math.random() * 20000 : 10000 + Math.random() * 9000;
    omenT = setTimeout(function () {
      omenT = null;
      if (current !== 'reader') return;
      if (R.mode === 'read' && !R.turning && !R.revealing && !document.hidden) { if (OMENS.play(S[R.p].scene)) lastOmen = performance.now(); }
      scheduleOmen();
    }, wait);
  }
  function stopReader() {
    clearTimeout(R.rt); R.revealing = false;
    if (R.ctl && R.ctl.destroy) R.ctl.destroy(); R.ctl = null;
    $('#ilHost').innerHTML = ''; $('#ilHost').classList.remove('on');
    $('#tome').classList.remove('scene', 'look', 'om-shake');
    clearTimeout(omenT); omenT = null; if (OMENS) OMENS.stop();
    hintTurn(false); CURL.end(); R.turning = false;
    AU.duck(false);
  }
  var CURL = window.WaywardCurl.create($('#pages'), $('#leafTop'), $('#leafUnder'));
  function turnSheet(dir) {
    if (R.turning || R.mode !== 'read') return;
    var to = R.idx + dir; if (to < 0 || to >= R.sheets.length) return;
    if (R.revealing) return; // read first: the ink is still drying
    R.turning = true; AU.sfx('page'); hintTurn(false);
    if (dir > 0) {
      learnedTurn();
      paintSheet($('#linUnder'), to);
      CURL.turnForward(function () { R.idx = to; paintSheet($('#linTop'), to); $('#linUnder').innerHTML = ''; R.turning = false; paintFoot(); if (!R.rev[to]) startReveal(); else afterReveal(); });
    } else {
      paintSheet($('#linUnder'), R.idx); paintSheet($('#linTop'), to);
      CURL.turnBack(function () { R.idx = to; $('#linUnder').innerHTML = ''; R.turning = false; paintFoot(); });
    }
  }
  function paid(to, run) { if (shopOn() && window.WaywardShop.page) window.WaywardShop.page(to, run); else run(); } // T11: a new page or ending may use today's allowance
  function chooseTo(to) {
    if (R.turning || R.mode !== 'read') return;
    paid(to, function () { chooseToNow(to); });
  }
  function chooseToNow(to) {
    if (R.turning || R.mode !== 'read') return;
    hintTurn(false);
    AU.sfx('choice');
    var target = S[to]; if (!target) return;
    commit(to);
    R.turning = true;
    setTimeout(function () { AU.sfx('page'); }, 120);
    if (target.moment) { $('#linUnder').innerHTML = ''; CURL.turnForward(function () { R.turning = false; show('moment'); }); return; }
    if (OMENS) OMENS.stop();
    var p = to, s = target;
    R.p = p; bgScene(s.scene); AU.setScene(s.scene); $('#tome').setAttribute('data-scene', s.scene);
    R.sheets = pagesFor(p);
    var instant = !R.fresh;
    R.rev = R.sheets.map(function () { return instant; }); R.idx = 0;
    paintSheet($('#linUnder'), 0);
    renderFinger(); prefetchChoices(s);
    clearTimeout(omenT); omenT = null;
    CURL.turnForward(function () {
      paintSheet($('#linTop'), 0); $('#linUnder').innerHTML = ''; R.turning = false; paintFoot();
      afterArrive();
    });
  }

  /* scenes: the book lowers, the scene plays around it, and you take part. The first time there is no skipping:
     after ~6 s without a touch a soft hint shows the gesture (never text), and from ~14 s on the scene helps
     itself along if you still do nothing. On a later visit (another route, rereading) arriving at the page plays
     a short version by itself: the change in the surroundings, its sound and the closing line, in about three
     seconds. The replay button on the page always plays the full scene. */
  var SCN = { hintIdle: 6000, autoAt: 14000, autoShown: 2500, autoMax: 26000 };
  function runScene(p, then, o) {
    o = o || {};
    var il = IL[p]; if (!il || current !== 'reader') { then(); return; }
    var short = !!o.short;
    if (R.sceneKill) R.sceneKill();
    R.mode = 'scene'; var tome = $('#tome'), host = $('#ilHost'), done = false, ctl = null, helpers = [], unwatch = null;
    var log = R.scn = { p: p, short: short, t0: performance.now(), tPrompt: 0, tDone: 0, tEnd: 0, hints: 0, hintOn: false, auto: false };
    tome.classList.add('scene'); $('#turnBtn').classList.remove('on');
    host.innerHTML = ''; host.classList.remove('il-out'); host.classList.add('on'); host.classList.toggle('il-short', short); host.removeAttribute('data-hint');
    var lines = L(il.lines), linesEl = $('#ilLines'), prompt = $('#ilPrompt');
    linesEl.innerHTML = ''; prompt.textContent = ''; prompt.style.visibility = 'hidden';
    function kill() { // leaving the reader mid-scene: stop every timer and listener of this scene
      if (unwatch) { unwatch(); unwatch = null; }
      helpers.forEach(function (h) { clearTimeout(h); clearInterval(h); }); helpers = [];
      host.removeAttribute('data-hint');
      if (R.sceneKill === abort) R.sceneKill = null;
    }
    function abort() { done = true; kill(); }
    R.sceneKill = abort;
    if (short) { // the closing line straight away, the change plays by itself
      linesEl.innerHTML = '<span class="w">' + esc(L(il.done)) + '</span>'; requestAnimationFrame(function () { var w = linesEl.firstChild; if (w) w.classList.add('on'); });
      log.tDone = performance.now();
      later(start, 420);
    } else {
      // the two captions arrive quickly (prompt at ~2.5 s, CD brief B4); they stay on the page while the scene plays
      lines.forEach(function (ln, i) { later(function () { var sp = document.createElement('span'); sp.className = 'w'; sp.textContent = (i ? ' ' : '') + ln; linesEl.appendChild(sp); requestAnimationFrame(function () { sp.classList.add('on'); }); }, 350 + i * 1050); });
      later(function () { prompt.textContent = L(il.prompt); prompt.style.visibility = 'visible'; start(); }, 350 + lines.length * 1075);
    }
    function help(ms, fn) { helpers.push(setTimeout(function () { if (!done && current === 'reader') fn(); }, ms)); }
    function watchIdle() { // the soft hint after ~6 s without a touch, and the scene's own help after ~14 s
      var t0 = performance.now(), last = t0, down = false, hinting = false, hintAt = 0, autoed = false;
      function hide() { if (!hinting) return; hinting = false; log.hintOn = false; host.removeAttribute('data-hint'); if (ctl && ctl.unhint) ctl.unhint(); }
      function act(e) { last = performance.now(); if (e.type === 'pointerdown') down = true; else if (e.type !== 'pointermove') down = false; hide(); }
      var EV = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
      EV.forEach(function (ev) { host.addEventListener(ev, act, true); });
      window.addEventListener('pointerup', act, true); window.addEventListener('pointercancel', act, true);
      var iv = setInterval(function () {
        if (done || current !== 'reader' || !ctl || autoed) return;
        var now = performance.now(), idle = down ? 0 : now - last, el = now - t0;
        if ((el >= SCN.autoAt && hinting && now - hintAt >= SCN.autoShown) || el >= SCN.autoMax) { autoed = true; hide(); log.auto = true; if (ctl.auto) ctl.auto(); return; }
        if (!hinting && idle >= SCN.hintIdle && ctl.hint && ctl.hint() !== false) { hinting = true; hintAt = now; log.hints++; log.hintOn = true; host.setAttribute('data-hint', '1'); }
      }, 200);
      helpers.push(iv);
      unwatch = function () { EV.forEach(function (ev) { host.removeEventListener(ev, act, true); }); window.removeEventListener('pointerup', act, true); window.removeEventListener('pointercancel', act, true); };
    }
    function start() {
      if (done || current !== 'reader') return;
      log.tPrompt = performance.now();
      var pt, lastSq = 0;
      if (il.type === 'wipe') {
        ctl = FX.wipe(host, { preset: il.preset || 'fog', threshold: 0.25, puffs: 40, baseAlpha: 0.72, brush: 60, onStroke: function () { var n = performance.now(); if (n - lastSq > 500) { lastSq = n; AU.sfx('wipe', { gain: 0.8 }); } }, onDone: function () { ctl = null; AU.sfx('sparkle', { gain: 0.6 }); finish(true); } });
        if (short) help(200, function () { if (ctl) ctl.auto(true); });
      } else if (il.type === 'lantern') {
        pt = mapPt(il.x, il.y, host);
        ctl = FX.lantern(host, { x: pt.x, y: pt.y, fast: short, hold: 550, onFound: function () { AU.sfx('sparkle'); FX.sparkle(host, pt.x, pt.y, { n: 20 }); }, onDone: function () { ctl = null; finish(true); } });
        if (!short) { AU.sfx('drip', { pan: -0.4, gain: 0.5, wet: 0.5 }); var dripIv = setInterval(function () { if (done) { clearInterval(dripIv); return; } AU.sfx('drip', { pan: Math.random() * 1.6 - 0.8, gain: 0.5, wet: 0.5 }); }, 2600); helpers.push(dripIv); }
        else AU.sfx('drip', { pan: 0.3, gain: 0.5, wet: 0.5 });
      } else if (il.type === 'tap') {
        pt = mapPt(il.x, il.y, host);
        ctl = FX.tapTarget(host, { x: pt.x, y: pt.y, hold: 1300, hidden: il.hidden != null ? il.hidden : (BK.no || 1) === 1, onHold: function () { AU.sfx('grab', { gain: 0.5 }); }, onTap: function () {
          AU.sfx('fire', { gain: 0.8 }); AU.sfx('sparkle');
          FX.glow(host, pt.x, pt.y, { r: Math.max(host.clientWidth, host.clientHeight) * 0.42, dur: 1700, rest: 0.75 }); // the whole hall warms (was a CSS filter on the background)
          help(short ? 700 : 1200, function () { finish(true); });
        } });
        if (short) help(250, function () { if (ctl) ctl.auto(); });
      } else if (il.type === 'trace') {
        var pts = il.path.map(function (q) { var m = mapPt(q[0], q[1], host); return [m.x, m.y]; }), quillAt = 0;
        ctl = FX.trace(host, { pts: pts, inkSecs: 3.4, onStart: function () { var n = performance.now(); if (n - quillAt > 1500) { quillAt = n; AU.sfx('quill', { gain: 0.8 }); } }, onDone: function () { AU.sfx('relic'); finish(true); } });
        if (short) help(250, function () { if (ctl) ctl.auto(true); });
      } else if (il.type === 'hold') { // hold your finger down = hold your breath; let go when the ring is full (Book II p24)
        pt = mapPt(il.x, il.y, host);
        ctl = FX.tapTarget(host, { x: pt.x, y: pt.y, hold: short ? 400 : 1900, hidden: false, r: 90, onHold: function () { AU.sfx('heartbeat', { gain: 0.6 }); }, onTap: function () {
          AU.sfx('whoosh', { gain: 0.7 }); FX.glow(host, pt.x, pt.y, { r: Math.max(host.clientWidth, host.clientHeight) * 0.4, dur: 1500, rest: 0.6 });
          help(short ? 600 : 1100, function () { finish(true); });
        } });
        if (short) help(250, function () { if (ctl) ctl.auto(); });
      } else if (il.type === 'turn') { // turn the great lens: draw an arc with your finger (Book II p67)
        var c0 = mapPt(il.x, il.y, host), rad = Math.min(host.clientWidth * 0.3, 130), arc = [];
        for (var ai = 0; ai <= 6; ai++) { var an = Math.PI * (1.08 + ai * 0.14); arc.push([c0.x + Math.cos(an) * rad, c0.y + Math.sin(an) * rad * 0.8]); }
        ctl = FX.trace(host, { pts: arc, inkSecs: 2.4, onStart: function () { AU.sfx('creak', { gain: 0.6 }); }, onDone: function () { AU.sfx('sparkle'); FX.glow(host, c0.x, c0.y, { r: Math.max(host.clientWidth, host.clientHeight) * 0.45, dur: 1600, rest: 0.55 }); finish(true); } });
        if (short) help(250, function () { if (ctl) ctl.auto(true); });
      } else if (il.type === 'rope') {
        var a = mapPt(il.x, il.y, host), bell = mapPt(il.bell[0], il.bell[1], host);
        var tomeTop = tome.getBoundingClientRect().top - host.getBoundingClientRect().top;
        ctl = FX.rope(host, { x: a.x, y: a.y, len: Math.max(28, Math.min(56, tomeTop - a.y - 44)), pulls: short ? 1 : 2, onGrab: function () { AU.sfx('creak', { gain: 0.9 }); },
          onTug: function () { AU.sfx('creak', { gain: 0.8, rate: 0.7 }); AU.sfx('rumble', { gain: 0.25 }); FX.ripple(host, bell.x, bell.y, 1); }, // the bell swings, but does not ring yet
          onPull: function () {
            AU.sfx('bell'); AU.sfx('rumble', { gain: 0.5 }); FX.ripple(host, bell.x, bell.y, 4);
            FX.glow(host, bell.x, bell.y, { r: Math.min(host.clientWidth, host.clientHeight) * 0.42, dur: 1400, peak: 0.9, rest: 0.5 }); // the bronze keeps humming with light
            app.classList.add('shake'); setTimeout(function () { app.classList.remove('shake'); }, 650);
            if (OMENS && !short) OMENS.play('bell', 'quake');
            help(short ? 1200 : 1700, function () { finish(true); });
          } });
        if (short) help(300, function () { if (ctl) ctl.auto(); });
      } else if (window.WaywardScenes && window.WaywardScenes[il.type]) {
        ctl = window.WaywardScenes[il.type]({ host: host, il: il, p: p, tome: tome, app: app, bg: $('#bg'), FX: FX, OMENS: OMENS, L: L, lang: function () { return lang; }, short: short,
          mapPt: function (x, y) { return mapPt(x, y, host); }, sfx: function (n, o) { AU.sfx(n, o); }, help: help, finish: finish,
          setPrompt: function (txt) { if (short) return; prompt.textContent = txt; prompt.style.visibility = txt ? 'visible' : 'hidden'; } });
      }
      if (ctl) { var d0 = ctl.destroy; ctl.destroy = function () { done = true; kill(); if (d0) d0.apply(this, arguments); }; }
      R.ctl = ctl;
      if (!short && ctl) watchIdle();
    }
    function finish(withDone) {
      if (done) return; done = true;
      kill();
      if (st.scenes.indexOf(p) === -1) { st.scenes.push(p); save(); }
      // the reward (open door, open letter, the bridge, the lit hall...) stays in view while the closing line is
      // read, and fades as the book rises
      var close = function () {
        if (current !== 'reader') return;
        log.tEnd = performance.now();
        var c = ctl; ctl = null; R.ctl = null; if (c && c.destroy) c.destroy();
        host.classList.remove('on'); host.classList.add('il-out'); tome.classList.remove('scene'); R.mode = 'read';
        setTimeout(function () {
          if (R.scn === log && R.mode !== 'scene') { host.innerHTML = ''; host.classList.remove('il-short', 'il-out'); }
          if (current === 'reader' && R.p === p) then();
        }, 750);
      };
      if (short) { later(close, 800); return; }
      if (withDone && L(il.done)) { log.tDone = performance.now(); linesEl.innerHTML = '<span class="w on">' + esc(L(il.done)) + '</span>'; prompt.style.visibility = 'hidden'; later(close, 2100); }
      else close();
    }
  }

  /* look around: lower the book, the scenery becomes tappable */
  function setLook(on) {
    if (R.mode === 'scene' || R.turning) return;
    R.mode = on ? 'look' : 'read';
    $('#tome').classList.toggle('look', on); $('#lookUi').classList.toggle('on', on); $('#hot').classList.toggle('on', on);
    $('#rLook').setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) { AU.sfx('whoosh'); placeHotspots(); $('#turnBtn').classList.remove('on'); } else paintFoot();
  }
  function placeHotspots() {
    var hot = $('#hot'); hot.innerHTML = '';
    if (!REL) return;
    REL.relics.forEach(function (r) {
      if (r.where !== 'scene' || r.scene !== BG.cur) return;
      var pt = mapPt(r.x, r.y, hot), b = document.createElement('button');
      b.className = 'hotspot' + (st.relics.indexOf(r.id) > -1 ? ' found' : ''); b.style.left = pt.x + 'px'; b.style.top = pt.y + 'px';
      b.setAttribute('aria-label', L(r.name)); b.setAttribute('data-hot', r.id);
      hot.appendChild(b);
    });
  }
  function renderFinger() { var fb = $('#rFinger'), on = st.finger === st.page; fb.setAttribute('aria-pressed', on ? 'true' : 'false'); fb.querySelector('svg').setAttribute('fill', on ? 'currentColor' : 'none'); }

  /* page gestures: take the page by its right edge and turn it; swipe or tap the edges to turn */
  (function () {
    var pages = $('#pages'), sx = 0, sy = 0, t0 = 0, down = false, drag = null, lastP = null, vx = 0, lastT = 0, lastX = 0;
    function local(e) { var r = pages.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    pages.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button,.egg.on')) return;
      down = true; sx = e.clientX; sy = e.clientY; t0 = Date.now(); drag = null; lastX = e.clientX; lastT = t0; vx = 0;
      var q = local(e), w = pages.clientWidth;
      if (R.mode === 'read' && !R.turning && !R.revealing && !R.intro && q[0] > w * 0.55 && R.idx < R.sheets.length - 1) drag = { armed: true, corner: q[1] < pages.clientHeight * 0.4 ? 'tr' : 'br', pid: e.pointerId };
    });
    pages.addEventListener('pointermove', function (e) {
      if (!down || !drag) return;
      var dx = e.clientX - sx, dy = e.clientY - sy, now = Date.now();
      vx = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now;
      if (drag.armed && dx < -6) {
        drag.armed = false; drag.on = true; R.turning = true; hintTurn(false);
        paintSheet($('#linUnder'), R.idx + 1); CURL.begin(drag.corner); AU.sfx('grab', { gain: 0.7 });
        try { pages.setPointerCapture(drag.pid); } catch (x) {}
      }
      if (drag.on) { var c = CURL.corner(); lastP = CURL.set([c[0] + dx * 1.15, c[1] + dy * 0.6]); e.preventDefault(); }
    });
    function release(e) {
      if (!down) return; down = false;
      if (drag && drag.on) {
        var w = pages.clientWidth, dx = e.clientX - sx, to = R.idx + 1;
        if (dx < -w * 0.32 || vx < -0.45) {
          AU.sfx('page'); learnedTurn();
          CURL.turnForward(function () { R.idx = to; paintSheet($('#linTop'), to); $('#linUnder').innerHTML = ''; R.turning = false; paintFoot(); if (!R.rev[to]) startReveal(); else afterReveal(); }, lastP);
        } else CURL.revert(lastP || CURL.corner(), function () { $('#linUnder').innerHTML = ''; R.turning = false; paintFoot(); });
        drag = null; return;
      }
      drag = null;
      if (R.mode === 'look') { setLook(false); return; }
      if (R.mode !== 'read' || R.intro) return;
      if (e.target.closest('button,.egg.on')) return;
      var ddx = e.clientX - sx, ddy = e.clientY - sy;
      if (Math.abs(ddx) > 42 && Math.abs(ddx) > Math.abs(ddy) * 1.2) { turnSheet(ddx < 0 ? 1 : -1); return; }
      if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10 && Date.now() - t0 < 500) {
        var r = pages.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
        if (x > 0.62 && R.idx < R.sheets.length - 1) turnSheet(1); else if (x < 0.22 && R.idx > 0) turnSheet(-1);
      }
    }
    pages.addEventListener('pointerup', release);
    pages.addEventListener('pointercancel', function (e) { if (drag && drag.on) { CURL.revert(lastP || CURL.corner(), function () { $('#linUnder').innerHTML = ''; R.turning = false; }); } down = false; drag = null; });
  })();

  /* ---------------- moment ---------------- */
  function renderMoment() {
    var p = st.page, s = S[p], m = s.moment;
    bgScene(s.scene); AU.setScene('moment');
    $('#mPage').textContent = t('page', { p: PN(p) }); $('#mChapter').textContent = s.chapter;
    $('#mDecide').hidden = true;
    var fxHost = $('#momentFx'); if (MCREEP) { MCREEP.destroy(); MCREEP = null; } fxHost.innerHTML = '';
    var creep = MCREEP = (BK.creep && BK.creep[p] && FX) ? FX.creep(fxHost, { preset: BK.creep[p] }) : null;
    var lines = s.text.map(strip), idx = 0, total = lines.length + 1, prog = $('#mProg');
    function step() {
      if (idx < lines.length) {
        var sub = $('#mSub'); sub.textContent = lines[idx]; sub.style.animation = 'none'; void sub.offsetWidth; sub.style.animation = '';
        prog.style.width = ((idx + 1) / total * 100) + '%';
        var words = lines[idx].split(' ').length, mine = idx; idx++;
        later(function () { if (current === 'moment' && idx === mine + 1) step(); }, Math.max(3000, words * (SPEED[prefs.speed] || SPEED.read) * 1.3));
      } else decide();
    }
    function decide() {
      clearTimers();
      $('#mSub').textContent = m.line;
      $('#mTimerHead').textContent = m.head || t('momentHead'); $('#mTimerSub').textContent = m.sub || t('momentSub');
      $('#mSkip').hidden = true; $('#mDecide').hidden = false;
      $('#mChoices').innerHTML = s.choices.map(function (c, i) {
        var def = c.to === m.default;
        return '<button class="mchoice' + (def ? ' default' : '') + '" data-to="' + c.to + '" style="animation-delay:' + (i * 0.12) + 's"><span class="coin" aria-hidden="true">' + PN(c.to) + '</span><span class="mt"><b>' + esc(c.short || c.text) + '</b><span>' + esc(t('turnToShort', { p: PN(c.to) })) + '</span>' + (def ? '<span class="fogtag">' + esc((m.defaultLabel || '') + t('ifYouWait')) + '</span>' : '') + '</span></button>';
      }).join('');
      var secs = m.seconds || 10, t0 = Date.now(), ring = $('#mRing'), lastSec = secs;
      $('#mSec').textContent = secs;
      tick = setInterval(function () {
        var el = (Date.now() - t0) / 1000, left = Math.max(0, secs - el), sec = Math.ceil(left);
        $('#mSec').textContent = sec;
        if (sec !== lastSec) { lastSec = sec; AU.sfx(sec <= 3 ? 'heartbeat' : 'tick'); }
        ring.setAttribute('stroke-dashoffset', (163.4 * (el / secs)).toFixed(1));
        prog.style.width = ((lines.length + Math.min(1, el / secs)) / total * 100) + '%';
        if (creep) creep.set(el / secs);
        if (left <= 0) {
          clearInterval(tick); tick = null;
          toast(m.timeout || t('momentTimeout'), 1600);
          later(function () { paid(m.default, function () { goTo(m.default); }); }, 1500);
        }
      }, 100);
    }
    $('#mSkip').onclick = function () { clearTimers(); step(); };
    step();
  }

  /* ---------------- ending ---------------- */
  var MEDAL_STYLES = {
    good: { rim: ['#FFF4CC', '#F2C86A', '#B8812E', '#6E4412'], face: ['#FFF0BC', '#E8B85A', '#9A6A22'], rib: ['#3A1470', '#8E4FD0'], ink: '#7A4E17' },
    strange: { rim: ['#FFF4CC', '#F2C86A', '#B8812E', '#6E4412'], face: ['#FFE6C8', '#E8A070', '#8A4A2A'], rib: ['#0E4A52', '#2FB4B0'], ink: '#6A3418' },
    bad: { rim: ['#F4F2FF', '#C8C4E0', '#7E78A8', '#3E3860'], face: ['#EEEAFF', '#A8A2CC', '#5E5888'], rib: ['#5A0E1E', '#B3262E'], ink: '#3E3860' }
  };
  var medalId = 0;
  function medalSVG(no, kind, w, h) {
    var c = MEDAL_STYLES[kind] || MEDAL_STYLES.strange, id = 'md' + (medalId++);
    return '<svg class="medal" width="' + w + '" height="' + h + '" viewBox="-5 -3 150 170" aria-hidden="true"><defs>' +
      '<linearGradient id="' + id + 'r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + c.rib[0] + '"/><stop offset=".5" stop-color="' + c.rib[1] + '"/><stop offset="1" stop-color="' + c.rib[0] + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c.rim[0] + '"/><stop offset=".35" stop-color="' + c.rim[1] + '"/><stop offset=".7" stop-color="' + c.rim[2] + '"/><stop offset="1" stop-color="' + c.rim[3] + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'i" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + c.rim[0] + '"/><stop offset=".4" stop-color="' + c.rim[1] + '"/><stop offset="1" stop-color="' + c.rim[3] + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'f" cx=".4" cy=".32" r=".8"><stop offset="0" stop-color="' + c.face[0] + '"/><stop offset=".45" stop-color="' + c.face[1] + '"/><stop offset="1" stop-color="' + c.face[2] + '"/></radialGradient></defs>' +
      '<path d="M42 94 L24 160 L42 148 L54 164 L66 104Z" fill="url(#' + id + 'r)"/><path d="M98 94 L116 160 L98 148 L86 164 L74 104Z" fill="url(#' + id + 'r)"/>' +
      '<circle cx="70" cy="70" r="57" fill="' + c.rim[1] + '" opacity=".16"/><circle cx="70" cy="70" r="53" fill="url(#' + id + 'm)"/><circle cx="70" cy="70" r="49" fill="none" stroke="' + c.rim[3] + '" stroke-width="1.4" stroke-dasharray="2 2.4"/>' +
      '<circle cx="70" cy="70" r="45" fill="url(#' + id + 'i)"/><circle cx="70" cy="70" r="40" fill="url(#' + id + 'f)"/><circle cx="70" cy="70" r="34" fill="none" stroke="' + c.face[2] + '" stroke-width=".8" opacity=".7"/>' +
      '<g transform="translate(46 30) scale(2)" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="' + c.ink + '" stroke-width="1.4" transform="translate(.45 .6)"><path d="M6 17h12l-1.5-2V10a4.5 4.5 0 00-9 0v5z"/><path d="M10.5 20a1.5 1.5 0 003 0"/><path d="M12 3.5v2"/></g><g stroke="#FFF6D8" stroke-width="1.1"><path d="M6 17h12l-1.5-2V10a4.5 4.5 0 00-9 0v5z"/><path d="M10.5 20a1.5 1.5 0 003 0"/><path d="M12 3.5v2"/></g></g>' +
      '<text x="70.6" y="99.6" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="15" font-weight="700" letter-spacing="1.5" fill="' + c.ink + '">' + no + '</text>' +
      '<text x="70" y="99" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="15" font-weight="700" letter-spacing="1.5" fill="#FFF6D8">' + no + '</text>' +
      '<ellipse cx="52" cy="42" rx="18" ry="7" fill="#fff" opacity=".4" transform="rotate(-34 52 42)"/><path d="M126 18 L128 25 L135 27 L128 29 L126 36 L124 29 L117 27 L124 25Z" fill="#FFF6D8" opacity=".9"/></svg>';
  }
  function renderEnding() {
    var p = st.page, s = S[p], e = s.ending;
    if (!e) { show('reader'); return; }
    bgScene(s.scene); AU.setScene(s.scene);
    later(function () { AU.sfx('ending', { kind: e.star ? 'good' : e.kind }); }, 250);
    if (st.lastNew === p) later(function () { AU.sfx('coin'); }, 1400);
    $('#eMedal').innerHTML = medalSVG(e.no, e.star ? 'good' : e.kind, 150, 170);
    $('#eNew').hidden = st.lastNew !== p; $('#eStar').hidden = !e.star;
    $('#eNo').textContent = t('endingNo', { no: e.no, max: ROMAN[TOTAL_END - 1] });
    $('#eTitle').textContent = e.title; $('#eEpi').textContent = e.epilogue;
    var tr = st.trail.slice(), h = '';
    if (tr.length > 6) { h += '<span class="more">…</span><span class="ar">→</span>'; tr = tr.slice(-5); }
    tr.forEach(function (n, i) { h += (i ? '<span class="ar" aria-hidden="true">→</span>' : '') + '<span class="pc' + (i === tr.length - 1 ? ' last' : '') + '">' + PN(n) + '</span>'; });
    $('#ePath').innerHTML = h;
    $('#eCount').textContent = t('youFound', { n: st.found.length, t: TOTAL_END });
    var prevP = st.trail.length > 1 ? st.trail[st.trail.length - 2] : BOOK.start;
    $('#eRewindLabel').textContent = t('rewindTo', { p: PN(prevP) });
    var fb = $('#eFinger');
    if (st.finger && st.finger !== prevP && st.finger !== p && S[st.finger]) { fb.hidden = false; fb.textContent = t('backToFinger', { p: PN(st.finger) }); } else fb.hidden = true;
  }

  /* ---------------- map ---------------- */
  var PAL = {
    mountain: ['#B8A0F0', '#5A3E8E', '#3E2A6E'], village: ['#F6C27A', '#8A5A3A', '#6A4028'], procession: ['#FFDB8A', '#7A5A8E', '#56406E'],
    ridge: ['#ECE8FF', '#7A78B8', '#5A5898'], river: ['#6FE8DE', '#2A6A7A', '#1A4A5A'], lake: ['#8FF6EC', '#2A7A88', '#1A5A68'],
    chamber: ['#F6CC70', '#8A6A3A', '#6A4A22'], lanternhall: ['#FFCA7A', '#8A4A3A', '#6A3428'], stairs: ['#F6A8C0', '#8A4A7A', '#6A3460'],
    bell: ['#86E0C0', '#3A5A6E', '#2A4058'], library: ['#DCB0F4', '#6A4A8E', '#4A3070'], heart: ['#FFDC98', '#6A3E8E', '#4A2A6E'], dawn: ['#FFD8A4', '#B8707A', '#8A4A60']
  };
  var LAYOUT = null;
  function layout() {
    var depth = {}, kids = {}, q = [BOOK.start]; depth[BOOK.start] = 0;
    while (q.length) { var n = q.shift(); kids[n] = []; (S[n].choices || []).forEach(function (c) { if (depth[c.to] === undefined) { depth[c.to] = depth[n] + 1; kids[n].push(c.to); q.push(c.to); } }); }
    var x = 0, pos = {};
    (function place(n) { if (!kids[n].length) { pos[n] = x++; return; } kids[n].forEach(place); pos[n] = (pos[kids[n][0]] + pos[kids[n][kids[n].length - 1]]) / 2; })(BOOK.start);
    var DX = 60, DY = 92, M = 56, maxD = 0, P = {};
    Object.keys(depth).forEach(function (k) { if (depth[k] > maxD) maxD = depth[k]; });
    Object.keys(pos).forEach(function (k) { P[k] = { x: M + pos[k] * DX, y: M + 20 + depth[k] * DY }; });
    return { P: P, w: M * 2 + (x - 1) * DX, h: M * 2 + 40 + maxD * DY };
  }
  function tile(cx, cy, pal) {
    return '<g transform="translate(' + cx + ' ' + cy + ')"><path d="M-24 13 L0 25 L24 13 L15 28 L5 42 L-4 36 L-13 30Z" fill="#241A48"/><path d="M0 25 L24 13 L15 28 L5 42Z" fill="#170F34"/>' +
      '<path d="M-24 0 L0 12 L0 25 L-24 13Z" fill="' + pal[1] + '"/><path d="M24 0 L0 12 L0 25 L24 13Z" fill="' + pal[2] + '"/><path class="ntop" d="M0 -12 L24 0 L0 12 L-24 0Z" fill="' + pal[0] + '"/><path d="M-24 0 L0 12 L24 0" stroke="#fff" stroke-opacity=".45" stroke-width="1" fill="none"/></g>';
  }
  function fogTile(cx, cy, faint) {
    var o = faint ? 0.45 : 1;
    return '<g transform="translate(' + cx + ' ' + cy + ')" opacity="' + o + '"><path d="M-24 0 L0 12 L0 25 L-24 13Z" fill="#C8BEFF" fill-opacity=".05"/><path d="M24 0 L0 12 L0 25 L24 13Z" fill="#C8BEFF" fill-opacity=".03"/><path d="M0 -12 L24 0 L0 12 L-24 0Z" fill="#C8BEFF" fill-opacity=".1" stroke="#DCD2FF" stroke-opacity=".45" stroke-dasharray="3 3"/><text x="0" y="4" text-anchor="middle" font-family="Manrope, sans-serif" font-size="12" font-weight="800" fill="#DCD2FF" fill-opacity=".65">?</text></g>';
  }
  function gem(cx, cy, star) {
    var c = star ? ['#E6FFFB', '#6FF2E2', '#1FA5A5', '#0E6A74'] : ['#FFF3C8', '#F2C766', '#C9933C', '#8E5E1E'];
    return '<g class="gem"><g transform="translate(' + cx + ' ' + cy + ')"><circle r="16" fill="' + c[1] + '" opacity=".22"/><path d="M0 -11 L-7.5 0 L0 0Z" fill="' + c[0] + '"/><path d="M0 -11 L7.5 0 L0 0Z" fill="' + c[1] + '"/><path d="M-7.5 0 L0 11 L0 0Z" fill="' + c[2] + '"/><path d="M7.5 0 L0 11 L0 0Z" fill="' + c[3] + '"/></g></g>';
  }
  function curve(a, b) { var my = (a.y + 12 + b.y - 12) / 2; return 'M' + a.x + ' ' + (a.y + 12) + ' C' + a.x + ' ' + my + ' ' + b.x + ' ' + my + ' ' + b.x + ' ' + (b.y - 12); }
  function renderMap() {
    if (!LAYOUT) LAYOUT = layout();
    var Lm = LAYOUT, P = Lm.P, vis = {}, frontier = {}, honest = hasRole('map');
    st.visited.forEach(function (v) { vis[v] = 1; });
    st.visited.forEach(function (v) { (S[v].choices || []).forEach(function (c) { if (!vis[c.to]) frontier[c.to] = 1; }); });
    if (!st.visited.length) frontier[BOOK.start] = 1;
    var trailEdge = {}; for (var i = 1; i < st.trail.length; i++) trailEdge[st.trail[i - 1] + '>' + st.trail[i]] = 1;
    var edges = '', gold = '', nodes = '', gems = '', fogs = '';
    KEYS.forEach(function (v) {
      if (!vis[v] && !honest) return;
      (S[v].choices || []).forEach(function (c) {
        var a = P[v], b = P[c.to]; if (!a || !b) return;
        var d = curve(a, b);
        if (!vis[v]) { edges += '<path d="' + d + '" stroke="#DCD2FF" stroke-opacity=".14" stroke-width="1.2" stroke-dasharray="2 5" fill="none"/>'; return; }
        if (trailEdge[v + '>' + c.to]) gold += '<path d="' + d + '" stroke="#F6D27C" stroke-width="6" opacity=".3" fill="none"/><path d="' + d + '" stroke="#F6D27C" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
        else if (vis[c.to]) edges += '<path d="' + d + '" stroke="#B9A6F0" stroke-width="2" opacity=".8" fill="none"/>';
        else edges += '<path d="' + d + '" stroke="#DCD2FF" stroke-opacity=".35" stroke-width="1.4" stroke-dasharray="3 4" fill="none"/>';
      });
    });
    Object.keys(P).map(Number).sort(function (a, b) { return P[a].y - P[b].y || P[a].x - P[b].x; }).forEach(function (k) {
      var q = P[k], s = S[k];
      if (vis[k]) {
        nodes += '<g class="node" tabindex="0" role="button" data-node="' + k + '" aria-label="' + esc(t('page', { p: PN(k) }) + ', ' + s.chapter) + '">';
        if (st.page === k) nodes += '<circle class="beacon" cx="' + q.x + '" cy="' + q.y + '" r="30" fill="none" stroke="#F6D27C" stroke-width="2"/>';
        nodes += tile(q.x, q.y, PAL[s.scene] || PAL.mountain) + '<text x="' + q.x + '" y="' + (q.y + 4) + '" text-anchor="middle" font-family="Manrope, sans-serif" font-size="11" font-weight="800" fill="#1A1030" fill-opacity=".85">' + PN(k) + '</text></g>';
        if (s.ending) gems += gem(q.x, q.y - 34, !!s.ending.star);
      } else if (frontier[k]) fogs += fogTile(q.x, q.y);
      else if (honest) fogs += fogTile(q.x, q.y, true);
    });
    var clouds = ''; for (var y = 0; y < Lm.h; y += 70) for (var x = (y / 70) % 2 ? 40 : 0; x < Lm.w; x += 150) clouds += '<ellipse cx="' + x + '" cy="' + y + '" rx="90" ry="22" fill="#BDB3FF" opacity=".05"/>';
    var svg = $('#mapSvg');
    svg.setAttribute('width', Lm.w); svg.setAttribute('height', Lm.h); svg.setAttribute('viewBox', '0 0 ' + Lm.w + ' ' + Lm.h);
    svg.innerHTML = '<defs><pattern id="iso" width="52" height="26" patternUnits="userSpaceOnUse"><path d="M0 13 L26 0 L52 13 L26 26Z" fill="none" stroke="#fff" stroke-opacity=".045"/></pattern></defs><rect width="100%" height="100%" fill="url(#iso)"/>' + clouds + edges + gold + fogs + nodes + gems;
    var stars = ENDS.filter(function (k) { return S[k].ending.star; }), foundStars = stars.filter(function (k) { return st.found.indexOf(k) > -1; }).length;
    $('#mapStats').innerHTML =
      stat('<svg width="22" height="26" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1 L2 14 L12 14Z" fill="#FFF0C0"/><path d="M12 1 L22 14 L12 14Z" fill="#F2C766"/><path d="M2 14 L12 27 L12 14Z" fill="#C9933C"/><path d="M22 14 L12 27 L12 14Z" fill="#8E5E1E"/></svg>', st.found.length, TOTAL_END, t('stEndings')) +
      stat('<svg width="22" height="26" viewBox="0 0 24 28" aria-hidden="true"><path d="M4 5 L16 3 L16 23 L4 25Z" fill="#7C5CFF"/><path d="M16 3 L20 5 L20 25 L16 23Z" fill="#F4EAD2"/><path d="M4 25 L16 23 L20 25 L8 27Z" fill="#CDB994"/></svg>', st.visited.length, KEYS.length, t('stPages')) +
      stat('<svg width="22" height="26" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1 L2 14 L12 14Z" fill="#E6FFFB"/><path d="M12 1 L22 14 L12 14Z" fill="#6FF2E2"/><path d="M2 14 L12 27 L12 14Z" fill="#1FA5A5"/><path d="M22 14 L12 27 L12 14Z" fill="#0E6A74"/></svg>', foundStars, stars.length, t('stTrue'));
    $$('#mapSvg .node').forEach(function (n) {
      var open = function () { openSheet(+n.getAttribute('data-node')); };
      n.addEventListener('click', open); n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    requestAnimationFrame(centerMap);
  }
  function stat(icon, a, b, label) { return '<div class="stat">' + icon + '<div><b>' + a + '<small>/' + b + '</small></b><span>' + esc(label) + '</span></div></div>'; }
  function centerMap() { var sc = $('#mapScroll'), P = LAYOUT && LAYOUT.P, k = st.page || BOOK.start; if (!P || !P[k]) return; sc.scrollLeft = Math.max(0, P[k].x - sc.clientWidth / 2); sc.scrollTop = Math.max(0, P[k].y - sc.clientHeight / 2); }
  (function () {
    var sc, down = false, sx, sy, sl, stp, moved = false;
    document.addEventListener('pointerdown', function (e) { sc = e.target.closest && e.target.closest('#mapScroll'); if (!sc || e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sy = e.clientY; sl = sc.scrollLeft; stp = sc.scrollTop; });
    document.addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; sc.scrollLeft = sl - dx; sc.scrollTop = stp - dy; });
    document.addEventListener('pointerup', function () { down = false; });
    document.addEventListener('click', function (e) { if (moved && e.target.closest && e.target.closest('#mapScroll')) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  })();
  var sheetTarget = null;
  function openSheet(k) {
    var s = S[k]; sheetTarget = k;
    $('#sheetCaps').textContent = t('page', { p: PN(k) }) + (s.ending ? t('sheetEnding', { no: s.ending.no }) : '');
    $('#sheetTitle').textContent = s.ending ? s.ending.title : s.chapter;
    var tx = strip(s.text[0]); $('#sheetText').textContent = tx.slice(0, 140) + (tx.length > 140 ? '…' : '');
    $('#sheetGo').textContent = t('readPage', { p: PN(k) });
    $('#sheet').hidden = false; $('#sheetBg').hidden = false; $('#sheetGo').focus();
  }
  function closeSheet() { $('#sheet').hidden = true; if ($('#settings').hidden) $('#sheetBg').hidden = true; }

  /* ---------------- endings ---------------- */
  var resetArmed = false;
  function renderEndings() {
    $('#endCount').textContent = t('endCount', { n: st.found.length, t: TOTAL_END });
    var sorted = ENDS.slice().sort(function (a, b) { return ROMAN.indexOf(S[a].ending.no) - ROMAN.indexOf(S[b].ending.no); });
    $('#medalGrid').innerHTML = sorted.map(function (k) {
      var e = S[k].ending, f = st.found.indexOf(k) > -1;
      if (f) return '<div class="mslot found">' + medalSVG(e.no, e.star ? 'good' : e.kind, 62, 70) + '<span class="mn">' + esc(t('endingCaps', { no: e.no }) + (e.star ? t('trueCaps') : '')) + '</span><span class="mtitle">' + esc(e.title) + '</span></div>';
      return '<div class="mslot"><svg viewBox="-5 -3 150 170" aria-hidden="true"><circle cx="70" cy="70" r="53" fill="#1E1840" stroke="#DCD2FF" stroke-opacity=".35" stroke-width="2" stroke-dasharray="5 5"/><text x="70" y="86" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="48" font-weight="700" fill="#DCD2FF" fill-opacity=".5">?</text></svg><span class="mn">' + esc(t('endingCaps', { no: e.no })) + '</span><span class="mhint" hidden data-hint="' + k + '">' + esc(e.hint) + '</span><button class="hintbtn" data-hintbtn="' + k + '">' + esc(t('showHint')) + '</button></div>';
    }).join('');
    resetArmed = false; if ($('#resetAll')) $('#resetAll').textContent = t('erase'); // the erase option was removed (Manuel 28-09)
  }

  /* ---------------- relics ---------------- */
  var ICON = {
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    lantern: '<path d="M9 5h6M12 2v3M8 8h8l-1 10H9z"/><path d="M8 8l-1-1M16 8l1-1M10 21h4M11 12c0 1.5 2 1.5 2 0 0-1.2-1-2-1-3-.3 1-1 1.6-1 3z"/>',
    chisel: '<path d="M14 3l7 7-3 3-7-7z"/><path d="M11 6L4 13l-1 5 5-1 7-7"/><path d="M3 21l3-3"/>',
    boat: '<path d="M3 15h18l-3 5H6z"/><path d="M12 3v12M12 4l6 9h-6"/>',
    bell: '<path d="M6 16h12l-1.5-2V10a4.5 4.5 0 00-9 0v4z"/><path d="M10.5 19a1.5 1.5 0 003 0"/><path d="M12 3.5v2"/>',
    brush: '<path d="M20 3c-5 3-9 7-11 11l2 2c4-2 8-6 11-11z"/><path d="M9 14c-3 0-4 2-4 4 0 1-1 2-2 2 3 1 7 0 8-4"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    star: '<circle cx="12" cy="12" r="8"/><path d="M12 7l1.3 3.2 3.2.3-2.4 2.1.8 3.2-2.9-1.7-2.9 1.7.8-3.2-2.4-2.1 3.2-.3z"/>',
    quill: '<path d="M20 4C12 5 7 10 5 19"/><path d="M20 4c-1 6-5 10-11 11"/><path d="M4 21l2-3"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/><path d="M15 7l.6 1.4 1.4.6-1.4.6L15 11l-.6-1.4-1.4-.6 1.4-.6z"/>',
    window: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3.5v6M12 14.5v6M3.5 12h6M14.5 12h6M6 6l4.2 4.2M13.8 13.8L18 18M18 6l-4.2 4.2M10.2 13.8L6 18"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'
  };
  function iconSVG(k, color) { return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (color || '#3A2406') + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[k] || ICON.star) + '</svg>'; }
  function relic(id) { return REL && REL.relics.filter(function (r) { return r.id === id; })[0]; }
  // the shop (shop.js) is switched off by default; while off, everything stays free as before
  function shopOn() { return !!(window.WaywardShop && window.WaywardShop.enabled && window.WaywardShop.enabled()); }
  function gated(kind, run) { if (shopOn() && window.WaywardShop.gate) window.WaywardShop.gate(kind, run); else run(); }
  function withShelf(map) { SHELF.forEach(function (b) { if (b.music) Object.keys(b.music).forEach(function (k) { if (!map[k]) map[k] = b.music[k]; }); }); return map; } // every book's music by place
  function hasRole(role) { return !!(BK.roles && BK.roles[role]) && hasTier(BK.roles[role]); } // edge (gilt/salted), map, secret
  function edgeClass(el) { var on = hasRole('edge'), kind = BK.roles && BK.roles.edge; el.classList.toggle('gilt', on && kind === 'gilt'); el.classList.toggle('salted', on && kind === 'salted'); }
  function hasTier(id) { if (!REL) return false; var tr = REL.tiers.filter(function (x) { return x.id === id; })[0]; return !!tr && st.relics.length >= tr.count; }
  function whereText(r) { return r.where === 'text' ? t('foundOnPage', { p: PN(r.page) }) : r.where === 'scene' ? t('foundScene') : t('foundUi'); }
  function foundRelic(id, pt) {
    var r = relic(id); if (!r) return;
    var isNew = st.relics.indexOf(id) === -1, before = st.relics.length;
    if (isNew) { st.relics.push(id); save(); }
    if (pt) FX.sparkle(app, pt.x, pt.y, { n: isNew ? 24 : 10 });
    AU.sfx(isNew ? 'relic' : 'tap');
    $$('.egg[data-egg="' + id + '"]').forEach(function (el) { el.classList.add('got'); });
    $$('.hotspot[data-hot="' + id + '"]').forEach(function (el) { el.classList.add('found'); });
    var unlocked = isNew ? REL.tiers.filter(function (x) { return before < x.count && st.relics.length >= x.count; }) : [];
    if (unlocked.length) { edgeClass($('#tome')); }
    renderTabBadge();
    setTimeout(function () { showRelicCard(r, isNew, unlocked); }, isNew ? 420 : 0);
  }
  function showRelicCard(r, isNew, unlocked) {
    var i = st.relics.indexOf(r.id) + 1, host = $('#cardHost');
    var unl = (unlocked || []).map(function (x) { return '<div class="unlock">✦ ' + esc(t('rewardUnlocked')) + ': ' + esc(L(x.name)) + '<br><span style="font-weight:600;color:var(--muted)">' + esc(L(x.desc)) + '</span></div>'; }).join('');
    var secretBtn = (unlocked || []).some(function (x) { return x.id === (BK.roles && BK.roles.secret); }) ? '<button class="btn-glass" id="cardSecret" style="width:100%">' + esc(t('openSecret')) + '</button>' : '';
    host.innerHTML = '<div class="card-bg" id="cardBg"><div class="rcard" role="dialog" aria-modal="true" aria-labelledby="rcTitle"><div class="rays"></div><div class="relic-coin">' + iconSVG(r.icon) + '</div>' +
      '<span class="caps gold">' + esc(isNew ? t('relicFound') + ' · ' + t('relicNo', { i: i, t: REL.relics.length }) : t('relicNo', { i: i, t: REL.relics.length })) + '</span>' +
      '<h3 class="gold-foil" id="rcTitle">' + esc(L(r.name)) + '</h3><div class="lore">' + esc(L(r.lore)) + '</div><span class="where">' + esc(whereText(r)) + '</span>' + unl +
      '<button class="btn-gold lg" id="cardOk">' + esc(t('keepIt')) + '<span class="shine"></span></button>' + secretBtn + '</div></div>';
    AU.duck(true);
    var close = function () { host.innerHTML = ''; AU.duck(false); if (current === 'relics') renderRelics(); };
    $('#cardOk').addEventListener('click', close);
    $('#cardBg').addEventListener('click', function (e) { if (e.target.id === 'cardBg') close(); });
    var sb = $('#cardSecret'); if (sb) sb.addEventListener('click', function () { close(); show('secret'); });
    $('#cardOk').focus();
  }
  function renderRelics() {
    if (!REL) return;
    var n = st.relics.length, total = REL.relics.length;
    $('#relCount').textContent = t('relicsFound', { n: n, t: total });
    $('#relBar').innerHTML = '<i style="width:' + (n / total * 100).toFixed(1) + '%"></i>' + REL.tiers.map(function (x) { return '<b class="' + (n >= x.count ? 'on' : '') + '" style="left:' + (x.count / total * 100) + '%">' + x.count + '</b>'; }).join('');
    $('#relGrid').innerHTML = REL.relics.map(function (r) {
      var f = st.relics.indexOf(r.id) > -1;
      if (f) return '<button class="rslot found" data-relic="' + r.id + '"><span class="relic-coin">' + iconSVG(r.icon) + '</span><span class="rt">' + esc(L(r.name)) + '</span></button>';
      return '<div class="rslot"><span class="relic-coin none"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="16" font-weight="700" fill="#DCD2FF" fill-opacity=".55">?</text></svg></span><span class="rr" hidden data-riddle="' + r.id + '">' + esc(L(r.riddle)) + '</span><button class="hintbtn" data-riddlebtn="' + r.id + '">' + esc(t('showRiddle')) + '</button></div>';
    }).join('');
    $('#relTiers').innerHTML = REL.tiers.map(function (x) {
      var on = n >= x.count, btn = on && x.id === (BK.roles && BK.roles.secret) ? '<button class="btn-gold sm" data-go="secret">' + esc(t('openSecret')) + '</button>' : '<span class="tstate">' + esc(on ? t('unlocked') : t('rewardAt', { n: x.count })) + '</span>';
      return '<div class="tier' + (on ? ' on' : '') + '"><span class="relic-coin' + (on ? '' : ' none') + '" style="width:44px;height:44px;flex-basis:44px">' + iconSVG(x.id === (BK.roles && BK.roles.edge) ? 'brush' : x.id === (BK.roles && BK.roles.map) ? 'map' : 'quill', on ? '#3A2406' : '#DCD2FF') + '</span><div class="ti"><b>' + esc(L(x.name)) + '</b><span>' + esc(L(x.desc)) + '</span></div>' + btn + '</div>';
    }).join('');
  }
  function renderSecret() {
    if (!REL || !hasRole('secret')) { show('relics'); return; }
    var s = REL.secret;
    $('#secLabel').textContent = L(s.label); $('#secTitle').textContent = L(s.label) + ' · ' + L(s.title);
    $('#secText').innerHTML = (s.text[lang] || s.text.en).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    $('#secSign').textContent = L(s.sign);
  }

  /* ---------------- settings ---------------- */
  function renderSettings() {
    $$('#setLang button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false'); });
    $('#volMusic').value = prefs.musicVol; $('#volSfx').value = prefs.sfxVol; paintVol();
    $$('#setSpeed button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === prefs.speed ? 'true' : 'false'); });
    $$('#setFirst button').forEach(function (b) { b.setAttribute('aria-pressed', (b.getAttribute('data-v') === 'on') === !!prefs.firstRead ? 'true' : 'false'); });
  }
  function openSettings() { renderSettings(); $('#settings').hidden = false; $('#sheetBg').hidden = false; } // no ducking here: you hear the level you set
  function closeSettings() { if ($('#settings').hidden) return; $('#settings').hidden = true; if ($('#sheet').hidden) $('#sheetBg').hidden = true; }
  $('#settings').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'setDone') { closeSettings(); return; }
    if (b.id === 'setCredits') { $('#crBody').innerHTML = t('creditsHtml'); $('#settings').hidden = true; $('#credits').hidden = false; $('#crBody').scrollTop = 0; return; }
    var seg = b.parentElement.id;
    if (seg === 'setLang') setLang(b.getAttribute('data-lang'));
    if (seg === 'setSpeed') prefs.speed = b.getAttribute('data-v');
    if (seg === 'setFirst') prefs.firstRead = b.getAttribute('data-v') === 'on'; // off by default
    savePrefs(); renderSettings();
  });

  // two volume sliders; 0 switches that sound off
  function paintVol() { ['volMusic', 'volSfx'].forEach(function (id) { var el = $('#' + id); el.style.setProperty('--v', el.value + '%'); }); }
  function applyVol() {
    AU.setVolume('music', prefs.musicVol); AU.setVolume('sfx', prefs.sfxVol);
    prefs.music = prefs.musicVol > 0; prefs.sfx = prefs.sfxVol > 0; AU.setMusic(prefs.music); AU.setSfx(prefs.sfx);
  }
  var volT = null;
  ['volMusic', 'volSfx'].forEach(function (id) {
    $('#' + id).addEventListener('input', function (e) {
      prefs[id === 'volMusic' ? 'musicVol' : 'sfxVol'] = +e.target.value; applyVol(); paintVol();
      if (id === 'volSfx') { clearTimeout(volT); volT = setTimeout(function () { AU.sfx('page', { gain: 0.8 }); }, 120); }
    });
    $('#' + id).addEventListener('change', savePrefs);
  });

  // hidden test switch for the (switched-off) shop: tap the credits title five times
  (function () { var n = 0, tt = 0; $('#crTitle').addEventListener('click', function () {
    var now = Date.now(); n = now - tt < 700 ? n + 1 : 1; tt = now; if (n < 5) return; n = 0;
    var on = false; try { on = localStorage.getItem('wayward.shop.dev') === '1'; localStorage.setItem('wayward.shop.dev', on ? '0' : '1'); } catch (e) {}
    toast(lang === 'nl' ? (on ? 'Winkel-voorproef uit' : 'Winkel-voorproef aan') : (on ? 'Shop preview off' : 'Shop preview on'), 1400);
    setTimeout(function () { location.reload(); }, 1300);
  }); })();
  $('#crDone').addEventListener('click', function () { $('#credits').hidden = true; if ($('#sheet').hidden && $('#settings').hidden) $('#sheetBg').hidden = true; });

  var RENDER = { library: renderLibrary, cover: renderCover, reader: renderReader, moment: renderMoment, ending: renderEnding, map: renderMap, endings: renderEndings, relics: renderRelics, secret: renderSecret };

  /* ---------------- events ---------------- */
  app.addEventListener('pointerdown', function () { AU.unlock(); playActive(); }, true);
  app.addEventListener('click', function (e) {
    var tg = e.target.closest('[data-bookid],[data-go],[data-tab],.choice,.mchoice,[data-hintbtn],[data-riddlebtn],[data-relic],[data-act],[data-settings],[data-lang],[data-soon],.egg.on,.hotspot');
    if (!tg) return;
    if (tg.closest('#settings')) return;
    if (tg.classList.contains('egg')) { var r = tg.getBoundingClientRect(), a = app.getBoundingClientRect(); foundRelic(tg.getAttribute('data-egg'), { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 }); return; }
    if (tg.classList.contains('hotspot')) { var hr = tg.getBoundingClientRect(), ar = app.getBoundingClientRect(); foundRelic(tg.getAttribute('data-hot'), { x: hr.left - ar.left + hr.width / 2, y: hr.top - ar.top + hr.height / 2 }); return; }
    if (tg.hasAttribute('data-bookid')) { AU.sfx('tap'); var bid = tg.getAttribute('data-bookid'); switchBook(bid).then(function (ok) { if (ok) show('cover'); }); return; }
    if (tg.hasAttribute('data-settings')) { AU.sfx('tap'); openSettings(); return; }
    if (tg.hasAttribute('data-lang')) { AU.sfx('tap'); setLang(tg.getAttribute('data-lang')); return; }
    if (tg.hasAttribute('data-soon')) {
      var title = t(tg.getAttribute('data-title')), preset = tg.getAttribute('data-soon');
      if (reduceMotion) { toast(t('soonToast', { title: title })); return; }
      AU.sfx('whoosh'); FX.veil(app, { preset: preset, onCovered: function (rel) { setTimeout(rel, 350); }, onDone: function () { toast(t('soonToast', { title: title }), 2000); } });
      return;
    }
    if (tg.hasAttribute('data-hintbtn')) { gated('hint', function () { var k = tg.getAttribute('data-hintbtn'), h = app.querySelector('[data-hint="' + k + '"]'); if (h) h.hidden = false; tg.hidden = true; }); return; }
    if (tg.hasAttribute('data-riddlebtn')) { gated('riddle', function () { var rk = tg.getAttribute('data-riddlebtn'), rr = app.querySelector('[data-riddle="' + rk + '"]'); if (rr) rr.hidden = false; tg.hidden = true; }); return; }
    if (tg.hasAttribute('data-relic')) { showRelicCard(relic(tg.getAttribute('data-relic')), false, []); return; }
    if (tg.hasAttribute('data-act')) {
      var act = tg.getAttribute('data-act');
      if (act === 'ending') show('ending');
      else if (act === 'moment') show('moment');
      else if (act === 'scene' && R.mode === 'read') runScene(R.p, function () { paintFoot(); });
      return;
    }
    if (tg.classList.contains('choice')) { chooseTo(+tg.getAttribute('data-to')); return; }
    if (tg.classList.contains('mchoice')) { clearTimers(); var mto = +tg.getAttribute('data-to'); paid(mto, function () { AU.sfx('choice'); goTo(mto); }); return; }
    var go = tg.getAttribute('data-go') || tg.getAttribute('data-tab');
    if (go) { AU.sfx('tap'); show(go); }
  });
  $('#heroGo').addEventListener('click', function (e) { e.stopPropagation(); openBook(resume); });
  $('#coverGo').addEventListener('click', function () { openBook(resume); });
  $('#coverRestart').addEventListener('click', function () { openBook(startBook); });
  $('#turnBtn').addEventListener('click', function (e) { e.stopPropagation(); turnSheet(1); });
  $('#sceneHit').addEventListener('click', function () { if (R.mode === 'read') setLook(true); else if (R.mode === 'look') setLook(false); });
  $('#rLook').addEventListener('click', function () { setLook(R.mode !== 'look'); });
  $('#lookBack').addEventListener('click', function () { setLook(false); });
  $('#rFinger').addEventListener('click', function () { st.finger = st.finger === st.page ? null : st.page; save(); renderFinger(); AU.sfx('tap'); toast(st.finger ? t('fingerOn', { p: PN(st.page) }) : t('fingerOff'), 1200); });
  $('#mAsText').addEventListener('click', function () { clearTimers(); show('reader'); });
  $('#eRewind').addEventListener('click', function () { if (st.trail.length > 1) st.trail.pop(); goTo(st.trail[st.trail.length - 1] || BOOK.start, { push: false, asText: true }); });
  $('#eFinger').addEventListener('click', function () { var f = st.finger, i = st.trail.lastIndexOf(f); if (i > -1) st.trail = st.trail.slice(0, i + 1); else st.trail.push(f); goTo(f, { push: false, asText: true }); });
  $('#eRestart').addEventListener('click', function () { openBook(startBook); });
  $('#mapBack').addEventListener('click', function () { show(prevScreen === 'reader' || prevScreen === 'ending' ? prevScreen : 'library'); });
  $('#mapLocate').addEventListener('click', centerMap);
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#sheetBg').addEventListener('click', function () { $('#credits').hidden = true; closeSheet(); closeSettings(); if ($('#sheet').hidden && $('#settings').hidden) $('#sheetBg').hidden = true; });
  $('#sheetGo').addEventListener('click', function () { var k = sheetTarget; closeSheet(); if (k) goTo(k, { asText: true }); });
  if ($('#resetAll')) $('#resetAll').addEventListener('click', function () {
    if (!resetArmed) { resetArmed = true; this.textContent = t('eraseConfirm'); return; }
    st = fresh(); save(); show('library'); toast(t('erased'), 1400);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { $('#credits').hidden = true; closeSheet(); closeSettings(); if ($('#cardOk')) $('#cardOk').click(); }
    if (current === 'reader' && R.mode === 'read') { if (e.key === 'ArrowRight') turnSheet(1); if (e.key === 'ArrowLeft') turnSheet(-1); }
  });
  var lastSize = [app.clientWidth, app.clientHeight];
  window.addEventListener('resize', function () {
    var w = app.clientWidth, h = app.clientHeight;
    if (Math.abs(w - lastSize[0]) < 2 && Math.abs(h - lastSize[1]) < 60) return; // ignore toolbar wobble
    lastSize = [w, h];
    if (current === 'reader' && R.mode === 'read' && !R.turning && !R.intro) { clearTimeout(window.__rz); window.__rz = setTimeout(function () { renderReader({ keepSheet: true, instant: true }); }, 250); }
  });

  /* ---------------- boot ---------------- */
  $$('.particles').forEach(particles);
  tilt('#heroStage', '#hero', 10);
  load();
  if (!Array.isArray(st.relics)) st.relics = []; if (!Array.isArray(st.scenes)) st.scenes = [];
  var qs = (location.search.match(/[?&]lang=(en|nl)/) || [])[1]; if (qs) prefs.lang = qs;
  lang = prefs.lang === 'nl' ? 'nl' : 'en';
  // decode the paper once, up front, so the first page turn doesn't wait for it
  ['page-1', 'page-2', 'page-3', 'page-4', 'page-back'].forEach(function (n) { try { var im = new Image(); im.src = 'img/' + n + '.webp'; if (im.decode) im.decode().catch(function () {}); } catch (e) {} });
  if (prefs.musicVol == null) prefs.musicVol = prefs.music === false ? 0 : 45;
  if (prefs.sfxVol == null) prefs.sfxVol = prefs.sfx === false ? 0 : 45;
  applyVol();
  (function () { var OM = window.WaywardOmens && window.WaywardOmens.scenes; SHELF.forEach(function (b) { if (OM && b.omens) Object.keys(b.omens).forEach(function (k) { if (!OM[k]) OM[k] = b.omens[k]; }); }); })(); // every book's omens
  AU.tracks('music/', withShelf({ menu: 'menu.mp3', mountain: 'mountain.mp3', village: 'village.mp3', procession: 'procession.mp3', ridge: 'ridge.mp3', river: 'river.mp3', lake: 'lake.mp3',
    chamber: 'chamber.mp3', heart: 'heart.mp3', lanternhall: 'lanternhall.mp3', library: 'library.mp3', stairs: 'stairs.mp3', bell: 'bell.mp3', dawn: 'dawn.mp3' }));
  if (!SPEED[prefs.speed]) prefs.speed = 'read';
  if (AU.samples) AU.samples('sfx/', {
    page: ['page1', 'page2', 'page3'], grab: ['grab'], open: ['open'], close: ['close'], choice: ['choice'], tap: ['tap'], tick: ['tick'], heartbeat: ['heartbeat'],
    bell: ['bell'], coin: ['coin'], relic: ['relic'], sparkle: ['sparkle'], whoosh: ['whoosh'], fogin: ['fogin'], wind: ['wind'], drip: ['drip1', 'drip2', 'drip3'],
    breath: ['breath'], roar: ['roar'], wings: ['wings'], wipe: ['wipe'], creak: ['creak'], rumble: ['rumble'], whisper: ['whisper'], scrape: ['scrape'], fire: ['fire'], quill: ['quill'],
    'ending:good': ['good'], 'ending:strange': ['strange'], 'ending:bad': ['bad']
  }, { page: 0.75, grab: 0.4, open: 0.9, close: 0.8, choice: 0.55, tap: 0.22, tick: 0.45, heartbeat: 0.75, bell: 0.85, coin: 0.6, relic: 0.75, sparkle: 0.5, whoosh: 0.45, fogin: 0.75,
    wind: 0.45, drip: 0.6, breath: 0.45, roar: 0.4, wings: 0.45, wipe: 0.4, creak: 0.55, rumble: 0.6, whisper: 0.4, scrape: 0.45, fire: 0.45, quill: 0.5, 'ending:good': 0.75, 'ending:strange': 0.7, 'ending:bad': 0.7 });
  (function () { // slightly uneven, deckled page edges (the spine edge stays straight)
    var d = 'M0 0', n = 48, i, j = function (a) { return Math.random() * a; };
    for (i = 1; i <= n; i++) d += ' L' + (i * 100 / n).toFixed(2) + ' ' + (0.1 + j(0.35)).toFixed(2);
    for (i = 1; i <= n * 1.6; i++) d += ' L' + (99.9 - j(0.6)).toFixed(2) + ' ' + (i * 100 / (n * 1.6)).toFixed(2);
    for (i = n; i >= 0; i--) d += ' L' + (i * 100 / n).toFixed(2) + ' ' + (99.9 - j(0.3)).toFixed(2);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="' + d + ' Z" fill="#000"/></svg>';
    document.documentElement.style.setProperty('--deckle', 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")');
  })();
  loadBookData().then(function () {
    applyI18n();
    var hash = (location.hash || '').replace('#', '');
    if (window.WaywardShop && window.WaywardShop.init) { try { window.WaywardShop.init(window.WaywardApp); } catch (e) { if (window.console) console.warn('shop', e); } }
    if (hash && RENDER[hash] && ['library', 'cover', 'map', 'endings', 'relics'].indexOf(hash) > -1) show(hash); else show('library');
  }).catch(function () {
    app.insertAdjacentHTML('beforeend', '<p class="loaderr">' + esc(t('loadErr')) + '</p>');
  });

  window.WaywardApp = { st: function () { return st; }, prefs: function () { return prefs; }, save: save, savePrefs: savePrefs, t: t, L: L, lang: function () { return lang; },
    toast: toast, sfx: function (n, o) { AU.sfx(n, o); }, AU: AU, FX: FX, show: show, current: function () { return current; }, book: function () { return BOOK; },
    relics: function () { return REL; }, bookDef: function () { return BK; }, hasTier: hasTier, esc: esc, $: $, $$: $$, app: app, shopOn: shopOn, openSettings: function () { openSettings(); }, closeSettings: function () { closeSettings(); } };
  window.__wayward = { pn: PN, book: function () { return BK; }, switchBook: switchBook, prefs: function () { return prefs; }, omens: function () { return OMENS; }, curl: function () { return CURL; }, smoke: function () { return SMK; }, st: function () { return st; }, R: R, goTo: goTo, show: show, setLang: setLang, foundRelic: foundRelic, openBook: openBook, resume: resume, startBook: startBook, turnSheet: turnSheet, chooseTo: chooseTo, runScene: runScene, setLook: setLook, finishReveal: finishReveal, mapPt: mapPt, current: function () { return current; } };
})();
