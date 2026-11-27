// Import rules for Janine DE (Daisycon programme 21986) — Priority A of «Λείπουν 25-11» (row 60), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 26 Nov 2026: 2,505 rows of the bed linen maker Janine: duvet cover sets and fitted sheets in sizes and colours. Names repeat the brand ("Janine Janine Mako-Satin ..."): the card keeps it once.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { daisyconEuShop } from './lib/wave-a.mjs';

const S = daisyconEuShop({
  key: 'wa-janine-de', advertiserId: 21986, retailer: 'Janine DE', language: 'de',
  shopUrl: 'https://www.janine.de/',
  minPrice: 10, maxPrice: 400,
  cut: /^Janine\s+(?=Janine\b)/i,
  pathPlaces: [[/Bettlaken/i, 'Bedding & Bath', 'Bed Sheet'], [/Bettbezüge|Bettwäsche/i, 'Bedding & Bath', 'Bed Linen']],
});
export const RULES = S.RULES;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
