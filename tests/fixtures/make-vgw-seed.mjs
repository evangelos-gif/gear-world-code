// Builds tests/fixtures/vgw-seed.sql: synthetic Travel Gear World products (fictional brands) for local runs and CI.
// Real Awin product data never goes into this public repo.
// It covers: all 8 categories, a retailer that sells in euros (VEVOR, NL flag and "≈ £"), the same product
// at two retailers (same EAN: one card, two prices), out-of-stock rows and invalid EANs (lessons L12).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slugify } from '../../src/lib/text.js';

const here = dirname(fileURLToPath(import.meta.url));

const ICON_PATHS = {
  'luggage-suitcases': '<rect x="50" y="60" width="100" height="100" rx="12"/><path d="M80 60V44h40v16M80 80v60M120 80v60"/>',
  'travel-bags-backpacks': '<path d="M60 70h80v90H60z"/><path d="M80 70c0-24 40-24 40 0M60 110h80"/>',
  'travel-accessories': '<rect x="40" y="70" width="70" height="60" rx="8"/><rect x="100" y="90" width="60" height="60" rx="8"/>',
  'comfort-sleep': '<path d="M50 100c0-40 100-40 100 0s-30 30-50 10c-20 20-50 30-50-10z"/>',
  'documents-security': '<rect x="60" y="40" width="80" height="120" rx="8"/><circle cx="100" cy="90" r="20"/>',
  'travel-tech': '<rect x="60" y="50" width="80" height="100" rx="10"/><path d="M85 150v20M115 150v20"/>',
  'camping-outdoor': '<path d="M30 160L100 50l70 110z"/><path d="M100 50v110"/>',
  'beach-holiday': '<path d="M100 40c-40 0-60 30-60 40h120c0-10-20-40-60-40zM100 80v80"/>'
};
function image(cat) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#7a8592" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[cat]}</g></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

const BRANDS = ['Wayfarra', 'Northbay', 'Velaro', 'Kestrel Trail', 'Ambrose', 'Solenne', 'Driftwell'];
// [advertiser id, retailer, currency]
const RETAILERS = [[90201, 'Example Luggage Shop', 'GBP'], [90202, 'Sample Outdoor Store', 'GBP'], [90203, 'VEVOR', 'EUR']];
const MODELS = {
  'luggage-suitcases': ['Hard Shell Cabin Case 55cm', 'Large Spinner Suitcase 75cm', 'Luggage Set of 3', 'Underseat Cabin Bag 40x20x25'],
  'travel-bags-backpacks': ['Travel Backpack 40L', 'Duffel Bag 60L', 'Weekend Holdall', 'Packable Daypack 20L'],
  'travel-accessories': ['Packing Cubes Set of 6', 'Hanging Toiletry Bag', 'Digital Luggage Scale', 'Travel Bottles Set'],
  'comfort-sleep': ['Memory Foam Neck Pillow', 'Contoured Sleep Mask', 'Flight Socks Pair', 'Travel Blanket'],
  'documents-security': ['RFID Passport Holder', 'TSA Combination Lock', 'Hidden Money Belt', 'Travel Document Wallet'],
  'travel-tech': ['Universal Travel Adapter', 'Power Bank 20000mAh', 'Travel Charger 3 Port', 'Noise Cancelling Headphones'],
  'camping-outdoor': ['2 Person Dome Tent', 'Sleeping Bag 3 Season', 'Camping Stove', 'Rechargeable Head Torch'],
  'beach-holiday': ['Beach Shelter UV50', 'Quick Dry Beach Towel', 'Snorkel Set', 'Waterproof Phone Pouch']
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
// The same cabin case (same EAN) at two retailers: one card with "2 retailers" and a price table on its page.
add({ cat: 'luggage-suitcases', model: 'Lightweight Cabin Trolley 55cm', brand: 'Wayfarra', retailer: RETAILERS[0], price: 89.99, gtin: ean13('506099999998') });
add({ cat: 'luggage-suitcases', model: 'Lightweight Cabin Trolley 55cm', brand: 'Wayfarra', retailer: RETAILERS[1], price: 84.5, gtin: ean13('506099999998') });

const cols = Object.keys(rows[0]);
const sql = ['-- Generated by tests/fixtures/make-vgw-seed.mjs. Synthetic data only.']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .join('\n') + '\n';
writeFileSync(join(here, 'vgw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
