// Import rules for Bloomingdales UK (Rakuten Advertising MID 37206 "Bloomingdales UK", bloomingdales.com, pounds) on
// Women's, Men's, Home and Kids' Gear World. Wave 1 UK of the massive import (chat 7 sheet «Εγκρίσεις» row 160, 24 Nov 2026,
// lessons L224). Catalogue of 22 Nov 2026: 312,287 rows (one per size) on 80,587 product pages, all in stock, in Google
// product categories: dresses 6,858, tops, sweaters and shirts 9,808, jewellery 9,264, tableware 7,206, bedding 4,700,
// trousers and jeans 4,853, furniture (desks and tables) 2,206, beauty 6,600, shoes 4,400, handbags 1,678, swimwear 2,244 ...
// Only 7,777 pages say in the name who they are for ("Men's", "Women's", "Girls'"): the rest is decided by what it is
// (a dress, a bra, pumps, a handbag, jewellery: women's), by brands that dress only women (Whistles, Hobbs London, Free
// People ...) or only men (John Varvatos, Peter Millar ...), and is left out when none of these says it (L171: never a
// guess between men and women).
//  - Women to WGW, men to MGW, children to KGW, home to HGW (by the shop's category, then the name), each in the
//    subcategories the site already has (L56).
//  - Luggage, collectibles, games, office, pets, gift cards and intimate accessories stay out.
import { audience, womenClothSub, menClothSub, shoeSub, fragranceFor, fragranceSub } from './lib/wave3-legacy.mjs';
import { homePlace } from './lib/hgw-home.mjs';
import { clean } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'bloomingdales-uk',
  network: 'rakuten',
  advertiserId: 37206,
  retailer: "Bloomingdale's",
  currency: 'GBP',
  shop: /^https:\/\/www\.bloomingdales\.com\//i,
  sites: ['wgw', 'mgw', 'hgw', 'kgw'],
  maxPrice: 10000,
  minPrice: 10
};

export function displayBrand(brand) { return clean(brand); }
// " - 100% Exclusive" / " - Exclusive" is the shop's label, not the product (and a percentage is never shown, L107).
export function displayName(name) {
  return clean(name).replace(/\s*-\s*(?:100%\s*)?exclusive\s*$/i, '').replace(/\s*-\s*\d+%\s*exclusive\s*$/i, '').trim();
}

const list = a => new RegExp(`^(?:${a.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`, 'i');
// Labels that dress only women (or almost only: their few men's pieces say "Men's" in the name).
export const WOMEN_BRANDS = list(['Aqua', 'Whistles', 'Hobbs London', "L'agence", 'Cinq A Sept', 'Gerard Darel', 'Veronica Beard', 'Nic+zoe', 'Nic+zoe Plus',
  'Free People', 'Maje', 'Ramy Brook', 'Eileen Fisher', 'Liverpool Los Angeles', 'Kobi Halperin', 'Karen Kane', 'Vix Paula Hermanny', 'Alice And Olivia',
  'Max Mara', 'Weekend Max Mara', 'Lysse', 'Lysse Plus', 'Generation Love', 'Sanctuary', 'Lafayette 148 New York', 'Kate Spade New York', 'Cece', 'Jenni Kayne',
  'La Blanca', 'Ganni', 'Ba & sh', 'Staud', 'Simkhai', 'T Tahari', 'Bella Dahl', 'Splits59', 'Skims', 'Derek Lam 10 Crosby', 'Marella', 'Sweaty Betty',
  'Tory Burch', 'Pq Swim', 'Anine Bing', 'Fifteen Twenty', 'Varley', 'Profile By Gottex', 'Beach Riot', 'Eberjey', 'Miraclesuit', 'Phase Eight', 'Johnny Was',
  'Norma Kamali', 'Misook', 'Spanx', 'Leset', 'Natori', 'Lspace', 'A.l.c.', 'Wacoal', 'Chantelle', 'Hanky Panky', 'Stuart Weitzman', 'Vince Camuto',
  'Mother', 'Agolde', 'Re/done', 'Elie Tahari', 'Rails', 'Splendid', 'Good American', 'Steve Madden', 'Commando', 'Cosabella', 'Fleur Du Mal', 'Simone Perele',
  'Le Mystere', 'Calypso St. Barth', 'Shoshanna', 'Adrianna Papell', 'Aidan Mattox', 'Dress The Population', 'Sam Edelman', 'Loeffler Randall', 'Larroude',
  'Jimmy Choo', 'Kurt Geiger London', 'Self-portrait', 'Reformation', 'Zimmermann', 'Farm Rio', 'Seafolly', 'Solid & Striped', 'Toccin', 'Teri Jon By Rickie Freeman',
  'Herve Leger', 'Diane Von Furstenberg', 'Ulla Johnson', 'Hutch', 'Dkny Sport', 'C By Bloomingdale\'s Cashmere', 'Theory Women', 'Bardot', 'Lucy Paris']);
