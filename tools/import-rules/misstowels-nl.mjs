// Import rules for Miss Towels (Daisycon 21226): hotel-quality towels in Portuguese cotton (64 products, Dutch names).
// Wave 3 of Daisycon, chat 9, 17 Nov 2026, on Home Gear World: see lib/daisycon-home.mjs and lib/home-eu.mjs.
// Shown only where it delivers and its language is spoken (sites/hgw/site.config.js deliversTo + languages, lessons L165).
import { daisyconHomeRules } from './lib/daisycon-home.mjs';

const S = daisyconHomeRules({ key: 'misstowels-nl', advertiserId: 21226, retailer: 'Miss Towels', shopUrl: 'https://www.misstowels.nl/', language: 'nl', brand: 'Miss Towels',
  minPrice: 5, maxPrice: 500, maxPerSubcategory: 400 });
export const RULES = S.RULES;
export const SHOP_URL = S.SHOP_URL;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
