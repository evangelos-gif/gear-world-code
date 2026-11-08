// Import rules for Sport and Leisure UK (Awin advertiser 1463, feeds 37875 and 117262) on Kids' Gear World: the garden
// trampolines and the children's ride-on cars that Sporty Gear World leaves out (owner, 8 Nov 2026: "tsekare an mporoun
// na mpoun allou"). Its fitness, golf and games tables go to Sporty Gear World (sites/sgw/sources.json). Feed facts
// (feed-profile 8 Nov 2026): 346 + 267 products, GBP, shop sportandleisureuk.com, categories "Trampolines > Rectangular
// Trampolines", "Trampolines > Round Trampolines", "Tramp Accesories", "Kids Ride-On Electric Cars", "Kids Cars"; brands
// Air King, Big Foot, Air League. KGW already has Toys & Games > Electric Riding Vehicles and Sports & Outdoors.
// The two feeds list the same products: one card per product page.
export const RULES = {
  key: 'sportandleisure',
  advertiserId: 1463,
  retailer: 'Sport and Leisure UK',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?sportandleisureuk\.com\//i,
  sites: ['kgw'],
  maxPrice: 1500,
  minPrice: 5,
  keepQuery: true
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
