// Import rules for Zulily US (Rakuten Advertising MID 54167) — Priority A of «Λείπουν 25-11» (row 106), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 26 Nov 2026: 371,073 rows, 85,570 pages of a US marketplace (women's and men's fashion, shoes, jewellery, home, phone cases, kids). Only products for babies and children (their words in the name or the folder); at most 300 cards a subcategory.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, audience } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-zulily-us', network: 'rakuten', advertiserId: 54167, retailer: 'Zulily US', currency: 'USD',
  shop: shopOf('zulily.com'), sites: ['kgw'], minPrice: 5, maxPrice: 500, maxPerSubcategory: 300 });

export const displayName = name => noSale(name);

const KIDS_PATH = /baby|toddler|infant|kids|children|toys|games/i;
export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (audience(n) !== 'kids' && !(KIDS_PATH.test(feedCategory) && !audience(n))) return { reject: 'not for children (Zulily marketplace)' };
  if (/maternity|nursing bra|mom\b|mommy|women'?s|men'?s|adult/i.test(n)) return { reject: 'for grown-ups' };
  const t = `${n} | ${feedCategory}`;
  const at = (cat, sub) => ({ site: 'kgw', siteCategory: cat, subcategory: sub, name: n });
  if (/sneakers?|trainers?|athletic shoes/i.test(t)) return at('Shoes', 'Trainers');
  if (/boots?|booties/i.test(n)) return at('Shoes', 'Winter Boots');
  if (/shoes?|sandals?|slippers?|clogs?|flats|loafers?|mary janes?/i.test(t)) return at('Shoes', 'Shoes');
  if (/backpacks?/i.test(n)) return at('School & Backpacks', 'School Bags');
  if (/lunch (?:box|bag)/i.test(n)) return at('School & Backpacks', 'Lunch Boxes & Bags');
  if (/bottles?\b/i.test(n) && /baby|infant/i.test(t)) return at('Baby & Toddler', 'Baby Bottles');
  if (/\bbibs?\b/i.test(n)) return at('Baby & Toddler', 'Bibs');
  if (/swaddle/i.test(n)) return at('Baby & Toddler', 'Swaddling Blankets');
  if (/carriers?\b/i.test(n)) return at('Baby & Toddler', 'Baby Carriers');
  if (/dolls?\b/i.test(n)) return at('Toys & Games', 'Dolls');
  if (/puzzles?/i.test(n)) return at('Toys & Games', 'Jigsaw Puzzles');
  if (/board games?|card games?/i.test(n)) return at('Toys & Games', 'Board Games');
  if (/plush|stuffed|cuddly|teddy/i.test(n)) return at('Toys & Games', 'Stuffed Animals & Cuddly Toys');
  if (/building (?:blocks|set|kit)|bricks|lego/i.test(n)) return at('Toys & Games', 'Construction Set Toys');
  if (/pajamas?|pyjamas?|sleepwear|nightgowns?|robes?|pj sets?/i.test(n)) return at('Clothing', 'Nightwear & Loungewear');
  if (/socks?\b|tights/i.test(n)) return at('Clothing', 'Socks');
  if (/toys?|games?|play ?sets?/i.test(t)) return at('Toys & Games', 'Toys & Games');
  if (/bedding|comforter|quilt|sheet set|pillow|blanket|duvet|rug|lamp/i.test(n)) return at('Bedroom & Home', 'Bedroom & Home');
  if (/apparel|clothing|dress|top|tee|shirt|pants|leggings|shorts|skirt|jacket|coat|hoodie|sweater|bodysuit|romper|outfit|set\b|swim/i.test(t)) return at('Clothing', 'Clothing');
  if (/baby|infant|toddler/i.test(t)) return at('Baby & Toddler', 'Baby & Toddler');
  return { reject: "no place on Kids' Gear World for this product" };
}
