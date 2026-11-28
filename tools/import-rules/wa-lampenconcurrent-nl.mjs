// Import rules for LampenConcurrent NL (Daisycon programme 17145) — Priority A of «Λείπουν 25-11» (row 63), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 26 Nov 2026: 2,309 rows of lighting: lamps, ceiling and wall lights, LED bulbs, track lights, some kitchen products.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { daisyconEuShop } from './lib/wave-a.mjs';

const S = daisyconEuShop({
  key: 'wa-lampenconcurrent-nl', advertiserId: 17145, retailer: 'LampenConcurrent NL', language: 'nl',
  shopUrl: 'https://www.lampenconcurrent.nl/',
  minPrice: 3, maxPrice: 1500,
  pathPlaces: [[/Plafondverlichting/i, 'Lighting', 'Ceiling Light'], [/Muurverlichting/i, 'Lighting', 'Wall Light'], [/LED-lampen|Lichtbronnen/i, 'Lighting', 'Light Bulb'],
    [/Railverlichting/i, 'Lighting', 'Ceiling Light'], [/Hanglamp/i, 'Lighting', 'Pendant Light'], [/Tafellamp/i, 'Lighting', 'Table Lamp'], [/Vloerlamp/i, 'Lighting', 'Floor Lamp']],
});
export const RULES = S.RULES;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
