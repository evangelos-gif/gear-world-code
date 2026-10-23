#!/usr/bin/env node
// Car feed scan. READ-ONLY: reads the Awin feed files on this PC (and, if given, a copy of the Awin feed list)
// and writes a report. It imports nothing and changes no file.
//
// 1. Feeds on this PC (AWIN_<advertiserId>_<feedId>.csv[.gz]): per retailer, how many products are car products
//    (parts, tyres, garage tools, car care, car electronics, interior, exterior/towing, safety, EV charging),
//    with counts per category, in stock, currencies, top shop categories and samples.
// 2. Awin feed list (optional, --list <csv>): which programmes look like car retailers, joined or not,
//    with the link to apply.
//
// Usage: node tools/car-feed-scan.mjs --archive <dir> --out <dir> [--list <feed list csv>] [--max-rows <n per feed>]
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords } from './tgw-import-plan.mjs';

// Words that say "this is about a car". Category texts of the shop count too.
export const CONTEXT = ['car', 'cars', 'vehicle', 'vehicles', 'automotive', 'motoring', 'motorist', 'motorists', '4x4', 'suv',
  'campervan', 'motorhome', 'caravan', 'tyre', 'tyres', 'tire', 'tires', 'dashcam', 'dash cam', 'obd', 'obd2', 'obdii',
  'windscreen', 'windshield', 'number plate', 'towbar', 'tow bar', 'roof box', 'roof bars', 'ev charger', 'ev charging',
  'car parts', 'autoparts', 'auto parts', 'car accessories', 'car care', 'jump starter', 'wiper blade', 'wiper blades',
  'sat nav', 'satnav', 'carplay', 'android auto', 'reversing camera', 'parking sensor', 'parking sensors',
  'engine oil', 'motor oil', 'spark plug', 'spark plugs', 'brake pads', 'brake discs', 'trolley jack', 'axle stand', 'axle stands', 'screenwash'];

// Not for this site, even if a car word is there (toys, children's car seats, clothes, gifts with a car picture).
export const NO = ['toy', 'toys', 'ride on', 'ride-on', 'rc', 'remote control', 'lego', 'diecast', 'die cast', 'model car',
  'scale model', 'playmat', 'play mat', 'kids', 'kid', 'children', 'childrens', "children's", 'baby', 'toddler', 'infant',
  'booster seat', 'child seat', 'isofix', 'i-size', 'pushchair', 'pram', 'stroller', 'travel system', 'carrycot',
  't shirt', 't-shirt', 'tshirt', 'hoodie', 'sweatshirt', 'jacket', 'coat', 'dress', 'mug', 'poster', 'print', 'book',
  'card', 'cards', 'costume', 'bed', 'cake', 'puzzle', 'jigsaw', 'game', 'pyjamas', 'socks', 'cufflinks', 'keyring', 'necklace',
  'bicycle', 'bicycles', 'mtb', 'cycling', 'bike tyre', 'bike tyres', 'inner tube', '700c', 'wheelbarrow', 'mower', 'sack truck'];

export const MOTO = ['motorbike', 'motorcycle', 'motorcycles', 'motorbikes', 'scooter', 'moped', 'biker', 'motocross'];

