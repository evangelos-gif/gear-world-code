// Buying guides (/guides/ and /guides/<slug>/), lessons L82. The words come from the site's guides.js (written and
// approved in the guides doc, facts only); prices and stock come from the database when the page opens:
// - a shop's price cell, a product's row and a product's card are hidden when it is no longer listed or in stock;
// - "Prices checked" is the oldest price date of the products on the page;
// - when a price or the stock differs from the day the guide was written, the page says so above the tables.
// Every text is a whole sentence with no link inside it, so the site script can translate it (lessons L24).
// Product names, brands, shop names and prices are translate="no".
import { html } from '../lib/html.js';
import { productPath, formatDate } from '../lib/text.js';
import { page, breadcrumbs, breadcrumbSchema, tr, priceTag } from './layout.js';

export const GUIDES_PATH = '/guides/';

export function guidePath(guide) {
  return `${GUIDES_PATH}${guide.slug}/`;
}

export function findGuide(site, slug) {
  return (site.guides || []).find(g => g.slug === slug) || null;
}

// Every product id a guide needs from the database (at most a few dozen, read by primary key, lessons L51).
export function guideProductIds(guide) {
  const ids = new Set(Object.keys(guide.prices || {}).map(Number));
  for (const b of guide.blocks || []) {
    if (b.type === 'offers') for (const r of b.rows) for (const id of Object.values(r.offers)) ids.add(Number(id));
    if (b.type === 'picks') for (const it of b.items) for (const id of it.ids) ids.add(Number(id));
    if (b.type === 'table') for (const row of b.rows) for (const c of row) if (c && c.lowest) for (const id of c.lowest) ids.add(Number(id));
  }
  return [...ids].filter(id => Number.isSafeInteger(id) && id > 0);
}

const live = (byId, id) => {
  const p = byId.get(Number(id));
  return p && Number(p.in_stock) === 1 && Number(p.price) > 0 ? p : null;
};

// The cheapest product of a list that is still listed and in stock (the first one when prices are equal).
function cheapest(byId, ids) {
  let best = null;
  for (const id of ids) {
    const p = live(byId, id);
    if (p && (!best || Number(p.price) < Number(best.price))) best = p;
  }
  return best;
}

// Has anything changed since the guide was written? A product gone, out of stock or at another price.
export function guideChanged(guide, byId) {
  return Object.entries(guide.prices || {}).some(([id, price]) => {
    const p = live(byId, id);
    return !p || Math.abs(Number(p.price) - Number(price)) >= 0.005;
  });
}

// Price per unit (ml) in pence, as written in the guide: one decimal under 20p, whole pence above.
export function pencePer(price, units) {
  const p = (Number(price) * 100) / Number(units);
  if (!Number.isFinite(p) || p <= 0) return '';
  return p < 20 ? `${p.toFixed(1)}p` : `${Math.round(p)}p`;
}

