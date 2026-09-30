#!/usr/bin/env python3
"""Build www/ (what goes inside the Android app) from web-src/ (the latest Wayward web version).

Usage: python3 scripts/build_www.py [path/to/web-src]
- copies every file of the web version
- replaces Google Fonts (network) with bundled font files, so the app works fully offline
- injects native.js (Android back button + pause audio in background)
"""
import json
import os, re, shutil, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'web-src'))
OUT = os.path.join(ROOT, 'www')
NM = os.path.join(ROOT, 'node_modules')

VARIABLE = {'Literata': ['@fontsource-variable/literata/opsz.css', '@fontsource-variable/literata/opsz-italic.css']}


def font_css_from_google(html):
    """Read the Google Fonts URL in index.html and map every family/weight/style to a bundled fontsource file."""
    import urllib.parse
    out = []
    for url in re.findall(r'https://fonts\.googleapis\.com/css2\?[^"\'>]+', html):
        q = urllib.parse.urlparse(url.replace('&amp;', '&')).query
        for fam in urllib.parse.parse_qs(q).get('family', []):
            name, _, spec = fam.partition(':')
            name = name.replace('+', ' ')
            if name in VARIABLE:
                out += [(p, name) for p in VARIABLE[name]]
                continue
            slug = name.lower().replace(' ', '-')
            combos = set()
            if not spec:
                combos.add((0, 400))
            else:
                axes, _, vals = spec.partition('@')
                axes = axes.split(',')
                for tup in vals.split(';'):
                    v = dict(zip(axes, tup.split(',')))
                    combos.add((int(v.get('ital', 0)), int(float(v.get('wght', 400)))))
            for ital, w in sorted(combos):
                out.append(('@fontsource/%s/%d%s.css' % (slug, w, '-italic' if ital else ''), name))
    return out
KEEP_SUBSETS = ('-latin-', '-latin-ext-')


def build_fonts(out_dir, font_css):
    fdir = os.path.join(out_dir, 'fonts')
    os.makedirs(fdir, exist_ok=True)
    faces = []
    for rel, family in font_css:
        path = os.path.join(NM, rel)
        if not os.path.isfile(path):
            sys.exit('Missing font package for %s: npm i -D %s' % (family, '/'.join(rel.split('/')[:2])))
        css = open(path, encoding='utf-8').read()
        for block in re.findall(r'@font-face\s*{[^}]*}', css):
            m = re.search(r"url\(\./files/([^)]+?\.woff2)\)", block)
            if not m:
                continue
            fname = m.group(1)
            if not any(s in fname for s in KEEP_SUBSETS):
                continue
            if '-latin-ext-' not in fname and '-latin-' not in fname:
                continue
            shutil.copy(os.path.join(os.path.dirname(path), 'files', fname), os.path.join(fdir, fname))
            b = re.sub(r"font-family:\s*'[^']+'", "font-family: '%s'" % family, block)
            b = re.sub(r"src:[^;]+;", "src: url(%s) format('woff2');" % fname, b)
            faces.append(b)
    with open(os.path.join(fdir, 'fonts.css'), 'w', encoding='utf-8') as f:
        f.write('/* Bundled fonts (SIL Open Font License), latin + latin-ext only. */\n')
        f.write('\n'.join(faces) + '\n')
    return len(faces)


def sync_admob_app_ids():
    """The AdMob app ids live in store-config.json; copy them into the native projects so they never drift."""
    cfg = json.load(open(os.path.join(ROOT, 'store-config.json'), encoding='utf-8')).get('ads', {})
    targets = [
        (os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
         r'(<string name="admob_app_id">)[^<]*(</string>)', cfg.get('android', {}).get('appId')),
        (os.path.join(ROOT, 'ios', 'App', 'App', 'Info.plist'),
         r'(<key>GADApplicationIdentifier</key>\s*<string>)[^<]*(</string>)', cfg.get('ios', {}).get('appId')),
    ]
    for path, pat, app_id in targets:
        if not app_id or not os.path.isfile(path):
            continue
        src = open(path, encoding='utf-8').read()
        new, k = re.subn(pat, lambda m: m.group(1) + app_id + m.group(2), src)
        if not k:
            sys.exit('AdMob app id slot not found in %s' % path)
        if new != src:
            open(path, 'w', encoding='utf-8').write(new)
            print('AdMob app id set in %s' % os.path.relpath(path, ROOT))


