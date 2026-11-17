// Import rules for WUBEN (Awin advertiser 92053, US dollars) on Construction Gear World. Wave 3 (approvals file of
// chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 48 products: EDC, outdoor and camping flashlights,
// headlamps. Shared placing in lib/torch-us.mjs. US shop: shown only to the US.
import { placeTorch } from './lib/torch-us.mjs';

export const RULES = {
  key: 'wuben-us',
  advertiserId: 92053,
  retailer: 'WUBEN',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?wubenlight\.com\//i,
  sites: ['cgw'],
  maxPrice: 600,
  minPrice: 8
};

export function classify({ name }) { return placeTorch(name); }
