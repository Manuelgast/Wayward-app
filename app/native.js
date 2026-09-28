/* Wayward app shell glue (Android and iOS). Loaded before the app scripts; only active inside the Capacitor app.
   - Tracks AudioContexts so the whole soundscape pauses when the app goes to the background.
   - Handles the Android back button inside the app instead of closing it straight away.
   - On iOS (no back button) pause and resume follow the page visibility the web view reports. */
(function () {
  var isApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  document.documentElement.classList.toggle('native-app', isApp);

  // 1. Track audio contexts (audio.js creates them lazily).
  var contexts = [];
  ['AudioContext', 'webkitAudioContext'].forEach(function (name) {
    var Orig = window[name];
    if (!Orig) return;
    var Wrapped = class extends Orig {
      constructor() { super(...arguments); contexts.push(this); }
    };
    try { window[name] = Wrapped; } catch (e) {}
  });

  // Music players (new Audio()) are tracked too, so they stop decoding in the background.
  var players = [];
  if (window.Audio) {
    var OrigAudio = window.Audio;
    var WrappedAudio = class extends OrigAudio {
      constructor() { super(...arguments); players.push(this); }
    };
    try { window.Audio = WrappedAudio; } catch (e) {}
  }

  var pausedVideos = [];
  window.__waywardPause = function () {
    contexts.forEach(function (c) { try { if (c.state === 'running') c.suspend(); } catch (e) {} });
    pausedVideos = [];
    [].slice.call(document.querySelectorAll('video, audio')).concat(players).forEach(function (v) {
      if (!v.paused) { pausedVideos.push(v); try { v.pause(); } catch (e) {} }
    });
  };
  window.__waywardResume = function () {
    contexts.forEach(function (c) { try { if (c.state === 'suspended' || c.state === 'interrupted') c.resume(); } catch (e) {} });
    pausedVideos.forEach(function (v) { try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} });
    pausedVideos = [];
  };

  // iOS: the app going to the background hides the page; Android calls pause/resume from MainActivity instead.
  var platform = isApp && window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : 'web';
  document.documentElement.classList.toggle('native-ios', platform === 'ios');
  if (platform === 'ios') {
    document.addEventListener('visibilitychange', function () { if (document.hidden) window.__waywardPause(); else window.__waywardResume(); });
  }

  // 2. Android back button. Returns true when handled inside the app, false to let Android leave the app.
  function visible(el) { return !!el && !el.hidden && el.offsetParent !== null; }
  function click(el) { if (el) { el.click(); return true; } return false; }
  window.__waywardBack = function () {
    try {
      var card = document.querySelector('#cardHost > *');
      var sheetOpen = [].some.call(document.querySelectorAll('.sheet, .sheetbg'), function (s) { return !s.hidden; });
      if (card || sheetOpen) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return true;
      }
      var look = document.getElementById('lookBack');
      if (visible(look)) return click(look);
      var screen = document.querySelector('.screen:not([hidden])');
      if (!screen || screen.id === 'library') return false;
      if (screen.id === 'secret') return click(screen.querySelector('[data-go="relics"]'));
      if (screen.id === 'map') return click(document.getElementById('mapBack'));
      if (screen.id === 'moment') return true; // a timed moment: back does nothing, the fog decides
      var back = screen.querySelector('[data-go="library"]');
      if (back) return click(back);
      var home = document.querySelector('.tab[data-tab="library"]');
      return click(home);
    } catch (e) { return false; }
  };
})();
