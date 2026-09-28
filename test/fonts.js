const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  p.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(2500);
  await p.click('#library .hero-hit'); await p.waitForTimeout(800); await p.click('#coverGo'); await p.waitForTimeout(4000);
  console.log(await p.evaluate(async () => { await document.fonts.ready; const out = []; document.fonts.forEach(f => { if (f.status === 'loaded') out.push(f.family + ' ' + f.weight + ' ' + f.style); }); return [...new Set(out)].join('\n') + '\nchecks: ' + JSON.stringify([document.fonts.check('600 16px "Cormorant Garamond"'), document.fonts.check('400 16px Literata'), document.fonts.check('italic 400 16px Literata')]); }));
  await b.close();
})();
