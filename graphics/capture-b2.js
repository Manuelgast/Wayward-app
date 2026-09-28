// Brief B2: raw in-app captures (1080x1920) from the real build, per language.
// usage: node capture-b2.js en|nl [only]
// VIEW=wxhxdsf and RAW=<folder> override the phone size and output folder (App Store set: VIEW=440x956x3 RAW=raw-ios)
const VIEW = (process.env.VIEW || '432x768x2.5').split('x').map(Number);
const RAWDIR = process.env.RAW || 'raw-b2';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const lang = process.argv[2] || 'en';
const only = process.argv[3] || '';
const BASE = 'http://localhost:8768/index.html';
const OUT = __dirname + '/' + RAWDIR + '/';
const seedBase = {
  trail: [1], visited: [1, 6, 9, 11, 16, 14, 17, 22, 47, 52, 43, 59, 56, 71, 69, 80, 92, 19, 27, 12, 28],
  found: [11, 47, 56, 71, 92], finger: null, lastNew: null,
  relics: ['blankmap', 'dent', 'ia', 'rope', 'moon', 'compass'], scenes: [9, 14], hint: 0, turns: 9
};
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: VIEW[0], height: VIEW[1] }, deviceScaleFactor: VIEW[2], isMobile: true, hasTouch: true, locale: lang === 'nl' ? 'nl-NL' : 'en-US' });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  const snap = async (n) => { await p.screenshot({ path: `${OUT}${lang}-${n}.png` }); console.log('shot', lang, n); };
  const vis = (sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && e.offsetParent !== null); }, sel);
  const want = (n) => !only || only.split(',').includes(n);
  async function boot(page, extra, query) {
    await p.goto(BASE);
    await p.evaluate(([s, l]) => {
      localStorage.setItem('wayward.hollow-mountain.v1', JSON.stringify(s));
      localStorage.setItem('wayward.prefs.v1', JSON.stringify({ lang: l, music: true, sfx: true, speed: 'fast', introDay: 'x' }));
    }, [Object.assign({}, seedBase, { page: page }, extra || {}), lang]);
    await p.goto(BASE + (query || '')); await p.waitForTimeout(2500);
  }
  async function open() { await p.click('#heroHit'); await p.waitForTimeout(1300); await p.click('#coverGo'); }
  async function readToEnd(max = 90) { for (let i = 0; i < max && !(await vis('#turnBtn.on')) && !(await vis('.screen:not([hidden]) .after.on')); i++) await p.waitForTimeout(1000); }
  async function turnUntil(sel, max = 90) {
    for (let i = 0; i < max && !(await vis(sel)); i++) {
      await p.evaluate(() => { const t = document.querySelector('#turnBtn.on'); if (t) t.click(); });
      await p.waitForTimeout(1000);
    }
  }

  // 1 mist intro (full) over the prologue
  if (want('mist')) {
    await boot(1, { trail: [1] }, '?intro=full');
    await open();
    let t = 0; for (const ms of [700, 1300, 2100, 3200, 4500]) { await p.waitForTimeout(ms - t); t = ms; await snap('mist-' + ms); }
  }
  // 2 the old book in its world (prologue, text read) + feature source
  if (want('book')) {
    await boot(1, { trail: [1] });
    await open(); await p.waitForTimeout(3000); await readToEnd(); await p.waitForTimeout(1200);
    await snap('book');
  }
  // 3 a choice page
  if (want('choice')) {
    await boot(17, { trail: [1, 6, 16, 17] });
    await open(); await p.waitForTimeout(3000); await readToEnd();
    await turnUntil('.screen:not([hidden]) .choice[data-to="25"]');
    await p.waitForTimeout(2500); await snap('choice');
  }
  // 4 interactive scene: the bell rope (p47) and the misted window (p9)
  if (want('scene')) {
    for (const pg of [47, 9]) {
      await boot(pg, { trail: [1, pg], scenes: [14] });
      await open(); await p.waitForTimeout(2500);
      for (let i = 0; i < 90 && !(await vis('.tome.scene')); i++) {
        await p.evaluate(() => { const t = document.querySelector('#turnBtn.on'); if (t) t.click(); const r = document.querySelector('.screen:not([hidden]) [data-act="scene"]'); if (r && r.offsetParent) r.click(); });
        await p.waitForTimeout(1000);
      }
      await p.waitForTimeout(4200); await snap('scene-' + pg);
    }
  }
  // 5 path map
  if (want('map')) {
    await boot(17, { trail: [1, 22, 52, 43, 59, 69, 80, 92], page: 92 });
    await p.evaluate(() => document.querySelector('.tab[data-tab="map"]').click()); await p.waitForTimeout(2000);
    await snap('map');
  }
  // 6 an ending
  if (want('ending')) {
    await boot(92, { trail: [1, 22, 52, 43, 59, 69, 80, 92], found: [11, 47, 56, 71], lastNew: null });
    await open(); await p.waitForTimeout(2500);
    for (let i = 0; i < 120 && !(await vis('#ending')); i++) {
      await p.evaluate(() => { const e = document.querySelector('.screen:not([hidden]) [data-act="ending"]'); if (e && e.offsetParent && getComputedStyle(e.closest('.after') || e).opacity !== '0') { e.click(); return; } const t = document.querySelector('#turnBtn.on'); if (t) t.click(); });
      await p.waitForTimeout(1000);
    }
    await p.waitForTimeout(2500); await snap('ending');
  }
  // 7 relics
  if (want('relics')) {
    await boot(17, {});
    await p.evaluate(() => document.querySelector('.tab[data-tab="relics"]').click()); await p.waitForTimeout(1500);
    await snap('relics');
    await p.evaluate(() => { const r = document.querySelector('#relics [data-relic]'); if (r) r.click(); }); await p.waitForTimeout(1800);
    await snap('relic-card');
  }
  // 8 an omen by the black river (p14): tentacle, and drips
  if (want('omen')) {
    for (const kind of ['tentacle', 'drips', 'eyes']) {
      await boot(14, { trail: [1, 16, 14], scenes: [9, 14] });
      await open(); await p.waitForTimeout(3000); await readToEnd(); await p.waitForTimeout(800);
      await p.evaluate((k) => { const o = window.__wayward && window.__wayward.omens(); if (o) { o.busy = false; o.play('river', k); } }, kind);
      await p.waitForTimeout(kind === 'tentacle' ? 1900 : kind === 'drips' ? 2600 : 1600); await snap('omen-' + kind);
    }
  }
  await b.close();
})();
