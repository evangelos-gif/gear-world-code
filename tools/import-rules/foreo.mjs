// Import rules for FOREO (CJ Affiliate advertiser 5755636, foreo.com) on Women's Gear World. Joined 12-13 Nov 2026. Feed
// facts (13 Nov 2026): 316 rows in EUR from the French store (foreo.com ...?ipc=fr), one section "Health & Beauty >
// Personal Care > Cosmetics": LUNA, UFO, BEAR, PEACH, ISSA devices, their serums, masks and spare heads. Delivery: the
// European Union from the French store (L62 check of 13 Nov 2026): deliversTo EU on WGW (round 2b, lessons L107).
export const RULES = {
  key: 'foreo',
  network: 'cj',
  advertiserId: 5755636,
  retailer: 'FOREO',
  currency: 'EUR',
  shop: /^https:\/\/(www\.)?foreo\.com\//i,
  sites: ['wgw'],
  maxPrice: 1000,
  minPrice: 8
};

// FOREO links are "foreo.com/<product>?v=..&p=.." : the page is the path.
export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

export function displayBrand() { return 'FOREO'; }
export function displayName(name) { return String(name || '').replace(/\s{2,}/g, ' ').trim(); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  // FAQ™ is a FOREO line (LED masks, serums, patches), not a help page: it stays (dry run of 14 Nov 2026: 20 went out).
  if (/gift card|warranty|replacement brush head|brush heads?|cable|charger|power cable|plug adaptors?|stand only|travel case/i.test(n)) return { reject: 'gift card, spare head, cable or case' };
  const b = sub => ({ site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub });
  // Whole words: "ESPADA™" (a blue-light device) is not "pad" (dry run of 14 Nov 2026).
  if (/\b(?:serums?|masks?|toners?|creams?|cleansers?|gels?|pads?|moisturi[sz]ers?|moisturi[sz]ing|oils?|spf|lotions?|elixirs?|patch(?:es)?|primers?|solutions?)\b/i.test(n) && !/device|\bluna\b™? \d|ufo™? \d|bear™|peach™|issa™ \d|espada|faq™ ?\d/i.test(n)) return b('Skincare');
  if (/set|bundle|kit|collection|\+|,/i.test(n)) return b('Gift sets');
  if (/issa|toothbrush/i.test(n)) return b('Beauty tools');
  // PEACH™ is the hair removal device; "LUNA™ 4 go Peach Perfect" is a cleansing brush in a peach colour.
  if (/peach™|\bipl\b|hair removal/i.test(n) && !/\bluna\b/i.test(n)) return b('Hair removal');
  return b('Beauty tools');
}
