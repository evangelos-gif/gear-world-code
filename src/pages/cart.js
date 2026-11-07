// Saved list (lessons L26, L101): a list the visitor keeps in their own browser. Nothing is bought here: every
// item has its own button to the retailer, through /out/<id> so the click is recorded and carries the clickref.
// The page is built by the server from the address (/saved/?items=12,34), like /compare/, so it also works
// without JavaScript; the site script keeps the browser's list and this address in step.
// Until 7 Nov 2026 it was the "Gear Cart", with quantities and an estimated total. Google Ads suspended the
// account for "unacceptable business practices": a cart, a quantity and a total read as a shop that sells. So it is
// a saved list now (no quantities, no total), and the old /cart/ addresses lead here (engine.js).
import { html } from '../lib/html.js';
import { productPath } from '../lib/text.js';
import { page, breadcrumbs, tr, viewAt, priceTag, deliveryLine } from './layout.js';

export const SAVED_PATH = '/saved/';

// items=12,34 (the older 12:2 form too: the quantity is ignored) -> [{ id: 12 }, { id: 34 }]: whole numbers only,
// no repeats, at most maxItems.
export function parseCartItems(url, { maxItems = 30 } = {}) {
  const items = [];
  for (const part of (url.searchParams.get('items') || '').split(',')) {
    const m = part.trim().match(/^(\d{1,12})(?::\d{1,3})?$/);
    if (!m) continue;
    const id = Number(m[1]);
    if (id < 1 || items.some(x => x.id === id)) continue;
    items.push({ id });
    if (items.length === maxItems) break;
  }
  return items;
}

export function cartQuery(items) {
  return items.length ? `${SAVED_PATH}?items=${items.map(x => x.id).join(',')}` : SAVED_PATH;
}

export function cartPage(site, products, items) {
  const name = 'Saved list';
  const byId = new Map(products.map(p => [Number(p.id), p]));
  // Items whose product is no longer listed are dropped from the page (and from the browser's list).
  const lines = items.filter(x => byId.has(x.id)).map(x => ({ ...x, p: byId.get(x.id) }));
  const listed = lines.map(l => ({ id: l.id }));
  const without = id => cartQuery(listed.filter(x => x.id !== id));

  const list = lines.length ? html`<ul class="cart-list">
  ${lines.map(l => {
    const p = l.p;
    const cur = p.currency || site.currency;
    const inStock = Number(p.in_stock) === 1;
    return html`<li class="cart-item" data-cart-line="${p.id}">
    <a class="cart-photo" href="${productPath(p)}" tabindex="-1" aria-hidden="true"><img src="${p.image_url}" alt="" width="96" height="96" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
    <div class="cart-info">
      <p class="cart-name" translate="no"><a href="${productPath(p)}">${p.product_name}</a></p>
      <p class="cart-meta"><span>Sold by</span> <span translate="no">${p.retailer}</span>${inStock ? '' : html` · <span class="warn">Out of stock</span>`}</p>
      ${deliveryLine(site, p.retailer, { cls: 'cart-ship', max: 0 })}
      <p class="cart-price">${priceTag(site, p.price, cur)}</p>
      <div class="cart-controls">
        <a class="cart-remove" href="${without(p.id)}" rel="nofollow">Remove</a>
      </div>
      <a class="btn btn-deal" href="/out/${p.id}" rel="sponsored nofollow noopener" target="_blank">${viewAt(p.retailer)}</a>
    </div>
  </li>`;
  })}
</ul>` : html`<div class="empty cart-empty">
  <h2>Your saved list is empty</h2>
  <p>Use the + Save button on any product to keep it here while you compare retailers.</p>
  <p><a class="btn btn-gold" href="/#cats-h">Browse categories</a></p>
</div>`;

  const summary = lines.length ? html`<aside class="cart-summary">
  <p class="cart-note">You buy each item on the retailer's own website, at the retailer's price. There is no checkout on this site. Prices can change, so check them on the retailer's website.</p>
  <p><a class="cart-clear" href="${SAVED_PATH}" data-cart-clear rel="nofollow">Clear the saved list</a></p>
</aside>` : '';

  const body = html`<div class="wrap section">
  ${breadcrumbs([{ name: 'Home', path: '/' }, { name, path: SAVED_PATH }])}
  <h1>${name}</h1>
  <div class="cart-layout${lines.length ? '' : ' is-empty'}">
    ${list}
    ${summary}
  </div>
  <div data-cart-items="${listed.map(x => x.id).join(',')}" hidden></div>
</div>`;

  return page(site, {
    title: `${name} | ${site.name}`,
    description: `Your saved list: the products you saved on ${site.name}.`,
    path: cartQuery(listed),
    canonical: SAVED_PATH,
    robots: 'noindex,follow',
    body
  });
}
