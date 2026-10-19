// Builds tests/fixtures/ggw-seed.sql: synthetic products in the OLDER Gear World database layout
// (tests/fixtures/ggw-legacy-schema.sql), shaped like Garden Gear World's real data: category names
// instead of slugs, stock as text, plain retailer addresses (no Awin), Awin product images at 200 px.
// Brands and products are fictional. Real Awin product data never goes into this public repo.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const ICON = '<path d="M60 150l60-90M110 60l30-20 10 30-20 10"/><path d="M40 160h120"/>';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#6f8a74" stroke-width="6" stroke-linecap="round">${ICON}</g></svg>`;
const IMAGE = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const BRANDS = ['Fernly', 'Greenhaw', 'Thornbury', 'Bramblecote', 'Willowmere', 'Oakvale'];
const RETAILERS = ['Tooled Up', 'My Tool Shed'];
// Category names exactly as the import router writes them. Only 4 of the 8 have products, like the real site.
const MODELS = {
  'Power Garden Tools': ['Cordless Lawn Mower 37cm', 'Cordless Grass Trimmer 18V', 'Hedge Trimmer 55cm', 'Leaf Blower 36V',
    'Petrol Lawn Mower 46cm', 'Electric Chainsaw 35cm', 'Pressure Washer 130 bar', 'Lawn Scarifier 32cm', 'Brushcutter 25cc', 'Robot Lawn Mower'],
  'Garden Tools': ['Stainless Digging Spade', 'Border Fork', 'Bypass Secateurs', 'Telescopic Loppers', 'Leaf Rake', 'Dutch Hoe'],
  'Watering & Irrigation': ['Garden Hose 30m', 'Hose Reel Cart', 'Oscillating Sprinkler', 'Watering Can 10L'],
  'Plants, Growing & Garden Care': ['Peat-free Compost 50L', 'Lawn Feed 5kg', 'Raised Planter 1.2m']
};
// Unique, valid EAN-13 per product (some empty or invalid on purpose, lessons L12). Products with the
// same EAN are the same product at different retailers (grouped into one card, site.groupOffers).
function ean(n) {
  if (n % 7 === 0) return '';
  if (n % 11 === 0) return `123${n}`;
  const body = `50${String(n).padStart(10, '0')}`;
  const sum = [...body].reduce((t, d, i) => t + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
}
const STOCK = ['in_stock', 'in_stock', 'In Stock', 'in_stock', 'out_of_stock', 'available to order'];

function sq(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

const rows = [];
let n = 0;
for (const [cat, models] of Object.entries(MODELS)) {
  const variants = cat === 'Power Garden Tools' ? 3 : 2;
  for (let i = 0; i < models.length; i++) {
    for (let v = 0; v < variants; v++) {
      n++;
      const brand = BRANDS[(n + v) % BRANDS.length];
      const retailer = RETAILERS[(n + i) % RETAILERS.length];
      const price = Math.round((8 + ((n * 41) % 420)) * (1 + v * 0.06) * 100) / 100 - 0.01;
      const name = `${brand} ${models[i]}${v ? ` (${['Green', 'Grey', 'Kit'][v]})` : ''}`;
      const sku = `GGW-T-${n}`;
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
        stock_status: STOCK[n % STOCK.length],
        merchant_category: `Garden > ${cat}`,
        image_url: IMAGE,
        affiliate_url: `https://shop.example/${retailer.toLowerCase().replace(/\s+/g, '-')}/${sku.toLowerCase()}`,
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
        product_slug: null
      });
    }
  }
}
// Edge cases the adapter must handle (lessons L28):
const extra = (o) => rows.push({ ...rows[0], ean: ean(900 + rows.length), ...o, awin_product_id: String(890000 + rows.length), merchant_product_id: `GGW-X-${rows.length}` });
extra({ product_name: 'Thornbury Pro: 4-Prong Fork & Spade Set (Ash Handle) — 2 pcs', site_category: 'Garden Tools', retailer: 'Tooled Up' });
extra({ product_name: 'Fernly Garden Kneeler Pad', site_category: 'Garden Tools', retailer: 'Example Garden Shop', affiliate_url: 'https://shop.example/garden-shop/kneeler' });
extra({ product_name: 'Oakvale Soil Test Kit', site_category: 'Plants, Growing & Garden Care', retailer: 'My Tool Shed', affiliate_url: 'https://www.awin1.com/pclick.php?p=890999&a=3057233&m=49385' });
extra({ product_name: 'Greenhaw Patio Weeder', site_category: 'Old Category Name', retailer: 'Tooled Up', stock_status: null });
extra({ product_name: 'Willowmere Retired Rake', site_category: 'Garden Tools', is_active: 0 });
// The same hose (same EAN) at the other retailer, cheaper: one card "2 retailers", a price table on its page.
const hose = rows.find(r => r.product_name.endsWith('Garden Hose 30m'));
extra({ ...hose, retailer: hose.retailer === 'Tooled Up' ? 'My Tool Shed' : 'Tooled Up', price: Math.round((hose.price - 3) * 100) / 100,
  affiliate_url: hose.affiliate_url.replace(/(tooled-up|my-tool-shed)/, 'other-shop') });

const cols = Object.keys(rows[0]);
const sql = ['-- Generated by tests/fixtures/make-ggw-seed.mjs. Synthetic data only, older database layout.']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .join('\n') + '\n';
writeFileSync(join(here, 'ggw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
