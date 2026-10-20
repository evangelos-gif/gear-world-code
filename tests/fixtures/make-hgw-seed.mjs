// Builds tests/fixtures/hgw-seed.sql: synthetic products in the OLDER Gear World database layout
// (tests/fixtures/ggw-legacy-schema.sql), shaped like Home Gear World's real data: category names
// instead of slugs, stock as text ("in stock"), Awin product images at 200 px, InStock options as separate rows.
// Brands and products are fictional. Real Awin product data never goes into this public repo.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const ICON = '<path d="M60 150l40-90 40 90"/><circle cx="100" cy="60" r="14"/><path d="M40 160h120"/>';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#c9952f" stroke-width="6" stroke-linecap="round">${ICON}</g></svg>`;
const IMAGE = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const BRANDS = ['Oakhollow', 'Linen & Lane', 'Brightnest', 'Copperleaf', 'Hearthly', 'Northbeam'];
const RETAILERS = ['InStock UK', 'Joybuy UK', 'Back to the Office'];
// Category names exactly as the import router writes them. All 10 have products, like the real site.
const MODELS = {
  'Furniture': ['Velvet Accent Chair', 'Oak Coffee Table', 'Three Seater Sofa', 'Bedside Table'],
  'Kitchen & Dining': ['Non-Stick Frying Pan 28cm', 'Stoneware Dinner Set 12 Piece', 'Knife Block Set'],
  'Home Appliances': ['Digital Air Fryer 5L', 'Cordless Stick Vacuum', 'Glass Kettle 1.7L'],
  'Bedding & Bath': ['Cotton Duvet Cover Set', 'Egyptian Cotton Towel Bale', 'Memory Foam Pillow 2 Pack'],
  'Home Decor': ['Round Wall Mirror', 'Velvet Cushion Cover', 'Ceramic Vase Set'],
  'Lighting': ['Arc Floor Lamp', 'LED Strip Lights 5m', 'Rattan Pendant Shade'],
  'Storage & Organisation': ['Woven Storage Basket', 'Shoe Rack 4 Tier'],
  'Cleaning & Laundry': ['Spin Mop and Bucket', 'Heated Clothes Airer'],
  'Smart Home': ['Smart Plug 4 Pack', 'Video Doorbell'],
  'Home Office': ['Ergonomic Office Chair', 'Standing Desk Frame']
};
// Unique, valid EAN-13 per product (some empty or invalid on purpose, lessons L12). Products with the
// same EAN are the same product at different retailers (grouped into one card, site.groupOffers).
function ean(n) {
  if (n % 7 === 0) return '';
  if (n % 11 === 0) return `123${n}`;
  const body = `51${String(n).padStart(10, '0')}`;
  const sum = [...body].reduce((t, d, i) => t + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
}
const SIZES = ['Single', 'Double', 'King'];

function sq(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

const rows = [];
let n = 0;
for (const [cat, models] of Object.entries(MODELS)) {
  // InStock sends one row per size, like the real feed: "<name> - <size> / <colour>".
  const variants = cat === 'Bedding & Bath' ? 3 : 2;
  for (let i = 0; i < models.length; i++) {
    for (let v = 0; v < variants; v++) {
      n++;
      const brand = BRANDS[(n + v) % BRANDS.length];
      const retailer = RETAILERS[(n + i) % RETAILERS.length];
      const price = Math.round((4 + ((n * 37) % 160)) * (1 + v * 0.05) * 100) / 100 - 0.01;
      const base = `${brand} ${models[i]}`;
      const name = retailer === 'InStock UK' && variants === 3 ? `${base} - ${SIZES[v]} / Navy` : `${base}${v ? ` (${['Red', 'Blue', 'Green'][v]})` : ''}`;
      const sku = `HGW-T-${n}`;
      rows.push({
        awin_product_id: String(880000 + n),
        merchant_product_id: sku,
        retailer,
        site_category: cat,
        subcategory: models[i].split(' ').slice(-1)[0],
        brand,
        product_name: name,
        feed_product_name: name,
        price,
        currency: 'GBP',
        stock_status: n % 9 === 0 ? 'out of stock' : (retailer === 'Joybuy UK' ? '1' : 'in stock'),
        merchant_category: `Home > ${cat}`,
        image_url: IMAGE,
        affiliate_url: `https://www.awin1.com/cread.php?awinmid=800${n % 9}&awinaffid=3057233&ued=${encodeURIComponent(`https://shop.example/${sku.toLowerCase()}`)}`,
        ean: ean(n),
        is_active: 1,
        created_at: `2026-10-${String(1 + (n % 17)).padStart(2, '0')} 10:00:00`,
        updated_at: '2026-10-18 06:00:00',
        specs_json: JSON.stringify({
          product_short_description: `${name}. Test product used for automated checks. It is not a real offer.`,
          mpn: `MPN-${n}`,
          gtin: ean(n),
          rrp_price: Math.round(price * 1.3 * 100) / 100
        }),
        // The old site stored a slug cut at 100 characters; the address is built from the name, as before.
        product_slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)
      });
    }
  }
}
// Edge cases the adapter must handle (lessons L28):
const extra = (o) => rows.push({ ...rows[0], ean: ean(900 + rows.length), ...o, awin_product_id: String(890000 + rows.length), merchant_product_id: `HGW-X-${rows.length}` });
// Text saved twice as UTF-8 by the feed ("Homeâ€™s ... â€“ 2 Pack").
extra({ product_name: 'Hearthly Bakerâ€™s Oven Gloves â€“ 2 Pack', site_category: 'Kitchen & Dining', ean: '5100000009998' });
// The same appliance from two shops: one card, "2 retailers".
extra({ product_name: 'Brightnest Compact Dehumidifier 10L', site_category: 'Home Appliances', retailer: 'Joybuy UK', ean: '5100000009981', price: 119.99, stock_status: '1' });
extra({ product_name: 'Brightnest Compact Dehumidifier 10L', site_category: 'Home Appliances', retailer: 'InStock UK', ean: '5100000009981', price: 124.49 });
// A very long name: the old address has no length limit, and it must keep working.
extra({ product_name: 'Oakhollow Solid Wood Extendable Dining Table with Four Upholstered Chairs - Seats 4 to 6 - Natural Oak Finish - Easy Assembly', site_category: 'Furniture' });
extra({ product_name: 'Copperleaf Retired Table Lamp', site_category: 'Lighting', is_active: 0 });
const cols = Object.keys(rows[0]);
const sql = ['-- Generated by tests/fixtures/make-hgw-seed.mjs. Synthetic data only, older database layout.']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .join('\n') + '\n';
writeFileSync(join(here, 'hgw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
