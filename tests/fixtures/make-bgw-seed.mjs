// Builds tests/fixtures/bgw-seed.sql: synthetic Biker Gear World products (fictional brands) for local runs and CI.
// Real Awin product data never goes into this public repo.
// It covers: all 10 categories, a retailer that sells in euros ("≈ £"), the same product at two retailers
// (same EAN: one card, two prices), out-of-stock rows and invalid EANs (lessons L12).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slugify } from '../../src/lib/text.js';

const here = dirname(fileURLToPath(import.meta.url));

const ICON_PATHS = {
  'helmets': '<path d="M40 130c0-50 30-80 70-80s50 30 50 60v20H40z"/><path d="M110 90h50"/>',
  'jackets-trousers': '<path d="M70 40l-30 20v100h40V90h40v70h40V60l-30-20-30 20z"/>',
  'boots-gloves': '<path d="M60 40h40v80l50 20v20H60z"/>',
  'parts-maintenance': '<circle cx="100" cy="100" r="40"/><circle cx="100" cy="100" r="12"/><path d="M100 40v-10M100 170v-10M40 100H30M170 100h-10"/>',
  'luggage-security': '<rect x="50" y="70" width="100" height="80" rx="10"/><path d="M80 70V50h40v20"/>',
  'electronics': '<rect x="70" y="40" width="60" height="110" rx="10"/><circle cx="100" cy="135" r="6"/>',
  'electric-scooters': '<circle cx="50" cy="150" r="16"/><circle cx="150" cy="150" r="16"/><path d="M50 150h100M130 150l-20-100h-20M110 50l10 4"/><path d="M80 120l10-20h10"/>',
  'kick-scooters': '<circle cx="50" cy="150" r="16"/><circle cx="150" cy="150" r="16"/><path d="M50 150h100M130 150l-20-100h-20"/>',
  'electric-motorbikes': '<circle cx="50" cy="140" r="24"/><circle cx="150" cy="140" r="24"/><path d="M50 140l40-40h40l20 40M120 100l10-30h20"/>',
  'protection': '<path d="M100 40l50 20v40c0 30-20 50-50 60-30-10-50-30-50-60V60z"/>'
};
function image(cat) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#7a8592" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[cat]}</g></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

const BRANDS = ['Ridgeway', 'Torvale', 'Kestrel Moto', 'Ambrose', 'Northfield', 'Velcora', 'Brackwell'];
// [advertiser id, retailer, currency]
const RETAILERS = [[90401, 'Example Moto Shop', 'GBP'], [90402, 'Sample Rider Store', 'GBP'], [90403, 'Euro Moto Example', 'EUR']];
const MODELS = {
  'helmets': ['Full Face Motorbike Helmet', 'Flip Front Helmet', 'Open Face Scooter Helmet', 'Pinlock Insert'],
  'jackets-trousers': ['Textile Motorbike Jacket', 'Leather Motorbike Jacket', 'Armoured Riding Jeans', 'Waterproof Over Trousers'],
  'boots-gloves': ['Touring Motorbike Boots', 'Summer Riding Gloves', 'Winter Motorbike Gloves', 'Handlebar Muffs'],
  'parts-maintenance': ['Rear Paddock Stand', 'Chain Lube 400ml', 'Motorbike Battery Charger', 'Motorcycle Scissor Lift'],
  'luggage-security': ['Top Box 45L', 'Disc Lock with Alarm', 'Tank Bag 15L', 'Waterproof Motorbike Cover'],
  'electronics': ['Helmet Intercom Pair', 'Motorbike Phone Mount', 'Helmet Camera 4K', 'USB Charger for Handlebars'],
  'electric-scooters': ['Folding Electric Scooter 25km', 'Electric Scooter 10 inch Tyre', 'Electric Scooter Charger', 'Electric Scooter Bag'],
  'kick-scooters': ['Folding Kick Scooter Adult', 'Stunt Scooter', 'Three Wheel Scooter for Children', 'Scooter Wheels 110mm'],
  'electric-motorbikes': ['Electric Moped 45km/h', 'Electric Motorbike 3000W', '125cc Scooter Moped', 'Electric Pit Bike'],
  'protection': ['Level 2 Back Protector', 'Chest Protector', 'Airbag Vest', 'Hi-Vis Motorbike Vest']
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
    specs_json: JSON.stringify({ Warranty: '2 years' }),
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
// The same paddock stand (same EAN) at two retailers: one card with "2 retailers" and a price table on its page.
add({ cat: 'parts-maintenance', model: 'Front Paddock Stand', brand: 'Ridgeway', retailer: RETAILERS[0], price: 54.99, gtin: ean13('506099999997') });
add({ cat: 'parts-maintenance', model: 'Front Paddock Stand', brand: 'Ridgeway', retailer: RETAILERS[1], price: 49.5, gtin: ean13('506099999997') });

const cols = Object.keys(rows[0]);
const sql = ['-- Generated by tests/fixtures/make-bgw-seed.mjs. Synthetic data only.']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .join('\n') + '\n';
writeFileSync(join(here, 'bgw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
