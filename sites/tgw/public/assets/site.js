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
