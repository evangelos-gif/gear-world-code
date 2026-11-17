// Import rules for Yale Home UK (Awin advertiser 19571, yalehome.co.uk, pounds) on Home Gear World. Wave 3 (approvals
// file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 423 rows: smart locks and keypads, alarms and their
// sensors, cameras and video doorbells, and also mechanical locks, padlocks, key blanks and safes. HGW has a Smart Home
// category and no locks-and-safes one, so only the smart and security products go in. UK shop: the site's default (GB).
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'yale-uk',
  advertiserId: 19571,
  retailer: 'Yale Home UK',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?yalehome\.co\.uk\//i,
  sites: ['hgw'],
  maxPrice: 600,
  minPrice: 10
};

export function displayBrand() { return 'Yale'; }

export function classify({ name, feedCategory = '' }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  const s = sub => ({ site: 'hgw', siteCategory: 'Smart Home', subcategory: sub, name: /^yale\b/i.test(n) ? n : `Yale ${n}` });
  if (/replacement|spare|battery|batteries|key blank|cylinder|bracket|cable|sim card|subscription|plan\b/i.test(n)) return { reject: 'spare part or service' };
  if (/doorbell/i.test(n)) return s('Video Doorbell');
  if (/camera|cam\b|vision bundle/i.test(n)) return s('Security Camera');
  if (/smart lock|conexis|linus|keyless|keypad|smart (?:door|cabinet) lock|approach|assure/i.test(n)) return s('Smart Lock');
  if (/motion|pir\b/i.test(n)) return s('Motion Sensor');
  if (/contact|sensor|detector|smoke|leak/i.test(n)) return s('Smart Sensor');
  if (/alarm|siren|sync|hub|module/i.test(n)) return s('Smart Home Accessories');
  if (/safe|padlock|sashlock|nightlatch|deadlock|lock|latch|bolt|key/i.test(`${n} ${feedCategory}`)) return { reject: 'a mechanical lock or safe (no such category on HGW)' };
  return { reject: 'not a smart home product' };
}
