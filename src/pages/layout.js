// Page shell and shared components. No inline styles or scripts (CSP), no site names (config only).
import { html, raw, jsonLd, toString } from '../lib/html.js';
import { productPath, categoryPath, formatPrice, savingPercent } from '../lib/text.js';
import { promoBarHtml } from './offers.js';
import { activePromos } from '../lib/promos.js';
import { deliveryCountries, COUNTRY_NAMES, FLAGS, WORLDWIDE } from '../lib/delivery.js';
import { GOOGLE_ADS_ID, OUTBOUND_LABEL, GEAR_WORLD_DOMAINS } from '../lib/ads.js';

// Files under /assets/ are cached for a year, so every link to them carries ?v=<assetVersion> (lessons L31).
// Without it, a phone kept an old icons.svg that had no cart icon, and the cart button showed empty (the saved
// list has its own "saved" icon, a bookmark, since 7 Nov 2026: lessons L101).
let ICONS = '/assets/icons.svg';
export function useSiteAssets(site) {
  ICONS = asset(site, 'icons.svg');
}

export function icon(name, cls = 'icon') {
  return html`<svg class="${cls}" aria-hidden="true" focusable="false"><use href="${ICONS}#${name}"></use></svg>`;
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
// A part can be a name that is never translated: { text: 'Joybuy', keep: true }. It sits in its own translate="no"
// span, wherever the language puts it, so a browser translation cannot change a retailer name (lessons L24, L102).
export function tr(key, ...args) {
  const txt = a => (a && typeof a === 'object' ? a.text : a);
  const kept = args.map((a, i) => (a && typeof a === 'object' && a.keep ? i : -1)).filter(i => i >= 0);
  const inner = String(key).split(/(\{\d+\})/).map(part => {
    const m = /^\{(\d+)\}$/.exec(part);
    const i = m ? Number(m[1]) : -1;
    if (i < 0 || i >= args.length) return escText(part);
    const value = escText(String(txt(args[i])));
    return kept.includes(i) ? `<span translate="no">${value}</span>` : value;
  }).join('');
  const attrs = args.map((a, i) => ` data-i18n-${i}="${escAttr(txt(a))}"` +
    (a && typeof a === 'object' && a.date ? ` data-i18n-${i}-date="${escAttr(a.date)}"` : '')).join('') +
    (kept.length ? ` data-i18n-keep="${kept.join(' ')}"` : '');
  return raw(`<span data-i18n="${escAttr(key)}"${attrs}>${inner}</span>`);
}
// A name inside a translated text that is never translated, such as a retailer or a discount code:
// tr('View at {0}', keepName('Joybuy')). It gets its own translate="no" span (lessons L24, L102, L103).
export function keepName(text) {
  return { text: String(text ?? ''), keep: true };
}

// "View at <retailer>", the button to the retailer everywhere (cards, product page, price list, compare, saved list,
// guides). The retailer name stays untranslated, wherever the language puts it (lessons L103).
export function viewAt(retailer) {
  return tr('View at {0}', keepName(retailer));
}
const escText = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = v => escText(v).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Exchange rates for this request (site.convertForeignPrices), set by the engine: { base, rates: { EUR: 1.15 } }.
let RATES = null;
export function useRates(r) {
  RATES = r && r.ok && r.rates ? r : null;
}

// A price in the site currency, marked so the site script can add "≈ €…" in the visitor's currency (lessons L25).
// A price in another currency (a retailer that sells in euros) stays in that currency, with "≈ £…" next to it.
export function priceTag(site, amount, currency, cls = 'price') {
  const base = String(site.currency || 'GBP').toUpperCase();
  const cur = String(currency || base).toUpperCase();
  const text = formatPrice(amount, cur, site.locale);
  if (!text) return '';
  const tag = html`<span class="${cls}" data-price="${Number(amount).toFixed(2)}" data-currency="${cur}">${text}</span>`;
  const rate = cur !== base && RATES && String(RATES.base).toUpperCase() === base ? Number(RATES.rates[cur]) : 0;
  const approx = rate > 0 ? formatPrice(Number(amount) / rate, base, site.locale) : '';
  return approx ? html`${tag} <span class="fx-base" translate="no">≈ ${approx}</span>` : tag;
}

// Small flag next to a retailer that sells from another country (site.retailerCountries: { 'Reidl': 'DE' }).
// A site that says where each retailer delivers (site.deliversTo, lessons L62) shows that instead.
export function retailerFlag(site, name) {
  if (site.deliversTo) return '';
  const cc = site.retailerCountries && site.retailerCountries[String(name || '')];
  if (!cc || !/^[A-Z]{2}$/.test(cc)) return '';
  const label = COUNTRY_NAMES[cc] || cc;
  return html` <img class="flag" src="${asset(site, `flags/${cc.toLowerCase()}.svg`)}" alt="${label}" title="${label}" width="18" height="12">`;
}

// Where the retailer delivers (lessons L62): the flags (only a help for the eye) and the country names.
// The names are English in the HTML; the site script swaps each one (data-country) for the browser's own name
// of that country in the visitor's language. max: how many countries to name (a card: 2, then "+3"); 0 = all.
function deliveryParts(site, retailer, max) {
  const list = deliveryCountries(site, retailer);
  if (!list.length) return null;
  if (list[0] === WORLDWIDE) {
    return { codes: list, flags: html`<span class="ship-flags">${icon('globe', 'icon ship-globe')}</span>`, names: html`<span class="ship-names"><span class="ship-world">Worldwide</span></span>` };
  }
  const shown = max > 0 ? list.slice(0, max) : list;
  const more = list.length - shown.length;
  const withFlag = shown.filter(c => FLAGS.includes(c));
  return {
    codes: list,
    flags: withFlag.length ? html`<span class="ship-flags">${withFlag.map(c => html`<img class="flag" src="${asset(site, `flags/${c.toLowerCase()}.svg`)}" alt="" width="18" height="12">`)}</span>` : '',
    names: html`<span class="ship-names">${shown.map((c, i) => html`${i ? ', ' : ''}<span data-country="${c}">${COUNTRY_NAMES[c]}</span>`)}${more > 0 ? html` <span class="ship-more">+${more}</span>` : ''}</span>`
  };
}

// Flags, then the names: the value next to "<retailer> delivers to" on the product page and the compare page.
export function deliveryText(site, retailer, { max = 0 } = {}) {
  const d = deliveryParts(site, retailer, max);
  return d ? html`${d.flags ? html`${d.flags} ` : ''}${d.names}` : '';
}

// "<retailer> delivers to", the label of the delivery countries everywhere (product page, cards, price list, saved
// list): it is the retailer that delivers, never Gear World (Google Ads review, lessons L101, L102). The retailer
// name stays untranslated in its own translate="no" span (L24).
export function deliversLabel(retailer) {
  return tr('{0} delivers to', keepName(retailer || ''));
}

// "[flags] <retailer> delivers to: Germany, Austria" as a line of its own (product cards, the price list, the saved
// list). The flags open the line, so a flag is never left alone at the end of one; the names move to the next line
// together. tag 'span' for a place where a paragraph is not allowed. data-ship keeps the codes for the site script.
// A site without delivery data (no deliversTo) shows nothing.
export function deliveryLine(site, retailer, { cls = 'label-ship', tag = 'p', max = 2 } = {}) {
  const d = deliveryParts(site, retailer, max);
  if (!d) return '';
  const inner = html`${d.flags ? html`${d.flags} ` : ''}<span class="ship-word">${deliversLabel(retailer)}</span>: ${d.names}`;
  const codes = d.codes.join(' ');
  return tag === 'span'
    ? html`<span class="${cls}" data-ship="${codes}">${inner}</span>`
    : html`<p class="${cls}" data-ship="${codes}">${inner}</p>`;
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
${adsHead(site)}
${site.cloudflareAnalyticsToken ? html`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="${JSON.stringify({ token: site.cloudflareAnalyticsToken })}"></script>` : ''}
${schema.map(s => jsonLd(s))}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
${header(site, currentCategory, searchValue)}
<main id="main">
${body}
</main>
${footer(site, year, path)}
${consentBanner(site)}
</body>
</html>`;
  return toString(doc);
}

// Google Ads (lessons L93). Only our own script is in the page: consent.js loads the Google tag (gtag.js) once, and only
// after the visitor selects "Allow" in the banner. Before that nothing goes to Google. site.googleAds: false turns it off.
function adsHead(site) {
  if (site.googleAds === false) return '';
  return html`<meta name="gw-ads" content="${GOOGLE_ADS_ID}" data-label="${OUTBOUND_LABEL}" data-domain="${site.domain}" data-linker="${GEAR_WORLD_DOMAINS.join(' ')}">
<script src="${asset(site, 'consent.js')}" defer></script>`;
}

// The cookie banner: hidden until consent.js shows it (no choice saved yet). "Allow" and "Reject" look the same
// (UK GDPR: saying no is as easy as saying yes). "Cookie settings" in the footer opens it again.
function consentBanner(site) {
  if (site.googleAds === false) return '';
  return html`<section class="consent" data-consent hidden aria-label="Cookies">
  <div class="wrap consent-row">
    <p class="consent-text">We would like to use Google cookies to see which of our ads bring visitors to this site. They are set only if you allow them, and you can change your choice at any time. <a href="/cookies/">More about cookies</a></p>
    <div class="consent-buttons">
      <button type="button" class="consent-btn" data-consent-choice="granted">Allow</button>
      <button type="button" class="consent-btn" data-consent-choice="denied">Reject</button>
    </div>
  </div>
</section>`;
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
  return html`<a class="cart-link" href="/saved/" data-cart-link>${icon('saved')}<span class="cart-word">Saved list</span><span class="cart-count" data-cart-count hidden>0</span></a>`;
}

function header(site, currentCategory, searchValue) {
  return html`<header class="masthead">
  ${promoBarHtml(site)}
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
      ${site.categories.map(c => html`<li><a href="${categoryPath(c.slug)}"${c.slug === currentCategory ? raw(' aria-current="page"') : ''}>${c.nav || c.name}</a></li>${
        // A subcategory with `menu: true` gets its own link right after its category (TGW Mini PCs, lessons L97).
        (Array.isArray(c.subcategories) ? c.subcategories : []).filter(s => s.menu).map(s => html`<li><a href="${categoryPath(c.slug)}?sub=${s.slug}">${s.nav || s.name}</a></li>`)}`)}
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

// "Get deal updates": a plain form (works without JavaScript). It is shown only when the site can pass the sign-up to
// Gear World Hub (service binding HUB), which keeps the one list of members (lessons L92).
function dealUpdates(site, path) {
  if (!site.dealUpdates) return '';
  return html`<section class="deal-updates" id="deal-updates" aria-labelledby="deal-updates-h">
  <div class="wrap deal-updates-row">
    <div class="deal-updates-text">
      <h2 id="deal-updates-h">Get deal updates</h2>
      <p>${tr('The best deals from {0} and the other Gear Worlds, about once a week. Free, and you can unsubscribe any time.', site.name)}</p>
    </div>
    <form class="deal-form" action="/api/newsletter" method="post">
      <label class="visually-hidden" for="du-email">Email address</label>
      <input id="du-email" name="email" type="email" required maxlength="254" autocomplete="email" placeholder="Your email address">
      <input type="hidden" name="page" value="${path || '/'}">
      <span class="du-hp" aria-hidden="true"><label for="du-website">Leave this empty</label><input id="du-website" name="website" type="text" tabindex="-1" autocomplete="off"></span>
      <label class="du-consent"><input type="checkbox" name="consent" value="yes" required> Email me deals from Gear World. <a href="/privacy/">Privacy policy</a></label>
      <button type="submit">Get deal updates</button>
    </form>
  </div>
</section>`;
}

function footer(site, year, path = '/') {
  return html`<footer class="site-footer">
${dealUpdates(site, path)}
  <div class="wrap footer-grid">
    <section>
      <h2>Categories</h2>
      <ul>${site.categories.map(c => html`<li><a href="${categoryPath(c.slug)}">${c.name}</a></li>`)}</ul>
    </section>
    <section>
      <h2>About this site</h2>
      <ul>
        ${activePromos(site).length ? html`<li><a href="/discount-codes/">Discount codes</a></li>` : ''}
        ${site.guides && site.guides.length ? html`<li><a href="/guides/">Buying guides</a></li>` : ''}
        <li><a href="/about/">About us</a></li>
        <li><a href="/how-we-make-money/">How we make money</a></li>
        <li><a href="/contact/">Contact</a></li>
        <li><a href="/privacy/">Privacy policy</a></li>
        <li><a href="/cookies/">Cookies</a></li>
        ${site.googleAds === false ? '' : html`<li><button type="button" class="consent-open" data-consent-open hidden>Cookie settings</button></li>`}
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
    <p>${tr('{0} compares prices across retailers.', site.name)} ${' '}When you buy through a link on this site we may earn a commission from the retailer, at no extra cost to you. Prices and stock can change. Always check the final price on the retailer's website.</p>
    <p class="footer-legal"><span translate="no">&copy; ${year} Gear World</span> · <span>Run by Evangelos Kalogerakis, United Kingdom</span> · <span>We don't sell products: we link to retailers and may earn a commission.</span></p>
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
    <p class="label-meta"><span class="retailer" translate="no">${p.retailer}${retailerFlag(site, p.retailer)}</span>${Number(p.offer_count) > 1 ? html`<a class="offers-link" href="${href}#prices">${tr('{0} retailers', p.offer_count)}</a>` : ''}${p.item_condition === 'refurbished' ? html`<span class="badge">Refurbished</span>` : ''}${Number(p.in_stock) === 1 ? '' : html`<span class="badge badge-out">Out of stock</span>`}</p>
    ${deliveryLine(site, p.retailer)}
    <a class="btn btn-deal" href="/out/${p.id}" rel="sponsored nofollow noopener" target="_blank">${viewAt(p.retailer)}</a>
    <div class="card-actions">
      <button type="button" class="btn-compare" data-compare="${p.id}" aria-pressed="false" hidden>+ Compare</button>
      ${site.cart ? html`<button type="button" class="btn-cart" data-cart="${p.id}" aria-pressed="false" hidden>+ Save</button>` : ''}
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
