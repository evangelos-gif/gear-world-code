// Import rules for Aosom (CJ Affiliate advertiser 5360120 "Aosom.com", aosom.com, US dollars; brands HOMCOM, Outsunny,
// Qaba, PawHut, Soozier) on Home Gear World and Garden Gear World. Wave 3 (approvals file of chat 7, 16 Nov 2026,
// lessons L170). Feed of 17 Nov 2026: 5,963 products with category paths ("Home Goods > Living Room > Coffee Tables",
// "Outdoor > Patio Furniture > ..."). Home goods, office furniture and Christmas decorations go to HGW, outdoor living
// to GGW (shared HGW and GGW words); toys, pets, sport, fitness, tools and health left out. At most
// RULES.maxPerSubcategory cards per subcategory (lessons L164). US shop: shown only to the US.
import { homePlace, homeName, notHome } from './lib/hgw-home.mjs';
import { gardenPlace } from './lib/garden.mjs';
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'aosom-us',
  network: 'cj',
  advertiserId: 5360120,
  retailer: 'Aosom',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?aosom\.com\//i,
  sites: ['hgw', 'ggw'],
  maxPrice: 3000,
  minPrice: 15,
  maxPerSubcategory: 120
};

export function productKey(get) {
  try { const p = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, ''); if (p.length > 3) return p.toLowerCase(); } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

const fix = s => String(s || '').replace(/Ã©/g, 'é').replace(/Â°/g, '°').replace(/(\d)â\S*/g, "$1'").replace(/ð\S*/g, '');
export function displayName(name) { return homeName(clean(fix(name))); }

export function classify({ name, feedCategory = '' }) {
  const full = clean(fix(name));
  const n = displayName(full);
  if (!n) return { reject: 'no name' };
  const cat = fix(feedCategory);
  if (/replacement|spare|cover only|canopy top|sidewall/i.test(full)) return { reject: 'replacement part or cover' };
  if (/shower chair|bath chair|mobility|medical|wheelchair|commode|toilet|bathtub door|shower door|sink cabinet|vanit(y|ies) with sink/i.test(full)) return { reject: 'bathroom fitting or mobility aid (not our groups)' };
  if (/^Seasonal > Christmas/i.test(cat)) return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Christmas', name: n };
  if (/^Outdoor > (Patio Furniture|Lawn & Garden|Outdoor Shade|Outdoor Décor|Outdoor Grills|Outdoor Heating|Outdoor Storage)/i.test(cat)) {
    const head = full.split(/\s*[,–|]\s*/)[0];
    const o = sub => ({ site: 'ggw', siteCategory: 'Garden Furniture & Outdoor Living', subcategory: sub, name: n });
    if (/\brugs?\b/i.test(head)) return o('Cushions & rugs');
    if (/chaise|lounger|tanning chair/i.test(head)) return o('Loungers');
    if (/adirondack|\bchairs?\b|\bbench(es)?\b/i.test(head) && !/cushion|cover|storage/i.test(head)) return o('Chairs & benches');
    const g = gardenPlace(head, '') || gardenPlace(full, '');
    return g ? { site: 'ggw', ...g, name: n } : { reject: 'no garden place for this name' };
  }
  if (!/^(Home Goods > (Living Room|Home Décor|Kitchen and Dining|Accents & Storage|Bedroom|Bathroom|Laundry|Dining Room|Entryway)|Office > (Office Chairs|Office Desks|Office Storage))/i.test(cat)) {
    return { reject: `Aosom group "${cat.split(' > ').slice(0, 2).join(' > ')}" is not one our sites show` };
  }
  if (notHome(n)) return { reject: 'not a home product' };
  const p = homePlace(n);
  return p ? { site: 'hgw', ...p, name: n } : { reject: 'no home place for this name' };
}
