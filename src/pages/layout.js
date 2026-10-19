// Page shell and shared components. No inline styles or scripts (CSP), no site names (config only).
import { html, raw, jsonLd, toString } from '../lib/html.js';
import { productPath, categoryPath, formatPrice, savingPercent } from '../lib/text.js';

export function icon(name, cls = 'icon') {
  return html`<svg class="${cls}" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#${name}"></use></svg>`;
}

export function asset(site, path) {
  return `/assets/${path}?v=${encodeURIComponent(site.assetVersion)}`;
}

// Photo for a category tile or banner, when the site has category photos (public/assets/img/cat-<slug>.webp).
export function categoryImage(site, slug) {
  return site.categoryImages ? asset(site, `img/cat-${slug}.webp`) : '';
}

// Site name with the family part ("Gear World") marked, so the CSS can colour it.
function brandName(site) {
  const accent = site.brandAccent || '';
  const i = accent ? site.name.lastIndexOf(accent) : -1;
  if (i <= 0) return html`<span class="brand-name">${site.name}</span>`;
  return html`<span class="brand-name">${site.name.slice(0, i).trim()} <span class="brand-accent">${accent}</span></span>`;
}

// Text with a changing part, e.g. tr('View at {0}', 'Joybuy'). The server writes the English text; the site
// script translates the key and puts the parts back in, so word order can change per language (lessons L24).
// A part can be a date: { date: '2026-10-18', text: '18 Oct 2026' }; the script writes it in the visitor's language.
export function tr(key, ...args) {
  const txt = a => (a && typeof a === 'object' ? a.text : a);
  const text = args.reduce((acc, a, i) => acc.split(`{${i}}`).join(String(txt(a))), key);
  const attrs = args.map((a, i) => ` data-i18n-${i}="${escAttr(txt(a))}"` +
    (a && typeof a === 'object' && a.date ? ` data-i18n-${i}-date="${escAttr(a.date)}"` : '')).join('');
  return raw(`<span data-i18n="${escAttr(key)}"${attrs}>${escText(text)}</span>`);
}
const escText = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = v => escText(v).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// A price in the site currency, marked so the site script can add "≈ €…" in the visitor's currency (lessons L25).
export function priceTag(site, amount, currency, cls = 'price') {
  const cur = String(currency || site.currency).toUpperCase();
  const text = formatPrice(amount, cur, site.locale);
  if (!text) return '';
  return html`<span class="${cls}" data-price="${Number(amount).toFixed(2)}" data-currency="${cur}">${text}</span>`;
}

const CURRENCY_LABELS = { GBP: '£ GBP', EUR: '€ EUR', USD: '$ USD', ALL: 'Lek ALL', RON: 'lei RON', RUB: '₽ RUB' };

export function absolute(site, path) {
  return `https://${site.domain}${path}`;
}

// The full HTML document. `robots` defaults to index,follow.
export function page(site, opts) {
  const {
    title, description, path, canonical = path, robots = 'index,follow', ogImage, ogType = 'website',
    body, schema = [], prev, next, currentCategory = '', searchValue = '', bodyClass = ''
  } = opts;
  const year = new Date().getUTCFullYear();
  const image = ogImage || absolute(site, asset(site, 'og-image.png'));
  const doc = html`<!doctype html>
<html lang="${site.lang}" data-store="${site.storagePrefix || site.code.toLowerCase()}" data-v="${site.assetVersion}" data-currency="${site.currency}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="${robots}">
${canonical ? html`<link rel="canonical" href="${absolute(site, canonical)}">` : ''}
${prev ? html`<link rel="prev" href="${absolute(site, prev)}">` : ''}
${next ? html`<link rel="next" href="${absolute(site, next)}">` : ''}
<meta property="og:site_name" content="${site.name}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${absolute(site, canonical || path)}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${site.themeColor || '#18202b'}">
<link rel="icon" href="${asset(site, 'favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${asset(site, 'apple-touch-icon.png')}">
<link rel="preload" href="/assets/fonts/barlow-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/barlow-sc-700.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${asset(site, 'site.css')}">
<script src="${asset(site, 'site.js')}" defer></script>
${site.cloudflareAnalyticsToken ? html`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="${JSON.stringify({ token: site.cloudflareAnalyticsToken })}"></script>` : ''}
${schema.map(s => jsonLd(s))}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
${header(site, currentCategory, searchValue)}
<main id="main">
${body}
</main>
${footer(site, year)}
</body>
</html>`;
  return toString(doc);
}

