// Product page: server-rendered, with a clear button to the retailer (lessons L20) and valid structured data (L12).
import { html, raw } from '../lib/html.js';
import { categoryPath, productPath, formatPrice, savingPercent, truncate, formatDate } from '../lib/text.js';
import { normalizeGtin, gtinSchemaKey } from '../lib/gtin.js';
import { page, productGrid, breadcrumbs, breadcrumbSchema, absolute } from './layout.js';

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

export function productPage(site, product, category, similar) {
  const path = productPath(product);
  const price = formatPrice(product.price, product.currency || site.currency, site.locale);
  const was = Number(product.was_price) > Number(product.price) ? formatPrice(product.was_price, product.currency || site.currency, site.locale) : '';
  const pct = savingPercent(product.price, product.was_price);
  const inStock = Number(product.in_stock) === 1;
  const checked = formatDate(product.last_seen_at, site.locale);
  const description = truncate(product.description || '', 2500);
  const rows = specsList(product);
  const crumbs = [
    { name: 'Home', path: '/' },
    ...(category ? [{ name: category.name, path: categoryPath(category.slug) }] : []),
    { name: truncate(product.product_name, 60), path }
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
      ${product.brand ? html`<p class="label-brand">${product.brand}</p>` : ''}
      <h1>${product.product_name}</h1>
      <div class="shelf">
        <p class="shelf-price"><span class="price">${price}</span>${was ? html`<s class="was">${was}</s>` : ''}</p>
        ${pct ? html`<p class="tag-save">Save ${pct}% on the previous price</p>` : ''}
        <dl class="shelf-facts">
          <div><dt>Retailer</dt><dd>${product.retailer}</dd></div>
          <div><dt>Stock</dt><dd class="${inStock ? 'ok' : 'warn'}">${inStock ? 'In stock' : 'Out of stock'}</dd></div>
          ${product.item_condition === 'refurbished' ? html`<div><dt>Condition</dt><dd>Refurbished</dd></div>` : ''}
          ${checked ? html`<div><dt>Price checked</dt><dd>${checked}</dd></div>` : ''}
        </dl>
        <a class="btn btn-deal btn-big" href="/out/${product.id}" rel="sponsored nofollow noopener" target="_blank">View at ${product.retailer}</a>
        <button type="button" class="btn-compare btn-compare-big" data-compare="${product.id}" aria-pressed="false" hidden>+ Compare</button>
        <p class="shelf-note">You buy on the ${product.retailer} website, at their price. We may earn a commission. <a href="/how-we-make-money/">How this works</a></p>
      </div>
    </div>
  </article>

  ${description ? html`<section class="section prose" aria-labelledby="desc-h">
    <h2 id="desc-h">About this product</h2>
    <p>${description}</p>
  </section>` : ''}

  ${rows.length ? html`<section class="section" aria-labelledby="spec-h">
    <h2 id="spec-h">Specifications</h2>
    <dl class="spec-sheet">${rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
  </section>` : ''}

  ${similar.length ? html`<section class="section" aria-labelledby="sim-h">
    <h2 id="sim-h">Similar ${category ? category.name.toLowerCase() : 'products'}</h2>
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
