import { html, raw } from '../lib/html.js';
import { categoryPath, formatDate } from '../lib/text.js';
import { page, productGrid, productCard, searchForm, icon, absolute } from './layout.js';

export function homePage(site, data) {
  const fmt = n => new Intl.NumberFormat(site.locale).format(n);
  // The hero board shows the first three items; the sections below show the rest, so nothing repeats (L03).
  const boardFromDeals = data.deals.length >= 3;
  const board = (boardFromDeals ? data.deals : data.newest).slice(0, 3);
  const onBoard = new Set(board.map(p => p.id));
  const deals = data.deals.filter(p => !onBoard.has(p.id)).slice(0, 8);
  const newest = data.newest.filter(p => !onBoard.has(p.id) && !deals.some(d => d.id === p.id)).slice(0, 8);
  const body = html`
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <h1>${site.heroTitle}</h1>
      <p class="lede">${site.heroText}</p>
      ${searchForm(site, '', 'hero-search')}
      <p class="hero-facts">${fmt(data.totalProducts)} products from ${fmt(data.retailers.length)} ${data.retailers.length === 1 ? 'retailer' : 'retailers'}.${data.lastUpdated ? html` Prices last updated ${formatDate(data.lastUpdated, site.locale)}.` : ''}</p>
    </div>
    ${board.length ? html`<div class="price-board" aria-label="${boardFromDeals ? 'Biggest price drops' : 'Just added'}">
      ${board.map(p => productCard(site, p))}
    </div>` : ''}
  </div>
</section>

<section class="wrap section" aria-labelledby="cats-h">
  <h2 id="cats-h">Shop by category</h2>
  <ul class="drawer-grid">
    ${site.categories.map(c => html`<li>
      <a class="drawer" href="${categoryPath(c.slug)}">
        ${icon(c.icon, 'drawer-icon')}
        <span class="drawer-name">${c.name}</span>
        <span class="drawer-count">${fmt(data.categoryCounts[c.slug] || 0)} products</span>
      </a>
    </li>`)}
  </ul>
</section>

${deals.length ? html`<section class="wrap section" aria-labelledby="deals-h">
  <div class="section-head"><h2 id="deals-h">More price drops</h2><a href="/deals/" class="more-link">See all price drops</a></div>
  ${productGrid(site, deals)}
</section>` : ''}

${newest.length ? html`<section class="wrap section" aria-labelledby="new-h">
  <h2 id="new-h">Just added</h2>
  ${productGrid(site, newest)}
</section>` : ''}

<section class="wrap section how" aria-labelledby="how-h">
  <h2 id="how-h">How ${site.name} works</h2>
  <ol class="steps">
    <li><h3>Find the product</h3><p>Search or browse by category. Every listing shows the current price and the retailer.</p></li>
    <li><h3>Compare the deal</h3><p>Filter by brand, price and stock. Price drops are marked so you can spot a real saving.</p></li>
    <li><h3>Buy from the retailer</h3><p>The button takes you to the retailer's own website. You pay them directly, at their price.</p></li>
  </ol>
</section>

${site.turnstileSiteKey ? html`<section class="wrap section" aria-labelledby="news-h">
  <div class="newsletter">
    <h2 id="news-h">Get the best price drops by email</h2>
    <p>One email a week with the biggest savings on tech. No spam. Unsubscribe any time.</p>
    <form data-newsletter>
      <label for="news-email">Email address</label>
      <input id="news-email" name="email" type="email" autocomplete="email" required maxlength="254">
      <label class="check"><input type="checkbox" name="consent" required> I agree to receive the weekly email. See the <a href="/privacy/">privacy policy</a>.</label>
      <div class="cf-turnstile" data-sitekey="${site.turnstileSiteKey}"></div>
      <button class="btn btn-quiet" type="submit">Sign up</button>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>` : ''}

${data.retailers.length ? html`<section class="wrap section" aria-labelledby="ret-h">
  <h2 id="ret-h">Retailers we compare</h2>
  <ul class="retailer-list">${data.retailers.map(r => html`<li><span>${r.name}</span><span class="count">${fmt(r.n)}</span></li>`)}</ul>
</section>` : ''}
`;
  return page(site, {
    title: site.homeTitle,
    description: site.homeDescription,
    path: '/',
    body,
    bodyClass: 'home',
    schema: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: absolute(site, '/') },
      { '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: absolute(site, '/'), logo: absolute(site, '/assets/logo.svg') }
    ]
  });
}
