/* Wayward: The Hollow Mountain — procedural score + sound effects.
 * Everything is synthesized live with the Web Audio API: no files, no dependencies.
 *
 *   WaywardAudio.unlock()          call from a tap/click handler (safe to call on every tap)
 *   WaywardAudio.setScene(name)    ~2.5 s crossfade to a music preset (remembered until unlock)
 *   WaywardAudio.sfx(name, opts)   one-shot effect; 'ending' takes opts.kind = good|strange|bad
 *   WaywardAudio.setMusic(on) / setSfx(on) / duck(on) / state()
 * Test hooks: _analyser, _ctx, _renderOffline(scene|null, seconds, [[time, sfx, opts], ...]).
 */
(function () {
  'use strict';
  var W = window, AC = W.AudioContext || W.webkitAudioContext;
  var OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext;
  var LOOK = 0.4, XFADE = 2.5, DUCK = 0.4, MASTER = 1, REV = 0.55; // no compressors on the master any more: levels are set by the two volume sliders // DUCK = -8 dB

  /* ---------------- helpers ---------------- */
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rng(a) { // mulberry32: small seeded PRNG so variation is reproducible offline
    return function () {
      a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(s) { for (var h = 2166136261, i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function chain() { var a = arguments; for (var i = 1; i < a.length; i++) a[i - 1].connect(a[i]); return a[a.length - 1]; }
  function quiet(p) { if (p && p.catch) p.catch(function () {}); }
  function gain(c, v) { var g = c.createGain(); g.gain.value = v; return g; }
  // smooth, interruptible move of a param (reaches ~95% after `time` with div 3)
  function glide(p, v, t, time, div) { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, Math.max(time / (div || 3), 0.002)); }
  // fast attack, exponential decay to -60 dB over d
  function perc(p, t, pk, a, d) { p.setValueAtTime(0, t); p.linearRampToValueAtTime(pk, t + a); p.exponentialRampToValueAtTime(pk * 1e-3 + 1e-7, t + a + d); }
  function pcs(ch) { return ch.map(function (m) { return m % 12; }); }
  function tones(ch, lo, hi) { var p = pcs(ch), r = []; for (var m = lo; m <= hi; m++) if (p.indexOf(m % 12) >= 0) r.push(m); return r; }
  function scaleStep(m, k, sc) { var d = k < 0 ? -1 : 1; for (var i = 0; i < Math.abs(k); i++) do m += d; while (sc.indexOf(m % 12) < 0); return m; }
  function nearest(m, ch) { var p = pcs(ch); for (var d = 0; d < 7; d++) { if (p.indexOf((m - d) % 12) >= 0) return m - d; if (p.indexOf((m + d) % 12) >= 0) return m + d; } return m; }

  /* ---------------- output target (music scene or sfx bus) ---------------- */
  function Out(G, dry, wet, seed) { this.G = G; this.ctx = G.ctx; this.nz = G.nz; this.dry = dry; this.wet = wet; this.r = rng(seed); }
  Out.prototype.rr = function (a, b) { return a + (b - a) * this.r(); };
  Out.prototype.ri = function (a) { return a[0] + Math.floor(this.r() * (a[1] - a[0] + 1)); };
  Out.prototype.pick = function (a) { return a[Math.floor(this.r() * a.length)]; };

  /* A Voice owns the nodes of one sound and disconnects them all when its last source ends.
     Voices made for a scene register with it (O.vs) so the scene can cut them when it stops. */
  function V(O) { this.O = O; this.c = O.ctx; this.n = []; this.s = []; this.e = -1; this.last = null; if (O.vs) O.vs.push(this); }
  V.prototype = {
    k: function (x) { this.n.push(x); return x; },
    src: function (x, end) { x._e = end || 1e9; if (end) { x.stop(end); if (end > this.e) { this.e = end; this.last = x; } } this.s.push(x); return this.k(x); },
    osc: function (type, f, t, end) { var x = this.c.createOscillator(); x.type = type; x.frequency.value = f; x.start(t); return this.src(x, end); },
    noise: function (t, end, rate) {
      var x = this.c.createBufferSource(); x.buffer = this.O.nz; x.loop = true;
      if (rate) x.playbackRate.value = rate; x.start(t, this.O.r() * 2.5); return this.src(x, end);
    },
    g: function (v) { return this.k(gain(this.c, v == null ? 1 : v)); },
    f: function (type, f, q) { var x = this.k(this.c.createBiquadFilter()); x.type = type; x.frequency.value = f; if (q != null) x.Q.value = q; return x; },
    out: function (node, wet, pan) { // -> dry bus (+ optional pan) and reverb send
      if (pan && this.c.createStereoPanner) { var p = this.k(this.c.createStereoPanner()); p.pan.value = pan; node = chain(node, p); }
      node.connect(this.O.dry);
      if (wet) chain(node, this.g(wet), this.O.wet);
    },
    done: function () {
      var me = this, n = this.n, x = this.last || this.s[0];
      if (x) x.onended = function () { me.fin = 1; n.forEach(function (y) { try { y.disconnect(); } catch (e) {} }); };
    }
  };

  /* ---------------- instruments (shared by music and sfx) ---------------- */
  // partial tables [ratio, amp, decay multiplier]
  var BOX = [[1, 1, 1], [2, .12, .5], [6.27, .3, .12], [17.55, .05, .05]],      // music box tine
      CEL = [[1, 1, 1], [2, .2, .45], [4, .1, .12]],              // celesta
      CHIME = [[1, 1, 1], [2.76, .35, .45], [5.4, .18, .22], [8.93, .08, .1]],  // free bar
      GLASS = [[1, 1, 1], [2, .12, .7], [3, .05, .5]],
      WARM = [[1, 1, 1], [2, .25, .5], [3, .08, .3]],
      COIN = [[1, 1, 1], [1.47, .7, .7], [2.09, .5, .5], [2.56, .35, .4], [3.36, .2, .3]],
      BELL = [[.5, .4, 1.6], [.503, .2, 1.5], [1, .6, 1], [1.006, .25, .9], [1.19, .45, .75], [1.5, .3, .55],
              [2, .45, .5], [2.51, .28, .35], [2.66, .2, .3], [3.01, .16, .22], [4.17, .1, .14], [5.43, .06, .09]],
      CHOIR = [[600, 5, 1], [1040, 6, .6], [2600, 8, .2]];                       // "ah" formants [f, Q, gain]

  // additive bell/mallet: o = {a, wet, pan, lp, vib:[rate, cents]}
  function ring(O, t, f, g, parts, dec, o) {
    o = o || {};
    var v = new V(O), out = v.g(1), ny = O.ctx.sampleRate * .45, lg = null, a = o.a || .003;
    if (o.vib) { lg = v.g(o.vib[1]); chain(v.osc('sine', o.vib[0], t, t + dec * 1.7), lg); }
    parts.forEach(function (p) {
      if (f * p[0] > ny) return;
      var e = dec * p[2], x = v.osc('sine', f * p[0], t, t + a + e + .02), eg = v.g(0);
      if (lg) lg.connect(x.detune);
      perc(eg.gain, t, g * p[1], a, e); chain(x, eg, out);
    });
    v.out(o.lp ? chain(out, v.f('lowpass', o.lp, .5)) : out, o.wet, o.pan); v.done();
  }
  // plucked string: saw/triangle through a closing lowpass. o = {type, d, a, b (brightness x f), fc, q, det, wet, pan}
  function pluck(O, t, f, g, o) {
    var v = new V(O), d = o.d || 1, end = t + d + .05, lp = v.f('lowpass', 1000, o.q || .8), a = v.g(0),
        fc = Math.min(o.fc || f * (o.b || 6), 15000);
    lp.frequency.setValueAtTime(fc, t); lp.frequency.exponentialRampToValueAtTime(Math.max(Math.min(fc, f * 1.5), 80), t + d * .7);
    (o.det ? [-o.det, o.det] : [0]).forEach(function (dt) { var x = v.osc(o.type || 'sawtooth', f, t, end); x.detune.value = dt; x.connect(lp); });
    perc(a.gain, t, g, o.a || .004, d); chain(lp, a); v.out(a, o.wet, o.pan); v.done();
  }
  // sustained chord: attack a, held until t+len, released over r. o = {type, g, cut, q, det, form, vib, hp, sweep, wet, pan}
  // (detuned osc pairs only for chords of <= 3 notes, to keep the oscillator count low)
  function pad(O, t, ms, len, o) {
    var v = new V(O), a = Math.min(o.a || 2, len), r = o.r || 3, end = t + len + r * 1.25, det = o.det == null ? (ms.length > 3 ? 0 : 4) : o.det,
        pk = (o.g || .04) / Math.sqrt(ms.length * (det ? 2 : 1)), out = v.g(0), ins, head, lg = null;
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(pk, t + a);
    out.gain.setValueAtTime(pk, t + len); out.gain.setTargetAtTime(0, t + len, r / 4);
    if (o.form) { ins = v.g(1); o.form.forEach(function (F) { chain(ins, v.f('bandpass', F[0], F[1]), v.g(F[2]), out); }); }
    else {
      ins = v.f('lowpass', o.cut || 1200, o.q || .6); ins.connect(out);
      if (o.sweep) { ins.frequency.setValueAtTime(o.cut * .3, t); ins.frequency.exponentialRampToValueAtTime(o.cut, t + a + len * .3); }
    }
    head = ins; if (o.hp) { head = v.f('highpass', o.hp, .5); head.connect(ins); }
    if (o.vib) { lg = v.g(o.vib[1]); chain(v.osc('sine', o.vib[0], t, end), lg); }
    ms.forEach(function (m) {
      (det ? [-det, det] : [0]).forEach(function (d) {
        var x = v.osc(o.type || 'sawtooth', mtof(m), t, end); x.detune.value = d || O.rr(-5, 5); if (lg) lg.connect(x.detune); x.connect(head);
      });
    });
    v.out(out, o.wet == null ? .5 : o.wet, o.pan); v.done();
  }
  // filtered noise gesture: o = {type, f, f2, f3 (sweep), q, a (attack fraction), hp, am (flutters), pan, pan2, wet}
  function hiss(O, t, d, g, o) {
    var v = new V(O), c = O.ctx, end = t + d + .02, fl = v.f(o.type || 'bandpass', o.f, o.q || 1), a = v.g(0),
        n = chain(v.noise(t, end), fl, a), pan = o.pan;
    if (o.f2) {
      fl.frequency.setValueAtTime(o.f, t); fl.frequency.exponentialRampToValueAtTime(o.f2, t + d * (o.f3 ? .45 : 1));
      if (o.f3) fl.frequency.exponentialRampToValueAtTime(o.f3, t + d);
    }
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + d * (o.a || .4)); a.gain.linearRampToValueAtTime(0, t + d);
    if (o.hp) n = chain(n, v.f('highpass', o.hp, .7));
    if (o.am) { // papery flutter: quick dips in level
      var m = v.g(1), st = d * .7 / o.am;
      for (var k = 0; k < o.am; k++) {
        var tk = t + d * .15 + k * st + O.rr(0, st * .3);
        m.gain.setValueAtTime(1, tk); m.gain.linearRampToValueAtTime(.3, tk + st * .3); m.gain.linearRampToValueAtTime(1, tk + st * .6);
      }
      n = chain(n, m);
    }
    if (o.pan2 != null && c.createStereoPanner) {
      var p = v.k(c.createStereoPanner()); p.pan.setValueAtTime(o.pan, t); p.pan.linearRampToValueAtTime(o.pan2, t + d); n = chain(n, p); pan = 0;
    }
    v.out(n, o.wet, pan); v.done();
  }
  // soft low hit with a mid-range body so phone speakers still hear it
  function thump(O, t, f, g, o) {
    var v = new V(O), d = (o && o.d) || .3, end = t + d + .05, a = v.g(0),
        x = v.osc('sine', f * 2, t, end), y = v.osc('triangle', f * 2, t, end);
    x.frequency.setValueAtTime(f * 2.2, t); x.frequency.exponentialRampToValueAtTime(f, t + .07);
    y.frequency.setValueAtTime(f * 3, t); y.frequency.exponentialRampToValueAtTime(f * 2, t + .07);
    x.connect(a); chain(y, v.f('lowpass', 380, .7), v.g(.8), a);
    perc(a.gain, t, g, .006, d); v.out(a, (o && o.wet) || .1); v.done();
  }
  function drip(O, t, f, g, o) { // water drop: sine bubble sweeping upward
    var v = new V(O), x = v.osc('sine', f, t, t + .15), a = v.g(0);
    x.frequency.setValueAtTime(f, t); x.frequency.exponentialRampToValueAtTime(f * 2.3, t + .045);
    perc(a.gain, t, g, .002, .08); chain(x, a); v.out(a, o.wet, o.pan); v.done();
  }
  function chirp(O, t, g, o) { // cricket: three short high pulses
    var v = new V(O), x = v.osc('sine', 4200 + O.r() * 700, t, t + .2), a = v.g(0);
    for (var k = 0; k < 3; k++) { var tk = t + k * .055; a.gain.setValueAtTime(0, tk); a.gain.linearRampToValueAtTime(g, tk + .008); a.gain.linearRampToValueAtTime(0, tk + .035); }
    chain(x, a); v.out(a, .2, o.pan); v.done();
  }
  function toll(O, t, f, g, o) { // bronze temple bell: inharmonic, beating partials + strike
    ring(O, t, f, g, BELL, 6, o); hiss(O, t, .08, g * .5, { type: 'lowpass', f: 1500, a: .05, wet: o.wet });
  }
  var INST = {
    box: function (O, t, f, g, o) { ring(O, t, f, g, BOX, 2.4, o); },
    cel: function (O, t, f, g, o) { ring(O, t, f, g, CEL, 1.5, o); },
    chime: function (O, t, f, g, o) { ring(O, t, f, g, CHIME, 4, o); },
    glass: function (O, t, f, g, o) { o.a = .05; o.vib = [5, 6]; ring(O, t, f, g, GLASS, 3.5, o); },
    lute: function (O, t, f, g, o) { pluck(O, t, f, g, { d: 1.2, b: 5, det: 5, wet: o.wet, pan: o.pan }); },
    harp: function (O, t, f, g, o) { pluck(O, t, f, g, { type: 'triangle', d: 2.4, b: 9, wet: o.wet, pan: o.pan }); },
    clock: function (O, t, f, g, o) { pluck(O, t, f, g, { type: 'triangle', d: .45, b: 7, wet: o.wet, pan: o.pan }); }
  };
  function play(S, name, t, m, g, o) { // o: wet, pan | spread, cents (random detune), lp
    var f = mtof(m) * (o.cents ? Math.pow(2, S.rr(-o.cents, o.cents) / 1200) : 1);
    INST[name](S, t, f, g, { wet: o.wet == null ? .4 : o.wet, pan: o.pan != null ? o.pan : (o.spread ? S.rr(-o.spread, o.spread) : 0), lp: o.lp });
  }

  /* ---------------- music scene: one running preset ---------------- */
  function Scene(G, name, seed) {
    Out.call(this, G, gain(G.ctx, 0), gain(G.ctx, 0), seed);
    this.dry.connect(G.mDry); this.wet.connect(G.mWet);
    this.name = name; this.loops = []; this.vs = []; this.chs = []; this.endT = 0; this.evT = 0;
  }
  var SP = Scene.prototype = Object.create(Out.prototype);
  SP.start = function (t, fade) { this.t0 = t; P[this.name].f(this); this.fade(P[this.name].l, t, fade, 3); };
  SP.fade = function (v, t, time, div) { glide(this.dry.gain, v, t, time, div); glide(this.wet.gain, v, t, time, div); };
  SP.stop = function (t, fade) {
    var S = this, end = t + fade * 1.5 + .05;
    if (S.endT && S.endT <= end) return;
    S.endT = end; S.evT = t + fade * .6; S.fade(0, t, fade, 4);
    S.vs.forEach(function (v) { if (!v.fin) v.s.forEach(function (x) { if (x._e > end) try { x.stop(end); x._e = end; } catch (e) {} }); });
    (function rm() { // free the faders once the audio clock has passed the end
      var c = S.ctx;
      if (c.currentTime >= end || c.state === 'closed') { S.dry.disconnect(); S.wet.disconnect(); }
      else setTimeout(rm, Math.max(250, (end - c.currentTime) * 1000 + 100));
    })();
  };
  // run every loop up to horizon h (lookahead scheduling on the audio clock)
  SP.tick = function (h) {
    var now = this.ctx.currentTime;
    if (this.evT) h = Math.min(h, this.evT);
    if (this.vs.length > 80) this.vs = this.vs.filter(function (v) { return !v.fin; });
    for (var i = 0; i < this.loops.length; i++) {
      var L = this.loops[i];
      if (L.next < now - .05) L.next = now + .02; // timer stalled: skip ahead instead of bursting
      while (L.next < h) { L.fn(L.next, L.i++); L.next += Math.max(.05, typeof L.per === 'function' ? L.per() : L.per); }
    }
  };
  SP.every = function (first, per, fn) { this.loops.push({ next: this.t0 + first, per: per, fn: fn, i: 0 }); };
  SP.hold = function (v) { v.done(); };
  SP.chord = function (t) { for (var i = this.chs.length - 1; i >= 0; i--) if (this.chs[i][0] <= t + 1e-6) return this.chs[i][1]; return this.chs.length ? this.chs[0][1] : [60]; };
  // long-lived oscillators through a slowly breathing lowpass
  SP.drone = function (ms, o) {
    var S = this, v = new V(S), t = S.t0, cut = o.cut || 300, lp = v.f('lowpass', cut, .7), a = v.g(0), L = o.lfo || [.05, cut * .3];
    chain(v.osc('sine', L[0], t), v.g(L[1]), lp.frequency);
    ms.forEach(function (m) { [-3, 3].forEach(function (d) { var x = v.osc(o.type || 'sawtooth', mtof(m), t); x.detune.value = d + S.rr(-1.5, 1.5); x.connect(lp); }); });
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(o.g / Math.sqrt(ms.length * 2), t + 3);
    v.out(chain(lp, a), o.wet == null ? .3 : o.wet); S.hold(v);
  };
  // looping noise texture (wind, water, fog) with filter and amplitude LFOs; o.lp adds a darkening lowpass
  SP.bed = function (o) {
    var S = this, v = new V(S), t = S.t0, fl = v.f(o.type || 'bandpass', o.f, o.q || 1), am = v.g(1), a = v.g(0);
    (o.lfo || []).forEach(function (L) { chain(v.osc('sine', L[0], t), v.g(L[1]), fl.frequency); });
    (o.amp || []).forEach(function (L) { chain(v.osc('sine', L[0], t), v.g(L[1]), am.gain); });
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(o.g, t + 3);
    var tail = a; if (o.lp) { tail = v.f('lowpass', o.lp, .5); tail.connect(a); } // biquad bandpass skirts are only 6 dB/oct
    chain(v.noise(t, 0, S.rr(.92, 1.08)), fl, am, tail); v.out(a, o.wet == null ? .3 : o.wet, o.pan); S.hold(v);
  };
  // chord progression as a pad; each chord lasts len seconds and sets the harmony for arp/walk
  SP.prog = function (chords, len, o) {
    var S = this;
    S.every(0, len, function (t, i) {
      var ch = chords[i % chords.length]; S.chs.push([t, ch]); if (S.chs.length > 6) S.chs.shift();
      pad(S, t, ch, len, o);
    });
  };
  // arpeggio over current chord tones in [lo, hi]; a new pattern every `bar` steps;
  // o.cycle = [on, off] steps lets busy figures breathe (S.on tells other layers whether it is playing)
  SP.arp = function (o) {
    var S = this, pat = o.pats[0];
    S.on = true;
    S.every(o.first || .5, o.step, function (t, i) {
      if (i % (o.bar || 16) === 0) pat = S.pick(o.pats);
      if (o.cycle) S.on = i % (o.cycle[0] + o.cycle[1]) < o.cycle[0];
      if (!S.on || S.r() < (o.rest || 0)) return;
      var pool = tones(S.chord(t), o.lo, o.hi);
      play(S, o.v, t, pool[pat[i % pat.length] % pool.length], o.g * (i % 4 ? .8 : 1) * S.rr(.85, 1.1), o);
    });
  };
  // wandering scale melody in phrases; lands on chord tones on strong steps and at phrase ends
  SP.walk = function (o) {
    var S = this, m = Math.round((o.lo + o.hi) / 2), left = 0, rest = 0;
    S.every(o.first || 1, o.step, function (t, i) {
      if (rest > 0) { rest--; return; }
      if (left <= 0) left = S.ri(o.len);
      m = scaleStep(m, S.pick([-2, -1, -1, -1, 0, 1, 1, 1, 2]), o.sc);
      if (m > o.hi) m = scaleStep(m, -2, o.sc); if (m < o.lo) m = scaleStep(m, 2, o.sc);
      if (i % (o.strong || 2) === 0 || left === 1) m = nearest(m, S.chord(t));
      if (!(o.rest && S.r() < o.rest)) play(S, o.v, t, m, o.g * S.rr(.75, 1.05), o);
      if (--left <= 0) rest = S.ri(o.gap);
    });
  };

  /* ---------------- presets ---------------- */
  var P = Object.create(null);
  function def(name, lvl, f) { P[name] = { l: lvl, f: f }; }
  var AMIN = [9, 11, 0, 2, 4, 5, 7], DDOR = [2, 4, 5, 7, 9, 11, 0];
  function every(S, a, b) { return function () { return S.rr(a, b); }; }

  // menu: warm, hopeful "adventure awaits" — D lydian pad + music-box arpeggio
  def('menu', .95, function (S) {
    S.drone([38, 45], { type: 'triangle', g: .03, cut: 500 });
    S.prog([[50, 57, 61, 66], [50, 59, 64, 68], [47, 54, 57, 62], [45, 52, 56, 61]], 8, { g: .05, cut: 1300, a: 2.5, r: 3 });
    S.arp({ first: 1.5, step: .34, lo: 69, hi: 90, g: .05, v: 'box', rest: .22, wet: .45, spread: .4,
      pats: [[0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 1, 3, 2, 4, 3, 5], [5, 4, 3, 2, 1, 2, 3, 4]] });
  });
  // mountain: dusk at the mountain's foot — D dorian low drone, wind, sparse plucked motif
  def('mountain', 1, function (S) {
    S.drone([38, 45, 50], { g: .03, cut: 300, lfo: [.05, 120] });
    S.bed({ f: 500, q: 1, lp: 1400, g: .075, lfo: [[.07, 250], [.023, 170]], amp: [[.11, .4], [.041, .3]] });
    S.prog([[50, 53, 57, 60, 64], [48, 55, 60, 64, 67], [50, 57, 59, 65]], 12, { g: .025, cut: 800, a: 4, r: 4 });
    S.walk({ first: 2.5, step: .45, lo: 57, hi: 76, sc: DDOR, g: .09, v: 'harp', len: [3, 6], gap: [8, 20], wet: .5, spread: .3 });
  });
  // village: cosy, a little too friendly — G major lute arpeggios, soft pad, crickets; the borrowed C minor is the wink
  def('village', 1, function (S) {
    S.drone([43, 50], { type: 'triangle', g: .025, cut: 400 });
    S.prog([[55, 59, 62, 67], [52, 55, 59, 64], [48, 55, 60, 64], [48, 55, 60, 63], [55, 59, 62, 67], [50, 54, 57, 62]], 4.8, { g: .03, cut: 1000 });
    S.arp({ first: .6, step: .3, lo: 55, hi: 79, g: .06, v: 'lute', rest: .12, cycle: [64, 16],
      pats: [[0, 2, 1, 3, 2, 4, 3, 1], [0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 4, 2, 1, 3, 5, 3]] });
    S.every(2, every(S, .3, 2.2), function (t) { chirp(S, t, .012, { pan: S.rr(-.7, .7) }); });
  });
  // procession: eerie sleepwalkers' lullaby — A minor music box (slightly out of tune, 3/4) over a soft choir
  def('procession', 1, function (S) {
    S.drone([33, 45], { g: .025, cut: 220 });
    S.prog([[57, 60, 64], [53, 57, 60, 65], [50, 57, 62, 65], [52, 56, 59, 64]], 7.2, { g: .09, form: CHOIR, vib: [4.5, 14], a: 3, r: 3 });
    S.walk({ first: 1.8, step: .6, lo: 64, hi: 84, sc: AMIN, strong: 3, g: .08, v: 'box', len: [6, 12], gap: [3, 6], cents: 14, wet: .5 });
  });
  // ridge: vast and cold on a knife-edge — E minor airy high pad, wind, rare distant chimes
  def('ridge', .8, function (S) {
    S.bed({ f: 1100, q: 1.2, lp: 3500, g: .085, lfo: [[.05, 650], [.017, 300]], amp: [[.09, .45], [.031, .35]] });
    S.bed({ type: 'lowpass', f: 250, q: .5, g: .05, amp: [[.05, .4]] });
    S.prog([[64, 71, 78, 79], [62, 69, 74, 76, 81], [60, 67, 71, 76], [64, 67, 71, 78]], 10, { type: 'triangle', g: .04, cut: 4000, hp: 350, a: 4, r: 4 });
    S.every(4, every(S, 7, 15), function (t) { play(S, 'chime', t, S.pick([83, 86, 88, 91, 95]), .045, { wet: .9, lp: 3000, spread: .8 }); });
  });
  // river: dark underground river — C minor low drone, flowing + babbling water, random drips
  def('river', 1.15, function (S) {
    S.drone([36, 43], { g: .028, cut: 220, lfo: [.04, 70] });
    S.bed({ type: 'lowpass', f: 550, q: .7, g: .06, lfo: [[.13, 220]], amp: [[.21, .35], [.07, .3]] });
    S.bed({ f: 1400, q: 2.5, lp: 3000, g: .05, lfo: [[1.7, 450], [.43, 350]], amp: [[.37, .4]] });
    S.prog([[48, 55, 63], [44, 51, 60, 63], [41, 48, 56, 60], [43, 50, 59, 62]], 10, { g: .035, cut: 800, a: 4, r: 4 });
    S.every(1, every(S, .6, 3.2), function (t) { drip(S, t, S.rr(900, 2100), .075, { wet: .6, pan: S.rr(-.8, .8) }); });
  });
  // lake: dreamy lake of sleeping boats — F lydian slow harp arpeggios in a long reverb, lapping water
  def('lake', 1.45, function (S) {
    S.bed({ type: 'lowpass', f: 420, q: .5, g: .045, amp: [[.1, .5], [.037, .3]] });
    S.prog([[53, 60, 64, 69], [53, 59, 62, 67], [57, 60, 64, 67], [52, 55, 59, 64]], 9.3, { g: .03, cut: 1000, a: 3.5, r: 4 });
    S.arp({ first: 1, step: .62, lo: 65, hi: 91, g: .07, v: 'harp', wet: .8, rest: .25, spread: .5,
      pats: [[0, 1, 2, 3, 4, 5, 4, 3], [0, 2, 4, 1, 3, 5, 2, 4], [2, 3, 4, 5, 6, 5, 4, 3]] });
  });
  // chamber: wonder among the maps — D minor clockwork pluck ostinato + tick-tock over a golden pad
  def('chamber', 1.15, function (S) {
    S.drone([38, 45], { type: 'triangle', g: .022, cut: 400 });
    S.prog([[50, 57, 62, 64, 65], [46, 53, 57, 62], [43, 50, 55, 58, 64], [45, 52, 57, 61]], 8, { g: .04, cut: 1500, a: 2.5, r: 3 });
    S.arp({ first: .8, step: .2, lo: 62, hi: 84, g: .055, v: 'clock', rest: .08, bar: 32, cycle: [80, 40],
      pats: [[2, 0, 1, 0, 3, 0, 1, 0], [3, 1, 2, 1, 4, 1, 2, 0], [2, 0, 1, 0, 3, 0, 4, 1]] });
    S.every(.8, .4, function (t, i) { if (S.on) hiss(S, t, .012, .016, { f: i % 2 ? 2600 : 3800, q: 5 }); });
  });
  // lanternhall: the warm glow of a thousand lanterns — Bb major pad, random soft chimes
  def('lanternhall', 1, function (S) {
    S.drone([34, 41], { type: 'triangle', g: .025, cut: 350 });
    S.prog([[46, 53, 57, 62], [51, 55, 58, 65], [45, 53, 60, 65], [43, 50, 58, 65]], 9, { g: .05, cut: 1300, a: 3, r: 3.5 });
    S.every(1, every(S, .6, 2.6), function (t) { play(S, 'chime', t, S.pick(tones(S.chord(t), 74, 94)), S.rr(.025, .045), { wet: .7, spread: .7, lp: 5000 }); });
  });
  // stairs: climbing nine hundred steps — E dorian ascending arpeggios over a soft pulse
  def('stairs', 1, function (S) {
    S.prog([[40, 52, 59, 62, 66], [42, 54, 57, 61, 64], [43, 55, 59, 62, 66], [45, 57, 61, 64, 66]], 6.72, { g: .035, cut: 1100, a: 1.5, r: 2.5 });
    S.every(.2, .56, function (t, i) { pluck(S, t, mtof(S.chord(t)[0]), i % 2 ? .07 : .1, { type: 'triangle', a: .025, d: .5, b: 4, wet: .2 }); });
    S.arp({ first: .5, step: .28, lo: 64, hi: 90, g: .05, v: 'cel', rest: .1, bar: 24, cycle: [72, 24],
      pats: [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 1, 2, 3, 4, 3], [0, 2, 1, 3, 2, 4, 3, 5]] });
  });
  // bell: sacred foggy monastery courtyard — low drone, choir, a distant bronze bell every 20–30 s
  def('bell', 1.2, function (S) {
    S.drone([33, 40, 45], { g: .018, cut: 300 });
    S.bed({ type: 'lowpass', f: 380, q: .3, g: .02, amp: [[.05, .4]] });
    S.prog([[57, 64, 69], [55, 62, 67, 71], [53, 60, 65, 69], [52, 57, 64, 69]], 10, { g: .12, form: CHOIR, vib: [4.2, 12], a: 4, r: 4 });
    S.every(2.5, every(S, 20, 30), function (t) { toll(S, t, 110, .1, { lp: 1600, wet: .85 }); });
  });
  // library: quiet scriptorium at night — slow, sparse A minor celesta over a faint pad
  def('library', 1.7, function (S) {
    S.prog([[45, 52, 60, 64], [41, 48, 57, 64], [38, 45, 53, 60], [40, 47, 56, 62]], 12, { g: .025, cut: 650, a: 5, r: 5 });
    S.walk({ first: 1.2, step: .75, lo: 67, hi: 88, sc: AMIN, strong: 2, g: .07, v: 'cel', len: [3, 7], gap: [2, 6], rest: .15, wet: .55, spread: .3 });
  });
  // heart: awe and dread before the giant sleeping eye — sub drone, slow heartbeat, swelling dissonant cluster
  def('heart', .9, function (S) {
    S.drone([25, 37, 44], { g: .04, cut: 190, lfo: [.03, 80] });
    S.every(.5, 1.6, function (t) { thump(S, t, 52, .11, { d: .4 }); thump(S, t + .3, 47, .075, { d: .45 }); });
    S.every(0, 16, function (t) {
      pad(S, t, S.pick([[61, 62, 68, 69], [60, 61, 66, 67], [63, 64, 70]]), 9, { type: 'triangle', g: .05, cut: 1400, a: 7, r: 6, vib: [.2, 10], wet: .6 });
    });
  });
  // dawn: release above the clouds — C major pad rising C-Dm-Em-F-G, bright celesta arpeggio
  def('dawn', 1, function (S) {
    S.drone([36, 43], { type: 'triangle', g: .03, cut: 600 });
    S.prog([[48, 55, 62, 64, 67], [50, 57, 60, 64, 65], [52, 59, 62, 67, 71], [53, 60, 64, 67, 69], [55, 62, 64, 67, 71]], 6,
      { g: .045, cut: 1800, a: 2, r: 2.5, sweep: 1 });
    S.arp({ first: .5, step: .25, lo: 67, hi: 93, g: .05, v: 'cel', rest: .06, bar: 24, spread: .35, cycle: [96, 24],
      pats: [[0, 1, 2, 3, 4, 5, 6, 7], [0, 2, 4, 6, 5, 3, 1, 2], [0, 1, 2, 3, 2, 3, 4, 5]] });
  });
  // moment: a timed decision — pulsing phrygian 8th-note ostinato whose filter keeps rising, low drone, high dissonant halo
  def('moment', 1.2, function (S) {
    S.drone([26, 38], { g: .03, cut: 170 });
    var pat = [0, 0, 12, 0, 3, 0, 1, 0];
    S.every(.1, .21, function (t, i) {
      pluck(S, t, mtof(38 + pat[i % 8]), i % 4 ? .07 : .1, { d: .2, fc: 400 * Math.pow(2, Math.min(t - S.t0, 25) / 7.5), q: 4, wet: .15 });
    });
    S.every(3, 12, function (t) { pad(S, t, [81, 82], 8, { type: 'sine', g: .02, a: 5, r: 4, vib: [5.5, 9], det: 0, wet: .6 }); });
  });
  // secret: a hidden page — ethereal, glassy, weightless (no bass, no pulse)
  def('secret', .8, function (S) {
    S.bed({ type: 'highpass', f: 5000, q: .4, g: .008, amp: [[.08, .5]] });
    S.prog([[76, 80, 83, 87], [74, 78, 82, 85], [78, 82, 85, 88], [73, 80, 83, 87]], 10, { type: 'sine', g: .035, a: 4, r: 5, det: 0, vib: [4.5, 8], wet: .8 });
    S.every(1, every(S, .4, 1.8), function (t) { play(S, 'glass', t, S.pick([88, 90, 92, 94, 95, 97, 99]), S.rr(.02, .04), { wet: .9, spread: .8 }); });
  });

  /* ---------------- sound effects ---------------- */
  var X = Object.create(null);
  // page: paper swish with a fluttering edge (~0.4 s)
  X.page = function (O, t, o) {
    var g = o.g || 1;
    hiss(O, t, .42, .24 * g, { f: 1000, f2: 4000, f3: 1700, q: .8, a: .3, hp: 500, am: 7, pan: -.4, pan2: .4, wet: .12 });
    hiss(O, t + .06, .28, .06 * g, { type: 'highpass', f: 5500, am: 5, wet: .1 });
  };
  // open: book opening — soft low thump, a breath of air, then paper
  X.open = function (O, t) {
    thump(O, t, 62, .2, { d: .4 });
    hiss(O, t, .35, .08, { type: 'lowpass', f: 700, q: .5, a: .15 });
    X.page(O, t + .09, { g: .8 });
  };
  // choice: soft wooden tick + small warm chime (pitch varies a little)
  X.choice = function (O, t) {
    ring(O, t, 820, .14, [[1, 1, 1], [2.4, .35, .5], [3.9, .15, .3]], .07);
    hiss(O, t, .02, .08, { f: 2200, q: 3, a: .1 });
    ring(O, t + .035, mtof(O.pick([79, 81, 84, 86, 88])), .09, WARM, 1.3, { wet: .35, pan: O.rr(-.2, .2) });
  };
  // tap: barely-there UI click
  X.tap = function (O, t) { hiss(O, t, .01, .05, { type: 'highpass', f: 3000, a: .1 }); ring(O, t, 1700, .025, [[1, 1, 1]], .025); };
  // tick: clock tick (alternates tick / tock)
  X.tick = function (O, t) {
    var tock = (O.tk = !O.tk);
    hiss(O, t, .022, .3, { f: tock ? 2600 : 3600, q: 5, a: .08 });
    ring(O, t, tock ? 1500 : 1900, .1, [[1, 1, 1], [2.7, .4, .4]], .04);
  };
  // heartbeat: lub-dub
  X.heartbeat = function (O, t) { thump(O, t, 52, .2, { d: .32 }); thump(O, t + .27, 47, .15, { d: .4 }); };
  // bell: great bronze temple bell (~6 s)
  X.bell = function (O, t) { toll(O, t, 110, .14, { wet: .45 }); };
  // coin: medal/coin clink, two quick strikes
  X.coin = function (O, t) {
    ring(O, t, 2300, .1, COIN, .5, { pan: .1 }); ring(O, t + .075, 2450, .06, COIN, .4, { pan: -.1 });
    hiss(O, t, .012, .08, { type: 'highpass', f: 4000, a: .1 });
  };
  // relic: the reward — rising whoosh, warm swell, sparkling upward arpeggio, glassy final shimmer (~1.5 s + tail)
  X.relic = function (O, t) {
    hiss(O, t, 1.2, .1, { f: 400, f2: 5000, q: 1.4, a: .7, pan: -.5, pan2: .5, wet: .6 });
    pad(O, t + .05, [62, 66, 69, 73, 76], 1, { type: 'triangle', g: .12, a: .6, r: 1.4, cut: 3000, det: 4, wet: .6 });
    [74, 78, 81, 85, 86, 90, 93, 97, 98].forEach(function (m, i) {
      ring(O, t + .08 + i * .075 - i * i * .002, mtof(m), .045 + i * .003, CHIME, 1.4, { wet: .55, pan: i % 2 ? .5 : -.5 });
    });
    [86, 90, 93, 97, 102].forEach(function (m, i) { ring(O, t + .85 + i * .03, mtof(m), .03, GLASS, 2.6, { wet: .75, pan: O.rr(-.6, .6), vib: [6, 7] }); });
  };
  // whoosh: soft air sweeping across, for revealing a scene
  X.whoosh = function (O, t) { hiss(O, t, .75, .3, { f: 280, f2: 1500, f3: 450, q: 1.1, a: .45, pan: -.5, pan2: .5, wet: .3 }); };
  // ending: good = warm IV-V-I major cadence; strange = lydian pad + whole-tone glass shimmer; bad = music box winding down in minor
  X.ending = function (O, t, o) {
    if (o.kind === 'strange') {
      pad(O, t, [60, 64, 66, 71], 1.3, { type: 'sine', det: 0, g: .09, a: .5, r: 1.3, vib: [.7, 18], wet: .7 });
      [84, 88, 86, 90, 92, 94, 96].forEach(function (m, i) { ring(O, t + .1 + i * .16, mtof(m), .04, GLASS, 2.2, { wet: .7, pan: O.rr(-.7, .7), vib: [5, 20] }); });
      hiss(O, t, 1.8, .05, { f: 2000, f2: 6000, q: 2, a: .5, wet: .6 });
    } else if (o.kind === 'bad') {
      [[76, 0, -4], [74, .24, -8], [72, .52, -14], [71, .86, -22], [69, 1.3, -34]].forEach(function (n) {
        ring(O, t + n[1], mtof(n[0]) * Math.pow(2, n[2] / 1200), .09, BOX, 2, { wet: .45 });
      });
      pad(O, t + 1.3, [45, 52, 57, 60], .8, { type: 'triangle', g: .09, a: .3, r: 1.4, cut: 900, wet: .5 });
      pluck(O, t + 1.3, mtof(33), .12, { type: 'triangle', d: 1.6, b: 4 });
    } else {
      var brass = { g: .1, a: .06, r: .35, cut: 2200, sweep: 1, wet: .45 };
      pad(O, t, [53, 57, 60, 65], .4, brass); pad(O, t + .42, [55, 59, 62, 67], .4, brass);
      pad(O, t + .84, [48, 55, 60, 64, 67, 72], 1.2, { g: .12, a: .1, r: 1.3, cut: 2600, sweep: 1, wet: .5 });
      [72, 76, 79, 84, 88].forEach(function (m, i) { ring(O, t + .84 + i * .08, mtof(m), .05, CEL, 1.6, { wet: .5, pan: (i - 2) * .2 }); });
      ring(O, t + .84, mtof(84), .04, CHIME, 2.5, { wet: .6 });
    }
  };

  /* ---------------- graph: buses, reverb, master dynamics ---------------- */
  function graph(c, on) {
    var G = { ctx: c }, sr = c.sampleRate, r = rng(99), i, n;
    var nb = c.createBuffer(1, sr * 3, sr), d = nb.getChannelData(0);
    for (i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    G.nz = nb;
    // shared reverb: stereo decaying noise that darkens as it fades (~3.6 s to -60 dB)
    n = Math.floor(sr * 3.6); var ir = c.createBuffer(2, n, sr);
    for (var ch = 0; ch < 2; ch++) {
      var x = ir.getChannelData(ch), lp = 0;
      for (i = 0; i < n; i++) { var k = i / n; lp += (r() * 2 - 1 - lp) * (.9 - .75 * k); x[i] = lp * Math.exp(-6.9 * k) * Math.min(1, i / (sr * .012)); }
    }
    G.rev = c.createConvolver(); G.rev.buffer = ir;
    G.mDry = gain(c, on); G.mWet = gain(c, on); G.sDry = gain(c, on); G.sWet = gain(c, on); G.master = gain(c, MASTER);
    function dyn(th, knee, ratio, att, rel) {
      var q = c.createDynamicsCompressor(); q.threshold.value = th; q.knee.value = knee; q.ratio.value = ratio; q.attack.value = att; q.release.value = rel; return q;
    }
    var clip = c.createWaveShaper(), cv = new Float32Array(2048);
    for (i = 0; i < 2048; i++) { var u = i / 1023.5 - 1, au = Math.abs(u); cv[i] = au < .7 ? u : (u < 0 ? -1 : 1) * (.7 + .25 * Math.tanh((au - .7) / .25)); }
    clip.curve = cv; // safety soft-clip: transparent below 0.7, never exceeds ~0.91
    G.an = c.createAnalyser(); G.an.fftSize = 2048;
    G.mDry.connect(G.master); G.sDry.connect(G.master); G.mWet.connect(G.rev); G.sWet.connect(G.rev);
    chain(G.rev, gain(c, REV), G.master);
    chain(G.master, clip, G.an, c.destination); // (the old compressors added ~9 dB of make-up gain; the soft clip stays as a safety net)
    return G;
  }
  function sfxOut(G, seed) { return new Out(G, G.sDry, G.sWet, seed); }

  /* ---------------- live engine ---------------- */
  var E = { ctx: null, G: null, SO: null, unlocked: false, music: true, sfx: true, ducked: false, want: null, cur: null, live: [], seed: 1, last: {}, mv: 0.25, sv: 0.3 };
  function volGain(pct) { pct = Math.max(0, Math.min(100, +pct || 0)) / 100; return pct * pct; } // slider 50% = -12 dB

  /* ---------------- recorded music (CC0): one track per place, streamed, crossfaded at the loop point ---------------- */
  var MU = { base: '', map: {}, pl: [], cur: null, name: null };
  function muInit() {
    if (MU.pl.length || !E.ctx || !W.Audio) return;
    for (var i = 0; i < 2; i++) {
      var el = new W.Audio(); el.preload = 'auto'; el.loop = false; el.setAttribute('playsinline', '');
      var g = E.ctx.createGain(); g.gain.value = 0;
      try { E.ctx.createMediaElementSource(el).connect(g); } catch (e) { return; }
      g.connect(E.G.mDry); MU.pl.push({ el: el, g: g, name: null, off: 0 });
    }
  }
  function muUrl(name) { return MU.base + MU.map[name]; }
  function muStart(name, T) {
    muInit(); if (!MU.pl.length) return false;
    var c = E.ctx, t = c.currentTime, cur = MU.cur, nx = MU.pl[0] === cur ? MU.pl[1] : MU.pl[0];
    clearTimeout(nx.off); nx.g.gain.cancelScheduledValues(t); nx.g.gain.setValueAtTime(0, t);
    if (nx.name !== name) { nx.el.src = muUrl(name); nx.name = name; } else { try { nx.el.currentTime = 0; } catch (e) {} }
    quiet(nx.el.play());
    nx.g.gain.setValueAtTime(0, t); nx.g.gain.linearRampToValueAtTime(1, t + T);
    if (cur) { cur.g.gain.cancelScheduledValues(t); cur.g.gain.setValueAtTime(cur.g.gain.value, t); cur.g.gain.linearRampToValueAtTime(0, t + T); cur.off = setTimeout(function () { cur.el.pause(); }, T * 1000 + 150); }
    MU.cur = nx; MU.name = name; return true;
  }
  function muStop(T) {
    var cur = MU.cur; if (!cur) return; var t = E.ctx.currentTime;
    cur.g.gain.cancelScheduledValues(t); cur.g.gain.setValueAtTime(cur.g.gain.value, t); cur.g.gain.linearRampToValueAtTime(0, t + T);
    cur.off = setTimeout(function () { cur.el.pause(); }, T * 1000 + 150); MU.cur = null; MU.name = null;
  }
  function muLoop() { // start the same track again on the other player 5 s before the end and crossfade
    var cur = MU.cur; if (!cur || !MU.name || cur.el.paused) return;
    var d = cur.el.duration; if (d && isFinite(d) && cur.el.currentTime > d - 5.2) muStart(MU.name, 5);
  }
  function stopProc(T) { if (E.cur) { E.cur.stop(E.ctx.currentTime, T); E.cur = null; } }
  function playWant(T) { if (MU.map[E.want]) { stopProc(T); muStart(E.want, T); } else { muStop(T); xfade(E.want, T); } }

  /* ---------------- recorded samples (CC0 / Pixabay-licence recordings) ---------------- */
  var SM = { base: '', map: {}, gain: {}, buf: {}, loading: false };
  function loadSamples() {
    if (SM.loading || !E.ctx || !SM.base) return; SM.loading = true;
    var files = {};
    Object.keys(SM.map).forEach(function (k) { SM.map[k].forEach(function (f) { files[f] = 1; }); });
    Object.keys(files).forEach(function (f) {
      if (SM.buf[f]) return;
      fetch(SM.base + f + '.mp3').then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (ab) {
        return new Promise(function (res, rej) { var p = E.ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
      }).then(function (b) { SM.buf[f] = b; }).catch(function () {});
    });
  }
  function playSample(key, opts) {
    var list = SM.map[key]; if (!list) return false;
    var ready = list.filter(function (f) { return SM.buf[f]; }); if (!ready.length) return false;
    var c = E.ctx, f = ready[Math.floor(Math.random() * ready.length)], t = c.currentTime + .005;
    var src = c.createBufferSource(); src.buffer = SM.buf[f];
    src.playbackRate.value = (opts.rate || 1) * (opts.vary === false ? 1 : 1 + (Math.random() - .5) * .06);
    var g = c.createGain(); g.gain.value = (SM.gain[key] != null ? SM.gain[key] : .7) * (opts.gain != null ? opts.gain : 1);
    var node = src;
    if (c.createStereoPanner && opts.pan) { var pn = c.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, opts.pan)); src.connect(pn); node = pn; }
    node.connect(g); g.connect(E.G.sDry);
    if (opts.wet) { var w = c.createGain(); w.gain.value = opts.wet; g.connect(w); w.connect(E.G.sWet); }
    src.start(t); src.onended = function () { try { g.disconnect(); } catch (e) {} };
    return true;
  }

  function level(time) {
    var v = E.music ? E.mv * (E.ducked ? DUCK : 1) : 0, t = E.ctx.currentTime;
    glide(E.G.mDry.gain, v, t, time); glide(E.G.mWet.gain, v, t, time);
  }
  function xfade(name, T) {
    var c = E.ctx, t = c.currentTime + .03;
    if (E.cur) E.cur.stop(t, T);
    var S = new Scene(E.G, name, (hash(name) ^ Math.imul(E.seed++, 0x9E3779B1) ^ Date.now()) >>> 0);
    S.start(t, T); S.tick(t + LOOK); E.cur = S; E.live.push(S);
    var old = E.live.filter(function (x) { return x.endT; });
    old.slice(0, -1).forEach(function (x) { x.stop(t, .3); }); // at most one scene fading out at a time
  }
  function pump() { // lookahead scheduler: every 100 ms, schedule notes up to 0.4 s ahead
    var c = E.ctx; if (!c || c.state !== 'running') return;
    var now = c.currentTime;
    E.live = E.live.filter(function (S) { if (S.endT && S.endT <= now) return false; S.tick(now + LOOK); return true; });
    muLoop();
  }
  document.addEventListener('visibilitychange', function () {
    var c = E.ctx; if (!c || !E.unlocked || c.state === 'closed') return;
    quiet(document.hidden ? c.suspend() : c.resume());
    if (MU.cur) { if (document.hidden) MU.cur.el.pause(); else if (E.music) quiet(MU.cur.el.play()); }
  });

  var API = {
    unlock: function () {
      if (!AC) return false;
      try {
        if (!E.ctx) { E.ctx = new AC(); E.G = graph(E.ctx, 0); E.SO = sfxOut(E.G, Date.now() >>> 0); setInterval(pump, 100); loadSamples(); }
        var c = E.ctx;
        if (c.state !== 'running') quiet(c.resume());
        var s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, c.sampleRate); s.connect(c.destination); s.start(0);
        if (!E.unlocked) {
          E.unlocked = true; level(.3);
          var sv = E.sfx ? E.sv : 0; E.G.sDry.gain.value = sv; E.G.sWet.gain.value = sv;
          muInit(); // create both players inside the tap, so mobile browsers let them play later
          MU.pl.forEach(function (p, i) { if (!E.want || !MU.map[E.want] || i === 1) { p.el.src = muUrl(MU.map[E.want] ? E.want : 'menu'); p.name = MU.map[E.want] ? E.want : 'menu'; var q = p.el.play(); if (q && q.then) q.then(function () { if (MU.cur !== p) p.el.pause(); }, function () {}); } });
          if (E.want && E.music) playWant(1.5);
        }
      } catch (e) { return false; }
      return true;
    },
    setScene: function (name) {
      if (name === 'moment' && (MU.cur || E.want && MU.map[E.want])) return; // cinematic moments keep the music of the place
      if (!MU.map[name] && name === 'secret' && MU.map.lake) name = 'lake';
      if (MU.map[name]) { if (name === E.want) return; E.want = name; if (E.unlocked && E.music) playWant(XFADE); return; }
      name = P[name] ? name : 'menu';
      if (name === E.want) return;
      E.want = name;
      if (E.unlocked && E.music) { muStop(XFADE); xfade(name, XFADE); }
    },
    sfx: function (name, opts) {
      opts = opts || {};
      var c = E.ctx, skey = name === 'ending' ? 'ending:' + (opts.kind || 'good') : name;
      if (!c || !E.unlocked || !E.sfx || (!X[name] && !SM.map[skey])) return;
      if (c.state !== 'running' && !document.hidden) quiet(c.resume());
      var t = c.currentTime, key = name + (opts.kind || '');
      if (E.last[key] != null && Math.abs(t - E.last[key]) < .03) return; // ignore accidental double-fires
      E.last[key] = t;
      try { if (!playSample(skey, opts) && X[name]) X[name](E.SO, t + .01, opts); } catch (e) {}
    },
    tracks: function (base, map) { MU.base = base; MU.map = map || {}; },
    setVolume: function (kind, pct) { // 0..100
      var g = volGain(pct);
      if (kind === 'music') { E.mv = g; if (E.unlocked) level(.15); }
      else { E.sv = g; if (E.unlocked) { var t = E.ctx.currentTime; glide(E.G.sDry.gain, E.sfx ? g : 0, t, .1); glide(E.G.sWet.gain, E.sfx ? g : 0, t, .1); } }
    },
    _music: function () { return { name: MU.name, playing: !!(MU.cur && !MU.cur.el.paused), t: MU.cur ? MU.cur.el.currentTime : 0, idx: MU.pl.indexOf(MU.cur), paused: MU.pl.map(function (p) { return p.el.paused; }) }; },
    _seekEnd: function (s) { if (MU.cur) MU.cur.el.currentTime = MU.cur.el.duration - (s || 6); },
    samples: function (base, map, gains) { SM.base = base; SM.map = map || {}; SM.gain = gains || {}; loadSamples(); },
    addSamples: function (map, gains) { // extra recorded sounds from add-on modules (merged, loaded when the audio is unlocked)
      Object.keys(map || {}).forEach(function (k) { SM.map[k] = map[k]; }); Object.keys(gains || {}).forEach(function (k) { SM.gain[k] = gains[k]; });
      if (SM.loading && E.ctx) { SM.loading = false; loadSamples(); }
    },
    _samplesReady: function () { return Object.keys(SM.buf).length; },
    setMusic: function (on) {
      on = !!on; if (on === E.music) return; E.music = on;
      if (!E.unlocked) return;
      level(.6);
      if (on) { if (E.want && !E.cur && !MU.cur) playWant(1.5); }
      else { stopProc(.8); muStop(.8); }
    },
    setSfx: function (on) {
      E.sfx = !!on; if (!E.unlocked) return;
      var t = E.ctx.currentTime; glide(E.G.sDry.gain, E.sfx ? E.sv : 0, t, .1); glide(E.G.sWet.gain, E.sfx ? E.sv : 0, t, .1);
    },
    duck: function (on) { E.ducked = !!on; if (E.unlocked) level(.4); },
    state: function () {
      return { unlocked: E.unlocked, music: E.music, sfx: E.sfx, scene: E.want, running: !!(E.ctx && E.ctx.state === 'running') };
    },
    // --- test hooks ---
    _presets: Object.keys(P), _effects: Object.keys(X),
    // render a preset (or null) plus optional sfx events [[time, name, opts]] into an AudioBuffer (44.1 kHz stereo)
    _renderOffline: function (name, secs, events) {
      var sr = 44100, c = new OAC(2, Math.ceil(sr * secs), sr), G = graph(c, 1);
      if (name) { var S = new Scene(G, P[name] ? name : 'menu', hash(name)); S.start(0, .5); S.tick(secs); }
      var O = sfxOut(G, 7);
      (events || []).forEach(function (e) { if (X[e[1]]) X[e[1]](O, e[0], e[2] || {}); });
      return new Promise(function (res, rej) {
        c.oncomplete = function (ev) { res(ev.renderedBuffer); };
        var p = c.startRendering(); if (p && p.then) p.then(res, rej);
      });
    }
  };
  Object.defineProperty(API, '_analyser', { get: function () { return E.G && E.G.an; } });
  Object.defineProperty(API, '_ctx', { get: function () { return E.ctx; } });
  W.WaywardAudio = API;
})();
