// Import rules for Tooled Up's plumbing tools (Awin advertiser 496, feed 118685) on Construction Gear World (12 Nov 2026,
// lessons L117). Tooled Up is already on CGW with 36,000 tools (the old import), but CGW had NO plumbing tools at all (no
// pipe cutters, benders, blow torches or drain rods). Feed 118685 (11 Nov 2026): 480 products, prices in pounds, brands
// Monument, Bailey, Faithfull, Sievert, Sealey, Draper, Bosch Professional, Ridgid; shop categories Pipe Cutters, Gas
// Burners & Accessories, Blow Torches, Pipe Joiners, Drain & Pipe Augers & Snakes, Drain Testing Plugs, Radiator Keys ...
//  - Add-only: the other Tooled Up products on CGW stay as they are; nothing is hidden.
//  - My Tool Shed (49385) has the same 479 products (feed 119156, links to tooled-up.com too): added once only, as Tooled Up.
//  - All of them: Hand Tools > Plumbing Tools (a new subcategory: CGW had none of these).
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
  addOnly: true
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
