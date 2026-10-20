// robots.txt and sitemaps: every category and every active product is listed (lessons L10).
import { esc } from './lib/html.js';
import { productPath, categoryPath } from './lib/text.js';
import { infoPaths } from './pages/info.js';
import { promoRetailers } from './lib/promos.js';

export const SITEMAP_CHUNK = 10000;

export function robotsTxt(site) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /out/',
    'Disallow: /go/',
    'Disallow: /api/',
    'Disallow: /search',
    'Disallow: /compare/',
    'Disallow: /cart/',
    '',
    `Sitemap: https://${site.domain}/sitemap.xml`,
    ''
  ].join('\n');
}

export function sitemapIndex(site, totalProducts) {
  const chunks = Math.max(0, Math.ceil(totalProducts / SITEMAP_CHUNK));
  const items = [`https://${site.domain}/sitemap-static.xml`];
  for (let i = 1; i <= chunks; i++) items.push(`https://${site.domain}/sitemap-products-${i}.xml`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items
    .map(u => `<sitemap><loc>${esc(u)}</loc></sitemap>`)
    .join('\n')}\n</sitemapindex>\n`;
}

// counts: { slug: number of products }. A category with no products yet is "noindex", so it is left out
// until it has products (Search Console reports sitemap pages that say noindex).
export function sitemapStatic(site, counts = null) {
  const cats = site.categories.filter(c => !counts || Number(counts[c.slug]) > 0);
  const offers = promoRetailers(site);
  const paths = ['/', '/deals/', ...cats.map(c => categoryPath(c.slug)), ...infoPaths(),
    ...(offers.length ? ['/discount-codes/', ...offers.map(r => `/discount-codes/${r.slug}/`)] : [])];
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
