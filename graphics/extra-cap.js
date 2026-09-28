// Extra captures from the real build: feature source (book without text) and omens at chosen moments.
// VIEW=wxhxdsf and RAW=<folder> override the phone size and output folder (App Store set: VIEW=440x956x3 RAW=raw-ios)
const VIEW = (process.env.VIEW || '432x768x2.5').split('x').map(Number);
const RAWDIR = process.env.RAW || 'raw-b2';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [lang, what, delay] = [process.argv[2] || 'en', process.argv[3] || 'feature', +(process.argv[4] || 2200)];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'].concat(process.env.NOGL ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']) });
  const ctx = await b.newContext({ viewport: { width: VIEW[0], height: VIEW[1] }, deviceScaleFactor: VIEW[2], isMobile: true, hasTouch: true, locale: lang === 'nl' ? 'nl-NL' : 'en-US' });
  const p = await ctx.newPage();
  const vis = (sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && e.offsetParent !== null); }, sel);
  const page = what === 'feature' ? 1 : 14;
  await p.goto('http://localhost:8768/index.html');
  await p.evaluate(([l, pg]) => { localStorage.setItem('wayward.prefs.v1', JSON.stringify({ lang: l, speed: 'fast', introDay: '2999-1-1' })); localStorage.setItem('wayward.hollow-mountain.v1', JSON.stringify({ page: pg, trail: [1, pg], visited: [1, 6, 16, 14], found: [], relics: [], scenes: [9, 14], hint: 0, turns: 9 })); }, [lang, page]);
  await p.goto('http://localhost:8768/index.html'); await p.waitForTimeout(2500);
  await p.click('#heroHit'); await p.waitForTimeout(1500);
  await p.evaluate(() => document.getElementById('coverGo').click());
  await p.waitForTimeout(3000);
  for (let i = 0; i < 90 && !(await vis('#turnBtn.on')) && !(await vis('.screen:not([hidden]) .after.on')); i++) await p.waitForTimeout(1000);
  await p.waitForTimeout(1500);
  if (what === 'feature') {
    await p.addStyleTag({ content: '.lin{visibility:hidden!important}.topbar,.turn,.pfoot,.tap-hint,.look-ui{visibility:hidden!important}' });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${__dirname}/${RAWDIR}/${lang}-book-notext.png` });
  } else {
    await p.evaluate((kinds) => { const o = window.__wayward.omens(); kinds.split('+').forEach(k => {
      // eyes open at fixed spots (upper-left dark and the cave above) so every capture shows them; everything else stays random
      const R = Math.random, seq = k === 'eyes' ? [0.8, 0.1, 0.5, 0.9, 0.5] : []; let i = 0;
      Math.random = () => (i < seq.length ? seq[i++] : R());
      o.busy = false; o.play('river', k); Math.random = R;
    });
    // keep one pair of eyes, on the dark cave wall at the left (one of the app's own spots for the river), so it never hides behind the book
    document.querySelectorAll('.om-eyes').forEach((e, i) => { if (i === 0) { e.style.left = '16%'; e.style.top = '22%'; } else e.remove(); });
  }, what);
    await p.waitForTimeout(delay);
    await p.screenshot({ path: `${__dirname}/${RAWDIR}/${lang}-omen-${what}-${delay}.png` });
  }
  await b.close();
})();
