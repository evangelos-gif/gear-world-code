// Import rules for Joybuy UK (Awin advertiser 123932) on the older Gear World sites.
// First use: Women's Gear World "Beauty & Fragrances" (167 products on 21 Oct 2026, about 1,800 more in the feed).
//
// Joybuy UK is ALREADY on WGW (about 1,600 products: clothing, watches, bags ... written by the Hub import router,
// retailer name 'Joybuy UK', awin_product_id '123932:<merchant_product_id>'). So:
//   - the product key is the feed's merchant_product_id, the same id the router used: a product already on the
//     site is UPDATED, never added twice;
//   - the plan is ADD-ONLY (addOnly): it covers only beauty, so the other Joybuy products on the site are not
//     "gone from the feed" and must stay as they are (legacy-import.ps1 hides nothing for an add-only plan);
//   - the link keeps the query part of the shop address, like the products already on the site.
// Feed facts (gw-feed-gaps report, 21 Oct 2026): 28,990 rows, one row per product, prices in GBP, Google-style
// categories ("Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne"). Joybuy also files perfumes under
// "Home & Garden > Decor > Candles & Home Fragrances > Fragrance Oils", so a perfume NAME counts too.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
export const RULES = {
  key: 'joybuy',
  advertiserId: 123932,
  retailer: 'Joybuy UK',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?joybuy\.co\.uk\//i,
  sites: ['wgw'],
  maxPrice: 2000,
  addOnly: true,
  keepQuery: true
};

// The router's id for a Joybuy product: merchant_product_id (the number at the end of the shop address).
export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');

// Joybuy writes both 'Hair Care' and 'Haircare'.
const BEAUTY_CATEGORY = /^Health & Beauty > Personal Care > (Cosmetics|Hair ?care)\b/i;
const DEODORANT_CATEGORY = /^Health & Beauty > Personal Care > Deodorant/i;
const SHAVING_CATEGORY = /^Health & Beauty > Personal Care > Shaving & Grooming/i;
const FRAGRANCE_NAME = words(['eau de parfum', 'eau de toilette', 'eau de cologne', 'edp', 'edt', 'parfum', 'perfume', 'perfumes', 'extrait', 'body mist', 'fragrance mist', 'hair mist']);
// Perfume words that are not something you wear.
const HOME_SCENT = words(['candle', 'candles', 'diffuser', 'diffusers', 'reed', 'reeds', 'room spray', 'home fragrance', 'wax melt', 'wax melts', 'air freshener',
  'car freshener', 'incense', 'oil burner', 'laundry', 'detergent', 'fabric softener', 'washing']);
const MEN = words(['men', "men's", 'mens', 'man', 'male', 'for him', 'pour homme', 'homme', 'gents', 'gentleman', 'gentlemen', 'aftershave', 'after shave',
  'beard', 'shaving', 'shave', 'boyfriend']);
// Well-known men's perfume lines that often have no "men" in the name.
const MEN_LINES = words(['sauvage', 'bleu de chanel', 'aventus', 'acqua di gio', 'acqua di giò', 'eros', 'invictus', '1 million', 'one million', 'le male', 'boss bottled',
  'terre d\'hermes', 'terre d’hermès', 'stronger with you', 'spicebomb', 'the one for men', 'dylan blue', 'phantom', 'wanted', 'fahrenheit', 'allure homme', 'ultra male',
  'polo blue', 'polo red', 'y eau de parfum', 'l\'homme', 'pour lui', 'bad boy', 'luna rossa', 'aqva', 'cool water man']);
const WOMEN = words(['women', "women's", 'womens', 'woman', 'ladies', 'lady', 'female', 'for her', 'pour femme', 'femme', 'girl']);
const UNISEX = words(['unisex']);
const KIDS = words(['baby', 'babies', 'infant', 'infants', 'toddler', 'toddlers', 'kids', 'kid', "kid's", 'children', "children's", 'child', 'childs', 'junior', 'newborn', 'nappy']);
const NOT_BEAUTY = words(['toothpaste', 'toothbrush', 'toothbrushes', 'mouthwash', 'floss', 'dental', 'denture', 'dentures', 'condom', 'condoms', 'lubricant', 'pregnancy',
  'ovulation', 'tampon', 'tampons', 'sanitary', 'incontinence', 'supplement', 'supplements', 'multivitamin', 'multivitamins', 'gummies', 'medicine', 'plaster', 'plasters',
  'bandage', 'bandages', 'thermometer', 'hearing aid', 'contact lens', 'contact lenses', 'pet', 'pets', 'dog', 'dogs', 'puppy', 'toy', 'toys', 'doll', 'dolls', 'lice', 'nits',
  'tattoo machine', 'gift card', 'voucher']);
