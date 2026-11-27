// Import rules for Vincasa DE (Daisycon programme 20840) — Priority A of «Λείπουν 25-11» (row 86), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 26 Nov 2026: 169 rows of wine racks and wine accessories (corkscrews, coolers, wine fridges); the shop's photos are on www.weinregal-profi.de. Plinths of the rack modules stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { daisyconEuShop } from './lib/wave-a.mjs';

const S = daisyconEuShop({
  key: 'wa-vincasa-de', advertiserId: 20840, retailer: 'Vincasa DE', language: 'de',
  shopUrl: 'https://www.weinregal-profi.de/',
  minPrice: 8, maxPrice: 3000,
  pathPlaces: [[/Weinregale/i, 'Storage & Organisation', 'Storage Rack'], [/Kühlschränke/i, 'Home Appliances', 'Refrigerator'], [/Trinkgläser|Trinkgefäße/i, 'Kitchen & Dining', 'Glassware'],
    [/Bar-Utensilien|Korkenzieher|Getränkewannen/i, 'Kitchen & Dining', 'Bar Accessories']],
});
export const RULES = S.RULES;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
