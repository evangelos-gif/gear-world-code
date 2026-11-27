// Import rules for Green Kid Crafts (Awin advertiser 83693, greenkidcrafts.com, US dollars) on Kids' Gear World. Wave 1 of
// the massive import (chat 7 sheet «Εγκρίσεις» row 1144, countries US / CA / UK / IE / AU / NZ / JP, 22-24 Nov 2026,
// lessons L224). Feed of 22 Nov 2026: 59 rows, all in stock: science and craft boxes for ages 3-12 ("Rocket Science
// Discovery Box", "Art Lab Box", "Chemistry Lab Box"), seasonal kits (gingerbread village, felt tree) and two monthly
// subscriptions with 1, 3, 6 and 12 month prices. The prices are in dollars, so the cards show with the other dollar
// shops (US view), as the feed gives them.
//  - Science, engineering and nature boxes to KGW Toys & Games > Educational Toys; art and craft kits to Toy Craft Kits.
//  - Subscriptions (a monthly plan, not one product at one price) stay out.
import { clean } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'greenkidcrafts',
  advertiserId: 83693,
  retailer: 'Green Kid Crafts',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?greenkidcrafts\.com\//i,
  sites: ['kgw'],
  maxPrice: 150,
  minPrice: 8
};

export function displayBrand() { return 'Green Kid Crafts'; }

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/subscription|gift ?card|membership/i.test(n)) return { reject: 'a subscription or gift card (not one product)' };
  const t = sub => ({ site: 'kgw', siteCategory: 'Toys & Games', subcategory: sub, name: n });
  if (/science|chemistry|physics|engineer|rocket|energy|climate|robot|electric/i.test(n)) return t('Educational Toys');
  if (/\bart\b|craft|felt|gingerbread|paint|ornament|card making|sewing|weaving/i.test(n)) return t('Toy Craft Kits');
  return t('Educational Toys');
}
