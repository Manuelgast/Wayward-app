const { chromium } = require('/opt/node22/lib/node_modules/playwright');
// usage: node render.js file.html?query out.png width height [transparent]
(async () => {
  const [src, out, w, h, tr, dsf] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(dsf||1) });
  await p.goto('file://' + require('path').resolve(src.split('?')[0]) + (src.includes('?') ? '?' + src.split('?')[1] : ''));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: out, omitBackground: tr === 'transparent' });
  await b.close();
})();
