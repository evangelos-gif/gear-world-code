// Import rules for Sanifun - Online-sanitairkopen.nl NL (Daisycon programme 7400) — Priority A of «Λείπουν 25-11» (row 79), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 26 Nov 2026: 4,580 rows of bathroom products of Sanifun: showers, shower trays and drains, taps, bathroom furniture, radiators. HGW had no showers or taps: new subcategories "Shower" and "Tap" in Bedding & Bath (L56). Toilets stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { daisyconEuShop } from './lib/wave-a.mjs';

const S = daisyconEuShop({
  key: 'wa-sanifun-nl', advertiserId: 7400, retailer: 'Sanifun - Online-sanitairkopen.nl NL', language: 'nl',
  shopUrl: 'https://www.online-sanitairkopen.nl/',
  minPrice: 10, maxPrice: 3000,
  cut: /\.$/,
  notPath: /Toilet|Closet|\bWC\b/i, notPathWhy: 'toilet (not listed on HGW)',
  pathPlaces: [[/Kranen/i, 'Bedding & Bath', 'Tap'], [/Douche/i, 'Bedding & Bath', 'Shower'], [/Badkamermeubel|Badmeubel|Spiegelkast/i, 'Bedding & Bath', 'Bathroom Furniture'],
    [/Radiator/i, 'Home Appliances', 'Heater'], [/Accessoires/i, 'Bedding & Bath', 'Bathroom Accessories']],
});
export const RULES = S.RULES;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
