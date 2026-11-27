// Import rules for Maytag US (Rakuten Advertising MID 53708) — Priority A of «Λείπουν 25-11» (row 70), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 91 rows, washers, dryers, refrigerators, ranges, cooktops, dishwashers, microwaves. HGW had no refrigerators, cookers, hoods or dishwashers: new subcategories in Home Appliances in the site's style (L56).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-maytag-us', network: 'rakuten', advertiserId: 53708, retailer: 'Maytag US', currency: 'USD',
  shop: shopOf('maytag.com'),
  minPrice: 50, maxPrice: 4000,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