// Labels that dress only men.
export const MEN_BRANDS = list(['John Varvatos', 'Robert Graham', 'Boggi Milano', 'Vilebrequin', 'Peter Millar', 'David Donahue', 'Nn07', 'Rhone',
  'Brioni', 'Zegna', 'Canali', 'Psycho Bunny', 'Bonobos', 'Hickey Freeman', 'Eton', 'Johnnie-o', 'Southern Tide', 'Paul Smith Men', 'Corneliani', 'Isaia',
  'The Men\'s Store At Bloomingdale\'s', 'Rodd & Gunn', 'Bugatchi', 'Brax', 'Baldwin', 'Faconnable', 'Orlebar Brown', 'Jack Victor', 'Mizzen+main', 'Stone Island']);

const MEN_NAME = /\b(men'?s|mens|for men|for him|homme|men's store|gentlemen'?s)\b/i;
const WOMEN_NAME = /\b(women'?s|womens|for women|for her|ladies|femme|maternity)\b/i;
const KIDS_NAME = /\b(girls?'?|boys?'?|kids?'?|children'?s?|baby|babies|toddlers?|infants?|little kid|big kid|newborn)\b/i;
const WOMEN_KIND = /dresses|skirts|bras$|lingerie|shapewear|hosiery|pumps|handbags|one-?pieces|hair accessories|jewelry/i;
const MEN_KIND = /neckties|cufflinks|tuxedos|^men >/i;

const WOMEN_WORDS = /\b(tankinis?|bikinis?|swimsuits?|one-piece swimsuit|bralettes?|blouses?|camisoles?|maxi|midi|mini dress|leggings|bodysuits?|kaftans?|caftans?|sarongs?)\b/i;

function who(name, cat, brand) {
  // "Baby Tee" and "Babydoll" are women's cuts, not baby clothes.
  if (KIDS_NAME.test(name.replace(/baby ?(tee|t-shirt|doll|rib|jacket)/gi, '')) || /^kids >|baby & toddler/i.test(cat)) return 'kids';
  if (MEN_NAME.test(name.replace(/women'?s/gi, ''))) return 'men';
  if (WOMEN_NAME.test(name)) return 'women';
  if (WOMEN_WORDS.test(name)) return 'women';
  if (MEN_KIND.test(cat)) return 'men';
  if (WOMEN_KIND.test(cat)) return 'women';
  if (MEN_BRANDS.test(brand)) return 'men';
  if (WOMEN_BRANDS.test(brand)) return 'women';
  const a = audience(name);
  return a === 'unisex' ? '' : a;
}

const W = (cat, sub, n) => ({ site: 'wgw', siteCategory: cat, subcategory: sub, name: n });
const M = (cat, sub, n) => ({ site: 'mgw', siteCategory: cat, subcategory: sub, name: n });
const H = (cat, sub, n) => ({ site: 'hgw', siteCategory: cat, subcategory: sub, name: n });

function homeItem(n, cat) {
  const c = cat.toLowerCase();
  if (/collectibles|games|office|pet supplies|gift certificates|luggage|kitchen appliances/.test(c)) return null;
  if (/dinnerware|serveware/.test(c)) return H('Kitchen & Dining', 'Tableware', n);
  if (/drinkware/.test(c)) return H('Kitchen & Dining', /glass/i.test(n) ? 'Glassware' : 'Drinkware', n);
  if (/barware/.test(c)) return H('Kitchen & Dining', 'Bar Accessories', n);
  if (/flatware/.test(c)) return H('Kitchen & Dining', 'Cutlery', n);
  if (/kitchen knives/.test(c)) return H('Kitchen & Dining', 'Kitchen Knives', n);
  if (/cookware|bakeware/.test(c)) return H('Kitchen & Dining', /frying pan|skillet/i.test(n) ? 'Frying Pan' : 'Cookware', n);
  if (/kitchen tools/.test(c)) return H('Kitchen & Dining', /board/i.test(n) ? 'Chopping Board' : 'Kitchen Utensil', n);
  if (/table linens/.test(c)) return H('Kitchen & Dining', 'Table Linen', n);
  if (/blankets/.test(c)) return H('Home Decor', 'Throw', n);
  if (/quilts|comforters/.test(c)) return H('Bedding & Bath', 'Duvet', n);
  if (/backrest pillows/.test(c)) return H('Home Decor', 'Cushion', n);
  if (/bed sheets/.test(c)) return H('Bedding & Bath', /pillow ?case|sham/i.test(n) ? 'Pillow' : 'Bed Sheet', n);
  if (/> pillows/.test(c)) return H('Bedding & Bath', 'Pillow', n);
  if (/bath towels|towels/.test(c)) return H('Bedding & Bath', 'Towel', n);
  if (/bath mats/.test(c)) return H('Bedding & Bath', 'Bath Mat', n);
  if (/shower curtains|bathroom accessories/.test(c)) return H('Bedding & Bath', 'Bathroom Accessories', n);
  if (/candles|home fragrances/.test(c)) return H('Home Decor', 'Home Fragrance', n);
  if (/holiday/.test(c)) return H('Home Decor', 'Christmas', n);
  if (/rugs/.test(c)) return H('Home Decor', 'Rug', n);
  if (/mirrors/.test(c)) return H('Home Decor', 'Mirror', n);
  if (/tapestries|artwork/.test(c)) return H('Home Decor', 'Wall Art', n);
  if (/mattress (pad|protector|topper|cover)|featherbed|mattress enhancer/i.test(n)) return H('Bedding & Bath', 'Mattress Topper', n);
  if (/steam iron|\birons?\b|steamer/i.test(n)) return H('Cleaning & Laundry', 'Ironing & Clothes Care', n);
  if (/vacuum/i.test(n)) return H('Home Appliances', 'Vacuum Cleaner', n);
  if (/(pole|rod|grommet|sheer|blackout|tab) (top )?(curtain )?panels?|curtain|drapes?/i.test(n)) return H('Home Decor', 'Curtain', n);
  // The shop's "Furniture > Desks & Tables" holds desk-top decor: picture frames, centrepieces, boxes, flowers.
  if (/\bframes?\b/i.test(n) && !/bed ?frame/i.test(n)) return H('Home Decor', 'Ornament', n);
  const p = homePlace(n);
  if (p) return H(p.siteCategory, p.subcategory, n);
  if (/^furniture > desks/.test(c) && /centerpiece|centrepiece|arrangement|roses?\b|box(es)?\b|bowl|tray|sculpture|figurine|object|menorah|mezuzah|candle|jar\b|dish|stand\b/i.test(n)) return H('Home Decor', 'Ornament', n);
  if (/bedding/.test(c)) return H('Bedding & Bath', 'Bed Linen', n);
  if (/decor/.test(c)) return H('Home Decor', 'Ornament', n);
  return null;
}

function beauty(n, cat, brand) {
  const c = cat.toLowerCase();
  if (/perfume|cologne/.test(c)) {
    const f = fragranceFor(n, '');
    const sub = fragranceSub(n);
    return f === 'men' ? M('Grooming & Fragrances', sub === 'Gift sets' ? 'Gift sets' : 'Fragrance', n) : W('Beauty & Fragrances', sub, n);
  }
  const forMen = MEN_NAME.test(n) || MEN_BRANDS.test(brand);
  if (/shav|beard|razor/i.test(n) && forMen) return M('Grooming & Fragrances', 'Shaving', n);
  if (forMen) return M('Grooming & Fragrances', /hair|shampoo/i.test(n) ? 'Hair care' : 'Skincare', n);
  if (/eye makeup|lip makeup|face & cheek|makeup/.test(c)) return W('Beauty & Fragrances', 'Make-up', n);
  if (/nail/.test(c)) return W('Beauty & Fragrances', 'Nails', n);
  if (/hair care/.test(c)) return W('Beauty & Fragrances', /dryer|straightener|curl|brush|styler/i.test(n) ? 'Hair tools' : 'Hair care', n);
  if (/bath & body/.test(c)) return W('Beauty & Fragrances', 'Bath & body', n);
  if (/cosmetic tools/.test(c)) return W('Beauty & Fragrances', 'Beauty tools', n);
  if (/skin care|personal care/.test(c)) return W('Beauty & Fragrances', /set|kit|duo|trio/i.test(n) && /gift|holiday/i.test(n) ? 'Gift sets' : 'Skincare', n);
  return null;
}

const JEWELLERY = { earrings: 'Earrings', necklaces: 'Necklaces', bracelets: 'Bracelets', rings: 'Rings', 'charms & pendants': 'Necklaces', 'brooches & lapels': 'Jewellery' };

function women(n, cat) {
  const c = cat.toLowerCase(), last = c.split(' > ').pop();
  if (/jewelry/.test(c)) return W("Women's Jewellery", JEWELLERY[last] || 'Jewellery', n);
  if (/watches/.test(c)) return W('Watches', 'Watches', n);
  if (/shoes/.test(c)) {
    const sub = /pumps/.test(c) ? 'Heels' : /sandals/.test(c) ? 'Sandals' : /athletic/.test(c) ? 'Trainers' : /boots/.test(c) ? 'Boots' : /slippers/.test(c) ? 'Slippers' : shoeSub(n, 'wgw');
    return W('Shoes', sub, n);
  }
  if (/handbags|business bags/.test(c)) return W('Bags & Accessories', 'Bags', n);
  if (/sunglasses/.test(c)) return W('Bags & Accessories', 'Sunglasses', n);
  if (/eyeglasses/.test(c)) return W('Bags & Accessories', 'Eyeglasses', n);
  if (/wallets/.test(c)) return W('Bags & Accessories', 'Wallets & Purses', n);
  if (/belts/.test(c)) return W('Bags & Accessories', 'Belts', n);
  if (/scarves/.test(c)) return W('Bags & Accessories', 'Scarves', n);
  if (/hats/.test(c)) return W('Bags & Accessories', 'Hats', n);
  if (/hair accessories/.test(c)) return W('Bags & Accessories', 'Hair Accessories', n);
  if (/gloves/.test(c)) return W('Bags & Accessories', 'Gloves', n);
  if (/clothing accessories/.test(c)) return W('Bags & Accessories', 'Accessories', n);
  if (/dresses/.test(c)) return W('Clothing', 'Dresses', n);
  if (/skirts/.test(c)) return W('Clothing', 'Skirts', n);
  if (/bras|lingerie|shapewear/.test(c) || /underwear & socks$/.test(c)) return W('Clothing', 'Underwear', n);
  if (/hosiery/.test(c)) return W('Clothing', 'Tights & Stockings', n);
  if (/> socks/.test(c)) return W('Clothing', 'Socks', n);
  if (/sleepwear/.test(c)) return W('Clothing', 'Nightwear', n);
  if (/sweaters/.test(c)) return W('Clothing', womenClothSub(n, 'Knitwear'), n);
  if (/jeans/.test(c)) return W('Clothing', 'Jeans', n);
  if (/> pants/.test(c)) return W('Clothing', womenClothSub(n, 'Trousers'), n);
  if (/outerwear/.test(c)) return W('Clothing', 'Jackets & Coats', n);
  if (/shorts/.test(c)) return W('Clothing', 'Shorts', n);
  if (/sweatshirts/.test(c)) return W('Clothing', womenClothSub(n, 'Sweatshirts'), n);
  if (/swimwear|one-?pieces/.test(c)) return W('Clothing', 'Clothing', n);
  if (/> shirts/.test(c)) return W('Clothing', womenClothSub(n, 'Tops & Blouses'), n);
  if (/tops/.test(c)) return W('Clothing', womenClothSub(n, 'Tops & Blouses'), n);
  if (/clothing/.test(c)) return W('Clothing', womenClothSub(n, 'Clothing'), n);
  return null;
}

function men(n, cat) {
  const c = cat.toLowerCase(), last = c.split(' > ').pop();
  if (/cufflinks/.test(c)) return M("Men's Jewellery", 'Cufflinks', n);
  if (/jewelry/.test(c)) return M("Men's Jewellery", JEWELLERY[last] || 'Jewellery', n);
  if (/watches/.test(c)) return M('Watches', "Men's Watches", n);
  if (/shoes|loafers|clogs/.test(c)) return M('Shoes', shoeSub(n, 'mgw'), n);
  if (/neckties/.test(c)) return M('Bags & Accessories', 'Ties', n);
  if (/business bags|handbags/.test(c)) return M('Bags & Accessories', 'Bags', n);
  if (/sunglasses/.test(c)) return M('Bags & Accessories', 'Sunglasses', n);
  if (/wallets/.test(c)) return M('Bags & Accessories', 'Wallets & Purses', n);
  if (/belts/.test(c)) return M('Bags & Accessories', 'Belts', n);
  if (/scarves/.test(c)) return M('Bags & Accessories', 'Scarves', n);
  if (/hats/.test(c)) return M('Bags & Accessories', 'Hats', n);
  if (/gloves/.test(c)) return M('Bags & Accessories', 'Gloves', n);
  if (/clothing accessories/.test(c)) return M('Bags & Accessories', 'Accessories', n);
  if (/tuxedos|suits/.test(c)) return M('Clothing', 'Suits', n);
  if (/underwear|> socks/.test(c)) return M('Clothing', /sock/i.test(n) ? 'Socks' : 'Underwear', n);
  if (/sleepwear/.test(c)) return M('Clothing', 'Nightwear', n);
  if (/sweaters/.test(c)) return M('Clothing', menClothSub(n, 'Knitwear'), n);
  if (/jeans/.test(c)) return M('Clothing', 'Jeans', n);
  if (/> pants/.test(c)) return M('Clothing', menClothSub(n, 'Trousers'), n);
  if (/outerwear/.test(c)) return M('Clothing', menClothSub(n, 'Jackets'), n);
  if (/shorts|swimwear/.test(c)) return M('Clothing', 'Shorts', n);
  if (/sweatshirts/.test(c)) return M('Clothing', menClothSub(n, 'Sweatshirts'), n);
  if (/> shirts/.test(c)) return M('Clothing', menClothSub(n, 'Shirts'), n);
  if (/tops|clothing/.test(c)) return M('Clothing', menClothSub(n, 'Clothing'), n);
  return null;
}

function kids(n, cat) {
  const c = cat.toLowerCase();
  const K = (catg, sub) => ({ site: 'kgw', siteCategory: catg, subcategory: sub, name: n });
  if (/baby toys/.test(c)) return K('Baby & Toddler', 'Baby Activity Toys');
  if (/nursing & feeding/.test(c)) return K('Baby & Toddler', 'Nursing & Feeding');
  if (/cribs/.test(c)) return K('Baby & Toddler', 'Cribs & Cradles');
  if (/shoes|clogs|loafers/.test(c)) return K('Shoes', 'Shoes');
  if (/sleepwear/.test(c) || /pajama|pyjama/i.test(n)) return K('Clothing', 'Nightwear & Loungewear');
  if (/socks/.test(c)) return K('Clothing', 'Socks');
  if (/clothing|apparel/.test(c)) return K('Clothing', 'Clothing');
  if (/hats|gloves|scarves|hair accessories|sunglasses|clothing accessories/.test(c)) return K('Accessories', 'Accessories');
  return null;
}

export function classify({ name, feedCategory = '', brand = '' }) {
  const n = displayName(name);
  const cat = clean(feedCategory);
  const b = clean(brand);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|e-?gift|z_dnu|face_masks|intimate_accessories|luggage|collectibles|toys & games > games|office supplies|pet supplies/i.test(`${n} | ${cat}`) && !/kids > |baby/i.test(cat)) {
    return { reject: 'luggage, collectibles, games, office, pet, gift card or intimate item' };
  }
  if (/^(home & garden|furniture|home >)/i.test(cat)) return homeItem(n, cat) || { reject: 'a home item the site has no place for' };
  if (/^(health & beauty|beauty)/i.test(cat)) return beauty(n, cat, b) || { reject: 'a beauty item the site has no place for' };
  const a = who(n, cat, b);
  if (a === 'kids') return kids(n, cat) || { reject: "a children's item the site has no place for" };
  if (!a) return { reject: "men's or women's? (not said)" };
  const place = a === 'women' ? women(n, cat) : men(n, cat);
  return place || { reject: 'not clothing, shoes, an accessory or jewellery the site has a place for' };
}
