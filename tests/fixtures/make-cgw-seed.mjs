// Builds tests/fixtures/cgw-seed.sql: synthetic products in the OLDER Gear World database layout
// (tests/fixtures/ggw-legacy-schema.sql), shaped like Construction Gear World's real data: category names
// instead of slugs, stock as text, two retailers in euros (Reidl from Germany without EAN, VEVOR NL), and the
// import's own matches of the same product at two retailers (product_groups / product_group_offers).
// Brands and products are fictional. Real Awin product data never goes into this public repo.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const ICON = '<path d="M50 120h70l20-30h20v50H50z"/><path d="M70 140v20"/>';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#a07800" stroke-width="6" stroke-linecap="round">${ICON}</g></svg>`;
const IMAGE = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const BRANDS = ['Ironvale', 'Siteforge', 'Brickman', 'Torqmaster', 'Hivo', 'Steelcap'];
const RETAILERS = ['Tooled Up', 'My Tool Shed', 'Reidl', 'Vevor NL'];
const EURO = new Set(['Reidl', 'Vevor NL']);
// Category names exactly as the import router writes them. All 10 have products, like the real site.
const MODELS = {
  'Power Tools': ['18V Combi Drill', 'Impact Driver Kit', 'Angle Grinder 115mm', 'Circular Saw 190mm', 'Petrol Generator 3kVA'],
  'Hand Tools': ['Socket Set 94 Piece', 'Claw Hammer 20oz', 'Spirit Level 1200mm', 'Combination Spanner Set', 'Tape Measure 8m'],
  'Workwear': ['Hi Vis Jacket Class 3', 'Work Trousers Holster', 'Softshell Jacket', 'Work Gloves 12 Pack'],
  'Safety Boots': ['S3 Safety Boot', 'Rigger Boot', 'Safety Trainer'],
  'PPE': ['Hard Hat', 'Safety Glasses', 'Ear Defenders', 'FFP3 Mask 10 Pack'],
  'Site Equipment': ['Aluminium Ladder 3m', 'LED Work Light', 'Wheelbarrow 100L'],
  'Garden Tools': ['Hedge Trimmer']
};
// Unique, valid EAN-13 per product (some empty or invalid on purpose, lessons L12). Products with the
// same EAN are the same product at different retailers (grouped into one card, site.groupOffers).
function ean(n) {
  if (n % 7 === 0) return '';
  if (n % 11 === 0) return `123${n}`;
  const body = `52${String(n).padStart(10, '0')}`;
  const sum = [...body].reduce((t, d, i) => t + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
}

function sq(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

const rows = [];
let n = 0;
for (const [cat, models] of Object.entries(MODELS)) {
  for (let i = 0; i < models.length; i++) {
    for (let v = 0; v < 2; v++) {
      n++;
      const brand = BRANDS[(n + v) % BRANDS.length];
      const retailer = RETAILERS[(n + i + v) % RETAILERS.length];
      const price = Math.round((6 + ((n * 37) % 380)) * (1 + v * 0.05) * 100) / 100 - 0.01;
      const name = `${brand} ${models[i]}${v ? ' (Pack of 2)' : ''}`;
      const sku = `CGW-T-${n}`;
      rows.push({
        awin_product_id: String(660000 + n),
        merchant_product_id: sku,
        retailer,
        site_category: cat,
        subcategory: models[i].split(' ').slice(-1)[0],
        brand,
        product_name: name,
        feed_product_name: name,
        price,
        currency: EURO.has(retailer) ? 'EUR' : 'GBP',
        stock_status: n % 9 === 0 ? 'Out of Stock' : (EURO.has(retailer) ? '1' : (n % 2 ? 'In Stock' : 'Available to Order')),
        merchant_category: `Trade > ${cat}`,
        image_url: IMAGE,
        affiliate_url: `https://www.awin1.com/cread.php?awinmid=700${n % 9}&awinaffid=3057233&ued=${encodeURIComponent(`https://shop.example/${sku.toLowerCase()}`)}`,
        // Reidl's feed has no EAN.
        ean: retailer === 'Reidl' ? '' : ean(n),
        is_active: cat === 'Garden Tools' ? 0 : 1,
        created_at: `2026-10-${String(1 + (n % 17)).padStart(2, '0')} 10:00:00`,
        updated_at: '2026-10-18 06:00:00',
        specs_json: JSON.stringify({
          product_short_description: `${name}. Test product used for automated checks. It is not a real offer.`,
          mpn: `MPN-${n}`,
          gtin: retailer === 'Reidl' ? '' : ean(n)
        }),
        product_slug: null
      });
    }
  }
}
// Edge cases the adapter must handle (lessons L28):
const extra = (o) => {
  const r = { ...rows[0], ean: ean(900 + rows.length), ...o, awin_product_id: String(690000 + rows.length), merchant_product_id: `CGW-X-${rows.length}` };
  r.feed_product_name = r.product_name;
  r.specs_json = JSON.stringify({ product_short_description: `${r.product_name}. Test product used for automated checks. It is not a real offer.`, gtin: r.ean });
  rows.push(r);
};
// The same hi-vis jacket at two UK retailers, matched by the import (one has no EAN): one card, "2 retailers".
extra({ product_name: 'Ironvale Hi Vis Jacket Orange L', site_category: 'Workwear', retailer: 'Tooled Up', price: 42.95, ean: '5200000009993', stock_status: 'Available to Order' });
extra({ product_name: 'Ironvale Hi Vis Jacket', site_category: 'Workwear', retailer: 'My Tool Shed', price: 41.5, ean: '', stock_status: 'In Stock' });
// A German retailer in euros (flag and "≈ £" on the page).
extra({ product_name: 'Torqmaster Diamond Core Drill Bit 52mm', site_category: 'Power Tools', retailer: 'Reidl', currency: 'EUR', price: 89.9, ean: '', stock_status: '1' });
extra({ product_name: 'Hivo Retired Drill', site_category: 'Power Tools', is_active: 0 });
const cols = Object.keys(rows[0]);
const n0 = rows.length;
const sql = ['-- Generated by tests/fixtures/make-cgw-seed.mjs. Synthetic data only, older database layout.',
  // CGW's own match tables (the import writes them; the engine only reads product_group_offers).
  'CREATE TABLE IF NOT EXISTS product_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, identity_type TEXT NOT NULL, identity_key TEXT NOT NULL UNIQUE, canonical_name TEXT NOT NULL, canonical_slug TEXT NOT NULL, brand TEXT, site_category TEXT);',
  'CREATE TABLE IF NOT EXISTS product_group_offers (group_id INTEGER NOT NULL, product_id INTEGER NOT NULL UNIQUE, PRIMARY KEY (group_id, product_id));']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .concat([
    "INSERT INTO product_groups (id, identity_type, identity_key, canonical_name, canonical_slug, brand, site_category) VALUES (1, 'brand_merchant', 'ironvale|hivis-l', 'Ironvale Hi Vis Jacket - Orange, L', 'ironvale-hi-vis-jacket-orange-l', 'Ironvale', 'Workwear');",
    `INSERT INTO product_group_offers (group_id, product_id) VALUES (1, ${n0 - 3}), (1, ${n0 - 2});`
  ])
  .join('\n') + '\n';
writeFileSync(join(here, 'cgw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
