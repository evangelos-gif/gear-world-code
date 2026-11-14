// Import rules for Tooled Up's plumbing tools (Awin advertiser 496, feed 118685) on Construction Gear World (12 Nov 2026,
// lessons L117, L119). Tooled Up is already on CGW with 36,000 tools (the old import); its plumbing tools were only under
// generic categories, with no Plumbing subcategory to find them. Feed 118685 (11 Nov 2026): 480 products, prices in pounds, brands
// Monument, Bailey, Faithfull, Sievert, Sealey, Draper, Bosch Professional, Ridgid; shop categories Pipe Cutters, Gas
// Burners & Accessories, Blow Torches, Pipe Joiners, Drain & Pipe Augers & Snakes, Drain Testing Plugs, Radiator Keys ...
//  - Add-only: the other Tooled Up products on CGW stay as they are; nothing is hidden.
//  - First import (12 Nov 2026) stopped on CGW's (retailer, merchant id) key: 346 of these tools WERE already on CGW
//    (active, under other Awin ids), filed under the generic Hand Tools > Hand Tools, Site Equipment > Site Equipment,
//    Hand Tools > DIY and Power Tools > Hand Tools, and 17 hidden ones under the shop's own category names. Now the plan
//    names both keys (L119): those are updated and moved to Hand Tools > Plumbing Tools (keepCategory with the list of
//    the generic names below, so the dry run counts them and the import writes a rollback of their old places); ~111 are new.
//  - My Tool Shed (49385) has the same 479 products (feed 119156, links to tooled-up.com too): added once only, as Tooled Up.
//  - All of them: Hand Tools > Plumbing Tools (a new subcategory on CGW).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const RULES = {
  key: 'tooledup-plumbing',
  advertiserId: 496,
  retailer: 'Tooled Up',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?tooled-up\.com\//i,
  sites: ['cgw'],
  maxPrice: 3000,
  minPrice: 3,
  addOnly: true,
  keepCategory: true,
  replaceSubcategories: {
    cgw: ['Hand Tools', 'Site Equipment', 'DIY', 'Miscellaneous Plumbing Tools', 'Pipe Joiners', 'Drain & Pipe Augers & Snakes',
      'Pipe Cutting Accessories & Spares', 'Plungers', 'Blow Torches', 'Drain Rod Sets', 'Gas Burners & Accessories',
      'Other Drain & Pipe Cleaning Accessories', 'Pipe Benders']
  }
};

export const PLUMBING_FEED_IDS = [118685];
export function feedFiles(archive) {
  const out = [];
  for (const id of PLUMBING_FEED_IDS) {
    for (const ext of ['.csv.gz', '.csv']) {
      const f = join(archive, `AWIN_${RULES.advertiserId}_${id}${ext}`);
      if (existsSync(f)) { out.push(f); break; }
    }
  }
  return out;
}

// The shop's own number of each option (sizes of one pipe cutter are separate products on the shop).
export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

export function displayName(name) {
  return String(name || '').replace(/\s{2,}/g, ' ').trim();
}

// Feed 118685 is Tooled Up's plumbing feed: everything in it is a plumbing tool (stopcock keys, olive pullers, water
// gauges and fitting brushes too, first dry run of 12 Nov 2026), so only gift cards are left out.
export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|voucher/i.test(n)) return { reject: 'gift card' };
  return { site: 'cgw', siteCategory: 'Hand Tools', subcategory: 'Plumbing Tools' };
}
