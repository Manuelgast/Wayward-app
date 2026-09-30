/* feedback.js — Wayward in-app feedback.
   Self-contained: injects its own CSS/DOM, adds a "Feedback geven" / "Send
   feedback" entry in the Settings sheet and a small "Feedback" entry on the
   Ending screen, and delivers the report as a mailto: link. There is no
   backend: nothing is sent or stored by the app itself, only handed to the
   phone's own mail app. Loads after app.js in both the v4.4 (proto) and the
   v4.5 (proto45) build, once window.__wayward already exists. */
(function () {
  'use strict';
  if (window.__waywardFeedbackReady) return;
  window.__waywardFeedbackReady = true;

  var MAILTO_TO = 'voormanuel@gmail.com';
  var DRAFT_KEY = 'wayward.feedback.draft.v1';
  var PREF_KEY = 'wayward.prefs.v1';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var app = document.getElementById('app');
  if (!app) return; // nothing to attach to — bail out quietly

  /* ---------------- strings (EN/NL) ---------------- */
  var STR = {
    en: {
      settingsBtn: 'Send feedback',
      endingBtn: 'Feedback',
      title: 'Send feedback',
      catLabel: 'What is it about?',
      cats: [
        { id: 'broken', seg: 'Broken', aria: "Something's broken", subj: 'Broken' },
        { id: 'idea', seg: 'Idea', aria: 'An idea', subj: 'Idea' },
        { id: 'text', seg: 'Text', aria: "Text doesn't read right", subj: 'Text' },
        { id: 'other', seg: 'Other', aria: 'Something else', subj: 'Other' }
      ],
      placeholder: 'Describe what you mean…',
      cancel: 'Cancel',
      send: 'Send',
      thanksTitle: 'Thanks!',
      thanksBody: 'Your mail app should be open now, ready to send. We read every message.',
      screens: { library: 'library', cover: 'cover', reader: 'reader', moment: 'moment', map: 'map', relics: 'relics', endings: 'endings', ending: 'ending', settings: 'settings', credits: 'credits', secret: 'secret' },
      pageWord: 'page',
      lines: { app: 'App', screen: 'Screen', page: 'Page', lang: 'Language', size: 'Screen size', ua: 'User agent' }
    },
    nl: {
      settingsBtn: 'Feedback geven',
      endingBtn: 'Feedback',
      title: 'Feedback geven',
      catLabel: 'Waar gaat het over?',
      cats: [
        { id: 'broken', seg: 'Kapot', aria: 'Iets is stuk', subj: 'Kapot' },
        { id: 'idea', seg: 'Idee', aria: 'Een idee', subj: 'Idee' },
        { id: 'text', seg: 'Tekst', aria: 'Tekst leest niet lekker', subj: 'Tekst' },
        { id: 'other', seg: 'Anders', aria: 'Iets anders', subj: 'Anders' }
      ],
      placeholder: 'Beschrijf wat je bedoelt…',
      cancel: 'Annuleren',
      send: 'Versturen',
      thanksTitle: 'Bedankt!',
      thanksBody: 'Je mailapp zou nu open moeten staan, klaar om te versturen. We lezen alles.',
      screens: { library: 'bibliotheek', cover: 'omslag', reader: 'lezer', moment: 'moment', map: 'kaart', relics: 'relikwieën', endings: 'einden', ending: 'einde', settings: 'instellingen', credits: 'colofon', secret: 'geheim' },
      pageWord: 'bladzijde',
      lines: { app: 'App', screen: 'Scherm', page: 'Bladzijde', lang: 'Taal', size: 'Schermgrootte', ua: 'User agent' }
    }
  };

  /* ---------------- language: follow the app ---------------- */
  function getLang() {
    try { if (window.__wayward && typeof window.__wayward.prefs === 'function') { var p = window.__wayward.prefs(); if (p && (p.lang === 'nl' || p.lang === 'en')) return p.lang; } } catch (e) {}
    try { var raw = localStorage.getItem(PREF_KEY); if (raw) { var o = JSON.parse(raw); if (o && (o.lang === 'nl' || o.lang === 'en')) return o.lang; } } catch (e) {}
    try { var btn = $('#setLang button[aria-pressed="true"]'); if (btn) { var l = btn.getAttribute('data-lang'); if (l === 'nl' || l === 'en') return l; } } catch (e) {}
    try { if (/^nl\b/i.test(navigator.language || '')) return 'nl'; } catch (e) {}
    return 'en';
  }

  /* ---------------- app version ----------------
     No shared version constant exists between builds, so this is detected:
     the dev/test title carries it ("Wayward 4.5 test"); failing that, shop.js
     (WaywardShop) only exists in the 4.5 build, proto lacks it entirely. */
  function getVersion() {
    try { var m = /(\d+\.\d+)/.exec(document.title || ''); if (m) return m[1]; } catch (e) {}
    try { if (window.WaywardShop) return '4.5'; } catch (e) {}
    return '4.4';
  }

  /* ---------------- current screen / page (best effort) ---------------- */
  function currentScreenId() {
    try { var s = document.getElementById('settings'); if (s && !s.hidden) return 'settings'; } catch (e) {}
    try { var c = document.getElementById('credits'); if (c && !c.hidden) return 'credits'; } catch (e) {}
    try { if (window.__wayward && typeof window.__wayward.current === 'function') return window.__wayward.current() || ''; } catch (e) {}
    return '';
  }
  function currentPageNum() {
    try { var W = window.__wayward; if (W && W.R && W.R.p) { var n = W.pn ? W.pn(W.R.p) : W.R.p, bk = W.book && W.book() && W.book().no > 1 ? 'B' + W.book().no + ' ' : ''; return bk + (n === W.R.p ? n : n + ' (#' + W.R.p + ')'); } } catch (e) {} // the number the reader sees, plus the internal id
    return null;
  }

  /* ---------------- draft (kept while typing) ---------------- */
  function loadDraft() { try { var raw = localStorage.getItem(DRAFT_KEY); if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') return o; } } catch (e) {} return null; }
  function saveDraft(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {} }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  /* ---------------- CSS (own classes; no backdrop-filter/blur; transform+opacity only) ---------------- */
  var css = ''
    + '#fbBackdrop{position:absolute;inset:0;z-index:39;background:rgba(5,3,15,.55);animation:fbFade .18s ease}'
    + '@keyframes fbFade{from{opacity:0}to{opacity:1}}'
    + '#fbSheet{z-index:40;max-height:min(76vh,560px);overflow-y:auto;-webkit-overflow-scrolling:touch;background:linear-gradient(180deg,rgba(40,28,80,.96),rgba(14,10,34,.98));border:1px solid rgba(255,255,255,.15);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 12px 30px rgba(5,3,15,.5)}'
    + '#fbSheet .fb-hint{margin:0;font-family:var(--read);font-size:13px;line-height:1.4;color:var(--muted)}'
    + '#fbCat{justify-content:flex-start}'
    + '#fbMsg{width:100%;box-sizing:border-box;min-height:104px;max-height:38vh;padding:11px 12px;border-radius:14px;background:rgba(10,8,24,.55);border:1px solid rgba(255,255,255,.16);color:var(--text);font:16px/1.45 var(--sans);resize:vertical}'
    + '#fbMsg::placeholder{color:var(--dim)}'
    + '#fbMsg:focus{outline:2px solid var(--gold2);outline-offset:1px}'
    + '#fbSend:disabled{opacity:.42;pointer-events:none}'
    + '#fbThanks{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:8px 4px 4px}'
    + '#fbThanks .fb-check{width:52px;height:52px;border-radius:999px;background:linear-gradient(180deg,#FDE7A8,#C58C34);display:grid;place-items:center;color:#2A1A05;box-shadow:0 8px 18px rgba(0,0,0,.35)}'
    + '#fbThanks .fb-check svg{width:26px;height:26px}'
    + '#fbThanks p{margin:2px 0 0;font-family:var(--read);font-size:13.5px;line-height:1.5;color:var(--muted)}';
  var styleEl = document.createElement('style');
  styleEl.id = 'fbStyles';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------------- DOM ---------------- */
  var backdrop = document.createElement('div');
  backdrop.id = 'fbBackdrop'; backdrop.hidden = true;

  var sheet = document.createElement('div');
  sheet.className = 'sheet'; sheet.id = 'fbSheet'; sheet.hidden = true;
  sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'fbTitle');
  sheet.innerHTML =
    '<h3 id="fbTitle"></h3>'
    + '<div id="fbForm">'
    +   '<p class="fb-hint" id="fbCatLabel"></p>'
    +   '<div class="seg" id="fbCat"></div>'
    +   '<textarea id="fbMsg" rows="4" maxlength="1500"></textarea>'
    +   '<div class="row2" style="margin-top:2px">'
    +     '<button type="button" class="btn-glass" id="fbCancel"></button>'
    +     '<button type="button" class="btn-gold sm" id="fbSend" disabled></button>'
    +   '</div>'
    + '</div>'
    + '<div id="fbThanks" hidden>'
    +   '<div class="fb-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg></div>'
    +   '<p id="fbThanksBody"></p>'
    + '</div>';
  app.appendChild(backdrop);
  app.appendChild(sheet);

  var catRow = $('#fbCat', sheet);
  STR.en.cats.forEach(function (c, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('data-cat', c.id); b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    catRow.appendChild(b);
  });

  /* ---------------- entry points ---------------- */
  var settingsBtn = document.createElement('button');
  settingsBtn.type = 'button'; settingsBtn.className = 'btn-glass sm'; settingsBtn.id = 'fbOpenSettings';
  var setDone = document.getElementById('setDone');
  if (setDone && setDone.parentNode) setDone.parentNode.insertBefore(settingsBtn, setDone);
  else { var settingsSheetEl = document.getElementById('settings'); if (settingsSheetEl) settingsSheetEl.appendChild(settingsBtn); }
  settingsBtn.addEventListener('click', function () { openSheet('settings'); });

  var endingBtn = document.createElement('button');
  endingBtn.type = 'button'; endingBtn.className = 'btn-ghost'; endingBtn.id = 'fbOpenEnding'; endingBtn.style.marginTop = '2px';
  var endActions = document.querySelector('#ending .end-actions');
  if (endActions) endActions.appendChild(endingBtn);
  else { var endingScreenEl = document.getElementById('ending'); if (endingScreenEl) endingScreenEl.appendChild(endingBtn); }
  endingBtn.addEventListener('click', function () { openSheet('ending'); });

  /* ---------------- state / rendering ---------------- */
  var state = { screen: '', page: null };

  function catButtons() { return $all('#fbCat button', sheet); }
  function selectedCat() { var b = catRow.querySelector('button[aria-pressed="true"]'); return (b && b.getAttribute('data-cat')) || 'broken'; }
  function setCat(id) { catButtons().forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-cat') === id ? 'true' : 'false'); }); }
  function catInfo(lang, id) {
    var L = STR[lang] || STR.en;
    for (var i = 0; i < L.cats.length; i++) if (L.cats[i].id === id) return L.cats[i];
    return L.cats[0];
  }

  function render() {
    var L = STR[getLang()] || STR.en;
    $('#fbTitle', sheet).textContent = L.title;
    $('#fbCatLabel', sheet).textContent = L.catLabel;
    catButtons().forEach(function (b, i) { var c = L.cats[i]; if (c) { b.textContent = c.seg; b.setAttribute('aria-label', c.aria); } });
    $('#fbMsg', sheet).setAttribute('placeholder', L.placeholder);
    $('#fbCancel', sheet).textContent = L.cancel;
    $('#fbSend', sheet).textContent = L.send;
    $('#fbThanksBody', sheet).textContent = L.thanksBody;
    settingsBtn.textContent = L.settingsBtn;
    endingBtn.textContent = L.endingBtn;
  }

  function updateSendState() { $('#fbSend', sheet).disabled = $('#fbMsg', sheet).value.trim().length === 0; }

  function resetToFormView() { $('#fbForm', sheet).hidden = false; $('#fbThanks', sheet).hidden = true; }

  function openSheet(fromScreen) {
    state.screen = currentScreenId() || fromScreen || '';
    state.page = currentPageNum();
    render();
    resetToFormView();
    var draft = loadDraft();
    setCat((draft && draft.cat) || 'broken');
    $('#fbMsg', sheet).value = (draft && draft.msg) || '';
    updateSendState();
    backdrop.hidden = false;
    sheet.hidden = false;
  }
  function closeSheet() { backdrop.hidden = true; sheet.hidden = true; }

  /* ---------------- screen size / label helpers ---------------- */
  function screenLabel(L) { var id = state.screen; return (id && L.screens[id]) || id || ''; }
  function screenSize() {
    try { return window.innerWidth + '×' + window.innerHeight + ' (dpr ' + (window.devicePixelRatio || 1) + ')'; } catch (e) { return ''; }
  }

  function buildMailto() {
    var lang = getLang(), L = STR[lang] || STR.en;
    var cat = catInfo(lang, selectedCat());
    var msg = $('#fbMsg', sheet).value.trim();
    var version = getVersion();
    var scr = screenLabel(L);
    var pageTxt = state.page ? (L.pageWord + ' ' + state.page) : (scr || L.pageWord);
    var subject = '[Wayward feedback] ' + cat.subj + ' · ' + pageTxt;
    var size = screenSize();
    var ua = ''; try { ua = navigator.userAgent || ''; } catch (e) {}

    var lines = [msg, '', '—'];
    lines.push(L.lines.app + ': Wayward ' + version);
    if (scr) lines.push(L.lines.screen + ': ' + scr);
    if (state.page) lines.push(L.lines.page + ': ' + state.page);
    lines.push(L.lines.lang + ': ' + lang);
    if (size) lines.push(L.lines.size + ': ' + size);
    if (ua) lines.push(L.lines.ua + ': ' + ua);

    return 'mailto:' + MAILTO_TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function openMailto(href) {
    try {
      var a = document.createElement('a');
      a.id = 'fbMailLink';
      a.href = href;
      a.style.position = 'fixed'; a.style.left = '-9999px'; a.style.top = '0';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { try { document.body.removeChild(a); } catch (e2) {} }, 0);
    } catch (e) {
      try { window.location.href = href; } catch (e2) {}
    }
  }

  /* ---------------- events ---------------- */
  catRow.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    setCat(b.getAttribute('data-cat'));
    saveDraft({ cat: selectedCat(), msg: $('#fbMsg', sheet).value });
  });
  $('#fbMsg', sheet).addEventListener('input', function () {
    updateSendState();
    saveDraft({ cat: selectedCat(), msg: this.value });
  });
  $('#fbCancel', sheet).addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  $('#fbSend', sheet).addEventListener('click', function () {
    var msg = $('#fbMsg', sheet).value.trim();
    if (!msg) return;
    openMailto(buildMailto());
    clearDraft();
    $('#fbForm', sheet).hidden = true;
    $('#fbThanks', sheet).hidden = false;
    setTimeout(function () { if (!sheet.hidden) closeSheet(); }, 1800);
  });

  /* follow live language changes (app.js sets <html lang> on every applyI18n()) */
  render();
  try { new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); } catch (e) {}
})();