def main():
    if not os.path.isfile(os.path.join(SRC, 'index.html')):
        sys.exit('No index.html in %s' % SRC)
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    shutil.copytree(SRC, OUT)
    n = build_fonts(OUT, font_css_from_google(open(os.path.join(OUT, 'index.html'), encoding='utf-8').read()))
    shutil.copy(os.path.join(ROOT, 'native.js'), os.path.join(OUT, 'native.js'))
    # the Play version (from build.gradle) goes into feedback mails, so every report says which build it came from
    gradle = open(os.path.join(ROOT, 'android', 'app', 'build.gradle'), encoding='utf-8').read()
    vn = re.search(r'versionName "([^"]+)"', gradle).group(1)
    vc = re.search(r'versionCode (\d+)', gradle).group(1)
    build = '%s (%s)' % (vn, vc)
    nj = os.path.join(OUT, 'native.js')
    glue = open(nj, encoding='utf-8').read()
    # same version on both platforms; the platform name is filled in on the phone
    open(nj, 'w', encoding='utf-8').write("window.WAYWARD_BUILD = ((window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios') ? 'iOS ' : 'Android ') + '%s';\n" % build + glue)
    fb = os.path.join(OUT, 'feedback.js')
    if os.path.isfile(fb):
        src = open(fb, encoding='utf-8').read()
        hook = 'function getVersion() {'
        if hook in src:
            src = src.replace(hook, hook + "\n    if (window.WAYWARD_BUILD) return window.WAYWARD_BUILD;", 1)
            open(fb, 'w', encoding='utf-8').write(src)
        else:
            print('WARNING: feedback.js has no getVersion(); feedback mails will not carry the Play version')
    notices =open(os.path.join(ROOT, 'THIRD_PARTY_NOTICES.txt'), encoding='utf-8').read()
    credits = os.path.join(OUT, 'music', 'CREDITS.txt')
    if os.path.isfile(credits):
        notices += '\n\nMusic (music/CREDITS.txt)\n------------------------\n' + open(credits, encoding='utf-8').read()
    open(os.path.join(OUT, 'THIRD_PARTY_NOTICES.txt'), 'w', encoding='utf-8').write(notices)

    p = os.path.join(OUT, 'index.html')
    html = open(p, encoding='utf-8').read()
    # drop every Google Fonts link / preconnect, add the bundled stylesheet once
    html, k = re.subn(r'<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*', '', html)
    shutil.copy(os.path.join(ROOT, 'native.css'), os.path.join(OUT, 'native.css'))
    tag = '<link rel="stylesheet" href="fonts/fonts.css"><link rel="stylesheet" href="native.css">'
    html = html.replace('</head>', tag + '</head>', 1) if '</head>' in html else tag + '\n' + html
    # native glue before the first app script
    first_script = re.search(r'<script src="[^"]+"></script>', html)
    if not first_script:
        sys.exit('No <script src> found in index.html')
    glue = '<script src="native.js"></script>\n'
    # store bridge (real purchases + rewarded ads) only for a web book that has a shop
    sync_admob_app_ids()
    if os.path.isfile(os.path.join(OUT, 'shop.js')):
        shutil.copy(os.path.join(ROOT, 'store.js'), os.path.join(OUT, 'store.js'))
        cfg = json.load(open(os.path.join(ROOT, 'store-config.json'), encoding='utf-8'))
        cfg.pop('_note', None)
        glue += '<script>window.WAYWARD_STORE = %s;</script>\n<script src="store.js"></script>\n' % json.dumps(cfg, separators=(',', ':'))
        print('store bridge included (%d products, ads %s)' % (len(cfg.get('products', [])), 'TEST ids' if cfg.get('ads', {}).get('testing') else 'live ids'))
    html = html[:first_script.start()] + glue + html[first_script.start():]
    left = re.findall(r'https?://(?!www\.w3\.org)[^\s"\')]+', html)
    open(p, 'w', encoding='utf-8').write(html)

    for js in glob.glob(os.path.join(OUT, '*.js')):
        for u in re.findall(r'https?://(?!www\.w3\.org)[^\s"\')]+', open(js, encoding='utf-8').read()):
            left.append(os.path.basename(js) + ': ' + u)
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print('www built from %s: %d font faces, %d Google Fonts tags removed, %.1f MB' % (SRC, n, k, size / 1e6))
    if left:
        print('WARNING: external URLs still present:', left)


if __name__ == '__main__':
    main()
