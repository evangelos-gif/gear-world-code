// Builds tests/fixtures/zgw-seed.sql: synthetic Pets Gear World products (fictional brands) for local runs and CI.
// Real Awin product data never goes into this public repo.
// It covers: all 11 categories, a retailer that sells in euros ("≈ £"), the same product at two retailers
// (same EAN: one card, two prices), out-of-stock rows and invalid EANs (lessons L12).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slugify } from '../../src/lib/text.js';

const here = dirname(fileURLToPath(import.meta.url));

const ICON_PATHS = {
  'beds-crates': '<path d="M35 120c0-25 20-35 65-35s65 10 65 35v20H35z"/><path d="M50 120h100"/>',
  'walking': '<circle cx="100" cy="70" r="28"/><path d="M100 98v20M80 160c10-25 30-40 50-40"/>',
  'toys': '<circle cx="100" cy="100" r="40"/><path d="M65 85c25 10 45 10 70 0M65 115c25-10 45-10 70 0"/>',
  'food': '<path d="M45 105h110l-12 40H57z"/><path d="M70 95l8-12M100 95v-15M128 95l-8-12"/>',
  'cats': '<path d="M90 40h20v120H90zM60 70h80M60 120h80M80 160h40"/>',
  'grooming': '<rect x="45" y="80" width="110" height="30" rx="10"/><path d="M60 110v25M80 110v25M100 110v25M120 110v25M140 110v25"/>',
  'feeding': '<ellipse cx="100" cy="120" rx="60" ry="22"/><path d="M40 120v12c0 12 27 22 60 22s60-10 60-22v-12"/>',
  'travel': '<rect x="45" y="65" width="110" height="80" rx="12"/><path d="M80 65V50h40v15M65 90h70M65 110h70"/>',
  'small-pets': '<path d="M40 150V70l60-30 60 30v80z"/><path d="M75 150v-40h50v40"/>',
  'birds': '<path d="M60 120c0-35 25-60 55-60 20 0 30 15 30 30l20 5-20 10c0 30-25 50-55 50-15 0-30-10-30-35z"/><circle cx="120" cy="85" r="4"/>',
  'horse': '<path d="M55 150c0-40 15-80 55-90l20-15 5 25c15 15 20 35 15 50l-20-5-10 35z"/>'
};
function image(cat) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#7a8592" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[cat]}</g></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

const BRANDS = ['Barkwell', 'Pawsome', 'Furrow', 'Whiskerly', 'Tailwind', 'Snoutly', 'Meadowpet'];
// [advertiser id, retailer, currency]
const RETAILERS = [[90601, 'Example Pet Shop', 'GBP'], [90602, 'Sample Pet Store', 'GBP'], [90603, 'Euro Pets Example', 'EUR']];
const MODELS = {
  'beds-crates': ['Calming Dog Bed Medium', 'Orthopaedic Dog Bed Large', 'Folding Dog Crate 36 inch', 'Pet Playpen 8 Panels'],
  'walking': ['Retractable Dog Lead 5m', 'No Pull Dog Harness', 'Reflective Dog Collar', 'Waterproof Dog Coat'],
  'toys': ['Squeaky Dog Toy', 'Rope Tug Toy for Dogs', 'Cat Teaser Wand', 'Dog Ball Launcher'],
  'food': ['Adult Dry Dog Food 12kg', 'Wet Cat Food Pouches 12 x 85g', 'Dental Chews for Dogs', 'Cat Treats Chicken 60g'],
  'cats': ['Cat Tree with Hammock', 'Sisal Scratching Post', 'Clumping Cat Litter 10L', 'Covered Cat Litter Tray'],
  'grooming': ['Dog Shampoo 500ml', 'Deshedding Brush for Dogs', 'Pet Nail Clippers', 'Pet Grooming Gloves'],
  'feeding': ['Stainless Steel Dog Bowl', 'Slow Feeder Dog Bowl', 'Automatic Cat Feeder', 'Pet Water Fountain 2L'],
  'travel': ['Pet Carrier Backpack', 'Dog Car Seat Cover', 'Soft Cat Carrier', 'Folding Dog Ramp'],
  'small-pets': ['Rabbit Hutch with Run', 'Guinea Pig Cage', 'Hamster Wheel Silent', 'Aquarium 60L Starter Kit'],
  'birds': ['Wooden Chicken Coop', 'Canary Breeding Cage', 'Budgie Rope Perch', 'Bird Cage with Stand'],
  'horse': ['Horse Fly Mask', 'Equestrian Saddle Pad', 'Horse Grooming Kit', 'Horse Treats Apple 1kg']
};
// Birds: the subcategory per kind of bird, as category-rules.js writes it (the Birds page filters on it).
const SUBS = { 'Wooden Chicken Coop': 'Chickens & Poultry', 'Canary Breeding Cage': 'Canaries & Finches', 'Budgie Rope Perch': 'Budgies & Parrots', 'Bird Cage with Stand': 'Other Cage Birds' };
// Every product its own EAN (the site groups offers by EAN): most valid, some missing, some invalid (lessons L12).
function ean13(body12) {
  const d = String(body12).split('').map(Number);
  const sum = d.reduce((t, x, i) => t + x * (i % 2 ? 3 : 1), 0);
  return String(body12) + ((10 - (sum % 10)) % 10);
}
const gtinFor = k => (k % 6 === 0 ? null : k % 7 === 0 ? `9${k}` : ean13(String(506100000000 + k)));

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
    subcategory: SUBS[model] || model.split(' ').slice(-1)[0],
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
// The same dog bed (same EAN) at two retailers: one card with "2 retailers" and a price table on its page.
add({ cat: 'beds-crates', model: 'Cosy Donut Dog Bed', brand: 'Barkwell', retailer: RETAILERS[0], price: 29.99, gtin: ean13('506199999997') });
add({ cat: 'beds-crates', model: 'Cosy Donut Dog Bed', brand: 'Barkwell', retailer: RETAILERS[1], price: 24.5, gtin: ean13('506199999997') });

const cols = Object.keys(rows[0]);
const sql = ['-- Generated by tests/fixtures/make-zgw-seed.mjs. Synthetic data only.']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .join('\n') + '\n';
writeFileSync(join(here, 'zgw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