// Language and currency pickers: shown by the site script, because they need it to work.
function prefsBar(site) {
  const langs = site.languages || [];
  const curs = site.displayCurrencies || [];
  if (langs.length < 2 && curs.length < 2) return '';
  return html`<div class="prefs" data-prefs hidden>
    <div class="wrap prefs-row">
      ${langs.length > 1 ? html`<label class="pref">${icon('globe', 'icon pref-icon')}<span class="visually-hidden">Language</span>
        <select data-pref="lang" aria-label="Language" translate="no">${langs.map(l => html`<option value="${l.code}"${l.code === site.lang ? raw(' selected') : ''}>${l.label}</option>`)}</select>
      </label>` : ''}
      ${curs.length > 1 ? html`<label class="pref"><span class="visually-hidden">Currency</span>
        <select data-pref="currency" aria-label="Currency" translate="no">${curs.map(c => html`<option value="${c}"${c === site.currency ? raw(' selected') : ''}>${CURRENCY_LABELS[c] || c}</option>`)}</select>
      </label>` : ''}
    </div>
  </div>`;
}

function cartLink(site) {
  if (!site.cart) return '';
  return html`<a class="cart-link" href="/cart/" data-cart-link>${icon('cart')}<span class="cart-word">${site.cart.name}</span><span class="cart-count" data-cart-count hidden>0</span></a>`;
}

function header(site, currentCategory, searchValue) {
  return html`<header class="masthead">
  ${prefsBar(site)}
  <div class="wrap masthead-row">
    <a class="brand" href="/" aria-label="${site.name} home" translate="no">
      <img src="${asset(site, 'logo.svg')}" alt="" width="40" height="40">
      ${brandName(site)}
    </a>
    ${cartLink(site)}
    ${searchForm(site, searchValue, 'masthead-search')}
  </div>
  <nav class="catbar" aria-label="Categories">
    <ul class="wrap catbar-list">
      ${site.categories.map(c => html`<li><a href="${categoryPath(c.slug)}"${c.slug === currentCategory ? raw(' aria-current="page"') : ''}>${c.nav || c.name}</a></li>`)}
    </ul>
  </nav>
  ${site.hub && site.hub.tagline ? html`<section data-gw-network class="hub-strip" aria-label="${site.hub.name}">
    <div class="wrap hub-row">
      <span class="hub-name" translate="no">${site.hub.name}</span>
      <span class="hub-tagline">${site.hub.tagline}</span>
      <a class="hub-link" href="${site.hub.url}">Explore the Hub <span aria-hidden="true">&rarr;</span></a>
    </div>
  </section>` : ''}
</header>`;
}

export function searchForm(site, value = '', cls = '') {
  return html`<form class="search ${cls}" action="/search" method="get" role="search">
  <label class="visually-hidden" for="q-${cls}">Search products</label>
  <input id="q-${cls}" name="q" type="search" value="${value}" placeholder="${site.searchPlaceholder}" autocomplete="off" maxlength="80" required>
  ${site.voiceSearch ? html`<button type="button" class="search-mic" data-voice aria-label="Voice search" title="Voice search" aria-pressed="false" hidden>${icon('mic')}</button>` : ''}
  <button type="submit">${icon('search')}<span>Search</span></button>
  ${site.voiceSearch ? html`<p class="voice-status" role="status" aria-live="polite" hidden></p>` : ''}
</form>`;
}

