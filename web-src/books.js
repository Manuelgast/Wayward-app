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
      // positions on the pictures (OpenArt Seedream 5 Lite, 29-09), in % of the 720x1280 frame: scenes and the two relics in the scenery
      // 12 the ship coming out of the fog · 18 the rake's track in the crust · 24 the traveller's lantern on the stair
      // 48 the lighthouse lying on the seabed · 67 the middle of the great lens · 93 the wick inside the lamp
      spots: { 12: [48, 56], 18: [38, 62], 24: [46, 47], 48: [48, 50], 67: [52, 42], 93: [52, 52] },
      // facelight: the drowned light in the water (under the page) · initials: the brass band at the foot of the lamp
      relicSpots: { facelight: [50, 74], initials: [54, 61] },
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
    { id: 'station-nine', no: 3, sku: 'book_stardust', freeEndings: 4, soon: true, titleKey: 'bookStation', spine: 'linear-gradient(90deg,#1A0E3A,#3E2A7A 50%,#1A0E3A)', art: 'stardust' },
    { id: 'ash-orchid', no: 4, sku: 'book_ash', freeEndings: 4, soon: true, titleKey: 'bookAsh', spine: 'linear-gradient(90deg,#3A0E08,#7A2A14 50%,#3A0E08)', art: 'ash' }
  ];
  // store links shown in the shop (Apple and Google require them); the launch chat sets the public addresses
  window.WAYWARD_LINKS = window.WAYWARD_LINKS || { privacy: 'https://claude.ai/artifact/HCNZWpqhHH49A9dEmQw7t6', terms: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/' };
})();
