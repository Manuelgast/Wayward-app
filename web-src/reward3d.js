/* Wayward · 3D rewards for the daily chest (Manuel 17-10: "de book key ... als een 3D object die rondspint als je hem opent").
   A tiny WebGL renderer with no library: the reward is modelled from simple parts (rings, lathed collars, bevelled
   extrusions), lit like jewellery in a small studio (soft boxes, a warm light from the open chest below, a violet rim)
   and spun on a turntable: a fast spin when it rises out of the chest that slows to a gentle turn. Drag to spin it.
   Kinds: key (book key), bmark (bookmark), end (free endings: a coin with a flame).
   window.WaywardReward3D.mount(canvas, kind, { still }) -> { destroy } or null when WebGL is not available. */
(function () {
  'use strict';

  /* ---------------- geometry ---------------- */
  function Geo() { this.p = []; this.n = []; this.m = []; }
  Geo.prototype.v = function (x, y, z, nx, ny, nz, mat) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.m.push(mat); };
  Geo.prototype.tri = function (a, b, c, mat) { // a/b/c: [x,y,z,nx,ny,nz]
    this.v(a[0], a[1], a[2], a[3], a[4], a[5], mat); this.v(b[0], b[1], b[2], b[3], b[4], b[5], mat); this.v(c[0], c[1], c[2], c[3], c[4], c[5], mat);
  };
  Geo.prototype.quad = function (a, b, c, d, mat) { this.tri(a, b, c, mat); this.tri(a, c, d, mat); };

  // ring in the XY plane around (cx, cy, cz): main radius R, tube radius r
  function torus(g, cx, cy, cz, R, r, nu, nv, mat) {
    function pt(i, j) {
      var u = i / nu * Math.PI * 2, v = j / nv * Math.PI * 2, cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
      return [cx + (R + r * cv) * cu, cy + (R + r * cv) * su, cz + r * sv, cv * cu, cv * su, sv];
    }
    for (var i = 0; i < nu; i++) for (var j = 0; j < nv; j++) g.quad(pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1), mat);
  }
  function sphere(g, cx, cy, cz, r, n, mat) {
    function pt(i, j) {
      var th = i / n * Math.PI, ph = j / (2 * n) * Math.PI * 2, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      return [cx + r * x, cy + r * y, cz + r * z, x, y, z];
    }
    for (var i = 0; i < n; i++) for (var j = 0; j < 2 * n; j++) g.quad(pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1), mat);
  }
  // revolve a profile [[r, y], ...] (listed top to bottom) around the Y axis; every profile segment keeps its own
  // normal, so collars get crisp machined edges while staying round
  function lathe(g, prof, seg, mat, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (var k = 0; k < prof.length - 1; k++) {
      var a = prof[k], b = prof[k + 1], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, nr = -ty / l, ny = tx / l;
      for (var s = 0; s < seg; s++) {
        var f0 = s / seg * Math.PI * 2, f1 = (s + 1) / seg * Math.PI * 2, c0 = Math.cos(f0), s0 = Math.sin(f0), c1 = Math.cos(f1), s1 = Math.sin(f1);
        g.quad([ox + a[0] * c0, oy + a[1], a[0] * s0, nr * c0, ny, nr * s0], [ox + a[0] * c1, oy + a[1], a[0] * s1, nr * c1, ny, nr * s1],
          [ox + b[0] * c1, oy + b[1], b[0] * s1, nr * c1, ny, nr * s1], [ox + b[0] * c0, oy + b[1], b[0] * s0, nr * c0, ny, nr * s0], mat);
      }
    }
  }
  function area(poly) { var a = 0; for (var i = 0; i < poly.length; i++) { var p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function earcut(poly) { // simple polygon, counter-clockwise -> triangles as index triples
    var idx = poly.map(function (_, i) { return i; }), out = [], guard = 0;
    function cross(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
    function inside(p, a, b, c) { return cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0; }
    while (idx.length > 3 && guard++ < 5000) {
      var found = false;
      for (var i = 0; i < idx.length; i++) {
        var i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length], a = poly[i0], b = poly[i1], c = poly[i2];
        if (cross(a, b, c) <= 1e-9) continue;
        var ok = true;
        for (var j = 0; j < idx.length && ok; j++) { var q = idx[j]; if (q !== i0 && q !== i1 && q !== i2 && inside(poly[q], a, b, c)) ok = false; }
        if (!ok) continue;
        out.push([i0, i1, i2]); idx.splice(i, 1); found = true; break;
      }
      if (!found) break;
    }
    if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
    return out;
  }
  // a flat shape in the XY plane, extruded along Z (depth d, centred on z0) with a 45-degree bevel b on both faces
  function extrude(g, poly, d, b, z0, mat) {
    if (area(poly) < 0) poly = poly.slice().reverse();
    var n = poly.length, en = [];
    for (var i = 0; i < n; i++) { var p = poly[i], q = poly[(i + 1) % n], ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey) || 1; en.push([ey / l, -ex / l]); } // outward edge normals
    var ins = poly.map(function (p, i) { // inset by b along the bisector
      var n0 = en[(i + n - 1) % n], n1 = en[i], mx = n0[0] + n1[0], my = n0[1] + n1[1], ml = Math.hypot(mx, my) || 1;
      mx /= ml; my /= ml; var k = b / Math.max(mx * n1[0] + my * n1[1], 0.35);
      return [p[0] - mx * k, p[1] - my * k];
    });
    var zf = z0 + d / 2, zb = z0 - d / 2, tris = earcut(ins);
    tris.forEach(function (t) {
      var A = ins[t[0]], B = ins[t[1]], C = ins[t[2]];
      g.tri([A[0], A[1], zf, 0, 0, 1], [B[0], B[1], zf, 0, 0, 1], [C[0], C[1], zf, 0, 0, 1], mat);
      g.tri([A[0], A[1], zb, 0, 0, -1], [C[0], C[1], zb, 0, 0, -1], [B[0], B[1], zb, 0, 0, -1], mat);
    });
    var s2 = Math.SQRT1_2;
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n, P = poly[i], Q = poly[j], Pi = ins[i], Qi = ins[j], nx = en[i][0], ny = en[i][1];
      g.quad([Pi[0], Pi[1], zf, nx * s2, ny * s2, s2], [P[0], P[1], zf - b, nx * s2, ny * s2, s2], [Q[0], Q[1], zf - b, nx * s2, ny * s2, s2], [Qi[0], Qi[1], zf, nx * s2, ny * s2, s2], mat);
      g.quad([P[0], P[1], zf - b, nx, ny, 0], [P[0], P[1], zb + b, nx, ny, 0], [Q[0], Q[1], zb + b, nx, ny, 0], [Q[0], Q[1], zf - b, nx, ny, 0], mat);
      g.quad([P[0], P[1], zb + b, nx * s2, ny * s2, -s2], [Pi[0], Pi[1], zb, nx * s2, ny * s2, -s2], [Qi[0], Qi[1], zb, nx * s2, ny * s2, -s2], [Q[0], Q[1], zb + b, nx * s2, ny * s2, -s2], mat);
    }
  }
  function star(cx, cy, ro, ri, pts, rot) {
    var out = [];
    for (var i = 0; i < pts * 2; i++) { var a = rot + i * Math.PI / pts, r = i % 2 ? ri : ro; out.push([cx + r * Math.sin(a), cy + r * Math.cos(a)]); }
    return out.reverse(); // counter-clockwise
  }
  function roundRect(cx, cy, w, h, r, seg) {
    var out = [], cs = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 1], [-w / 2 + r, -h / 2 + r, 2], [w / 2 - r, -h / 2 + r, 3]];
    cs.forEach(function (c) { for (var i = 0; i <= seg; i++) { var a = (c[2] + i / seg) * Math.PI / 2; out.push([cx + c[0] + r * Math.cos(a), cy + c[1] + r * Math.sin(a)]); } });
    return out;
  }
  // the flame of the app's own icon (FLAME in app.js, a 24-unit SVG): an absolute start and relative cubic curves
  var FLAME_O = [12, 2.2, [.9, 3.1, 3.6, 4.9, 4.9, 7.6], [1.5, 3.1, .6, 7, -2.2, 8.9], [-1.6, 1.1, -3.6, 1.4, -5.4, .8], [-3, -1, -4.9, -4, -4.6, -7.1],
    [.2, -2.1, 1.3, -3.6, 2.5, -4.9], [.1, 1.7, .8, 3, 2, 3.6], [-.1, -3.3, .9, -6.3, 2.8, -8.9]];
  var FLAME_I = [12.3, 11.2, [.4, 1.5, 1.8, 2.3, 2, 3.9], [.2, 1.6, -1, 3, -2.6, 3.1], [-1.7, .1, -3, -1.3, -2.8, -2.9], [.1, -1, .7, -1.6, 1.3, -2.2],
    [.1, .8, .5, 1.3, 1.1, 1.5], [-.2, -1.3, .3, -2.4, 1, -3.4]];
  function svgPath(d, cx, cy, s) {
    var x = d[0], y = d[1], out = [];
    for (var k = 2; k < d.length; k++) {
      var c = d[k], x1 = x + c[0], y1 = y + c[1], x2 = x + c[2], y2 = y + c[3], x3 = x + c[4], y3 = y + c[5];
      for (var i = 0; i < 10; i++) {
        var t = i / 10, u = 1 - t, px = u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, py = u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
        out.push([cx + (px - 12) * s, cy - (py - 11) * s]);
      }
      x = x3; y = y3;
    }
    return out;
  }

  /* ---------------- models (key upright, bow on top; units ~ 1 = half the picture) ---------------- */
  var GOLD = 0, FABRIC = 1, SATIN = 2;
  function modelKey() {
    var g = new Geo();
    torus(g, 0, 0.78, 0, 0.46, 0.085, 64, 20, GOLD);                       // the bow
    extrude(g, star(0, 0.78, 0.33, 0.1, 4, 0), 0.1, 0.03, 0, SATIN);        // a compass star inside the bow, as in the logo
    sphere(g, 0, 0.78, 0, 0.075, 12, GOLD);
    [[0, 1.33], [-0.55, 0.78], [0.55, 0.78]].forEach(function (c) { sphere(g, c[0], c[1], 0, 0.07, 12, GOLD); }); // beads on the ring
    lathe(g, [[0, 0.26], [0.07, 0.26], [0.13, 0.21], [0.13, 0.15], [0.08, 0.11], [0.066, 0.09], [0.066, 0.03], [0.115, 0.01], [0.115, -0.05], [0.066, -0.07],
      [0.066, -1.22], [0.09, -1.25], [0.09, -1.33], [0.05, -1.37], [0, -1.38]], 28, GOLD);                  // collar, shaft and tip
    extrude(g, [[0.03, -0.9], [0.5, -0.9], [0.5, -1.0], [0.4, -1.0], [0.4, -1.07], [0.5, -1.07], [0.5, -1.2], [0.33, -1.2], [0.33, -1.27], [0.5, -1.27], [0.5, -1.33], [0.03, -1.33]],
      0.08, 0.018, 0, GOLD);                                                // the bit with its wards
    return g;
  }
  function modelBookmark() {
    var g = new Geo();
    extrude(g, [[-0.3, 1.02], [-0.3, -1.12], [0, -0.82], [0.3, -1.12], [0.3, 1.02]].reverse(), 0.06, 0.016, 0, FABRIC); // the ribbon with a swallowtail
    extrude(g, roundRect(0, 1.1, 0.78, 0.24, 0.08, 6), 0.16, 0.03, 0, GOLD);                                              // the gold clasp
    extrude(g, star(0, 0.42, 0.22, 0.075, 4, 0), 0.05, 0.016, 0.05, GOLD);                                               // a star stitched on, front
    extrude(g, star(0, 0.42, 0.22, 0.075, 4, 0), 0.05, 0.016, -0.05, GOLD);                                              // and back
    sphere(g, 0, 1.1, 0.085, 0.045, 10, GOLD); sphere(g, 0, 1.1, -0.085, 0.045, 10, GOLD);
    return g;
  }
  function modelEnd() {
    var g = new Geo(), pr = [[0, 0.075], [0.78, 0.075], [0.84, 0.12], [0.94, 0.12], [1, 0.07], [1, -0.07], [0.94, -0.12], [0.84, -0.12], [0.78, -0.075], [0, -0.075]];
    var c = new Geo(); lathe(c, pr, 64, SATIN);
    for (var i = 0; i < c.p.length; i += 3) { var y = c.p[i + 1], z = c.p[i + 2]; c.p[i + 1] = -z; c.p[i + 2] = y; var ny = c.n[i + 1], nz = c.n[i + 2]; c.n[i + 1] = -nz; c.n[i + 2] = ny; } // face the viewer
    g.p = c.p; g.n = c.n; g.m = c.m;
    [1, -1].forEach(function (f) { // a polished flame raised on each face, its inner tongue raised a little higher
      var o = svgPath(FLAME_O, 0, 0, 0.075), i2 = svgPath(FLAME_I, 0, 0, 0.075);
      if (f < 0) { o = o.map(function (p) { return [-p[0], p[1]]; }); i2 = i2.map(function (p) { return [-p[0], p[1]]; }); }
      extrude(g, o, 0.06, 0.02, f * 0.1, GOLD);
      extrude(g, i2, 0.06, 0.016, f * 0.14, GOLD);
    });
    return g;
  }
  var MODELS = { key: modelKey, bmark: modelBookmark, end: modelEnd };

  /* ---------------- shading ---------------- */
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute float aM;uniform mat4 uPV;uniform mat4 uM;varying vec3 vN;varying vec3 vW;varying float vM;' +
    'void main(){vec4 w=uM*vec4(aP,1.0);vW=w.xyz;vN=mat3(uM)*aN;vM=aM;gl_Position=uPV*w;}';
  var FS = 'precision highp float;varying vec3 vN;varying vec3 vW;varying float vM;uniform vec3 uCam;uniform float uGlow;' +
    'vec3 env(vec3 d,float r){' +
    ' vec3 top=vec3(1.0,0.84,0.6)*0.62,hor=vec3(0.15,0.08,0.19),bot=vec3(0.03,0.02,0.05);' +
    ' vec3 c=mix(hor,top,smoothstep(-0.05,0.9,d.y));c=mix(c,bot,smoothstep(-0.05,-0.75,d.y));' +
    ' float s1=smoothstep(0.9-r*0.6,0.985-r*0.25,dot(d,normalize(vec3(-0.55,0.6,0.58))));' +
    ' float s2=smoothstep(0.84-r*0.6,0.97-r*0.25,dot(d,normalize(vec3(0.8,0.15,-0.45))));' +
    ' float s3=smoothstep(0.55-r*0.4,0.95,dot(d,normalize(vec3(0.0,-1.0,0.35))));' +
    ' float s4=smoothstep(0.9-r*0.6,0.985-r*0.25,dot(d,normalize(vec3(0.62,0.5,0.6))));' +
    ' float k=1.0-r*1.1;return c*(1.0-r*0.5)+(vec3(3.2,2.8,2.2)*s1+vec3(1.3,0.7,1.9)*s2+vec3(1.6,1.4,1.1)*s4)*k+vec3(2.6,1.15,0.3)*s3*uGlow;}' +
    'void main(){vec3 N=normalize(vN);vec3 V=normalize(uCam-vW);if(dot(N,V)<0.0)N=-N;float nv=max(dot(N,V),0.0);vec3 R=reflect(-V,N);' +
    ' vec3 L=normalize(vec3(-0.5,0.7,0.6));vec3 H=normalize(L+V);vec3 col;' +
    ' if(vM<0.5||vM>1.5){float r=vM>1.5?0.4:0.14;vec3 f0=vM>1.5?vec3(0.8,0.5,0.19):vec3(1.0,0.73,0.3);' +
    '  vec3 F=f0+(1.0-f0)*pow(1.0-nv,5.0)*0.55;col=env(R,r)*F+f0*0.06;' +
    '  col+=f0*pow(max(dot(N,H),0.0),vM>1.5?40.0:140.0)*(vM>1.5?0.9:2.2);}' +
    ' else{vec3 base=vec3(0.36,0.05,0.13);float dl=max(dot(N,L),0.0);float up=max(-N.y,0.0);' +
    '  col=base*(0.2+0.85*dl)+vec3(0.9,0.42,0.14)*up*0.35*uGlow+pow(1.0-nv,3.0)*vec3(0.55,0.32,0.6)*0.7+vec3(0.6,0.5,0.55)*pow(max(dot(N,H),0.0),24.0)*0.18;}' +
    ' col=(col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);gl_FragColor=vec4(pow(clamp(col,0.0,1.0),vec3(1.0/2.2)),1.0);}';

  function mat4mul(a, b) { var o = new Float32Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; }
  function trans(x, y, z) { var o = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]); return o; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  function scl(k) { return new Float32Array([k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1]); }

  function shader(gl, type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }

  function mount(canvas, kind, opts) {
    opts = opts || {};
    var gl = null;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl'); } catch (e) { gl = null; }
    if (!gl || !MODELS[kind]) return null;
    var prog;
    try {
      prog = gl.createProgram(); gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { return null; }
    var g = MODELS[kind](), cnt = g.p.length / 3;
    // centre the model and fit it to the view
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (var i = 0; i < g.p.length; i += 3) for (var k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], g.p[i + k]); mx[k] = Math.max(mx[k], g.p[i + k]); }
    var cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2, ext = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]), fit = 2.05 / ext;
    var bufs = [['aP', g.p, 3], ['aN', g.n, 3], ['aM', g.m, 1]].map(function (b) {
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b[1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, b[0]); return { buf: buf, loc: loc, size: b[2] };
    });
    var uPV = gl.getUniformLocation(prog, 'uPV'), uM = gl.getUniformLocation(prog, 'uM'), uCam = gl.getUniformLocation(prog, 'uCam'), uGlow = gl.getUniformLocation(prog, 'uGlow');
    var dist = 4.4, raf = 0, frames = 0, dead = false, t0 = performance.now(), last = t0, ang = opts.angle || 0, vel = 0, drag = null;
    var W0 = 22, WIDLE = kind === 'end' ? 1.6 : 1.25, TAU = 0.55; // a fast spin out of the chest that settles into a slow turn
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
    }
    function draw(now) {
      if (dead) return;
      size();
      var t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!opts.still) {
        if (drag) { /* the finger turns it */ } else { vel += ((WIDLE + (W0 - WIDLE) * Math.exp(-t / TAU)) - vel) * Math.min(1, dt * (t < 0.1 ? 60 : 3)); ang += vel * dt; }
      }
      var tilt = opts.still ? -0.12 : -0.12 + 0.07 * Math.sin(t * 1.3), sway = opts.still ? 0 : 0.05 * Math.sin(t * 0.9);
      var model = mat4mul(trans(0, 0, 0), mat4mul(rotX(tilt), mat4mul(rotZ(sway), mat4mul(rotY(ang), mat4mul(scl(fit), trans(-cx, -cy, 0))))));
      var asp = canvas.width / Math.max(1, canvas.height), pv = mat4mul(persp(0.5, asp, 0.1, 20), trans(0, 0, -dist));
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.useProgram(prog);
      bufs.forEach(function (b) { if (b.loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, b.buf); gl.enableVertexAttribArray(b.loc); gl.vertexAttribPointer(b.loc, b.size, gl.FLOAT, false, 0, 0); });
      gl.uniformMatrix4fv(uPV, false, pv); gl.uniformMatrix4fv(uM, false, model); gl.uniform3f(uCam, 0, 0, dist);
      gl.uniform1f(uGlow, 0.55 + 0.45 * Math.exp(-t / 2.5)); // the chest's light fades a little as it rises away
      gl.drawArrays(gl.TRIANGLES, 0, cnt);
      if (!opts.still || ++frames < 3) raf = requestAnimationFrame(draw);
    }
    // drag to spin it
    function px(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
    function down(e) { if (opts.still) return; drag = { x: px(e), t: performance.now(), v: 0 }; }
    function move(e) { if (!drag) return; var x = px(e), now = performance.now(), dx = x - drag.x, dtt = Math.max(1, now - drag.t); ang += dx * 0.018; drag.v = dx * 0.018 / (dtt / 1000); drag.x = x; drag.t = now; if (e.cancelable) e.preventDefault(); }
    function up() { if (!drag) return; vel = Math.max(-26, Math.min(26, drag.v)); drag = null; } // let go: it keeps the flick and slows back to its turn
    canvas.addEventListener('pointerdown', down); window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    function lost(e) { e.preventDefault(); dead = true; cancelAnimationFrame(raf); }
    canvas.addEventListener('webglcontextlost', lost);
    raf = requestAnimationFrame(draw);
    return {
      destroy: function () {
        dead = true; cancelAnimationFrame(raf);
        canvas.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        try { bufs.forEach(function (b) { gl.deleteBuffer(b.buf); }); gl.deleteProgram(prog); var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {}
      }
    };
  }
  var OK = null;
  function ok() { // asked once: a test context is let go straight away
    if (OK !== null) return OK;
    try { var c = document.createElement('canvas'), g = window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')); OK = !!g; if (g && g.getExtension('WEBGL_lose_context')) g.getExtension('WEBGL_lose_context').loseContext(); } catch (e) { OK = false; }
    return OK;
  }
  window.WaywardReward3D = { mount: mount, ok: ok, kinds: Object.keys(MODELS) };
})();
