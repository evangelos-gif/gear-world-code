// Import rules for iEDM US (Awin advertiser 71579) — Priority A of «Λείπουν 25-11» (row 212), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 14 Nov 2026: 35,792 rows, 4,358 pages of festival and rave wear by many brands (crop tops, shorts, leggings, hoodies, tanks). Names end with the colour, size and "by iEDM": the card stops before them. Only women's and unisex clothes; men's, and names with rude words, drugs or sex, stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, W, audience, wgwFashion } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-iedm-us', advertiserId: 71579, retailer: 'iEDM US', currency: 'USD',
  shop: shopOf('iedm.com'), sites: ['wgw'], minPrice: 10, maxPrice: 200, maxPerSubcategory: 400, commonVariantName: true });

const RUDE = W(['gangbang', 'fuck\\w*', 'f\\*ck\\w*', 'sh[i*]t\\w*', 'porn\\w*', 'sex\\w*', 'nsfw', 'nude', 'naked', 'boobs?', 'tits?', 'cock', 'dick', 'pussy', 'stoner',
  'weed', '420', 'cannabis', 'marijuana', 'drugs?', 'molly', 'mdma', 'lsd', 'acid', 'shrooms?', 'trippy', 'high af', 'satan\\w*', 'kill\\w*', 'bitch\\w*', 'ass',
  'bdsm', 'fetish', 'harness', 'pasties', 'gangsta', 'damn', 'hell yeah', 'wtf']);
// "On Cue Apparel Alien Jogger Sweatpants in Black - L by iEDM" -> "On Cue Apparel Alien Jogger Sweatpants in Black".
export const displayName = name => noSale(String(name || '').replace(/^Ready To Ship\s+/i, '').replace(/\s+by iEDM\s*$/i, '').replace(/\s+-\s+(?:Size:.*|[^-]{1,30})$/i, ''));

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (RUDE.test(name)) return { reject: 'rude, drug or sex words in the name' };
  if (audience(n) === 'men' || audience(n) === 'kids') return { reject: "men's or children's" };
  if (/\b(?:tank|tee|t-shirt|hoodie|jogger|sweatpants|shorts)\b/i.test(n) && !/women|crop|booty|unisex|bralette|ladies/i.test(n)) return { reject: "not known to be women's" };
  if (/gloves?|masks?|bandanas?|fans?|stickers?|patches|pins?|lanyards?|hydration|kandi|wigs?/i.test(n)) return { reject: 'festival accessory' };
  const p = wgwFashion(n, feedCategory);
  if (!p) return { reject: "not women's clothing the site lists" };
  return { site: 'wgw', ...p, name: n };
}
