// Import rules for Dr.Prepare (Awin advertiser 66310, drprepare.com, US dollars) on Home Gear World. Wave 3 (approvals
// file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 208 rows, 114 pages: fans, space heaters, and also
// camping gear, inverters, lithium batteries, work lights and clothes (left out). US plugs: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'drprepare-us',
  advertiserId: 66310,
  retailer: 'Dr.Prepare',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?drprepare\.com\//i,
  sites: ['hgw'],
  maxPrice: 800,
  minPrice: 15
};

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/camping|battery|batteries|inverter|solar|charger|work light|jacket|vest|shower|cooler|tent|replacement|filter|warranty/i.test(n)) return { reject: 'camping, power or another product (not Home)' };
  const a = sub => ({ site: 'hgw', siteCategory: 'Home Appliances', subcategory: sub, name: n });
  if (/heater/i.test(n)) return a('Heater');
  if (/dehumidifier/i.test(n)) return a('Dehumidifier');
  if (/\bfans?\b/i.test(n)) return a('Fan');
  if (/humidifier|air purifier/i.test(n)) return a('Small Appliances');
  return { reject: 'not a home appliance' };
}
