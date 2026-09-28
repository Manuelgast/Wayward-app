import subprocess, urllib.parse, os
SHOTS = [('1-mist', 'mist-1300'), ('2-book', 'book'), ('3-choice', 'choice'), ('4-scene', 'scene-47'),
         ('5-map', 'map'), ('6-ending', 'ending'), ('7-relics', 'relic-card'), ('8-omen', 'omen-eyes+tentacle-2300')]
CAPS = {
 'en': ['Your mentor vanished *inside a mountain.*', 'The best maps *leave things out.*', 'Every choice *turns a page.*',
        'An old bell. *Somebody has to ring it.*', 'Some roads *stay in the fog.*', 'Nineteen endings. *Two of them are true.*',
        'Small truths, *hidden in the margins.*', 'Below you, *something is breathing.*'],
 'nl': ['Je leermeester verdween *in een berg.*', 'De beste kaarten *laten iets weg.*', 'Elke keuze *is een bladzijde.*',
        'Een oude klok. *Iemand moet hem luiden.*', 'Sommige wegen *blijven in de mist.*', 'Negentien eindes. *Twee zijn van goud.*',
        'Kleine waarheden, *verstopt in de marge.*', 'Onder je *ademt iets.*'],
}
for lang in ('en', 'nl'):
    os.makedirs('store-b2/' + lang, exist_ok=True)
    for (name, raw), cap in zip(SHOTS, CAPS[lang]):
        img = os.path.abspath('raw-b2/%s-%s.png' % (lang, raw))
        src = 'frame-b2.html?' + urllib.parse.urlencode({'cap': cap, 'img': 'file://' + img})
        out = 'store-b2/%s/phone-%s.png' % (lang, name)
        subprocess.run(['node', 'render.js', src, out, '1080', '1920'], check=True)
        print(out)
