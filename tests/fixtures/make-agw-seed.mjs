// Builds tests/fixtures/agw-seed.sql: synthetic Car Gear World products (fictional brands) for local runs and CI.
// Real Awin product data never goes into this public repo.
// It covers: all 10 categories, a retailer that sells in euros (VEVOR, NL flag and "≈ £"), the same product
// at two retailers (same EAN: one card, two prices), out-of-stock rows and invalid EANs (lessons L12).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slugify } from '../../src/lib/text.js';

const here = dirname(fileURLToPath(import.meta.url));

const ICON_PATHS = {
  'garage-tools-equipment': '<path d="M40 150h120M60 150l20-60h40l20 60"/><path d="M80 90V60h40v30"/>',
  'diagnostics-battery': '<rect x="40" y="70" width="120" height="80" rx="8"/><path d="M60 70V56M140 70V56M70 110h20M120 100v20M110 110h20"/>',
  'parts-maintenance': '<circle cx="100" cy="100" r="46"/><circle cx="100" cy="100" r="16"/>',
  'tyres-wheels': '<circle cx="100" cy="100" r="60"/><circle cx="100" cy="100" r="26"/><path d="M100 40v34M100 126v34M40 100h34M126 100h34"/>',
  'car-care-detailing': '<path d="M80 40h40v20H80zM70 60h60l10 100H60z"/>',
  'car-electronics': '<rect x="40" y="60" width="120" height="80" rx="10"/><circle cx="100" cy="100" r="22"/>',
  'interior-comfort': '<path d="M70 40h40l10 70H80zM70 110h70v40H70z"/>',
  'roof-towing-exterior': '<path d="M30 130h140M50 130l20-40h60l20 40M60 80h80"/>',
  'ev-charging': '<rect x="60" y="40" width="70" height="120" rx="8"/><path d="M100 70l-14 30h28l-14 30"/>',
  'safety-winter': '<path d="M100 40l64 112H36z"/><path d="M100 90v28M100 132v4"/>'
};
function image(cat) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#7a8592" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[cat]}</g></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

const BRANDS = ['Torqline', 'Harrowgate', 'Veloxa', 'Dunmore', 'Ridgecraft', 'Pellow', 'Northmark'];
// [advertiser id, retailer, currency]
const RETAILERS = [[90101, 'Example Motor Parts', 'GBP'], [90102, 'Sample Garage Supplies', 'GBP'], [90103, 'VEVOR', 'EUR']];
const MODELS = {
  'garage-tools-equipment': ['3 Tonne Trolley Jack', 'Axle Stands Pair 2T', 'Mechanics Creeper', '1/2" Drive Socket Set 24pc'],
  'diagnostics-battery': ['OBD2 Code Reader', 'Battery Charger 12V 6A', 'Jump Starter 1000A', 'Battery Tester'],
  'parts-maintenance': ['Wiper Blade 600mm', 'H7 Headlight Bulb Twin Pack', 'Engine Oil 5W-30 5L', 'Tailgate Gas Strut'],
  'tyres-wheels': ['Digital Tyre Inflator', 'Tyre Pressure Gauge', 'Puncture Repair Kit', 'Locking Wheel Nuts'],
  'car-care-detailing': ['Car Shampoo 1L', 'Snow Foam 1L', 'Microfibre Drying Towel', 'Cordless Car Polisher'],
  'car-electronics': ['Dash Cam Front and Rear', 'Wireless CarPlay Screen 10.1"', 'Reversing Camera Kit', 'Car Phone Holder'],
  'interior-comfort': ['Front Seat Covers Pair', 'Rubber Car Mats Set', 'Boot Organiser', 'Handheld Car Vacuum'],
  'roof-towing-exterior': ['Roof Bars Aluminium', 'Roof Box 400L', 'Tow Ball 50mm', 'Bike Carrier 2 Bikes'],
  'ev-charging': ['Type 2 Charging Cable 5m', 'Portable EV Charger 3-pin', 'Home Wallbox 7kW', 'Charging Cable Bag'],
  'safety-winter': ['De-Icer Spray 500ml', 'Ice Scraper with Brush', 'Warning Triangle', 'Car Emergency Kit']
};
// Every product its own EAN (the site groups offers by EAN): most valid, some missing, some invalid (lessons L12).
function ean13(body12) {
  const d = String(body12).split('').map(Number);
  const sum = d.reduce((t, x, i) => t + x * (i % 2 ? 3 : 1), 0);
  return String(body12) + ((10 - (sum % 10)) % 10);
}
const gtinFor = k => (k % 6 === 0 ? null : k % 7 === 0 ? `9${k}` : ean13(String(506000000000 + k)));

function sq(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

const rows = [];
let n = 0;
function add({ cat, model, brand, retailer: [advId, retailer, currency], price, gtin, variant = '' }) {
  n++;
  const name = `${brand} ${model}${variant}`;
  const mpid = `SKU-${cat.slice(0, 3).toUpperCase()}-${n}`;
  rows.push({
    stable_key: `${advId}:${mpid}`,
    awin_advertiser_id: advId,
    awin_product_id: String(800000 + n),
    merchant_product_id: mpid,
    retailer,
    category_slug: cat,
    subcategory: model.split(' ').slice(-1)[0],
    brand,
    product_name: name,
    product_slug: slugify(name),
    description: `${name}. Test product used for automated checks. It is not a real offer.`,
    price,
    was_price: n % 4 === 0 ? Math.round(price * 1.25 * 100) / 100 : null,
    currency,
    in_stock: n % 9 === 0 ? 0 : 1,
    item_condition: 'new',
    image_url: image(cat),
    affiliate_url: `https://www.awin1.com/pclick.php?p=${800000 + n}&a=0&m=${advId}`,
    merchant_category: cat,
    gtin,
    mpn: `MPN${n}`,
    specs_json: JSON.stringify({ Warranty: '1 year' }),
    first_seen_at: `2026-10-${String(1 + (n % 17)).padStart(2, '0')} 10:00:00`,
    last_seen_at: '2026-10-20 06:00:00'
  });
}

let k = 0;
for (const [cat, models] of Object.entries(MODELS)) {
  for (let i = 0; i < models.length; i++) {
    for (let v = 0; v < 2; v++) {
      k++;
      const retailer = RETAILERS[(k + i) % RETAILERS.length];
      const base = 6 + ((k * 37) % 300);
      const price = Math.round(base * (1 + v * 0.08) * 100) / 100 - 0.01;
      add({ cat, model: models[i], brand: BRANDS[(k + v) % BRANDS.length], retailer, price, gtin: gtinFor(k), variant: v ? ' (Pro)' : '' });
    }
  }
}
// The same jack (same EAN) at two retailers: one card with "2 retailers" and a price table on its page.
add({ cat: 'garage-tools-equipment', model: 'Low Profile Trolley Jack 2.5T', brand: 'Torqline', retailer: RETAILERS[0], price: 89.99, gtin: ean13('506099999999') });
add({ cat: 'garage-tools-equipment', model: 'Low Profile Trolley Jack 2.5T', brand: 'Torqline', retailer: RETAILERS[1], price: 84.5, gtin: ean13('506099999999') });

const cols = Object.keys(rows[0]);
const sql = ['-- Generated by tests/fixtures/make-agw-seed.mjs. Synthetic data only.']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .join('\n') + '\n';
writeFileSync(join(here, 'agw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
