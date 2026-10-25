// Builds tests/fixtures/sgw-seed.sql: synthetic Sporty Gear World products (fictional brands) for local runs and CI.
// Real Awin product data never goes into this public repo.
// It covers: all 10 categories, a retailer that sells in euros ("≈ £"), the same product at two retailers
// (same EAN: one card, two prices), out-of-stock rows and invalid EANs (lessons L12).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slugify } from '../../src/lib/text.js';

const here = dirname(fileURLToPath(import.meta.url));

const ICON_PATHS = {
  'fitness-gym': '<path d="M40 100h120"/><rect x="30" y="75" width="20" height="50" rx="4"/><rect x="150" y="75" width="20" height="50" rx="4"/>',
  'running': '<path d="M40 140c30 0 50-10 70-40l30 10c10 4 20 14 20 30H40z"/>',
  'cycling': '<circle cx="60" cy="130" r="30"/><circle cx="140" cy="130" r="30"/><path d="M60 130l30-50h30l20 50M90 80l20 50"/>',
  'football-team-sports': '<circle cx="100" cy="100" r="55"/><path d="M100 70l25 18-10 30H85l-10-30z"/>',
  'racket-sports': '<ellipse cx="90" cy="80" rx="40" ry="50"/><path d="M110 120l40 50"/><circle cx="150" cy="70" r="12"/>',
  'water-sports': '<path d="M30 120c20-10 40 10 60 0s40-10 60 0 20 10 20 10"/><path d="M60 110l80-60"/>',
  'hiking-climbing-winter': '<path d="M30 160l50-90 30 40 20-30 40 80z"/>',
  'nutrition-hydration': '<rect x="70" y="50" width="60" height="110" rx="12"/><path d="M80 50V36h40v14"/>',
  'sportswear-shoes-bags': '<path d="M40 140h120c0-20-20-30-50-30l-20-30H50z"/>',
  'golf-skate-more': '<circle cx="80" cy="140" r="14"/><path d="M120 40v100l30-10"/>'
};
function image(cat) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#7a8592" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[cat]}</g></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

const BRANDS = ['Strideon', 'Peakora', 'Velomax', 'Kestrel Sport', 'Ambrose', 'Tidewell', 'Northfield'];
// [advertiser id, retailer, currency]
const RETAILERS = [[90301, 'Example Sports Shop', 'GBP'], [90302, 'Sample Fitness Store', 'GBP'], [90303, 'Euro Sport Example', 'EUR']];
const MODELS = {
  'fitness-gym': ['Adjustable Dumbbell Set 20kg', 'Cast Iron Kettlebell 12kg', 'Folding Weight Bench', 'Non Slip Yoga Mat 6mm'],
  'running': ['Road Running Shoes', 'Hydration Vest 5L', 'Running Belt', 'Reflective Running Jacket'],
  'cycling': ['Hybrid Bike 54cm', 'Cycling Helmet', 'USB Bike Light Set', 'Track Pump'],
  'football-team-sports': ['Size 5 Training Football', 'Firm Ground Football Boots', 'Pop Up Football Goal', 'Rugby Ball Size 5'],
  'racket-sports': ['Graphite Tennis Racket', 'Padel Racket Carbon', 'Badminton Set for 4', 'Table Tennis Bat'],
  'water-sports': ['Inflatable Stand Up Paddle Board', 'Sit On Top Kayak', 'Mens Wetsuit 3/2mm', 'Anti Fog Swimming Goggles'],
  'hiking-climbing-winter': ['Waterproof Walking Boots', 'Carbon Trekking Poles', 'Climbing Harness', 'Ski Goggles'],
  'nutrition-hydration': ['Whey Protein Powder 1kg', 'Creatine Monohydrate 300g', 'Electrolyte Tablets', 'Protein Shaker 700ml'],
  'sportswear-shoes-bags': ['Cross Training Shoes', 'High Support Sports Bra', 'Gym Leggings', 'Sports Holdall 50L'],
  'golf-skate-more': ['Golf Balls 12 Pack', 'Complete Skateboard 31 inch', 'Telescopic Fishing Rod', 'Bristle Dartboard']
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
// The same football (same EAN) at two retailers: one card with "2 retailers" and a price table on its page.
add({ cat: 'football-team-sports', model: 'Match Football Size 5', brand: 'Strideon', retailer: RETAILERS[0], price: 24.99, gtin: ean13('506099999997') });
add({ cat: 'football-team-sports', model: 'Match Football Size 5', brand: 'Strideon', retailer: RETAILERS[1], price: 22.5, gtin: ean13('506099999997') });

const cols = Object.keys(rows[0]);
const sql = ['-- Generated by tests/fixtures/make-sgw-seed.mjs. Synthetic data only.']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .join('\n') + '\n';
writeFileSync(join(here, 'sgw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
