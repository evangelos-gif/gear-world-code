// Import rules for SwitchBot (CJ Affiliate advertiser 5661292) on Home Gear World. Joined 12-13 Nov 2026. Feed facts
// (13 Nov 2026): 115 rows, 94 from the European shop eu.switch-bot.com in EUR and 21 from the US shop in USD; curtain and
// blind robots, sensors, locks, plugs, hubs, robot vacuums, fans. Only the European shop comes in (deliversTo EU, L62
// check of 13 Nov 2026, round 2b, lessons L107); the US rows give no columns (like Haglöfs, lessons L140).
// Round 2c (14 Nov 2026, lessons L144): the pictures come from a copy of the shop's public data (lib/switchbot-shop.mjs),
// because the shop did not answer the plan on the owner's PC (2b: 3 of 94); for two days after that copy its prices and
// stock win over the feed (16 options cost another price on the shop that evening), and pages gone from the shop stay out.
import { SNAPSHOT_DATE, SHOP_IMAGES, SHOP_OPTIONS, SHOP_PAGES, SHOP_GONE } from './lib/switchbot-shop.mjs';

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
  // The CJ feed has no pictures (first plan, 14 Nov 2026: 94 of 94 "no image"): they come from SHOP_IMAGES; a page that
  // is not in that copy is still read from the shop's public Shopify data (eu.switch-bot.com/products/<handle>.js, L38).
  shopifyImages: true
};

const handleOf = link => (/^https:\/\/eu\.switch-bot\.com\/products\/([a-z0-9-]+)/i.exec(String(link || '')) || [])[1] || '';
// The Shopify variant id: the last part of the feed's id ("shopify_DE_<product>_<variant>").
const optionOf = id => (/_(\d{6,20})$/.exec(String(id || '')) || [])[1] || '';
export function snapshotFresh(now = new Date()) {
  return (now.getTime() - Date.parse(`${SNAPSHOT_DATE}T00:00:00Z`)) / 86400000 < 3;
}

export function field(c, column, now = new Date()) {
  if (!RULES.shop.test(column('merchant_deep_link')) || column('currency').toUpperCase() !== 'EUR') return '';
  const handle = handleOf(column('merchant_deep_link')).toLowerCase();
  if ((c === 'merchant_image_url' || c === 'large_image') && !column(c) && SHOP_IMAGES[handle]) return SHOP_IMAGES[handle];
  const page = SHOP_PAGES[handle];
  const option = SHOP_OPTIONS[optionOf(column('merchant_product_id'))] || (page && page[0] !== null ? page : null)
    || (page && !page[1] ? [Number(column('search_price')), 0] : null);
  if (option && snapshotFresh(now)) {
    if (c === 'search_price' || c === 'store_price') return option[0].toFixed(2);
    if (c === 'in_stock') return String(option[1]);
    if (c === 'stock_quantity') return '';
  }
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

export function classify({ name, url = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SHOP_GONE.includes(handleOf(url).toLowerCase())) return { reject: 'page not on the shop any more (14 Nov 2026)' };
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
