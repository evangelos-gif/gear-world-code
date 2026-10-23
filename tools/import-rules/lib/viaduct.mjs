// Shared import rules for Viaduct Clothing (Awin advertiser 125096): sportswear (adidas, New Balance, Champion, Ellesse,
// Nike, Puma ...). Two plans, because a product goes on one site per plan:
//   viaduct.mjs        men's and unisex -> MGW, juniors -> KGW
//   viaduct-women.mjs  women's and unisex -> WGW
// Feed facts (awin-feed-sample of 23 Oct 2026): 1,305 rows, ONE ROW PER SIZE ("... - Green | Size: S"), one category
// ("General Clothing"), no gender column. Viaduct was already on MGW (232) and WGW (351) from the Hub import router, one
// card PER SIZE ("... - White / L", "... - White / M"). Now: one card per product page (all sizes), and the live shop
// check (shopifyCheck, L39) gives the shop's own product type ("Trainers", "Track Pants") and gender tag ("Men's",
// "Womens"): 4,787 products on viaductclothing.co.uk, 937 of them in stock on 23 Oct 2026.
// The old one-card-per-size rows are hidden afterwards by legacy-cleanup -Rules viaduct-sizes (only where the new
// cards are already on the site).
export const BASE = {
  advertiserId: 125096,
  retailer: 'Viaduct Clothing',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?viaductclothing\.co\.uk\//i,
  maxPrice: 600,
  shopifyCheck: true,
  shopOrigin: 'https://viaductclothing.co.uk',
  // One card for all sizes: the link opens the product page, not one size.
  pageLink: true
};

// "adidas FC Schalke 04 3rd Kit Shorts - Green | Size: S" -> "adidas FC Schalke 04 3rd Kit Shorts - Green".
export function displayName(name) {
  return String(name || '').replace(/\s*\|\s*Size:\s*[^|]*$/i, '').replace(/\s+/g, ' ').trim();
}

const KIDS = /\b(junior|juniors|kids|kid's|infant|infants|toddler|youth|boys'?|girls'?|children|child|baby|j\s?\d{1,2}(\.5)?)\b/i;
const WOMEN = /\b(women|womens|women's|woman|ladies|lady|wmns|female)\b/i;
const MEN = /\b(men|mens|men's|man|male)\b/i;
const UNISEX = /\bunisex\b/i;

// men, women, both or kids. The shop's tags win; the name decides when there are no tags.
export function audience(name, tags = []) {
  const n = displayName(name);
  if (KIDS.test(n)) return 'kids';
  const t = tags.map(x => x.toLowerCase());
  const tagMen = t.includes("men's") || t.includes('mens');
  const tagWomen = t.includes("women's") || t.includes('womens');
  if (UNISEX.test(n) || t.includes('unisex') || (tagMen && tagWomen)) return 'both';
  if (tagWomen || (WOMEN.test(n) && !MEN.test(n))) return 'women';
  if (tagMen || MEN.test(n)) return 'men';
  return 'men';
}

const SHOE = /\b(shoes?|trainers?|sneakers?|boots?|sandals?|sliders?|slides|flip ?flops?|runners?|running shoe|gazelle|samba|superstar|stan smith|forum|campus|nmd|ultra ?boost|ozweego|spezial|handball|continental|air max|air force|cortex|blazer|dunk|suede|rs-x|old skool|chuck taylor|990v\d|2002r|550|574|9060|530|327|1906r)\b/i;
const BAG = /\b(bags?|backpacks?|rucksacks?|holdall|duffel|duffle|bum bag|waist ?bag|cross ?body|tote|shoulder bag|gym ?sack|sackpack)\b/i;
const HAT = /\b(caps?|hats?|beanies?|bucket hat|visor|headband)\b/i;

// Type: shoes, bags, hats or clothing, with the subcategory names the sites already use.
export function placeOf(name, shopType = '') {
  const n = displayName(name);
  const t = String(shopType || '').toLowerCase();
  if (/^(trainers|running shoes|shoes|sliders|slides|sandals|boots)$/.test(t) || (!t || t === 'sold out' || t === 'clothing') && SHOE.test(n)) {
    const sub = /slider|slides|sandal|flip ?flop/i.test(`${t} ${n}`) ? 'Sandals' : /boot/i.test(`${t} ${n}`) ? 'Boots' : 'Trainers';
    return { siteCategory: 'Shoes', subcategory: sub };
  }
  if (/^(bags|backpacks)$/.test(t) || BAG.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: 'Bags' };
  if (/^hats$/.test(t) || HAT.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: 'Hats' };
  const text = `${t} ${n}`;
  const sub =
    /\bsocks?\b/i.test(text) ? 'Socks'
    : /tracksuit/i.test(text) ? 'Tracksuits'
    : /\b(bras?|crop top)\b/i.test(text) ? 'Sports Bras & Tops'
    : /\b(dress(es)?|skirts?)\b/i.test(text) ? 'Dresses & Skirts'
    : /\b(leggings|tights)\b/i.test(text) ? 'Leggings'
    : /\bshorts\b/i.test(text) ? 'Shorts'
    : /\b(hoodies?|hoody|velour hoodie)\b/i.test(text) ? 'Hoodies'
    : /\b(sweatshirts?|crew ?neck sweat|knitwear|jumper|sweater)\b/i.test(text) ? 'Sweatshirts'
    : /\b(track ?tops?|jackets?|coats?|windbreaker|windrunner|gilet|puffer|parka|anorak|fleece jacket|coach jacket|rain jacket|sherpa)\b/i.test(text) ? 'Jackets'
    : /\b(track ?pants|joggers?|sweatpants|trousers|pants|chinos?|cargo)\b/i.test(text) ? 'Trousers'
    : /\b(t[- ]?shirts?|tees?|long sleeved tee|tank tops?|vests?|singlet)\b/i.test(text) ? 'T-Shirts'
    : /\b(polo|polo shirts|shirts?|jersey|football shirts?|kit)\b/i.test(text) ? 'Shirts'
    : /\btops?\b/i.test(text) ? 'T-Shirts'
    : 'Clothing';
  return { siteCategory: 'Clothing', subcategory: sub };
}