function footer(site, year) {
  return html`<footer class="site-footer">
  <div class="wrap footer-grid">
    <section>
      <h2>Categories</h2>
      <ul>${site.categories.map(c => html`<li><a href="${categoryPath(c.slug)}">${c.name}</a></li>`)}</ul>
    </section>
    <section>
      <h2>About this site</h2>
      <ul>
        <li><a href="/about/">About us</a></li>
        <li><a href="/how-we-make-money/">How we make money</a></li>
        <li><a href="/contact/">Contact</a></li>
        <li><a href="/privacy/">Privacy policy</a></li>
        <li><a href="/cookies/">Cookies</a></li>
        <li><a href="/terms/">Terms of use</a></li>
      </ul>
    </section>
    <section data-gw-network>
      <h2>Gear World network</h2>
      <ul>
        <li><a href="${site.hub.url}" translate="no">${site.hub.name}</a></li>
        ${site.network.map(n => html`<li><a href="${n.url}" translate="no">${n.name}</a></li>`)}
      </ul>
    </section>
  </div>
  <div class="wrap footer-note">
    <p>${tr('{0} compares prices from UK retailers.', site.name)} ${' '}When you buy through a link on this site we may earn a commission from the retailer, at no extra cost to you. Prices and stock can change. Always check the final price on the retailer's website.</p>
    <p translate="no">&copy; ${year} ${site.name}</p>
  </div>
</footer>`;
}

// Product card designed as an electronic shelf label.
export function productCard(site, p, { headingLevel = 3 } = {}) {
  const href = productPath(p);
  const was = Number(p.was_price) > Number(p.price) ? formatPrice(p.was_price, p.currency || site.currency, site.locale) : '';
  const pct = savingPercent(p.price, p.was_price);
  const h = headingLevel === 2 ? 'h2' : 'h3';
  return html`<article class="label-card">
  <a class="label-photo" href="${href}" tabindex="-1" aria-hidden="true">
    <img src="${p.image_url}" alt="" loading="lazy" decoding="async" width="240" height="240" referrerpolicy="no-referrer">
  </a>
  <div class="label-body">
    ${p.brand ? html`<p class="label-brand" translate="no">${p.brand}</p>` : ''}
    ${raw(`<${h} class="label-name" translate="no">`)}<a href="${href}">${p.product_name}</a>${raw(`</${h}>`)}
    <p class="label-price">${priceTag(site, p.price, p.currency)}${was ? html` <s class="was">${was}</s>` : ''}${pct ? html` <span class="tag-save">${tr('Save {0}%', pct)}</span>` : ''}</p>
    <p class="label-meta"><span class="retailer" translate="no">${p.retailer}</span>${p.item_condition === 'refurbished' ? html`<span class="badge">Refurbished</span>` : ''}${Number(p.in_stock) === 1 ? '' : html`<span class="badge badge-out">Out of stock</span>`}</p>
    <a class="btn btn-deal" href="/out/${p.id}" rel="sponsored nofollow noopener" target="_blank">${tr('View at {0}', p.retailer)}</a>
    <div class="card-actions">
      <button type="button" class="btn-compare" data-compare="${p.id}" aria-pressed="false" hidden>+ Compare</button>
      ${site.cart ? html`<button type="button" class="btn-cart" data-cart="${p.id}" aria-pressed="false" hidden>+ Cart</button>` : ''}
    </div>
  </div>
</article>`;
}

export function productGrid(site, products, opts = {}) {
  return html`<div class="label-grid">${products.map(p => productCard(site, p, opts))}</div>`;
}

// Items with keep: true (a product name) are not translated.
export function breadcrumbs(items) {
  const no = it => (it.keep ? raw(' translate="no"') : '');
  return html`<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map((it, i) =>
    i === items.length - 1
      ? html`<li><span aria-current="page"${no(it)}>${it.name}</span></li>`
      : html`<li><a href="${it.path}"${no(it)}>${it.name}</a></li>`)}</ol></nav>`;
}

export function breadcrumbSchema(site, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absolute(site, it.path) }))
  };
}
