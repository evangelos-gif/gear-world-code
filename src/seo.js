// robots.txt and sitemaps: every category and every active product is listed (lessons L10).
import { esc } from './lib/html.js';
import { productPath, categoryPath } from './lib/text.js';
import { infoPaths } from './pages/info.js';
import { promoRetailers } from './lib/promos.js';
import { MIN_INDEXED_PRODUCTS } from './pages/listing.js';

export const SITEMAP_CHUNK = 10000;

// Crawlers that are kept out of the whole site (lessons L105): SERankingBacklinksBot opened about 1,000 product pages an
// hour on cargearworld.com (6-8 Nov 2026) and brings no visitors. Everything below them stays as it was.
export const BLOCKED_CRAWLERS = ['SERankingBacklinksBot'];

export function robotsTxt(site) {
  return [
    ...BLOCKED_CRAWLERS.flatMap(bot => [`User-agent: ${bot}`, 'Disallow: /', '']),
    'User-agent: *',
    'Allow: /',
    'Disallow: /out/',
    'Disallow: /go/',
    'Disallow: /api/',
    'Disallow: /search',
    'Disallow: /compare/',
    'Disallow: /cart/',
    'Disallow: /saved/',
    '',
    `Sitemap: https://${site.domain}/sitemap.xml`,
    ''
  ].join('\n');
}

// chunks: how many product sitemaps (id ranges of SITEMAP_CHUNK ids, src/db.js sitemapChunk). One may be empty.
export function sitemapIndex(site, chunks) {
  const items = [`https://${site.domain}/sitemap-static.xml`];
  for (let i = 1; i <= chunks; i++) items.push(`https://${site.domain}/sitemap-products-${i}.xml`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items
    .map(u => `<sitemap><loc>${esc(u)}</loc></sitemap>`)
    .join('\n')}\n</sitemapindex>\n`;
}

// counts: { slug: number of products } in the UK view. A category with fewer than MIN_INDEXED_PRODUCTS (20) products
// is "noindex" (a thin page, lessons L107; before: only an empty one), so it is left out until it has them (Search
// Console reports sitemap pages that say noindex).
// guides: the guides that have at least 3 products in the UK view (listedGuides); all of them when not given.
export function sitemapStatic(site, counts = null, guides = site.guides) {
  const cats = site.categories.filter(c => !counts || Number(counts[c.slug]) >= MIN_INDEXED_PRODUCTS);
  const offers = promoRetailers(site);
  // A subcategory page marked `index: true` (TGW Mini PCs, lessons L97) is listed after its category.
  const subs = cats.flatMap(c => (Array.isArray(c.subcategories) ? c.subcategories : []).filter(s => s.index).map(s => `${categoryPath(c.slug)}?sub=${s.slug}`));
  const paths = ['/', '/deals/', ...cats.map(c => categoryPath(c.slug)), ...subs, ...infoPaths(),
    ...(offers.length ? ['/discount-codes/', ...offers.map(r => `/discount-codes/${r.slug}/`)] : []),
    ...(guides && guides.length ? ['/guides/', ...guides.map(g => `/guides/${g.slug}/`)] : [])];
  return urlset(paths.map(p => ({ loc: `https://${site.domain}${p}` })));
}

export function sitemapProducts(site, rows) {
  return urlset(rows.map(r => ({
    loc: `https://${site.domain}${productPath(r)}`,
    lastmod: String(r.updated_at || '').slice(0, 10)
  })));
}

function urlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map(e => `<url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod)}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>\n`;
}
