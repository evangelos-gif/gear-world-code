// Builds tests/fixtures/kgw-seed.sql: synthetic products in the OLDER Gear World database layout
// (tests/fixtures/ggw-legacy-schema.sql), shaped like Kids' Gear World's real data: category names
// instead of slugs, stock as text ("in stock"), Awin product images at 200 px, InStock sizes as separate rows.
// Brands and products are fictional. Real Awin product data never goes into this public repo.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const ICON = '<path d="M60 150l40-90 40 90"/><circle cx="100" cy="60" r="14"/><path d="M40 160h120"/>';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#5a4fd1" stroke-width="6" stroke-linecap="round">${ICON}</g></svg>`;
const IMAGE = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const BRANDS = ['Little Otter', 'Puddle & Pip', 'Starling Kids', 'Bramble Bear', 'Kitepop', 'Mooncub'];
const RETAILERS = ['InStock UK', 'Joybuy UK', 'Juicy Couture UK'];
// Category names exactly as the import router writes them. All 10 have products, like the real site.
const MODELS = {
  'Clothing': ['Fleece Hoodie', 'Cotton Pyjama Set', 'Puffer Coat', 'Striped T-Shirt', 'Rain Jacket', 'Ankle Socks 5 Pack'],
  'Baby & Toddler': ['Silicone Teether', 'Hooded Bath Towel', 'Sippy Cup 2 Pack', 'Muslin Squares 3 Pack'],
  'Toys & Games': ['Wooden Train Set', 'Magnetic Building Tiles 60 Piece', 'Floor Puzzle 48 Piece', 'Pretend Play Kitchen'],
  'Sports & Outdoors': ['Kick Scooter', 'Kids Bike Helmet', 'Football Goal Set'],
  'Kids Tech': ['Volume Limited Headphones', 'Kids Camera', 'Star Night Light'],
  'Bedroom & Home': ['Storage Toy Box', 'Glow Star Bedding Set'],
  'Accessories': ['Bobble Hat', 'Hair Clip Set'],
  'Shoes': ['Light Up Trainers', 'Wellington Boots'],
  'Gifts for Kids': ['Craft Gift Box', 'Science Kit Gift Set'],
  'School & Backpacks': ['School Backpack', 'Pencil Case']
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
const SIZES = ['2-3 Years', '4-5 Years', '6-7 Years'];

function sq(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

const rows = [];
let n = 0;
for (const [cat, models] of Object.entries(MODELS)) {
  // InStock sends one row per size, like the real feed: "<name> - <size> / <colour>".
  const variants = cat === 'Clothing' ? 3 : 2;
  for (let i = 0; i < models.length; i++) {
    for (let v = 0; v < variants; v++) {
      n++;
      const brand = BRANDS[(n + v) % BRANDS.length];
      const retailer = RETAILERS[(n + i) % RETAILERS.length];
      const price = Math.round((4 + ((n * 37) % 160)) * (1 + v * 0.05) * 100) / 100 - 0.01;
      const base = `${brand} ${models[i]}`;
      const name = retailer === 'InStock UK' && variants === 3 ? `${base} - ${SIZES[v]} / Navy` : `${base}${v ? ` (${['Red', 'Blue', 'Green'][v]})` : ''}`;
      const sku = `KGW-T-${n}`;
      rows.push({
        awin_product_id: String(770000 + n),
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
        merchant_category: `Kids > ${cat}`,
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
const extra = (o) => rows.push({ ...rows[0], ean: ean(900 + rows.length), ...o, awin_product_id: String(790000 + rows.length), merchant_product_id: `KGW-X-${rows.length}` });
// Text saved twice as UTF-8 by the feed ("Kidsâ€™ ... â€“ 3 Years").
extra({ product_name: 'Mooncub Kidsâ€™ Bath Robe â€“ 3 Years', site_category: 'Baby & Toddler', ean: '5100000009998' });
// The same toy from two shops: one card, "2 retailers".
extra({ product_name: 'Kitepop Rainbow Stacking Cups', site_category: 'Toys & Games', retailer: 'Joybuy UK', ean: '5100000009981', price: 9.99, stock_status: '1' });
extra({ product_name: 'Kitepop Rainbow Stacking Cups', site_category: 'Toys & Games', retailer: 'InStock UK', ean: '5100000009981', price: 11.49 });
// A very long name: the old address has no length limit, and it must keep working.
extra({ product_name: 'Starling Kids Premium Quality Wooden Balance Bike for Toddlers - Adjustable Seat - Lightweight - Ages 2 to 5 Years - Natural Wood Finish', site_category: 'Sports & Outdoors' });
extra({ product_name: 'Bramble Bear Retired Rattle', site_category: 'Baby & Toddler', is_active: 0 });
const cols = Object.keys(rows[0]);
const sql = ['-- Generated by tests/fixtures/make-kgw-seed.mjs. Synthetic data only, older database layout.']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .join('\n') + '\n';
writeFileSync(join(here, 'kgw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
