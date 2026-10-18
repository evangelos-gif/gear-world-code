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
<html lang="${site.lang}">
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

function header(site, currentCategory, searchValue) {
  return html`<header class="masthead">
  <div class="wrap masthead-row">
    <a class="brand" href="/" aria-label="${site.name} home">
      <img src="${asset(site, 'logo.svg')}" alt="" width="40" height="40">
      ${brandName(site)}
    </a>
    ${searchForm(site, searchValue, 'masthead-search')}
  </div>
  <nav class="catbar" aria-label="Categories">
    <ul class="wrap catbar-list">
      ${site.categories.map(c => html`<li><a href="${categoryPath(c.slug)}"${c.slug === currentCategory ? raw(' aria-current="page"') : ''}>${c.nav || c.name}</a></li>`)}
    </ul>
  </nav>
  ${site.hub && site.hub.tagline ? html`<section data-gw-network class="hub-strip" aria-label="${site.hub.name}">
    <div class="wrap hub-row">
      <span class="hub-name">${site.hub.name}</span>
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
  <button type="submit">${icon('search')}<span>Search</span></button>
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
        <li><a href="${site.hub.url}">${site.hub.name}</a></li>
        ${site.network.map(n => html`<li><a href="${n.url}">${n.name}</a></li>`)}
      </ul>
    </section>
  </div>
  <div class="wrap footer-note">
    <p>${site.name} compares prices from UK retailers. When you buy through a link on this site we may earn a commission from the retailer, at no extra cost to you. Prices and stock can change. Always check the final price on the retailer's website.</p>
    <p>&copy; ${year} ${site.name}</p>
  </div>
</footer>`;
}

// Product card designed as an electronic shelf label.
export function productCard(site, p, { headingLevel = 3 } = {}) {
  const href = productPath(p);
  const price = formatPrice(p.price, p.currency || site.currency, site.locale);
  const was = Number(p.was_price) > Number(p.price) ? formatPrice(p.was_price, p.currency || site.currency, site.locale) : '';
  const pct = savingPercent(p.price, p.was_price);
  const h = headingLevel === 2 ? 'h2' : 'h3';
  return html`<article class="label-card">
  <a class="label-photo" href="${href}" tabindex="-1" aria-hidden="true">
    <img src="${p.image_url}" alt="" loading="lazy" decoding="async" width="240" height="240" referrerpolicy="no-referrer">
  </a>
  <div class="label-body">
    ${p.brand ? html`<p class="label-brand">${p.brand}</p>` : ''}
    ${raw(`<${h} class="label-name">`)}<a href="${href}">${p.product_name}</a>${raw(`</${h}>`)}
    <p class="label-price"><span class="price">${price}</span>${was ? html` <s class="was">${was}</s>` : ''}${pct ? html` <span class="tag-save">Save ${pct}%</span>` : ''}</p>
    <p class="label-meta"><span class="retailer">${p.retailer}</span>${p.item_condition === 'refurbished' ? html`<span class="badge">Refurbished</span>` : ''}${Number(p.in_stock) === 1 ? '' : html`<span class="badge badge-out">Out of stock</span>`}</p>
    <a class="btn btn-deal" href="/out/${p.id}" rel="sponsored nofollow noopener" target="_blank">View at ${p.retailer}</a>
  </div>
</article>`;
}

export function productGrid(site, products, opts = {}) {
  return html`<div class="label-grid">${products.map(p => productCard(site, p, opts))}</div>`;
}

export function breadcrumbs(items) {
  return html`<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map((it, i) =>
    i === items.length - 1
      ? html`<li><span aria-current="page">${it.name}</span></li>`
      : html`<li><a href="${it.path}">${it.name}</a></li>`)}</ol></nav>`;
}

export function breadcrumbSchema(site, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absolute(site, it.path) }))
  };
}
