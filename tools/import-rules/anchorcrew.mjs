// Import rules for ANCHOR & CREW (Awin advertiser 131192, anchorandcrew.com, British jewellery and clothing) on Men's and
// Women's Gear World (14 Nov 2026). Joined, feed 118561 refreshed daily: 5,777 rows on 867 product pages, all in stock,
// pounds, £10 to £6,250 (LUXE 9ct gold). One page per colour; its rows are the sizes ("M - 21cm (Most Popular)") and the
// gift-wrap option ("No Gift Wrapping" / "Gift Wrapped (Paper & Bow) +£1.50") - the same product, so one card per page.
//  - PRICES: the feed gives them WITHOUT VAT (Sienna bracelet: £45.83 in the feed, £55.00 on anchorandcrew.com on 14 Nov
//    2026; every price x 1.2 is a round shop price: 62.50 -> 75, 87.50 -> 105, 22.50 -> 27). The card shows the shop price.
//  - Bracelets, bangles, necklaces, pendants, earrings, cufflinks, collar stays, charm beads -> MGW Men's Jewellery
//    (Bracelets, Necklaces, Jewellery). The women's lines, named after women (Alice, Evelyn, Hailey, Maisie, Sophia,
//    Zoey ...) -> WGW Women's Jewellery. SKINNY is a thinner bracelet, not a women's one (Arthur, Edward, William ...).
//  - T-shirts, hoodies and sweatshirts -> MGW Clothing; "(Womens)" ones -> WGW Clothing ("Explorer Print T-Shirt" is a
//    printed T-shirt, not an art print).
//  - Keyrings -> MGW Everyday Carry / EDC; briefcases and eyewear straps -> MGW Bags & Accessories (the site's own names, L56).
//  - Out: phone cases (Technology Gear World), wall prints, notebooks, journals, candles, gift cards and gift boxes.
export const RULES = {
  key: 'anchorcrew',
  advertiserId: 131192,
  // The shop name goes to wrangler, which refuses "&" (lessons L63, L120): the database name is "Anchor and Crew"; the
  // brand on every card stays ANCHOR & CREW.
  retailer: 'Anchor and Crew',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?anchorandcrew\.com\//i,
  sites: ['mgw', 'wgw'],
  maxPrice: 2500, // the LUXE 9ct gold bangles are £1,750
  minPrice: 10,
  commonVariantName: true
};

export function displayBrand() { return 'ANCHOR & CREW'; }

export const VAT = 1.2;
export function field(c, column) {
  const v = column(c);
  if ((c === 'search_price' || c === 'store_price') && v !== '') { const n = Number(String(v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? (Math.round(n * VAT * 100) / 100).toFixed(2) : v; }
  return v;
}

// "Khaki Green Montrose Silver and Rope Bracelet M - 21cm (Most Popular)/No Gift Wrapping" -> "Khaki Green Montrose Silver
// and Rope Bracelet"; "Athletic Grey Explorer Print Organic Cotton T-Shirt (Womens) 10 - 35"/36" (US 6 / EU 38)" -> "...T-Shirt".
export function displayName(name) {
  return String(name || '')
    .replace(/\s*\/?\s*(?:No Gift Wrapping|Gift Wrapped\b.*)$/i, '')
    .replace(/\s+(?:XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|\d{1,2}(?:\.\d)?)\s+-\s+.*$/, '')
    .replace(/\s*\((?:Most Popular|Womens|Mens)\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const JEWEL = W(['bracelets?', 'bangles?', 'necklaces?', 'pendants?', 'chains?', 'rings?', 'earrings?', 'earring studs?', 'anklets?', 'cufflinks?', 'collar stays?', 'beads?', 'charms?']);
const WOMEN_LINE = W(['alice', 'maisie', 'evelyn', 'zoey', 'hailey', 'sophia', 'sophie', 'isla', 'ava', 'freya', 'poppy', 'rosie', 'ruby', 'lily', 'ella', 'grace', 'lucia', 'olivia', 'amelia', 'mia', 'emily']);
const OUT = W(['wall prints?', 'gicl[eé]e', 'art prints?', 'gift ?cards?', 'e-?gift', 'vouchers?', 'gift box(?:es)?', 'gift bags?', 'polishing cloth', 'cleaning cloth',
  'notebooks?', 'journals?', 'refill booklets?', 'candles?', 'bookmarks?']);

export function classify({ name, feedCategory = '' }) {
  const raw = String(name || '');
  const n = displayName(raw);
  if (!n) return { reject: 'no name' };
  const women = /\(Womens\)|\bWomens\b|\bLadies\b/i.test(raw) || WOMEN_LINE.test(n);
  if (W(['phone cases?', 'cases?']).test(n)) return { reject: 'phone case (Technology Gear World)' };
  if (OUT.test(n) || /prints : edits/i.test(feedCategory)) return { reject: 'wall print, notebook, candle, gift card or gift box' };
  if (W(['keyrings?', 'key rings?']).test(n)) return { site: 'mgw', siteCategory: 'Everyday Carry / EDC', subcategory: 'Everyday Carry / EDC' };
  if (W(['eyewear straps?', 'glasses straps?']).test(n)) return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses' };
  if (W(['briefcases?', 'bags?', 'totes?', 'backpacks?']).test(n) && !W(['beads?', 'charms?']).test(n)) return { site: women ? 'wgw' : 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Bags' };
  if (JEWEL.test(n)) {
    const sub = W(['bracelets?', 'bangles?']).test(n) ? 'Bracelets' : W(['necklaces?', 'pendants?', 'chains?']).test(n) ? 'Necklaces'
      : women && W(['rings?']).test(n) ? 'Rings' : women && W(['earrings?']).test(n) ? 'Earrings' : 'Jewellery';
    return women ? { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: sub } : { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: sub };
  }
  const site = women ? 'wgw' : 'mgw';
  if (W(['hoodies?', 'hooded']).test(n)) return { site, siteCategory: 'Clothing', subcategory: 'Hoodies' };
  if (W(['sweatshirts?', 'sweaters?', 'jumpers?', 'crew ?necks?']).test(n)) return { site, siteCategory: 'Clothing', subcategory: 'Sweatshirts' };
  if (W(['t-?shirts?', 'tees?', 'tops?', 'long ?sleeve']).test(n)) return { site, siteCategory: 'Clothing', subcategory: 'T-Shirts' };
  if (W(['caps?', 'beanies?', 'hats?']).test(n)) return { site, siteCategory: 'Bags & Accessories', subcategory: 'Hats' };
  return { reject: 'not sure what it is (no jewellery or clothing word in the name)' };
}
