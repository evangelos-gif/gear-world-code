// Import rules for 100% PURE Germany (Awin advertiser 13991, "100percentpure DE/AT") on Women's Gear World "Beauty &
// Fragrances" (25 Oct 2026, lessons L63). New on every site. The shop is 100percentpure.de: natural make-up, skin, hair and
// body care, prices in EUROS. Names are English with the German product type after " - " ("Coffee Bean Caffeine Brightening
// Eye Cream 30 ml - Augencreme"): the card leaves the German part out. Two feeds (93600, 98144) list the same 366 products,
// one with the shop's categories ("Foundation", "Tagespflege", "Peelings & Masken" ...) and one without: one card per
// product page, and the category is taken from the feed that has it.
// The shop delivers to Germany and most of Europe, not to the UK (100percentpure.de/Versand-Lieferung, read 25 Oct 2026):
// every card says so (deliversTo in sites/wgw/site.config.js, lessons L62). Gift cards are not products to compare.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
// The database name of the shop has no "%": the import tools hand the name to wrangler through a .cmd file, where "%" is a
// special sign (first dry run, 25 Oct 2026: "Μη αναμενόμενο όνομα καταστήματος"). The site shows "100% PURE" through
// retailerNames in sites/wgw/site.config.js.
export const RULES = {
  key: '100percentpure',
  advertiserId: 13991,
  retailer: '100 Percent Pure',
  currency: 'EUR',
  shop: /^https:\/\/(www\.)?100percentpure\.de\//i,
  sites: ['wgw'],
  maxPrice: 300,
  keepQuery: true
};

// The product page's own name ("Coffee-Bean-Caffeine-Brightening-Eye-Cream-30-ml-Augencreme"): the same in both feeds,
// one per colour or size, and readable in the database.
export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9._-]{2,180}$/.test(path)) return path;
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

// German product types the shop puts between " - " (feeds of 25 Oct 2026). They are taken off wherever they are: at the
// end ("... Eye Cream 30 ml - Augencreme"), in the middle ("... Tinted Moisturizer - Getönte Tagespflege - Creme" keeps its
// shade "Creme"), and as the last word of an English part ("Hair Detangler - Leave-In Haarpflege"). Other German compounds
// of the same kinds (Gesichts..., Augen..., Haar..., Körper..., Lippen..., Feuchtigkeits..., Reinigungs...) too. Only these
// words are taken off, so an English part such as "Hydrating Hand Wash - Tea Tree" stays. The shop's notes "Diese Größe ist
// ein Auslaufartikel" or just "Auslaufartikel" (being discontinued) and "PRE LAUNCH" are not part of the name.
// Live check of 25 Oct 2026 (lessons L64): "Powder Puff - Puderquaste", "Nail & Cuticle Oil - Nagelöl", "Matcha Oat Milk
// Nourishing Mask - Pulvermaske - Auslaufartikel", "Organic Marula Oil - Auslaufartikel" were on the site with the German.
const GERMAN_TYPES = ['Augencreme', 'Augenpflege', 'Augenpads', 'Lippenstift', 'Lidschatten', 'Rouge', 'Gesichtsmaske', 'Gesichtsreinigung',
  'Gesichtswasser', 'Gesichtsöl', 'Gesichtspflege', 'Gesichtsserum', 'Gesichtsspray', 'Feuchtigkeitsserum', 'Feuchtigkeitspflege',
  'Reinigungspeeling', 'Reinigungspad', 'Wimperntusche', 'Handcreme', 'Fußcreme', 'Körperlotion', 'Körperbutter', 'Körperpeeling', 'Nachtpflege',
  'Tagespflege', 'Haarserum', 'Haarkur', 'Haarmaske', 'Haarpflege', 'Lippenpflege', 'Badesalz', 'Duschgel', 'Make-?Up Palette', 'Puderquaste',
  'Pulvermaske', 'Nagelöl', 'Nagelpflege', 'Puder', 'Gutschein'];
const TYPE = `(?:Getönte\\s+)?(?:${GERMAN_TYPES.join('|')})`;
const TYPE_PART = new RegExp(`^${TYPE}$`, 'i');
const TYPE_END = new RegExp(`\\s+${TYPE}$`, 'i');
const COMPOUND = /^(?:Gesichts|Augen|Haar|Körper|Lippen|Feuchtigkeits|Reinigungs|Nagel|Puder|Pulver)\p{Ll}{3,}$/u;
const NOTE = /^(?:(?:Diese Größe ist ein )?Auslaufartikel|pre[- ]?launch)$/i;
const PRE_LAUNCH = /\bpre[- ]?launch\b/i;
// A whole German name (dry run of 25 Oct 2026: "Kosmetikspatel Set").
const ENGLISH = [[/\bKosmetikspatel\b/gi, 'Cosmetic Spatula']];
export function displayName(name) {
  const parts = String(name || '').split(/\s+-\s+/);
  const out = [parts[0].trim()];
  for (const raw of parts.slice(1)) {
    let p = raw.trim();
    if (!p || NOTE.test(p) || TYPE_PART.test(p) || COMPOUND.test(p)) continue;
    p = p.replace(TYPE_END, '');
    const tokens = p.split(/\s+/);
    if (tokens.length > 1 && COMPOUND.test(tokens[tokens.length - 1])) p = tokens.slice(0, -1).join(' ');
    if (p) out.push(p);
  }
  let n = out.filter(Boolean).join(' - ');
  for (const [re, en] of ENGLISH) n = n.replace(re, en);
  return n.replace(/\s{2,}/g, ' ').trim();
}

