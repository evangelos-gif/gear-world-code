// Import rules for Bazta IE (Awin advertiser 116033): the Irish shop of Bazta (ie.bazta.com, euros). Its delivery page
// (read 14 Nov 2026): "Orders placed on ie.bazta.com are only delivered to addresses in Ireland", so the site configs
// show it only to visitors from Ireland (deliversTo, lessons L107, L144). Same catalogue and rules as Bazta UK.
import { makeRules } from './lib/plusshop-family.mjs';
export { productKey, field, classify, displayName, displayBrand } from './lib/plusshop-family.mjs';

export const RULES = makeRules({ key: 'bazta-ie', advertiserId: 116033, retailer: 'Bazta IE', host: 'bazta.com', currency: 'EUR', country: 'ie' });
