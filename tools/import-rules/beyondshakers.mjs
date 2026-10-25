// Import rules for Beyond Shakers (Awin advertiser 66912): protein shakers, sports and water bottles, gym towels.
// Feed facts (awin-feed-sample of 23 Oct 2026): 33 products in five small feeds, one category ("Fitness Equipment").
// The live shop (beyondshakers.com, 47 products) also sells supplements, lifting straps and gift cards: not on the sites.
// Beyond Shakers was on HGW with 4 gym towels (Hub import router, one card per colour): this plan replaces them.
// Shakers and bottles -> HGW Kitchen & Dining (Drinkware); gym towels -> HGW Bedding & Bath (Towel).
export const RULES = {
  key: 'beyondshakers',
  advertiserId: 66912,
  retailer: 'Beyond Shakers',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?beyondshakers\.com\//i,
  sites: ['hgw'],
  maxPrice: 200,
  shopifyCheck: true,
  shopOrigin: 'https://beyondshakers.com'
};

const NOT_FOR_SITES = /\b(gummies|creatine|electrolyte|ashwagandha|supplement|powder|protein powder|lifting straps?|chalk|gift card|voucher)\b/i;

// The feed names some products only by colour ("Pink", "Terracotta & Sand Twist"): the card says what it is.
// A name that already says "Beyond" ("Black Beyond Stainless Steel Protein Shaker") gets no second "Beyond Shakers".
function cardName(name, kind) {
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  const said = kind === 'towel' ? /\btowels?\b/i : kind === 'bottle' ? /\bbottles?\b/i : /\bshakers?\b/i;
  const what = kind === 'towel' ? 'Gym Towel' : kind === 'bottle' ? 'Bottle' : 'Protein Shaker';
  const full = said.test(n) ? n : `${n} ${what}`;
  return /\bbeyond\b/i.test(full) ? full : `Beyond Shakers ${full}`;
}

export function classify({ name, shopType = '' }) {
  const n = `${name} ${shopType}`;
  if (NOT_FOR_SITES.test(n) || /^(supplement|lifting gear|gift cards)$/i.test(shopType)) return { reject: 'supplements, lifting gear or gift cards (not on these sites)' };
  if (/\btowels?\b/i.test(n)) return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Towel', name: cardName(name, 'towel') };
  if (/\bbottles?\b/i.test(n)) return { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: 'Drinkware', name: cardName(name, 'bottle') };
  if (/\b(shakers?|twist|lid|lids)\b/i.test(n)) return { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: 'Drinkware', name: cardName(name, 'shaker') };
  return { reject: 'not a shaker, bottle or towel' };
}
