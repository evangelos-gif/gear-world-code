// Import rules for Dille & Kamille NL (Daisycon 7059): kitchen, table linen, candles, pots, Christmas (3,072 products, Dutch names; its food, cards and books stay out).
// Wave 3 of Daisycon, chat 9, 17 Nov 2026, on Home Gear World: see lib/daisycon-home.mjs and lib/home-eu.mjs.
// Shown only where it delivers and its language is spoken (sites/hgw/site.config.js deliversTo + languages, lessons L165).
import { daisyconHomeRules } from './lib/daisycon-home.mjs';

const S = daisyconHomeRules({ key: 'dillekamille-nl', advertiserId: 7059, retailer: 'Dille Kamille NL', shopUrl: 'https://www.dille-kamille.nl/', language: 'nl',
  minPrice: 3, maxPrice: 500, maxPerSubcategory: 300 });
export const RULES = S.RULES;
export const SHOP_URL = S.SHOP_URL;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
