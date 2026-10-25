// Product page: server-rendered, with a clear button to the retailer (lessons L20) and valid structured data (L12).
import { html, raw } from '../lib/html.js';
import { categoryPath, productPath, formatPrice, savingPercent, truncate, formatDate } from '../lib/text.js';
import { normalizeGtin, gtinSchemaKey } from '../lib/gtin.js';
import { page, productGrid, breadcrumbs, breadcrumbSchema, absolute, tr, priceTag, retailerFlag, deliveryText, deliveryLine } from './layout.js';

function specsList(product) {
  let specs = {};
  try { specs = product.specs_json ? JSON.parse(product.specs_json) : {}; } catch { specs = {}; }
  const rows = [];
  if (product.brand) rows.push(['Brand', product.brand]);
  if (product.mpn) rows.push(['Model number', product.mpn]);
  const gtin = normalizeGtin(product.gtin);
  if (gtin) rows.push(['EAN / GTIN', gtin]);
  if (product.item_condition && product.item_condition !== 'new') rows.push(['Condition', product.item_condition[0].toUpperCase() + product.item_condition.slice(1)]);
  for (const [k, v] of Object.entries(specs)) {
    if (rows.length >= 20) break;
    if (v === null || v === undefined || String(v).trim() === '' || k === 'description') continue;
    rows.push([String(k).slice(0, 40), String(v).slice(0, 160)]);
  }
  return rows;
}

