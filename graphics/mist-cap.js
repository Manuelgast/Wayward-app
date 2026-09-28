// Mist intro frame from the real build: one screenshot per run at a given delay after "Open the book".
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [lang, delay, notext] = [process.argv[2] || 'en', +(process.argv[3] || 300), process.argv[4] === 'notext'];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, locale: lang === 'nl' ? 'nl-NL' : 'en-US' });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8768/index.html');
  await p.evaluate((l) => { localStorage.setItem('wayward.prefs.v1', JSON.stringify({ lang: l, speed: 'fast', introDay: 'x' })); localStorage.setItem('wayward.hollow-mountain.v1', JSON.stringify({ page: null, trail: [], visited: [], found: [], relics: [], scenes: [], hint: 0, turns: 9 })); }, lang);
  await p.goto('http://localhost:8768/index.html?intro=full'); await p.waitForTimeout(2500);
  await p.click('#heroHit'); await p.waitForTimeout(1500);
  if (notext) await p.addStyleTag({ content: '.lin{visibility:hidden!important}.topbar,.turn,.pfoot,.tap-hint,.look-ui{visibility:hidden!important}' });
  await p.evaluate(() => document.getElementById('coverGo').click());
  await p.waitForTimeout(delay);
  await p.screenshot({ path: `${__dirname}/raw-b2/${lang}-mist-${delay}${notext ? '-notext' : ''}.png` });
  await b.close();
})();
