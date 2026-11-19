// Westwing (Daisycon, Wave 3, chat 9, 16-17 Nov 2026): furniture, lighting, decor and textiles for Home Gear World, one
// Daisycon programme per country: NL 17294 (westwing.nl), DE 20705 (westwing.de), FR 20706 (westwing.fr), IT 20707
// (westwing.it), ES 20708 (westwing.es). Feed facts (download of 16-17 Nov 2026, profile of chat 9): 16,800-28,700
// products each, all in stock, all in euros, all with a shop page and a picture, newest change 16-17 Nov; the names are in
// the shop's language ("Loungefauteuil Steve van eikenhout", "Bank Stella (3-zits)"), the categories are the same English
// path in every country ("Sofas > Furniture", "Decor|Rugs > Home & Garden", "Lighting|Lighting Fixtures|Ceiling Light
// Fixtures", "Linens & Bedding|Bedding|Duvet Covers", "Beds & Accessories|Beds & Bed Frames"), 222 of them in NL.
// So the place on HGW is read from the English category path (the same words as the other HGW shops, lib/hgw-home.mjs),
// never from the name; the card keeps the shop's own name. Each country's shop is shown only where it delivers and where
// its language is spoken (site setting deliversTo + languages, lessons L165): Westwing NL -> NL, DE -> DE, FR -> FR,
// IT -> IT, ES -> ES. Not home products (jewellery, clothes, food, beauty, toys, gift cards) and anything not clearly placed
// stay out.
import { daisyconField, pageKey } from './daisycon-shop.mjs';
import { homePlace } from './hgw-home.mjs';

export const SHOPS = {
  nl: { advertiserId: 17294, domain: 'westwing.nl', country: 'NL', language: 'nl' },
  de: { advertiserId: 20705, domain: 'westwing.de', country: 'DE', language: 'de' },
  fr: { advertiserId: 20706, domain: 'westwing.fr', country: 'FR', language: 'fr' },
  it: { advertiserId: 20707, domain: 'westwing.it', country: 'IT', language: 'it' },
  es: { advertiserId: 20708, domain: 'westwing.es', country: 'ES', language: 'es' }
};

const words = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
// Folders of the path that are never a home product of HGW.
const NOT_HOME = words(['jewelry', 'jewellery', 'apparel', 'clothing', 'shoes', 'handbags?', 'wallets?', 'watches', 'food', 'beverages?',
  'food, beverages', 'health & beauty', 'health', 'beauty', 'cosmetics', 'personal care', 'toys?', 'games', 'baby & toddler', 'pet supplies',
  'animals', 'gift cards?', 'gift certificates?', 'software', 'media', 'books', 'electronics', 'vehicles', 'sporting goods', 'hardware',
  'tools', 'office supplies', 'arts & entertainment', 'party supplies', 'sex', 'religious', 'luggage', 'umbrellas?']);
// Words of the English path that HGW's own names do not use, turned into the HGW name (the first that matches wins).
const PATH_WORDS = [
  [words(['throw pillows?', 'decorative pillows?', 'cushion covers?']), 'Cushion'],
  [words(['ceiling light fixtures?', 'ceiling lights?', 'flush mount']), 'Ceiling Light'],
  [words(['pendant light fixtures?', 'pendant lights?']), 'Pendant Light'],
  [words(['wall light fixtures?', 'sconces?']), 'Wall Light'],
  [words(['floor lamps?']), 'Floor Lamp'],
  [words(['lamp shades?', 'lampshades?']), 'Lampshade'],
  [words(['light bulbs?']), 'Light Bulb'],
  [words(['sectional sofa units?', 'sofa beds?', 'sofas?', 'futons?']), 'Sofa'],
  [words(['bed sheets?', 'bedding sets?', 'bedspreads?', 'bed skirts?']), 'Bed Linen'],
  [words(['duvet covers?', 'comforters?', 'quilts?', 'duvets?']), 'Duvet'],
  [words(['pillowcases? & shams', 'pillowcases?', 'bed pillows?', 'pillows?']), 'Pillow'],
  [words(['bath towels?', 'towels?', 'washcloths?']), 'Towel'],
  [words(['bath mats?', 'bath rugs?']), 'Bath Mat'],
  [words(['window treatments?', 'curtains?', 'drapes?']), 'Curtain'],
  [words(['blinds? & shades', 'blinds?']), 'Blinds'],
  [words(['candles?', 'home fragrances?', 'diffusers?', 'incense']), 'Candles'],
  [words(['vases?']), 'Vase'],
  [words(['mirrors?']), 'Mirror'],
  [words(['clocks?']), 'Clock'],
  [words(['rugs?', 'carpets?']), 'Rug'],
  [words(['throws?', 'blankets?']), 'Throw'],
  [words(['artwork', 'posters?, prints?', 'posters?', 'prints?', 'paintings?', 'wall art']), 'Wall Art'],
  [words(['picture frames?', 'photo frames?']), 'Photo Frame'],
  [words(['seasonal & holiday decorations?', 'christmas', 'holiday ornaments?', 'advent']), 'Christmas'],
  [words(['artificial plants?', 'artificial flowers?', 'flower pots? & planters?', 'planters?', 'plant pots?']), 'Planter'],
  [words(['candle holders?', 'candlesticks?', 'lanterns?']), 'Candle Holder'],
  [words(['baskets?']), 'Basket'],
  [words(['storage boxes?', 'storage bins?', 'storage & organization', 'storage chests?', 'household storage']), 'Storage Box'],
  [words(['shelving', 'shelves', 'wall shelves?', 'bookcases?']), 'Shelving'],
  [words(['wardrobes?', 'armoires?']), 'Wardrobe'],
  [words(['chests? of drawers', 'dressers?']), 'Chest Of Drawers'],
  [words(['nightstands?', 'bedside tables?']), 'Bedside Table'],
  [words(['headboards? & footboards?', 'headboards?']), 'Headboard'],
  [words(['beds? & bed frames?', 'bed frames?', 'beds?']), 'Bed Frame'],
  [words(['mattresses?']), 'Mattress'],
  [words(['coffee tables?']), 'Coffee Table'],
  [words(['end tables?', 'side tables?', 'accent tables?']), 'Side Table'],
  [words(['console tables?', 'sofa tables?']), 'Console Table'],
  [words(['kitchen & dining room tables?', 'dining tables?', 'kitchen tables?']), 'Dining Table'],
  [words(['desks?']), 'Desk'],
  [words(['office chairs?']), 'Office Chair'],
  [words(['kitchen & dining room chairs?', 'dining chairs?']), 'Dining Chair'],
  [words(['arm chairs?', 'armchairs?', 'recliners?', 'sleeper chairs?', 'lounge chairs?', 'accent chairs?']), 'Armchair'],
  [words(['ottomans?', 'footstools?', 'poufs?']), 'Footstool'],
  [words(['table & bar stools?', 'bar stools?', 'stools?']), 'Bar Stool'],
  [words(['benches?']), 'Bench'],
  [words(['tv stands?', 'entertainment centers?', 'media consoles?']), 'TV Unit'],
  [words(['buffets? & sideboards?', 'sideboards?', 'buffets?']), 'Sideboard'],
  [words(['cabinets? & storage', 'cabinets?', 'cupboards?', 'storage cabinets?']), 'Storage Cabinet'],
  [words(['coat racks?', 'coat stands?']), 'Coat Stand'],
  [words(['lamps?']), 'Table Lamp']
];

