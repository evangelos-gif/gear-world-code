// Compare 2-4 products side by side (lessons L23), with "Our pick" chosen by a rule that is shown on the page.
import { html } from '../lib/html.js';
import { productPath, formatPrice, savingPercent } from '../lib/text.js';
import { page, breadcrumbs, tr, priceTag, deliveryText } from './layout.js';

export const COMPARE_MAX = 4;

// ids=12,34 -> [12, 34]: whole numbers only, no repeats, at most 4.
export function parseCompareIds(url) {
  const ids = [];
  for (const part of (url.searchParams.get('ids') || '').split(',')) {
    const s = part.trim();
    if (!/^\d{1,12}$/.test(s)) continue;
    const n = Number(s);
    if (n > 0 && !ids.includes(n)) ids.push(n);
    if (ids.length === COMPARE_MAX) break;
  }
  return ids;
}

const inStock = p => Number(p.in_stock) === 1;

// Our pick: only when all products are in the same category. In stock first, then the lowest price,
// then the bigger saving. We compare price and stock; we do not test products.
export function comparePick(products) {
  if (products.length < 2) return null;
  if (new Set(products.map(p => p.category_slug)).size !== 1) return { id: null, note: 'different-categories' };
  const ranked = [...products].sort((a, b) =>
    (inStock(b) - inStock(a)) ||
    (Number(a.price) - Number(b.price)) ||
    ((savingPercent(b.price, b.was_price) || 0) - (savingPercent(a.price, a.was_price) || 0)));
  const best = ranked[0];
  if (!inStock(best)) return { id: null, note: 'none-in-stock' };
  const others = products.filter(p => p.id !== best.id && inStock(p));
  const nextPrice = others.length ? Math.min(...others.map(p => Number(p.price))) : null;
  return { id: best.id, best, nextPrice };
}

function pickText(site, pick) {
  const cur = pick.best.currency || site.currency;
  if (pick.nextPrice === null) return tr('The only one of your products that is in stock.');
  const diff = pick.nextPrice - Number(pick.best.price);
  if (diff > 0) return tr('In stock and {0} cheaper than the next in-stock product you picked.', formatPrice(diff, cur, site.locale));
  return tr('In stock, at the joint lowest price, with the bigger saving.');
}

export function comparePage(site, products, ids) {
  const categoryName = slug => (site.categories.find(c => c.slug === slug) || {}).name || slug;
  const without = id => {
    const rest = products.map(p => p.id).filter(x => x !== id);
    return rest.length ? `/compare/?ids=${rest.join(',')}` : '/compare/';
  };
  const pick = comparePick(products);
  const was = p => (Number(p.was_price) > Number(p.price) ? formatPrice(p.was_price, p.currency || site.currency, site.locale) : '');
  const cell = (p, content) => html`<td class="${pick && pick.id === p.id ? 'is-pick' : ''}">${content}</td>`;
  const row = (label, fn) => html`<tr><th scope="row">${label}</th>${products.map(p => cell(p, fn(p)))}</tr>`;

  const table = products.length ? html`<div class="compare-scroll" role="region" aria-label="Comparison table" tabindex="0">
<table class="compare-table">
  <thead><tr><th scope="col"><span class="visually-hidden">Detail</span></th>${products.map(p => html`<th scope="col" class="${pick && pick.id === p.id ? 'is-pick' : ''}">
    ${pick && pick.id === p.id ? html`<span class="pick-badge">Our pick · Best value</span>` : ''}
    <a class="compare-photo" href="${productPath(p)}"><img src="${p.image_url}" alt="" width="160" height="160" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
    <a class="compare-name" href="${productPath(p)}" translate="no">${p.product_name}</a>
    <a class="compare-remove" href="${without(p.id)}">Remove</a>
  </th>`)}</tr></thead>
  <tbody>
    ${row('Price', p => html`<strong class="compare-price">${priceTag(site, p.price, p.currency, 'compare-amount')}</strong>`)}
    ${row('Previous price', p => (was(p) ? html`<s>${was(p)}</s> <span class="tag-save">${tr('Save {0}%', savingPercent(p.price, p.was_price))}</span>` : '—'))}
    ${row('Stock', p => (inStock(p) ? html`<span class="ok">In stock</span>` : html`<span class="warn">Out of stock</span>`))}
    ${row('Retailer', p => html`<span translate="no">${p.retailer}</span>`)}
    ${site.deliversTo ? row('Delivers to', p => deliveryText(site, p.retailer) || '—') : ''}
    ${row('Brand', p => html`<span translate="no">${p.brand || '—'}</span>`)}
    ${row('Category', p => categoryName(p.category_slug))}
    ${row('Condition', p => (p.item_condition === 'refurbished' ? 'Refurbished' : 'New'))}
    ${row('EAN / GTIN', p => p.gtin || '—')}
    ${row('Price checked', p => (p.last_seen_at ? html`<time datetime="${String(p.last_seen_at).slice(0, 10)}">${String(p.last_seen_at).slice(0, 10)}</time>` : '—'))}
    <tr><th scope="row"><span class="visually-hidden">Buy</span></th>${products.map(p => cell(p, html`<a class="btn btn-deal" href="/out/${p.id}" rel="sponsored nofollow noopener" target="_blank">${tr('View at {0}', p.retailer)}</a>${site.cart ? html`<button type="button" class="btn-cart" data-cart="${p.id}" aria-pressed="false" hidden>+ Cart</button>` : ''}`))}</tr>
  </tbody>
</table>
</div>` : '';

  const pickBox = pick && pick.id ? html`<div class="pick-box">
  <p class="pick-label">Our pick · Best value</p>
  <p class="pick-name" translate="no"><a href="${productPath(pick.best)}">${pick.best.product_name}</a></p>
  <p>${pickText(site, pick)}</p>
</div>` : pick && pick.note === 'different-categories'
    ? html`<p class="pick-note">These products are from different categories, so we do not pick one. Compare products from the same category to see our pick.</p>`
    : pick && pick.note === 'none-in-stock' ? html`<p class="pick-note">${tr('None of these products is in stock right now, so we do not pick one.')}</p>` : '';

  const body = html`<div class="wrap section">
  ${breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Compare', path: '/compare/' }])}
  <h1>Compare products</h1>
  <p class="compare-lead">${tr('Up to {0} products side by side: price, stock and retailer.', COMPARE_MAX)} Always check the final price on the retailer's website.</p>
  ${products.length < 2 ? html`<p>${tr('Choose 2 to {0} products with the + Compare button on any product, then open the compare bar at the bottom of the screen.', COMPARE_MAX)}</p>
  <p><a class="btn btn-gold" href="/#cats-h">Browse categories</a></p>` : ''}
  ${pickBox}
  ${table}
  ${products.length >= 2 ? html`<p class="pick-rule"><strong>How we pick:</strong> only for products from the same category; products in stock first, then the lowest price, then the bigger saving. We compare price and stock from the retailers' feeds. We do not test products.</p>` : ''}
  <div data-compare-ids="${products.map(p => p.id).join(',')}" hidden></div>
</div>`;

  return page(site, {
    title: `Compare products | ${site.name}`,
    description: `Compare up to ${COMPARE_MAX} ${site.topicLong || 'tech'} products side by side: price, stock and retailer.`,
    path: ids.length ? `/compare/?ids=${ids.join(',')}` : '/compare/',
    canonical: '/compare/',
    robots: 'noindex,follow',
    body
  });
}
