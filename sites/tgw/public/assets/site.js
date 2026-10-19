// Technology Gear World. One small script; every page also works without it.
// Parts: language (L24), currency (L25), Gear Cart (L26), compare (L23), voice search, newsletter.
(function () {
  'use strict';

  var root = document.documentElement;
  var STORE = root.getAttribute('data-store') || 'gw';
  var VERSION = root.getAttribute('data-v') || '';
  var BASE_LANG = 'en-GB';
  var BASE_CURRENCY = root.getAttribute('data-currency') || 'GBP';

  function read(key, fallback) {
    try { var v = window.localStorage.getItem(STORE + '-' + key); return v === null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(STORE + '-' + key, value); } catch (e) { /* private mode: keep it for this page only */ }
  }

  // ---------- Language (lessons L24) ----------
  // The server writes English. A dictionary file per language maps the English text to the translation.
  // Text inside translate="no" (product names, brands, retailers, legal pages) is left as it is.
  // Text with a changing part has data-i18n="View at {0}" and data-i18n-0="Joybuy".
  var lang = BASE_LANG;
  var dict = null;
  var missing = [];
  window.GW_I18N_MISSING = missing;

  function t(s) {
    if (!dict) return s;
    if (Object.prototype.hasOwnProperty.call(dict, s)) return dict[s];
    if (missing.indexOf(s) < 0) missing.push(s);
    return s;
  }
  function fill(s, args) {
    for (var i = 0; i < args.length; i++) s = s.split('{' + i + '}').join(args[i]);
    return s;
  }
  function tf(key, args) { return fill(t(key), args || []); }

  function formatNumberText(v) {
    return /^\d{1,3}(,\d{3})+$|^\d+$/.test(v) ? new Intl.NumberFormat(lang).format(Number(v.replace(/,/g, ''))) : v;
  }
  function formatDate(iso) {
    var d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
  }

  var LETTERS = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;
  var ATTRS = ['placeholder', 'aria-label', 'title'];

  function translateTree(start) {
    var stack = [start];
    while (stack.length) {
      var node = stack.pop();
      if (node.nodeType === 3) {
        var raw = node.nodeValue;
        var text = raw.trim();
        if (text && LETTERS.test(text)) {
          var out = t(text);
          if (out !== text) node.nodeValue = raw.replace(text, out);
        }
        continue;
      }
      if (node.nodeType !== 1) continue;
      var tag = node.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'svg' || tag === 'SVG') continue;
      if (node.getAttribute('translate') === 'no') continue;
      for (var a = 0; a < ATTRS.length; a++) {
        var v = node.getAttribute(ATTRS[a]);
        if (v && LETTERS.test(v)) node.setAttribute(ATTRS[a], t(v.trim()));
      }
      if (node.hasAttribute('data-i18n')) {
        var args = [];
        for (var i = 0; node.hasAttribute('data-i18n-' + i); i++) {
          var date = node.getAttribute('data-i18n-' + i + '-date');
          var arg = node.getAttribute('data-i18n-' + i);
          args.push(date ? (formatDate(date) || arg) : formatNumberText(arg));
        }
        node.textContent = tf(node.getAttribute('data-i18n'), args);
        continue;
      }
      if (tag === 'TIME' && node.getAttribute('datetime')) {
        var f = formatDate(node.getAttribute('datetime'));
        if (f) node.textContent = f;
        continue;
      }
      for (var c = node.childNodes.length - 1; c >= 0; c--) stack.push(node.childNodes[c]);
    }
  }

  function applyLanguage() {
    root.lang = lang;
    translateTree(document.body);
    var notes = document.querySelectorAll('[data-lang-note]');
    for (var i = 0; i < notes.length; i++) notes[i].hidden = false;
  }

  function loadLanguage() {
    var wanted = read('lang', BASE_LANG);
    var select = document.querySelector('select[data-pref="lang"]');
    var known = select ? Array.prototype.some.call(select.options, function (o) { return o.value === wanted; }) : false;
    if (!known || wanted === BASE_LANG) return Promise.resolve();
    return fetch('/assets/i18n/' + wanted + '.json?v=' + encodeURIComponent(VERSION))
      .then(function (r) { if (!r.ok) throw new Error('i18n ' + r.status); return r.json(); })
      .then(function (d) { lang = wanted; dict = d; applyLanguage(); })
      .catch(function () { /* the page stays in English */ });
  }

  // ---------- Currency (lessons L25) ----------
  // Retailers charge in the site currency, which always stays on the page. The visitor's currency is added
  // next to it as "≈ €42.50", from rates the Worker refreshes every few hours (/api/fx).
  var currency = BASE_CURRENCY;
  var rates = null;

  function getRates() {
    try {
      var c = JSON.parse(window.sessionStorage.getItem(STORE + '-fx') || 'null');
      if (c && c.at > Date.now() - 3 * 3600 * 1000 && c.data && c.data.rates) return Promise.resolve(c.data);
    } catch (e) { /* no cache */ }
    return fetch('/api/fx').then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok) { try { window.sessionStorage.setItem(STORE + '-fx', JSON.stringify({ at: Date.now(), data: d })); } catch (e) { /* ignore */ } }
      return d;
    });
  }

  function money(amount, cur) {
    try { return new Intl.NumberFormat(lang, { style: 'currency', currency: cur }).format(amount); } catch (e) { return cur + ' ' + amount.toFixed(2); }
  }

  function showConverted() {
    var old = document.querySelectorAll('.fx');
    for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
    if (currency === BASE_CURRENCY || !rates || !rates.rates || !rates.rates[currency]) return;
    var rate = rates.rates[currency];
    var prices = document.querySelectorAll('[data-price]');
    for (var j = 0; j < prices.length; j++) {
      var el = prices[j];
      if (el.getAttribute('data-currency') !== rates.base) continue;
      var amount = Number(el.getAttribute('data-price')) * rate;
      if (!isFinite(amount) || amount <= 0) continue;
      var fx = document.createElement('span');
      fx.className = 'fx';
      fx.setAttribute('translate', 'no');
      fx.textContent = '≈ ' + money(amount, currency);
      fx.title = t('Approximate price in your currency. The retailer charges in pounds.');
      el.parentNode.insertBefore(fx, el.nextSibling);
    }
  }

  function loadCurrency() {
    var wanted = read('currency', BASE_CURRENCY);
    var select = document.querySelector('select[data-pref="currency"]');
    var known = select ? Array.prototype.some.call(select.options, function (o) { return o.value === wanted; }) : false;
    currency = known ? wanted : BASE_CURRENCY;
    if (currency === BASE_CURRENCY) return;
    getRates().then(function (d) { rates = d; showConverted(); }).catch(function () { /* show pounds only */ });
  }

  // ---------- Preferences bar ----------
  function setupPrefs() {
    var bar = document.querySelector('[data-prefs]');
    if (!bar) return;
    bar.hidden = false;
    var ls = bar.querySelector('select[data-pref="lang"]');
    if (ls) {
      ls.value = lang;
      ls.addEventListener('change', function () { write('lang', ls.value); window.location.reload(); });
    }
    var cs = bar.querySelector('select[data-pref="currency"]');
    if (cs) {
      cs.value = currency;
      cs.addEventListener('change', function () {
        write('currency', cs.value);
        currency = cs.value;
        if (currency === BASE_CURRENCY || rates) { showConverted(); return; }
        getRates().then(function (d) { rates = d; showConverted(); }).catch(function () { /* pounds only */ });
      });
    }
  }

  // ---------- Gear Cart (lessons L26) ----------
  // The list stays in this browser: product ids and quantities only. The cart page is /cart/?items=12:2,34:1,
  // built by the server, and every buy button there goes through /out/<id>.
  var CART_MAX = 30;
  var QTY_MAX = 99;
  function loadCart() {
    try {
      var v = JSON.parse(read('cart', '[]'));
      if (!Array.isArray(v)) return [];
      var out = [];
      for (var i = 0; i < v.length && out.length < CART_MAX; i++) {
        var id = String(v[i] && v[i].id);
        var q = Math.min(QTY_MAX, Math.max(1, parseInt(v[i] && v[i].qty, 10) || 1));
        if (/^\d{1,12}$/.test(id) && !out.some(function (x) { return x.id === id; })) out.push({ id: id, qty: q });
      }
      return out;
    } catch (e) { return []; }
  }
  function saveCart(list) { write('cart', JSON.stringify(list)); }
  function cartHref(list) {
    return list.length ? '/cart/?items=' + list.map(function (x) { return x.id + ':' + x.qty; }).join(',') : '/cart/';
  }

  function setupCart() {
    var cart = loadCart();
    var onCartPage = document.querySelector('[data-cart-items]');
    if (onCartPage) {
      var serverList = onCartPage.getAttribute('data-cart-items');
      cart = serverList ? serverList.split(',').map(function (p) { var a = p.split(':'); return { id: a[0], qty: parseInt(a[1], 10) || 1 }; }) : [];
      saveCart(cart);
    }
    var links = document.querySelectorAll('[data-cart-link]');
    var buttons = document.querySelectorAll('[data-cart]');
    var status = document.createElement('p');
    status.className = 'visually-hidden';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    document.body.appendChild(status);

    function render() {
      var units = cart.reduce(function (n, x) { return n + x.qty; }, 0);
      for (var i = 0; i < links.length; i++) {
        links[i].href = cartHref(cart);
        var c = links[i].querySelector('[data-cart-count]');
        if (c) { c.textContent = String(units); c.hidden = units === 0; }
      }
      for (var j = 0; j < buttons.length; j++) {
        var on = cart.some(function (x) { return x.id === buttons[j].getAttribute('data-cart'); });
        buttons[j].hidden = false;
        buttons[j].setAttribute('aria-pressed', on ? 'true' : 'false');
        buttons[j].textContent = on ? t('✓ In cart') : t('+ Cart');
      }
    }
    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target : null;
      if (!el) return;
      var b = el.closest('[data-cart]');
      if (b) {
        var id = b.getAttribute('data-cart');
        if (cart.some(function (x) { return x.id === id; })) { window.location.href = cartHref(cart); return; }
        if (cart.length >= CART_MAX) { status.textContent = tf('Your cart is full ({0} products).', [String(CART_MAX)]); return; }
        cart.push({ id: id, qty: 1 });
        saveCart(cart);
        render();
        status.textContent = t('Added to your cart.');
        return;
      }
      if (el.closest('[data-cart-clear]')) { cart = []; saveCart(cart); }
    });
    render();
  }

  // ---------- Compare up to 4 products (lessons L23) ----------
  function setupCompare() {
    var MAX = 4;
    function load() {
      try {
        var v = JSON.parse(read('compare', '[]'));
        return Array.isArray(v) ? v.map(String).filter(function (x) { return /^\d{1,12}$/.test(x); }).slice(0, MAX) : [];
      } catch (e) { return []; }
    }
    function save(l) { write('compare', JSON.stringify(l)); }
    var list = load();
    var onComparePage = document.querySelector('[data-compare-ids]');
    if (onComparePage) {
      list = onComparePage.getAttribute('data-compare-ids').split(',').filter(function (x) { return /^\d{1,12}$/.test(x); });
      save(list);
    }
    var buttons = document.querySelectorAll('[data-compare]');
    if (!buttons.length && !list.length) return;
    var bar = document.createElement('div');
    bar.className = 'compare-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', t('Compare products'));
    var count = document.createElement('p');
    count.className = 'compare-count';
    count.setAttribute('aria-live', 'polite');
    var go = document.createElement('a');
    go.className = 'btn btn-gold compare-go';
    go.href = '/compare/';
    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'btn compare-clear';
    clear.textContent = t('Clear');
    bar.appendChild(count); bar.appendChild(go); bar.appendChild(clear);
    document.body.appendChild(bar);
    function render(message) {
      for (var i = 0; i < buttons.length; i++) {
        var on = list.indexOf(buttons[i].getAttribute('data-compare')) >= 0;
        buttons[i].hidden = false;
        buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
        buttons[i].textContent = on ? t('✓ In compare') : t('+ Compare');
      }
      var n = list.length;
      bar.hidden = (n === 0 && !message) || !!onComparePage;
      document.body.classList.toggle('has-compare-bar', !bar.hidden);
      count.textContent = message || tf('{0} of {1} products', [String(n), String(MAX)]);
      go.textContent = n < 2 ? t('Pick one more') : tf('Compare {0} →', [String(n)]);
      go.href = '/compare/?ids=' + list.join(',');
      if (n < 2) go.setAttribute('aria-disabled', 'true'); else go.removeAttribute('aria-disabled');
    }
    document.addEventListener('click', function (ev) {
      var tEl = ev.target;
      var b = tEl && tEl.closest ? tEl.closest('[data-compare]') : null;
      if (b) {
        var id = b.getAttribute('data-compare');
        var at = list.indexOf(id);
        if (at >= 0) list.splice(at, 1);
        else if (list.length >= MAX) { render(tf('You can compare up to {0} products. Remove one first.', [String(MAX)])); return; }
        else list.push(id);
        save(list);
        render();
        return;
      }
      if (tEl && tEl.closest && tEl.closest('.compare-clear')) { list = []; save(list); render(); return; }
      if (tEl && tEl.closest && tEl.closest('.compare-go[aria-disabled]')) ev.preventDefault();
    });
    render();
  }

  // ---------- Voice search ----------
  // The browser turns speech into text (Chrome: Google's service, Safari: Apple's). We only receive the text.
  function setupVoice() {
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var mics = document.querySelectorAll('[data-voice]');
    if (!Recognition || !mics.length) return;
    Array.prototype.forEach.call(mics, function (button) {
      var form = button.form || button.closest('form');
      var input = form ? form.querySelector('input[name="q"]') : null;
      var status = form ? form.querySelector('.voice-status') : null;
      if (!input) return;
      button.hidden = false;
      var recognition = null;
      var active = false;
      function show(text) { if (status) { status.textContent = text; status.hidden = !text; } }
      function setActive(v) { active = v; button.setAttribute('aria-pressed', v ? 'true' : 'false'); }
      button.addEventListener('click', function () {
        if (active && recognition) { try { recognition.stop(); } catch (e) { /* ignore */ } return; }
        try {
          recognition = new Recognition();
          recognition.lang = lang;
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;
          recognition.continuous = false;
          var done = false;
          recognition.onstart = function () { setActive(true); show(t('Listening…')); };
          recognition.onresult = function (event) {
            var said = '';
            for (var i = event.resultIndex || 0; i < event.results.length; i++) {
              if (event.results[i].isFinal && event.results[i][0]) said += ' ' + event.results[i][0].transcript;
            }
            said = said.trim().slice(0, 80);
            if (said.length < 2 || done) return;
            done = true;
            input.value = said;
            show('');
            if (typeof form.requestSubmit === 'function') form.requestSubmit(); else form.submit();
          };
          recognition.onerror = function (e) {
            show(e.error === 'not-allowed' || e.error === 'service-not-allowed'
              ? t('Allow the microphone in your browser to search by voice.')
              : t('Voice search did not work. Try again or type your search.'));
            setActive(false);
          };
          recognition.onend = function () { setActive(false); if (!done && status && status.textContent === t('Listening…')) show(''); };
          recognition.start();
        } catch (e) {
          setActive(false);
          show(t('Voice search did not work. Try again or type your search.'));
        }
      });
    });
  }

  // ---------- Filters ----------
  document.querySelectorAll('select[data-autosubmit]').forEach(function (sel) {
    sel.addEventListener('change', function () { if (sel.form) sel.form.submit(); });
  });
  if (window.matchMedia && window.matchMedia('(max-width: 959px)').matches) {
    document.querySelectorAll('.filters-box[open]').forEach(function (d) { d.open = false; });
  }

  // ---------- Newsletter: load Turnstile only when the form exists, then send JSON ----------
  function setupNewsletter() {
    var form = document.querySelector('form[data-newsletter]');
    if (!form) return;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
    var status = form.querySelector('.form-status');
    function show(text, ok) {
      status.textContent = text;
      status.className = 'form-status ' + (ok ? 'is-ok' : 'is-error');
    }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var tokenField = form.querySelector('[name="cf-turnstile-response"]');
      var body = { email: form.email.value, consent: form.consent.checked, turnstile_token: tokenField ? tokenField.value : '', page: location.pathname };
      if (!body.turnstile_token) { show(t('Wait for the security check to finish, then try again.'), false); return; }
      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          show(t(res.d.message || res.d.error || 'Something went wrong. Try again.'), res.ok);
          if (res.ok) form.reset();
        })
        .catch(function () { show(t('No connection. Check your internet and try again.'), false); })
        .then(function () { button.disabled = false; if (window.turnstile) window.turnstile.reset(); });
    });
  }

  // Language first, so every text the other parts write is already in the visitor's language.
  loadLanguage().then(function () {
    loadCurrency();
    setupPrefs();
    setupCart();
    setupCompare();
    setupVoice();
    setupNewsletter();
    root.setAttribute('data-ready', lang);
  });
})();
