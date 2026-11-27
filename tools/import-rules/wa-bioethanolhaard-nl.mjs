// Import rules for Bioethanolhaard-Shop NL (Daisycon programme 15518) — Priority A of «Λείπουν 25-11» (row 42), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 26 Nov 2026: 2,014 rows, the Dutch shop of the same company (bioethanol, gas and electric fireplaces, burners, accessories). Covers stay out. A fireplace shop: a product no word places goes to Fireplaces (CHECK).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { daisyconEuShop } from './lib/wave-a.mjs';

const S = daisyconEuShop({
  key: 'wa-bioethanolhaard-nl', advertiserId: 15518, retailer: 'Bioethanolhaard-Shop NL', language: 'nl',
  shopUrl: 'https://www.bioethanolhaard-shop.nl/',
  minPrice: 20, maxPrice: 5000,
  fallback: ['Home Decor', 'Fireplaces'],
  cut: /\s+\|\s+.*$/,
  pathPlaces: [[/Heater/i, 'Home Appliances', 'Heater'], [/Fireplace|Fire place|Burner|haard|Glass/i, 'Home Decor', 'Fireplaces']],
});
export const RULES = S.RULES;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
