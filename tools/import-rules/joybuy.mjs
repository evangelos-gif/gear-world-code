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
  'polo blue', 'polo red', 'y eau de parfum', 'l\'homme', 'pour lui', 'bad boy', 'luna rossa', 'aqva', 'cool water man', 'toy boy']);
const WOMEN = words(['women', "women's", 'womens', 'woman', 'ladies', 'lady', 'female', 'for her', 'pour femme', 'femme', 'girl']);
const UNISEX = words(['unisex']);
const KIDS = words(['baby', 'babies', 'infant', 'infants', 'toddler', 'toddlers', 'kids', 'kid', "kid's", 'children', "children's", 'child', 'childs', 'junior', 'newborn', 'nappy']);
const NOT_BEAUTY = words(['toothpaste', 'toothbrush', 'toothbrushes', 'mouthwash', 'floss', 'dental', 'denture', 'dentures', 'condom', 'condoms', 'lubricant', 'pregnancy',
  'ovulation', 'tampon', 'tampons', 'sanitary', 'incontinence', 'supplement', 'supplements', 'multivitamin', 'multivitamins', 'gummies', 'medicine', 'plaster', 'plasters',
  'bandage', 'bandages', 'thermometer', 'hearing aid', 'contact lens', 'contact lenses', 'pet', 'pets', 'dog', 'dogs', 'puppy', 'toy', 'toys', 'doll', 'dolls', 'lice', 'nits',
  'tattoo machine', 'gift card', 'voucher', 'otoscope', 'ear wax', 'ear cleaner', 'ear camera']);
// Names in Chinese, Japanese or Korean script: the site is in English.
const CJK = /[぀-ヿ㐀-鿿가-힯]/;

// Subcategory from the NAME first (Joybuy files many creams and serums under "Make-Up"), then from the feed category.
// Order matters: "tinted moisturiser" is make-up, "hair mask" is hair care, "brush set" is a beauty tool.
const NAME_SUBS = [
  [FRAGRANCE_NAME, 'Fragrance'],
  [words(['gift set', 'gift sets', 'beauty set', 'advent calendar', 'gift box']), 'Gift sets'],
  [words(['hair dryer', 'hairdryer', 'straightener', 'straighteners', 'curler', 'curlers', 'curling wand', 'curling tong', 'curling tongs', 'hair styler',
    'multi-styler', 'airwrap', 'hot brush', 'hot air brush', 'crimper', 'waver']), 'Hair tools'],
  [words(['shampoo', 'conditioner', 'hair mask', 'hair oil', 'hair serum', 'dry shampoo', 'hair spray', 'hairspray', 'mousse', 'hair colour', 'hair color',
    'hair dye', 'root touch', 'heat protect', 'heat protection', 'leave-in', 'leave in', 'scalp', 'hair gel', 'hair wax', 'curl cream', 'peroxide']), 'Hair care'],
  [words(['nail polish', 'nail varnish', 'gel polish', 'nail lacquer', 'nail art', 'nail file', 'top coat', 'base coat', 'cuticle', 'press-on nails',
    'false nails', 'nail', 'nails']), 'Nails'],
  [words(['epilator', 'epilators', 'ipl', 'razor', 'razors', 'dermaplaning', 'dermaplaner', 'hair removal', 'wax strips', 'bikini trimmer', 'lady shaver']), 'Hair removal'],
  [words(['makeup brush', 'make-up brush', 'makeup brushes', 'brush set', 'beauty blender', 'makeup sponge', 'eyelash curler', 'tweezers', 'makeup mirror',
    'vanity mirror', 'makeup bag', 'cosmetic bag']), 'Beauty tools'],
  [words(['lipstick', 'lip gloss', 'lip liner', 'lip stain', 'lip tint', 'lip oil', 'mascara', 'foundation', 'concealer', 'eyeliner', 'eyeshadow', 'eye shadow',
    'palette', 'blusher', 'blush', 'bronzer', 'highlighter', 'primer', 'setting spray', 'setting powder', 'pressed powder', 'loose powder', 'brow', 'eyebrow',
    'false lashes', 'eyelashes', 'lashes', 'bb cream', 'cc cream', 'tinted moisturiser', 'tinted moisturizer', 'contour', 'kohl', 'kajal', 'glitter']), 'Make-up'],
  [words(['serum', 'moisturiser', 'moisturizer', 'moisturising', 'moisturizing', 'cleanser', 'cleansing', 'face cream', 'night cream', 'day cream', 'eye cream',
    'face mask', 'sheet mask', 'mask', 'toner', 'essence', 'sunscreen', 'spf', 'retinol', 'hyaluronic', 'niacinamide', 'micellar', 'exfoliating', 'exfoliator',
    'exfoliant', 'peel', 'facial', 'face oil', 'dry oil', 'skin care', 'skincare', 'anti-ageing', 'anti-aging', 'wrinkle', 'acne', 'lip balm', 'face wash']), 'Skincare'],
  [words(['body lotion', 'body butter', 'body wash', 'shower gel', 'shower cream', 'bath', 'bath oil', 'body oil', 'body scrub', 'hand cream', 'hand wash', 'soap',
    'deodorant', 'anti-perspirant', 'antiperspirant', 'bubble bath', 'body cream']), 'Bath & body']
];
const CATEGORY_SUBS = [
  [/Perfume & Cologne/i, 'Fragrance'], [/Cosmetic Sets|Gift Sets/i, 'Gift sets'], [/Nail Care|Nail Polish/i, 'Nails'],
  [/Cosmetic Tools|Makeup Tools|Make-Up Tools/i, 'Beauty tools'], [/Hair Styling Tools/i, 'Hair tools'], [/Hair ?care/i, 'Hair care'],
  [/Skin Care/i, 'Skincare'], [/Bath & Body|Deodorant/i, 'Bath & body'], [/Shaving & Grooming|Hair Removal/i, 'Hair removal'], [/Make-?Up/i, 'Make-up']
];
// Words that make a name clearly beauty. A product placed only because of its feed category is listed for checking (L14).
const BEAUTY_WORDS = words(['beauty', 'cosmetic', 'cosmetics', 'makeup', 'make-up', 'skin', 'face', 'body', 'hair', 'lip', 'lips', 'eye', 'eyes', 'lash', 'cream',
  'oil', 'balm', 'gel', 'wash', 'lotion', 'scent', 'fragrance', 'spray', 'powder', 'wax', 'comb', 'brush', 'sponge', 'mirror', 'wig', 'wigs', 'extensions', 'perfume']);

