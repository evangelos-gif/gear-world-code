// Import rules for Skilhunt (Awin advertiser 37130, US dollars) on Construction Gear World. Wave 3 (approvals file of
// chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 82 rows, 35 pages: rechargeable flashlights and headlamps,
// plus batteries, chargers and optics. Shared placing in lib/torch-us.mjs. US shop: shown only to the US.
import { placeTorch } from './lib/torch-us.mjs';

export const RULES = {
  key: 'skilhunt-us',
  advertiserId: 37130,
  retailer: 'Skilhunt',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?skilhunt\.com\//i,
  sites: ['cgw'],
  maxPrice: 600,
  minPrice: 8
};

export function classify({ name }) { return placeTorch(name); }
