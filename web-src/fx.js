/* Wayward FX: veils (mist, sea spray, ash, stardust), wipeable layers and the small interactive scenes.
   Canvas work runs at half resolution: everything here is soft, so the upscale is invisible and cheap on phones. */
(function () {
  'use strict';
  var RES = 0.5;
  var PRESETS = {
    fog:      { cols: [[236, 228, 255], [255, 226, 238], [216, 206, 250]], base: [228, 218, 250], spark: null },
    sea:      { cols: [[214, 248, 246], [176, 228, 238], [240, 252, 255]], base: [196, 234, 240], spark: [230, 255, 255] },
    frost:    { cols: [[228, 234, 242], [204, 212, 224], [246, 249, 252]], base: [216, 224, 234], spark: [255, 255, 255] }, // coal smoke and rime (Book III)
    ash:      { cols: [[206, 198, 194], [168, 158, 156], [232, 226, 220]], base: [188, 180, 176], spark: [255, 160, 80] }, // hot steam and grey ash (Book IV)
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

  /* styles for the hints and rewards added in v4.5 (index.html is left as it is; the ids/extra classes make these
     win over its rules, whichever order the two style blocks end up in) */
  (function () {
    var css = [
      '.fx-ghost{position:absolute;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;opacity:0;z-index:30;background:radial-gradient(circle,rgba(255,250,232,.95) 0 20%,rgba(255,228,168,.5) 34%,rgba(255,214,140,0) 70%);box-shadow:0 0 0 2px rgba(246,210,124,.5);will-change:transform,opacity}',
      '#ilHost>.fx-ghost{inset:auto;left:0;top:0;width:46px;height:46px}',
      '.fx-glow{position:absolute;border-radius:50%;pointer-events:none;opacity:0;background:radial-gradient(closest-side,rgba(255,242,206,.9),rgba(255,204,128,.5) 38%,rgba(255,180,96,.16) 68%,rgba(255,170,80,0));will-change:transform,opacity}',
      '#ilHost.on.il-short{pointer-events:none}',
      '#ilHost.il-out>*{opacity:0;transition:opacity .6s ease}',
      '.fx-target .fx-holdring circle{filter:none;stroke-width:5}',
      '.fx-svg.fx-flare path{animation:none}',
      '.fx-svg .fx-inkglow{opacity:.45}',
      '.fx-svg.fx-flare .fx-inkglow{animation:fxinkflare 1.1s ease-out}',
      '@keyframes fxinkflare{30%{opacity:1}}',
      '.fx-lbox,.fx-ropebox{position:absolute;inset:0;overflow:hidden;touch-action:none}',
      '.fx-lamp{position:absolute;left:0;top:0;pointer-events:none;will-change:transform}',
      '.fx-lamp i{position:absolute;inset:0;border-radius:50%;background:radial-gradient(closest-side,rgba(255,196,118,.22),rgba(255,190,110,.08) 60%,rgba(255,190,110,0));animation:fxflick 1.7s ease-in-out infinite}',
      '@keyframes fxflick{30%{opacity:.8;transform:scale(.97)}65%{opacity:1;transform:scale(1.03)}}',
      '.fx-glint{position:absolute;left:0;top:0;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,#FFF3D0 0 22%,rgba(255,230,170,.6) 44%,rgba(255,230,170,0) 72%);opacity:0;transition:opacity .4s ease}',
      '.fx-glint.on{animation:fxglint 1.1s ease-in-out infinite}',
      '@keyframes fxglint{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.7)}}',
      '.fx-sway{position:absolute;transform-origin:50% 0;animation:fxsway 2.8s ease-in-out infinite;will-change:transform}',
      '.fx-sway.held{animation:none}',
      '@keyframes fxsway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}',
      '.fx-sway svg{position:absolute;left:0;top:0;overflow:visible}'
    ].join('\n');
    var s = document.createElement('style'); s.id = 'fx-css'; s.textContent = css; (document.head || document.documentElement).appendChild(s);
  })();

  /* a ghost fingertip that shows a gesture: frames are [x, y, opacity, scale] in host px */
  function ghost(host, frames, dur) {
    var g = document.createElement('div'); g.className = 'fx-ghost'; host.appendChild(g);
    var a = g.animate(frames.map(function (f) { return { transform: 'translate(' + f[0].toFixed(1) + 'px,' + f[1].toFixed(1) + 'px) scale(' + (f[3] || 1) + ')', opacity: f[2] }; }), { duration: dur || 1600, iterations: Infinity, easing: 'ease-in-out' });
    return { el: g, remove: function () { try { a.cancel(); } catch (x) {} g.remove(); } };
  }
  /* a warm light that blooms and stays (opacity and transform only) */
  function glow(host, x, y, o) {
    o = o || {}; var r = o.r || 120, d = document.createElement('div'); d.className = 'fx-glow';
    d.style.cssText = 'left:' + (x - r).toFixed(1) + 'px;top:' + (y - r).toFixed(1) + 'px;width:' + (r * 2).toFixed(1) + 'px;height:' + (r * 2).toFixed(1) + 'px';
    host.appendChild(d);
    d.animate([{ opacity: 0, transform: 'scale(.35)' }, { opacity: o.peak || 1, transform: 'scale(1.06)', offset: 0.35 }, { opacity: o.rest != null ? o.rest : 0.7, transform: 'scale(1)' }], { duration: o.dur || 1600, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    return d;
  }

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
    var autoIv = 0;
    function auto(fast) { // the glass clears by itself, stroke by stroke (fast: three sweeps, then it fades)
      if (done || autoIv) return; unhint();
      var k = 0, n = fast ? 3 : 9;
      autoIv = setInterval(function () {
        if (done) { clearInterval(autoIv); return; }
        var y = fast ? H * (0.22 + k * 0.16) : ((k * 3) % 9 + 0.5) / 9 * H, x0 = k % 2 ? W + 20 : -20, x1 = k % 2 ? -20 : W + 20;
        for (var s = 0; s <= 24; s++) dab(x0 + (x1 - x0) * s / 24, y + Math.sin(s / 3) * 14);
        if (opts.onStroke) opts.onStroke();
        if (++k >= n) { clearInterval(autoIv); finish(); }
      }, fast ? 150 : 420);
    }
    var gh = null;
    function hint() { // a fingertip wiping across the glass
      if (done) return false; unhint();
      var y = H * 0.36, a = W * 0.2, b = W * 0.8;
      gh = ghost(host, [[a, y, 0], [a, y, 0.95], [b, y - 12, 0.95], [a, y + 10, 0.95], [b, y, 0.95], [b, y, 0]], 2300);
      return true;
    }
    function unhint() { if (gh) { gh.remove(); gh = null; } }
    c.addEventListener('pointerdown', unhint);
    return { finish: finish, auto: auto, hint: hint, unhint: unhint, destroy: function () { done = true; clearInterval(autoIv); unhint(); c.remove(); }, el: c, progress: cleared };
  }

  /* ---------- lantern in the dark: the light follows your finger ---------- */
  /* The darkness is a half-resolution canvas that is only redrawn while something changes (the light moves, is
     held over the find, or opens up); the flicker of the flame is a CSS animation on a small glow, so an idle
     scene costs nothing per frame. */
  function lantern(host, opts) {
    var box = document.createElement('div'); box.className = 'fx-lbox'; host.appendChild(box);
    var cv = makeCanvas(box, 'fx-dark'), c = cv.c, g = cv.g, W = cv.W || host.clientWidth, H = cv.H || host.clientHeight;
    var R = Math.min(W, H) * 0.29, fast = !!opts.fast;
    var px = W * 0.5, py = opts.y > H * 0.5 ? H * 0.2 : H * 0.72;
    if (fast) { px = opts.x + R * 0.5; py = opts.y - R * 0.9; } // the short version: the light is already close
    var found = false, hold = 0, fade = 1, raf = 0, prev = 0, lastMove = 0, touched = fast, guided = fast, dead = false, told = false;
    var HOLD = fast ? 380 : (opts.hold || 900), FADE = fast ? 900 : 900, TAU = fast ? 300 : 900;
    var lamp = document.createElement('div'); lamp.className = 'fx-lamp'; lamp.innerHTML = '<i></i>'; box.appendChild(lamp);
    lamp.style.width = lamp.style.height = (R * 2).toFixed(0) + 'px';
    var glint = document.createElement('div'); glint.className = 'fx-glint'; glint.style.left = opts.x + 'px'; glint.style.top = opts.y + 'px'; box.appendChild(glint);
    function paint() {
      var rr = R * (found ? 1 + (1 - fade) * 4 : 1);
      g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgba(4,3,14,' + (0.95 * fade).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-out';
      var gr = g.createRadialGradient(px, py, 0, px, py, rr * 1.35); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.42, 'rgba(0,0,0,.92)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(px - rr * 1.4, py - rr * 1.4, rr * 2.8, rr * 2.8);
      g.globalCompositeOperation = 'source-over';
      lamp.style.transform = 'translate(' + (px - R).toFixed(1) + 'px,' + (py - R).toFixed(1) + 'px)';
      lamp.style.opacity = fade.toFixed(3);
    }
    function wake() { if (!raf && !dead) { prev = performance.now(); raf = requestAnimationFrame(draw); } }
    function draw(now) {
      raf = 0; if (dead) return;
      var dt = clamp(now - prev, 0, 50); prev = now; // (a frame can start before the call that woke the loop)
      if (guided && !found) { var k = Math.min(1, dt / TAU); px += (opts.x - px) * k; py += (opts.y - py) * k; touched = true; }
      var near = false;
      if (!found) {
        var dx = px - opts.x, dy = py - opts.y, fy2 = py + 24 - opts.y;
        near = touched && Math.min(Math.sqrt(dx * dx + dy * dy), Math.sqrt(dx * dx + fy2 * fy2)) < R * 0.62;
        if (near) { hold += dt; if (hold > HOLD) { found = true; unhint(); if (opts.onFound) opts.onFound(); } } else hold = Math.max(0, hold - dt * 0.5);
      } else fade = Math.max(0, fade - dt / FADE);
      paint();
      if (found && fade <= 0.4 && !told) { told = true; if (opts.onDone) opts.onDone(); } // the closing line comes while the dark is still lifting
      if (found && fade <= 0) { dead = true; box.remove(); return; }
      if (found || guided || near || hold > 0 || now - lastMove < 150) raf = requestAnimationFrame(draw);
    }
    function mv(e) { var p = local(c, e); px = p.x; py = p.y - 24; touched = true; lastMove = performance.now(); wake(); e.preventDefault(); } // the light sits just above the fingertip
    c.addEventListener('pointerdown', function (e) { unhint(); mv(e); }); c.addEventListener('pointermove', mv);
    paint(); if (fast) wake();
    var gh = null;
    function hint() { // a glint where to look, and a fingertip carrying the light towards it
      if (found || dead) return false; unhint();
      glint.classList.add('on');
      gh = ghost(host, [[px, py + 24, 0], [px, py + 24, 0.9], [opts.x, opts.y + 24, 0.9], [opts.x, opts.y + 24, 0]], 2400);
      return true;
    }
    function unhint() { glint.classList.remove('on'); if (gh) { gh.remove(); gh = null; } }
    return { destroy: function () { dead = true; if (raf) cancelAnimationFrame(raf); raf = 0; unhint(); box.remove(); }, hint: hint, unhint: unhint,
      guide: function () { unhint(); guided = true; wake(); }, auto: function () { unhint(); guided = true; wake(); } };
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
  /* The ink flows out of the quill at its own pace (opts.inkSecs for the whole line), a little behind the finger,
     so the bridge is drawn rather than flicked. No SVG filters: the glow is a wide translucent stroke underneath.
     When the line is complete the planks set, one after another. */
  function trace(host, opts) {
    var W = host.clientWidth, H = host.clientHeight;
    var svg = svgEl('svg', { 'class': 'fx-svg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H }); host.appendChild(svg);
    var d = smooth(opts.pts);
    var guide = svgEl('path', { d: d, fill: 'none', stroke: 'rgba(255,230,170,.55)', 'stroke-width': 3, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round', 'class': 'fx-guide' }, svg);
    var planks = svgEl('g', {}, svg);
    var glowP = svgEl('path', { d: d, fill: 'none', stroke: 'rgba(255,206,128,.55)', 'stroke-width': 13, 'stroke-linecap': 'round', 'class': 'fx-inkglow' }, svg);
    var ink = svgEl('path', { d: d, fill: 'none', stroke: '#FFD98A', 'stroke-width': 4.5, 'stroke-linecap': 'round' }, svg);
    var core = svgEl('path', { d: d, fill: 'none', stroke: '#FFF6DC', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, svg);
    var L = ink.getTotalLength(), N = 90, samples = [], i;
    for (i = 0; i <= N; i++) { var q = ink.getPointAtLength(L * i / N); samples.push([q.x, q.y]); }
    [glowP, ink, core].forEach(function (pth) { pth.setAttribute('stroke-dasharray', L); pth.setAttribute('stroke-dashoffset', L); });
    var start = svgEl('circle', { cx: opts.pts[0][0], cy: opts.pts[0][1], r: 16, fill: 'rgba(255,217,138,.25)', stroke: '#FFD98A', 'stroke-width': 2, 'class': 'fx-pulse' }, svg);
    var halo = svgEl('circle', { cx: opts.pts[0][0], cy: opts.pts[0][1], r: 11, fill: 'rgba(255,222,150,.35)' }, svg);
    var tip = svgEl('circle', { cx: opts.pts[0][0], cy: opts.pts[0][1], r: 4.5, fill: '#FFF3D0' }, svg);
    var prog = 0, want = 0, active = false, done = false, dead = false, raf = 0, prev = 0, rate = N / (opts.inkSecs || 2.6), fastRate = 0;
    function nearest(p, from, to) {
      var best = -1, bd = 1e9;
      for (var k = Math.max(0, from); k <= Math.min(N, to); k++) { var dx = samples[k][0] - p.x, dy = samples[k][1] - p.y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = k; } }
      return bd < 52 * 52 ? best : -1;
    }
    function render() {
      var off = (L * (1 - prog / N)).toFixed(1); glowP.setAttribute('stroke-dashoffset', off); ink.setAttribute('stroke-dashoffset', off); core.setAttribute('stroke-dashoffset', off);
      var k = Math.min(N, Math.floor(prog)), f = prog - k, a = samples[k], b = samples[Math.min(N, k + 1)], x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
      tip.setAttribute('cx', x.toFixed(1)); tip.setAttribute('cy', y.toFixed(1)); halo.setAttribute('cx', x.toFixed(1)); halo.setAttribute('cy', y.toFixed(1));
    }
    function step(now) {
      raf = 0; if (dead) return;
      var dt = clamp(now - prev, 0, 50); prev = now; // (a frame can start before the call that woke the loop)
      prog = Math.min(want, prog + (fastRate || rate) * dt / 1000); render();
      if (opts.onProgress) opts.onProgress(prog / N);
      if (prog >= N * 0.97 && !done) { complete(); return; }
      if (prog < want) raf = requestAnimationFrame(step);
    }
    function flow() { if (!raf && !dead) { prev = performance.now(); raf = requestAnimationFrame(step); } }
    function set(k) { if (k > want) { want = k; flow(); } }
    function complete() {
      done = true; prog = N; want = N; render(); start.remove(); guide.remove(); unhint(); svg.classList.add('fx-flare');
      // the planks set, one after another along the line
      var n = 11, dly = fastRate ? 45 : 90;
      for (var j = 1; j < n; j++) {
        var s = Math.round(N * j / n), a = samples[s - 1], b = samples[s + 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2, c = Math.cos(ang) * 8, sn = Math.sin(ang) * 8, m = samples[s];
        var pl = svgEl('path', { d: 'M' + (m[0] - c).toFixed(1) + ' ' + (m[1] - sn).toFixed(1) + 'L' + (m[0] + c).toFixed(1) + ' ' + (m[1] + sn).toFixed(1), stroke: '#FFE7B0', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0 }, planks);
        pl.animate([{ opacity: 0 }, { opacity: 0.9 }], { duration: 260, delay: j * dly, fill: 'forwards' });
      }
      setTimeout(function () { if (!dead && opts.onDone) opts.onDone(); }, (fastRate ? 500 : 1100));
    }
    svg.addEventListener('pointerdown', function (e) { if (done) return; unhint(); var p = local(svg, e), k = nearest(p, 0, Math.ceil(want) + 10); if (k > -1) { active = true; set(k); if (opts.onStart) opts.onStart(); try { svg.setPointerCapture(e.pointerId); } catch (x) {} } e.preventDefault(); });
    svg.addEventListener('pointermove', function (e) { if (!active || done) return; var k = nearest(local(svg, e), Math.floor(want), Math.ceil(want) + 14); if (k > -1) set(k); e.preventDefault(); });
    svg.addEventListener('pointerup', function () { active = false; });
    function auto(fast) { if (done) return; unhint(); fastRate = fast ? N / 0.9 : N / 2.4; if (opts.onStart) opts.onStart(); set(N); }
    var gh = null;
    function hint() { // a fingertip drawing the first part of the line, over and over
      if (done) return false; unhint();
      var a = samples[Math.floor(want)], b = samples[Math.min(N, Math.floor(want) + 30)], c = samples[Math.min(N, Math.floor(want) + 60)];
      gh = ghost(host, [[a[0], a[1], 0], [a[0], a[1], 0.95, 0.9], [b[0], b[1], 0.95, 0.9], [c[0], c[1], 0.95, 0.9], [c[0], c[1], 0]], 2000);
      return true;
    }
    function unhint() { if (gh) { gh.remove(); gh = null; } }
    return { destroy: function () { dead = true; if (raf) cancelAnimationFrame(raf); unhint(); svg.remove(); }, auto: auto, hint: hint, unhint: unhint };
  }

  /* ---------- a rope to pull ---------- */
  /* The rope sways by a CSS rotation of its own small box; the frame loop only runs while it is pulled or springs
     back. opts.pulls: how many pulls it takes (a heavy bell swings on the first and rings on the last). */
  function rope(host, opts) {
    var box = document.createElement('div'); box.className = 'fx-ropebox'; host.appendChild(box);
    var ax = opts.x, ay = opts.y, len = opts.len || 70, need = opts.pulls || 1, count = 0, pull = 0, vel = 0, drag = false, sy = 0, done = false, dead = false, raf = 0, prev = 0;
    var BW = 140, BH = Math.round(len + 200), OX = BW / 2;
    var sway = document.createElement('div'); sway.className = 'fx-sway'; box.appendChild(sway);
    sway.style.cssText = 'left:' + (ax - OX).toFixed(1) + 'px;top:' + ay.toFixed(1) + 'px;width:' + BW + 'px;height:' + BH + 'px';
    var svg = svgEl('svg', { width: BW, height: BH, viewBox: '0 0 ' + BW + ' ' + BH }); sway.appendChild(svg);
    var line = svgEl('path', { fill: 'none', stroke: '#B3262E', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
    var hi = svgEl('path', { fill: 'none', stroke: '#F0766A', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: '.8' }, svg);
    var ring = svgEl('circle', { r: 22, fill: 'none', stroke: '#FFD98A', 'stroke-width': 2, 'class': 'fx-pulse' }, svg);
    var tassel = svgEl('path', { fill: '#B3262E', stroke: '#FFD98A', 'stroke-width': 1.2, 'class': 'fx-tassel' }, svg);
    function render() {
      var ey = len + pull, d = 'M' + OX + ' 0 L' + OX + ' ' + ey.toFixed(1);
      line.setAttribute('d', d); hi.setAttribute('d', d);
      tassel.setAttribute('d', 'M' + OX + ' ' + ey.toFixed(1) + ' l-7 20 q7 6 14 0 z');
      ring.setAttribute('cx', OX); ring.setAttribute('cy', (ey + 12).toFixed(1));
    }
    function tick(now) {
      raf = 0; if (dead) return;
      var dt = clamp(now - prev, 0, 50) / 16.7; prev = now;
      if (!drag) { vel += -pull * 0.18 * dt; vel *= Math.pow(0.72, dt); pull += vel * dt; if (Math.abs(pull) < 0.2 && Math.abs(vel) < 0.2) { pull = 0; vel = 0; } }
      render();
      if (drag || pull !== 0) raf = requestAnimationFrame(tick); else sway.classList.remove('held');
    }
    function wake() { if (!raf && !dead) { prev = performance.now(); raf = requestAnimationFrame(tick); } }
    box.addEventListener('pointerdown', function (e) {
      var p = local(box, e), ex = ax, ey = ay + len + pull + 12;
      if (!done && Math.abs(p.x - ex) < 60 && Math.abs(p.y - ey) < 70) { unhint(); drag = true; sy = p.y - pull; sway.classList.add('held'); if (opts.onGrab) opts.onGrab(); try { box.setPointerCapture(e.pointerId); } catch (x) {} wake(); }
      e.preventDefault();
    });
    box.addEventListener('pointermove', function (e) { if (!drag) return; pull = clamp(local(box, e).y - sy, 0, 150); wake(); e.preventDefault(); });
    function release() {
      if (!drag) return; drag = false; wake();
      if (pull > 50 && !done) {
        count++;
        if (count >= need) { done = true; ring.remove(); if (opts.onPull) opts.onPull(); }
        else if (opts.onTug) opts.onTug(count);
      }
    }
    box.addEventListener('pointerup', release); box.addEventListener('pointercancel', release);
    render();
    function auto() { // the rope is pulled for you, as many times as it still takes
      if (done || drag || dead) return; unhint(); drag = true; sway.classList.add('held'); if (opts.onGrab) opts.onGrab();
      var t0 = performance.now();
      (function pullAnim(now) { if (dead) return; var k = Math.min(1, (now - t0) / 650); pull = 90 * Math.sin(k * Math.PI / 2); render(); if (k < 1) requestAnimationFrame(pullAnim); else { release(); if (!done) setTimeout(auto, 520); } })(t0);
    }
    var gh = null;
    function hint() { // a fingertip taking the tassel and pulling it down
      if (done) return false; unhint(); var y = ay + len + 14;
      gh = ghost(host, [[ax, y, 0], [ax, y, 0.95, 0.9], [ax, y + 80, 0.95, 0.9], [ax, y + 80, 0]], 1600);
      return true;
    }
    function unhint() { if (gh) { gh.remove(); gh = null; } }
    return { destroy: function () { dead = true; if (raf) cancelAnimationFrame(raf); unhint(); box.remove(); }, auto: auto, hint: hint, unhint: unhint };
  }

  /* ---------- a glowing thing to find and tap ---------- */
  function tapTarget(host, opts) {
    var el = document.createElement('div'); el.className = 'fx-target' + (opts.hidden ? ' faint' : '');
    el.style.left = opts.x + 'px'; el.style.top = opts.y + 'px'; host.appendChild(el);
    var done = false, holdT = null, gh = null;
    if (opts.hold) { el.innerHTML = '<svg viewBox="0 0 64 64" class="fx-holdring"><circle cx="32" cy="32" r="29" pathLength="100"/></svg>'; el.querySelector('circle').style.transitionDuration = (opts.hold / 1000) + 's'; }
    function fire() { if (done) return; done = true; unhint(); el.classList.remove('holding'); el.classList.add('hit'); sparkle(host, opts.x, opts.y, { n: 26 }); if (opts.onTap) opts.onTap(); setTimeout(function () { el.remove(); }, 900); }
    function inside(e) { var p = local(host, e), dx = p.x - opts.x, dy = p.y - opts.y; return dx * dx + dy * dy < (opts.r || 58) * (opts.r || 58); }
    function down(e) {
      if (done || !inside(e)) return; unhint();
      if (!opts.hold) { fire(); return; }
      el.classList.add('holding'); if (opts.onHold) opts.onHold(); holdT = setTimeout(fire, opts.hold);
    }
    function up() { if (holdT && !done) { clearTimeout(holdT); holdT = null; el.classList.remove('holding'); } }
    host.addEventListener('pointerdown', down); host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
    function hint() { // the light brightens and a fingertip presses and holds it
      if (done) return false; unhint(); el.classList.remove('faint'); el.classList.add('hint');
      gh = ghost(host, [[opts.x, opts.y, 0, 1.3], [opts.x, opts.y, 0.95, 1], [opts.x, opts.y, 0.95, 0.82], [opts.x, opts.y, 0.95, 0.82], [opts.x, opts.y, 0, 1.2]], 1900);
      return true;
    }
    function unhint() { el.classList.remove('hint'); if (gh) { gh.remove(); gh = null; } }
    return { destroy: function () { host.removeEventListener('pointerdown', down); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up); clearTimeout(holdT); unhint(); el.remove(); },
      hint: hint, unhint: unhint, auto: function () { if (done) return; unhint(); el.classList.remove('faint'); var cc = el.querySelector('circle'); if (cc) cc.style.transitionDuration = (Math.min(opts.hold || 0, 900) / 1000) + 's'; el.classList.add('holding'); if (opts.onHold) opts.onHold(); holdT = setTimeout(fire, Math.min(opts.hold || 0, 900)); } };
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

  window.WaywardFX = { veil: veil, wipe: wipe, lantern: lantern, trace: trace, rope: rope, tapTarget: tapTarget, sparkle: sparkle, ripple: ripple, creep: creep, ghost: ghost, glow: glow, presets: PRESETS };
})();