// The brand as the site shows it: the feed writes "100% PURE® - Purity Cosmetics Inc." (the company after the brand).
export function displayBrand(brand) {
  const b = String(brand || '').trim();
  return /^100\s*%\s*pure\b/i.test(b) ? '100% PURE' : b;
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const NOT_PRODUCT = words(['gift card', 'gutschein', 'voucher', 'e-gift']);
// The first list that matches the name decides (then the shop's category, then Awin's): WGW's own subcategory names.
const BY_NAME = [
  ['Beauty tools', words(['cleansing pad', 'face pad', 'reinigungspad', 'brush', 'sponge', 'applicator', 'sharpener', 'spatula', 'powder puff', 'puderquaste'])],
  ['Hair care', words(['shampoo', 'conditioner', 'hair serum', 'hair mask', 'hair oil', 'hair spray', 'dry shampoo', 'scalp', 'haarserum', 'haarkur',
    'detangler', 'leave-in'])],
  ['Make-up', words(['foundation', 'concealer', 'lipstick', 'lippenstift', 'lip glaze', 'lip caramel', 'lip liner', 'lip gloss', 'lip & cheek', 'cheek tint',
    'eye shadow', 'eyeshadow', 'lidschatten', 'mascara', 'wimperntusche', 'eyeliner', 'eye liner', 'brow', 'blush', 'rouge', 'bronzer', 'highlighter',
    'luminizer', 'primer', 'powder', 'puder', 'palette', 'tinted moisturizer', 'bb cream', 'cc cream', '2nd skin'])],
  ['Bath & body', words(['shower gel', 'duschgel', 'body wash', 'body cream', 'body butter', 'body lotion', 'body scrub', 'body oil', 'body mist',
    'hand cream', 'hand buttercream', 'handcreme', 'hand wash', 'bath', 'badesalz', 'soap', 'deodorant', 'foot cream'])],
  ['Fragrance', words(['perfume', 'eau de parfum', 'eau de toilette', 'fragrance', 'parfum'])],
  ['Skincare', words(['serum', 'cream', 'creme', 'moisturizer', 'moisturiser', 'cleanser', 'cleansing', 'toner', 'astringent', 'mask', 'maske', 'peel',
    'scrub', 'exfoliat', 'facial oil', 'face oil', 'gesichtsöl', 'eye gel', 'spot remover', 'treatment', 'lip balm', 'lippenpflege', 'sunscreen', 'spf', 'oil'])]
];
const BY_CATEGORY = [
  ['Make-up', /foundation|concealer|lipstick|lip |lippen|eye ?shadow|lidschatten|mascara|eyeliner|augenbrauen|rouge|bronzer|highlighter|primer|puder|paletten|tints|2nd skin|getönte/i],
  ['Hair care', /shampoo|conditioner|haar|hair|spezialpflege/i],
  ['Bath & body', /body|dusch|badesalz|hände|hand|coconut|lavender|vanilla|blood orange|honey almond|eucalyptus|grapefruit|mangosteen/i],
  ['Skincare', /tagespflege|nachtpflege|peeling|masken|gesichts|serum|augenpflege|treatments|lippenpflege/i],
  ['Beauty tools', /beauty tools/i],
  ['Fragrance', /fragrance|duft|parfum/i]
];

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '', awinCategory = '' }) {
  const n = displayName(name);
  if (NOT_PRODUCT.test(name) || /gutschein|gift card/i.test(feedCategory)) return { reject: 'gift card, not a product' };
  // "Watermelon Cucumber Intense Water Locking Mist - Gesichtsspray - PRE LAUNCH": not on sale yet (owner: nothing that
  // cannot be bought today).
  if (PRE_LAUNCH.test(name)) return { reject: 'pre-launch, not on sale yet' };
  for (const [sub, re] of BY_NAME) if (re.test(n)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub };
  for (const [sub, re] of BY_CATEGORY) if (re.test(feedCategory)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub, doubt: true };
  const awin = String(awinCategory || '');
  if (/fragrance/i.test(awin)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Fragrance', doubt: true };
  if (/haircare/i.test(awin)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Hair care', doubt: true };
  if (/skincare/i.test(awin)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Skincare', doubt: true };
  if (/cosmetics/i.test(awin)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Make-up', doubt: true };
  return { reject: 'not sure what it is (no beauty word in the name or the category)' };
}
