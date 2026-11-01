// Builds tests/fixtures/pgw-seed.sql: synthetic Gaming Gear World products (fictional brands) for local runs and CI.
// Real Awin product data never goes into this public repo.
// It covers: all 10 categories, a retailer that sells in euros ("≈ £"), the same product at two retailers
// (same EAN: one card, two prices), out-of-stock rows and invalid EANs (lessons L12).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slugify } from '../../src/lib/text.js';

const here = dirname(fileURLToPath(import.meta.url));

const ICON_PATHS = {
  'games-cards': '<rect x="55" y="40" width="90" height="120" rx="8"/><path d="M75 70h50M75 95h30"/>',
  'controllers': '<path d="M50 80h100c15 0 25 15 25 40s-10 30-20 30-15-10-25-20H70c-10 10-15 20-25 20s-20-5-20-30 10-40 25-40z"/><path d="M65 105h20M75 95v20"/>',
  'consoles': '<rect x="40" y="70" width="120" height="60" rx="8"/><path d="M60 100h40"/><circle cx="135" cy="100" r="6"/>',
  'pcs-laptops': '<rect x="55" y="50" width="90" height="65" rx="6"/><path d="M40 140h120l-12-25H52z"/>',
  'monitors': '<rect x="35" y="45" width="130" height="85" rx="6"/><path d="M100 130v20M70 155h60"/>',
  'mice-keyboards': '<rect x="30" y="80" width="110" height="50" rx="6"/><path d="M45 95h80M45 110h80"/><rect x="150" y="80" width="25" height="40" rx="12"/>',
  'headsets': '<path d="M50 120v-20a50 50 0 0 1 100 0v20"/><rect x="40" y="110" width="20" height="40" rx="6"/><rect x="140" y="110" width="20" height="40" rx="6"/>',
  'chairs-desks': '<path d="M70 40h60v70H70zM60 110h80M100 110v40M70 160h60"/>',
  'streaming': '<rect x="80" y="40" width="40" height="70" rx="20"/><path d="M65 95a35 35 0 0 0 70 0M100 130v25M75 160h50"/>',
  'components': '<rect x="40" y="70" width="120" height="60" rx="6"/><circle cx="80" cy="100" r="18"/><circle cx="125" cy="100" r="18"/><path d="M50 130v12M150 130v12"/>'
};
function image(cat) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="none" stroke="#7a8592" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[cat]}</g></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

const BRANDS = ['Arcadia', 'Pixelforge', 'Northlight', 'Quantra', 'Voltis', 'Graviton', 'Lumeo'];
// [advertiser id, retailer, currency]
const RETAILERS = [[90501, 'Example Game Shop', 'GBP'], [90502, 'Sample PC Store', 'GBP'], [90503, 'Euro Gaming Example', 'EUR']];
const MODELS = {
  'games-cards': ['Racing Game (PS5)', 'Adventure Game (Nintendo Switch 2)', 'Shooter Game Deluxe Edition (Xbox Series X)', 'Game Store Gift Card £25'],
  'controllers': ['Wireless Controller for PC', 'Pro Controller Hall Effect', 'Racing Wheel and Pedals', 'Dual Controller Charging Station'],
  'consoles': ['Handheld Gaming PC 512GB', 'Retro Handheld Game Console', 'Console Carry Case', 'Console Vertical Stand with Cooling Fan'],
  'pcs-laptops': ['16 inch Gaming Laptop RTX 5060', '15 inch Gaming Laptop RTX 5050', 'Gaming Desktop PC RTX 5070', 'Gaming Mini PC 32GB'],
  'monitors': ['27 inch QHD 180Hz Gaming Monitor', '24 inch FHD 240Hz Gaming Monitor', '34 inch Ultrawide 165Hz Curved Monitor', '32 inch 4K OLED 240Hz Monitor'],
  'mice-keyboards': ['Wireless Gaming Mouse 8K', 'Mechanical Gaming Keyboard', 'Magnetic Switch Keyboard 75%', 'XL Gaming Mouse Pad'],
  'headsets': ['Wireless Gaming Headset', 'Wired Gaming Headset 7.1', 'Gaming Earbuds Low Latency', 'PC Gaming Soundbar'],
  'chairs-desks': ['Ergonomic Gaming Chair', 'Gaming Chair with Footrest', 'L-Shaped Gaming Desk', 'Sim Racing Cockpit'],
  'streaming': ['1440p Streaming Webcam', 'USB Streaming Microphone', 'Microphone Boom Arm', 'Key Light for Streamers'],
  'components': ['Graphics Card 12GB', '8-Core Desktop Processor', 'ATX Gaming Motherboard', '32GB DDR5 6000 Memory Kit']
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
// The same headset (same EAN) at two retailers: one card with "2 retailers" and a price table on its page.
add({ cat: 'headsets', model: 'Studio Wireless Gaming Headset', brand: 'Arcadia', retailer: RETAILERS[0], price: 89.99, gtin: ean13('506099999997') });
add({ cat: 'headsets', model: 'Studio Wireless Gaming Headset', brand: 'Arcadia', retailer: RETAILERS[1], price: 79.5, gtin: ean13('506099999997') });

const cols = Object.keys(rows[0]);
const sql = ['-- Generated by tests/fixtures/make-pgw-seed.mjs. Synthetic data only.']
  .concat(rows.map(r => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(r[c])).join(', ')});`))
  .join('\n') + '\n';
writeFileSync(join(here, 'pgw-seed.sql'), sql);
console.log(`wrote ${rows.length} products`);