// First match wins. ctx: true = counts only when a car word (CONTEXT) is also there.
export const CATEGORIES = [
  { key: 'tyres-wheels', label: 'Tyres & wheels', yes: ['tyre', 'tyres', 'tire', 'tires', 'alloy wheel', 'alloy wheels', 'wheel trim', 'wheel trims', 'locking wheel nuts', 'tyre inflator', 'tyre pressure', 'puncture repair'] },
  { key: 'ev-charging', label: 'EV charging', yes: ['ev charger', 'ev charging', 'wallbox', 'type 2 cable', 'type 2 charging', 'electric vehicle charger', 'ev cable'] },
  { key: 'car-electronics', label: 'Car electronics', yes: ['dash cam', 'dashcam', 'sat nav', 'satnav', 'gps navigator', 'car stereo', 'head unit', 'carplay', 'android auto', 'reversing camera', 'parking sensor', 'parking sensors', 'car charger', 'car phone holder', 'car phone mount', 'car mount', 'fm transmitter', 'car speaker', 'car speakers', 'car amplifier', 'subwoofer', 'radar detector', 'car radio', 'gps tracker'], ctx: true },
  { key: 'car-care', label: 'Car care & cleaning', yes: ['car wash', 'shampoo', 'wax', 'polish', 'snow foam', 'microfibre', 'microfiber', 'valeting', 'valet', 'detailing', 'clay bar', 'tyre shine', 'glass cleaner', 'air freshener', 'pressure washer', 'scratch remover', 'ceramic coating', 'headlight restoration', 'drying towel', 'wash mitt', 'interior cleaner', 'leather cleaner'], ctx: true },
  { key: 'parts-maintenance', label: 'Parts & maintenance', yes: ['brake', 'brakes', 'brake pads', 'brake disc', 'brake discs', 'oil filter', 'air filter', 'cabin filter', 'pollen filter', 'fuel filter', 'engine oil', 'motor oil', 'spark plug', 'spark plugs', 'glow plug', 'wiper blade', 'wiper blades', 'wiper', 'wipers', 'bulb', 'bulbs', 'car battery', 'coolant', 'antifreeze', 'screenwash', 'timing belt', 'suspension', 'shock absorber', 'shock absorbers', 'exhaust', 'alternator', 'starter motor', 'clutch', 'fuse', 'fuses', 'gasket', 'radiator', 'headlight', 'headlights', 'tail light', 'mirror glass', 'additive'], ctx: true, re: [/\b[05]w-?\d{2}\b/, /\bh(1|3|4|7|11)\b/] },
  { key: 'garage-tools', label: 'Garage tools & equipment', yes: ['trolley jack', 'axle stand', 'axle stands', 'car jack', 'bottle jack', 'jump starter', 'jump leads', 'battery charger', 'battery tester', 'obd', 'obd2', 'obdii', 'diagnostic', 'code reader', 'torque wrench', 'creeper', 'car ramps', 'ramps', 'engine hoist', 'wheel brace', 'socket set', 'impact wrench', 'oil drain', 'grease gun', 'compressor', 'workshop'], ctx: true },
  { key: 'interior-comfort', label: 'Interior & comfort', yes: ['seat cover', 'seat covers', 'floor mat', 'floor mats', 'car mats', 'boot liner', 'boot mat', 'organiser', 'organizer', 'sun shade', 'sunshade', 'steering wheel cover', 'seat cushion', 'car vacuum', 'cool box', 'fridge', 'heated seat', 'headrest', 'cup holder', 'back seat'], ctx: true },
  { key: 'exterior-towing', label: 'Exterior, roof & towing', yes: ['roof box', 'roof bars', 'roof rack', 'bike rack', 'bike carrier', 'cycle carrier', 'tow bar', 'towbar', 'towing', 'trailer', 'car cover', 'mud flaps', 'number plate', 'awning', 'tow ball', 'hitch'], ctx: true },
  { key: 'safety-breakdown', label: 'Safety & breakdown', yes: ['warning triangle', 'hi vis', 'hi-vis', 'first aid', 'breakdown', 'tow rope', 'snow chains', 'snow socks', 'ice scraper', 'de-icer', 'deicer', 'fire extinguisher', 'emergency', 'reflective', 'breathalyser', 'torch'], ctx: true }
];
export const OTHER = { key: 'other-car', label: 'Other car products' };

