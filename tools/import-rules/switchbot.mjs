// Import rules for SwitchBot (CJ Affiliate advertiser 5661292) on Home Gear World. Joined 12-13 Nov 2026. Feed facts
// (13 Nov 2026): 115 rows, 94 from the European shop eu.switch-bot.com in EUR and 21 from the US shop in USD; curtain and
// blind robots, sensors, locks, plugs, hubs, robot vacuums, fans. Only the European shop comes in (deliversTo EU, L62
// check of 13 Nov 2026, round 2b, lessons L107); the US rows give no columns (like Haglöfs, lessons L140).
export const RULES = {
  key: 'switchbot',
  network: 'cj',
  advertiserId: 5661292,
  retailer: 'SwitchBot',
  currency: 'EUR',
  shop: /^https:\/\/eu\.switch-bot\.com\//i,
  sites: ['hgw'],
  maxPrice: 2000,
  minPrice: 5,
  // The CJ feed has no pictures (first plan, 14 Nov 2026: 94 of 94 "no image"): the plan reads each page's picture from
  // the shop's public Shopify data (eu.switch-bot.com/products/<handle>.js, lessons L38).
  shopifyImages: true
};

export function field(c, column) {
  if (!RULES.shop.test(column('merchant_deep_link')) || column('currency').toUpperCase() !== 'EUR') return '';
  return column(c);
}

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

export function displayBrand() { return 'SwitchBot'; }
export function displayName(name) { return String(name || '').replace(/\s{2,}/g, ' ').trim(); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift card|shipping protection|replacement (?:filter|brush|mop)|spare/i.test(n)) return { reject: 'gift card or spare part' };
  const s = sub => ({ site: 'hgw', siteCategory: 'Smart Home', subcategory: sub });
  if (/vacuum|robot (?:mop|cleaner)|k10|s10|s20|floor cleaning/i.test(n)) return { site: 'hgw', siteCategory: 'Home Appliances', subcategory: 'Vacuum Cleaner' };
  if (/air purifier/i.test(n)) return { site: 'hgw', siteCategory: 'Home Appliances', subcategory: 'Air Purifier' };
  if (/humidifier/i.test(n)) return { site: 'hgw', siteCategory: 'Home Appliances', subcategory: 'Humidifier' };
  if (/\bfan\b|circulator/i.test(n)) return { site: 'hgw', siteCategory: 'Home Appliances', subcategory: 'Fan' };
  if (/thermostat/i.test(n)) return s('Smart Thermostat');
  if (/lock|keypad/i.test(n)) return s('Smart Lock');
  if (/plug|outlet/i.test(n)) return s('Smart Plug');
  if (/camera|cam\b/i.test(n)) return s('Security Camera');
  if (/doorbell/i.test(n)) return s('Video Doorbell');
  // Floor and candle-warmer lamps are not bulbs: "Smart Home Accessories" (dry run of 14 Nov 2026).
  if (/bulb|light strip|ceiling light/i.test(n)) return s('Smart Bulb');
  if (/motion sensor|presence/i.test(n)) return s('Motion Sensor');
  if (/sensor|meter|thermo-?hygrometer|co2/i.test(n)) return s('Smart Sensor');
  if (/display|art frame/i.test(n)) return s('Smart Display');
  return s('Smart Home Accessories');
}
