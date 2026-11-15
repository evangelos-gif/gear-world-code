// Import rules for Xpluswear (Daisycon programme 20417 "Xpluswear (INT)", xpluswear.com, euros) on Women's Gear World
// (mass import round 2, 15 Nov 2026). Feed: 2,606 products in English, plus-size women's clothing ("Xpluswear Plus Size
// Vacation Hot Pink Round Neck Short Sleeve Ruffle Maxi Dress ..."), EUR 15-100. Prices are in euros: shown only in the EU
// views (deliversTo Xpluswear: ['EU']), not to the UK (no pound price, Manager 15 Nov 2026).
import { daisyconField, pageKey } from './lib/daisycon-shop.mjs';

export const RULES = {
  key: 'xpluswear',
  network: 'daisycon',
  advertiserId: 20417,
  retailer: 'Xpluswear',
  currency: 'EUR',
  shop: /^https:\/\/(www\.)?xpluswear\.com\//i,
  sites: ['wgw'],
  maxPrice: 300,
  minPrice: 8
};

export const SHOP_URL = 'https://www.xpluswear.com/';
export const field = daisyconField(SHOP_URL);
export const productKey = pageKey;

// "Xpluswear Plus Size Vacation Hot Pink Round Neck Short Sleeve Ruffle Maxi Dress" -> "Plus Size Vacation Hot Pink ... Maxi Dress"
export function displayName(name) {
  let n = String(name || '').replace(/^Xpluswear\s+(Design\s+)?/i, '').replace(/\s{2,}/g, ' ').trim();
  if (n.length > 95) { n = n.slice(0, 95); n = n.slice(0, n.lastIndexOf(' ')); }
  return n;
}
export function displayBrand() { return 'Xpluswear'; }

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const KINDS = [[W(['jumpsuits?', 'rompers?']), 'Clothing'], [W(['dress', 'dresses']), 'Dresses'], [W(['skirts?']), 'Skirts'], [W(['shorts']), 'Shorts'], [W(['jeans']), 'Jeans'],
  [W(['leggings']), 'Leggings'], [W(['pants', 'trousers']), 'Trousers'], [W(['hoodies?']), 'Hoodies'], [W(['sweatshirts?']), 'Sweatshirts'],
  [W(['cardigans?', 'sweaters?', 'knit']), 'Knitwear'], [W(['coats?', 'jackets?', 'blazers?']), 'Jackets & Coats'], [W(['t-?shirts?', 'tees?', 'tank tops?', 'camis?']), 'T-Shirts'],
  [W(['blouses?', 'shirts?', 'tops?', 'tunics?']), 'Tops & Blouses'], [W(['two-?piece', '2 piece', 'sets?', 'suits?']), 'Clothing']];

export function classify({ name }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (/see[- ]through|sexy|lingerie|swimsuit|bikini/i.test(n)) return { reject: 'see-through, lingerie or swimwear' };
  // The LAST kind word is the product ("... Top And Skirt Two Piece Set" is a set).
  let best = null, end = -1;
  for (const [re, sub] of KINDS) { const g = new RegExp(re.source, 'gi'); for (let m = g.exec(n); m; m = g.exec(n)) if (m.index + m[0].length > end) { end = m.index + m[0].length; best = sub; } }
  return best ? { site: 'wgw', siteCategory: 'Clothing', subcategory: best, name: displayName(n) } : { reject: 'not sure what it is' };
}
