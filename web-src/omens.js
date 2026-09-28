/* Wayward omens: now and then the world around the book does something. Water drips onto the page,
   eyes open in the dark, a tentacle feels its way over the edge, a shape crosses the sky, the ground shakes.
   Each omen cleans up after itself. The app decides when; this file decides how. */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  function rand(a, b) { return a + Math.random() * (b - a); }
  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function svg(tag, attrs, parent) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function later(fn, ms, bag) { var t = setTimeout(fn, ms); if (bag) bag.push(t); return t; }

  var SCENES = {
    mountain: ['wind', 'shadow', 'eyes'], village: ['moth', 'embers', 'wind'], procession: ['eyes', 'whisper', 'moth'],
    ridge: ['wind', 'shadow', 'wind'], river: ['drips', 'eyes', 'tentacle', 'drips'], lake: ['drips', 'tentacle', 'drips'],
    chamber: ['quake', 'quill', 'whisper'], lanternhall: ['embers', 'moth', 'whisper'], stairs: ['wind', 'shadow'],
    bell: ['quake', 'eyes', 'wind'], library: ['quill', 'moth', 'whisper'], heart: ['quake', 'eyes', 'tentacle', 'drips'], dawn: ['wind', 'shadow']
  };
  var EYE_SPOTS = { // where eyes may open, in % of the screen (dark corners above and beside the book)
    mountain: [[14, 40], [86, 36], [70, 12]], procession: [[12, 30], [88, 24], [80, 8]], river: [[16, 22], [84, 30], [8, 12], [60, 10]],
    bell: [[10, 28], [90, 18], [30, 10]], heart: [[14, 18], [86, 22], [50, 7], [8, 30]]
  };

  function Omens(o) { this.o = o; this.bag = []; this.busy = false; }
  Omens.prototype.list = function (scene) { return SCENES[scene] || ['wind']; };
  Omens.prototype.stop = function () { this.bag.forEach(clearTimeout); this.bag = []; var l = this.o.layer; if (l) l.innerHTML = ''; this.o.pages.querySelectorAll('.om-glyphs,.om-wet').forEach(function (x) { x.remove(); }); if (this.o.tome) this.o.tome.classList.remove('om-shake'); this.busy = false; };
  Omens.prototype.play = function (scene, name) {
    if (this.busy) return false;
    name = name || this.list(scene)[Math.floor(Math.random() * this.list(scene).length)];
    var f = this[name]; if (!f) return false;
    this.busy = true; var self = this;
    var dur = f.call(this, scene) || 4000;
    later(function () { self.busy = false; }, dur, this.bag);
    return name;
  };
  Omens.prototype.sfx = function (n, opts) { if (this.o.sfx) this.o.sfx(n, opts || {}); };
  Omens.prototype.pageRect = function () { var a = this.o.app.getBoundingClientRect(), p = this.o.pages.getBoundingClientRect(); return { x: p.left - a.left, y: p.top - a.top, w: p.width, h: p.height, W: a.width, H: a.height }; };

  /* water drips from the cave roof onto the page, leaving wet spots that dry */
  Omens.prototype.drips = function () {
    var self = this, L = this.o.layer, r = this.pageRect(), n = Math.floor(rand(2, 4));
    for (var i = 0; i < n; i++) (function (k) {
      later(function () {
        var x = r.x + rand(0.12, 0.88) * r.w, ty = r.y + rand(0.1, 0.8) * r.h, d = el('div', 'om-drop', L);
        d.style.left = x + 'px'; d.style.setProperty('--fall', ty + 'px'); d.style.animationDuration = (0.45 + ty / 1600).toFixed(2) + 's';
        later(function () {
          d.remove(); var sp = el('div', 'om-splash', L); sp.style.left = x + 'px'; sp.style.top = ty + 'px';
          for (var j = 0; j < 5; j++) { var b = el('i', '', sp), a = rand(-2.6, -0.5); b.style.setProperty('--dx', (Math.cos(a) * rand(8, 18)).toFixed(1) + 'px'); b.style.setProperty('--dy', (Math.sin(a) * rand(8, 16)).toFixed(1) + 'px'); }
          later(function () { sp.remove(); }, 700, self.bag);
          var wet = el('div', 'om-wet', self.o.pages); wet.style.left = (x - r.x) + 'px'; wet.style.top = (ty - r.y) + 'px'; wet.style.transform = 'translate(-50%,-50%) scale(' + rand(0.7, 1.3).toFixed(2) + ',' + rand(0.7, 1.1).toFixed(2) + ') rotate(' + rand(0, 180).toFixed(0) + 'deg)';
          setTimeout(function () { wet.remove(); }, 12500);
          self.sfx('drip', { pan: ((x / r.W) - 0.5) * 1.2, gain: rand(0.7, 1), wet: 0.3 });
        }, (0.45 + ty / 1600) * 1000, self.bag);
      }, k * rand(700, 1300), self.bag);
    })(i);
    return 4200;
  };

  /* eyes open in the dark around the book, blink, and are gone */
  Omens.prototype.eyes = function (scene) {
    var L = this.o.layer, spots = (EYE_SPOTS[scene] || EYE_SPOTS.river).slice(), n = Math.min(spots.length, Math.floor(rand(1, 3)));
    this.sfx('breath', { gain: 0.8 });
    for (var i = 0; i < n; i++) {
      var s = spots.splice(Math.floor(Math.random() * spots.length), 1)[0], e = el('div', 'om-eyes', L), size = rand(0.8, 1.3);
      e.style.left = s[0] + '%'; e.style.top = s[1] + '%'; e.style.transform = 'translate(-50%,-50%) scale(' + size.toFixed(2) + ')'; e.style.animationDelay = (i * 0.5).toFixed(1) + 's';
      el('i', '', e); el('i', '', e);
    }
    var self = this; later(function () { L.querySelectorAll('.om-eyes').forEach(function (x) { x.remove(); }); }, 5200, this.bag);
    return 5400;
  };

  /* a tentacle reaches up over the edge of the book, feels around, and slides back */
  Omens.prototype.tentacle = function () {
    var L = this.o.layer, r = this.pageRect(), right = Math.random() < 0.5, self = this;
    var box = svg('svg', { 'class': 'om-svg', width: r.W, height: r.H, viewBox: '0 0 ' + r.W + ' ' + r.H }, L);
    var defs = svg('defs', {}, box), gr = svg('linearGradient', { id: 'omTg', x1: '0', y1: '0', x2: '1', y2: '0' }, defs);
    svg('stop', { offset: '0', 'stop-color': '#1B0F2E' }, gr); svg('stop', { offset: '.55', 'stop-color': '#3A2254' }, gr); svg('stop', { offset: '1', 'stop-color': '#6B4A86' }, gr);
    var shadow = svg('path', { fill: 'rgba(10,4,20,.35)', filter: 'blur(6px)' }, box), body = svg('path', { fill: 'url(#omTg)', stroke: '#8E6BB0', 'stroke-width': '1', 'stroke-opacity': '.5' }, box), sucks = svg('g', { fill: '#C9A6D8', 'fill-opacity': '.55' }, box);
    var baseX = right ? r.x + r.w + 6 : r.x - 6, baseY = r.y + r.h * rand(0.55, 0.8), dir = right ? -1 : 1, t0 = performance.now(), D = 4600, N = 26, raf;
    this.sfx('scrape', { gain: 0.55, rate: 0.8 }); later(function () { self.sfx('breath', { gain: 0.5, rate: 0.85 }); }, 1500, this.bag);
    function frame(now) {
      var t = (now - t0) / D; if (t >= 1) { box.remove(); return; }
      var reach = t < .35 ? Math.sin(t / .35 * Math.PI / 2) : t > .75 ? Math.cos((t - .75) / .25 * Math.PI / 2) : 1, len = r.w * 0.62 * reach, pts = [], left = [], rightS = [], d = '', sd = '', s = '';
      for (var i = 0; i <= N; i++) {
        var u = i / N, ang = -0.9 + u * (1.9 + Math.sin(now / 520 + u * 3) * 0.35) + Math.sin(now / 900) * 0.2, px = baseX, py = baseY;
        if (i) { px = pts[i - 1][0] + dir * Math.cos(ang) * len / N; py = pts[i - 1][1] - Math.sin(ang) * len / N; }
        pts.push([px, py]);
      }
      for (i = 0; i <= N; i++) {
        var a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl, w = 18 * (1 - i / N) + 1.5;
        left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); rightS.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
        if (i % 3 === 1 && i < N - 2) s += '<circle cx="' + (pts[i][0] - nx * w * .45).toFixed(1) + '" cy="' + (pts[i][1] - ny * w * .45).toFixed(1) + '" r="' + (w * .28).toFixed(1) + '"/>';
      }
      var all = left.concat(rightS.reverse());
      d = 'M' + all.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') + 'Z';
      sd = 'M' + all.map(function (p) { return (p[0] + dir * 6).toFixed(1) + ' ' + (p[1] + 10).toFixed(1); }).join(' L') + 'Z';
      body.setAttribute('d', d); shadow.setAttribute('d', sd); sucks.innerHTML = s;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return 5000;
  };

  /* something with wings crosses the sky above the book */
  Omens.prototype.shadow = function () {
    var L = this.o.layer, r = this.pageRect(), ltr = Math.random() < 0.5, self = this;
    var w = el('div', 'om-wing ' + (ltr ? 'ltr' : 'rtl'), L); w.style.top = (r.y * rand(0.25, 0.55)) + 'px';
    w.innerHTML = '<svg viewBox="0 0 220 90" aria-hidden="true"><g class="wl"><path d="M110 46 C92 30 70 14 38 10 C52 20 56 26 50 30 C38 26 22 26 6 34 C22 36 30 40 34 46 C22 46 14 50 8 58 C40 52 76 56 104 54Z"/></g><g class="wr"><path d="M110 46 C128 30 150 14 182 10 C168 20 164 26 170 30 C182 26 198 26 214 34 C198 36 190 40 186 46 C198 46 206 50 212 58 C180 52 144 56 116 54Z"/></g><path d="M96 50 C100 40 120 40 124 50 C122 58 116 64 110 76 C104 64 98 58 96 50Z"/><path d="M104 42 C106 34 114 34 116 42Z"/></svg>';
    this.sfx('wings', { gain: 0.7, pan: ltr ? -0.6 : 0.6 }); later(function () { self.sfx('roar', { gain: 0.45, pan: ltr ? 0.5 : -0.5 }); }, 1300, this.bag);
    later(function () { w.remove(); }, 3600, this.bag);
    return 4000;
  };

  /* the ground shakes: the book trembles and dust falls */
  Omens.prototype.quake = function (scene) {
    var L = this.o.layer, r = this.pageRect(), tome = this.o.tome, self = this;
    tome.classList.remove('om-shake'); void tome.offsetWidth; tome.classList.add('om-shake');
    this.sfx('rumble', { gain: 0.8 }); if (scene === 'bell') later(function () { self.sfx('bell', { gain: 0.25, rate: 0.8, wet: 0.5 }); }, 300, this.bag);
    for (var i = 0; i < 26; i++) { var d = el('i', 'om-dust', L); d.style.left = (r.x + Math.random() * r.w) + 'px'; d.style.animationDelay = (Math.random() * 0.9).toFixed(2) + 's'; d.style.setProperty('--fall', (r.y + rand(0.1, 1) * r.h) + 'px'); }
    later(function () { tome.classList.remove('om-shake'); L.querySelectorAll('.om-dust').forEach(function (x) { x.remove(); }); }, 2600, this.bag);
    return 3000;
  };

  /* a gust: flakes blow across the book and the page corner lifts */
  Omens.prototype.wind = function (scene) {
    var L = this.o.layer, r = this.pageRect(), kind = scene === 'dawn' || scene === 'mountain' || scene === 'village' ? 'petal' : 'snow';
    this.sfx('wind', { gain: 0.9 });
    for (var i = 0; i < 34; i++) { var f = el('i', 'om-flake ' + kind, L); f.style.top = rand(0, r.H) + 'px'; f.style.animationDelay = (Math.random() * 1.6).toFixed(2) + 's'; f.style.animationDuration = rand(1.6, 2.8).toFixed(2) + 's'; f.style.setProperty('--dy', rand(-60, 60).toFixed(0) + 'px'); }
    if (this.o.flutter) later(this.o.flutter, 500, this.bag);
    later(function () { L.querySelectorAll('.om-flake').forEach(function (x) { x.remove(); }); }, 4800, this.bag);
    return 5000;
  };

  /* a moth lands on the page for a moment */
  Omens.prototype.moth = function () {
    var L = this.o.layer, r = this.pageRect(), m = el('div', 'om-moth', L), self = this;
    m.innerHTML = '<svg viewBox="0 0 40 30" aria-hidden="true"><g class="mw"><path d="M20 15 C12 2 2 4 4 12 C5 17 12 18 20 16Z"/><path d="M20 15 C28 2 38 4 36 12 C35 17 28 18 20 16Z"/></g><path d="M20 15 C15 20 10 27 14 27 C17 27 19 21 20 17Z M20 15 C25 20 30 27 26 27 C23 27 21 21 20 17Z" opacity=".85"/><rect x="19.2" y="9" width="1.6" height="12" rx=".8" fill="#2A1A10"/></svg>';
    var land = [r.x + rand(0.25, 0.75) * r.w, r.y + rand(0.2, 0.7) * r.h];
    m.style.setProperty('--sx', (Math.random() < .5 ? -40 : r.W + 40) + 'px'); m.style.setProperty('--sy', rand(0, r.y) + 'px');
    m.style.setProperty('--lx', land[0] + 'px'); m.style.setProperty('--ly', land[1] + 'px'); m.style.setProperty('--ex', (Math.random() < .5 ? -60 : r.W + 60) + 'px');
    this.sfx('wings', { gain: 0.25, rate: 1.7 });
    later(function () { self.sfx('wings', { gain: 0.22, rate: 1.8 }); }, 3900, this.bag);
    later(function () { m.remove(); }, 6200, this.bag);
    return 6400;
  };

  /* embers drift up past the page */
  Omens.prototype.embers = function () {
    var L = this.o.layer, r = this.pageRect();
    this.sfx('fire', { gain: 0.6 });
    for (var i = 0; i < 18; i++) { var e = el('i', 'om-ember', L); e.style.left = (r.x + rand(-0.1, 1.1) * r.w) + 'px'; e.style.animationDelay = (Math.random() * 1.8).toFixed(2) + 's'; e.style.setProperty('--dx', rand(-40, 40).toFixed(0) + 'px'); }
    later(function () { L.querySelectorAll('.om-ember').forEach(function (x) { x.remove(); }); }, 5200, this.bag);
    return 5400;
  };

  /* faint glyphs write themselves in the margin, then fade */
  Omens.prototype.quill = function () {
    var r = this.pageRect(), P = this.o.pages, w = r.w * 0.7, g = svg('svg', { 'class': 'om-glyphs', width: w, height: 60, viewBox: '0 0 ' + w + ' 60' }, P);
    g.style.left = (r.w * 0.15) + 'px'; g.style.top = (r.h - 88) + 'px';
    var d = 'M4 36', x = 4;
    while (x < w - 20) { var sw = rand(8, 18); d += ' c' + (sw * .3).toFixed(1) + ' ' + rand(-22, -8).toFixed(1) + ' ' + (sw * .7).toFixed(1) + ' ' + rand(8, 20).toFixed(1) + ' ' + sw.toFixed(1) + ' ' + rand(-6, 6).toFixed(1); x += sw; if (Math.random() < .2) { d += ' m' + rand(6, 12).toFixed(1) + ' 0'; x += 9; } }
    var p = svg('path', { d: d, fill: 'none', stroke: '#6E3A1A', 'stroke-width': '1.4', 'stroke-linecap': 'round', opacity: '.55' }, g);
    var len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; p.style.transition = 'stroke-dashoffset 2.8s ease-in-out';
    requestAnimationFrame(function () { requestAnimationFrame(function () { p.style.strokeDashoffset = 0; }); });
    this.sfx('quill', { gain: 0.8 });
    later(function () { g.style.transition = 'opacity 1.6s ease'; g.style.opacity = '0'; }, 3600, this.bag);
    later(function () { g.remove(); }, 5400, this.bag);
    return 5600;
  };

  /* the words tremble and something whispers */
  Omens.prototype.whisper = function () {
    var lc = this.o.pages.querySelector('#linTop .lc');
    this.sfx('whisper', { gain: 0.7 });
    if (lc) { lc.classList.remove('om-tremble'); void lc.offsetWidth; lc.classList.add('om-tremble'); later(function () { lc.classList.remove('om-tremble'); }, 2400, this.bag); }
    return 3000;
  };

  window.WaywardOmens = { create: function (o) { return new Omens(o); }, scenes: SCENES };
})();
