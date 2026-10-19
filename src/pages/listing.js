// Category, search and deals pages: server-rendered lists with filters and pagination (lessons L09, L10).
import { html, raw } from '../lib/html.js';
import { categoryPath } from '../lib/text.js';
import { SORT_OPTIONS } from '../db.js';
import { page, productGrid, breadcrumbs, breadcrumbSchema, searchForm, categoryImage, tr } from './layout.js';

export function readListingParams(url) {
  const sp = url.searchParams;
  const num = v => {
    const n = Number.parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : NaN;
  };
  const pageNo = Math.max(1, Math.min(500, Number.parseInt(sp.get('page') || '1', 10) || 1));
  return {
    brand: (sp.get('brand') || '').slice(0, 80),
    retailer: (sp.get('retailer') || '').slice(0, 80),
    maxPrice: num(sp.get('max')),
    minPrice: num(sp.get('min')),
    inStock: sp.get('stock') === '1',
    condition: ['new', 'refurbished'].includes(sp.get('condition')) ? sp.get('condition') : '',
    sort: sp.get('sort') || 'featured',
    page: pageNo
  };
}

export function hasFilters(p) {
  return Boolean(p.brand || p.retailer || Number.isFinite(p.maxPrice) || Number.isFinite(p.minPrice) || p.inStock || p.condition || (p.sort && p.sort !== 'featured'));
}

function pageLink(basePath, params, pageNo) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== '' && v !== undefined && v !== null) sp.set(k, v);
  if (pageNo > 1) sp.set('page', String(pageNo)); else sp.delete('page');
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function keepParams(p, extra = {}) {
  return {
    ...extra,
    brand: p.brand,
    retailer: p.retailer,
    min: Number.isFinite(p.minPrice) ? String(p.minPrice) : '',
    max: Number.isFinite(p.maxPrice) ? String(p.maxPrice) : '',
    stock: p.inStock ? '1' : '',
    condition: p.condition,
    sort: p.sort && p.sort !== 'featured' ? p.sort : ''
  };
}

function pagination(basePath, params, result) {
  if (result.pages <= 1) return '';
  const cur = result.page;
  const nums = new Set([1, result.pages, cur - 1, cur, cur + 1].filter(n => n >= 1 && n <= result.pages));
  const list = [...nums].sort((a, b) => a - b);
  const items = [];
  let last = 0;
  for (const n of list) {
    if (n - last > 1) items.push(html`<li class="gap" aria-hidden="true">&hellip;</li>`);
    items.push(n === cur
      ? html`<li><span aria-current="page">${n}</span></li>`
      : html`<li><a href="${pageLink(basePath, params, n)}">${n}</a></li>`);
    last = n;
  }
  return html`<nav class="pager" aria-label="Pages">
  ${cur > 1 ? html`<a class="pager-step" href="${pageLink(basePath, params, cur - 1)}" rel="prev">Previous</a>` : ''}
  <ol>${items}</ol>
  ${cur < result.pages ? html`<a class="pager-step" href="${pageLink(basePath, params, cur + 1)}" rel="next">Next</a>` : ''}
</nav>`;
}

function filterForm(action, p, facets, hidden = {}) {
  const opt = (value, label, selected) => html`<option value="${value}"${selected ? raw(' selected') : ''}>${label}</option>`;
  const optKeep = (value, label, selected) => html`<option value="${value}"${selected ? raw(' selected') : ''} translate="no">${label}</option>`;
  return html`<form class="filters" action="${action}" method="get">
  ${Object.entries(hidden).map(([k, v]) => html`<input type="hidden" name="${k}" value="${v}">`)}
  <details class="filters-box" open>
    <summary>Filter and sort</summary>
    <div class="filters-fields">
      <label>Sort by
        <select name="sort" data-autosubmit>
          ${SORT_OPTIONS.map(([v, l]) => opt(v, l, (p.sort || 'featured') === v))}
        </select>
      </label>
      ${facets && facets.brands.length ? html`<label>Brand
        <select name="brand" data-autosubmit>
          ${opt('', 'All brands', !p.brand)}
          ${facets.brands.map(b => optKeep(b.name, `${b.name} (${b.n})`, p.brand === b.name))}
        </select>
      </label>` : ''}
      ${facets && facets.retailers.length > 1 ? html`<label>Retailer
        <select name="retailer" data-autosubmit>
          ${opt('', 'All retailers', !p.retailer)}
          ${facets.retailers.map(r => optKeep(r.name, `${r.name} (${r.n})`, p.retailer === r.name))}
        </select>
      </label>` : ''}
      <fieldset class="price-range">
        <legend>Price (&pound;)</legend>
        <label><span class="visually-hidden">Minimum price</span><input type="number" name="min" min="0" step="1" inputmode="numeric" placeholder="Min" value="${Number.isFinite(p.minPrice) ? p.minPrice : ''}"></label>
        <label><span class="visually-hidden">Maximum price</span><input type="number" name="max" min="0" step="1" inputmode="numeric" placeholder="Max" value="${Number.isFinite(p.maxPrice) ? p.maxPrice : ''}"></label>
      </fieldset>
      <label class="check"><input type="checkbox" name="stock" value="1"${p.inStock ? raw(' checked') : ''}> In stock only</label>
      <label class="check"><input type="checkbox" name="condition" value="refurbished"${p.condition === 'refurbished' ? raw(' checked') : ''}> Refurbished only</label>
      <div class="filters-actions">
        <button class="btn btn-quiet" type="submit">Apply filters</button>
        <a class="reset" href="${action}${hidden.q ? `?q=${encodeURIComponent(hidden.q)}` : ''}">Clear all</a>
      </div>
    </div>
  </details>
</form>`;
}