// "Linens & Bedding|Bedding|Duvet Covers > Home & Garden" -> ['Duvet Covers', 'Bedding', 'Linens & Bedding'] (deepest first).
export function pathParts(feedCategory) {
  const [path] = String(feedCategory || '').split('>');
  return path.split('|').map(s => s.trim()).filter(Boolean).reverse();
}

// Where a Westwing product goes on HGW, from its English category path only (deepest folder first). null = not placed.
export function placeOf(feedCategory) {
  const full = String(feedCategory || '');
  if (NOT_HOME.test(full.split('>')[0]) && !/home & garden|furniture/i.test(full.split('>')[0])) return null;
  for (const part of pathParts(full)) {
    if (NOT_HOME.test(part)) return null;
    for (const [re, name] of PATH_WORDS) if (re.test(part)) { const p = homePlace(name); if (p) return p; }
    const p = homePlace(part);
    if (p) return p;
  }
  return null;
}

export function westwingRules(code) {
  const S = SHOPS[code];
  const RULES = {
    key: `westwing-${code}`,
    network: 'daisycon',
    advertiserId: S.advertiserId,
    retailer: `Westwing ${S.country}`,
    currency: 'EUR',
    shop: new RegExp(`^https://(www\\.)?${S.domain.replace('.', '\\.')}/`, 'i'),
    sites: ['hgw'],
    minPrice: 5,
    maxPrice: 5000,
    // One shop must not fill a whole subcategory of the site (lessons L161: a limit per subcategory).
    maxPerSubcategory: 400
    // Until 19 Nov 2026 also maxPerSubcategoryIn { 'Home Decor': 60, Furniture: 150 } (lessons L183), to keep HGW's
    // categories under 20,000. The older sites read only the cards they show since 19 Nov 2026 (L193), so that limit is gone.
  };
  const field = daisyconField(`https://www.${S.domain}/`);
  const displayName = name => String(name || '').replace(/\s{2,}/g, ' ').trim();
  // feedCategory = the feed's merchant_category ("Decor|Rugs"), awinCategory = its top folder ("Home & Garden").
  function classify({ name, feedCategory = '', awinCategory = '' }) {
    const n = displayName(name);
    if (!n) return { reject: 'no name' };
    if (!feedCategory) return { reject: 'no category in the feed' };
    if (NOT_HOME.test(awinCategory)) return { reject: 'not a home product of HGW, or not sure where it goes' };
    const p = placeOf(feedCategory);
    if (!p) return { reject: 'not a home product of HGW, or not sure where it goes' };
    return { site: 'hgw', siteCategory: p.siteCategory, subcategory: p.subcategory, name: n };
  }
  // The brand stays the feed's own (Westwing Collection, Ferm Living, String Furniture ...).
  return { RULES, SHOP_URL: `https://www.${S.domain}/`, field, productKey: pageKey, displayName, classify };
}