function oldestCheck(products) {
  const days = products.map(p => String(p.last_seen_at || '').slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return days[0] || '';
}

const dateArg = (site, day) => ({ text: formatDate(`${day} 12:00:00`, site.locale), date: day });

// The shop's product photo (the cheapest shop's), linking to the product page. Decorative: the name is next to it.
function photo(p, cls, size) {
  if (!p || !p.image_url) return '';
  return html`<a class="${cls}" href="${productPath(p)}" tabindex="-1" aria-hidden="true"><img src="${p.image_url}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>`;
}

function priceLink(site, p) {
  return html`<a href="${productPath(p)}" translate="no">${priceTag(site, p.price, p.currency)}</a>`;
}

function cellHtml(site, byId, c) {
  if (c === null || c === undefined || c === '') return '';
  if (typeof c === 'string') return c;
  const parts = [];
  if (c.lowest) {
    const p = cheapest(byId, c.lowest);
    parts.push(p ? priceLink(site, p) : '—');
  }
  if (c.text) parts.push(html`${c.lowest ? ' ' : ''}<span>${c.text}</span>`);
  if (c.source) parts.push(html` <a class="guide-source" href="${c.source.url}" rel="noopener" target="_blank">${tr('Source: {0}', c.source.name)}</a>`);
  return parts;
}

function tableBlock(site, byId, b) {
  return html`<h2>${b.heading}</h2>
<div class="compare-scroll" role="region" aria-label="${b.heading}" tabindex="0">
<table class="compare-table guide-table">
  <thead><tr>${b.head.map(h => (!h
    ? html`<th scope="col"><span class="visually-hidden">Detail</span></th>`
    : typeof h === 'object' ? html`<th scope="col" translate="no">${h.text}</th>` : html`<th scope="col">${h}</th>`))}</tr></thead>
  <tbody>${b.rows.map(row => html`<tr><th scope="row">${row[0]}</th>${row.slice(1).map(c => html`<td>${cellHtml(site, byId, c)}</td>`)}</tr>`)}</tbody>
</table>
</div>`;
}

function offersBlock(site, byId, b) {
  const rows = b.rows
    .map(r => ({ r, cells: b.shops.map(s => (r.offers[s] ? live(byId, r.offers[s]) : null)) }))
    .filter(x => x.cells.some(Boolean));
  if (!rows.length) return '';
  const unitHead = b.perUnit ? b.columns[b.columns.length - 1] : '';
  const textCols = b.perUnit ? b.columns.slice(1, -1) : b.columns.slice(1);
  return html`<h2>${b.heading}</h2>
<div class="compare-scroll" role="region" aria-label="${b.heading}" tabindex="0">
<table class="compare-table guide-table">
  <thead><tr><th scope="col">${b.columns[0]}</th>${textCols.map(c => html`<th scope="col">${c}</th>`)}${unitHead ? html`<th scope="col">${unitHead}</th>` : ''}${b.shops.map(s => html`<th scope="col" translate="no">${s}</th>`)}</tr></thead>
  <tbody>${rows.map(({ r, cells }) => {
    const best = cheapest(byId, Object.values(r.offers));
    return html`<tr><th scope="row" translate="no">${photo(best, 'guide-thumb', 72)}<a href="${productPath(best)}">${r.name}</a></th>${r.cells.map(c => html`<td>${c}</td>`)}${unitHead ? html`<td translate="no">${pencePer(best.price, r.units)}</td>` : ''}${cells.map(p => html`<td>${p ? priceLink(site, p) : ''}</td>`)}</tr>`;
  })}</tbody>
</table>
</div>
${(b.notes || []).map(n => html`<p class="guide-note">${n}</p>`)}`;
}

function picksBlock(site, byId, b) {
  const start = b.start || 1;
  const items = b.items.map((it, i) => ({ it, n: start + i, p: cheapest(byId, it.ids) })).filter(x => x.p);
  if (!items.length) return '';
  return html`<h2>${b.heading}</h2>
${items.map(({ it, n, p }) => html`<section class="guide-pick">
  ${photo(p, 'guide-pick-photo', 140)}
  <div class="guide-pick-main">
  <h3><span>${n}.</span> <a href="${productPath(p)}" translate="no">${it.name}</a></h3>
  <p class="label-price">${priceTag(site, p.price, p.currency)} <span class="retailer" translate="no">${p.retailer}</span></p>
  <ul>
    <li><strong>Pros:</strong> ${it.pros}</li>
    <li><strong>Cons:</strong> ${it.cons}</li>
    <li><strong>Who it's for:</strong> ${it.forWho}</li>
    <li><strong>Who should skip:</strong> ${it.skip}</li>
  </ul>
  <p><a class="btn btn-deal" href="/out/${p.id}" rel="sponsored nofollow noopener" target="_blank">${tr('View at {0}', p.retailer)}</a></p>
  </div>
</section>`)}`;
}

function textBlock(b) {
  return html`<h2>${b.heading}</h2>${b.paragraphs.map(t => html`<p>${t}</p>`)}`;
}

export function guidePage(site, guide, products) {
  const byId = new Map(products.map(p => [Number(p.id), p]));
  const shown = guideProductIds(guide).map(id => live(byId, id)).filter(Boolean);
  const checked = oldestCheck(shown);
  const path = guidePath(guide);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Buying guides', path: GUIDES_PATH }, { name: guide.title, path }];
  const blocks = (guide.blocks || []).map(b => {
    if (b.type === 'table') return tableBlock(site, byId, b);
    if (b.type === 'offers') return offersBlock(site, byId, b);
    if (b.type === 'picks') return picksBlock(site, byId, b);
    if (b.type === 'text') return textBlock(b);
    return '';
  });
  const body = html`
<div class="wrap narrow">
  ${breadcrumbs(crumbs)}
  <article class="prose guide">
    <h1>${guide.title}</h1>
    ${guide.lead.map(t => html`<p class="guide-lead">${t}</p>`)}
    <p><strong>How we chose.</strong> ${guide.howWeChose}</p>
    ${guideChanged(guide, byId) ? html`<p class="guide-changed">${tr('Some prices or stock have changed since we wrote this guide on {0}. The tables and cards show the prices now.', dateArg(site, guide.written))}</p>` : ''}
    ${blocks}
    <p class="guide-note">${checked ? html`${tr('Prices checked {0}, may change.', dateArg(site, checked))} ` : ''}You buy from the retailer at their price. We may earn a commission when you buy through our links (#ad).</p>
  </article>
</div>`;
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    datePublished: guide.written,
    dateModified: guide.written,
    author: { '@type': 'Organization', name: site.operatorName || site.name },
    publisher: { '@type': 'Organization', name: site.name },
    mainEntityOfPage: `https://${site.domain}${path}`
  };
  return page(site, {
    title: `${guide.title} | ${site.name}`,
    description: guide.description,
    path,
    ogType: 'article',
    body,
    schema: [breadcrumbSchema(site, crumbs), article]
  });
}

export function guidesIndexPage(site) {
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Buying guides', path: GUIDES_PATH }];
  const body = html`
<div class="wrap narrow">
  ${breadcrumbs(crumbs)}
  <article class="prose">
    <h1>Buying guides</h1>
    <p>Our guides compare a few products on the facts the shops list and on the prices we compare. We do not test products and we do not score them.</p>
    <ul class="guide-list">${site.guides.map(g => html`<li><h2><a href="${guidePath(g)}">${g.title}</a></h2><p>${g.description}</p></li>`)}</ul>
  </article>
</div>`;
  return page(site, {
    title: `Buying guides | ${site.name}`,
    description: `Buying guides from ${site.name}: products compared on the facts the shops list and on price.`,
    path: GUIDES_PATH,
    body,
    schema: [breadcrumbSchema(site, crumbs)]
  });
}
