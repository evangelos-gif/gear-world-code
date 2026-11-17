// Import rules for Amore Mall (CJ Affiliate advertiser 7468134, global.amoremall.com, Amorepacific's global shop, US
// dollars) on Women's Gear World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026:
// 1,550 rows, 1,276 pages, no categories: Korean make-up and skin care (TONEWORK, HERA, ETUDE, innisfree, Sulwhasoo,
// IOPE ...), hair care, and OSULLOC teas (left out). One foundation has a page for each shade (TONEWORK alone 820): one
// card per product line (the first five words of the name), named by the words its shades share. At most
// RULES.maxPerSubcategory cards per subcategory (lessons L164). Shown only to the US (dollar prices).
import { sameNameKey } from '../legacy-import-plan.mjs';
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'amoremall-us',
  network: 'cj',
  advertiserId: 7468134,
  retailer: 'Amore Mall',
  currency: 'USD',
  shop: /^https:\/\/global\.amoremall\.com\//i,
  sites: ['wgw'],
  maxPrice: 300,
  minPrice: 5,
  maxPerSubcategory: 200,
  commonVariantName: true
};

export function productKey(get) {
  const words = clean(get('product_name')).split(/\s+/).slice(0, 5).join(' ');
  const k = sameNameKey(words);
  return k.length >= 6 ? `line-${k}` : '';
}

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/osulloc|\btea\b|teas\b|tumbler|snack|gift ?card|pouch\b|sample|tester/i.test(n)) return { reject: 'tea, food or another product (not beauty)' };
  const b = sub => ({ site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub, name: n });
  if (/shampoo|conditioner|hair|scalp|treatment for hair/i.test(n)) return b('Hair care');
  if (/foundation|cushion|tint|lip|rouge|brow|eye(?!\s*cream)|mascara|liner|blush|concealer|powder|primer|palette|make-?up base|bb\b|cc\b/i.test(n)) return b('Make-up');
  if (/body|hand cream|shower|bath|soap/i.test(n)) return b('Bath & body');
  if (/serum|toner|cream|essence|ampoule|mask|cleans|foam|lotion|emulsion|sun|spf|uv|moist|gel|balm|oil|mist|skin|peel|pad/i.test(n)) return b('Skincare');
  return { reject: 'not make-up or skin care' };
}
