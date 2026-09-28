/* Wayward FX: veils (mist, sea spray, ash, stardust), wipeable layers and the small interactive scenes.
   Canvas work runs at half resolution: everything here is soft, so the upscale is invisible and cheap on phones. */
(function () {
  'use strict';
  var RES = 0.5;
  var PRESETS = {
    fog:      { cols: [[236, 228, 255], [255, 226, 238], [216, 206, 250]], base: [228, 218, 250], spark: null },
    sea:      { cols: [[214, 248, 246], [176, 228, 238], [240, 252, 255]], base: [196, 234, 240], spark: [230, 255, 255] },
    ash:      { cols: [[128, 116, 120], [168, 148, 144], [100, 90, 100]], base: [120, 106, 112], spark: [255, 150, 70] },
    stardust: { cols: [[104, 78, 196], [156, 116, 236], [64, 44, 146]], base: [72, 52, 152], spark: [255, 246, 214] }
  };
  function P(name) { return PRESETS[name] || PRESETS.fog; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var spriteCache = {};
  function sprite(rgb) {
    var k = rgb.join(',');
    if (spriteCache[k]) return spriteCache[k];
    var s = document.createElement('canvas'); s.width = s.height = 128;
    var g = s.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(' + k + ',1)'); gr.addColorStop(0.45, 'rgba(' + k + ',.55)'); gr.addColorStop(1, 'rgba(' + k + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (var i = 0; i < 26; i++) { // a little texture inside each puff
      var x = rand(24, 104), y = rand(24, 104), r = rand(6, 18), q = g.createRadialGradient(x, y, 0, x, y, r);
      q.addColorStop(0, 'rgba(255,255,255,.18)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    spriteCache[k] = s; return s;
  }
  function makeCanvas(host, cls) {
    var c = document.createElement('canvas'); c.className = cls;
    var W = host.clientWidth, H = host.clientHeight;
    c.width = Math.max(2, Math.round(W * RES)); c.height = Math.max(2, Math.round(H * RES));
    host.appendChild(c);
    var g = c.getContext('2d'); g.scale(RES, RES);
    return { c: c, g: g, W: W, H: H };
  }
  function local(el, e) { var r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  /* ---------- full-screen veil: spreads in, holds, then bursts ("poof") ---------- */
  function veil(host, opts) {
    opts = opts || {};
    var pr = P(opts.preset), cv = makeCanvas(host, 'fx-veil'), c = cv.c, g = cv.g, W = cv.W, H = cv.H;
    var cx = W / 2, cy = H * 0.52, puffs = [], N = 46, i;
    for (i = 0; i < N; i++) {
      var col = i % 4, row = Math.floor(i / 4), tx = (col + rand(0.1, 0.9)) * W / 4, ty = (row + rand(0.1, 0.9)) * H / 11.5;
      var dx = tx - cx, dy = ty - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
      puffs.push({ tx: tx, ty: ty, ux: dx / d, uy: dy / d, r: rand(0.24, 0.42) * H, a: rand(0.55, 0.9), s: sprite(pr.cols[i % 3]), delay: rand(0, 0.3), spin: rand(-1, 1) });
    }
    var sparks = [];
    if (pr.spark) for (i = 0; i < 70; i++) sparks.push({ x: rand(0, W), y: rand(0, H), r: rand(0.8, 2.4), v: rand(0.4, 1.4), p: rand(0, 6.28) });
    var phase = 'in', t0 = performance.now(), IN = reduce ? 200 : 1150, OUT = reduce ? 200 : 950, holdStart = 0, released = false, raf;
    function draw(now) {
      var t, k, base = 0, flash = 0;
      g.clearRect(0, 0, W, H);
      if (phase === 'in') {
        t = clamp((now - t0) / IN, 0, 1); base = 0.92 * clamp((t - 0.45) / 0.55, 0, 1);
        for (k = 0; k < N; k++) {
          var p = puffs[k], tt = ease(clamp((t - p.delay) / (1 - p.delay), 0, 1)), far = (1 - tt) * H * 0.9;
          drawPuff(p, p.tx + p.ux * far, p.ty + p.uy * far, p.r * (0.7 + 0.3 * tt), p.a * tt);
        }
        if (t >= 1) { phase = 'hold'; holdStart = now; if (opts.onCovered) opts.onCovered(function () { released = true; }); else released = true; }
      } else if (phase === 'hold') {
        base = 0.92; var wob = (now - holdStart) / 1000;
        for (k = 0; k < N; k++) { var q = puffs[k]; drawPuff(q, q.tx + Math.sin(wob + k) * 6, q.ty + Math.cos(wob * 0.8 + k) * 5, q.r, q.a); }
        if (released && now - holdStart > 260) { phase = 'out'; t0 = now; if (opts.onBurst) opts.onBurst(); }
      } else {
        t = clamp((now - t0) / OUT, 0, 1); var e = ease(t);
        base = 0.92 * Math.pow(1 - t, 3); flash = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.5);
        for (k = 0; k < N; k++) { var o = puffs[k], fly = e * H * 0.95; drawPuff(o, o.tx + o.ux * fly, o.ty + o.uy * fly, o.r * (1 + 0.7 * e), o.a * Math.pow(1 - t, 1.4)); }
        if (t >= 1) { cancelAnimationFrame(raf); c.remove(); if (opts.onDone) opts.onDone(); return; }
      }
      if (base > 0) { g.globalAlpha = 1; g.fillStyle = 'rgba(' + pr.base.join(',') + ',' + base.toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
      if (sparks.length && phase !== 'in') {
        for (k = 0; k < sparks.length; k++) {
          var s = sparks[k], tw = 0.5 + 0.5 * Math.sin(now / 300 * s.v + s.p), al = (phase === 'out' ? 1 - t : 1) * tw;
          g.globalAlpha = clamp(al, 0, 1); g.fillStyle = 'rgb(' + pr.spark.join(',') + ')';
          var sy = phase === 'out' ? s.y - ease(t) * 80 * s.v : s.y;
          g.beginPath(); g.arc(s.x, sy, s.r, 0, 6.283); g.fill();
        }
      }
      if (flash > 0) {
        var fg = g.createRadialGradient(cx, cy, 0, cx, cy, H * 0.6);
        fg.addColorStop(0, 'rgba(255,248,230,' + (0.55 * flash).toFixed(3) + ')'); fg.addColorStop(1, 'rgba(255,248,230,0)');
        g.globalAlpha = 1; g.fillStyle = fg; g.fillRect(0, 0, W, H);
      }
      g.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    function drawPuff(p, x, y, r, a) { g.globalAlpha = clamp(a, 0, 1); g.drawImage(p.s, x - r, y - r, r * 2, r * 2); }
    raf = requestAnimationFrame(draw);
    return { cancel: function () { cancelAnimationFrame(raf); c.remove(); } };
  }

  /* ---------- wipeable layer (mist on the page, a misted window) ---------- */
  function wipe(host, opts) {
    opts = opts || {};
    var pr = P(opts.preset), cv = makeCanvas(host, 'fx-wipe' + (opts.cls ? ' ' + opts.cls : '')), c = cv.c, g = cv.g, W = cv.W, H = cv.H, i;
    g.fillStyle = 'rgba(' + pr.base.join(',') + ',' + (opts.baseAlpha || 0.8) + ')'; g.fillRect(0, 0, W, H);
    for (i = 0; i < (opts.puffs || 30); i++) {
      var r = rand(0.18, 0.4) * Math.max(W, H); g.globalAlpha = rand(0.5, 0.95);
      g.drawImage(sprite(pr.cols[i % 3]), rand(-0.1, 1.1) * W - r, rand(-0.1, 1.1) * H - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    var R = opts.brush || 38, last = null, done = false, strokes = 0, lastCheck = 0, lastSound = 0;
    // how much glass is clear is tracked on a coarse grid as you wipe, instead of reading pixels back from the
    // GPU (a readback stalls a phone for a frame or two, several times a second)
    var CELL = 12, GX = Math.ceil(W / CELL), GY = Math.ceil(H / CELL), grid = new Uint8Array(GX * GY), nClear = 0;
    function mark(x, y) {
      var rr = R * 0.62, x0 = Math.max(0, Math.floor((x - rr) / CELL)), x1 = Math.min(GX - 1, Math.floor((x + rr) / CELL)), y0 = Math.max(0, Math.floor((y - rr) / CELL)), y1 = Math.min(GY - 1, Math.floor((y + rr) / CELL));
      for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) {
        var cx = (gx + .5) * CELL - x, cy = (gy + .5) * CELL - y, k = gy * GX + gx;
        if (!grid[k] && cx * cx + cy * cy <= rr * rr) { grid[k] = 1; nClear++; }
      }
    }
    function dab(x, y) {
      mark(x, y);
      g.globalCompositeOperation = 'destination-out';
      var gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
      g.globalCompositeOperation = 'source-over';
    }
    function cleared() { return nClear / grid.length; }
    function move(e) {
      if (done || !last) return;
      var p = local(c, e), dx = p.x - last.x, dy = p.y - last.y, dist = Math.sqrt(dx * dx + dy * dy), steps = Math.max(1, Math.ceil(dist / (R / 3)));
      for (var s = 1; s <= steps; s++) dab(last.x + dx * s / steps, last.y + dy * s / steps);
      last = p; strokes++;
      var now = performance.now();
      if (opts.onStroke && now - lastSound > 650) { lastSound = now; opts.onStroke(); }
      if (now - lastCheck > 140) { lastCheck = now; var r = cleared(); if (opts.onProgress) opts.onProgress(r); if (r >= (opts.threshold || 0.5)) finish(); }
      e.preventDefault();
    }
    function down(e) { if (done) return; last = local(c, e); dab(last.x, last.y); try { c.setPointerCapture(e.pointerId); } catch (x) {} if (opts.onStart) opts.onStart(); e.preventDefault(); }
    function up() { last = null; }
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    function finish() {
      if (done) return; done = true;
      c.style.transition = 'opacity .7s ease'; c.style.opacity = '0'; c.style.pointerEvents = 'none';
      setTimeout(function () { c.remove(); if (opts.onDone) opts.onDone(); }, 720);
    }
    function auto() { // the glass clears by itself, stroke by stroke
      var k = 0, iv = setInterval(function () {
        if (done) { clearInterval(iv); return; }
        var y = ((k * 3) % 9 + 0.5) / 9 * H, x0 = k % 2 ? W + 20 : -20, x1 = k % 2 ? -20 : W + 20;
        for (var s = 0; s <= 24; s++) dab(x0 + (x1 - x0) * s / 24, y + Math.sin(s / 3) * 14);
        if (opts.onStroke) opts.onStroke();
        if (++k > 9) { clearInterval(iv); finish(); }
      }, 420);
    }
    return { finish: finish, auto: auto, destroy: function () { done = true; c.remove(); }, el: c, progress: cleared };
  }

  /* ---------- lantern in the dark: the light follows your finger ---------- */
  function lantern(host, opts) {
    var cv = makeCanvas(host, 'fx-dark'), c = cv.c, g = cv.g, W = cv.W, H = cv.H;
    var px = W * 0.5, py = opts.y > H * 0.5 ? H * 0.2 : H * 0.72, R = Math.min(W, H) * 0.26, found = false, hold = 0, fade = 1, raf, prev = performance.now(), t0 = prev, hinted = false, touched = false, guided = false;
    function draw(now) {
      var dt = now - prev; prev = now;
      if (guided && !found) { px += (opts.x - px) * Math.min(1, dt / 900); py += (opts.y - py) * Math.min(1, dt / 900); touched = true; }
      if (!found) {
        var dx = px - opts.x, dy = py - opts.y, fx2 = px - opts.x, fy2 = py + 24 - opts.y;
        if (touched && Math.min(Math.sqrt(dx * dx + dy * dy), Math.sqrt(fx2 * fx2 + fy2 * fy2)) < R * 0.62) { hold += dt; if (hold > 650) { found = true; if (opts.onFound) opts.onFound(); } } else hold = Math.max(0, hold - dt * 0.5);
      } else fade = Math.max(0, fade - dt / 1100);
      var fl = 1 + Math.sin(now / 90) * 0.02 + Math.sin(now / 37) * 0.015, rr = R * fl * (found ? 1 + (1 - fade) * 4 : 1);
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(4,3,14,' + (0.95 * fade).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-out';
      var gr = g.createRadialGradient(px, py, 0, px, py, rr * 1.35); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.42, 'rgba(0,0,0,.92)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(px - rr * 1.4, py - rr * 1.4, rr * 2.8, rr * 2.8);
      g.globalCompositeOperation = 'source-over';
      var warm = g.createRadialGradient(px, py, 0, px, py, rr); warm.addColorStop(0, 'rgba(255,190,110,' + (0.16 * fade).toFixed(3) + ')'); warm.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = warm; g.fillRect(px - rr, py - rr, rr * 2, rr * 2);
      if (!found && now - t0 > 7000) { // after a while, a faint glint shows where to look
        hinted = true; var a = 0.35 + 0.35 * Math.sin(now / 260);
        g.fillStyle = 'rgba(255,230,170,' + a.toFixed(3) + ')'; g.beginPath(); g.arc(opts.x, opts.y, 3.2, 0, 6.283); g.fill();
      }
      if (found && hold > 0) { hold = 0; if (opts.onGlow) opts.onGlow(); }
      if (found && fade <= 0) { cancelAnimationFrame(raf); c.remove(); if (opts.onDone) opts.onDone(); return; }
      raf = requestAnimationFrame(draw);
    }
    function mv(e) { var p = local(c, e); px = p.x; py = p.y - 24; touched = true; e.preventDefault(); } // light sits just above the fingertip
    c.addEventListener('pointerdown', mv); c.addEventListener('pointermove', mv);
    raf = requestAnimationFrame(draw);
    return { destroy: function () { cancelAnimationFrame(raf); c.remove(); }, hinted: function () { return hinted; }, guide: function () { guided = true; } };
  }

  /* ---------- trace a path of golden ink ---------- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) { var el = document.createElementNS(SVGNS, tag); for (var k in attrs) el.setAttribute(k, attrs[k]); if (parent) parent.appendChild(el); return el; }
  function smooth(pts) { // Catmull-Rom through the points
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6) + ' ' + p2[0] + ' ' + p2[1];
    }
    return d;
  }
  function trace(host, opts) {
    var W = host.clientWidth, H = host.clientHeight;
    var svg = svgEl('svg', { 'class': 'fx-svg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H }); host.appendChild(svg);
    var defs = svgEl('defs', {}, svg), f = svgEl('filter', { id: 'fxGlow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    svgEl('feGaussianBlur', { stdDeviation: '4', result: 'b' }, f); var mg = svgEl('feMerge', {}, f); svgEl('feMergeNode', { 'in': 'b' }, mg); svgEl('feMergeNode', { 'in': 'SourceGraphic' }, mg);
    var d = smooth(opts.pts);
    var guide = svgEl('path', { d: d, fill: 'none', stroke: 'rgba(255,230,170,.55)', 'stroke-width': 3, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round', 'class': 'fx-guide' }, svg);
    var ink = svgEl('path', { d: d, fill: 'none', stroke: '#FFD98A', 'stroke-width': 4.5, 'stroke-linecap': 'round', filter: 'url(#fxGlow)' }, svg);
    var L = ink.getTotalLength(), N = 90, samples = [], i;
    for (i = 0; i <= N; i++) { var q = ink.getPointAtLength(L * i / N); samples.push([q.x, q.y]); }
    ink.setAttribute('stroke-dasharray', L); ink.setAttribute('stroke-dashoffset', L);
    var start = svgEl('circle', { cx: opts.pts[0][0], cy: opts.pts[0][1], r: 16, fill: 'rgba(255,217,138,.25)', stroke: '#FFD98A', 'stroke-width': 2, 'class': 'fx-pulse' }, svg);
    var tip = svgEl('circle', { cx: opts.pts[0][0], cy: opts.pts[0][1], r: 5, fill: '#FFF3D0', filter: 'url(#fxGlow)' }, svg);
    var prog = 0, active = false, done = false;
    function nearest(p, from, to) {
      var best = -1, bd = 1e9;
      for (var k = from; k <= Math.min(N, to); k++) { var dx = samples[k][0] - p.x, dy = samples[k][1] - p.y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = k; } }
      return bd < 52 * 52 ? best : -1;
    }
    function set(k) {
      prog = Math.max(prog, k); ink.setAttribute('stroke-dashoffset', (L * (1 - prog / N)).toFixed(1));
      tip.setAttribute('cx', samples[prog][0]); tip.setAttribute('cy', samples[prog][1]);
      if (opts.onProgress) opts.onProgress(prog / N);
      if (prog >= N * 0.94 && !done) { done = true; set(N); start.remove(); guide.remove(); svg.classList.add('fx-flare'); setTimeout(function () { if (opts.onDone) opts.onDone(); }, 700); }
    }
    svg.addEventListener('pointerdown', function (e) { if (done) return; var p = local(svg, e), k = nearest(p, 0, prog + 10); if (k > -1) { active = true; set(k); if (opts.onStart) opts.onStart(); try { svg.setPointerCapture(e.pointerId); } catch (x) {} } e.preventDefault(); });
    svg.addEventListener('pointermove', function (e) { if (!active || done) return; var k = nearest(local(svg, e), prog, prog + 14); if (k > -1) set(k); e.preventDefault(); });
    svg.addEventListener('pointerup', function () { active = false; });
    function auto() { var iv = setInterval(function () { if (done) { clearInterval(iv); return; } set(Math.min(N, prog + 2)); }, 40); }
    return { destroy: function () { svg.remove(); }, auto: auto };
  }

  /* ---------- a rope to pull ---------- */
  function rope(host, opts) {
    var W = host.clientWidth, H = host.clientHeight;
    var svg = svgEl('svg', { 'class': 'fx-svg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H }); host.appendChild(svg);
    var ax = opts.x, ay = opts.y, len = opts.len || 70, pull = 0, vel = 0, drag = false, sy = 0, done = false, raf;
    var line = svgEl('path', { fill: 'none', stroke: '#B3262E', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
    var hi = svgEl('path', { fill: 'none', stroke: '#F0766A', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: '.8' }, svg);
    var ring = svgEl('circle', { r: 22, fill: 'none', stroke: '#FFD98A', 'stroke-width': 2, 'class': 'fx-pulse' }, svg);
    var tassel = svgEl('path', { fill: '#B3262E', stroke: '#FFD98A', 'stroke-width': 1.2 }, svg);
    function render() {
      var ex = ax, ey = ay + len + pull, sw = Math.sin(performance.now() / 700) * (drag ? 0 : 3);
      var d = 'M' + ax + ' ' + ay + ' Q' + (ax + sw) + ' ' + ((ay + ey) / 2) + ' ' + (ex + sw * 1.5) + ' ' + ey;
      line.setAttribute('d', d); hi.setAttribute('d', d);
      tassel.setAttribute('d', 'M' + (ex + sw * 1.5) + ' ' + ey + ' l-7 20 q7 6 14 0 z');
      ring.setAttribute('cx', ex + sw * 1.5); ring.setAttribute('cy', ey + 12);
    }
    function loop() { if (!drag) { vel += -pull * 0.18; vel *= 0.72; pull += vel; if (Math.abs(pull) < 0.2 && Math.abs(vel) < 0.2) pull = 0; } render(); raf = requestAnimationFrame(loop); }
    svg.addEventListener('pointerdown', function (e) {
      var p = local(svg, e), ex = ax, ey = ay + len + pull + 12;
      if (Math.abs(p.x - ex) < 60 && Math.abs(p.y - ey) < 70) { drag = true; sy = p.y - pull; if (opts.onGrab) opts.onGrab(); try { svg.setPointerCapture(e.pointerId); } catch (x) {} }
      e.preventDefault();
    });
    svg.addEventListener('pointermove', function (e) { if (!drag) return; pull = clamp(local(svg, e).y - sy, 0, 150); e.preventDefault(); });
    function release() {
      if (!drag) return; drag = false;
      if (pull > 50 && !done) { done = true; ring.remove(); if (opts.onPull) opts.onPull(); }
    }
    svg.addEventListener('pointerup', release); svg.addEventListener('pointercancel', release);
    loop();
    function auto() { if (done) return; drag = true; var t0 = performance.now(); (function pullAnim(now) { var k = Math.min(1, (now - t0) / 700); pull = 90 * Math.sin(k * Math.PI / 2); if (k < 1) requestAnimationFrame(pullAnim); else release(); })(t0); }
    return { destroy: function () { cancelAnimationFrame(raf); svg.remove(); }, auto: auto };
  }

  /* ---------- a glowing thing to find and tap ---------- */
  function tapTarget(host, opts) {
    var el = document.createElement('div'); el.className = 'fx-target' + (opts.hidden ? ' faint' : '');
    el.style.left = opts.x + 'px'; el.style.top = opts.y + 'px'; host.appendChild(el);
    var done = false, holdT = null;
    if (opts.hold) el.innerHTML = '<svg viewBox="0 0 64 64" class="fx-holdring"><circle cx="32" cy="32" r="29" pathLength="100"/></svg>';
    function fire() { if (done) return; done = true; el.classList.remove('holding'); el.classList.add('hit'); sparkle(host, opts.x, opts.y, { n: 26 }); if (opts.onTap) opts.onTap(); setTimeout(function () { el.remove(); }, 900); }
    function inside(e) { var p = local(host, e), dx = p.x - opts.x, dy = p.y - opts.y; return dx * dx + dy * dy < (opts.r || 58) * (opts.r || 58); }
    function down(e) {
      if (done || !inside(e)) return;
      if (!opts.hold) { fire(); return; }
      el.classList.add('holding'); if (opts.onHold) opts.onHold(); holdT = setTimeout(fire, opts.hold);
    }
    function up() { if (holdT && !done) { clearTimeout(holdT); holdT = null; el.classList.remove('holding'); } }
    host.addEventListener('pointerdown', down); host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
    return { destroy: function () { host.removeEventListener('pointerdown', down); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up); clearTimeout(holdT); el.remove(); },
      hint: function () { el.classList.remove('faint'); el.classList.add('hint'); }, auto: fire };
  }

  /* ---------- small things ---------- */
  function sparkle(host, x, y, o) {
    o = o || {}; var n = o.n || 14, box = document.createElement('div'); box.className = 'fx-sparkle'; box.style.left = x + 'px'; box.style.top = y + 'px';
    for (var i = 0; i < n; i++) {
      var s = document.createElement('i'), a = Math.random() * 6.283, d = rand(24, o.spread || 70);
      s.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px'); s.style.setProperty('--dy', (Math.sin(a) * d - 16).toFixed(1) + 'px');
      s.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's'; s.style.width = s.style.height = rand(2.5, 5).toFixed(1) + 'px';
      box.appendChild(s);
    }
    host.appendChild(box); setTimeout(function () { box.remove(); }, 1300);
  }
  function ripple(host, x, y, n) {
    for (var i = 0; i < (n || 3); i++) {
      var r = document.createElement('div'); r.className = 'fx-ripple'; r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.animationDelay = (i * 0.28) + 's';
      host.appendChild(r); (function (el) { setTimeout(function () { el.remove(); }, 2600); })(r);
    }
  }

  /* ---------- fog creeping in from the edges (timed moments) ---------- */
  function creep(host, opts) {
    var pr = P((opts || {}).preset), cv = makeCanvas(host, 'fx-creep'), c = cv.c, g = cv.g, W = cv.W, H = cv.H, puffs = [], i, raf, level = 0;
    for (i = 0; i < 34; i++) {
      var side = i % 4, t = Math.random(), x = side === 0 ? t * W : side === 1 ? W : side === 2 ? t * W : 0, y = side === 0 ? 0 : side === 1 ? t * H : side === 2 ? H : t * H;
      puffs.push({ x: x, y: y, ux: W / 2 - x, uy: H * 0.45 - y, r: rand(0.18, 0.34) * H, s: sprite(pr.cols[i % 3]), p: rand(0, 6.28) });
    }
    function draw(now) {
      g.clearRect(0, 0, W, H);
      for (var k = 0; k < puffs.length; k++) {
        var q = puffs[k], m = 0.08 + level * 0.46 + Math.sin(now / 1400 + q.p) * 0.02;
        g.globalAlpha = clamp(0.2 + level * 0.55, 0, 0.75); g.drawImage(q.s, q.x + q.ux * m - q.r, q.y + q.uy * m - q.r, q.r * 2, q.r * 2);
      }
      g.globalAlpha = 1; raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return { set: function (v) { level = clamp(v, 0, 1); }, destroy: function () { cancelAnimationFrame(raf); c.remove(); } };
  }

  window.WaywardFX = { veil: veil, wipe: wipe, lantern: lantern, trace: trace, rope: rope, tapTarget: tapTarget, sparkle: sparkle, ripple: ripple, creep: creep, presets: PRESETS };
})();
