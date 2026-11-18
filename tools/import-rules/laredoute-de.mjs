// Import rules for La Redoute DE (Daisycon 22318): furniture, bed and bath linen, curtains, rugs (27,783 products on 16 Nov 2026, German names, euros).
// Wave 3 of Daisycon, chat 9, 17 Nov 2026, on Home Gear World: see lib/daisycon-home.mjs and lib/home-eu.mjs.
// Shown only where it delivers and its language is spoken (sites/hgw/site.config.js deliversTo + languages, lessons L165).
import { daisyconHomeRules } from './lib/daisycon-home.mjs';

const S = daisyconHomeRules({ key: 'laredoute-de', advertiserId: 22318, retailer: 'La Redoute DE', shopUrl: 'https://www.laredoute.de/', language: 'de',
  minPrice: 5, maxPrice: 5000, maxPerSubcategory: 400 });
export const RULES = S.RULES;
export const SHOP_URL = S.SHOP_URL;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
