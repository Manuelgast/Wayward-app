/* Wayward smoke: a small real-time fluid simulation (stable fluids on the GPU) used for the book's mist.
   Structure after Pavel Dobryakov's WebGL Fluid Simulation (MIT licence, github.com/PavelDoGreat/WebGL-Fluid-Simulation).
   The canvas never takes pointer events; fingers stir it through listeners on a target element. */
(function () {
  'use strict';
  var VERT = 'precision highp float;attribute vec2 aPosition;varying vec2 vUv,vL,vR,vT,vB;uniform vec2 texelSize;' +
    'void main(){vUv=aPosition*.5+.5;vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);gl_Position=vec4(aPosition,0.,1.);}';
  var HEAD = 'precision highp float;precision highp sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;';
  var FRAG = {
    clear: 'uniform sampler2D uTexture;uniform float value;void main(){gl_FragColor=value*texture2D(uTexture,vUv);}',
    splat: 'uniform sampler2D uTarget;uniform float aspectRatio;uniform vec3 color;uniform vec2 point;uniform float radius;' +
      'void main(){vec2 p=vUv-point.xy;p.x*=aspectRatio;vec3 s=exp(-dot(p,p)/radius)*color;gl_FragColor=vec4(texture2D(uTarget,vUv).xyz+s,1.);}',
    erase: 'uniform sampler2D uTarget;uniform float aspectRatio;uniform vec2 pa,pb;uniform float radius;uniform float amount;' + // wipe along a finger stroke (a capsule)
      'void main(){vec2 p=vUv-pa;vec2 b=pb-pa;p.x*=aspectRatio;b.x*=aspectRatio;float h=clamp(dot(p,b)/max(dot(b,b),1e-6),0.,1.);vec2 d=p-b*h;float g=exp(-dot(d,d)/radius);gl_FragColor=vec4(texture2D(uTarget,vUv).xyz*(1.-amount*g),1.);}',
    advection: 'uniform sampler2D uVelocity,uSource;uniform vec2 texelSize,dyeTexelSize;uniform float dt,dissipation;' +
      'vec4 bilerp(sampler2D sam,vec2 uv,vec2 ts){vec2 st=uv/ts-.5;vec2 i=floor(st);vec2 f=fract(st);vec4 a=texture2D(sam,(i+vec2(.5,.5))*ts);vec4 b=texture2D(sam,(i+vec2(1.5,.5))*ts);vec4 c=texture2D(sam,(i+vec2(.5,1.5))*ts);vec4 d=texture2D(sam,(i+vec2(1.5,1.5))*ts);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}' +
      'void main(){\n#ifdef MANUAL_FILTERING\nvec2 coord=vUv-dt*bilerp(uVelocity,vUv,texelSize).xy*texelSize;vec4 r=bilerp(uSource,coord,dyeTexelSize);\n#else\nvec2 coord=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize;vec4 r=texture2D(uSource,coord);\n#endif\ngl_FragColor=r/(1.+dissipation*dt);}',
    divergence: 'uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).x;float R=texture2D(uVelocity,vR).x;float T=texture2D(uVelocity,vT).y;float B=texture2D(uVelocity,vB).y;vec2 C=texture2D(uVelocity,vUv).xy;' +
      'if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.);}',
    curl: 'uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).y;float R=texture2D(uVelocity,vR).y;float T=texture2D(uVelocity,vT).x;float B=texture2D(uVelocity,vB).x;gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.);}',
    vorticity: 'uniform sampler2D uVelocity,uCurl;uniform float curl,dt;void main(){float L=texture2D(uCurl,vL).x;float R=texture2D(uCurl,vR).x;float T=texture2D(uCurl,vT).x;float B=texture2D(uCurl,vB).x;float C=texture2D(uCurl,vUv).x;' +
      'vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=curl*C;f.y*=-1.;vec2 v=texture2D(uVelocity,vUv).xy+f*dt;v=min(max(v,-1000.),1000.);gl_FragColor=vec4(v,0.,1.);}',
    pressure: 'uniform sampler2D uPressure,uDivergence;void main(){float L=texture2D(uPressure,vL).x;float R=texture2D(uPressure,vR).x;float T=texture2D(uPressure,vT).x;float B=texture2D(uPressure,vB).x;float d=texture2D(uDivergence,vUv).x;gl_FragColor=vec4((L+R+B+T-d)*.25,0.,0.,1.);}',
    gradient: 'uniform sampler2D uPressure,uVelocity;void main(){float L=texture2D(uPressure,vL).x;float R=texture2D(uPressure,vR).x;float T=texture2D(uPressure,vT).x;float B=texture2D(uPressure,vB).x;vec2 v=texture2D(uVelocity,vUv).xy;v-=vec2(R-L,T-B);gl_FragColor=vec4(v,0.,1.);}',
    display: 'uniform sampler2D uTexture;uniform float opacity;void main(){vec3 c=texture2D(uTexture,vUv).rgb;float a=clamp(max(c.r,max(c.g,c.b)),0.,1.);' +
      'vec3 col=c/max(a,.0001);col=mix(col,vec3(1.),clamp(a*.4,0.,.45));a=pow(a,.85)*opacity;gl_FragColor=vec4(col*a,a);}'
  };

  function create(host, opts) {
    opts = opts || {};
    var canvas = document.createElement('canvas'); canvas.className = 'fx-smoke';
    var params = { alpha: true, depth: false, stencil: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false };
    var gl = canvas.getContext('webgl2', params), isGL2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    if (!gl) return null;
    var halfType, linear, fmt;
    if (isGL2) { gl.getExtension('EXT_color_buffer_float'); linear = !!gl.getExtension('OES_texture_float_linear') || true; halfType = gl.HALF_FLOAT; fmt = { internal: gl.RGBA16F, format: gl.RGBA }; }
    else { var hf = gl.getExtension('OES_texture_half_float'); if (!hf) return null; linear = !!gl.getExtension('OES_texture_half_float_linear'); halfType = hf.HALF_FLOAT_OES; fmt = { internal: gl.RGBA, format: gl.RGBA }; }
    // check that we can render to half-float textures
    var probe = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, probe);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internal, 4, 4, 0, fmt.format, halfType, null);
    var pfb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, pfb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, probe, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
    gl.deleteFramebuffer(pfb); gl.deleteTexture(probe);
    host.appendChild(canvas);

    var mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    var weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3; // older phones: same smoke, a softer grid
    var C = { SIM: opts.sim || (weak ? 96 : 128), DYE: opts.dye || (weak ? 288 : mobile ? 384 : 512), DENS: opts.dissipation != null ? opts.dissipation : 0.5, VEL: opts.velDissipation != null ? opts.velDissipation : 0.25, PRESS: 0.8, ITER: opts.iter || (weak ? 10 : mobile ? 16 : 20), CURL: opts.curl != null ? opts.curl : 22, OPACITY: 1 };

    function compile(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    var vs = compile(gl.VERTEX_SHADER, VERT);
    function program(name, defs) {
      var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, (defs || '') + HEAD + FRAG[name]));
      gl.bindAttribLocation(p, 0, 'aPosition'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
      return { p: p, u: u, use: function () { gl.useProgram(p); } };
    }
    var P;
    try {
      P = { clear: program('clear'), splat: program('splat'), erase: program('erase'), adv: program('advection', linear ? '' : '#define MANUAL_FILTERING\n'), div: program('divergence'), curl: program('curl'), vort: program('vorticity'), press: program('pressure'), grad: program('gradient'), disp: program('display') };
    } catch (e) { window.__smokeErr = String(e && e.message || e); canvas.remove(); return null; }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);
    function blit(target) {
      if (target) { gl.viewport(0, 0, target.w, target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); }
      else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
    function fbo(w, h) {
      gl.activeTexture(gl.TEXTURE0); var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      var f = linear ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internal, w, h, 0, fmt.format, halfType, null);
      var fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex: tex, fbo: fb, w: w, h: h, tx: 1 / w, ty: 1 / h, attach: function (id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
    }
    function dfbo(w, h) { var a = fbo(w, h), b = fbo(w, h); return { w: w, h: h, tx: a.tx, ty: a.ty, read: a, write: b, swap: function () { var t = this.read; this.read = this.write; this.write = t; } }; }
    function res(r) { var ar = gl.drawingBufferWidth / gl.drawingBufferHeight; if (ar < 1) ar = 1 / ar; var mn = Math.round(r), mx = Math.round(r * ar); return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: mx, h: mn } : { w: mn, h: mx }; }

    var W = host.clientWidth, H = host.clientHeight, scale = Math.min(window.devicePixelRatio || 1, 2) * 0.5; // smoke is soft: half-resolution canvas, smoothly upscaled
    canvas.width = Math.max(2, Math.round(W * scale)); canvas.height = Math.max(2, Math.round(H * scale));
    var sr = res(C.SIM), dr = res(C.DYE);
    var dye = dfbo(dr.w, dr.h), vel = dfbo(sr.w, sr.h), divg = fbo(sr.w, sr.h), curlF = fbo(sr.w, sr.h), press = dfbo(sr.w, sr.h);
    var aspect = canvas.width / canvas.height;

    function splatRaw(x, y, dx, dy, color, radius) { // x,y in 0..1 (y up), radius in fraction of height
      var r = radius * radius * (aspect > 1 ? aspect : 1) * 0.1;
      P.splat.use(); gl.uniform1i(P.splat.u.uTarget, vel.read.attach(0)); gl.uniform1f(P.splat.u.aspectRatio, aspect);
      gl.uniform2f(P.splat.u.point, x, y); gl.uniform3f(P.splat.u.color, dx, dy, 0); gl.uniform1f(P.splat.u.radius, r); blit(vel.write); vel.swap();
      if (color) { gl.uniform1i(P.splat.u.uTarget, dye.read.attach(0)); gl.uniform3f(P.splat.u.color, color[0], color[1], color[2]); blit(dye.write); dye.swap(); }
    }
    function eraseRaw(ax, ay, bx, by, radius, amount) { // a finger wipes the smoke away along its stroke: one pass per frame
      var r = radius * radius * (aspect > 1 ? aspect : 1) * 0.1;
      P.erase.use(); gl.uniform1i(P.erase.u.uTarget, dye.read.attach(0)); gl.uniform1f(P.erase.u.aspectRatio, aspect);
      gl.uniform2f(P.erase.u.pa, ax, ay); gl.uniform2f(P.erase.u.pb, bx, by); gl.uniform1f(P.erase.u.radius, r); gl.uniform1f(P.erase.u.amount, amount); blit(dye.write); dye.swap();
    }
    function step(dt, realDt) {
      gl.disable(gl.BLEND);
      P.curl.use(); gl.uniform2f(P.curl.u.texelSize, vel.tx, vel.ty); gl.uniform1i(P.curl.u.uVelocity, vel.read.attach(0)); blit(curlF);
      P.vort.use(); gl.uniform2f(P.vort.u.texelSize, vel.tx, vel.ty); gl.uniform1i(P.vort.u.uVelocity, vel.read.attach(0)); gl.uniform1i(P.vort.u.uCurl, curlF.attach(1)); gl.uniform1f(P.vort.u.curl, C.CURL); gl.uniform1f(P.vort.u.dt, dt); blit(vel.write); vel.swap();
      P.div.use(); gl.uniform2f(P.div.u.texelSize, vel.tx, vel.ty); gl.uniform1i(P.div.u.uVelocity, vel.read.attach(0)); blit(divg);
      P.clear.use(); gl.uniform1i(P.clear.u.uTexture, press.read.attach(0)); gl.uniform1f(P.clear.u.value, C.PRESS); blit(press.write); press.swap();
      P.press.use(); gl.uniform2f(P.press.u.texelSize, vel.tx, vel.ty); gl.uniform1i(P.press.u.uDivergence, divg.attach(0));
      for (var i = 0; i < C.ITER; i++) { gl.uniform1i(P.press.u.uPressure, press.read.attach(1)); blit(press.write); press.swap(); }
      P.grad.use(); gl.uniform2f(P.grad.u.texelSize, vel.tx, vel.ty); gl.uniform1i(P.grad.u.uPressure, press.read.attach(0)); gl.uniform1i(P.grad.u.uVelocity, vel.read.attach(1)); blit(vel.write); vel.swap();
      P.adv.use(); gl.uniform2f(P.adv.u.texelSize, vel.tx, vel.ty); if (!linear) gl.uniform2f(P.adv.u.dyeTexelSize, vel.tx, vel.ty);
      var vid = vel.read.attach(0); gl.uniform1i(P.adv.u.uVelocity, vid); gl.uniform1i(P.adv.u.uSource, vid); gl.uniform1f(P.adv.u.dt, dt); gl.uniform1f(P.adv.u.dissipation, C.VEL); blit(vel.write); vel.swap();
      if (!linear) gl.uniform2f(P.adv.u.dyeTexelSize, dye.tx, dye.ty);
      gl.uniform1i(P.adv.u.uVelocity, vel.read.attach(0)); gl.uniform1i(P.adv.u.uSource, dye.read.attach(1)); gl.uniform1f(P.adv.u.dissipation, C.DENS * (realDt || dt) / dt); blit(dye.write); dye.swap();
    }
    function render() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      P.disp.use(); gl.uniform1i(P.disp.u.uTexture, dye.read.attach(0)); gl.uniform1f(P.disp.u.opacity, C.OPACITY); blit(null);
    }

    // fingers stir the smoke
    var target = opts.pointerTarget || host, last = null, lastT = 0;
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height }; }
    function onMove(e) {
      var p = pos(e), now = performance.now();
      if (last && now - lastT < 120) {
        var dx = p.x - last.x, dy = p.y - last.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.0005) {
          if (opts.wipe) { // the smoke parts and thins out along the finger's path (gathered, applied once per frame)
            if (!stroke) stroke = { a: [last.x, last.y], b: null, dx: 0, dy: 0 };
            stroke.b = [p.x, p.y]; stroke.dx += dx; stroke.dy += dy;
          } else queue.push([p.x, p.y, dx * 5200, dy * 5200, opts.stirDye ? [0.035, 0.03, 0.045] : null, 0.18]);
          kick();
        }
      }
      last = p; lastT = now;
    }
    function onDown(e) { last = pos(e); lastT = performance.now(); if (opts.wipe) { queue.push(['e', last.x, last.y, last.x, last.y, 0.08, 0.25]); kick(); } }
    target.addEventListener('pointermove', onMove, { passive: true });
    target.addEventListener('pointerdown', onDown, { passive: true });

    var queue = [], raf = 0, prev = 0, alive = true, idleUntil = 0, fade = null, stroke = null, half = false, odd = false, slowN = 0;
    var frames = 0, slowAcc = 0;
    function frame(now) {
      if (!alive) return; frames++;
      var realDt = Math.min(0.25, (now - (prev || now)) / 1000) || 0.0167, dt = Math.min(0.033, realDt); prev = now;
      if (frames > 3 && frames < 40) { slowAcc += realDt; if (frames === 39 && slowAcc / 36 > 0.06) C.ITER = 6; } // weak GPU: fewer pressure passes
      // if the phone can't hold 60 fps, the smoke moves at 30 steps a second (it drifts slowly, so it looks the same)
      // and the time it frees keeps the page, the video and the curl fluid
      if (realDt > 0.021) slowN = Math.min(40, slowN + 1); else slowN = Math.max(0, slowN - 1);
      if (!half && slowN > 12) half = true; // stays so for this smoke (it only lives a few seconds)
      odd = !odd;
      if (stroke && stroke.b) { queue.push(['e', stroke.a[0], stroke.a[1], stroke.b[0], stroke.b[1], 0.1, 0.8]); queue.push([stroke.b[0], stroke.b[1], stroke.dx * 2600, stroke.dy * 2600, null, 0.16]); stroke = null; }
      if (half && odd && !fade && queue.length === 0) { raf = requestAnimationFrame(frame); return; }
      while (queue.length) { var q = queue.shift(); if (q[0] === 'e') eraseRaw(q[1], q[2], q[3], q[4], q[5], q[6]); else splatRaw(q[0], q[1], q[2], q[3], q[4], q[5]); }
      step(half ? Math.min(0.033, realDt * 2) : dt, half ? realDt * 2 : realDt); render();
      if (fade) { var k = Math.max(0, 1 - (now - fade.t0) / fade.d); canvas.style.opacity = k; if (k <= 0) { destroy(); if (fade.cb) fade.cb(); return; } }
      if (now > idleUntil && !fade && opts.autoSleep !== false) { raf = 0; return; }
      raf = requestAnimationFrame(frame);
    }
    function kick(ms) { idleUntil = Math.max(idleUntil, performance.now() + (ms || 4000)); if (!raf && alive) { prev = 0; raf = requestAnimationFrame(frame); } }
    function destroy() {
      alive = false; if (raf) cancelAnimationFrame(raf);
      target.removeEventListener('pointermove', onMove); target.removeEventListener('pointerdown', onDown);
      var lose = gl.getExtension('WEBGL_lose_context'); canvas.remove(); if (lose) lose.loseContext();
      window.__smokeFrames = frames;
    }
    kick(1000);
    return {
      canvas: canvas,
      splat: function (xPx, yPx, dx, dy, color, radius) { queue.push([xPx / W, 1 - yPx / H, dx, -dy, color, radius || 0.25]); kick(); },
      set: function (o) { if (o.dissipation != null) C.DENS = o.dissipation; if (o.velDissipation != null) C.VEL = o.velDissipation; if (o.curl != null) C.CURL = o.curl; if (o.opacity != null) C.OPACITY = o.opacity; },
      awake: function (ms) { kick(ms); },
      fadeOut: function (ms, cb) { fade = { t0: performance.now(), d: ms || 1500, cb: cb }; kick(ms + 200); },
      destroy: destroy,
      size: { w: W, h: H }
    };
  }
  window.WaywardSmoke = { create: create };
})();
