// Import rules for tado° UK (Awin advertiser 24881) on Home Gear World "Smart Home".
// tado° is new on every site. Its feed is small: smart thermostats, smart radiator thermostats, AC control, sensors and
// parts. HGW already has the subcategory "Smart Thermostat" (Hub import router), so thermostats join it.
// Feed facts (gw-feed-gaps 23 Oct 2026): 45 rows, 6 sold out by in_stock, prices in GBP, merchant_category like
// "smart radiator thermostat", "smart thermostat", "cooling"; names like "tado° | Add-on Smart Radiator Thermostat".
// Services and subscriptions (Auto-Assist, care plans, installation) are not products to buy here and are left out.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
export const RULES = {
  key: 'tado',
  advertiserId: 24881,
  retailer: 'Tado UK',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?tado\.com\//i,
  sites: ['hgw'],
  maxPrice: 1000,
  keepQuery: true
};

export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

// "tado° | Add-on Smart Radiator Thermostat" shows as "tado° Add-on Smart Radiator Thermostat".
export function displayName(name) {
  return String(name || '').replace(/^\s*tado°?\s*\|\s*/i, 'tado° ').replace(/\s{2,}/g, ' ').trim();
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const SERVICE = words(['subscription', 'auto-assist', 'auto assist', 'care plan', 'installation', 'install service', 'service', 'gift card', 'voucher', 'membership']);
const SUBS = [
  ['Smart Home Accessories', words(['cable', 'adapter', 'adaptor', 'batteries', 'battery', 'mount', 'bracket', 'stand', 'cover', 'plate', 'spacer', 'adapters'])],
  ['Smart AC Control', words(['ac control', 'air conditioning', 'air conditioner', 'cooling', 'ac'])],
  ['Smart Sensor', words(['sensor', 'sensors'])],
  ['Smart Thermostat', words(['thermostat', 'thermostats', 'radiator', 'trv', 'valve', 'heating', 'starter kit', 'heat pump', 'boiler', 'bridge'])]
];

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  if (SERVICE.test(n)) return { reject: 'service or subscription, not a product' };
  // "USB-C Cable for Smart Radiator Thermostat X" is a part; "Smart Thermostat X with cable" is a thermostat.
  const main = words(['thermostat', 'thermostats', 'radiator', 'ac control', 'sensor', 'starter kit']).test(n);
  const part = /\bfor\b/i.test(n) || !main;
  for (const [sub, re] of SUBS) {
    if (sub === 'Smart Home Accessories' && !part) continue;
    if (re.test(n) || re.test(feedCategory)) return { site: 'hgw', siteCategory: 'Smart Home', subcategory: sub };
  }
  return { reject: 'not a tado° thermostat, AC control, sensor or part' };
}
