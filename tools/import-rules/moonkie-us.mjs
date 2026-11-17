// Import rules for Moonkie (Awin advertiser 68278, moonkieshop.com, US dollars) on Kids Gear World. Wave 3 (approvals
// file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 152 rows, 97 pages of silicone baby products:
// pacifiers, teethers, stacking cups, bath and beach toys, bibs, feeding sets, breast pumps; "Personalized Service"
// left out. US shop: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'moonkie-us',
  advertiserId: 68278,
  retailer: 'Moonkie',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?moonkieshop\.com\//i,
  sites: ['kgw'],
  maxPrice: 200,
  minPrice: 5
};

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/personali[sz]ed service|gift ?card|shipping|insurance|replacement/i.test(n)) return { reject: 'service or gift card' };
  const b = sub => ({ site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: sub, name: /moonkie/i.test(n) ? n : `Moonkie ${n}` });
  if (/breast pump|milk collector/i.test(n)) return b('Breast Pumps');
  if (/pacifier|soother|dummy/i.test(n)) return b('Baby Soothers');
  if (/teether|teething/i.test(n)) return b('Dummies & Teethers');
  if (/bath|beach|sand|water toy/i.test(n)) return b('Bath Toys');
  if (/stacking|sorting|nesting|blocks?/i.test(n)) return b('Sorting & Stacking Toys');
  if (/bibs?/i.test(n)) return b('Bibs');
  if (/sippy|straw cup|training cup/i.test(n)) return b('Sippy Cups');
  if (/plate|bowl|spoon|feeding|cup\b|snack|placemat|suction/i.test(n)) return b('Nursing & Feeding');
  if (/toy|rattle|ball|book/i.test(n)) return b('Baby Activity Toys');
  return { reject: 'not a baby product the site lists' };
}
