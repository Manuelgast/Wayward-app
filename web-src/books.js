/* books.js — the shelf: which books exist, where their files are and what is particular to each (T10, brief B3).
   The first book is the default. A book's texts are <file>.<lang>.json, its relics <relics>; its interactive
   scenes come from <interludes> (Book I keeps its own in i18n.js and scenes2.js). Ids inside a book stay internal;
   readers see the page numbers 'nr' (tools/renumber.py). */
(function () {
  'use strict';
  window.WAYWARD_BOOKS = [
    { id: 'hollow-mountain', no: 1, sku: 'book_mountain', freeEndings: 8, totalEndings: 19, file: 'book', relics: 'relics.json', store: 'wayward.hollow-mountain.v1', cover: 'img/mountain-sm.webp', coverScene: 'mountain',
      spine: 'linear-gradient(90deg,#1E1240,#46307E 50%,#1E1240)', veil: 'fog', ui: 'compass', creep: { 22: 'fog' },
      roles: { edge: 'gilt', map: 'honestmap', secret: 'margin' } },
    { id: 'drowned-lighthouse', no: 2, sku: 'book_sea', freeEndings: 4, totalEndings: 19, file: 'book2', relics: 'relics2.json', interludes: 'interludes2.json', store: 'wayward.drowned-lighthouse.v1', cover: 'img/harbour-sm.webp', coverScene: 'harbour',
      spine: 'linear-gradient(90deg,#07262C,#15525A 50%,#07262C)', veil: 'sea', ui: 'grain', noVideo: true, creep: { 26: 'sea', 33: 'sea', 84: 'sea' },
      roles: { edge: 'salted', map: 'tidetable', secret: 'wake' },
      // positions on the pictures (GPT Image 2.5 flare, 30-09, T22), in % of the 9:16 frame: scenes and the two relics in the scenery
      // 12 the ship coming out of the fog · 18 the rake's track in the crust · 24 the traveller's lantern on the stair
      // 48 the lighthouse lying on the seabed · 67 the middle of the great lens · 93 the wick inside the lamp
      spots: { 12: [62, 46], 18: [64, 52], 24: [51, 60], 48: [52, 36], 67: [51, 24], 93: [53, 31] },
      // facelight: the drowned light in the water (under the page) · initials: the brass band at the foot of the lamp
      relicSpots: { facelight: [64, 70], initials: [53, 44] },
      grain: [63, 30], // the grain of salt on the cover (hold it until it melts)
      omens: { harbour: ['shadow', 'wind', 'drips'], office: ['quill', 'whisper', 'moth'], saltpans: ['wind', 'shadow'], cape: ['wind', 'shadow', 'eyes'],
        cottage: ['whisper', 'quill', 'moth'], baynight: ['eyes', 'tentacle', 'drips'], wreck: ['drips', 'whisper', 'quake'], stair: ['drips', 'tentacle', 'eyes'],
        seabed: ['tentacle', 'eyes', 'drips'], sunken: ['whisper', 'quake'], lanternroom: ['wind', 'quill'], storm: ['quake', 'wind', 'drips', 'shadow'], dawnsea: ['wind', 'shadow'] },
      // existing CC0 tracks, chosen by the mood RICHTING.md gives each place (new recordings come later)
      music: { harbour: 'village.mp3', office: 'library.mp3', saltpans: 'dawn.mp3', cape: 'ridge.mp3', cottage: 'lanternhall.mp3', baynight: 'lake.mp3', wreck: 'procession.mp3',
        stair: 'lake.mp3', seabed: 'river.mp3', sunken: 'chamber.mp3', lanternroom: 'heart.mp3', storm: 'bell.mp3', dawnsea: 'stairs.mp3' },
      light: { harbour: ['rgba(255,190,110,.4)', 'rgba(90,130,170,.35)'], office: ['rgba(255,190,110,.6)', 'rgba(120,90,60,.25)'], saltpans: ['rgba(255,236,240,.5)', 'rgba(170,200,210,.35)'],
        cape: ['rgba(170,200,220,.45)', 'rgba(90,140,150,.35)'], cottage: ['rgba(255,190,110,.55)', 'rgba(120,90,60,.3)'], baynight: ['rgba(255,190,90,.55)', 'rgba(40,110,130,.45)'],
        wreck: ['rgba(255,180,90,.5)', 'rgba(60,90,130,.4)'], stair: ['rgba(110,220,200,.5)', 'rgba(40,120,120,.4)'], seabed: ['rgba(80,200,190,.45)', 'rgba(20,80,90,.45)'],
        sunken: ['rgba(170,200,210,.4)', 'rgba(60,90,100,.35)'], lanternroom: ['rgba(150,230,190,.55)', 'rgba(60,120,100,.4)'], storm: ['rgba(170,190,230,.45)', 'rgba(40,50,80,.5)'],
        dawnsea: ['rgba(255,205,130,.7)', 'rgba(255,170,150,.35)'] } },
    { id: 'station-nine', no: 3, sku: 'book_stardust', freeEndings: 4, totalEndings: 18, file: 'book3', relics: 'relics3.json', interludes: 'interludes3.json', store: 'wayward.station-nine.v1', cover: 'img/platform-sm.webp', coverScene: 'platform',
      titleKey: 'bookStation', spine: 'linear-gradient(90deg,#0E2A22,#1F5A44 50%,#0E2A22)', veil: 'frost', ui: 'none', noVideo: true, creep: { 20: 'frost', 35: 'frost', 39: 'frost' },
      roles: { edge: 'firstclass', map: 'passengerlist', secret: 'luggagevan' },
      // Book III (CD, rewritten 30-09; T13 07-10). Scene positions are in interludes3.json (x/y, path, bell). 8 pictures new with GPT Image 2.5
      // (platform, dining, roof, observation, pass, station, city, tower); 6 kept from the first version (corridor, luggage, sleeper, post, engine, brakevan)
      omens: { platform: ['wind', 'shadow'], corridor: ['whisper', 'shadow'], luggage: ['quake', 'whisper'], dining: ['quill', 'moth'], sleeper: ['whisper', 'moth'], post: ['quill', 'whisper'],
        roof: ['wind', 'quake'], observation: ['wind', 'eyes'], engine: ['quake', 'drips'], brakevan: ['drips', 'whisper'], pass: ['wind', 'shadow'], station: ['quill', 'whisper'], city: ['wind', 'shadow'], tower: ['quill', 'moth'] },
      // existing CC0 tracks by mood (new recordings later)
      music: { platform: 'village.mp3', corridor: 'library.mp3', luggage: 'chamber.mp3', dining: 'lanternhall.mp3', sleeper: 'lake.mp3', post: 'library.mp3', roof: 'ridge.mp3',
        observation: 'dawn.mp3', engine: 'procession.mp3', brakevan: 'river.mp3', pass: 'ridge.mp3', station: 'chamber.mp3', city: 'stairs.mp3', tower: 'library.mp3' },
      light: { platform: ['rgba(255,214,160,.45)', 'rgba(170,200,230,.4)'], corridor: ['rgba(255,190,110,.55)', 'rgba(60,110,80,.3)'], luggage: ['rgba(255,190,110,.5)', 'rgba(110,90,60,.3)'],
        dining: ['rgba(255,236,200,.5)', 'rgba(150,200,170,.3)'], sleeper: ['rgba(200,214,240,.4)', 'rgba(60,80,110,.35)'], post: ['rgba(255,190,110,.5)', 'rgba(110,90,60,.3)'],
        roof: ['rgba(240,248,255,.55)', 'rgba(160,190,220,.4)'], observation: ['rgba(255,240,210,.55)', 'rgba(170,200,230,.35)'], engine: ['rgba(255,160,80,.55)', 'rgba(90,70,60,.35)'],
        brakevan: ['rgba(255,190,110,.5)', 'rgba(60,80,110,.35)'], pass: ['rgba(240,248,255,.55)', 'rgba(150,190,230,.4)'], station: ['rgba(255,220,160,.5)', 'rgba(170,190,210,.35)'],
        city: ['rgba(255,170,120,.65)', 'rgba(255,170,190,.35)'], tower: ['rgba(255,190,120,.55)', 'rgba(120,90,60,.3)'] } },
    { id: 'ash-orchid', no: 4, sku: 'book_ash', freeEndings: 4, totalEndings: 19, file: 'book4', relics: 'relics4.json', interludes: 'interludes4.json', store: 'wayward.ash-orchid.v1', cover: 'img/beach-sm.webp', coverScene: 'beach',
      titleKey: 'bookAsh', spine: 'linear-gradient(90deg,#3A0E08,#7A2A14 50%,#3A0E08)', veil: 'ash', ui: 'none', noVideo: true, creep: { 16: 'ash', 28: 'ash', 31: 'ash' },
      roles: { edge: 'salt', map: 'survey', secret: 'page0' },
      // Book IV (CD, rewritten 01-10; T13 07-10). 14 pictures with GPT Image 2.5 (07-10). The book's scenes 'storm' and 'dawn' are called
      // 'ashfall' and 'lastmorning' here (those picture names belong to Books I and II). Scene positions are in interludes4.json.
      omens: { beach: ['wind', 'shadow'], camp: ['whisper', 'moth'], glass: ['drips', 'eyes'], field: ['wind', 'quake'], vent: ['quake', 'wind'], cliff: ['wind', 'shadow'], lagoon: ['eyes', 'drips'],
        boat: ['drips', 'whisper'], ship: ['quill', 'whisper'], tent: ['quill', 'moth'], crater: ['quake', 'wind'], tunnel: ['drips', 'tentacle'], ashfall: ['quake', 'wind', 'shadow'], lastmorning: ['wind', 'quake'] },
      // existing CC0 tracks by mood (RICHTING: warm on the beach, low strings at the crater and in the ash-fall; new recordings later)
      music: { beach: 'dawn.mp3', camp: 'village.mp3', glass: 'river.mp3', field: 'dawn.mp3', vent: 'procession.mp3', cliff: 'ridge.mp3', lagoon: 'lake.mp3', boat: 'river.mp3',
        ship: 'library.mp3', tent: 'lanternhall.mp3', crater: 'heart.mp3', tunnel: 'chamber.mp3', ashfall: 'bell.mp3', lastmorning: 'stairs.mp3' },
      light: { beach: ['rgba(255,214,150,.55)', 'rgba(60,190,200,.35)'], camp: ['rgba(255,170,90,.6)', 'rgba(120,80,60,.3)'], glass: ['rgba(255,236,190,.55)', 'rgba(60,200,210,.35)'],
        field: ['rgba(255,220,140,.6)', 'rgba(160,150,140,.3)'], vent: ['rgba(255,236,170,.55)', 'rgba(200,190,90,.3)'], cliff: ['rgba(255,240,210,.5)', 'rgba(60,170,200,.35)'],
        lagoon: ['rgba(220,255,250,.5)', 'rgba(40,190,200,.4)'], boat: ['rgba(255,230,180,.5)', 'rgba(50,180,200,.35)'], ship: ['rgba(255,200,120,.6)', 'rgba(120,80,50,.3)'],
        tent: ['rgba(230,240,170,.5)', 'rgba(110,120,60,.3)'], crater: ['rgba(255,240,150,.6)', 'rgba(200,190,80,.35)'], tunnel: ['rgba(255,190,100,.55)', 'rgba(40,90,100,.4)'],
        ashfall: ['rgba(255,130,80,.55)', 'rgba(90,70,70,.45)'], lastmorning: ['rgba(255,200,170,.6)', 'rgba(255,170,150,.35)'] } }
  ];
  // store links shown in the shop (Apple and Google require them); the launch chat sets the public addresses
  window.WAYWARD_LINKS = window.WAYWARD_LINKS || { privacy: 'https://claude.ai/artifact/HCNZWpqhHH49A9dEmQw7t6', terms: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/' };
})();
