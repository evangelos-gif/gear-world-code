// Import rules for Dille & Kamille FR (Daisycon 7739): the same shop in French (3,061 products; food, cards and books stay out).
// Wave 3 of Daisycon, chat 9, 17 Nov 2026, on Home Gear World: see lib/daisycon-home.mjs and lib/home-eu.mjs.
// Shown only where it delivers and its language is spoken (sites/hgw/site.config.js deliversTo + languages, lessons L165).
import { daisyconHomeRules } from './lib/daisycon-home.mjs';

const S = daisyconHomeRules({ key: 'dillekamille-fr', advertiserId: 7739, retailer: 'Dille Kamille FR', shopUrl: 'https://www.dille-kamille.fr/', language: 'fr',
  minPrice: 3, maxPrice: 500, maxPerSubcategory: 300 });
export const RULES = S.RULES;
export const SHOP_URL = S.SHOP_URL;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
