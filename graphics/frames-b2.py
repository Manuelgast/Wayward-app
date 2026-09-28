import subprocess, urllib.parse, os
import sys
KIND = sys.argv[1] if len(sys.argv) > 1 else 'play'   # play: 1080x1920 (Google Play) · ios: 1320x2868 (App Store, iPhone 6.9")
SHOTS = [('1-mist', 'mist-' + ('1300' if KIND == 'play' else '700')), ('2-book', 'book'), ('3-choice', 'choice'), ('4-scene', 'scene-47'),
         ('5-map', 'map'), ('6-ending', 'ending'), ('7-relics', 'relic-card'), ('8-omen', 'omen-eyes+tentacle-2300')]
CAPS = {
 'en': ['Your mentor vanished *inside a mountain.*', 'The best maps *leave things out.*', 'Every choice *turns a page.*',
        'An old bell. *Somebody has to ring it.*', 'Some roads *stay in the fog.*', 'Nineteen endings. *Two of them are true.*',
        'Small truths, *hidden in the margins.*', 'Below you, *something is breathing.*'],
 'nl': ['Je leermeester verdween *in een berg.*', 'De beste kaarten *laten iets weg.*', 'Elke keuze *is een bladzijde.*',
        'Een oude klok. *Iemand moet hem luiden.*', 'Sommige wegen *blijven in de mist.*', 'Negentien eindes. *Twee zijn van goud.*',
        'Kleine waarheden, *verstopt in de marge.*', 'Onder je *ademt iets.*'],
}
RAW, OUT, TPL, W, H = ('raw-b2', 'store-b2', 'frame-b2.html', '1080', '1920') if KIND == 'play' else ('raw-ios', 'store-ios', 'frame-ios.html', '1320', '2868')
for lang in ('en', 'nl'):
    os.makedirs(OUT + '/' + lang, exist_ok=True)
    for (name, raw), cap in zip(SHOTS, CAPS[lang]):
        img = os.path.abspath('%s/%s-%s.png' % (RAW, lang, raw))
        src = TPL + '?' + urllib.parse.urlencode({'cap': cap, 'img': 'file://' + img})
        out = '%s/%s/phone-%s.png' % (OUT, lang, name)
        subprocess.run(['node', 'render.js', src, out, W, H], check=True)
        print(out)
