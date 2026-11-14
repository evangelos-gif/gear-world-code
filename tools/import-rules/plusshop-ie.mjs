// Import rules for Plusshop IE (Awin advertiser 29511): the Irish shop of Plusshop (ie.plusshop.com, euros). Its shipping
// page (read 14 Nov 2026): "Orders placed on Plusshop IE are only delivered to addresses in Ireland", so the site configs
// show it only to visitors from Ireland (deliversTo, lessons L107, L144). Same catalogue and rules as Plusshop UK.
import { join } from 'node:path';
import { makeRules } from './lib/plusshop-family.mjs';
export { productKey, field, classify, displayName, displayBrand } from './lib/plusshop-family.mjs';

export const RULES = makeRules({ key: 'plusshop-ie', advertiserId: 29511, retailer: 'Plusshop IE', host: 'plusshop.com', currency: 'EUR', country: 'ie' });

// Its feed 98493 has not changed since 15 May 2026 (Awin, 14 Nov 2026): six-month-old prices must not reach the site
// with today's "Price checked" date (lessons L60, L107). Only the three live feeds are read.
export const LIVE_FEEDS = [89816, 89818, 111984];
export function feedFiles(archive) {
  return LIVE_FEEDS.flatMap(id => [`AWIN_29511_${id}.csv.gz`, `AWIN_29511_${id}.csv`]).map(f => join(archive, f));
}
