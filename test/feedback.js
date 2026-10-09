// Feedback button in the Play build: opens from Settings (and exists on the ending screen), builds a mailto with the Play version
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:8768/index.html';
const BUILD = process.argv[2] || 'Android 1.1.1 (6)';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let ok = true; const res = [];
  for (const lang of ['en', 'nl']) {
    const p = await (await b.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.evaluate(l => localStorage.setItem('wayward.prefs.v1', JSON.stringify({ lang: l, introDay: '2999-1-1' })), lang);
    await p.goto(BASE); await p.waitForTimeout(2000);
    await p.evaluate(() => { window.__mail = []; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.href.startsWith('mailto:')) { window.__mail.push(this.href); return; } return c.call(this); }; });
    await p.evaluate(() => { const s = [...document.querySelectorAll('[data-settings]')].find(e => e.offsetParent); if (s) s.click(); });
    await p.waitForTimeout(600);
    const btn = await p.evaluate(() => { const f = document.getElementById('fbOpenSettings'); return f && f.offsetParent ? f.textContent : null; });
    await p.evaluate(() => document.getElementById('fbOpenSettings').click());
    await p.waitForTimeout(400);
    const open = await p.evaluate(() => !document.getElementById('fbSheet').hidden);
    await p.fill('#fbMsg', 'Test from the Play build');
    await p.evaluate(() => document.querySelector('#fbCat button[data-cat="text"]').click());
    await p.evaluate(() => document.getElementById('fbSend').click());
    await p.waitForTimeout(300);
    const mail = await p.evaluate(() => window.__mail[0] || '');
    const q = new URLSearchParams(mail.split('?')[1] || '');
    const endBtn = await p.evaluate(() => !!document.querySelector('#ending #fbOpenEnding'));
    const pass = !!btn && open && mail.startsWith('mailto:voormanuel@gmail.com') && (q.get('body') || '').includes(BUILD) && endBtn && !errs.length;
    ok = ok && pass;
    res.push({ lang, btn, open, endBtn, subject: q.get('subject'), appLine: (q.get('body') || '').split('\n').find(l => l.startsWith('App')), errs });
  }
  console.log(JSON.stringify(res, null, 1));
  console.log(ok ? 'PASS feedback' : 'FAIL feedback');
  await b.close();
})();
