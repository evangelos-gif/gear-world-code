// Gear Cart (lessons L26): a list the visitor keeps in their own browser. Nothing is bought here: every
// item has its own button to the retailer, through /out/<id> so the click is recorded and carries the clickref.
// The page is built by the server from the address (/cart/?items=12:2,34:1), like /compare/, so it also works
// without JavaScript; the site script keeps the browser's list and this address in step.
import { html } from '../lib/html.js';
import { productPath } from '../lib/text.js';
import { page, breadcrumbs, tr, priceTag } from './layout.js';

// items=12:2,34:1 -> [{ id: 12, qty: 2 }, { id: 34, qty: 1 }]: whole numbers only, no repeats, limits from config.
export function parseCartItems(url, { maxItems = 30, maxQuantity = 99 } = {}) {
  const items = [];
  for (const part of (url.searchParams.get('items') || '').split(',')) {
    const m = part.trim().match(/^(\d{1,12})(?::(\d{1,3}))?$/);
    if (!m) continue;
    const id = Number(m[1]);
    const qty = Math.min(maxQuantity, Math.max(1, Number(m[2] || 1)));
    if (id < 1 || items.some(x => x.id === id)) continue;
    items.push({ id, qty });
    if (items.length === maxItems) break;
  }
  return items;
}

export function cartQuery(items) {
  return items.length ? `/cart/?items=${items.map(x => `${x.id}:${x.qty}`).join(',')}` : '/cart/';
}

export function cartPage(site, products, items) {
  const name = site.cart.name;
  const max = site.cart.maxQuantity || 99;
  const byId = new Map(products.map(p => [Number(p.id), p]));
  // Items whose product is no longer listed are dropped from the page (and from the browser's list).
  const lines = items.filter(x => byId.has(x.id)).map(x => ({ ...x, p: byId.get(x.id) }));
  const listed = lines.map(l => ({ id: l.id, qty: l.qty }));
  const withQty = (id, qty) => cartQuery(listed.map(x => (x.id === id ? { id, qty } : x)).filter(x => x.qty > 0));
  const totals = new Map();
  for (const l of lines) {
    const cur = String(l.p.currency || site.currency).toUpperCase();
    totals.set(cur, (totals.get(cur) || 0) + Number(l.p.price) * l.qty);
  }
  const units = lines.reduce((n, l) => n + l.qty, 0);

  const list = lines.length ? html`<ul class="cart-list">
  ${lines.map(l => {
    const p = l.p;
    const cur = p.currency || site.currency;
    const inStock = Number(p.in_stock) === 1;
    return html`<li class="cart-item" data-cart-line="${p.id}">
    <a class="cart-photo" href="${productPath(p)}" tabindex="-1" aria-hidden="true"><img src="${p.image_url}" alt="" width="96" height="96" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
    <div class="cart-info">
      <p class="cart-name" translate="no"><a href="${productPath(p)}">${p.product_name}</a></p>
      <p class="cart-meta"><span translate="no">${p.retailer}</span>${inStock ? '' : html` · <span class="warn">Out of stock</span>`}</p>
      <p class="cart-price">${priceTag(site, p.price, cur)}${l.qty > 1 ? html` <span class="cart-each" translate="no">× ${l.qty}</span>` : ''}</p>
      <div class="cart-controls">
        <div class="qty" role="group" aria-label="Quantity">
          <a class="qty-btn" href="${withQty(p.id, l.qty - 1)}" aria-label="One less" rel="nofollow">&minus;</a>
          <span class="qty-n">${l.qty}</span>
          ${l.qty < max ? html`<a class="qty-btn" href="${withQty(p.id, l.qty + 1)}" aria-label="One more" rel="nofollow">+</a>` : html`<span class="qty-btn is-off" aria-hidden="true">+</span>`}
        </div>
        <a class="cart-remove" href="${withQty(p.id, 0)}" rel="nofollow">Remove</a>
      </div>
      <a class="btn btn-deal" href="/out/${p.id}" rel="sponsored nofollow noopener" target="_blank">${tr('View at {0}', p.retailer)}</a>
    </div>
  </li>`;
  })}
</ul>` : html`<div class="empty cart-empty">
  <h2>Your ${name} is empty</h2>
  <p>Use the + Cart button on any product to keep it here while you compare retailers.</p>
  <p><a class="btn btn-gold" href="/#cats-h">Browse categories</a></p>
</div>`;

  const summary = lines.length ? html`<aside class="cart-summary" aria-labelledby="cart-total-h">
  <h2 id="cart-total-h">Estimated total</h2>
  ${[...totals.entries()].map(([cur, total]) => html`<p class="cart-total">${priceTag(site, total, cur)}</p>`)}
  <p class="cart-units">${units === 1 ? tr('1 item') : tr('{0} items', units)}</p>
  <p class="cart-note">You buy each item on the retailer's own website, at the retailer's price. There is no checkout on this site. Prices can change, so check them on the retailer's website.</p>
  <p><a class="cart-clear" href="/cart/" data-cart-clear rel="nofollow">Empty the ${name}</a></p>
</aside>` : '';

  const body = html`<div class="wrap section">
  ${breadcrumbs([{ name: 'Home', path: '/' }, { name, path: '/cart/' }])}
  <h1>${name}</h1>
  <div class="cart-layout${lines.length ? '' : ' is-empty'}">
    ${list}
    ${summary}
  </div>
  <div data-cart-items="${listed.map(x => `${x.id}:${x.qty}`).join(',')}" hidden></div>
</div>`;

  return page(site, {
    title: `${name} | ${site.name}`,
    description: `Your ${name}: the products you saved on ${site.name}.`,
    path: cartQuery(listed),
    canonical: '/cart/',
    robots: 'noindex,follow',
    body
  });
}

