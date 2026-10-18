import { html, raw } from '../lib/html.js';
import { categoryPath, formatDate } from '../lib/text.js';
import { page, productGrid, searchForm, icon, absolute, asset, categoryImage } from './layout.js';

export function homePage(site, data) {
  const fmt = n => new Intl.NumberFormat(site.locale).format(n);
  // Each product appears once on the page (L03): price drops first, then new products not already shown.
  const deals = data.deals.slice(0, 8);
  const newest = data.newest.filter(p => !deals.some(d => d.id === p.id)).slice(0, 8);
  const hero = site.heroImage;
  const retailerCount = data.retailers.length;
  const body = html`
<section class="hero${hero ? ' hero-photo' : ''}">
  ${hero ? html`<img class="hero-img" src="${asset(site, hero.src)}" srcset="${asset(site, hero.small)} 960w, ${asset(site, hero.src)} ${hero.width}w" sizes="100vw" width="${hero.width}" height="${hero.height}" alt="" fetchpriority="high" decoding="async">` : ''}
  <div class="wrap hero-inner">
    ${site.heroEyebrow ? html`<p class="eyebrow">${site.heroEyebrow}</p>` : ''}
    <h1>${site.heroTitle}</h1>
    <p class="lede">${site.heroText}</p>
    ${searchForm(site, '', 'hero-search')}
    <p class="hero-actions">
      <a class="btn btn-gold" href="#cats-h">Shop by category</a>
      ${deals.length ? html`<a class="btn btn-outline" href="/deals/">Today's price drops</a>` : ''}
    </p>
    ${data.lastUpdated ? html`<p class="hero-facts">Prices last updated ${formatDate(data.lastUpdated, site.locale)}.</p>` : ''}
  </div>
</section>

<section class="stats" aria-label="${site.name} in numbers">
  <ul class="stats-list">
    <li><strong>${fmt(data.totalProducts)}</strong> products</li>
    <li><strong>${fmt(retailerCount)}</strong> ${retailerCount === 1 ? 'retailer partner' : 'retailer partners'}</li>
    <li><strong>${fmt(site.categories.length)}</strong> main categories</li>
    <li>Independent comparison</li>
  </ul>
</section>

<section class="wrap section" aria-labelledby="cats-h">
  <h2 id="cats-h">Shop by category</h2>
  <ul class="cat-grid">
    ${site.categories.map(c => {
      const img = categoryImage(site, c.slug);
      return html`<li>
      <a class="cat-tile" href="${categoryPath(c.slug)}">
        ${img ? html`<img src="${img}" alt="" width="720" height="480" loading="lazy" decoding="async">` : icon(c.icon, 'cat-icon')}
        <span class="cat-text">
          <span class="cat-name">${c.name}</span>
          <span class="cat-count">${fmt(data.categoryCounts[c.slug] || 0)} products</span>
        </span>
        ${icon('chevron', 'cat-chevron')}
      </a>
    </li>`;
    })}
    ${deals.length && hero ? html`<li>
      <a class="cat-tile cat-tile-deals" href="/deals/">
        <img src="${asset(site, hero.small)}" alt="" width="720" height="480" loading="lazy" decoding="async">
        <span class="cat-text">
          <span class="cat-name">Today's price drops</span>
          <span class="cat-count">Biggest savings first</span>
        </span>
        ${icon('chevron', 'cat-chevron')}
      </a>
    </li>` : ''}
  </ul>
</section>

${deals.length ? html`<section class="wrap section" aria-labelledby="deals-h">
  <div class="section-head"><h2 id="deals-h">Today's price drops</h2><a href="/deals/" class="more-link">See all price drops</a></div>
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
