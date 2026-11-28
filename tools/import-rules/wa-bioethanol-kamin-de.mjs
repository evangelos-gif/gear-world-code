// Import rules for Bioethanol-Kamin-Shop DE (Daisycon programme 15516) — Priority A of «Λείπουν 25-11» (row 41), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 26 Nov 2026: 1,831 rows, bioethanol, electric and water-vapour fireplaces, burners and their accessories; the shop's photos are on www.bioethanol-kamin-shop.de. Names end with " | Bioethanol-kamin-shop.de": the card stops before it. A fireplace shop: a product no word places goes to Fireplaces (CHECK).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { daisyconEuShop } from './lib/wave-a.mjs';

const S = daisyconEuShop({
  key: 'wa-bioethanol-kamin-de', advertiserId: 15516, retailer: 'Bioethanol-Kamin-Shop DE', language: 'de',
  shopUrl: 'https://www.bioethanol-kamin-shop.de/',
  minPrice: 20, maxPrice: 5000,
  fallback: ['Home Decor', 'Fireplaces'],
  cut: /\s+\|\s+.*$/,
  pathPlaces: [[/Heater/i, 'Home Appliances', 'Heater'], [/Fireplace|Fire place|Burner|Kamin|Glass/i, 'Home Decor', 'Fireplaces']],
});
export const RULES = S.RULES;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
