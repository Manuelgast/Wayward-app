// Store screenshots of the store build (app/www): 8 phone shots, 1080x1920 PNG, English UI.
// Phone: 412x732 CSS px at device scale 2.625 (renders 1082x1922; 1 px is cropped from each edge -> 1080x1920).
// Store mode with a fake Capacitor bridge (shop on, no test switch, own € prices), first-run mist already seen,
// no query switches, no debug overlays.  Usage: node store/screens.js [outDir] [only,comma,separated]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'en'));
const ONLY = (process.argv[3] || '').split(',').filter(Boolean);
const PORT = 8774, BASE = `http://127.0.0.1:${PORT}/index.html`;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: path.join(ROOT, 'app', 'www'), stdio: 'ignore' });
const want = (n) => !ONLY.length || ONLY.includes(n);
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

// reading progress that makes the library, the map and the endings look lived-in (internal page ids)
const SEED = {
  'hollow-mountain': { trail: [1, 22, 52, 43, 59, 69, 80], visited: [1, 6, 9, 11, 16, 14, 17, 22, 47, 52, 43, 59, 56, 71, 69, 80, 92, 19, 27, 12, 28],
    found: [11, 47, 56, 71, 92], relics: ['blankmap', 'dent', 'ia', 'rope', 'moon', 'compass'], scenes: [1, 9, 14, 16, 25, 27, 41, 47, 71], hint: 0, turns: 30 },
  'drowned-lighthouse': { trail: [], visited: [], found: [], relics: [], scenes: [], hint: 0, turns: 30 },
  'station-nine': { trail: [], visited: [], found: [], relics: [], scenes: [], hint: 0, turns: 30 },
  'ash-orchid': { trail: [], visited: [], found: [], relics: [], scenes: [], hint: 0, turns: 30 }
};
const STORE_KEY = { 'hollow-mountain': 'wayward.hollow-mountain.v1', 'drowned-lighthouse': 'wayward.drowned-lighthouse.v1', 'station-nine': 'wayward.station-nine.v1', 'ash-orchid': 'wayward.ash-orchid.v1' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const errors = [];
  async function page(book, extra) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 732 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'en-US' });
    await ctx.route('**/favicon.ico', r => r.fulfill({ status: 204, body: '' }));
    await ctx.addInitScript(([book, seed, keys, day, extra]) => {
      // the prices Google Play shows for these products (Play Console, 09-10: NL incl. VAT, en-US UI)
      const price = (id) => id === 'pass_monthly' ? '€4.99' : id === 'pass_lifetime' ? '€19.99' : /_c$/.test(id) ? '€0.99' : /_b$/.test(id) ? '€1.49' : '€1.99';
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {}, addListener: () => ({ remove() {} }),
        nativePromise: (pl, m, o) => Promise.resolve(m === 'isBillingSupported' ? { isBillingSupported: true }
          : m === 'getProducts' ? { products: ((o && o.productIdentifiers) || []).map(id => ({ identifier: id, priceString: price(id) })) }
          : m === 'getPurchases' ? { purchases: [] } : {}) };
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('wayward.prefs.v1', JSON.stringify({ lang: 'en', music: true, sfx: true, speed: 'fast', introDay: day, turns: 30, book: book }));
      for (const id in seed) localStorage.setItem(keys[id], JSON.stringify(Object.assign({}, seed[id], (extra || {})[id] || {})));
    }, [book, SEED, STORE_KEY, today(), extra]);
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(2500);
    return p;
  }
  const W = (p, fn, arg) => p.evaluate(fn, arg);
  async function snap(p, name) {
    const raw = path.join(OUT, name + '.raw.png');
    await p.screenshot({ path: raw });
    execFileSync('python3', ['-c', 'import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGB");w,h=im.size;l=(w-1080)//2;t=(h-1920)//2\nim.crop((l,t,l+1080,t+1920)).save(sys.argv[2],optimize=True)', raw, path.join(OUT, name + '.png')]);
    fs.unlinkSync(raw);
    console.log('shot', name);
  }
  // open a page in the reader, let the ink finish, and turn to the sheet with the choices
  async function readPage(p, id, firstSheet) {
    await W(p, (id) => window.__wayward.goTo(id), id);
    await p.waitForTimeout(2600);
    for (let i = 0; i < 30; i++) {
      const r = await W(p, (first) => { const w = window.__wayward, R = w.R; if (R.mode !== 'read' || R.turning) return 'wait'; if (R.revealing) { w.finishReveal(); return 'reveal'; } if (!first && R.idx < R.sheets.length - 1) { w.turnSheet(1); return 'turn'; } return 'done'; }, !!firstSheet);
      if (r === 'done') break;
      await p.waitForTimeout(r === 'wait' ? 400 : 1100);
    }
    await p.waitForTimeout(2600); // choices fade in, the scene settles
  }

  // 1 library: all four books on the shelf
  if (want('phone-1')) {
    const p = await page('hollow-mountain', { 'hollow-mountain': { page: 80 } });
    await W(p, () => window.__wayward.show('library')); await p.waitForTimeout(800);
    await W(p, (x) => { const s = document.querySelector('.shelf'); if (s) { s.scrollIntoView({ block: 'end' }); s.scrollLeft = x; } }, +(process.env.SHELF_X || 0)); // the shelf as it opens: Book IV fades out at the right edge (the shelf scrolls)
    await p.waitForTimeout(1500);
    await snap(p, 'phone-1'); await p.context().close();
  }
  // 2 Book I, the opening page with its choices
  if (want('phone-2')) {
    const p = await page('hollow-mountain', { 'hollow-mountain': { trail: [], visited: [], found: [], page: null } });
    await readPage(p, 1);
    await snap(p, 'phone-2'); await p.context().close();
  }
  // 3 an interactive scene (Book I, the lantern hall: "Look for yours")
  if (want('phone-3')) {
    const sceneP = +(process.env.SCENE_P || 25), sceneBook = process.env.SCENE_BOOK || 'hollow-mountain';
    const p = await page(sceneBook);
    await W(p, ([pg]) => { const s = window.__wayward.st(); s.scenes = s.scenes.filter(x => x !== pg); s.visited = s.visited.filter(x => x !== pg); window.__wayward.goTo(pg); }, [sceneP]);
    for (let i = 0; i < 40; i++) { if (await W(p, (pg) => { const s = window.__wayward.R.scn; return !!(s && s.p === pg && s.tPrompt > 0); }, sceneP)) break; await p.waitForTimeout(400); }
    await p.waitForTimeout(+(process.env.SCENE_WAIT || 1800));
    await snap(p, 'phone-3'); await p.context().close();
  }
  // 4 the path map
  if (want('phone-4')) {
    const p = await page('hollow-mountain', { 'hollow-mountain': { page: 80 } });
    await W(p, () => document.querySelector('.tab[data-tab="map"]').click()); await p.waitForTimeout(2500);
    for (let i = 0; i < +(process.env.MAP_OUT || 0); i++) { await W(p, () => { const z = [...document.querySelectorAll('#map button')].find(b => /Zoom out/.test(b.getAttribute('aria-label') || '')); if (z) z.click(); }); await p.waitForTimeout(700); }
    await snap(p, 'phone-4'); await p.context().close();
  }
  // 5 a relic: found in Book II's harbour
  if (want('phone-5')) {
    const relicBook = process.env.RELIC_BOOK || 'drowned-lighthouse', relicPage = +(process.env.RELIC_PAGE || 1);
    const p = await page(relicBook, { [relicBook]: { scenes: [relicPage], visited: [relicPage] } });
    await readPage(p, relicPage);
    await W(p, (rid) => { const rel = window.WaywardApp && window.WaywardApp.relics ? window.WaywardApp.relics().relics : []; const id = rid || (rel[0] && rel[0].id); const a = document.getElementById('app').getBoundingClientRect(); window.__wayward.foundRelic(id, { x: a.width / 2, y: a.height * 0.45 }); }, process.env.RELIC_ID || '');
    await p.waitForTimeout(2600);
    await snap(p, 'phone-5'); await p.context().close();
  }
  // 6 a Book III page
  if (want('phone-6')) {
    const id = +(process.env.B3_PAGE || 1);
    const p = await page('station-nine', { 'station-nine': { scenes: [id], visited: [] } });
    await readPage(p, id, process.env.B3_SHEET === 'first');
    await snap(p, 'phone-6'); await p.context().close();
  }
  // 7 a Book IV page (its opening sheet)
  if (want('phone-7')) {
    const id = +(process.env.B4_PAGE || 1);
    const p = await page('ash-orchid', { 'ash-orchid': { scenes: [id], visited: [] } });
    await readPage(p, id, (process.env.B4_SHEET || 'first') === 'first'); // the opening sheet: chapter heading and drop cap
    await snap(p, 'phone-7'); await p.context().close();
  }
  // 8 the shop: books and the Wayward Pass
  if (want('phone-8')) {
    const p = await page('hollow-mountain');
    await W(p, () => window.WaywardShop.open()); await p.waitForTimeout(1000);
    await W(p, (y) => { document.querySelector('#shopBody').scrollTop = y; }, +(process.env.SHOP_Y || 262)); // the four books, the price tiers line and both Pass plans in view
    await p.waitForTimeout(800);
    await snap(p, 'phone-8'); await p.context().close();
  }
  await b.close(); srv.kill();
  if (errors.length) { console.log('PAGE ERRORS:', errors.join(' | ')); process.exit(1); }
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
