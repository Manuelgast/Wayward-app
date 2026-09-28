/* Wayward page curl: a flat-fold page turn (the corner is lifted and folded over along the perpendicular
   bisector between the corner and the finger), with the paper's back, fold highlight and cast shadows.
   Built to stay smooth on slow phones: the folded-over back is the page itself mirrored with a CSS matrix
   (a transform, so the GPU moves it without repainting), and every shadow and highlight is a fixed gradient
   strip that is only moved and stretched with transforms. Per frame only two clip polygons change. */
(function () {
  'use strict';
  function clipHalf(poly, M, n, keepPos) { // Sutherland–Hodgman against the line through M with normal n
    var out = [], i, s = keepPos ? 1 : -1;
    function side(p) { return s * ((p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1]); }
    for (i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length], da = side(a), db = side(b);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) { var t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  function poly(pts) { return 'polygon(' + pts.map(function (p) { return p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px'; }).join(',') + ')'; }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  var NONE = 'polygon(0 0,0 0,0 0)';
  function strip(parent, cls) { var s = document.createElement('i'); s.className = 'curl-strip ' + cls; parent.appendChild(s); return s; }
  function place(el, M, ang, len) { // strip starts on the fold line and runs `len` px along direction `ang`
    el.style.transform = 'translate(' + M[0].toFixed(1) + 'px,' + M[1].toFixed(1) + 'px) rotate(' + ang.toFixed(4) + 'rad) scaleX(' + (Math.max(0.01, len) / 100).toFixed(3) + ') translateY(-50%)';
  }

  function create(pages, top, under, opts) {
    opts = opts || {};
    var flap = document.createElement('div'); flap.className = 'curl-flap';
    var ushade = document.createElement('div'); ushade.className = 'curl-ushade';
    var tshade = document.createElement('div'); tshade.className = 'curl-tshade';
    var fS = strip(flap, 'fold'), uS = strip(ushade, 'cast'), tS = strip(tshade, 'lift');
    pages.appendChild(flap); under.appendChild(ushade); top.appendChild(tshade);
    var W = 0, H = 0, C = [0, 0], active = false, anim = 0, pend = null, praf = 0;
    function measure() { W = pages.clientWidth; H = pages.clientHeight; }
    function clampP(P, corner) {
      var S1 = corner === 'tr' ? [0, 0] : [0, H], S2 = corner === 'tr' ? [0, H] : [0, 0], R2 = Math.sqrt(W * W + H * H);
      var d = Math.hypot(P[0] - S1[0], P[1] - S1[1]); if (d > W) P = [S1[0] + (P[0] - S1[0]) * W / d, S1[1] + (P[1] - S1[1]) * W / d];
      d = Math.hypot(P[0] - S2[0], P[1] - S2[1]); if (d > R2) P = [S2[0] + (P[0] - S2[0]) * R2 / d, S2[1] + (P[1] - S2[1]) * R2 / d];
      return P;
    }
    function begin(corner) {
      cancelAnimationFrame(anim); cancelAnimationFrame(praf); praf = 0; pend = null; measure(); C = corner === 'tr' ? [W, 0] : [W, H]; active = corner;
      flap.style.width = W + 'px'; flap.style.height = H + 'px';
      flap.style.clipPath = flap.style.webkitClipPath = NONE;
      flap.style.display = 'block'; ushade.style.display = 'block'; tshade.style.display = 'block';
    }
    function apply(P) {
      if (!active) return;
      var dx = C[0] - P[0], dy = C[1] - P[1], len = Math.hypot(dx, dy);
      if (len < 0.5) { top.style.clipPath = top.style.webkitClipPath = ''; flap.style.clipPath = flap.style.webkitClipPath = NONE; ushade.style.opacity = 0; tshade.style.opacity = 0; return; }
      var n = [dx / len, dy / len], M = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2], rect = [[0, 0], [W, 0], [W, H], [0, H]];
      var stay = clipHalf(rect, M, n, false), lifted = clipHalf(rect, [M[0] - n[0] * 1.5, M[1] - n[1] * 1.5], n, true); // the back overlaps the fold by 1.5 px: no hairline seam
      var cs = stay.length > 2 ? poly(stay) : NONE; top.style.clipPath = cs; top.style.webkitClipPath = cs;
      // the back of the lifted part: the same sheet mirrored across the fold line
      var k = 2 * (M[0] * n[0] + M[1] * n[1]);
      flap.style.transform = 'matrix(' + [1 - 2 * n[0] * n[0], -2 * n[0] * n[1], -2 * n[0] * n[1], 1 - 2 * n[1] * n[1], k * n[0], k * n[1]].map(function (v) { return v.toFixed(5); }).join(',') + ')';
      var fc = lifted.length > 2 ? poly(lifted) : NONE; flap.style.clipPath = flap.style.webkitClipPath = fc;
      var ang = Math.atan2(n[1], n[0]), ext = Math.min(60, len * .35);
      place(fS, [M[0] - n[0] * 2, M[1] - n[1] * 2], ang, len / 2 + 2); // crease, highlight and warm edge up to the lifted corner
      place(uS, M, ang, ext);                     // shadow the flap casts on the page below
      place(tS, M, ang + Math.PI, ext * 0.8);     // the curl's shadow on the part that stays
      ushade.style.opacity = 1; tshade.style.opacity = 1;
    }
    function set(P, now) { // during a drag, styles are written once per frame, whatever the touch rate
      if (!active) return P;
      P = clampP(P, active);
      if (now) { cancelAnimationFrame(praf); praf = 0; pend = null; apply(P); return P; }
      pend = P; if (!praf) praf = requestAnimationFrame(function () { praf = 0; if (pend) apply(pend); pend = null; });
      return P;
    }
    function end() {
      active = false; cancelAnimationFrame(anim); cancelAnimationFrame(praf); praf = 0; pend = null;
      top.style.clipPath = top.style.webkitClipPath = '';
      flap.style.display = 'none'; ushade.style.display = 'none'; tshade.style.display = 'none';
    }
    function run(path, dur, done) { // path(t) -> P
      cancelAnimationFrame(anim); cancelAnimationFrame(praf); praf = 0; pend = null; var t0 = performance.now();
      (function tick(now) { var t = Math.min(1, (now - t0) / dur); set(path(ease(t), t), true); if (t < 1) anim = requestAnimationFrame(tick); else if (done) done(); })(t0);
    }
    // forward: the corner travels to the spine and over to the left
    function turnForward(done, from, corner) {
      if (!active) begin(corner || 'br');
      var s = from || [C[0] - 1, C[1] - (active === 'tr' ? -1 : 1)], lift = H * 0.2;
      run(function (e) { var x = s[0] + (-W - s[0]) * e, yb = s[1] + (C[1] - s[1]) * e; return [x, yb + (active === 'tr' ? 1 : -1) * Math.sin(Math.PI * e) * lift]; }, opts.dur || 820, function () { end(); if (done) done(); });
    }
    // back: a page comes back from the left and lands on this one
    function turnBack(done) {
      begin('br'); var lift = H * 0.2;
      run(function (e) { return [-W + 2 * W * e - (e === 1 ? 1 : 0), H - Math.sin(Math.PI * e) * lift]; }, opts.dur || 820, function () { end(); if (done) done(); });
    }
    function revert(from, done) { var s = from; run(function (e) { return [s[0] + (C[0] - s[0]) * e, s[1] + (C[1] - s[1]) * e]; }, 380, function () { end(); if (done) done(); }); }
    function flutter() { // a draught lifts the corner a little and lets it fall back
      if (active) return; begin('br');
      run(function (e, t) { var k = Math.sin(Math.PI * t) * (1 - t * 0.3); return [W - 34 * k, H - 22 * k]; }, 1400, function () { end(); });
    }
    function peek(done) { // show how it works: the corner lifts towards the left and settles back
      if (active) return; begin('br');
      run(function (e, t) { var k = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 1.3); return [W - (W * 0.24) * k, H - 34 * k]; }, 1700, function () { end(); if (done) done(); });
    }
    return { begin: begin, set: set, end: end, turnForward: turnForward, turnBack: turnBack, revert: revert, flutter: flutter, peek: peek, measure: measure,
      corner: function () { return C.slice(); }, size: function () { return [W, H]; }, active: function () { return !!active; } };
  }
  window.WaywardCurl = { create: create };
})();
