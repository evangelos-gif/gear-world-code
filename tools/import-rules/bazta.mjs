// Import rules for Bazta UK (Awin advertiser 116097): beauty, men's grooming, watches, home cleaning, kids and garden.
// Same catalogue as Plusshop UK (plusshop.mjs) at different prices: both shops go on the sites so prices can be compared.
// The rules are shared (lib/plusshop-family.mjs). Bazta UK was only on GGW (3 garden tools by the Hub import router).
import { makeRules } from './lib/plusshop-family.mjs';
export { productKey, field, classify } from './lib/plusshop-family.mjs';

export const RULES = makeRules({ key: 'bazta', advertiserId: 116097, retailer: 'Bazta UK', host: 'bazta.com' });
