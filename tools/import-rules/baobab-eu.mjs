// Import rules for Baobab Collection EU (Daisycon 18705): scented candles and diffusers (511 products, French names; its body lotions and perfumes stay out).
// Wave 3 of Daisycon, chat 9, 17 Nov 2026, on Home Gear World: see lib/daisycon-home.mjs and lib/home-eu.mjs.
// Shown only where it delivers and its language is spoken (sites/hgw/site.config.js deliversTo + languages, lessons L165).
import { daisyconHomeRules } from './lib/daisycon-home.mjs';

const S = daisyconHomeRules({ key: 'baobab-eu', advertiserId: 18705, retailer: 'Baobab Collection', shopUrl: 'https://eu.baobabcollection.com/', language: 'fr', brand: 'Baobab Collection',
  minPrice: 5, maxPrice: 1000, maxPerSubcategory: 400 });
export const RULES = S.RULES;
export const SHOP_URL = S.SHOP_URL;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