// Names in Chinese, Japanese or Korean script: the site is in English.
const CJK = /[぀-ヿ㐀-鿿가-힯]/;

const SUBS = [
  [c => /Perfume & Cologne/i.test(c), n => FRAGRANCE_NAME.test(n), 'Fragrance'],
  [c => /Cosmetic Sets|Gift Sets/i.test(c), n => words(['gift set', 'gift sets', 'beauty set', 'advent calendar']).test(n), 'Gift sets'],
  [c => /Nail Care|Nail Polish/i.test(c), n => words(['nail polish', 'nail varnish', 'gel polish', 'nail lacquer', 'nail art']).test(n), 'Nails'],
  [c => /Cosmetic Tools|Makeup Tools|Make-Up Tools/i.test(c), n => words(['makeup brush', 'make-up brush', 'brush set', 'beauty blender', 'makeup sponge', 'eyelash curler', 'tweezers', 'makeup mirror']).test(n), 'Beauty tools'],
  [c => /Make-?Up/i.test(c), n => words(['lipstick', 'lip gloss', 'lip liner', 'mascara', 'foundation', 'concealer', 'eyeliner', 'eyeshadow', 'eye shadow', 'blusher', 'bronzer', 'highlighter', 'primer', 'setting spray', 'brow', 'eyebrow']).test(n), 'Make-up'],
  [c => /Hair Styling Tools/i.test(c), n => words(['hair dryer', 'hairdryer', 'straightener', 'straighteners', 'curler', 'curling wand', 'curling tong', 'hair styler', 'airwrap', 'hot brush']).test(n), 'Hair tools'],
  [c => /Hair ?care/i.test(c), n => words(['shampoo', 'conditioner', 'hair mask', 'hair oil', 'hair serum', 'dry shampoo']).test(n), 'Hair care'],
  [c => /Skin Care/i.test(c), n => words(['serum', 'moisturiser', 'moisturizer', 'cleanser', 'face cream', 'night cream', 'eye cream', 'face mask', 'toner', 'sunscreen', 'spf', 'retinol']).test(n), 'Skincare'],
  [c => /Bath & Body|Deodorant/i.test(c), n => words(['body lotion', 'body butter', 'body wash', 'shower gel', 'bath oil', 'body oil', 'body scrub', 'hand cream', 'deodorant']).test(n), 'Bath & body']
];

function subcategoryOf(name, feedCategory) {
  for (const [byCat, byName, sub] of SUBS) if (byCat(feedCategory)) return sub;
  for (const [, byName, sub] of SUBS) if (byName(name)) return sub;
  return 'Beauty';
}

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  const c = String(feedCategory || '');
  if (CJK.test(n)) return { reject: 'name not in English' };
  const fragranceName = FRAGRANCE_NAME.test(n) && !HOME_SCENT.test(n);
  const beautyCategory = BEAUTY_CATEGORY.test(c) || DEODORANT_CATEGORY.test(c) || SHAVING_CATEGORY.test(c);
  if (!beautyCategory && !fragranceName) return { reject: 'not beauty or fragrance (this plan is for Beauty & Fragrances only)' };
  if (HOME_SCENT.test(n)) return { reject: 'home scent (candles, diffusers), not beauty' };
  if (KIDS.test(n)) return { reject: "baby or children's product" };
  if (NOT_BEAUTY.test(n)) return { reject: 'health, dental or other personal care, not beauty' };
  const women = WOMEN.test(n), unisex = UNISEX.test(n);
  const men = MEN.test(n) || MEN_LINES.test(n) || /Men's|Mens\b/i.test(c);
  if (men && !women && !unisex) return { reject: "men's product (for Men's Gear World later)" };
  if (SHAVING_CATEGORY.test(c) && !women) return { reject: "shaving and grooming without 'women' in the name (Men's Gear World later)" };
  if (DEODORANT_CATEGORY.test(c) && !women && !unisex) return { reject: "deodorant without 'women' in the name" };
  if (/Hair ?care > (Hair Clippers|Shaving)/i.test(c)) return { reject: "clippers and shaving (Men's Gear World later)" };
  return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: subcategoryOf(n, c) };
}
