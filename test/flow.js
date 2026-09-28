// Functional smoke test of the bundled app (www/) in mobile Chromium (same engine as Android WebView).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:8768/index.html';
const results = [];
const ok = (name, cond, extra) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); };

async function advance(p, to, maxSteps = 160) {
  for (let i = 0; i < maxSteps; i++) {
    const r = await p.evaluate((to) => {
      const vis = (el) => el && el.offsetParent !== null && !el.closest('[hidden]');
      const screen = document.querySelector('.screen:not([hidden])');
      const c = document.querySelector('.screen:not([hidden]) .choice[data-to="' + to + '"], .screen:not([hidden]) .mchoice[data-to="' + to + '"]');
      if (vis(c) && getComputedStyle(c.closest('.after') || c).opacity !== '0') { c.click(); return 'chose'; }
      const skip = document.getElementById('ilSkip'); if (vis(skip) && document.querySelector('.tome.scene')) { skip.click(); return 'skip-scene'; }
      const wipe = document.querySelector('.wipe-hint button'); if (vis(wipe)) { wipe.click(); return 'skip-wipe'; }
      const turn = document.querySelector('#turnBtn.on'); if (vis(turn)) { turn.click(); return 'turn'; }
      const lin = document.querySelector('.leaf.top .lin'); if (lin) { lin.click(); return 'tap'; }
      return 'wait:' + (screen && screen.id);
    }, to);
    if (r === 'chose') return true;
    await p.waitForTimeout(700);
  }
  return false;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const lang of ['en', 'nl']) { try {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: lang === 'nl' ? 'nl-NL' : 'en-US' });
    const p = await ctx.newPage();
    const errors = [], external = [], bad = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push('console: ' + m.text()); });
    p.on('request', r => { if (!r.url().startsWith('http://localhost:8768') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url()); });
    p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await p.goto(BASE);
    await p.evaluate(() => localStorage.setItem('wayward.prefs.v1', JSON.stringify({ speed: 'fast' })));
    await p.reload(); await p.waitForTimeout(2500);

    const title = await p.textContent('#library h1, #library .lib-title');
    ok(`[${lang}] library renders in right language`, lang === 'nl' ? /Welke kant|Welk pad/.test(title) : /Which way/.test(title), title.trim());
    const fontsOk = await p.evaluate(async () => { await document.fonts.ready; const fs = ['600 16px "Cormorant Garamond"', '400 16px Literata', '600 16px Manrope', '400 16px "EB Garamond"']; const r = []; for (const f of fs) r.push((await document.fonts.load(f)).length > 0); return r; });
    ok(`[${lang}] bundled fonts loaded`, fontsOk.every(Boolean), JSON.stringify(fontsOk));

    // back button on library -> not handled (app goes to background)
    ok(`[${lang}] back on library leaves app`, (await p.evaluate(() => window.__waywardBack())) === false);

    // open the book
    await p.click('#heroHit, #library .hero-hit');
    await p.waitForTimeout(1200);
    ok(`[${lang}] cover screen`, await p.isVisible('#cover'));
    ok(`[${lang}] back on cover -> library`, (await p.evaluate(() => window.__waywardBack())) === true && await p.waitForTimeout(800).then(() => p.isVisible('#library')));
    await p.click('#heroHit, #library .hero-hit'); await p.waitForTimeout(1000);
    await p.click('#coverGo'); await p.waitForTimeout(1500);

    // walk to ending XVII: 1 22 52 43 59 69 80 92 (includes a timed moment and a scene)
    const path = [22, 52, 56];
    let reached = true;
    for (const to of path) { if (!(await advance(p, to))) { reached = false; ok(`[${lang}] reach page ${to}`, false); break; } await p.waitForTimeout(900); }
    if (reached) {
      // finish the ending page
      for (let i = 0; i < 20; i++) {
        const done = await p.evaluate(() => { const e = document.querySelector('.screen:not([hidden]) [data-act="ending"]'); if (e && e.offsetParent) { e.click(); return true; } const t = document.querySelector('#turnBtn.on'); if (t) t.click(); else { const l = document.querySelector('.leaf.top .lin'); if (l) l.click(); } const s = document.getElementById('ilSkip'); if (s && s.offsetParent && document.querySelector('.tome.scene')) s.click(); return false; });
        if (done) break; await p.waitForTimeout(700);
      }
      await p.waitForTimeout(1500);
      ok(`[${lang}] ending screen reached`, await p.isVisible('#ending'), (await p.textContent('#ending .end-title').catch(() => '')).trim());
    }
    // audio contexts tracked + pause/resume
    const au = await p.evaluate(async () => { window.__waywardPause(); await new Promise(r => setTimeout(r, 300)); const vids = [...document.querySelectorAll('video')].filter(v => !v.paused).length; window.__waywardResume(); return { vids }; });
    ok(`[${lang}] pause stops all videos`, au.vids === 0);
    // tabs + back
    await p.evaluate(() => window.__waywardBack()); await p.waitForTimeout(800);
    ok(`[${lang}] back from ending -> library`, await p.isVisible('#library'));
    for (const tab of ['map', 'endings', 'relics']) {
      await p.evaluate((tab) => document.querySelector(`.tab[data-tab="${tab}"]`).click(), tab); await p.waitForTimeout(900);
      ok(`[${lang}] tab ${tab} opens`, await p.isVisible('#' + tab));
    }
    await p.evaluate(() => window.__waywardBack()); await p.waitForTimeout(700);
    ok(`[${lang}] back from relics -> library`, await p.isVisible('#library'));
    // settings sheet + back closes it
    await p.evaluate(() => document.querySelector('#library [data-settings]').click()); await p.waitForTimeout(500);
    const openS = await p.isVisible('#settings');
    await p.evaluate(() => window.__waywardBack()); await p.waitForTimeout(500);
    ok(`[${lang}] back closes settings sheet`, openS && !(await p.isVisible('#settings')));

    ok(`[${lang}] no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    ok(`[${lang}] no network outside the app`, external.length === 0, external.slice(0, 3).join(' '));
    ok(`[${lang}] no missing files`, bad.filter(x => !x.includes('favicon')).length === 0, bad.join(' '));
    await ctx.close();
  } catch (e) { ok(`[${lang}] run completed`, false, e.message.split('\n')[0]); } }
  await b.close();
  console.log(results.join('\n'));
})();