export function productPage(site, product, category, similar, offers = []) {
  const path = productPath(product);
  const price = formatPrice(product.price, product.currency || site.currency, site.locale);
  const was = Number(product.was_price) > Number(product.price) ? formatPrice(product.was_price, product.currency || site.currency, site.locale) : '';
  const pct = savingPercent(product.price, product.was_price);
  const inStock = Number(product.in_stock) === 1;
  const checked = formatDate(product.last_seen_at, site.locale);
  const description = truncate(product.description || '', 2500);
  const rows = specsList(product);
  const delivers = deliveryText(site, product.retailer);
  const crumbs = [
    { name: 'Home', path: '/' },
    ...(category ? [{ name: category.name, path: categoryPath(category.slug) }] : []),
    { name: truncate(product.product_name, 60), path, keep: true }
  ];
  const metaDescription = truncate(
    `${product.product_name}: ${price}${inStock ? '' : ' (out of stock)'} at ${product.retailer}. Compare ${site.topic} prices on ${site.name}.`,
    158
  );
  const gtin = normalizeGtin(product.gtin);
  const offer = {
    '@type': 'Offer',
    url: absolute(site, path),
    price: Number(product.price).toFixed(2),
    priceCurrency: String(product.currency || site.currency).toUpperCase(),
    availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: product.item_condition === 'refurbished'
      ? 'https://schema.org/RefurbishedCondition'
      : product.item_condition === 'used' ? 'https://schema.org/UsedCondition' : 'https://schema.org/NewCondition',
    seller: { '@type': 'Organization', name: product.retailer }
  };
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.product_name,
    url: absolute(site, path),
    image: [product.image_url],
    description: truncate(description || metaDescription, 500),
    sku: String(product.id),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(product.mpn ? { mpn: product.mpn } : {}),
    ...(gtin ? { [gtinSchemaKey(gtin)]: gtin } : {}),
    offers: offer
  };

  const body = html`
<div class="wrap">
  ${breadcrumbs(crumbs)}
  <article class="product">
    <div class="product-photo">
      <img src="${product.image_url}" alt="${product.product_name}" width="560" height="560" decoding="async" referrerpolicy="no-referrer">
    </div>
    <div class="product-label">
      ${product.brand ? html`<p class="label-brand" translate="no">${product.brand}</p>` : ''}
      <h1 translate="no">${product.product_name}</h1>
      <div class="shelf">
        <p class="shelf-price">${priceTag(site, product.price, product.currency)}${was ? html`<s class="was">${was}</s>` : ''}</p>
        ${pct ? html`<p class="tag-save">${tr('Save {0}% on the previous price', pct)}</p>` : ''}
        <dl class="shelf-facts">
          <div><dt>Retailer</dt><dd translate="no">${product.retailer}${retailerFlag(site, product.retailer)}</dd></div>
          ${delivers ? html`<div><dt>Delivers to</dt><dd class="ship-dd">${delivers}</dd></div>` : ''}
          <div><dt>Stock</dt><dd class="${inStock ? 'ok' : 'warn'}">${inStock ? 'In stock' : 'Out of stock'}</dd></div>
          ${product.item_condition === 'refurbished' ? html`<div><dt>Condition</dt><dd>Refurbished</dd></div>` : ''}
          ${checked ? html`<div><dt>Price checked</dt><dd><time datetime="${String(product.last_seen_at).slice(0, 10)}">${checked}</time></dd></div>` : ''}
        </dl>
        <a class="btn btn-deal btn-big" href="/out/${product.id}" rel="sponsored nofollow noopener" target="_blank">${tr('View at {0}', product.retailer)}</a>
        <div class="card-actions card-actions-big">
          <button type="button" class="btn-compare btn-compare-big" data-compare="${product.id}" aria-pressed="false" hidden>+ Compare</button>
          ${site.cart ? html`<button type="button" class="btn-cart btn-cart-big" data-cart="${product.id}" aria-pressed="false" hidden>+ Cart</button>` : ''}
        </div>
        ${offers.length > 1 ? html`<p class="shelf-offers"><a href="#prices">${tr('Compare {0} retailers', offers.length)}</a></p>` : ''}
        <p class="shelf-note">${tr('You buy on the {0} website, at their price.', product.retailer)} We may earn a commission. <a href="/how-we-make-money/">How this works</a></p>
      </div>
    </div>
  </article>

  ${offers.length > 1 ? html`<section class="section" id="prices" aria-labelledby="prices-h">
    <h2 id="prices-h">${tr('Prices at {0} retailers', offers.length)}</h2>
    <ul class="offer-list">${offers.map((o, i) => html`<li class="offer-row${Number(o.id) === Number(product.id) ? ' offer-current' : ''}">
      <span class="offer-who"><span class="offer-retailer" translate="no">${o.retailer}${retailerFlag(site, o.retailer)}</span>${deliveryLine(site, o.retailer, { cls: 'offer-ship', tag: 'span', max: 0 })}</span>
      <span class="offer-price">${priceTag(site, o.price, o.currency)}${i === 0 && Number(o.in_stock) === 1 ? html` <span class="tag-best">${tr('Lowest price')}</span>` : ''}</span>
      <span class="offer-stock ${Number(o.in_stock) === 1 ? 'ok' : 'warn'}">${Number(o.in_stock) === 1 ? 'In stock' : 'Out of stock'}</span>
      <a class="btn btn-deal" href="/out/${o.id}" rel="sponsored nofollow noopener" target="_blank">${tr('View at {0}', o.retailer)}</a>
    </li>`)}</ul>
    <p class="offer-note">${site.database && site.database.groupTable ? tr('The same product at each retailer, matched by its product code. Prices and stock as the retailers report them.') : tr('Same product code (EAN) at each retailer. Prices and stock as the retailers report them.')}</p>
  </section>` : ''}

  ${description ? html`<section class="section prose" aria-labelledby="desc-h">
    <h2 id="desc-h">About this product</h2>
    <p translate="no">${description}</p>
  </section>` : ''}

  ${rows.length ? html`<section class="section" aria-labelledby="spec-h">
    <h2 id="spec-h">Specifications</h2>
    <dl class="spec-sheet" translate="no">${rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
  </section>` : ''}

  ${similar.length ? html`<section class="section" aria-labelledby="sim-h">
    <h2 id="sim-h">Similar products</h2>
    ${productGrid(site, similar)}
  </section>` : ''}
</div>`;

  return page(site, {
    title: `${truncate(product.product_name, 70)} | ${price} | ${site.name}`,
    description: metaDescription,
    path,
    ogType: 'product',
    ogImage: product.image_url,
    currentCategory: category ? category.slug : '',
    body,
    schema: [productSchema, breadcrumbSchema(site, crumbs)]
  });
}
