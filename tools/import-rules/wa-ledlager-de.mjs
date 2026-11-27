// Import rules for LEDLager DE (Daisycon programme 20911) — Priority A of «Λείπουν 25-11» (row 64), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of download of 27 Nov 2026 (first file of this programme; 600 products in the programme list): LED lighting. The shop address is checked in the dry run (the host of its photos).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { daisyconEuShop } from './lib/wave-a.mjs';

const S = daisyconEuShop({
  key: 'wa-ledlager-de', advertiserId: 20911, retailer: 'LEDLager DE', language: 'de',
  shopUrl: 'https://www.ledlager.de/',
  minPrice: 3, maxPrice: 1500,
});
export const RULES = S.RULES;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
