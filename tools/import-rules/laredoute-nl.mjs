// Import rules for La Redoute NL (Daisycon 16029): furniture, bed and bath linen, curtains, rugs (36,485 products on 16 Nov 2026, Dutch names, euros).
// Wave 3 of Daisycon, chat 9, 17 Nov 2026, on Home Gear World: see lib/daisycon-home.mjs and lib/home-eu.mjs.
// Shown only where it delivers and its language is spoken (sites/hgw/site.config.js deliversTo + languages, lessons L165).
import { daisyconHomeRules } from './lib/daisycon-home.mjs';

const S = daisyconHomeRules({ key: 'laredoute-nl', advertiserId: 16029, retailer: 'La Redoute NL', shopUrl: 'https://www.laredoute.nl/', language: 'nl',
  minPrice: 5, maxPrice: 5000, maxPerSubcategory: 400 });
export const RULES = S.RULES;
export const SHOP_URL = S.SHOP_URL;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
