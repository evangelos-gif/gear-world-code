// Import rules for Sport and Leisure UK (Awin advertiser 1463, feeds 37875 and 117262) on Kids' Gear World: the garden
// trampolines and the children's ride-on cars that Sporty Gear World leaves out (owner, 8 Nov 2026: "tsekare an mporoun
// na mpoun allou"). Its fitness, golf and games tables go to Sporty Gear World (sites/sgw/sources.json). Feed facts
// (feed-profile 8 Nov 2026): 346 + 267 products, GBP, shop sportandleisureuk.com, categories "Trampolines > Rectangular
// Trampolines", "Trampolines > Round Trampolines", "Tramp Accesories", "Kids Ride-On Electric Cars", "Kids Cars"; brands
// Air King, Big Foot, Air League. KGW already has Toys & Games > Electric Riding Vehicles and Sports & Outdoors.
// The two feeds list the same products under different links and slightly different names (dry run 8 Nov 2026 22:57:
// every trampoline and ride-on car twice; "Air King 16ft Trampoline & Enclosure ..." / "... with Enclosure - ..."),
// and 28 products have two prices (Big Foot 9x14ft £349.95 / £359.95). Feed 117262 is the shop's current one (its links
// are the shop's /product/ pages, its ids the shop's SKUs, every product has a price); 37875 is the older one (root
// links, numeric ids, 22 products without a price, massage items the shop no longer lists). Only 117262 is read
// (checked 9 Nov 2026 on the staged feeds: 92 cards from both feeds, of which many near-duplicates).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
export function feedFiles(archive) {
  return ['AWIN_1463_117262.csv.gz', 'AWIN_1463_117262.csv'].map(f => join(archive, f)).filter(f => existsSync(f));
}
export const RULES = {
  key: 'sportandleisure',
  advertiserId: 1463,
  retailer: 'Sport and Leisure UK',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?sportandleisureuk\.com\//i,
  sites: ['kgw'],
  maxPrice: 1500,
  minPrice: 5,
  keepQuery: true,
  joinSameNameAcrossFeeds: true
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._-]{2,180}$/.test(path)) return path;
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

export function classify({ name, feedCategory = '' }) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  const c = String(feedCategory || '');
  if (!n) return { reject: 'no name' };
  if (/\b(ride[- ]?on|kids?'? (?:electric )?cars?|electric cars?|kids? jeep|kids? quad|kids? atv|kids? motorbike)\b/i.test(n) || /kids (ride-on|cars)/i.test(c)) {
    return { site: 'kgw', siteCategory: 'Toys & Games', subcategory: 'Electric Riding Vehicles' };
  }
  // Dry run 8 Nov 2026: play pools and junior basketball stands were left out by Sporty Gear World (kids' items).
  if (/\b(play pools?|paddling pools?|swimming pools?|pools?)\b/i.test(n) && /swimming pools|garden games/i.test(c)) {
    return { site: 'kgw', siteCategory: 'Sports & Outdoors', subcategory: 'Water Play Equipment' };
  }
  if (/\b(junior|kids?)\b/i.test(n) && /\b(basketball|football goals?|goals?)\b/i.test(n)) return { site: 'kgw', siteCategory: 'Sports & Outdoors', subcategory: 'Outdoor Games' };
  // A fitness rebounder is Sporty Gear World's (L65): only garden trampolines and their parts come here.
  if (/\brebounders?\b/i.test(n)) return { reject: 'fitness rebounder (Sporty Gear World)' };
  if (/\btrampolines?\b/i.test(n) || /trampolines|tramp accesor/i.test(c)) {
    return { site: 'kgw', siteCategory: 'Sports & Outdoors', subcategory: 'Trampolines' };
  }
  return { reject: 'sport or fitness (Sporty Gear World)' };
}
