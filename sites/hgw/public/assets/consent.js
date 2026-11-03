// Gear World cookie banner and Google Ads (lessons L93). Shared by every site on the engine; TGW keeps the master copy.
// - Nothing goes to Google before the visitor selects "Allow": consent mode v2 defaults are "denied", and the Google
//   tag (gtag.js) is added to the page only after "Allow", once.
// - Conversion "outbound_click": a click on /out/ ("View at <retailer>") or /go/ (a discount code), sent only on the
//   real domain, after "Allow", and when the page has the conversion label.
// - utm_source / utm_campaign: added to /out/ and /go/ links, so the Worker can pass them to Awin (clickref2/3).
//   They are kept in this tab (sessionStorage) only after "Allow"; otherwise only for the page they arrived on.
(function () {
  'use strict';

  var meta = document.querySelector('meta[name="gw-ads"]');
  if (!meta) return;
  var ID = meta.getAttribute('content') || '';
  var LABEL = meta.getAttribute('data-label') || '';
  var DOMAIN = (meta.getAttribute('data-domain') || '').toLowerCase();
  var LINKER = (meta.getAttribute('data-linker') || '').split(/\s+/).filter(function (d) { return d; });
  var STORE = document.documentElement.getAttribute('data-store') || 'gw';
  var KEY = STORE + '-cookie-consent';
  var UTM_KEY = STORE + '-utm';
  var host = String(window.location.hostname || '').toLowerCase();
  // A test address (preview Worker, localhost) never sends a conversion.
  var LIVE = !!DOMAIN && (host === DOMAIN || host === 'www.' + DOMAIN);

  function get(store, key) { try { return window[store].getItem(key) || ''; } catch (e) { return ''; } }
  function set(store, key, value) { try { window[store].setItem(key, value); } catch (e) { /* private mode */ } }
  function drop(store, key) { try { window[store].removeItem(key); } catch (e) { /* private mode */ } }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (typeof window.gtag !== 'function') window.gtag = gtag;

  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });

  var choice = get('localStorage', KEY);
  if (choice !== 'granted' && choice !== 'denied') choice = '';
  var loaded = false;

  // The Google tag, once per page. Ads personalisation (remarketing) stays off: only conversions are measured.
  function loadTag() {
    if (loaded || !/^AW-\d+$/.test(ID)) return;
    loaded = true;
    window.GW_ADS_LOADED = true;
    gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied', analytics_storage: 'denied' });
    gtag('js', new Date());
    gtag('config', ID, { allow_ad_personalization_signals: false, linker: { domains: LINKER } });
    var src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
    if (document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  // ---------- utm_source / utm_campaign ----------
  function clean(v) {
    v = String(v == null ? '' : v).trim().slice(0, 40);
    return /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(v) ? v : '';
  }
  var utm = { utm_source: '', utm_campaign: '' };
  try {
    var q = new URLSearchParams(window.location.search);
    utm.utm_source = clean(q.get('utm_source'));
    utm.utm_campaign = clean(q.get('utm_campaign'));
  } catch (e) { /* old browser */ }
  if (!utm.utm_source && !utm.utm_campaign) {
    try {
      var saved = JSON.parse(get('sessionStorage', UTM_KEY) || 'null');
      if (saved) { utm.utm_source = clean(saved.utm_source); utm.utm_campaign = clean(saved.utm_campaign); }
    } catch (e) { /* nothing saved */ }
  }
  function keepUtm() {
    if (choice === 'granted' && (utm.utm_source || utm.utm_campaign)) set('sessionStorage', UTM_KEY, JSON.stringify(utm));
  }

  // A link of this site to a retailer: /out/<id> or /go/<id>.
  function outLink(node) {
    var a = node && node.closest ? node.closest('a[href]') : null;
    if (!a) return null;
    var u;
    try { u = new URL(a.getAttribute('href'), window.location.href); } catch (e) { return null; }
    if (u.origin !== window.location.origin || !/^\/(out|go)\/[^/]+/.test(u.pathname)) return null;
    return { a: a, url: u };
  }
  function addUtm(link) {
    if (!utm.utm_source && !utm.utm_campaign) return;
    var changed = false;
    ['utm_source', 'utm_campaign'].forEach(function (k) {
      if (utm[k] && !link.url.searchParams.has(k)) { link.url.searchParams.set(k, utm[k]); changed = true; }
    });
    if (changed) link.a.setAttribute('href', link.url.pathname + link.url.search);
  }
  function addUtmAll() {
    var links = document.querySelectorAll('a[href^="/out/"], a[href^="/go/"]');
    for (var i = 0; i < links.length; i++) { var l = outLink(links[i]); if (l) addUtm(l); }
  }

  // ---------- conversion "outbound_click" ----------
  function onOut(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    var link = outLink(event.target);
    if (!link) return;
    addUtm(link);
    if (!loaded || !LABEL || !LIVE) return;
    gtag('event', 'conversion', { send_to: ID + '/' + LABEL, transport_type: 'beacon' });
  }
  document.addEventListener('click', onOut, true);
  document.addEventListener('auxclick', onOut, true);
  document.addEventListener('contextmenu', function (event) { var l = outLink(event.target); if (l) addUtm(l); }, true);

  // ---------- the banner ----------
  var banner = document.querySelector('[data-consent]');
  var reopen = document.querySelectorAll('[data-consent-open]');

  function removeGoogleCookies() {
    var names = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); })
      .filter(function (n) { return /^(_gcl_|_gac_|_gad)/.test(n); });
    var parts = host.split('.');
    var domains = ['', host];
    if (parts.length > 1) domains.push('.' + parts.slice(-2).join('.'));
    names.forEach(function (n) {
      domains.forEach(function (d) {
        document.cookie = n + '=; Max-Age=0; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }

  function decide(value) {
    var wasLoaded = loaded;
    choice = value;
    set('localStorage', KEY, value);
    if (banner) banner.hidden = true;
    if (value === 'granted') { keepUtm(); loadTag(); return; }
    drop('sessionStorage', UTM_KEY);
    gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
    removeGoogleCookies();
    // The Google tag cannot be taken out of a page that has it: a fresh page starts without it.
    if (wasLoaded) window.location.reload();
  }

  if (banner) {
    var buttons = banner.querySelectorAll('[data-consent-choice]');
    for (var b = 0; b < buttons.length; b++) {
      buttons[b].addEventListener('click', function (event) { decide(event.currentTarget.getAttribute('data-consent-choice') === 'granted' ? 'granted' : 'denied'); });
    }
  }
  for (var r = 0; r < reopen.length; r++) {
    reopen[r].hidden = false;
    reopen[r].addEventListener('click', function () { if (banner) { banner.hidden = false; var f = banner.querySelector('button'); if (f) f.focus(); } });
  }

  if (choice === 'granted') { keepUtm(); loadTag(); }
  else if (!choice && banner) banner.hidden = false;
  addUtmAll();
})();
