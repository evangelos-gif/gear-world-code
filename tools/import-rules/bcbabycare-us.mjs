// Import rules for BC Babycare (CJ Affiliate advertiser 7582444 "Bc Babycare", bcbabycare.com, US dollars) on Kids Gear
// World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 201 rows (one per colour or
// size), 62 pages: Cloud Skin nappies and trial packs, baby wipes and lotion tissues, sippy and straw cups, feeding
// sets, a balance scooter. Shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'bcbabycare-us',
  network: 'cj',
  advertiserId: 7582444,
  retailer: 'BC Babycare',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?bcbabycare\.com\//i,
  sites: ['kgw'],
  maxPrice: 300,
  minPrice: 4
};

export function classify({ name, awinCategory = '' }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  const t = `${n} | ${awinCategory}`;
  if (/gift ?card|shipping|insurance|accessory|replacement|spare/i.test(n)) return { reject: 'gift card or service' };
  const b = sub => ({ site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: sub, name: n });
  if (/diaper|nappy|nappies|pull-?ups?|training pants/i.test(t)) return b('Nappies');
  if (/wipes|tissue/i.test(t)) return b('Baby Wipes');
  if (/sippy|straw cup|training cup/i.test(t)) return b('Sippy Cups');
  if (/bottle/i.test(n)) return b('Baby Bottles');
  if (/plate|bowl|spoon|feeding|bib/i.test(t)) return b('Nursing & Feeding');
  if (/scooter/i.test(n)) return { site: 'kgw', siteCategory: 'Sports & Outdoors', subcategory: 'Riding Scooters', name: n };
  if (/bath/i.test(t)) return b('Baby Bathing');
  return { reject: 'not a baby product the site lists' };
}
