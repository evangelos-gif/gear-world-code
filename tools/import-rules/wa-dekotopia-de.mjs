// Import rules for Dekotopia DE (Daisycon programme 21939) — Priority A of «Λείπουν 25-11» (row 49), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 26 Nov 2026: 467 rows, artificial plants and trees, Halloween decorations, stage fabrics and event supplies. Stage fabrics, nets and plinth covers stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { daisyconEuShop } from './lib/wave-a.mjs';

const S = daisyconEuShop({
  key: 'wa-dekotopia-de', advertiserId: 21939, retailer: 'Dekotopia DE', language: 'de',
  shopUrl: 'https://www.dekotopia.de/',
  minPrice: 5, maxPrice: 900,
  notPath: /Stoffe|Netze|Bühne|Podest/i, notPathWhy: 'stage fabric or event supply (not a home product of HGW)',
  pathPlaces: [[/Kunstpflanzen/i, 'Home Decor', 'Artificial Plants'], [/Halloween/i, 'Home Decor', 'Party Decorations'], [/Blumentöpfe/i, 'Home Decor', 'Vase'], [/Deko/i, 'Home Decor', 'Ornament']],
});
export const RULES = S.RULES;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
