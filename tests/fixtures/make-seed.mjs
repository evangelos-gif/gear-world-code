// Builds tests/fixtures/tgw-seed.sql: synthetic products (fictional brands) for local runs and CI.
// Real Awin product data never goes into this public repo.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slugify } from '../../src/lib/text.js';

const here = dirname(fileURLToPath(import.meta.url));

const ICON_PATHS = {
  'computers-laptops': '<rect x="40" y="50" width="120" height="78" rx="6"/><path d="M24 150h152"/>',
  'phones-tablets': '<rect x="70" y="30" width="60" height="140" rx="10"/><path d="M92 155h16"/>',
  audio: '<path d="M50 120v-20a50 50 0 0 1 100 0v20"/><rect x="40" y="112" width="26" height="44" rx="8"/><rect x="134" y="112" width="26" height="44" rx="8"/>',
  gaming: '<path d="M62 70h76a34 34 0 0 1 32 44l-8 26a16 16 0 0 1-27 6l-15-14h-40l-15 14a16 16 0 0 1-27-6l-8-26a34 34 0 0 1 32-44z"/>',
  'tv-projectors': '<rect x="24" y="40" width="152" height="96" rx="6"/><path d="M70 164h60M100 136v28"/>',
  'cameras-drones': '<path d="M30 70h30l12-18h56l12 18h30v84H30z"/><circle cx="100" cy="110" r="26"/>',
  'smart-home': '<path d="M36 100l64-54 64 54"/><path d="M52 88v72h96V88"/><path d="M82 128a26 26 0 0 1 36 0"/>',
  wearables: '<rect x="62" y="62" width="76" height="76" rx="18"/><path d="M76 62l6-30h36l6 30M76 138l6 30h36l6-30"/>',
  'networking-storage': '<rect x="30" y="110" width="140" height="44" rx="8"/><path d="M70 110l-14-50M130 110l14-50"/>',
  'printers-office': '<path d="M60 70V34h80v36"/><rect x="30" y="70" width="140" height="66" rx="8"/><path d="M60 120h80v46H60z"/>',
  'charging-accessories': '<path d="M80 30v30M120 30v30"/><path d="M60 60h80v26a40 40 0 0 1-80 0z"/><path d="M100 126v24a20 20 0 0 1-20 20"/>'
};

function image(cat) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#7a8592" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[cat]}</g></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

const BRANDS = ['Norvik', 'Alder', 'Quillon', 'Brightfield', 'Kestrel', 'Oakhurst', 'Velta', 'Marlow Audio'];
const RETAILERS = [[90001, 'Example Electricals'], [90002, 'Sample Tech Store'], [90003, 'Demo Refurbished']];
const MODELS = {
  'computers-laptops': ['14-inch Laptop 16GB RAM 512GB SSD', '15.6-inch Laptop Intel Core i5', '27-inch QHD Monitor', 'Wireless Keyboard and Mouse Set', 'Mini Desktop PC 8GB'],
  'phones-tablets': ['128GB SIM-free Smartphone', '10.9-inch Tablet 64GB Wi-Fi', '256GB 5G Smartphone', '8-inch Kids Tablet'],
  audio: ['Wireless Noise Cancelling Headphones', 'True Wireless Earbuds', 'Portable Bluetooth Speaker', '2.1 Soundbar with Subwoofer'],
  gaming: ['Wireless Game Controller', 'Gaming Headset 7.1', 'Mechanical Gaming Keyboard', 'Gaming Chair Black'],
  'tv-projectors': ['55-inch 4K Smart TV', '43-inch Full HD Smart TV', 'Portable Mini Projector', '4K Streaming Stick'],
  'cameras-drones': ['Action Camera 4K', 'Dash Cam Front and Rear', 'Mini Drone with Camera', 'Instant Camera'],
  'smart-home': ['Smart Plug 4-pack', 'Video Doorbell 1080p', 'Indoor Security Camera', 'Robot Vacuum Cleaner'],
  wearables: ['Smartwatch 44mm', 'Fitness Tracker Band', 'GPS Running Watch'],
  'networking-storage': ['Mesh Wi-Fi System 3-pack', '1TB Portable SSD', '2TB External Hard Drive', '128GB microSD Card'],
  'printers-office': ['Wireless All-in-One Inkjet Printer', 'Mono Laser Printer', 'Label Printer'],
  'charging-accessories': ['65W USB-C Charger', '20000mAh Power Bank', 'USB-C to USB-C Cable 2m', 'Tempered Glass Screen Protector']
};

// Valid and invalid GTINs, to test lessons L12.
const GTINS = ['5012345678900', '4006381333931', '1234567890128', '5012345678901', '', '123'];

function sq(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

const rows = [];
let n = 0;
for (const [cat, models] of Object.entries(MODELS)) {
  for (let i = 0; i < models.length; i++) {
    for (let v = 0; v < 3; v++) {
      n++;
      const brand = BRANDS[(n + v) % BRANDS.length];
      const [advId, retailer] = RETAILERS[(n + i) % RETAILERS.length];
      const base = 15 + ((n * 37) % 900);
      const price = Math.round(base * (1 + v * 0.07) * 100) / 100 - 0.01;
      const was = n % 4 === 0 ? Math.round(price * 1.25 * 100) / 100 : null;
      const name = `${brand} ${models[i]}${v ? ` (${['Graphite', 'Silver', 'Blue'][v]})` : ''}`;
      const mpid = `SKU-${cat.slice(0, 3).toUpperCase()}-${n}`;
      rows.push({
        stable_key: `${advId}:${mpid}`,
        awin_advertiser_id: advId,
        awin_product_id: String(700000 + n),
        merchant_product_id: mpid,
        retailer,
        category_slug: cat,
        subcategory: models[i].split(' ').slice(-1)[0],
        brand,
        product_name: name,
        product_slug: slugify(name),
        description: `${name}. Test product used for automated checks. It is not a real offer.`,
        price,
        was_price: was,
        in_stock: n % 9 === 0 ? 0 : 1,
        item_condition: advId === 90003 ? 'refurbished' : 'new',
        image_url: image(cat),
        affiliate_url: `https://www.awin1.com/pclick.php?p=${700000 + n}&a=0&m=${advId}`,
        merchant_category: cat,
        gtin: GTINS[n % GTINS.length] || null,
        mpn: `MPN${n}`,
        specs_json: JSON.stringify({ Colour: ['Black', 'Graphite', 'Silver'][v], Warranty: '2 years' }),
        first_seen_at: `2026-10-${String(1 + (n % 17)).padStart(2, '0')} 10:00:00`,
        last_seen_at: '2026-10-18 06:00:00'
      });
    }
  }
}

const cols = Object.keys(rows[0]);
const sql = ['-- Generated by tests/fixtures/make-seed.mjs. Synthetic data only.']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .join('\n') + '\n';
writeFileSync(join(here, 'tgw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