function resultsHeader(result) {
  const fmt = n => new Intl.NumberFormat('en-GB').format(n);
  if (!result.total) return '';
  const count = result.total === 1 ? tr('1 product') : tr('{0} products', fmt(result.total));
  return html`<p class="result-count">${count}${result.pages > 1 ? html`, ${tr('page {0} of {1}', result.page, result.pages)}` : ''}</p>`;
}

export function categoryPage(site, cat, p, result, facets) {
  const base = categoryPath(cat.slug);
  const filtered = hasFilters(p);
  const params = keepParams(p);
  const crumbs = [{ name: 'Home', path: '/' }, { name: cat.name, path: base }];
  const canonical = filtered ? base : (p.page > 1 ? pageLink(base, {}, p.page) : base);
  const body = html`
<div class="wrap">
  ${breadcrumbs(crumbs)}
  <header class="page-head${categoryImage(site, cat.slug) ? ' cat-banner' : ''}">
    ${categoryImage(site, cat.slug) ? html`<img class="cat-banner-img" src="${categoryImage(site, cat.slug)}" alt="" width="720" height="480" fetchpriority="high" decoding="async">` : ''}
    <div class="cat-banner-text">
      <h1>${cat.name}</h1>
      <p class="lede">${cat.intro}</p>
    </div>
  </header>
  <div class="listing">
    <aside class="listing-side">${filterForm(base, p, facets)}</aside>
    <div class="listing-main">
      ${resultsHeader(result)}
      ${result.products.length
        ? html`<h2 class="visually-hidden">${tr('Products')}</h2>${productGrid(site, result.products)}`
        : filtered
          ? html`<div class="empty"><h2>No products match these filters</h2><p>Remove a filter or <a href="${base}">see all products in this category</a>.</p></div>`
          : html`<div class="empty" data-empty-category><h2>${tr('Coming soon')}</h2><p>${tr('We are adding products to this category. Until then, browse the other categories.')}</p>
            <ul class="chip-list">${site.categories.filter(c => c.slug !== cat.slug).map(c => html`<li><a href="${categoryPath(c.slug)}">${c.name}</a></li>`)}</ul></div>`}
      ${pagination(base, params, result)}
    </div>
  </div>
</div>`;
  const pageSuffix = p.page > 1 ? ` (page ${p.page})` : '';
  return page(site, {
    title: `${cat.name}${pageSuffix} | Compare prices | ${site.name}`,
    description: cat.description,
    path: base,
    canonical,
    robots: filtered || !result.products.length ? 'noindex,follow' : 'index,follow',
    prev: !filtered && p.page > 1 ? pageLink(base, {}, p.page - 1) : null,
    next: !filtered && p.page < result.pages ? pageLink(base, {}, p.page + 1) : null,
    currentCategory: cat.slug,
    body,
    schema: [breadcrumbSchema(site, crumbs)]
  });
}

export function searchPage(site, q, p, result, usedQuery = '') {
  const params = keepParams(p, { q });
  const body = html`
<div class="wrap">
  <header class="page-head">
    <h1>${q ? html`${tr('Results for “{0}”', q)}` : 'Search'}</h1>
    ${searchForm(site, q, 'page-search')}
  </header>
  ${q ? html`<div class="listing">
    <aside class="listing-side">${filterForm('/search', p, null, { q })}</aside>
    <div class="listing-main">
      ${usedQuery ? html`<p class="search-note">${tr('Showing results for “{0}”', usedQuery)}</p>` : ''}
      ${resultsHeader(result)}
      ${result.products.length
        ? html`<h2 class="visually-hidden">${tr('Products')}</h2>${productGrid(site, result.products)}`
        : html`<div class="empty"><h2>${tr('No products found for “{0}”', q)}</h2><p>Check the spelling, try a shorter word such as a brand name, or browse a category.</p>
          <ul class="chip-list">${site.categories.map(c => html`<li><a href="${categoryPath(c.slug)}">${c.name}</a></li>`)}</ul></div>`}
      ${pagination('/search', params, result)}
    </div>
  </div>` : html`<p>Type a product, brand or model above.</p>`}
</div>`;
  return page(site, {
    title: q ? `${q} | Search | ${site.name}` : `Search | ${site.name}`,
    description: `Search results on ${site.name}.`,
    path: '/search',
    canonical: null,
    robots: 'noindex,follow',
    searchValue: q,
    body
  });
}

export function dealsPage(site, p, result) {
  const base = '/deals/';
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Price drops', path: base }];
  const body = html`
<div class="wrap">
  ${breadcrumbs(crumbs)}
  <header class="page-head">
    <h1>Price drops</h1>
    <p class="lede">Products that cost less now than the retailer's previous price, biggest saving first.</p>
  </header>
  ${resultsHeader(result)}
  ${result.products.length
    ? html`<h2 class="visually-hidden">${tr('Products')}</h2>${productGrid(site, result.products)}`
    : html`<div class="empty"><h2>${tr('No price drops right now')}</h2><p>${tr('Prices change every day.')} <a href="/">${tr('Browse all categories')}</a></p></div>`}
  ${pagination(base, {}, result)}
</div>`;
  return page(site, {
    title: `${site.topicTitle} price drops${p.page > 1 ? ` (page ${p.page})` : ''} | ${site.name}`,
    description: `Current price drops on ${site.topic} from trusted retailers, compared on ${site.name}.`,
    path: base,
    canonical: p.page > 1 ? pageLink(base, {}, p.page) : base,
    robots: result.products.length ? 'index,follow' : 'noindex,follow',
    body,
    schema: [breadcrumbSchema(site, crumbs)]
  });
}
