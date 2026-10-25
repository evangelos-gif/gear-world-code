// Import rules for Plusshop UK (Awin advertiser 69306): beauty, men's grooming, watches, home cleaning, kids and garden.
// Same catalogue as Bazta UK (bazta.mjs) at different prices: both shops go on the sites so prices can be compared.
// The rules are shared (lib/plusshop-family.mjs). Plusshop UK was only on GGW (3 garden tools by the Hub import router).
import { makeRules } from './lib/plusshop-family.mjs';
export { productKey, field, classify } from './lib/plusshop-family.mjs';

export const RULES = makeRules({ key: 'plusshop', advertiserId: 69306, retailer: 'Plusshop UK', host: 'plusshop.com' });