// Words in a programme's name that point to a car retailer (for the Awin list).
export const PROGRAMME_WORDS = ['car', 'cars', 'auto', 'autos', 'automotive', 'motor', 'motors', 'motoring', 'tyre', 'tyres', 'tire', 'tires',
  'parts', 'garage', 'halfords', 'autodoc', 'oponeo', 'blackcircles', 'mytyres', 'tyreleader', 'kwik', 'dashcam', 'nextbase',
  'valet', 'wax', 'detailing', 'roof', 'tow', 'towbar', 'ev', 'charge', 'charging', 'van', 'vehicle', 'vehicles', 'wheels', 'alloy',
  'battery', 'batteries', 'oil', 'brake', 'brakes', 'carparts', 'autoparts', 'motorhome', 'caravan', 'drive', 'driving'];

const norm = s => ` ${String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9'+-]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const has = (t, w) => t.includes(` ${w} `);
const any = (t, list) => list.some(w => has(t, w));

// text = product name (+ short description); catText = the shop's category and Awin's category.
export function classify(name, catText = '') {
  const t = norm(name), c = norm(catText), all = `${t}${c}`;
  if (any(t, NO)) return { car: false, why: 'no-list' };
  // A "car seat" is a child seat (Kids' site) unless it is a cover, protector or organiser for the seat.
  if (has(t, 'car seat') && !any(t, ['cover', 'covers', 'protector', 'organiser', 'organizer', 'cushion', 'gap filler'])) return { car: false, why: 'child seat' };
  if (any(all, MOTO)) return { car: false, moto: true };
  const ctx = any(all, CONTEXT);
  for (const cat of CATEGORIES) {
    const hit = any(t, cat.yes) || (cat.re || []).some(r => r.test(t));
    if (!hit) continue;
    if (cat.ctx && !ctx) continue;
    return { car: true, cat: cat.key };
  }
  // Second chance: the shop's own category says what it is.
  for (const cat of CATEGORIES) {
    if (any(c, cat.yes) && ctx) return { car: true, cat: cat.key };
  }
  if (ctx) return { car: true, cat: OTHER.key };
  return { car: false };
}

export function isCarProgramme(name, vertical = '') {
  const t = norm(name);
  if (/automotive|motoring|vehicle/i.test(vertical)) return true;
  return any(t, PROGRAMME_WORDS);
}

const COLS = {
  merchant: ['merchant_name'], name: ['product_name'], desc: ['product_short_description'],
  price: ['search_price', 'store_price', 'display_price', 'price'], currency: ['currency'],
  inStock: ['in_stock', 'is_for_sale', 'stock_status', 'stock_quantity'],
  merchantCategory: ['merchant_category', 'merchant_product_category_path'], awinCategory: ['category_name']
};
function mapHeader(header) {
  const h = header.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
  return Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, names.map(n => h.indexOf(n)).filter(i => i >= 0)]));
}
const pick = (rec, idxs) => { for (const i of idxs) { const v = rec[i]; if (v !== undefined && String(v).trim() !== '') return String(v).trim(); } return ''; };
function inStock(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === '') return null;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  return /^(yes|y|true|in stock|in_stock|instock|available|available to order|limited stock)$/.test(s);
}

export async function scanArchive({ archive, maxRows = Infinity, log = () => {} }) {
  const files = readdirSync(archive).filter(f => /^AWIN_\d+_\d+\.csv(\.gz)?$/i.test(f)).sort();
  const byAdv = new Map();
  let i = 0;
  for (const f of files) {
    i++;
    const [, adv] = f.match(/^AWIN_(\d+)_(\d+)/i);
    const full = join(archive, f);
    const a = byAdv.get(adv) || { advertiserId: Number(adv), merchant: '', files: [], rows: 0, car: 0, carInStock: 0, moto: 0,
      cats: {}, shopCats: {}, currencies: {}, samples: {}, ageDays: 9999, error: '' };
    a.files.push(f);
    a.ageDays = Math.min(a.ageDays, Math.floor((Date.now() - statSync(full).mtimeMs) / 86400000));
    try {
      const raw = createReadStream(full);
      const stream = /\.gz$/i.test(f) ? raw.pipe(createGunzip()) : raw;
      let map = null, n = 0;
      for await (const rec of readCsvRecords(stream)) {
        if (!map) { map = mapHeader(rec); continue; }
        if (rec.length < 3) continue;
        n++; a.rows++;
        if (!a.merchant) a.merchant = pick(rec, map.merchant);
        const name = pick(rec, map.name);
        const shopCat = pick(rec, map.merchantCategory);
        const r = classify(`${name} ${pick(rec, map.desc).slice(0, 160)}`, `${shopCat} ${pick(rec, map.awinCategory)}`);
        if (r.moto) a.moto++;
        if (r.car) {
          a.car++;
          if (inStock(pick(rec, map.inStock)) !== false) a.carInStock++;
          a.cats[r.cat] = (a.cats[r.cat] || 0) + 1;
          const sc = shopCat || '(no category)';
          a.shopCats[sc] = (a.shopCats[sc] || 0) + 1;
          const cur = pick(rec, map.currency).toUpperCase() || '?';
          a.currencies[cur] = (a.currencies[cur] || 0) + 1;
          const list = (a.samples[r.cat] ||= []);
          if (list.length < 3 && (a.cats[r.cat] % 37 === 1)) list.push(`${name.slice(0, 80)} | ${pick(rec, map.price)} ${cur}`);
        }
        if (n >= maxRows) break;
      }
    } catch (e) {
      a.error = String(e && e.message || e).slice(0, 160);
    }
    byAdv.set(adv, a);
    log(`${i}/${files.length} ${f}`);
  }
  return [...byAdv.values()];
}

export async function readList(file) {
  const out = [];
  let head = null;
  for await (const rec of readCsvRecords(createReadStream(file))) {
    if (!head) { head = rec.map(h => String(h).trim().toLowerCase()); continue; }
    if (rec.length < 3) continue;
    const col = re => { const i = head.findIndex(h => re.test(h)); return i >= 0 ? String(rec[i] || '').trim() : ''; };
    out.push({ id: col(/^advertiser.?id$/), name: col(/^advertiser.?name$/), region: col(/region/), membership: col(/membership/),
      feedId: col(/^feed.?id$/), feedName: col(/^feed.?name$/), vertical: col(/vertical/), products: Number(col(/(no|number).?of.?products/)) || 0 });
  }
  return out;
}

export function render({ advs, list = null, archive = '', generated = new Date() }) {
  const fmt = n => new Intl.NumberFormat('en-GB').format(n);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
  const label = k => (CATEGORIES.find(c => c.key === k) || OTHER).label;
  const L = [];
  L.push(`CAR FEED SCAN (read-only) ${generated.toISOString().slice(0, 16).replace('T', ' ')}`);
  L.push(`Archive: ${archive}`);
  const withCar = advs.filter(a => a.car > 0).sort((x, y) => y.car - x.car);
  const totalCar = withCar.reduce((t, a) => t + a.car, 0);
  L.push(`Retailers in the archive: ${advs.length} | with car products: ${withCar.length} | car products: ${fmt(totalCar)}`);
  const errs = advs.filter(a => a.error);
  if (errs.length) L.push(`Could not read: ${errs.map(a => `${a.advertiserId} (${a.error})`).join('; ')}`);
  L.push('');
  L.push('== CAR PRODUCTS PER CATEGORY (all retailers) ==');
  const tot = {};
  for (const a of withCar) for (const [k, n] of Object.entries(a.cats)) tot[k] = (tot[k] || 0) + n;
  for (const c of [...CATEGORIES, OTHER]) L.push(`  ${c.label.padEnd(26)} ${fmt(tot[c.key] || 0).padStart(8)}`);
  L.push('');
  L.push('== RETAILERS WITH CAR PRODUCTS (most first) ==');
  for (const a of withCar) {
    L.push(`-- ${a.advertiserId} ${a.merchant || '?'}: ${fmt(a.car)} car of ${fmt(a.rows)} products (${pct(a.car, a.rows)}) | car in stock ${pct(a.carInStock, a.car)} | ${Object.entries(a.currencies).map(([c, n]) => `${c} ${n}`).join(', ')} | file ${a.ageDays}d old${a.moto ? ` | motorbike ${fmt(a.moto)} (not counted)` : ''}`);
    L.push(`   by category: ${Object.entries(a.cats).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${label(k)} ${fmt(n)}`).join(' | ')}`);
    L.push(`   shop categories: ${Object.entries(a.shopCats).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([c, n]) => `${c.slice(0, 50)} (${fmt(n)})`).join(' | ')}`);
    for (const [k, s] of Object.entries(a.samples)) for (const x of s.slice(0, 2)) L.push(`   e.g. [${label(k)}] ${x}`);
  }
  const none = advs.filter(a => a.car === 0);
  L.push('');
  L.push(`== NO CAR PRODUCTS (${none.length}) ==`);
  L.push('  ' + none.map(a => `${a.advertiserId} ${a.merchant || '?'}`).join(', '));
  if (list) {
    L.push('');
    const here = new Set(advs.map(a => String(a.advertiserId)));
    const joined = list.filter(r => /^(active|joined)$/i.test(r.membership));
    L.push(`== AWIN FEED LIST: ${list.length} feeds, ${joined.length} from programmes you joined ==`);
    const car = list.filter(r => isCarProgramme(`${r.name} ${r.feedName}`, r.vertical));
    const seen = new Set();
    const uniq = car.filter(r => (seen.has(r.id) ? false : seen.add(r.id))).sort((x, y) => y.products - x.products);
    L.push('-- Car-looking programmes you JOINED --');
    for (const r of uniq.filter(r => /^(active|joined)$/i.test(r.membership))) {
      L.push(`  ${r.id.padEnd(7)} ${r.name.slice(0, 40).padEnd(40)} ${r.region.padEnd(4)} ${fmt(r.products).padStart(9)} products | feed ${r.feedId} | file on this PC: ${here.has(r.id) ? 'yes' : 'NO'}`);
    }
    L.push('-- Car-looking programmes NOT joined (apply: open the link, press "Join programme") --');
    for (const r of uniq.filter(r => !/^(active|joined)$/i.test(r.membership))) {
      L.push(`  ${r.id.padEnd(7)} ${r.name.slice(0, 40).padEnd(40)} ${r.region.padEnd(4)} ${fmt(r.products).padStart(9)} products | ${r.membership || '?'} | https://ui.awin.com/merchant-profile/${r.id}`);
    }
    L.push('Note: the list match is by name only; check each profile before applying.');
  } else {
    L.push('');
    L.push('Awin feed list: not read (no saved feed key on this PC).');
  }
  L.push('');
  L.push('Note: a first sort by keywords. Before any import, each retailer gets its own rules (yes/no lists) and a dry-run report.');
  return { text: L.join('\n') + '\n', withCar };
}

function toCsv(advs) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const keys = [...CATEGORIES.map(c => c.key), OTHER.key];
  const rows = [['advertiser_id', 'merchant', 'products', 'car_products', 'car_in_stock', ...keys]];
  for (const a of advs) rows.push([a.advertiserId, a.merchant, a.rows, a.car, a.carInStock, ...keys.map(k => a.cats[k] || 0)]);
  return rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
}

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = resolve(val('archive') || '');
  const out = resolve(val('out') || 'car-feed-scan');
  if (!val('archive') || !existsSync(archive)) { console.error(`Archive folder not found: ${archive}`); process.exit(2); }
  mkdirSync(out, { recursive: true });
  const advs = await scanArchive({ archive, maxRows: Number(val('max-rows')) || Infinity, log: m => process.stdout.write(`\r${m}`.padEnd(90)) });
  process.stdout.write('\n');
  const list = val('list') && existsSync(val('list')) ? await readList(val('list')) : null;
  const { text } = render({ advs, list, archive });
  writeFileSync(join(out, 'report.txt'), text);
  writeFileSync(join(out, 'retailers.csv'), '﻿' + toCsv(advs.sort((x, y) => y.car - x.car)));
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
