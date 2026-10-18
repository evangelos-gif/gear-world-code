// Technology Gear World. One small script; every page also works without it.
(function () {
  'use strict';

  // Filters: submit when a select changes, and fold the filter box on small screens.
  document.querySelectorAll('select[data-autosubmit]').forEach(function (sel) {
    sel.addEventListener('change', function () { if (sel.form) sel.form.submit(); });
  });
  if (window.matchMedia && window.matchMedia('(max-width: 959px)').matches) {
    document.querySelectorAll('.filters-box[open]').forEach(function (d) { d.open = false; });
  }

  // Compare up to 4 products. The list is kept in this browser only; every page also works without it.
  (function () {
    var KEY = 'tgw-compare';
    var MAX = 4;
    function load() {
      try {
        var v = JSON.parse(window.localStorage.getItem(KEY) || '[]');
        return Array.isArray(v) ? v.map(String).filter(function (x) { return /^\d{1,12}$/.test(x); }).slice(0, MAX) : [];
      } catch (e) { return []; }
    }
    function save(list) { try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode: keep it in memory */ } }
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
    bar.setAttribute('aria-label', 'Compare products');
    bar.innerHTML = '<p class="compare-count" aria-live="polite"></p><a class="btn btn-gold compare-go" href="/compare/">Compare</a><button type="button" class="btn compare-clear">Clear</button>';
    document.body.appendChild(bar);
    var count = bar.querySelector('.compare-count');
    var go = bar.querySelector('.compare-go');
    function render(message) {
      for (var i = 0; i < buttons.length; i++) {
        var on = list.indexOf(buttons[i].getAttribute('data-compare')) >= 0;
        buttons[i].hidden = false;
        buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
        buttons[i].textContent = on ? '\u2713 In compare' : '+ Compare';
      }
      var n = list.length;
      bar.hidden = (n === 0 && !message) || !!onComparePage;
      document.body.classList.toggle('has-compare-bar', !bar.hidden);
      count.textContent = message || (n + ' of ' + MAX + ' products');
      go.textContent = n < 2 ? 'Pick one more' : 'Compare ' + n + ' \u2192';
      go.href = '/compare/?ids=' + list.join(',');
      if (n < 2) go.setAttribute('aria-disabled', 'true'); else go.removeAttribute('aria-disabled');
    }
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      var b = t && t.closest ? t.closest('[data-compare]') : null;
      if (b) {
        var id = b.getAttribute('data-compare');
        var at = list.indexOf(id);
        if (at >= 0) list.splice(at, 1);
        else if (list.length >= MAX) { render('You can compare up to ' + MAX + ' products. Remove one first.'); return; }
        else list.push(id);
        save(list);
        render();
        return;
      }
      if (t && t.closest && t.closest('.compare-clear')) { list = []; save(list); render(); return; }
      if (t && t.closest && t.closest('.compare-go[aria-disabled]')) ev.preventDefault();
    });
    render();
  })();

  // Newsletter: load Turnstile only when the form exists, then send JSON.
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
    var body = {
      email: form.email.value,
      consent: form.consent.checked,
      turnstile_token: tokenField ? tokenField.value : '',
      page: location.pathname
    };
    if (!body.turnstile_token) { show('Wait for the security check to finish, then try again.', false); return; }
    var button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        show(res.d.message || res.d.error || 'Something went wrong. Try again.', res.ok);
        if (res.ok) form.reset();
      })
      .catch(function () { show('No connection. Check your internet and try again.', false); })
      .then(function () {
        button.disabled = false;
        if (window.turnstile) window.turnstile.reset();
      });
  });
})();