function subcategoryOf(name, feedCategory) {
  for (const [re, sub] of NAME_SUBS) if (re.test(name)) return sub;
  for (const [re, sub] of CATEGORY_SUBS) if (re.test(feedCategory)) return sub;
  return 'Beauty';
}

// Women's hair removal often has no "women" in the name.
const WOMEN_GROOMING = words(['venus', 'silk-épil', 'silk-epil', 'silk epil', 'epilator', 'epilators', 'ipl', 'dermaplaning', 'dermaplaner', 'lady shaver',
  'ladyshave', 'bikini', 'satinelle', 'lumea']);
// Deodorant brands and lines for men.
const MEN_DEODORANT = words(['lynx', 'right guard', 'old spice', 'brut', 'axe', 'mitchum men']);

// Decide where one product goes. Returns { site, siteCategory, subcategory, doubt? } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  const c = String(feedCategory || '');
  if (CJK.test(n)) return { reject: 'name not in English' };
  const fragranceName = FRAGRANCE_NAME.test(n) && !HOME_SCENT.test(n);
  const beautyCategory = BEAUTY_CATEGORY.test(c) || DEODORANT_CATEGORY.test(c) || SHAVING_CATEGORY.test(c);
  if (!beautyCategory && !fragranceName) return { reject: 'not beauty or fragrance (this plan is for Beauty & Fragrances only)' };
  // A hair dryer "with diffuser" is not a home scent.
  if (HOME_SCENT.test(n) && !/\bhair\b/i.test(n) && !/Hair ?care/i.test(c)) return { reject: 'home scent (candles, diffusers), not beauty' };
  // Perfume names: "Cherry Baby" and "Moschino Toy 2" are perfumes for women, not baby products or toys.
  const kidsText = fragranceName ? n.replace(/\bbaby\b/gi, ' ') : n;
  if (KIDS.test(kidsText)) return { reject: "baby or children's product" };
  const healthText = fragranceName ? n.replace(/\btoy\b/gi, ' ') : n;
  if (NOT_BEAUTY.test(healthText)) return { reject: 'health, dental or other personal care, not beauty' };
  const women = WOMEN.test(n), unisex = UNISEX.test(n);
  const men = MEN.test(n) || MEN_LINES.test(n) || /Men's|Mens\b/i.test(c);
  if (men && !women && !unisex) return { reject: "men's product (for Men's Gear World later)" };
  if (SHAVING_CATEGORY.test(c) && !women && !WOMEN_GROOMING.test(n)) return { reject: "shaving and grooming without 'women' in the name (Men's Gear World later)" };
  if (DEODORANT_CATEGORY.test(c) && MEN_DEODORANT.test(n) && !women) return { reject: "men's deodorant (Men's Gear World later)" };
  if (/Hair ?care > (Hair Clippers|Shaving)/i.test(c)) return { reject: "clippers and shaving (Men's Gear World later)" };
  const subcategory = subcategoryOf(n, c);
  const clear = NAME_SUBS.some(([re]) => re.test(n)) || BEAUTY_WORDS.test(n);
  return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory, ...(clear ? {} : { doubt: true }) };
}
