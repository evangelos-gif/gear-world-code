// The three US fragrance shops of wave 3 (CJ: FragranceShop.com, Perfumania, Fragrance Outlet; lessons L171): one card
// per fragrance and size, women's and unisex scents on WGW (Beauty & Fragrances), men's on MGW (Grooming & Fragrances),
// never a tester, an unboxed bottle, a "type" oil or another copy of a famous scent, never a children's character set.
import { clean, CHARACTER, FRAGRANCE_COPY, TESTER, fragranceFor, fragranceSub } from './wave3-legacy.mjs';

// The card name with the maker in front when the feed leaves it out ("Stella Perfume - 1 oz." by Stella McCartney).
export function withBrand(name, brand) {
  const n = clean(name).replace(/\s+-\s+Default Title$/i, '');
  const b = clean(brand);
  if (!b || n.toLowerCase().includes(b.toLowerCase().split(' ')[0])) return n;
  return `${b} ${n}`;
}

// The page address often says who it is for ("/products/blue-by-blue-for-women-eau-de-toilette") when the name does not
// ("Montblanc Legend Perfume"): its words count too.
export function placeFragrance(name, category = '', brand = '', url = '') {
  const n = withBrand(name, brand);
  if (!n) return { reject: 'no name' };
  const t = `${n} | ${category}`;
  if (TESTER.test(t)) return { reject: 'tester, sample or unboxed bottle' };
  if (FRAGRANCE_COPY.test(n) || /perfume oil|roll-?on oil/i.test(n)) return { reject: 'a "type" oil or another copy of a famous scent' };
  if (CHARACTER.test(n)) return { reject: "children's character set" };
  if (/candle|diffuser|room spray|car freshener|hair mist|lotion only|gift card|bag\b|pouch|atomizer|refill bottle/i.test(n)) return { reject: 'not a fragrance the sites list' };
  const sub = fragranceSub(n);
  if (/^Beauty$/i.test(category)) {
    if (/serum|cream|moistur|cleanser|toner|mask|eye|repair|spf|sunscreen|lotion/i.test(n)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Skincare', name: n };
    if (/lipstick|mascara|foundation|concealer|eyeliner|powder|blush/i.test(n)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Make-up', name: n };
    return { reject: 'beauty product the site does not place' };
  }
  let path = '';
  try { path = new URL(url).pathname.replace(/[-_/]+/g, ' '); } catch { /* no link */ }
  if (fragranceFor(`${n} ${path}`, category) === 'men') return { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: sub === 'Bath & body' ? 'Deodorant' : sub, name: n };
  return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub, name: n };
}
