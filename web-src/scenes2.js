/* scenes2.js — new interactive scenes (v4.5)
   Six scenes for the early pages: Edda's letter (p1), the inn door (p6), the blank map (p12), the names in the
   cave mouth (p16), Marta's lantern (p17) and the nine hundred steps (p22).
   Performance rules for slow phones: soft layers (fog, dust, glow) are canvases at half resolution; crisp ink is a
   canvas that is only stamped into, never redrawn whole; everything else moves with transform/opacity only;
   no pixel readbacks, no CSS filters, pointer moves are handled once per frame and every loop stops when idle.
   Contract with runScene (app.js): a scene returns { destroy, auto, hint, unhint }. runScene shows hint() after
   ~6 s without a touch (hint returns false when there is nothing to show), calls unhint() on any touch and auto()
   from ~14 s on. With ctx.short (a later visit) the scene ignores input and plays its change by itself in ~3 s. */
(function () {
  'use strict';
  var SC = window.WaywardScenes = window.WaywardScenes || {};
  var IL = window.WAYWARD_INTERLUDES = window.WAYWARD_INTERLUDES || {};
  var RES = 0.5;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var uid = 0;

  /* ---------------- small helpers ---------------- */
  function el(tag, cls, parent, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeBack(t) { var c = 1.2, d = c + 1; return 1 + d * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function seeded(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var rnd = Math.random;
  function rand(a, b) { return a + rnd() * (b - a); }
  function dpr() { return Math.min(2, window.devicePixelRatio || 1); }
  function canvas(parent, cls, w, h, res) {
    var c = el('canvas', cls, parent); c.width = Math.max(2, Math.round(w * res)); c.height = Math.max(2, Math.round(h * res));
    c.style.width = w + 'px'; c.style.height = h + 'px';
    var g = c.getContext('2d'); g.scale(res, res); return { c: c, g: g, w: w, h: h, res: res };
  }
  function offscreen(w, h, res) { var c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w * res)); c.height = Math.max(2, Math.round(h * res)); var g = c.getContext('2d'); g.scale(res, res); return { c: c, g: g, w: w, h: h, res: res }; }
  function fontsReady(list, ms) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var all = Promise.all(list.map(function (f) { return document.fonts.load(f).catch(function () {}); }));
    return Promise.race([all, new Promise(function (r) { setTimeout(r, ms || 1200); })]);
  }
  var puffCache = {};
  function puff(rgb) { // a soft cloud puff with a little texture inside
    var k = rgb.join(','); if (puffCache[k]) return puffCache[k];
    var s = document.createElement('canvas'); s.width = s.height = 128;
    var g = s.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(' + k + ',1)'); gr.addColorStop(0.5, 'rgba(' + k + ',.5)'); gr.addColorStop(1, 'rgba(' + k + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    var r = seeded(k.length * 977);
    for (var i = 0; i < 22; i++) { var x = 24 + r() * 80, y = 24 + r() * 80, rr = 6 + r() * 14, q = g.createRadialGradient(x, y, 0, x, y, rr); q.addColorStop(0, 'rgba(255,255,255,.16)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    puffCache[k] = s; return s;
  }
  // smooth a polyline (Catmull-Rom) and sample it evenly: returns {pts:[[x,y]], len:[cumulative], total}
  function sampler(pts, step) {
    var dense = [], i, k;
    for (i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      for (k = 0; k < 12; k++) {
        var t = k / 12, t2 = t * t, t3 = t2 * t;
        dense.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    dense.push(pts[pts.length - 1].slice());
    var out = [dense[0]], len = [0], acc = 0, need = step;
    for (i = 1; i < dense.length; i++) {
      var ax = dense[i - 1][0], ay = dense[i - 1][1], bx = dense[i][0], by = dense[i][1], d = Math.hypot(bx - ax, by - ay), used = 0;
      while (d - used >= need) { used += need; var f = used / d; out.push([ax + (bx - ax) * f, ay + (by - ay) * f]); acc += need; len.push(acc); need = step; }
      need -= (d - used);
    }
    var last = dense[dense.length - 1], lp = out[out.length - 1], rest = Math.hypot(last[0] - lp[0], last[1] - lp[1]);
    if (rest > 0.5) { out.push(last.slice()); len.push(acc + rest); }
    return { pts: out, len: len, total: len[len.length - 1] };
  }
  function at(sm, s) { // point at distance s along a sampler
    s = clamp(s, 0, sm.total);
    var lo = 0, hi = sm.len.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (sm.len[mid] <= s) lo = mid; else hi = mid; }
    var a = sm.pts[lo], b = sm.pts[hi], span = (sm.len[hi] - sm.len[lo]) || 1, f = (s - sm.len[lo]) / span;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])];
  }

  /* sounds recorded for these scenes (CC0, see sfx/NEW-SOUNDS.txt). app.js replaces the whole sample map when it
     starts, so they are added afterwards (and again when a scene starts, which costs nothing). */
  var SOUNDS = { knock: ['knock1', 'knock2'], unfold: ['unfold1', 'unfold2'], rub: ['rub1', 'rub2'], brush: ['brush1', 'brush2', 'brush3'], step: ['step1', 'step2', 'step3'], door: ['door'] };
  var GAINS = { knock: 0.85, unfold: 0.6, rub: 0.3, brush: 0.38, step: 0.5, door: 0.55 };
  function regSounds() { var AU = window.WaywardAudio; if (AU && AU.addSamples) AU.addSamples(SOUNDS, GAINS); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', regSounds); else setTimeout(regSounds, 0);

  /* ---------------- the stage every scene builds on ---------------- */
  function stage(ctx, cls) {
    regSounds();
    var host = ctx.host, hr = host.getBoundingClientRect(), tr = ctx.tome.getBoundingClientRect();
    var W = hr.width, H = hr.height, top = 62, bottom = Math.min(H, tr.top - hr.top) - 14;
    if (!(bottom - top > 260)) bottom = Math.min(H - 8, top + 300);
    var root = el('div', 's2 ' + (cls || ''), host);
    var S = { root: root, rect: hr, A: { W: W, H: H, top: top, bottom: bottom, h: bottom - top, cx: W / 2, cy: (top + bottom) / 2 }, dead: false, timers: [], raf: 0, tick: null, last: 0, ghostEl: null };
    S.later = function (fn, ms) { var t = setTimeout(function () { if (!S.dead) fn(); }, ms); S.timers.push(t); return t; };
    S.pt = function (e) { return { x: e.clientX - S.rect.left, y: e.clientY - S.rect.top }; };
    function frame(now) {
      S.raf = 0; if (S.dead || !S.tick) return;
      var dt = S.last ? Math.min(50, now - S.last) : 16; S.last = now;
      if (S.tick(now, dt)) S.raf = requestAnimationFrame(frame); else S.last = 0;
    }
    S.wake = function () { if (!S.raf && !S.dead) S.raf = requestAnimationFrame(frame); };
    function onResize() { S.rect = host.getBoundingClientRect(); }
    window.addEventListener('resize', onResize);
    S.ghost = function (frames, dur) { // a ghost fingertip that shows the gesture
      S.unghost();
      var g = el('div', 's2-ghost', root);
      var a = g.animate(frames.map(function (f) { return { transform: 'translate(' + f[0] + 'px,' + f[1] + 'px) scale(' + (f[3] || 1) + ')', opacity: f[2] }; }), { duration: dur || 1600, iterations: Infinity, easing: 'ease-in-out' });
      S.ghostEl = { el: g, a: a };
    };
    S.unghost = function () { if (S.ghostEl) { try { S.ghostEl.a.cancel(); } catch (x) {} S.ghostEl.el.remove(); S.ghostEl = null; } };
    S.destroy = function () {
      if (S.dead) return; S.dead = true;
      if (S.raf) cancelAnimationFrame(S.raf); S.raf = 0;
      S.timers.forEach(clearTimeout); S.timers = [];
      window.removeEventListener('resize', onResize);
      S.unghost();
      root.classList.add('s2-out'); root.style.pointerEvents = 'none';
      setTimeout(function () { root.remove(); }, 700); // fade out while the closing line is shown
    };
    return S;
  }
  // finishing: the done line, and back to a timed moment if the scene was played in front of one (see the bridge below)
  function finisher(ctx, S) {
    var via = takeBridge(ctx.p), fired = false;
    return function (withDone) { if (fired) return; fired = true; ctx.finish(withDone !== false); if (via) backToMoment(ctx.p); };
  }

  /* ---------------- 1. Edda's letter: unfold it, fold by fold (p1) ---------------- */
  SC.letter = function (ctx) {
    var S = stage(ctx, 's2-sc-letter'), A = S.A, root = S.root, il = ctx.il, fin = finisher(ctx, S), SH = !!ctx.short;
    var LW = Math.round(Math.min(A.W - 60, 312)), PH = Math.round(Math.min(LW * 0.43, (A.h - 36) / 3)), LH = PH * 3;
    var cx = A.W / 2, cy = A.top + A.h * 0.5;
    var Lt = el('div', 's2-letter', root);
    Lt.style.cssText = 'left:' + Math.round(cx - LW / 2) + 'px;top:' + Math.round(cy - LH / 2) + 'px;width:' + LW + 'px;height:' + LH + 'px';
    var shadow = el('div', 's2-lsh', Lt);
    function panel(cls, k) {
      var p = el('div', 's2-pn s2-' + cls, Lt); p.style.top = (k * PH) + 'px'; p.style.height = PH + 'px';
      return { el: p, ink: el('div', 's2-ink', p), back: el('div', 's2-back', p), shade: el('div', 's2-shade', p) };
    }
    var mid = panel('mid', 1), bot = panel('bot', 2), top = panel('top', 0);
    var words = ctx.L(il.text) || ['', ''], sign = il.sign || 'Edda Marlow';
    top.ink.innerHTML = '<span class="s2-hand s2-l1">' + esc(words[0]) + '</span>';
    mid.ink.innerHTML = '<span class="s2-hand s2-l2">' + esc(words[1]) + '</span>';
    bot.ink.innerHTML = '<span class="s2-sig">' + esc(sign) + '</span><svg class="s2-flour" viewBox="0 0 120 16" aria-hidden="true"><path d="M3 9 C 26 3, 52 14, 76 8 S 108 4, 117 10"/></svg><i class="s2-blot"></i>';
    top.ink.style.top = Math.round(PH * 0.42) + 'px'; mid.ink.style.top = Math.round(PH * 0.16) + 'px'; bot.ink.style.top = Math.round(PH * 0.12) + 'px';
    // the outside of the packet: addressed to you, and her seal, broken three weeks ago
    var addr = el('div', 's2-addr', top.back); addr.textContent = ctx.L(il.addr) || '';
    el('div', 's2-seal', top.back, '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3c4 0 6 3 9 3s5 3 6 6-1 5 1 8-1 6-3 8-3 5-6 6-5 2-8 2-5-2-8-3-4-3-6-6-1-5-2-8 1-5 3-7 3-5 6-6 5-3 8-3z" fill="url(#s2wax' + (++uid) + ')"/><circle cx="20" cy="21" r="9.5" fill="none" stroke="rgba(40,4,12,.55)" stroke-width="1.4"/><text x="20" y="26" text-anchor="middle" font-family="IM Fell English, Georgia, serif" font-size="14" fill="rgba(40,4,12,.6)">A</text><path d="M11 6 L17 15 L14 20 L21 26 L19 34" fill="none" stroke="#2a0610" stroke-width="1.6"/><path d="M11.6 6 L17.6 15 L14.6 20 L21.6 26" fill="none" stroke="rgba(255,190,190,.35)" stroke-width=".6"/><defs><radialGradient id="s2wax' + uid + '" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#C2404E"/><stop offset=".55" stop-color="#8A2034"/><stop offset="1" stop-color="#4A0C1C"/></radialGradient></defs></svg>');
    // size the handwriting once the font is there (one measurement, not per frame)
    fontsReady(['italic 30px "IM Fell English"']).then(function () {
      if (S.dead) return;
      var fs = Math.min(PH * 0.3, 34);
      [top.ink, mid.ink].forEach(function (ink) { ink.style.fontSize = fs + 'px'; });
      var w = Math.max(top.ink.firstChild.offsetWidth, mid.ink.firstChild.offsetWidth / 0.86), room = LW - 46;
      if (w > room) { fs = fs * room / w; [top.ink, mid.ink].forEach(function (ink) { ink.style.fontSize = fs.toFixed(1) + 'px'; }); }
    });
    var folds = [
      { p: top, ang: function (t) { return -180 * (1 - t); }, sign: -1 },
      { p: bot, ang: function (t) { return 180 * (1 - t); }, sign: 1 }
    ];
    var cur = 0, prog = [0, 0], drag = null, anim = null, done = false;
    function apply(i) {
      var f = folds[i], a = f.ang(prog[i]), s = Math.abs(Math.sin(a * Math.PI / 180));
      f.p.el.style.transform = 'rotateX(' + a.toFixed(2) + 'deg)';
      f.p.back.style.opacity = Math.abs(a) > 90 ? '1' : '0';
      f.p.shade.style.opacity = (0.6 * s).toFixed(3);
      if (i === 0 && prog[1] <= 0) bot.shade.style.opacity = (0.5 * s).toFixed(3); // the lifting flap shades the one below
    }
    apply(0); apply(1);
    function openness() { return (prog[0] + prog[1]) / 2; }
    function setShadow() { var o = openness(); shadow.style.transform = 'scale(1,' + (0.34 + 0.66 * o).toFixed(3) + ')'; }
    setShadow();
    Lt.animate([{ transform: 'translateY(150px) rotate(-10deg) scale(.86)', opacity: 0 }, { transform: 'translateY(0) rotate(-3deg) scale(1)', opacity: 1 }], { duration: reduce ? 200 : SH ? 560 : 950, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    ctx.sfx('grab', { gain: 0.6 });
    function animateTo(i, to, dur) { anim = { i: i, from: prog[i], to: to, t0: performance.now(), dur: dur }; S.wake(); }
    var FOLD_MS = SH ? 400 : 480;
    function openFold(i) { if (i !== cur || done) return; S.unghost(); animateTo(i, 1, prog[i] > 0.97 ? 60 : FOLD_MS * (1 - prog[i] * 0.5)); ctx.sfx('unfold', { gain: 0.9, pan: i ? 0.15 : -0.15 }); }
    S.tick = function (now) {
      if (drag && cur < 2) {
        var dy = drag.y - drag.y0;
        if (Math.abs(dy) > 6) drag.moved = true;
        if (drag.moved) { prog[cur] = clamp(drag.p0 + folds[cur].sign * dy / (PH * 1.2), 0, 1); apply(cur); setShadow(); }
        return true;
      }
      if (anim) {
        var t = clamp((now - anim.t0) / anim.dur, 0, 1), e = anim.to > anim.from ? easeBack(t) : easeOut(t);
        prog[anim.i] = anim.from + (anim.to - anim.from) * e; apply(anim.i); setShadow();
        if (t >= 1) {
          prog[anim.i] = anim.to; apply(anim.i); var i = anim.i, opened = anim.to === 1; anim = null;
          if (opened && i === cur) { cur++; if (cur === 2) complete(); else if (!SH && !drag) S.later(function () { if (cur === 1 && !drag && !anim) openFold(1); }, 220); } // the lower fold drops open under its own weight
        }
        return !!anim;
      }
      return false;
    };
    function complete() {
      if (done) return; done = true; S.unghost();
      ctx.setPrompt('');
      var gl = el('div', 's2-glint', Lt); el('i', '', gl);
      S.later(breathe, SH ? 120 : 260);
      S.later(function () { ctx.sfx('sparkle', { gain: 0.45 }); }, 350);
      S.later(function () { fin(true); }, SH ? 900 : 1350);
    }
    function breathe() { // the mountain breathes in: the cave flares up, your lantern flame leans towards it, embers are drawn in
      var cave = ctx.mapPt(57, 55), lamp = ctx.mapPt(51.5, 70.5), dx = cave.x - lamp.x, dy = cave.y - lamp.y, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      var lean = clamp((ang + Math.PI / 2) * 180 / Math.PI, -40, 40), dur = SH ? 900 : 1500, i;
      // the letter is pulled aside by the draught, so the cave shows below it
      Lt.animate([{ transform: 'translateY(0) rotate(-3deg) scale(1)' }, { transform: 'translate(-2%,-14%) rotate(-5deg) scale(.8)' }], { duration: dur * 0.8, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
      if (ctx.FX && ctx.FX.glow) {
        ctx.FX.glow(root, cave.x, cave.y, { r: Math.max(A.W, A.H) * 0.3, dur: dur + 300, peak: 1, rest: 0.75 });
        ctx.FX.glow(root, cave.x, cave.y + 6, { r: 64, dur: dur, peak: 1, rest: 0.85 });
        ctx.FX.glow(root, lamp.x, lamp.y - 6, { r: 60, dur: dur, peak: 0.9, rest: 0.55 });
      }
      var fl = el('i', 's2-flame', root); fl.style.left = lamp.x.toFixed(1) + 'px'; fl.style.top = (lamp.y + 2).toFixed(1) + 'px';
      fl.animate([{ opacity: 0, transform: 'rotate(0deg) scale(.7,.7)' }, { opacity: 1, transform: 'rotate(' + (lean * 0.4).toFixed(1) + 'deg) scale(1,1.15)', offset: 0.2 }, { opacity: 1, transform: 'rotate(' + lean.toFixed(1) + 'deg) scale(.8,1.7)', offset: 0.55 }, { opacity: 0.9, transform: 'rotate(' + (lean * 0.6).toFixed(1) + 'deg) scale(.95,1.35)' }], { duration: dur + 300, easing: 'ease-in-out', fill: 'forwards' });
      var dr = el('i', 's2-draft', root); dr.style.cssText = 'left:' + lamp.x.toFixed(1) + 'px;top:' + (lamp.y - 8).toFixed(1) + 'px;width:' + dist.toFixed(1) + 'px';
      dr.animate([{ opacity: 0, transform: 'rotate(' + ang.toFixed(4) + 'rad) scaleX(.05)' }, { opacity: 0.95, transform: 'rotate(' + ang.toFixed(4) + 'rad) scaleX(1)', offset: 0.5 }, { opacity: 0, transform: 'rotate(' + ang.toFixed(4) + 'rad) scaleX(1)' }], { duration: dur, easing: 'ease-out', fill: 'forwards' });
      for (i = 0; i < (SH ? 5 : 10); i++) { // embers from your lantern, drawn into the mountain
        var e = el('i', 's2-ember', root), bend = (i % 2 ? 1 : -1) * (12 + rnd() * 22), mx2 = dx * 0.5 - dy * bend / dist, my2 = dy * 0.5 + dx * bend / dist;
        e.style.left = lamp.x.toFixed(1) + 'px'; e.style.top = (lamp.y - 10).toFixed(1) + 'px';
        e.animate([{ opacity: 0, transform: 'translate(0,0) scale(1)' }, { opacity: 1, transform: 'translate(' + (mx2 * 0.3).toFixed(1) + 'px,' + (my2 * 0.3).toFixed(1) + 'px) scale(1)', offset: 0.2 }, { opacity: 0.9, transform: 'translate(' + mx2.toFixed(1) + 'px,' + my2.toFixed(1) + 'px) scale(.8)', offset: 0.6 }, { opacity: 0, transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(.3)' }], { duration: (SH ? 800 : 1300) + rnd() * 400, delay: i * (SH ? 60 : 110), easing: 'ease-in', fill: 'both' });
      }
      ctx.sfx('fire', { gain: 0.45 }); ctx.sfx('wind', { gain: 0.35 });
    }
    var vel = 0, lastY = 0, lastT = 0;
    root.addEventListener('pointerdown', function (e) {
      if (SH || done || cur > 1) return;
      var q = S.pt(e); anim = null; S.unghost();
      drag = { y0: q.y, y: q.y, p0: prog[cur], moved: false }; lastY = q.y; lastT = performance.now(); vel = 0;
      try { root.setPointerCapture(e.pointerId); } catch (x) {}
      ctx.sfx('grab', { gain: 0.35 }); S.wake(); e.preventDefault();
    });
    root.addEventListener('pointermove', function (e) {
      if (!drag) return; var q = S.pt(e), n = performance.now();
      if (n - lastT > 0) vel = vel * 0.6 + 0.4 * (q.y - lastY) / (n - lastT);
      lastY = q.y; lastT = n; drag.y = q.y; S.wake(); e.preventDefault();
    });
    function release() {
      if (!drag) return; var d = drag; drag = null; if (cur > 1) return;
      var fling = folds[cur].sign * vel > 0.45;
      if (!d.moved) openFold(cur); // a tap unfolds it too
      else if (prog[cur] > 0.42 || fling) openFold(cur);
      else { animateTo(cur, 0, 320); }
    }
    root.addEventListener('pointerup', release); root.addEventListener('pointercancel', release);
    function hint() { // a fingertip lifting the next fold (runScene decides when: after ~6 s without a touch)
      if (done || drag || anim || cur > 1) return false;
      var yEdge = cur === 0 ? cy + PH / 2 - 16 : cy - PH / 2 + 16, dist = cur === 0 ? -PH * 0.9 : PH * 0.9;
      S.ghost([[cx, yEdge, 0], [cx, yEdge, 0.95, 0.9], [cx, yEdge + dist, 0.95, 1], [cx, yEdge + dist, 0]], 1700);
    }
    function auto() { // it unfolds by itself
      if (done) return; drag = null; S.unghost();
      if (cur === 0) { openFold(0); S.later(function () { openFold(1); }, FOLD_MS + (SH ? 160 : 600)); } else openFold(1);
    }
    if (SH) S.later(auto, 380);
    return { destroy: S.destroy, auto: auto, hint: hint, unhint: S.unghost };
  };

  /* ---------------- 2. The inn door: knock three times (p6) ---------------- */
  SC.knock = function (ctx) {
    var S = stage(ctx, 's2-sc-knock'), A = S.A, root = S.root, il = ctx.il, fin = finisher(ctx, S), need = il.knocks || 3, SH = !!ctx.short;
    var DW = Math.round(Math.min(A.W * 0.52, (A.h - 64) / 1.7)), DH = Math.round(DW * 1.7);
    var dx = Math.round(A.W / 2 - DW / 2), dy = Math.round(A.top + (A.h - DH) / 2 + 6);
    var bg = ctx.bg, bgT = bg.style.transition, bgO = bg.style.transformOrigin;
    bg.style.transition = 'height .8s cubic-bezier(.3,.7,.2,1), transform 1.6s cubic-bezier(.3,.6,.2,1)';
    bg.style.transformOrigin = (il.zoom ? il.zoom[0] : 72) + '% ' + (il.zoom ? il.zoom[1] : 48) + '%';
    requestAnimationFrame(function () { if (!S.dead) bg.style.transform = 'scale(1.14)'; });
    var dim = el('div', 's2-dim', root); dim.style.setProperty('--dx', (dx + DW / 2) + 'px'); dim.style.setProperty('--dy', (dy + DH * 0.55) + 'px');
    var bloom = el('div', 's2-bloom', root), spill = el('div', 's2-spill', root);
    bloom.style.cssText = 'left:' + (dx + DW / 2 - DW * 1.4) + 'px;top:' + (dy + DH * 0.62 - DW * 1.4) + 'px;width:' + (DW * 2.8) + 'px;height:' + (DW * 2.8) + 'px'; spill.style.cssText = 'left:' + (dx - DW * 0.35) + 'px;top:' + (dy + DH - 2) + 'px;width:' + (DW * 1.7) + 'px;height:' + Math.max(40, A.bottom + 14 - dy - DH) + 'px';
    var door = el('div', 's2-door', root); door.style.cssText = 'left:' + dx + 'px;top:' + dy + 'px;width:' + DW + 'px;height:' + DH + 'px';
    var id = 's2k' + (++uid), fw = DW / 100; // svg units -> px
    var frame = el('div', 's2-frame', door, '<svg viewBox="-20 -20 140 212" aria-hidden="true"><defs>' +
      '<linearGradient id="' + id + 'st" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3242"/><stop offset=".55" stop-color="#241f2b"/><stop offset="1" stop-color="#141118"/></linearGradient>' +
      '<radialGradient id="' + id + 'vg" cx=".5" cy=".42" r=".62"><stop offset=".55" stop-color="rgba(6,4,10,0)"/><stop offset="1" stop-color="rgba(6,4,10,.7)"/></radialGradient>' +
      '<linearGradient id="' + id + 'wr" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="rgba(255,172,92,.34)"/><stop offset=".45" stop-color="rgba(255,172,92,0)"/></linearGradient>' +
      '<clipPath id="' + id + 'fc"><path fill-rule="evenodd" d="M-20 192V50A70 70 0 0 1 120 50V192Z M0 170V50A50 50 0 0 0 100 50V170Z"/></clipPath></defs>' +
      '<path d="M0 170V50A50 50 0 0 1 100 50V170Z" fill="#0d0806"/>' +
      '<g clip-path="url(#' + id + 'fc)"><rect x="-20" y="-20" width="140" height="212" fill="url(#' + id + 'st)"/>' +
      (function () {
        var r = seeded(66), out = '', A = [-90, -78, -62, -46, -30, -14, 0, 14, 30, 46, 62, 78, 90], k, P = function (a, rad) { a = a * Math.PI / 180; return (50 + rad * Math.sin(a)).toFixed(1) + ' ' + (50 - rad * Math.cos(a)).toFixed(1); };
        var tint = function () { var v = r(); return v < 0.5 ? 'rgba(0,0,0,' + (0.08 + v * 0.3).toFixed(2) + ')' : 'rgba(255,236,214,' + ((v - 0.5) * 0.16).toFixed(3) + ')'; };
        for (k = 0; k < A.length - 1; k++) out += '<path d="M' + P(A[k], 50) + 'L' + P(A[k], 70) + 'A70 70 0 0 1 ' + P(A[k + 1], 70) + 'L' + P(A[k + 1], 50) + 'A50 50 0 0 0 ' + P(A[k], 50) + 'Z" fill="' + tint() + '"/>';
        [50, 70, 92, 114, 136, 158].forEach(function (y, j, Y) { var h = (Y[j + 1] || 192) - y; out += '<rect x="-20" y="' + y + '" width="20" height="' + h + '" fill="' + tint() + '"/><rect x="100" y="' + (y - 8) + '" width="20" height="' + (h + (j === Y.length - 1 ? 8 : 0)) + '" fill="' + tint() + '"/>'; });
        return out;
      })() +
      '<image href="img/worn.webp" x="-20" y="-20" width="140" height="212" preserveAspectRatio="none" opacity=".16"/>' +
      [-78, -62, -46, -30, -14, 0, 14, 30, 46, 62, 78].map(function (a) { var r = a * Math.PI / 180, s = Math.sin(r), c = Math.cos(r); return '<path d="M' + (50 + 50 * s).toFixed(1) + ' ' + (50 - 50 * c).toFixed(1) + 'L' + (50 + 70 * s).toFixed(1) + ' ' + (50 - 70 * c).toFixed(1) + '" stroke="rgba(8,6,10,.7)" stroke-width="1.1"/>'; }).join('') +
      [70, 92, 114, 136, 158].map(function (y) { return '<path d="M-20 ' + y + 'H0M100 ' + (y - 8) + 'H120" stroke="rgba(8,6,10,.7)" stroke-width="1.1"/>'; }).join('') +
      '<path d="M-10 60V190M110 60V190" stroke="rgba(8,6,10,.5)" stroke-width=".8"/>' +
      '<rect x="-20" y="-20" width="140" height="212" fill="url(#' + id + 'wr)"/><rect x="-20" y="-20" width="140" height="212" fill="url(#' + id + 'vg)"/>' +
      '<path d="M0 170V50A50 50 0 0 1 100 50V170" fill="none" stroke="rgba(255,196,120,.28)" stroke-width="1.2"/></g>' +
      '<path d="M-12 170H112L122 186H-22Z" fill="#1f1a24"/><path d="M-12 170H112L113.5 172.4H-13.5Z" fill="rgba(255,190,120,.3)"/><path d="M-22 186H122V192H-22Z" fill="#120f16"/></svg>');
    frame.style.cssText = 'left:' + (-20 * fw) + 'px;top:' + (-20 * fw) + 'px;width:' + (140 * fw) + 'px;height:' + (212 * fw) + 'px';
    var inner = el('div', 's2-inner', door), leak = el('div', 's2-leak', door), feet = el('i', 's2-feet', leak);
    [inner, leak].forEach(function (x) { x.style.borderRadius = (DW / 2) + 'px ' + (DW / 2) + 'px 0 0'; });
    var leaf = el('div', 's2-leaf', door, '<svg viewBox="0 0 100 170" aria-hidden="true"><defs>' +
      '<clipPath id="' + id + 'dc"><path d="M0 170V50A50 50 0 0 1 100 50V170Z"/></clipPath>' +
      '<linearGradient id="' + id + 'pk" x1="0" x2="1"><stop offset="0" stop-color="#180c05"/><stop offset=".16" stop-color="#3e2413"/><stop offset=".5" stop-color="#4e301a"/><stop offset=".84" stop-color="#3a2114"/><stop offset="1" stop-color="#160b05"/></linearGradient>' +
      '<linearGradient id="' + id + 'ir" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a6c5e"/><stop offset=".35" stop-color="#352d27"/><stop offset="1" stop-color="#141110"/></linearGradient>' +
      '<linearGradient id="' + id + 'rim" x1="1" x2="0"><stop offset="0" stop-color="rgba(255,170,90,.32)"/><stop offset=".55" stop-color="rgba(255,170,90,0)"/></linearGradient>' +
      '<linearGradient id="' + id + 'sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(0,0,0,.55)"/><stop offset=".25" stop-color="rgba(0,0,0,0)"/><stop offset=".8" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,.45)"/></linearGradient>' +
      '<radialGradient id="' + id + 'br" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FDE7A8"/><stop offset=".4" stop-color="#C8903A"/><stop offset="1" stop-color="#5A3A12"/></radialGradient></defs>' +
      '<g clip-path="url(#' + id + 'dc)">' +
      [0, 1, 2, 3, 4].map(function (k) { return '<rect x="' + (k * 20) + '" y="0" width="20" height="170" fill="url(#' + id + 'pk)"/><rect x="' + (k * 20) + '" y="0" width="20" height="170" fill="rgba(' + (k % 2 ? '30,14,4,.18' : '120,70,30,.08') + ')"/>'; }).join('') +
      [3, 8, 14, 23, 29, 36, 44, 52, 57, 64, 71, 77, 84, 92, 97].map(function (x, k) { return '<path d="M' + x + ' 0C' + (x + 2) + ' 40 ' + (x - 2) + ' 90 ' + (x + 1.5) + ' 130S' + (x - 1) + ' 160 ' + (x + 1) + ' 170" fill="none" stroke="rgba(18,8,2,' + (k % 3 ? '.28' : '.45') + ')" stroke-width="' + (k % 3 ? '.45' : '.7') + '"/>'; }).join('') +
      '<image href="img/worn.webp" x="0" y="0" width="100" height="170" preserveAspectRatio="none" opacity=".2"/>' +
      [34, 128].map(function (y) { return '<rect x="-2" y="' + y + '" width="86" height="7" rx="1.5" fill="url(#' + id + 'ir)"/><path d="M84 ' + (y + 3.5) + 'c4 0 6-3 9-3" stroke="#2a231e" stroke-width="3" fill="none" stroke-linecap="round"/>' + [8, 26, 44, 62, 78].map(function (x) { return '<circle cx="' + x + '" cy="' + (y + 3.5) + '" r="1.6" fill="#1a1512"/><circle cx="' + (x - 0.4) + '" cy="' + (y + 3) + '" r=".6" fill="rgba(255,220,160,.5)"/>'; }).join(''); }).join('') +
      '<rect width="100" height="170" fill="url(#' + id + 'rim)"/><rect width="100" height="170" fill="url(#' + id + 'sh)"/>' +
      '<path d="M0 170V50A50 50 0 0 1 100 50V170" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="2"/></g>' +
      '<g transform="translate(78 96)"><rect x="-4" y="-7" width="8" height="14" rx="2" fill="url(#' + id + 'ir)"/><path d="M0-3a1.6 1.6 0 1 1 0 .1l1 4h-2z" fill="#070504"/></g>' +
      '<circle cx="50" cy="82" r="6.5" fill="url(#' + id + 'ir)"/><circle cx="50" cy="82" r="3.2" fill="url(#' + id + 'br)"/>' +
      '<g class="s2-knocker"><circle cx="50" cy="96" r="10.5" fill="none" stroke="#221a14" stroke-width="3.4"/><circle cx="50" cy="96" r="10.5" fill="none" stroke="url(#' + id + 'br)" stroke-width="1.5" stroke-dasharray="20 46" stroke-dashoffset="-38"/></g></svg>');
    var ring = leaf.querySelector('.s2-knocker');
    var knocks = 0, opened = false, busy = false;
    function inside(q) { return q.x > dx - 26 && q.x < dx + DW + 26 && q.y > dy - 26 && q.y < dy + DH + 20; }
    function dust() {
      for (var i = 0; i < 7; i++) {
        var d = el('i', 's2-dust', root), x = dx + rand(0.08, 0.92) * DW, y = dy - rand(4, 14), fall = rand(40, 110);
        d.style.left = x + 'px'; d.style.top = y + 'px';
        var a = d.animate([{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(' + rand(-6, 6).toFixed(1) + 'px,' + (fall * 0.3).toFixed(1) + 'px)', opacity: 0.9, offset: 0.2 }, { transform: 'translate(' + rand(-12, 12).toFixed(1) + 'px,' + fall.toFixed(1) + 'px)', opacity: 0 }], { duration: rand(900, 1500), delay: rand(0, 160), easing: 'cubic-bezier(.4,0,.8,1)' });
        a.onfinish = (function (n) { return function () { n.remove(); }; })(d);
      }
    }
    function knock(q) {
      if (opened || busy || knocks >= need) return;
      knocks++; S.unghost(); door.classList.remove('s2-hint');
      ctx.sfx('knock', { pan: clamp((q.x / A.W) * 2 - 1, -1, 1) * 0.3, gain: 0.9 + rnd() * 0.1 });
      leaf.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-1.4deg) scale(.994)' }, { transform: 'rotateY(0deg)' }], { duration: 180, easing: 'ease-out' });
      ring.animate([{ transform: 'translateY(0) scaleY(1)' }, { transform: 'translateY(-2px) scaleY(.7)' }, { transform: 'translateY(0) scaleY(1)' }], { duration: 220, easing: 'ease-out' });
      var hit = el('i', 's2-khit', root); hit.style.left = q.x + 'px'; hit.style.top = q.y + 'px';
      hit.animate([{ transform: 'scale(.3)', opacity: 0.8 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = function () { hit.remove(); };
      dust();
      leak.style.opacity = [0.3, 0.5, 0.78][Math.min(2, knocks - 1)];
      if (knocks === need - 1) S.later(function () { feet.classList.add('go'); ctx.sfx('step', { gain: 0.35, pan: 0.1 }); }, 450);
      if (knocks >= need) { busy = true; S.later(openDoor, SH ? 260 : 700); }
    }
    function openDoor() {
      if (opened) return; opened = true; ctx.setPrompt(''); S.unghost();
      var k = SH ? 0.3 : 1; // the short version: Marta is already at the door
      ctx.sfx('step', { gain: 0.4 }); S.later(function () { ctx.sfx('step', { gain: 0.45, pan: -0.1 }); }, 380 * k);
      S.later(function () { leak.style.opacity = '1'; ctx.sfx('open', { gain: 0.7 }); }, 650 * k);
      S.later(function () {
        ctx.sfx('door', { gain: 0.9 }); ctx.sfx('fire', { gain: 0.35 });
        door.classList.add('s2-open'); root.classList.add('s2-warm');
        S.later(function () { if (ctx.FX) ctx.FX.sparkle(root, dx + DW / 2, dy + DH * 0.62, { n: 22, spread: 90 }); }, 700);
        S.later(function () { fin(true); }, SH ? 1100 : 1900);
      }, 800 * k);
    }
    root.addEventListener('pointerdown', function (e) {
      if (SH) return;
      var q = S.pt(e);
      if (inside(q)) knock(q);
      else if (!opened) { door.classList.remove('s2-hint'); S.later(function () { door.classList.add('s2-hint'); }, 30); }
      e.preventDefault();
    });
    function hint() { // the knocker glows and a fingertip taps it
      if (opened || knocks >= need) return false;
      door.classList.remove('s2-hint'); void door.offsetWidth; door.classList.add('s2-hint');
      var x = dx + DW / 2, y = dy + DH * 0.56; S.ghost([[x, y, 0, 1.2], [x, y, 0.95, 1], [x, y, 0.95, 0.8], [x, y, 0.6, 1.05], [x, y, 0, 1.2]], 900);
    }
    function unhint() { S.unghost(); door.classList.remove('s2-hint'); }
    function auto() {
      if (opened) return; unhint();
      var n = 0; (function one() { if (S.dead || opened || knocks >= need) return; knock({ x: dx + DW * (0.46 + rnd() * 0.08), y: dy + DH * (0.52 + rnd() * 0.08) }); n++; if (knocks < need) S.later(one, SH ? 230 : 520); })();
    }
    if (SH) S.later(auto, 300);
    var destroy = S.destroy;
    S.destroy = function () {
      destroy();
      bg.style.transform = '';
      setTimeout(function () { bg.style.transition = bgT; bg.style.transformOrigin = bgO; }, 1700);
    };
    return { destroy: S.destroy, auto: auto, hint: hint, unhint: unhint };
  };

  /* ---------------- 3. The blank map: trace her line, and the ink comes up under your finger (p12) ----------------
     The map looks blank, but her pen pressed a groove into the paper. Where your finger follows the groove, her
     ink comes back, stroke by stroke, and the warmth of your hand brings up the rest of her drawing around it. */
  SC.inkmap = function (ctx) {
    var S = stage(ctx, 's2-sc-map'), A = S.A, root = S.root, il = ctx.il, fin = finisher(ctx, S), SH = !!ctx.short;
    var MW = Math.round(Math.min(A.W - 40, (A.h - 24) / 1.16) * 0.84), MH = Math.round(MW * 1.16); // smaller: the night stays around it
    var mx = Math.round((A.W - MW) / 2), my = Math.round(A.top + (A.h - MH) / 2), ROT = -2 * Math.PI / 180;
    el('div', 's2-night s2-mapnight', root); // the valley at night around the map
    var sheet = el('div', 's2-map', root); sheet.style.cssText = 'left:' + mx + 'px;top:' + my + 'px;width:' + MW + 'px;height:' + MH + 'px';
    el('div', 's2-mapframe', sheet);
    var R2 = Math.min(1.5, dpr()), hid = canvas(sheet, 's2-mapfull', MW, MH, R2), disp = canvas(sheet, 's2-mapink', MW, MH, R2);
    el('div', 's2-moonlit', sheet); // moonlight: cool, darker towards the edges
    var warm = el('div', 's2-warmth', sheet), tipEl = el('i', 's2-tip', sheet);
    var INK = 'rgba(70,38,14,', rr = seeded(1212);
    function U(u, v) { return [u * MW, v * MH]; }
    function hand(g, pts, w, a, jit) {
      var sm = sampler(pts.map(function (p) { return U(p[0], p[1]); }), 3);
      g.lineCap = g.lineJoin = 'round';
      for (var pass = 0; pass < 2; pass++) {
        g.strokeStyle = INK + (pass ? a * 0.45 : a) + ')'; g.lineWidth = pass ? w * 0.6 : w; g.beginPath();
        sm.pts.forEach(function (p, i) { var x = p[0] + (rr() - 0.5) * (jit || 0.5) + (pass ? 0.5 : 0), y = p[1] + (rr() - 0.5) * (jit || 0.5); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        g.stroke();
      }
    }
    // Edda's route (normalised): from where you stand, up the valley to the place she marked
    var ROUTE = il.route || [[0.36, 0.86], [0.45, 0.81], [0.55, 0.77], [0.65, 0.72], [0.74, 0.67], [0.8, 0.62], [0.79, 0.57], [0.74, 0.53], [0.68, 0.49], [0.62, 0.46], [0.57, 0.44]];
    var route = sampler(ROUTE.map(function (p) { return U(p[0], p[1]); }), 2);
    var word = ctx.L(il.word) || 'Safe';
    function drawHidden() {
      var g = hid.g, i;
      // the mountain, drawn the way she draws mountains
      var MT = [[0.03, 0.64], [0.1, 0.56], [0.17, 0.48], [0.23, 0.41], [0.29, 0.33], [0.34, 0.25], [0.38, 0.18], [0.41, 0.13], [0.45, 0.18], [0.5, 0.24], [0.55, 0.28], [0.6, 0.3], [0.66, 0.35], [0.73, 0.41], [0.8, 0.47], [0.88, 0.54], [0.97, 0.61]];
      hand(g, MT, 1.6, 0.85, 0.6);
      hand(g, [[0.55, 0.28], [0.62, 0.2], [0.68, 0.23], [0.75, 0.15], [0.82, 0.21], [0.89, 0.17], [0.97, 0.23]], 1, 0.5, 0.5);
      hand(g, [[0.02, 0.33], [0.08, 0.28], [0.14, 0.31], [0.2, 0.26], [0.26, 0.3]], 0.9, 0.42, 0.5);
      var mt = sampler(MT.map(function (p) { return U(p[0], p[1]); }), 4);
      for (i = 0; i < 46; i++) { // shading strokes that hug the slopes, in little groups
        var s = mt.total * (0.04 + 0.92 * (i / 45)) + (rr() - 0.5) * 6, p = at(mt, s), east = p[0] > 0.41 * MW, dx = east ? -0.42 : 0.3, off = 3 + rr() * 5, len = MW * (0.014 + rr() * 0.022) * (east ? 1.25 : 0.8);
        if (!east && i % 2) continue;
        g.strokeStyle = INK + (east ? 0.42 : 0.3) + ')'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(p[0] + dx * off, p[1] + off); g.lineTo(p[0] + dx * (off + len), p[1] + off + len); g.stroke();
      }
      // the cave, the old stairway, the river, the village
      hand(g, [[0.335, 0.62], [0.34, 0.595], [0.36, 0.585], [0.38, 0.595], [0.385, 0.62]], 1.2, 0.8, 0.2);
      g.setLineDash([2, 4]); hand(g, [[0.22, 0.66], [0.25, 0.62], [0.23, 0.58], [0.27, 0.54], [0.25, 0.5], [0.29, 0.46]], 1, 0.7, 0.2); g.setLineDash([]);
      hand(g, [[0.0, 0.78], [0.08, 0.8], [0.15, 0.77], [0.24, 0.8], [0.3, 0.86], [0.36, 0.92], [0.45, 0.95], [0.55, 0.99]], 1.2, 0.6, 0.4);
      [[0.13, 0.84], [0.17, 0.83], [0.21, 0.85], [0.15, 0.88], [0.2, 0.89]].forEach(function (h) {
        var x = h[0] * MW, y = h[1] * MH, s = MW * 0.018;
        g.strokeStyle = INK + '.75)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s, y - s); g.lineTo(x, y - s * 1.9); g.lineTo(x + s, y - s); g.lineTo(x + s, y); g.closePath(); g.stroke();
      });
      g.fillStyle = INK + '.7)'; g.font = 'italic ' + Math.round(MW * 0.042) + 'px "IM Fell English", Georgia, serif'; g.textAlign = 'center';
      g.fillText(ctx.L(il.village) || 'Low Veyra', 0.17 * MW, 0.945 * MH);
      // compass rose
      var ccx = 0.85 * MW, ccy = 0.85 * MH, cr = MW * 0.05;
      g.strokeStyle = INK + '.6)'; g.lineWidth = 0.8; g.beginPath(); g.arc(ccx, ccy, cr, 0, 6.283); g.stroke();
      g.fillStyle = INK + '.8)'; g.beginPath(); g.moveTo(ccx, ccy - cr * 1.5); g.lineTo(ccx + cr * 0.28, ccy); g.lineTo(ccx, ccy + cr * 0.9); g.lineTo(ccx - cr * 0.28, ccy); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(ccx - cr * 1.2, ccy); g.lineTo(ccx + cr * 1.2, ccy); g.stroke();
      g.font = Math.round(MW * 0.04) + 'px "IM Fell English", Georgia, serif'; g.fillText('N', ccx, ccy - cr * 1.62);
    }
    function drawGroove() { // the blank map is not quite blank: her pen pressed a groove into it, and an X where you stand
      var g = disp.g, k, p, prev;
      g.lineCap = 'round';
      for (var pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass ? 'rgba(255,250,236,.42)' : 'rgba(96,62,28,.2)'; g.lineWidth = pass ? 1.1 : 2.2;
        g.beginPath(); for (k = 0; k < route.pts.length; k++) { p = route.pts[k]; if (k) g.lineTo(p[0] + (pass ? 0.9 : 0), p[1] + (pass ? 0.9 : 0)); else g.moveTo(p[0] + (pass ? 0.9 : 0), p[1] + (pass ? 0.9 : 0)); } g.stroke();
      }
      var y0 = route.pts[0]; g.strokeStyle = INK + '.8)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(y0[0] - 5, y0[1] - 5); g.lineTo(y0[0] + 5, y0[1] + 5); g.moveTo(y0[0] + 5, y0[1] - 5); g.lineTo(y0[0] - 5, y0[1] + 5); g.stroke();
    }
    drawGroove();
    function routeSeg(g, s0, s1, a) { // her line: thin, confident, a touch heavier where the pen slows
      g.lineCap = 'round'; g.strokeStyle = INK + a + ')';
      var steps = Math.max(1, Math.ceil((s1 - s0) / 2)), prev = at(route, s0);
      for (var k = 1; k <= steps; k++) {
        var s = s0 + (s1 - s0) * k / steps, p = at(route, s);
        g.lineWidth = 1.6 + 0.5 * Math.sin(s / 23); g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke();
        if (s > route.total * 0.56 && s < route.total * 0.95 && Math.floor(s / 8) !== Math.floor((s - (s1 - s0) / steps) / 8)) { // the ridge she walks along
          var n = p[2] - Math.PI / 2, c = Math.cos(n), sn = Math.sin(n); g.lineWidth = 0.7; g.strokeStyle = INK + '.55)'; g.beginPath(); g.moveTo(p[0] + c * 3, p[1] + sn * 3); g.lineTo(p[0] + c * 7, p[1] + sn * 7); g.moveTo(p[0] - c * 3, p[1] - sn * 3); g.lineTo(p[0] - c * 6, p[1] - sn * 6); g.stroke(); g.strokeStyle = INK + a + ')';
        }
        prev = p;
      }
    }
    // the word, written left to right when the line arrives
    var fsW = Math.round(MW * 0.095), wordC = offscreen(fsW * word.length * 0.7 + 20, fsW * 1.6, R2), wordW = 0, endP = at(route, route.total), wx0 = 0, wy0 = 0;
    fontsReady(['italic 30px "IM Fell English"', '30px "IM Fell English"']).then(function () {
      if (S.dead) return;
      drawHidden();
      var g = wordC.g; g.font = 'italic ' + fsW + 'px "IM Fell English", Georgia, serif'; g.fillStyle = INK + '.95)'; g.textBaseline = 'middle';
      wordW = Math.min(wordC.w - 4, g.measureText(word).width + 6); g.fillText(word, 3, fsW * 0.8);
      wx0 = clamp(endP[0] - wordW - 12, 10, MW - wordW - 10); wy0 = endP[1] + fsW * 0.05;
    });
    // the warmth of a finger brings the rest of her drawing out around it, a soft stamp at a time
    var BR = Math.round(Math.max(22, MW * 0.09)), stamp = offscreen(BR * 2, BR * 2, R2), soft = offscreen(BR * 2, BR * 2, R2);
    (function () { var gr = soft.g.createRadialGradient(BR, BR, 0, BR, BR, BR); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,.33)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); soft.g.fillStyle = gr; soft.g.fillRect(0, 0, BR * 2, BR * 2); })();
    function dab(x, y) {
      var g = stamp.g; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, BR * 2, BR * 2);
      g.drawImage(soft.c, 0, 0, BR * 2, BR * 2);
      g.globalCompositeOperation = 'source-in';
      g.drawImage(hid.c, (x - BR) * R2, (y - BR) * R2, BR * 2 * R2, BR * 2 * R2, 0, 0, BR * 2, BR * 2);
      g.globalCompositeOperation = 'source-over';
      disp.g.drawImage(stamp.c, x - BR, y - BR, BR * 2, BR * 2);
    }
    function local(q) { // screen -> sheet (the sheet is turned a little)
      var cx = mx + MW / 2, cy = my + MH / 2, x = q.x - cx, y = q.y - cy, c = Math.cos(-ROT), sn = Math.sin(-ROT);
      return { x: x * c - y * sn + MW / 2, y: x * sn + y * c + MH / 2 };
    }
    function screen(p) { var c = Math.cos(ROT), sn = Math.sin(ROT), x = p[0] - MW / 2, y = p[1] - MH / 2; return [mx + MW / 2 + x * c - y * sn, my + MH / 2 + x * sn + y * c]; }
    root.__route = function () { return route.pts.filter(function (p, i) { return i % 6 === 0; }).concat([route.pts[route.pts.length - 1]]).map(function (p) { var q = screen(p), r = S.rect; return [q[0] + r.left, q[1] + r.top]; }); }; // for the tests
    var ptr = null, lastP = null, phase = 'trace', drawS = 0, writeX = 0, tipOn = false, quillAt = 0, dabAt = 0;
    var TOL = Math.max(30, BR * 1.1), LOOK = Math.max(70, MW * 0.3);
    function tip(x, y, on) { if (on !== tipOn) { tipOn = on; tipEl.classList.toggle('on', on); } if (on) tipEl.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; }
    function restTip() { var p = at(route, drawS); tip(p[0], p[1], true); tipEl.classList.add('s2-wait'); }
    restTip();
    root.addEventListener('pointerdown', function (e) { if (SH || phase !== 'trace') return; ptr = S.pt(e); lastP = null; S.unghost(); warm.classList.add('on'); tipEl.classList.remove('s2-wait'); try { root.setPointerCapture(e.pointerId); } catch (x) {} S.wake(); e.preventDefault(); });
    root.addEventListener('pointermove', function (e) { if (!ptr) return; ptr = S.pt(e); S.wake(); e.preventDefault(); });
    function up() { ptr = null; lastP = null; warm.classList.remove('on'); if (phase === 'trace') tipEl.classList.add('s2-wait'); }
    root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
    function follow(p, now) { // the finger on (or close to) the groove just ahead of the ink: the ink runs to it
      var best = -1, bd = 1e9, end = Math.min(route.total, drawS + LOOK);
      for (var s = drawS; s <= end + 0.01; s += 3) { var q = at(route, s), d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < bd) { bd = d; best = s; } }
      if (bd < TOL && best > drawS + 0.5) {
        if (route.total - best < 6) best = route.total;
        routeSeg(disp.g, drawS, best, 0.95); drawS = best;
        var tp = at(route, drawS); tip(tp[0], tp[1], true);
        if (now - quillAt > 520) { quillAt = now; ctx.sfx('quill', { gain: 0.75, pan: (tp[0] / MW - 0.5) * 0.5 }); }
        if (drawS >= route.total) lineDone();
      }
    }
    var DRAW_MS = SH ? 900 : 1800, WRITE_MS = SH ? 450 : 700;
    S.tick = function (now, dt) {
      if (phase === 'trace') {
        if (ptr) {
          var p = local(ptr); warm.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)';
          if (wordW && (!lastP || Math.hypot(p.x - lastP.x, p.y - lastP.y) > BR * 0.35) && now - dabAt > 30) { dab(p.x, p.y); lastP = p; dabAt = now; }
          if (wordW) follow(p, now);
          return true;
        }
        return false;
      }
      if (phase === 'draw') { // (only when it draws itself)
        var s0 = drawS; drawS = Math.min(route.total, drawS + dt * route.total / DRAW_MS);
        routeSeg(disp.g, s0, drawS, 0.95);
        var tp = at(route, drawS); tip(tp[0], tp[1], true);
        if (now - quillAt > 900) { quillAt = now; ctx.sfx('quill', { gain: 0.7 }); }
        if (drawS >= route.total) lineDone();
        return true;
      }
      if (phase === 'write') {
        var x0 = writeX; writeX = Math.min(wordW, writeX + dt * wordW / WRITE_MS);
        if (writeX > x0) disp.g.drawImage(wordC.c, x0 * R2, 0, (writeX - x0) * R2, wordC.c.height, wx0 + x0, wy0 - fsW * 0.8, writeX - x0, wordC.c.height / R2);
        tip(wx0 + writeX, wy0 + Math.sin(now / 60) * fsW * 0.18, true);
        if (writeX >= wordW) {
          phase = 'end'; tip(0, 0, false);
          var g = disp.g; g.strokeStyle = INK + '.9)'; g.lineWidth = 1.3; g.beginPath(); g.arc(endP[0], endP[1], 5.5, 0, 6.283); g.stroke();
          g.beginPath(); g.moveTo(wx0 + 2, wy0 + fsW * 0.42); g.quadraticCurveTo(wx0 + wordW * 0.5, wy0 + fsW * 0.62, wx0 + wordW + 4, wy0 + fsW * 0.36); g.stroke();
          sheet.classList.add('s2-wet'); ctx.sfx('sparkle', { gain: 0.4 });
          S.later(function () { fin(true); }, SH ? 600 : 1000);
        }
        return true;
      }
      return false;
    };
    function lineDone() {
      if (phase === 'write' || phase === 'end') return;
      phase = 'write'; writeX = 0; up(); S.unghost(); tipEl.classList.remove('s2-wait'); ctx.setPrompt('');
      hid.c.classList.add('on'); // the rest of her drawing comes up out of the paper
      ctx.sfx('quill', { gain: 0.8 }); S.wake();
    }
    function hint() { // a fingertip tracing the next stretch of the groove from where the ink stopped
      if (phase !== 'trace' || ptr) return false;
      var a = screen(at(route, drawS)), b = screen(at(route, Math.min(route.total, drawS + route.total * 0.22))), m = screen(at(route, Math.min(route.total, drawS + route.total * 0.11)));
      S.ghost([[a[0], a[1], 0], [a[0], a[1], 0.95, 0.9], [m[0], m[1], 0.95, 0.9], [b[0], b[1], 0.95, 0.9], [b[0], b[1], 0]], 2000);
    }
    function auto() { // her line draws itself
      if (phase !== 'trace') return; S.unghost(); up(); tipEl.classList.remove('s2-wait');
      (function go() { if (S.dead || phase !== 'trace') return; if (!wordW) { S.later(go, 120); return; } phase = 'draw'; ctx.sfx('quill', { gain: 0.8 }); quillAt = performance.now(); S.wake(); })();
    }
    if (SH) S.later(auto, 250);
    return { destroy: S.destroy, auto: auto, hint: hint, unhint: S.unghost };
  };

  /* ---------------- 4. The names in the rock: brush away the dust (p16) ---------------- */
  var NAMES = ['ODO', 'MIRA VALE', 'T. KORRIN', 'ELSBETH', 'A. MOREAU', 'JONAS', 'HELKA', 'PIETRO', 'SANNE', 'BRAM', 'IDA', 'CORVIN', 'LUDO', 'MAREN', 'Y. OSTRA', 'EVERT', 'WILHELMINA', 'R. DAAN', 'ALDA', 'FENNA', 'JORIS', 'HUGO', 'LIV', 'KASPAR', 'NELL', 'OSWIN', 'GRETE', 'THEO', 'BEA', 'ROLAND', 'ISOLDE', 'CATO', 'WOUTER', 'EMRYS', 'HILDE', 'FAROUK', 'AGNES', 'LEVI', 'ROSALIND', 'TOBIAS', 'ADA', 'SOLVEIG', 'MATTEO', 'ANSELM', 'DORA', 'KEES', 'ULLA', 'JAN V.', 'E. HART', 'MAB', 'SEFA', 'NOOR', 'GIDEON', 'LENE', 'ORLA', 'P. VOSS'];
  var YEARS = ['1612', '1788', 'MCCIV', '1349', '1901', '1455', 'DCCC', '1830', '1666', '1570'];
  SC.dust = function (ctx) {
    var S = stage(ctx, 's2-sc-dust'), A = S.A, root = S.root, il = ctx.il, fin = finisher(ctx, S), QK = !!ctx.short; // (SH is the slab height here)
    var SW = Math.round(A.W - 28), SH = Math.round(Math.min(A.h - 18, SW * 1.32)), sx = 14, sy = Math.round(A.top + (A.h - SH) / 2);
    var slab = el('div', 's2-slab', root); slab.style.cssText = 'left:' + sx + 'px;top:' + sy + 'px;width:' + SW + 'px;height:' + SH + 'px';
    var rr = seeded(1606), outline = [], i, n = 40;
    for (i = 0; i < n; i++) { // a rough-edged slab of rock
      var a = i / n * 6.283, ex = Math.cos(a), ey = Math.sin(a), k = Math.pow(Math.pow(Math.abs(ex), 4) + Math.pow(Math.abs(ey), 4), -0.25), j = 1 - rr() * 0.05;
      outline.push([SW / 2 + ex * k * SW / 2 * j * 0.98, SH / 2 + ey * k * SH / 2 * j * 0.98]);
    }
    function shape(g) { g.beginPath(); outline.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); }
    var R1 = Math.min(1.5, window.devicePixelRatio || 1), stone = canvas(slab, 's2-stone', SW, SH, R1), gold = canvas(slab, 's2-gold', SW, SH, R1);
    var dustC = canvas(slab, 's2-dustc', SW, SH, RES), parts = canvas(slab, 's2-parts', SW, SH, RES);
    var names = el('div', 's2-names', slab); el('i', 's2-lamplight', slab); // your lantern, held to the left of the rock
    var room = el('i', 's2-room', slab), nameY = SH * 0.7, nameFs = Math.round(Math.min(SW * 0.085, 30)), nameBox = { x0: SW * 0.12, x1: SW * 0.88, y0: nameY - nameFs * 0.9, y1: nameY + nameFs * 0.7 };
    room.style.cssText = 'left:' + (SW * 0.22) + 'px;top:' + (nameY + nameFs * 0.8) + 'px;width:' + (SW * 0.56) + 'px;height:' + (nameFs * 1.5) + 'px';
    var LIT = []; // the names nearest hers, which light up one by one when the dust is gone
    function engrave(g, txt, x, y, fs, font, light, rot) { // an old cut, lit from the left: a dark groove with a lit far wall
      g.save(); g.translate(x, y); g.rotate(rot || 0); g.font = fs + 'px ' + font; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,222,184,' + (light * 0.55).toFixed(3) + ')'; g.fillText(txt, 0.9, 0.6);
      g.fillStyle = 'rgba(14,9,14,.62)'; g.fillText(txt, 0, 0);
      g.fillStyle = 'rgba(210,190,170,' + (light * 0.35).toFixed(3) + ')'; g.fillText(txt, -0.3, -0.2); // worn smooth by hands: a little of the rock shows in the groove
      g.restore();
    }
    function glyphs(g, x, y, count, h, light) { // marks from alphabets nobody reads any more
      g.lineCap = 'round';
      for (var c = 0; c < count; c++) {
        var gx = x + c * h * 0.8, m = 2 + Math.floor(rr() * 3);
        for (var q = 0; q < m; q++) {
          var ax = gx + Math.floor(rr() * 3) * h * 0.28, ay = y + Math.floor(rr() * 3) * h * 0.45, bx = gx + Math.floor(rr() * 3) * h * 0.28, by = y + Math.floor(rr() * 3) * h * 0.45;
          if (ax === bx && ay === by) by += h * 0.45;
          g.strokeStyle = 'rgba(255,222,184,' + (light * 0.5).toFixed(3) + ')'; g.lineWidth = 1; g.beginPath(); g.moveTo(ax + 0.8, ay + 0.5); g.lineTo(bx + 0.8, by + 0.5); g.stroke();
          g.strokeStyle = 'rgba(12,8,12,.6)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        }
      }
      return count * h * 0.8;
    }
    function drawStone() {
      var g = stone.g, k, rs = seeded(2204); g.save(); shape(g); g.clip();
      // rock lit from the left by your lantern, falling away into the dark on the right
      var base = g.createLinearGradient(0, SH * 0.2, SW, SH * 0.55); base.addColorStop(0, '#77625a'); base.addColorStop(0.42, '#4b3d44'); base.addColorStop(1, '#1f1820');
      g.fillStyle = base; g.fillRect(0, 0, SW, SH);
      // bulges and hollows in the rock: a lit side towards the lantern, a shadow side away from it
      for (k = 0; k < 16; k++) {
        var bx = rs() * SW, by = rs() * SH, br = (0.16 + rs() * 0.26) * SW, lx = bx - br * 0.38, ly = by - br * 0.12, dx2 = bx + br * 0.34, dy2 = by + br * 0.18;
        var hl = g.createRadialGradient(lx, ly, 0, lx, ly, br * 0.8); hl.addColorStop(0, 'rgba(255,214,170,' + (0.08 + rs() * 0.07).toFixed(3) + ')'); hl.addColorStop(1, 'rgba(255,214,170,0)');
        g.fillStyle = hl; g.fillRect(lx - br, ly - br, br * 2, br * 2);
        var sd = g.createRadialGradient(dx2, dy2, 0, dx2, dy2, br * 0.85); sd.addColorStop(0, 'rgba(6,3,8,' + (0.14 + rs() * 0.12).toFixed(3) + ')'); sd.addColorStop(1, 'rgba(6,3,8,0)');
        g.fillStyle = sd; g.fillRect(dx2 - br, dy2 - br, br * 2, br * 2);
      }
      if (tex.complete && tex.naturalWidth) { // grain, pressed in: a darker copy down-right, a lighter one up-left
        var pat = g.createPattern(tex, 'repeat');
        g.globalAlpha = 0.34; g.globalCompositeOperation = 'overlay'; g.fillStyle = pat; g.fillRect(0, 0, SW, SH);
        g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.22; g.save(); g.translate(1.6, 1.4); g.fillStyle = pat; g.fillRect(-2, -2, SW + 4, SH + 4); g.restore();
        g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.12; g.save(); g.translate(-1, -0.8); g.fillStyle = pat; g.fillRect(-2, -2, SW + 4, SH + 4); g.restore();
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      }
      // cracks, with a lit lip on the lantern side
      [[0.08, 0.2, 0.3, 0.26, 0.42, 0.18], [0.7, 0.05, 0.64, 0.2, 0.74, 0.34, 0.69, 0.46], [0.9, 0.62, 0.8, 0.7, 0.86, 0.9], [0.12, 0.86, 0.28, 0.93]].forEach(function (c) {
        var pts = [], q; for (q = 0; q < c.length; q += 2) pts.push([c[q] * SW, c[q + 1] * SH]);
        var sm2 = sampler(pts, 5);
        [[-0.9, -0.6, 'rgba(255,214,170,.22)', 0.9], [0, 0, 'rgba(6,3,8,.78)', 1.7]].forEach(function (L) {
          g.strokeStyle = L[2]; g.lineWidth = L[3]; g.beginPath();
          sm2.pts.forEach(function (p, i) { var j = (Math.sin(i * 1.7) + Math.sin(i * 0.63)) * 1.6; if (i) g.lineTo(p[0] + j + L[0], p[1] + L[1]); else g.moveTo(p[0] + L[0], p[1] + L[1]); }); g.stroke();
        });
      });
      // hundreds of names: the oldest at the top, in marks nobody can read
      var y = SH * 0.08, row = 0, fontA = '"IM Fell English", Georgia, serif', fontB = '"EB Garamond", Georgia, serif', ni = 0;
      while (y < nameBox.y0 - 8) {
        var t = y / nameBox.y0, x = SW * 0.07 + rr() * 14, fs = Math.round(lerp(9, 13, t) + rr() * 3), light = 0.35 + t * 0.5;
        while (x < SW * 0.93) {
          if (t < 0.3) { x += glyphs(g, x, y - fs * 0.45, 2 + Math.floor(rr() * 4), fs * 0.9, light) + 10 + rr() * 12; continue; }
          var nm = NAMES[ni++ % NAMES.length] + (rr() < 0.22 ? ' ' + YEARS[Math.floor(rr() * YEARS.length)] : ''), w = nm.length * fs * 0.62, font = rr() < 0.5 ? fontA : fontB, rot = (rr() - 0.5) * 0.08;
          if (x + w > SW * 0.95) break;
          engrave(g, nm, x + w / 2, y, fs, font, light, rot);
          LIT.push({ t: nm, x: x + w / 2, y: y, fs: fs, font: font, rot: rot });
          x += w + 8 + rr() * 14;
        }
        y += lerp(15, 21, t) + rr() * 4; row++;
      }
      // the newest one, freshly cut: pale stone inside the letters, in a hand you would know anywhere
      g.save(); g.translate(SW / 2, nameY); g.rotate(-0.025); g.font = nameFs + 'px "IM Fell English", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if ('letterSpacing' in g) g.letterSpacing = Math.round(nameFs * 0.12) + 'px';
      g.fillStyle = 'rgba(4,2,6,.8)'; g.fillText(il.name || 'EDDA MARLOW', -1, -0.8); g.fillStyle = 'rgba(236,222,204,.92)'; g.fillText(il.name || 'EDDA MARLOW', 0, 0);
      g.restore();
      // the rim of the slab: lit where it faces the lantern, dark where it turns away
      var rim = g.createLinearGradient(0, 0, SW, SH); rim.addColorStop(0, 'rgba(255,214,170,.42)'); rim.addColorStop(0.45, 'rgba(120,90,80,.1)'); rim.addColorStop(1, 'rgba(0,0,0,.7)');
      shape(g); g.strokeStyle = rim; g.lineWidth = 7; g.stroke();
      g.restore();
      // and the same name once more in gold, for the moment it is read
      var q2 = gold.g; q2.save(); q2.translate(SW / 2, nameY); q2.rotate(-0.025); q2.font = nameFs + 'px "IM Fell English", Georgia, serif'; q2.textAlign = 'center'; q2.textBaseline = 'middle';
      if ('letterSpacing' in q2) q2.letterSpacing = Math.round(nameFs * 0.12) + 'px';
      q2.shadowColor = 'rgba(255,190,90,.9)'; q2.shadowBlur = 14; q2.fillStyle = '#F6D27C'; q2.fillText(il.name || 'EDDA MARLOW', 0, 0); q2.shadowBlur = 0; q2.fillStyle = '#FFF1C8'; q2.fillText(il.name || 'EDDA MARLOW', 0, 0); q2.restore();
      // a lip of rough rock
      g.save(); shape(g); g.strokeStyle = 'rgba(8,5,10,.85)'; g.lineWidth = 2; g.stroke(); g.restore();
    }
    function drawDust() {
      var g = dustC.g; g.save(); shape(g); g.clip();
      g.fillStyle = 'rgba(128,110,96,.97)'; g.fillRect(0, 0, SW, SH);
      var cols = [[160, 142, 122], [110, 94, 84], [176, 160, 138]];
      for (var k = 0; k < 44; k++) { var r = rand(0.1, 0.28) * SW; g.globalAlpha = rand(0.25, 0.6); g.drawImage(puff(cols[k % 3]), rand(-0.1, 1.1) * SW - r, rand(-0.1, 1.1) * SH - r, r * 2, r * 2); }
      g.globalAlpha = 1;
      for (k = 0; k < 900; k++) { g.fillStyle = k % 2 ? 'rgba(70,58,50,.35)' : 'rgba(210,196,176,.35)'; g.fillRect(rnd() * SW, rnd() * SH, 1.6, 1.6); }
      var rim = g.createRadialGradient(SW / 2, SH / 2, Math.min(SW, SH) * 0.3, SW / 2, SH / 2, Math.max(SW, SH) * 0.62); rim.addColorStop(0, 'rgba(40,30,34,0)'); rim.addColorStop(1, 'rgba(40,30,34,.55)');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = rim; g.fillRect(0, 0, SW, SH); g.globalCompositeOperation = 'source-over';
      g.restore();
    }
    var tex = new Image(); tex.src = 'img/worn.webp';
    drawDust();
    Promise.all([fontsReady(['30px "IM Fell English"', '16px "EB Garamond"']), tex.decode ? tex.decode().catch(function () {}) : Promise.resolve()]).then(function () { if (!S.dead) drawStone(); });
    // the brush: bristle streaks that follow the stroke
    var BW = Math.round(Math.max(64, SW * 0.25)), BH = Math.round(BW * 0.5), brush = offscreen(BW, BH, RES);
    (function () {
      var g = brush.g, bs = seeded(77);
      var gr = g.createRadialGradient(BW / 2, BH / 2, 0, BW / 2, BH / 2, BW / 2); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.translate(BW / 2, BH / 2); g.scale(1, BH / BW); g.translate(-BW / 2, -BH / 2); g.fillStyle = gr; g.fillRect(0, 0, BW, BW); g.restore();
      for (var k = 0; k < 26; k++) { var y = BH * (0.12 + bs() * 0.76), x0 = BW * (0.05 + bs() * 0.2), x1 = BW * (0.75 + bs() * 0.2); g.strokeStyle = 'rgba(0,0,0,' + (0.25 + bs() * 0.5).toFixed(2) + ')'; g.lineWidth = 1 + bs() * 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    })();
    var CELL = 12, GX = Math.ceil(SW / CELL), GY = Math.ceil(SH / CELL), grid = new Uint8Array(GX * GY), nOn = 0, nIn = 0, nameOn = 0, nameN = 0;
    var inShape = new Uint8Array(GX * GY);
    (function () { // which cells are rock, and which hold her name
      var probe = offscreen(4, 4, 1).g; shape(probe);
      for (var gy = 0; gy < GY; gy++) for (var gx = 0; gx < GX; gx++) {
        var x = (gx + 0.5) * CELL, y = (gy + 0.5) * CELL, k = gy * GX + gx;
        if (probe.isPointInPath(x, y)) { inShape[k] = 1; nIn++; if (x > nameBox.x0 && x < nameBox.x1 && y > nameBox.y0 && y < nameBox.y1) { inShape[k] = 2; nameN++; } }
      }
    })();
    function mark(x, y) {
      var r = BW * 0.36, x0 = Math.max(0, Math.floor((x - r) / CELL)), x1 = Math.min(GX - 1, Math.floor((x + r) / CELL)), y0 = Math.max(0, Math.floor((y - r) / CELL)), y1 = Math.min(GY - 1, Math.floor((y + r) / CELL));
      for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) { var k = gy * GX + gx, cx = (gx + 0.5) * CELL - x, cy = (gy + 0.5) * CELL - y; if (inShape[k] && !grid[k] && cx * cx + cy * cy <= r * r) { grid[k] = 1; nOn++; if (inShape[k] === 2) nameOn++; } }
    }
    var P = [], ptr = null, lastP = null, lastSnd = 0, ang = 0, done = false, strokes = 0;
    function sweep(x, y, a) {
      var g = dustC.g; g.save(); g.globalCompositeOperation = 'destination-out'; g.translate(x, y); g.rotate(a); g.drawImage(brush.c, -BW / 2, -BH / 2, BW, BH); g.restore();
      mark(x, y);
      if (P.length < 90 && rnd() < 0.55) P.push({ x: x + rand(-BW * 0.3, BW * 0.3), y: y + rand(-6, 6), vx: rand(-20, 20), vy: rand(-30, 10), life: 0, max: rand(600, 1100), r: rand(0.8, 2) });
    }
    function brushTo(p, now) {
      if (!lastP) { lastP = p; sweep(p.x, p.y, ang); return; }
      var dx = p.x - lastP.x, dy = p.y - lastP.y, d = Math.hypot(dx, dy); if (d < 1.5) return;
      ang = Math.atan2(dy, dx); var n = Math.min(10, Math.ceil(d / (BW * 0.22)));
      for (var k = 1; k <= n; k++) sweep(lastP.x + dx * k / n, lastP.y + dy * k / n, ang);
      lastP = p; strokes++;
      if (now - lastSnd > 300) { lastSnd = now; ctx.sfx('brush', { gain: clamp(0.5 + d / 60, 0.5, 1), pan: (p.x / SW - 0.5) * 0.6 }); }
    }
    function progress() { return { all: nOn / Math.max(1, nIn), name: nameOn / Math.max(1, nameN) }; }
    root.addEventListener('pointerdown', function (e) { if (QK || done) return; var q = S.pt(e); ptr = { x: q.x - sx, y: q.y - sy }; lastP = null; S.unghost(); try { root.setPointerCapture(e.pointerId); } catch (x) {} S.wake(); e.preventDefault(); });
    root.addEventListener('pointermove', function (e) { if (!ptr) return; var q = S.pt(e); ptr = { x: q.x - sx, y: q.y - sy }; S.wake(); e.preventDefault(); });
    function up() { ptr = null; lastP = null; }
    root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
    S.tick = function (now, dt) {
      if (ptr && !done) { brushTo(ptr, now); var pr = progress(); if ((pr.name > 0.5 && pr.all > 0.14) || pr.all > 0.4) reveal(); }
      var g = parts.g; g.clearRect(0, 0, SW, SH);
      for (var k = P.length - 1; k >= 0; k--) {
        var q = P[k]; q.life += dt; if (q.life > q.max) { P.splice(k, 1); continue; }
        q.vy += 260 * dt / 1000; q.x += q.vx * dt / 1000; q.y += q.vy * dt / 1000;
        g.globalAlpha = 0.8 * (1 - q.life / q.max); g.fillStyle = '#d8c8b0'; g.fillRect(q.x, q.y, q.r * 2, q.r * 2);
      }
      g.globalAlpha = 1;
      return !!ptr || P.length > 0;
    };
    function reveal() {
      if (done) return; done = true; up(); S.unghost(); ctx.setPrompt('');
      dustC.c.classList.add('s2-gone'); ctx.sfx('brush', { gain: 1 });
      var k = QK ? 0.5 : 1, near = LIT.slice(-24).filter(function (n, i, a) { return i % Math.max(1, Math.floor(a.length / 6)) === 0; }).slice(-6);
      // the names above hers light up one by one, down the generations, until hers
      near.forEach(function (n, i) {
        S.later(function () {
          var sp = el('span', 's2-lit', names); sp.textContent = n.t;
          sp.style.cssText = 'left:' + n.x.toFixed(1) + 'px;top:' + n.y.toFixed(1) + 'px;font:' + n.fs + 'px ' + n.font + ';transform:translate(-50%,-50%) rotate(' + n.rot.toFixed(3) + 'rad)';
          if (i === 0) ctx.sfx('whisper', { gain: 0.3 });
        }, (220 + i * 150) * k);
      });
      var tg = (220 + near.length * 150 + 60) * k;
      S.later(function () { gold.c.classList.add('on'); ctx.sfx('relic', { gain: 0.55 }); }, tg);
      S.later(function () { room.classList.add('on'); }, tg + 650 * k);
      S.later(function () { fin(true); }, QK ? 1500 : tg + 1100);
    }
    function hint() { if (done || ptr) return false; var y = sy + nameY, x0 = sx + SW * 0.25, x1 = sx + SW * 0.75; S.ghost([[x0, y, 0], [x0, y, 0.95], [x1, y - 6, 0.95], [x0, y + 6, 0.95], [x1, y, 0.95], [x1, y, 0]], 1800); }
    function short() { // two sweeps of the brush over her name, then the dust lets go
      var k = 0; (function one() {
        if (S.dead || done) return;
        var y = nameY + (k ? nameFs * 0.3 : -nameFs * 0.3), dir = k % 2 ? -1 : 1; lastP = null;
        for (var s = 0; s <= 12; s++) brushTo({ x: SW / 2 + dir * (s / 12 - 0.5) * SW * 0.9, y: y + Math.sin(s) * 4 }, performance.now() + s * 40);
        S.wake(); if (++k < 2) S.later(one, 220); else S.later(reveal, 200);
      })();
    }
    if (QK) S.later(short, 350);
    function auto() { // the draught from the cave does it for you
      if (done) return; S.unghost();
      var k = 0, rows = [nameY - nameFs * 0.3, nameY + nameFs * 0.3, nameY - nameFs * 1.2, nameY + nameFs * 1.3, SH * 0.45, SH * 0.3, SH * 0.2];
      (function one() {
        if (S.dead || done) return;
        var y = rows[k % rows.length], dir = k % 2 ? -1 : 1; lastP = null;
        for (var s = 0; s <= 12; s++) brushTo({ x: SW / 2 + dir * (s / 12 - 0.5) * SW * 0.9, y: y + Math.sin(s) * 4 }, performance.now() + s * 40);
        S.wake(); k++;
        var pr = progress(); if ((pr.name > 0.6 && pr.all > 0.2) || pr.all > 0.5 || k > 12) { reveal(); return; }
        S.later(one, 260);
      })();
    }
    return { destroy: S.destroy, auto: auto, hint: hint, unhint: S.unghost };
  };

  /* ---------------- 5. The lantern procession: keep your finger on Marta's light (p17) ---------------- */
  SC.follow = function (ctx) {
    var S = stage(ctx, 's2-sc-follow'), A = S.A, root = S.root, il = ctx.il, fin = finisher(ctx, S), SH = !!ctx.short;
    var path = (il.path || []).map(function (q) { var m = ctx.mapPt(q[0], q[1]); return [m.x, m.y]; });
    var sm = sampler(path, 3), speed = sm.total / (il.seconds || 8.5), autoMul = SH ? (il.seconds || 7.2) / 1.3 : 1.4;
    var night = el('div', 's2-night', root);
    var d1 = ctx.mapPt(il.door[0], il.door[1]), d2 = ctx.mapPt(il.door[2], il.door[3]);
    var doorG = el('div', 's2-doorglow', root); doorG.style.cssText = 'left:' + d1.x + 'px;top:' + d1.y + 'px;width:' + (d2.x - d1.x) + 'px;height:' + (d2.y - d1.y) + 'px';
    var lant = el('div', 's2-lant', root, '<i class="s2-pool"></i><i class="s2-halo"></i><svg class="s2-lring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27"/></svg>' +
      '<svg class="s2-lamp" viewBox="0 0 20 30" aria-hidden="true"><defs><radialGradient id="s2lg' + (++uid) + '" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#FFF6D6"/><stop offset=".5" stop-color="#FFD27A"/><stop offset="1" stop-color="#E08A2E"/></radialGradient></defs>' +
      '<path d="M10 1.2a2.4 2.4 0 0 1 2.4 2.4" fill="none" stroke="#C8903A" stroke-width="1.2"/><path d="M5 7h10l-2-3H7z" fill="#6b4a22"/><rect x="5" y="7" width="10" height="15" rx="1.5" fill="url(#s2lg' + uid + ')"/>' +
      '<path d="M7.5 7v15M12.5 7v15" stroke="rgba(90,56,20,.7)" stroke-width=".9"/><path d="M4 22h12l-1.5 3h-9z" fill="#5a3c1a"/></svg>');
    var pos = 0, held = false, lost = false, auto = false, done = false, ptr = null, stepAt = 0, stepN = 0, everHeld = false, lastPrompt = '';
    var ringC = lant.querySelector('.s2-lring circle'); lant.classList.add('s2-wait');
    function place(p) { lant.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)'; }
    var p0 = at(sm, 0); place(p0);
    lant.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, fill: 'backwards' });
    function setPrompt(t) { if (t !== lastPrompt) { lastPrompt = t; ctx.setPrompt(t); } }
    root.addEventListener('pointerdown', function (e) { if (SH || done) return; ptr = S.pt(e); unhint(); try { root.setPointerCapture(e.pointerId); } catch (x) {} S.wake(); e.preventDefault(); });
    root.addEventListener('pointermove', function (e) { if (!ptr) return; ptr = S.pt(e); S.wake(); e.preventDefault(); });
    function up() { ptr = null; S.wake(); }
    root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
    var HOLD = 58;
    S.tick = function (now, dt) {
      if (done) return false;
      var cur = at(sm, pos), near = ptr && Math.hypot(ptr.x - cur[0], ptr.y - cur[1] + 6) < (held ? HOLD * 1.25 : HOLD);
      if (near !== held) {
        held = near; lant.classList.toggle('s2-held', held); lant.classList.toggle('s2-wait', !held);
        if (held) { everHeld = true; if (lost) { lost = false; setPrompt(ctx.L(il.prompt)); } }
        else if (everHeld && !auto) { lost = true; setPrompt(ctx.L(il.keep)); }
      }
      if (held || auto) {
        pos = Math.min(sm.total, pos + speed * (held ? 1 : autoMul) * dt / 1000);
        var p = at(sm, pos); place(p);
        var f = pos / sm.total; ringC.style.strokeDashoffset = (170 * (1 - f)).toFixed(1);
        doorG.style.opacity = (0.25 + 0.55 * f).toFixed(3);
        if (now - stepAt > (SH ? 320 : 560)) { stepAt = now; stepN++; ctx.sfx('step', { gain: 0.28, pan: stepN % 2 ? -0.15 : 0.15 }); }
        if (pos >= sm.total) { arrive(); return false; }
      }
      return !!ptr || auto;
    };
    function arrive() {
      done = true; S.unghost(); setPrompt('');
      lant.classList.add('s2-in'); doorG.classList.add('s2-flare'); doorG.style.opacity = '1';
      ctx.sfx('sparkle', { gain: 0.6 }); ctx.sfx('whisper', { gain: 0.3 });
      var c = at(sm, sm.total); S.later(function () { if (ctx.FX) ctx.FX.sparkle(root, c[0], c[1] - 20, { n: 20, spread: 60 }); }, 250);
      S.later(function () { fin(true); }, SH ? 700 : 1100);
    }
    function hint() { // her light calls, and a fingertip shows how to take it along (no words)
      if (done || auto || (held && ptr)) return false;
      var c = at(sm, pos), n = at(sm, Math.min(sm.total, pos + 60));
      S.ghost([[c[0] + 30, c[1] + 40, 0], [c[0], c[1], 0.95], [c[0], c[1], 0.95, 0.85], [n[0], n[1], 0.95, 0.85], [n[0], n[1], 0]], 2000);
      lant.classList.add('s2-call');
    }
    function unhint() { S.unghost(); lant.classList.remove('s2-call'); }
    function goAuto() { if (done) return; auto = true; unhint(); lant.classList.remove('s2-wait'); setPrompt(ctx.L(il.prompt)); S.wake(); }
    if (SH) S.later(goAuto, 250);
    return { destroy: S.destroy, auto: goAuto, hint: hint, unhint: unhint };
  };

  /* ---------------- 6. The stairway into the fog: tap in step, climb, and stop counting (p22) ---------------- */
  function stairs(host, il) {
    var d = el('div', 's2-stairs s2-pre', host), im = el('img', '', d);
    im.alt = ''; im.decoding = 'async'; im.src = 'img/' + (il.img || 'stairs') + '.webp'; im.style.objectPosition = il.focus || '50% 45%';
    var show = function () { d.classList.add('on'); };
    if (im.decode) im.decode().then(show, show); else im.onload = show;
    return d;
  }
  SC.climb = function (ctx) {
    var S = stage(ctx, 's2-sc-climb'), A = S.A, root = S.root, il = ctx.il, fin = finisher(ctx, S), host = ctx.host, SH = !!ctx.short;
    var st = host.querySelector('.s2-stairs') || stairs(host, il); st.classList.remove('s2-pre');
    host.insertBefore(st, root); // the stairway stays behind the fog
    var fogC = canvas(root, 's2-fogc', A.W, A.H, RES), g = fogC.g;
    var vig = el('div', 's2-vig', root); // the dark closing in from the edges
    var count = el('div', 's2-count', root, '<b>0</b><i></i>'), num = count.firstChild, words = count.lastChild;
    count.style.top = Math.round(A.top + A.h * 0.2) + 'px';
    var beat = el('i', 's2-beat', root); beat.style.left = Math.round(A.W / 2) + 'px'; beat.style.top = Math.round(A.top + A.h * 0.74) + 'px';
    var CHECK = il.checks || [21, 140, 380, 640, 900], N = CHECK.length;
    var puffs = [], i, cols = [[82, 76, 112], [62, 58, 92], [104, 98, 132]]; // a night fog: grey-violet, never white
    for (i = 0; i < 18; i++) {
      var side = i % 3; // the fog closes in from below and from the sides first
      puffs.push({ x: side === 0 ? rand(0, A.W) : side === 1 ? rand(-0.2, 0.15) * A.W : rand(0.85, 1.2) * A.W, y: side === 0 ? rand(0.75, 1.1) * A.H : rand(0.2, 1) * A.H, r: rand(0.35, 0.6) * A.H * 0.7, s: puff(cols[i % 3]), p: rand(0, 6.28), v: rand(0.6, 1.4) });
    }
    var fogDt = 99, step = 0, shown = 0, from = 0, to = 0, t0 = 0, dens = 0.08, target = 0.08, done = false, busy = 0;
    function draw(now) {
      g.clearRect(0, 0, A.W, A.H);
      var cx = A.W / 2, cy = A.top + A.h * 0.45;
      for (var k = 0; k < puffs.length; k++) {
        var q = puffs[k], m = clamp(dens * 0.9, 0, 0.92), x = lerp(q.x, cx + (q.x - cx) * 0.25, m) + Math.sin(now / 2600 * q.v + q.p) * 18, y = lerp(q.y, cy + (q.y - cy) * 0.3, m) + Math.cos(now / 3100 * q.v + q.p) * 10, r = q.r * (0.8 + dens * 0.7);
        g.globalAlpha = clamp(0.26 + dens * 0.5, 0, 0.8); g.drawImage(q.s, x - r, y - r, r * 2, r * 2);
      }
      var base = clamp(dens * dens * 0.55, 0, 0.6);
      if (base > 0.004) { g.globalAlpha = 1; g.fillStyle = 'rgba(16,13,30,' + base.toFixed(3) + ')'; g.fillRect(0, 0, A.W, A.H); }
      g.globalAlpha = 1;
    }
    function roll(now) {
      if (shown === to) return false;
      var t = clamp((now - t0) / 520, 0, 1), v = Math.round(lerp(from, to, easeOut(t)));
      if (v !== shown) { shown = v; num.textContent = v; }
      return true;
    }
    function now() { return performance.now(); }
    function climb(x, y) { // one tap = one step: your foot comes down, a flight of stairs goes by
      if (done || step >= N || now() - busy < 230) return false;
      busy = now(); S.unghost(); beat.classList.remove('s2-call');
      from = shown; to = CHECK[step]; t0 = now(); step++;
      var f = step / N;
      st.style.transform = 'translate3d(0,' + (f * 8.5).toFixed(2) + '%,0) scale(' + (1 + f * 0.34).toFixed(3) + ')';
      target = 0.08 + Math.pow(f, 1.5) * 0.8;
      vig.style.opacity = (0.35 + f * 0.6).toFixed(2);
      count.classList.add('on');
      root.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-5px)' }, { transform: 'translateY(0)' }], { duration: 360, easing: 'ease-out' });
      if (x != null) { var r = el('i', 's2-tapr', root); r.style.left = x + 'px'; r.style.top = y + 'px'; S.later(function () { r.remove(); }, 700); }
      ctx.sfx('step', { gain: 0.8, pan: step % 2 ? -0.2 : 0.2 });
      if (step === 3) ctx.sfx('wind', { gain: 0.45 });
      if (step === N) S.later(stopCounting, SH ? 250 : 300);
      S.wake(); return true;
    }
    function stopCounting() {
      done = true; ctx.setPrompt(''); beat.classList.remove('on', 's2-call');
      words.textContent = ctx.L(il.stop); count.classList.add('s2-stop');
      ctx.sfx('fogin', { gain: 0.7 });
      var k = SH ? 0.5 : 1;
      S.later(function () { target = 1; vig.style.opacity = '1'; count.classList.add('s2-fade'); S.wake(); }, 700 * k);
      S.later(function () { st.classList.add('s2-gone'); }, 1000 * k);
      S.later(function () { fogC.c.classList.add('s2-gone'); vig.classList.add('s2-gone'); ctx.sfx('wind', { gain: 0.3 }); }, 1450 * k);
      S.later(function () { fin(true); }, SH ? 1100 : 1800);
    }
    // the fog canvas is only redrawn while it changes (climbing, rolling numbers, closing in); at rest it lies
    // still and a slow CSS drift of the whole layer keeps it alive
    S.tick = function (t, dt) {
      dens += (target - dens) * Math.min(1, dt / 450);
      var rolling = roll(t); fogDt += dt; if (fogDt >= 30) { draw(t); fogDt = 0; }
      return rolling || Math.abs(target - dens) > 0.003;
    };
    root.addEventListener('pointerdown', function (e) { if (SH || done) return; var q = S.pt(e); climb(q.x, q.y); e.preventDefault(); });
    // the rhythm to tap along with: a soft beat where your feet are, until you take the first step
    if (!SH) { beat.classList.add('on'); }
    function hint() { // a fingertip tapping in step, twice
      if (done || step >= N) return false;
      var x = A.W / 2, y = A.top + A.h * 0.74;
      beat.classList.add('s2-call');
      S.ghost([[x, y, 0], [x, y, 0.95, 1], [x, y, 0.95, 0.8], [x, y, 0.95, 1], [x, y, 0.95, 0.8], [x, y, 0]], 1300);
    }
    function unhint() { S.unghost(); beat.classList.remove('s2-call'); }
    function auto() { if (done) return; unhint(); (function one() { if (S.dead || done) return; busy = 0; climb(); if (step < N) S.later(one, SH ? 150 : 520); })(); }
    if (SH) S.later(auto, 250);
    S.wake();
    var destroy = S.destroy;
    S.destroy = function () { destroy(); st.classList.add('s2-out'); setTimeout(function () { st.remove(); }, 700); };
    return { destroy: S.destroy, auto: auto, hint: hint, unhint: unhint };
  };
  SC.climb.pre = function (host, il) { stairs(host, il); }; // the stairway shows while the captions are written

  /* ---------------- the six interludes ---------------- */
  IL[1] = { type: 'letter',
    lines: { en: ['The letter in your coat is three weeks old.', 'You know it by heart. You read it again anyway.'],
             nl: ['De brief in je jas is drie weken oud.', 'Je kent hem uit je hoofd, maar je leest hem nog een keer.'] },
    prompt: { en: 'Unfold the letter', nl: 'Vouw de brief open' },
    done: { en: 'Signed: Edda Marlow. You followed her anyway.', nl: 'Getekend: Edda Marlow. Je bent haar toch gevolgd.' },
    text: { en: ['The mountain is hollow.', 'Don’t follow me.'], nl: ['De berg is hol.', 'Volg me niet.'] }, sign: 'Edda Marlow',
    addr: { en: 'To my apprentice', nl: 'Aan mijn leerling' } };
  IL[6] = { type: 'knock', knocks: 3, zoom: [74, 50],
    lines: { en: ['Everyone in Low Veyra smiles at you.', 'The inn has a heavy oak door, with light behind it.'],
             nl: ['Iedereen in Laag-Veyra glimlacht naar je.', 'Achter de zware eikenhouten deur van de herberg brandt licht.'] },
    prompt: { en: 'Knock three times', nl: 'Klop drie keer' },
    done: { en: '“My last room,” says Marta. “Stay as long as you like.”', nl: '“Mijn laatste kamer,” zegt Marta. “Blijf zo lang als je wilt.”' } };
  IL[12] = { type: 'inkmap',
    lines: { en: ['Halfway up the valley, under the moon.', 'The blank map feels warm in your hand.'],
             nl: ['Halverwege de klim, onder de maan.', 'De blanco kaart voelt warm aan in je hand.'] },
    prompt: { en: 'Trace her line', nl: 'Trek haar lijn na' },
    done: { en: 'One word, in her hand: Safe. The ink is still wet.', nl: 'Eén woord, in haar handschrift: Veilig. De inkt is nog nat.' },
    word: { en: 'Safe', nl: 'Veilig' }, village: { en: 'Low Veyra', nl: 'Laag-Veyra' } };
  IL[16] = { type: 'dust', name: 'EDDA MARLOW',
    lines: { en: ['Warm air breathes out of the cave.', 'Just inside, the rock has been worn smooth by hands.'],
             nl: ['De grot ademt warme lucht uit.', 'Vlak achter de ingang is de rots door handen gladgesleten.'] },
    prompt: { en: 'Brush away the dust', nl: 'Veeg het stof weg' },
    done: { en: 'The newest name is hers. Below it, room for one more.', nl: 'De nieuwste naam is die van haar. Eronder is plek voor nog één.' } };
  IL[17] = { type: 'follow', seconds: 4.3,
    path: [[44, 72], [47, 68], [52, 65], [56, 62], [61, 59], [65, 56], [63, 52.5], [57, 51], [50, 49], [44, 47], [42, 45], [46, 43], [51, 42], [56, 41.2], [61.5, 41]],
    door: [58.6, 26.4, 67.4, 43],
    lines: { en: ['The sleepers walk up the valley without a word.', 'Marta is the last in line.'],
             nl: ['Zwijgend lopen de slapers het dal op.', 'Marta loopt als laatste.'] },
    prompt: { en: 'Follow her light', nl: 'Volg haar licht' },
    keep: { en: 'Keep your finger on her lantern', nl: 'Houd je vinger op haar lantaarn' },
    done: { en: 'Where there was only rock this afternoon, a door is glowing.', nl: 'Waar vanmiddag alleen rots was, gloeit nu een deur.' } };
  IL[22] = { type: 'climb', img: 'stairs', focus: '50% 45%', beforeMoment: true,
    lines: { en: ['The old stairway climbs into the fog.', 'You count the steps. Everyone does.'],
             nl: ['De oude trap klimt de mist in.', 'Je telt de treden. Dat doet iedereen.'] },
    prompt: { en: 'Tap in step with your feet', nl: 'Tik mee met je voetstappen' },
    stop: { en: 'You stop counting.', nl: 'Je stopt met tellen.' },
    done: { en: 'At the top: a ruined monastery. And a bell.', nl: 'Boven: een klooster in puin. En een klok.' } };

  /* ---------------- the bridge to timed moments ----------------
     Page 22 is a timed moment: app.js opens the moment screen straight away, and runScene only plays in the
     reader. So on the first visit (a fresh page whose scene has not played) the reader is shown first, the scene
     plays, and the moment follows. A two-line change in app.js can replace this (see the v4.5 report). */
  var bridged = null, returned = null, blog = SC._bridgeLog = [], push = blog.push;
  blog.push = function (x) { push.call(blog, x); if (blog.length > 24) blog.shift(); };
  function takeBridge(p) { // only the scene played for this bridge hands back to the moment
    var ok = !!(bridged && bridged.p === p && performance.now() - bridged.t < 60000);
    if (bridged && bridged.p === p) bridged = null;
    blog.push(['take', p, ok]); return ok;
  }
  function backToMoment(p) { // after the closing line has been read, whether or not the book has started to rise
    var W = window.__wayward, t0 = performance.now();
    var iv = setInterval(function () {
      var dt = performance.now() - t0;
      if (!W || W.current() !== 'reader' || W.R.p !== p || dt > 8000) { clearInterval(iv); blog.push(['back:gave-up', p, Math.round(dt)]); return; }
      if (dt >= 1850) { clearInterval(iv); blog.push(['back', p, Math.round(dt), W.R.mode]); returned = { p: p, t: performance.now() }; W.show('moment'); }
    }, 100);
  }
  function initBridge() {
    var W = window.__wayward, mom = document.getElementById('moment'), tome = document.getElementById('tome'), host = document.getElementById('ilHost');
    if (!W) return;
    if (mom && window.MutationObserver) new MutationObserver(function () {
      if (mom.hidden || W.current() !== 'moment') return;
      W.R.arrived = false; // the timed moment is this visit's scene: reading the page as text afterwards plays no short scene
      var st = W.st(), p = st.page, il = IL[p];
      if (!il || !il.beforeMoment || !SC[il.type]) return;
      var again = (st.scenes || []).indexOf(p) > -1 || !W.R.fresh, first = !!(W.prefs && W.prefs().firstRead);
      if (again && !first) return; // a later visit goes straight to the moment, unless the reader asked to read as if for the first time
      if (returned && returned.p === p && performance.now() - returned.t < 20000) return; // just came back from this scene
      bridged = { p: p, t: performance.now() }; blog.push(['bridge', p, again]);
      if (again) W.R.forceScene = p;
      W.show('reader');
    }).observe(mom, { attributes: true, attributeFilter: ['hidden'] });
    // a prelude: a scene type can put its backdrop up while the captions are still being written
    var wasScene = false;
    if (tome && host && window.MutationObserver) new MutationObserver(function () {
      var on = tome.classList.contains('scene') && W.R.mode === 'scene';
      if (on && !wasScene) { var il = IL[W.R.p]; if (il && SC[il.type] && SC[il.type].pre && !host.querySelector('.s2-pre')) SC[il.type].pre(host, il); }
      wasScene = on;
    }).observe(tome, { attributes: true, attributeFilter: ['class'] });
    // (the p22 moment fog is now stopped by app.js itself when the moment ends)

  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBridge); else setTimeout(initBridge, 0);

  /* ---------------- styles ---------------- */
  var css = [
    '.s2{position:absolute;inset:0;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;transition:opacity .6s ease}',
    '.s2.s2-out,.s2-stairs.s2-out{opacity:0}',
    '.s2 canvas{position:absolute;left:0;top:0;pointer-events:none}',
    '.s2-ghost{position:absolute;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;opacity:0;z-index:30;background:radial-gradient(circle,rgba(255,250,232,.95) 0 20%,rgba(255,228,168,.5) 34%,rgba(255,214,140,0) 70%);box-shadow:0 0 0 2px rgba(246,210,124,.5)}',
    /* letter */
    '.s2-letter{position:absolute;perspective:680px;will-change:transform}',
    '.s2-lsh{position:absolute;left:6%;right:6%;top:4%;bottom:-4%;border-radius:50%;background:radial-gradient(closest-side,rgba(6,3,14,.6),rgba(6,3,14,0));transform-origin:50% 50%;transition:transform .2s linear}',
    '.s2-pn{position:absolute;left:0;width:100%;background:url(img/page-2.webp) 0 0/100% 300% no-repeat;box-shadow:0 1px 0 rgba(255,244,220,.4) inset,0 8px 22px rgba(10,4,20,.35);will-change:transform}',
    '.s2-mid{z-index:1;background-position:0 50%}',
    '.s2-bot{z-index:2;background-position:0 100%;transform-origin:50% 0}',
    '.s2-top{z-index:3;background-position:0 0;transform-origin:50% 100%}',
    '.s2-mid::before,.s2-mid::after{content:"";position:absolute;left:0;right:0;height:4px;background:linear-gradient(rgba(110,70,30,.28),rgba(255,248,230,.5),rgba(110,70,30,0))}',
    '.s2-mid::before{top:-1px}.s2-mid::after{bottom:-2px;transform:scaleY(-1)}',
    '.s2-back{position:absolute;inset:0;background:linear-gradient(rgba(118,84,44,.18),rgba(118,84,44,.18)),url(img/page-back.webp) center/cover;opacity:0}',
    '.s2-top .s2-back{box-shadow:inset 0 -10px 18px rgba(70,40,10,.25)}',
    '.s2-bot .s2-back{background:linear-gradient(rgba(92,60,28,.34),rgba(92,60,28,.22)),url(img/page-back.webp) center/cover;box-shadow:inset 0 10px 16px rgba(60,32,8,.3)}',
    '.s2-shade{position:absolute;inset:0;background:linear-gradient(rgba(50,26,8,.55),rgba(50,26,8,.25));opacity:0;pointer-events:none}',
    '.s2-ink{position:absolute;left:0;right:0;padding:0 22px;white-space:nowrap;color:rgba(52,28,10,.92);font-family:"IM Fell English",Georgia,serif;font-style:italic;font-size:26px;line-height:1.1}',
    '.s2-hand{display:inline-block;text-shadow:0 0 .7px rgba(52,28,10,.6);transform:rotate(-1.6deg)}',
    '.s2-l2{margin-left:14%}',
    '.s2-ink .s2-sig{display:block;text-align:right;padding-right:6%;font-size:22px;color:rgba(52,28,10,.9);transform:rotate(-3deg)}',
    '.s2-flour{display:block;width:48%;height:14px;margin:0 3% 0 auto;fill:none;stroke:rgba(52,28,10,.75);stroke-width:1.4;stroke-linecap:round}',
    '.s2-blot{position:absolute;left:18%;top:26px;width:9px;height:7px;border-radius:50% 60% 45% 55%;background:rgba(52,28,10,.55);box-shadow:5px 3px 0 -2px rgba(52,28,10,.45)}',
    '.s2-seal{position:absolute;left:50%;top:-14px;width:40px;height:40px;margin-left:-20px;transform:rotate(12deg)}.s2-seal svg{width:100%;height:100%;display:block}',
    '.s2-addr{position:absolute;left:0;right:0;top:34%;text-align:center;font-family:"IM Fell English",Georgia,serif;font-style:italic;font-size:19px;color:rgba(60,34,14,.72);transform:scaleY(-1) rotate(-2deg)}',
    '.s2-glint{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:5}',
    '.s2-ember{position:absolute;left:0;top:0;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#FFE3A0;box-shadow:0 0 6px 2px rgba(255,170,70,.8);opacity:0;pointer-events:none}',
    '.s2-flame{position:absolute;left:0;top:0;width:20px;height:38px;margin:-38px 0 0 -10px;border-radius:50% 50% 45% 45%/62% 62% 38% 38%;background:radial-gradient(ellipse 50% 62% at 50% 72%,#FFFDF0 0,#FFE08A 30%,rgba(255,160,60,.75) 58%,rgba(255,120,40,0) 78%);box-shadow:0 0 18px 6px rgba(255,170,70,.45);transform-origin:50% 100%;opacity:0;pointer-events:none}',
    '.s2-draft{position:absolute;height:18px;margin-top:-9px;transform-origin:0 50%;border-radius:9px;background:linear-gradient(90deg,rgba(255,200,120,0),rgba(255,206,130,.4) 40%,rgba(255,190,110,.25) 80%,rgba(255,180,100,0));opacity:0;pointer-events:none}',
    '.s2-glint i{position:absolute;top:-20%;bottom:-20%;left:-40%;width:30%;background:linear-gradient(90deg,rgba(255,236,190,0),rgba(255,236,190,.42),rgba(255,236,190,0));transform:translateX(0) skewX(-18deg);animation:s2glint 1.3s .15s ease-in-out forwards}',
    '@keyframes s2glint{to{transform:translateX(560%) skewX(-18deg)}}',
    /* knock */
    '.s2-dim{position:absolute;inset:0;background:radial-gradient(ellipse 70% 55% at var(--dx) var(--dy),rgba(12,6,20,.25),rgba(8,4,16,.8));animation:s2fade .9s ease both;transition:opacity 1.2s ease}',
    '.s2-warm .s2-dim{opacity:.55}',
    '@keyframes s2fade{from{opacity:0}}',
    '.s2-door{position:absolute;perspective:900px;animation:s2doorin .9s cubic-bezier(.2,.8,.2,1) both}',
    '@keyframes s2doorin{from{opacity:0;transform:translateY(24px) scale(.94)}}',
    '.s2-frame{position:absolute}.s2-frame svg,.s2-leaf svg{display:block;width:100%;height:100%}',
    '.s2-inner{position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 50% 72%,#FFF0C8 0%,#FFC870 30%,#D8782A 62%,#5A2A0C 100%);opacity:0;transition:opacity 1.4s ease .2s}',
    '.s2-leak{position:absolute;inset:-3px -3px 0;background:#FFC878;box-shadow:0 0 16px 5px rgba(255,170,80,.75),0 6px 14px 2px rgba(255,170,80,.6);opacity:.12;transition:opacity .5s ease;overflow:hidden}',
    '.s2-feet{position:absolute;bottom:0;left:-30%;width:26%;height:30%;background:radial-gradient(closest-side,rgba(20,8,2,.9),rgba(20,8,2,0));opacity:0}',
    '.s2-feet.go{animation:s2feet 1.6s ease-in-out forwards}',
    '@keyframes s2feet{20%{opacity:1}80%{opacity:1}to{opacity:0;transform:translateX(420%)}}',
    '.s2-leaf{position:absolute;inset:0;transform-origin:0 50%;transition:transform 1.9s cubic-bezier(.36,.02,.2,1);will-change:transform}',
    '.s2-open .s2-leaf{transform:rotateY(80deg)}.s2-open .s2-inner{opacity:1}.s2-open .s2-leak{opacity:0!important;transition-duration:1.2s}',
    '.s2-knocker{transform-box:fill-box;transform-origin:50% 0}',
    '.s2-door::after{content:"";position:absolute;left:50%;top:48%;width:34%;height:20%;margin-left:-17%;border-radius:50%;box-shadow:0 0 0 2px rgba(246,210,124,.7),0 0 22px rgba(255,200,120,.6);opacity:0;pointer-events:none}',
    '.s2-door.s2-hint::after{animation:s2pulse 1.1s ease-in-out 3}',
    '@keyframes s2pulse{50%{opacity:1;transform:scale(1.12)}}',
    '.s2-spill{position:absolute;clip-path:polygon(30% 0,70% 0,100% 100%,0 100%);background:linear-gradient(rgba(255,206,130,.75),rgba(255,180,90,.32) 55%,rgba(255,170,80,0));opacity:0;transform:scaleY(.3);transform-origin:50% 0;transition:opacity 1.4s ease .4s,transform 1.6s cubic-bezier(.2,.7,.2,1) .4s}',
    '.s2-warm .s2-spill{opacity:1;transform:none}',
    '.s2-bloom{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(255,214,150,.5),rgba(255,180,100,.18) 55%,rgba(255,170,90,0));opacity:0;transform:scale(.5);transition:opacity 1.6s ease .5s,transform 2s cubic-bezier(.2,.7,.2,1) .5s;pointer-events:none}',
    '.s2-warm .s2-bloom{opacity:1;transform:none}',
    '.s2-dust{position:absolute;width:3px;height:3px;border-radius:50%;background:#e2d2b8;pointer-events:none;opacity:0}',
    '.s2-khit{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:2px solid rgba(255,214,150,.75);pointer-events:none;opacity:0}',
    /* map */
    '.s2-map{position:absolute;background:url(img/page-3.webp) center/100% 100% no-repeat;transform:rotate(-2deg);box-shadow:0 18px 44px rgba(4,2,16,.75),0 2px 6px rgba(8,4,20,.5);animation:s2mapin .9s cubic-bezier(.2,.8,.2,1) both;border-radius:3px}',
    '@keyframes s2mapin{from{opacity:0;transform:translateY(60px) rotate(-7deg) scale(.92)}}',
    '.s2-mapframe{position:absolute;inset:14px;border:1px solid rgba(90,54,24,.32);box-shadow:inset 0 0 0 3px rgba(255,248,230,.25),inset 0 0 0 4px rgba(90,54,24,.18)}',
    '.s2-mapink{position:absolute;left:0;top:0}',
    '.s2 .s2-mapfull{opacity:0;transition:opacity 1.3s ease}.s2 .s2-mapfull.on{opacity:1}',
    '.s2-warmth{position:absolute;left:0;top:0;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,196,110,.34),rgba(255,196,110,0));opacity:0;transition:opacity .35s ease;pointer-events:none}',
    '.s2-warmth.on{opacity:1}',
    '.s2-tip{position:absolute;left:0;top:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:radial-gradient(circle,#fff 0 25%,rgba(255,230,170,.85) 45%,rgba(255,210,130,0) 72%);box-shadow:0 0 12px 4px rgba(255,210,130,.55);opacity:0;transition:opacity .3s ease;pointer-events:none}',
    '.s2-tip.on{opacity:1}',
    '.s2-mapnight{background:radial-gradient(ellipse at 50% 46%,rgba(8,6,26,.12),rgba(6,4,20,.55))}',
    '.s2-tip.s2-wait{animation:s2tipcall 1.3s ease-in-out infinite}',
    '@keyframes s2tipcall{50%{box-shadow:0 0 18px 8px rgba(255,210,130,.75)}}',
    '.s2-moonlit{position:absolute;inset:0;pointer-events:none;border-radius:3px;background:radial-gradient(ellipse 78% 72% at 40% 36%,rgba(150,170,240,.07),rgba(34,40,92,.24) 58%,rgba(8,8,30,.7) 100%)}',
    /* dust */
    '.s2-slab{position:absolute;animation:s2fade .8s ease both}',
    '.s2-slab::before{content:"";position:absolute;inset:-18px;border-radius:40px;background:radial-gradient(closest-side,rgba(4,2,8,.55),rgba(4,2,8,0));pointer-events:none}',
    '.s2-slab::after{content:"";position:absolute;inset:6% -14% -12% 10%;z-index:-1;border-radius:50%;background:radial-gradient(closest-side,rgba(2,1,4,.72),rgba(2,1,4,0));pointer-events:none}',
    '.s2-names{position:absolute;inset:0;pointer-events:none}',
    '.s2-lit{position:absolute;white-space:nowrap;color:#FFD98A;text-shadow:0 0 6px rgba(255,176,80,.9),0 0 14px rgba(255,150,60,.55);opacity:0;animation:s2lit 1.4s ease-out forwards}',
    '@keyframes s2lit{25%{opacity:1}to{opacity:.4}}',
    '.s2-lamplight{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 70% 85% at -8% 58%,rgba(255,176,96,.32),rgba(255,160,80,.1) 55%,rgba(255,150,70,0) 80%);animation:s2lamp 3.1s ease-in-out infinite}',
    '@keyframes s2lamp{35%{opacity:.82}60%{opacity:1}80%{opacity:.9}}',
    '.s2-gold{opacity:0;transition:opacity 1.2s ease}.s2-gold.on{opacity:1;animation:s2breathe 2.4s ease-in-out .9s infinite}',
    '@keyframes s2breathe{50%{opacity:.72}}',
    '.s2-dustc{transition:opacity 1.1s ease}.s2-dustc.s2-gone{opacity:0}',
    '.s2-room{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(255,226,170,.3),rgba(255,226,170,0));opacity:0;pointer-events:none}',
    '.s2-room.on{animation:s2room 1.8s ease-in-out infinite}',
    '@keyframes s2room{50%{opacity:1;transform:scale(1.06)}}',
    /* follow */
    '.s2-night{position:absolute;inset:0;background:radial-gradient(ellipse at 55% 45%,rgba(10,6,28,.34),rgba(8,4,22,.72));animation:s2fade 1s ease both}',
    '.s2-doorglow{position:absolute;border-radius:3px;box-shadow:0 0 12px 3px rgba(255,200,110,.55),inset 0 0 10px 2px rgba(255,214,140,.5);opacity:.25;transition:opacity .4s ease}',
    '.s2-doorglow::before{content:"";position:absolute;inset:10% 16% 4%;background:radial-gradient(ellipse at 50% 72%,rgba(255,238,196,.8),rgba(255,214,140,.25) 55%,rgba(255,210,140,0) 75%);opacity:0;transition:opacity 1.1s ease}',
    '.s2-doorglow.s2-flare::before{opacity:1}',
    '.s2-doorglow::after{content:"";position:absolute;inset:-60%;border-radius:50%;background:radial-gradient(closest-side,rgba(255,226,160,.75),rgba(255,200,120,.25) 55%,rgba(255,190,110,0));opacity:0;transform:scale(.5);pointer-events:none}',
    '.s2-doorglow.s2-flare::after{animation:s2flare 1.6s ease-out forwards}',
    '@keyframes s2flare{35%{opacity:1;transform:scale(1.1)}to{opacity:.55;transform:scale(1)}}',
    '.s2-lant{position:absolute;left:0;top:0;width:0;height:0;will-change:transform}',
    '.s2-lant>*{position:absolute}',
    '.s2-halo{left:-105px;top:-112px;width:210px;height:210px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,232,170,.9),rgba(255,196,110,.42) 26%,rgba(255,176,90,.14) 58%,rgba(255,170,80,0));animation:s2flick 2.6s ease-in-out infinite}',
    '.s2-pool{left:-64px;top:4px;width:128px;height:40px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,200,120,.5),rgba(255,190,110,0))}',
    '@keyframes s2flick{30%{opacity:.86;transform:scale(.97)}60%{opacity:1;transform:scale(1.03)}}',
    '.s2-lamp{left:-11px;top:-24px;width:22px;height:33px}',
    '.s2-lring{left:-32px;top:-38px;width:64px;height:64px;transform:rotate(-90deg);opacity:0;transition:opacity .3s ease}',
    '.s2-lring circle{fill:none;stroke:#FFE7A8;stroke-width:3;stroke-linecap:round;stroke-dasharray:170;stroke-dashoffset:170}',
    '.s2-held .s2-lring{opacity:1}',
    '.s2-wait .s2-halo,.s2-call .s2-halo{animation:s2call 1.2s ease-in-out infinite}',
    '@keyframes s2call{50%{transform:scale(1.25);opacity:.75}}',
    '.s2-lant.s2-in>*{transition:opacity .9s ease,transform .9s ease;opacity:0;transform:scale(.4)}',
    /* climb */
    '.s2-stairs{position:absolute;inset:0;overflow:hidden;opacity:0;transition:opacity .9s ease;transform-origin:50% 30%;will-change:transform}',
    '.s2-stairs.on{opacity:1;transition:opacity .9s ease,transform .75s cubic-bezier(.2,.7,.3,1)}',
    '.s2-stairs.s2-gone{opacity:0;transition:opacity 1.2s ease}',
    '.s2-stairs img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
    '.s2-stairs::after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(10,8,26,.22),rgba(10,8,26,.5))}',
    '.s2-fogc{transition:opacity 1.3s ease;animation:s2drift 11s ease-in-out infinite alternate;will-change:transform}.s2-fogc.s2-gone{opacity:0}',
    '@keyframes s2drift{from{transform:translate3d(-10px,4px,0) scale(1.04)}to{transform:translate3d(12px,-6px,0) scale(1.07)}}',
    '.s2-count{position:absolute;left:0;right:0;text-align:center;pointer-events:none;opacity:0;transition:opacity .5s ease}',
    '.s2-count.on{opacity:1}',
    '.s2-count b{display:block;font-family:"IM Fell English",Georgia,serif;font-weight:400;font-size:68px;line-height:1;color:#F6D27C;text-shadow:0 0 3px rgba(0,0,0,.95),0 0 16px rgba(4,2,12,.9),0 0 34px rgba(4,2,12,.7);font-variant-numeric:tabular-nums;transition:opacity .9s ease}',
    '.s2-count i{display:block;margin-top:10px;font-family:"EB Garamond",Georgia,serif;font-style:italic;font-size:21px;color:#EADFC8;text-shadow:0 0 3px rgba(0,0,0,.95),0 0 14px rgba(4,2,12,.9);opacity:0;transition:opacity .8s ease}',
    '.s2-count.s2-stop b{opacity:.35}.s2-count.s2-stop i{opacity:1}',
    '.s2-count.s2-fade{opacity:0!important;transition:opacity 1.2s ease}',
    '.s2-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 72% 62% at 50% 40%,rgba(6,4,14,0) 30%,rgba(6,4,14,.62) 72%,rgba(4,2,10,.94) 100%);opacity:.35;transition:opacity .6s ease}.s2-vig.s2-gone{opacity:0!important;transition:opacity 1.2s ease}',
    '.s2-beat{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:2px solid rgba(246,210,124,.55);box-shadow:0 0 14px rgba(246,210,124,.35);opacity:0;pointer-events:none;transition:opacity .4s ease}',
    '.s2-beat.on{animation:s2beat .62s ease-out infinite}',
    '.s2-beat.s2-call{animation-duration:.52s}',
    '@keyframes s2beat{0%{opacity:.85;transform:scale(.55)}70%{opacity:.18}to{opacity:0;transform:scale(1.25)}}',
    '.s2-tapr{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid rgba(246,210,124,.7);pointer-events:none;animation:s2tapr .6s ease-out forwards}',
    '@keyframes s2tapr{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(1.5)}}'
  ].join('\n');
  var styleEl = document.createElement('style'); styleEl.id = 'scenes2-css'; styleEl.textContent = css; (document.head || document.documentElement).appendChild(styleEl);
})();
