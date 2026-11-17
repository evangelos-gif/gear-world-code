// Import rules for NITECORE Store (Awin advertiser 81173, US dollars) on Construction Gear World. Wave 3 (approvals
// file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 126 rows, 86 products (all on one page address,
// the product code in its query): flashlights, keychain lights, headlamps, a hunting kit. Shared placing in
// lib/torch-us.mjs. US shop: shown only to the US.
import { placeTorch } from './lib/torch-us.mjs';

export const RULES = {
  key: 'nitecore-us',
  advertiserId: 81173,
  retailer: 'NITECORE Store',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?nitecorestore\.com\//i,
  sites: ['cgw'],
  maxPrice: 600,
  minPrice: 8,
  keepQuery: true
};

// The feed's links are http:// and all on one page address with the product in the query
// ("ProductDetails.asp?ProductCode=FL-NITE-EC23"): https, and one card per product code.
export function field(c, column) {
  const v = column(c);
  return c === 'merchant_deep_link' ? String(v || '').replace(/^http:\/\//i, 'https://') : v;
}
export function productKey(get) {
  const m = /[?&]ProductCode=([A-Za-z0-9-]{3,60})/i.exec(String(get('merchant_deep_link') || ''));
  return m ? `code-${m[1].toUpperCase()}` : '';
}

export function classify({ name }) { return placeTorch(name); }
