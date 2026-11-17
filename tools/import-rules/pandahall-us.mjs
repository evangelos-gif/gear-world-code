// Import rules for PandaHall (Awin advertiser 88751, pandahall.com, US dollars) on Women's Gear World. Wave 3 (approvals
// file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 47,574 jewellery-making supplies (beads, charms,
// pendants, chains, findings, tools) from the English shop (www, 18,978) and the French, German, Spanish and Italian
// ones (left out by the shop address: their names are in those languages). They go to Women's Jewellery > Jewellery
// Making & Beads, at most RULES.maxPerSubcategory of them (lessons L164), never with famous brand or character names
// (a marketplace like DHgate, lessons L161). Shown only to the US (dollar prices, US shop).
import { BRANDS } from './dhgate-kids-boots.mjs';
import { clean, CHARACTER } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'pandahall-us',
  advertiserId: 88751,
  retailer: 'PandaHall',
  currency: 'USD',
  shop: /^https:\/\/www\.pandahall\.com\//i,
  sites: ['wgw'],
  maxPrice: 200,
  minPrice: 2,
  maxPerSubcategory: 300
};

// "135Pcs 9 Colors Cat Eye Beads, Round, Mixed Color, 8mm, Hole: 0.8-0.9mm, 15pcs/color": the card keeps the first parts.
export function displayName(name) { return clean(name).split(/,\s*/).slice(0, 3).join(', '); }

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (BRANDS.test(n) || CHARACTER.test(n)) return { reject: 'a famous brand or character name on a marketplace (likely a copy)' };
  if (/zip-?lock|plastic bags?|storage bags?|gift bags?|boxes\b|display|organizer/i.test(n)) return { reject: 'packaging or storage' };
  if (/beads?|charms?|pendants?|findings|jump rings?|clasps?|chains?|ear ?wires?|earring hooks?|cabochons?|spacers?|links?|wire\b|cord\b|thread|pliers|bead/i.test(n)) {
    return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: 'Jewellery Making & Beads', name: displayName(n) };
  }
  return { reject: 'not a jewellery-making supply' };
}
