// Builds tests/fixtures/wgw-seed.sql: synthetic products in the OLDER Gear World database layout
// (tests/fixtures/ggw-legacy-schema.sql), shaped like Women's Gear World's real data: category names
// instead of slugs, stock as text, plain retailer addresses (no Awin), Awin product images at 200 px.
// Brands and products are fictional. Real Awin product data never goes into this public repo.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const ICON = '<path d="M60 150l60-90M110 60l30-20 10 30-20 10"/><path d="M40 160h120"/>';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#6f8a74" stroke-width="6" stroke-linecap="round">${ICON}</g></svg>`;
const IMAGE = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const BRANDS = ['Elara', 'Rosewell', 'Maison Lune', 'Ivy & Fern', 'Solene', 'Marlowe'];
const RETAILERS = ['InStock UK', 'Philip Jones Jewellery', 'Joybuy UK'];
// Category names exactly as the import router writes them. Only 4 of the 8 have products, like the real site.
const MODELS = {
  'Clothing': ['Ribbed Knit Jumper', 'Wrap Midi Dress', 'High Rise Jeans', 'Linen Shirt', 'Quilted Jacket', 'Thermal Socks 3 Pack', 'Satin Blouse', 'Wide Leg Trousers', 'Cardigan', 'Rain Mac'],
  'Watches': ['Rose Gold Dress Watch 32mm', 'Leather Strap Watch 36mm', 'Smartwatch 41mm'],
  'Jewellery & Watches': ['Silver Mesh Watch 30mm'],
  "Women's Jewellery": ['Heart Pendant Necklace', 'Crystal Tennis Bracelet', 'Pearl Drop Earrings', 'Stacking Ring Set'],
  'Shoes': ['Ankle Boots', 'Canvas Trainers'],
  'Bags & Accessories': ['Leather Tote Bag', 'Cat Eye Sunglasses'],
  'Bags': ['Canvas Shopper Bag'],
  'Beauty & Fragrances': ['Eau de Parfum 50ml', 'Perfume Oil Roll-On'],
  'Everyday Carry / EDC': ['Mini LED Torch']
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
  const variants = cat === 'Clothing' ? 3 : 2;
  for (let i = 0; i < models.length; i++) {
    for (let v = 0; v < variants; v++) {
      n++;
      const brand = BRANDS[(n + v) % BRANDS.length];
      const retailer = RETAILERS[(n + i) % RETAILERS.length];
      const price = Math.round((8 + ((n * 41) % 420)) * (1 + v * 0.06) * 100) / 100 - 0.01;
      const name = `${brand} ${models[i]}${v ? ` (${['Black', 'Blush', 'Cream'][v]})` : ''}`;
      const sku = `WGW-T-${n}`;
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
        stock_status: retailer === 'Philip Jones Jewellery' ? '1' : STOCK[n % STOCK.length],
        merchant_category: `Women > ${cat}`,
        image_url: IMAGE,
        affiliate_url: `https://www.awin1.com/cread.php?awinmid=900${n % 9}&awinaffid=3057233&ued=${encodeURIComponent(`https://shop.example/${sku.toLowerCase()}`)}`,
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
const extra = (o) => rows.push({ ...rows[0], ean: ean(900 + rows.length), ...o, awin_product_id: String(890000 + rows.length), merchant_product_id: `WGW-X-${rows.length}` });
// Text saved twice as UTF-8 by the feed ("Menâ€™s ... â€“ 44mm").
extra({ product_name: 'Solene Classic Men\u00e2\u20ac\u2122s Watch \u00e2\u20ac\u201c 32mm Pearl Dial', site_category: 'Watches', retailer: 'Watch Enclave Affiliate Programme', ean: '5000000009993' });
// The same watch from the same shop under its other feed name, and from another shop: one card, "2 retailers".
extra({ product_name: 'Solene Classic Men\u2019s Watch \u2013 32mm Pearl Dial', site_category: 'Watches', retailer: 'Watch Enclave', ean: '5000000009993', price: 149.99 });
extra({ product_name: 'Solene Classic Men\u2019s Watch \u2013 32mm Pearl Dial', site_category: 'Watches', retailer: 'WATCH & WATCH', ean: '5000000009993', price: 139.99 });
extra({ product_name: 'Elara Retired Scarf', site_category: 'Clothing', is_active: 0 });
const cols = Object.keys(rows[0]);
const sql = ['-- Generated by tests/fixtures/make-wgw-seed.mjs. Synthetic data only, older database layout.']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .join('\n') + '\n';
writeFileSync(join(here, 'wgw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
