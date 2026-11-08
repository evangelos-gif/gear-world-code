// Import rules for Cottsbury (Awin advertiser 71217, feed 91947): GOTS organic cotton bedding and towels on Home Gear
// World "Bedding & Bath", women's clothing on Women's Gear World and men's on Men's Gear World (owner, 8 Nov 2026: "check
// email and download new feeds and import with one go"). New on every site. Feed facts (feed-profile 8 Nov 2026): 468
// products, all in stock, GBP 10 to 290, shop cottsbury.com, no category, brand "Cottsbury Ltd". The shop sells bedding
// (sets, duvet covers, pillowcases, sheets, throws), bath (towels, bath mats) and clothing for women (t-shirts, hoodies,
// sports bras, tanks, leggings, joggers, shorts) and men (hoodies, sweatshirts, joggers, shorts, t-shirts) (shop page,
// 8 Nov 2026). A garment counts as men's when the name or the product address says men's; women-only pieces and the rest
// go to Women's Gear World, where most of the range is.
import { homePlace } from './lib/hgw-home.mjs';

export const RULES = {
  key: 'cottsbury',
  advertiserId: 71217,
  retailer: 'Cottsbury',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?cottsbury\.com\//i,
  sites: ['hgw', 'wgw', 'mgw'],
  maxPrice: 600,
  keepQuery: true
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._-]{2,180}$/.test(path)) return path;
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

export function displayBrand() {
  return 'Cottsbury';
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const HOME = words(['duvet', 'duvets', 'pillow', 'pillows', 'pillowcases?', 'sheets?', 'bedding', 'bed linen', 'throws?', 'blankets?', 'towels?',
  'bath mats?', 'bath sheets?', 'bath sets?', 'hand towels?', 'face cloths?', 'quilts?', 'bedspreads?', 'cushions?']);
const MEN = words(["men'?s", 'mens', 'male', 'for men']);
const MEN_URL = /(^|[/_-])mens?([/_-]|$)/i;
const WOMEN = words(["women'?s", 'womens', 'ladies', 'for women']);
const CLOTHES = [
  ['Sports Bras & Tops', words(['sports bras?', 'bras?', 'bralettes?'])],
  ['Leggings', words(['leggings'])],
  ['Hoodies', words(['hoodies?', 'hoody', 'hooded'])],
  ['Sweatshirts', words(['sweatshirts?', 'sweaters?', 'crew ?necks?', 'jumpers?'])],
  ['Shorts', words(['shorts'])],
  ['Trousers', words(['joggers?', 'pants', 'trousers', 'sweatpants', 'track ?pants'])],
  ['T-Shirts', words(['t-?shirts?', 'tees?'])],
  ['Tops & Blouses', words(['tops?', 'tanks?', 'tank tops?', 'camisoles?', 'camis?', 'vests?', 'long sleeve'])]
];
const WOMEN_ONLY = words(['sports bras?', 'bras?', 'bralettes?', 'leggings', 'camisoles?', 'camis?', 'cropped', 'crop', 'boxy']);

export function classify({ name, url = '' }) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  if (!n) return { reject: 'no name' };
  if (/gift card|gift voucher|e-?gift|gift wrap/i.test(n)) return { reject: 'gift card, not a product' };
  if (HOME.test(n)) {
    const h = homePlace(n);
    if (h && (h.siteCategory === 'Bedding & Bath' || h.siteCategory === 'Home Decor')) return { site: 'hgw', ...h };
    return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Bed Linen' };
  }
  let sub = '';
  for (const [label, re] of CLOTHES) if (re.test(n)) { sub = label; break; }
  if (!sub) return { reject: 'not bedding, bath or clothing' };
  let path = '';
  try { path = new URL(url).pathname; } catch { path = ''; }
  const men = !WOMEN_ONLY.test(n) && !WOMEN.test(n) && (MEN.test(n) || MEN_URL.test(path));
  if (men) {
    const mSub = sub === 'Tops & Blouses' ? 'T-Shirts' : sub;
    if (mSub === 'Sports Bras & Tops' || mSub === 'Leggings') return { reject: "women's item named men's" };
    return { site: 'mgw', siteCategory: 'Clothing', subcategory: mSub };
  }
  return { site: 'wgw', siteCategory: 'Clothing', subcategory: sub };
}
