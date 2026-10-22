#!/usr/bin/env node
// Travel feed scan. READ-ONLY: reads the Awin feed files on this PC (and, if given, a copy of the Awin feed list)
// and writes a report. It imports nothing and changes no file.
// For the planned Travel Gear World site (travelgearworld.com, code VGW).
//
// 1. Feeds on this PC (AWIN_<advertiserId>_<feedId>.csv[.gz]): per retailer, how many products are travel products
//    (luggage, travel bags and backpacks, travel accessories, comfort, documents and security, travel tech,
//    camping and outdoor, beach and holiday), with counts per category, in stock, currencies, top shop categories and samples.
// 2. Awin feed list (optional, --list <csv>): which programmes look like travel-gear retailers, joined or not,
//    with the link to apply. Hotels, flights, holidays and insurance are left out (no products to show).
//
// Usage: node tools/travel-feed-scan.mjs --archive <dir> --out <dir> [--list <feed list csv>] [--max-rows <n per feed>]
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords } from './tgw-import-plan.mjs';

// Words that say "this is about travel". Category texts of the shop count too.
export const CONTEXT = ['travel', 'travelling', 'traveling', 'traveller', 'luggage', 'suitcase', 'suitcases', 'cabin', 'carry on', 'carry-on',
  'hand luggage', 'holiday', 'holidays', 'vacation', 'trip', 'trips', 'flight', 'flights', 'airline', 'airport', 'in-flight', 'inflight',
  'passport', 'backpacking', 'backpacker', 'camping', 'camp', 'hiking', 'trekking', 'hike', 'outdoor', 'outdoors', 'adventure',
  'expedition', 'beach', 'festival', 'getaway', 'weekend bag', 'jet lag',
  'packing cube', 'packing cubes', 'luggage tag', 'luggage scale', 'neck pillow', 'passport holder', 'tsa lock', 'tent', 'sleeping bag', 'snorkel'];

// Not for this site, even if a travel word is there (baby travel gear, toys, travel-size cosmetics, pets, books, services).
export const NO = ['baby', 'toddler', 'infant', 'newborn', 'travel cot', 'travel system', 'pushchair', 'pram', 'stroller', 'buggy',
  'car seat', 'isofix', 'toy', 'toys', 'lego', 'puzzle', 'jigsaw', 'travel size', 'travel-size', 'mini size', 'miniature',
  'perfume', 'fragrance', 'aftershave', 'eau de toilette', 'eau de parfum', 'shampoo', 'conditioner', 'toothpaste', 'deodorant',
  'make up', 'makeup', 'lipstick', 'mascara', 'dog', 'dogs', 'cat', 'cats', 'pet', 'pets', 'puppy', 'book', 'books', 'guidebook',
  'map', 'maps', 'poster', 'print', 'mug', 'card', 'cards', 'gift card', 'voucher', 'insurance', 'hotel', 'flight ticket', 'costume'];

// First match wins. ctx: true = counts only when a travel word (CONTEXT) is also there.
export const CATEGORIES = [
  { key: 'luggage', label: 'Luggage & suitcases', yes: ['suitcase', 'suitcases', 'luggage set', 'hard shell', 'hardshell', 'spinner', 'trolley case', 'cabin case', 'cabin bag', 'cabin luggage', 'carry on', 'carry-on', 'check in', 'check-in', 'hand luggage', 'wheeled bag', 'wheeled duffle', 'underseat', 'under seat'], ctx: true },
  { key: 'bags-backpacks', label: 'Travel bags & backpacks', yes: ['travel backpack', 'travel rucksack', 'rucksack', 'backpack', 'duffle', 'duffel', 'holdall', 'weekender', 'weekend bag', 'garment bag', 'suit carrier', 'travel bag', 'daypack', 'sling bag', 'bum bag', 'waist bag', 'crossbody', 'messenger bag', 'shoulder bag'], ctx: true },
  { key: 'accessories', label: 'Travel accessories', yes: ['packing cube', 'packing cubes', 'luggage tag', 'luggage tags', 'luggage strap', 'luggage scale', 'luggage cover', 'compression bag', 'compression bags', 'toiletry bag', 'wash bag', 'washbag', 'dopp kit', 'travel bottle', 'travel bottles', 'liquids bag', 'travel organiser', 'travel organizer', 'shoe bag', 'laundry bag', 'travel towel', 'travel umbrella', 'travel kettle', 'travel iron', 'travel hairdryer', 'travel hair dryer', 'travel mug', 'travel bottle', 'water bottle', 'clothesline', 'travel kit'], ctx: true },
  { key: 'comfort', label: 'Comfort on the move', yes: ['neck pillow', 'travel pillow', 'eye mask', 'sleep mask', 'ear plugs', 'earplugs', 'compression socks', 'flight socks', 'travel blanket', 'footrest', 'foot rest', 'inflatable pillow'], ctx: true },
  { key: 'documents-security', label: 'Documents & security', yes: ['passport holder', 'passport cover', 'passport wallet', 'travel wallet', 'document holder', 'document organiser', 'rfid', 'money belt', 'neck wallet', 'tsa lock', 'tsa', 'combination lock', 'padlock', 'cable lock', 'anti theft', 'anti-theft', 'luggage tracker', 'airtag', 'tracker'], ctx: true },
  { key: 'tech', label: 'Travel tech', yes: ['travel adapter', 'travel adaptor', 'plug adapter', 'plug adaptor', 'universal adapter', 'universal adaptor', 'power bank', 'powerbank', 'portable charger', 'voltage converter', 'headphones', 'earbuds', 'noise cancelling', 'translator', 'action camera', 'gimbal', 'selfie stick', 'portable speaker', 'e-reader', 'ereader', 'kindle', 'esim', 'travel router', 'mifi', 'charging cable', 'multi plug', 'usb charger'], ctx: true },
  { key: 'camping-outdoor', label: 'Camping & outdoor', yes: ['tent', 'tents', 'sleeping bag', 'sleeping bags', 'sleeping mat', 'camping mat', 'roll mat', 'air bed', 'airbed', 'camping chair', 'camping table', 'camping stove', 'stove', 'cookset', 'cook set', 'mess tin', 'head torch', 'headtorch', 'lantern', 'hammock', 'trekking pole', 'trekking poles', 'walking poles', 'hydration', 'water filter', 'dry bag', 'drybag', 'bivvy', 'tarp', 'gazebo', 'cool box', 'coolbox', 'cool bag', 'hiking boots', 'walking boots', 'waterproof jacket', 'compass', 'survival', 'multitool', 'multi-tool'], ctx: true },
  { key: 'beach-holiday', label: 'Beach & holiday', yes: ['beach bag', 'beach towel', 'beach mat', 'beach tent', 'beach shelter', 'beach umbrella', 'windbreak', 'snorkel', 'snorkelling', 'snorkeling', 'swim', 'swimwear', 'flip flops', 'sun hat', 'sunglasses', 'waterproof phone', 'phone pouch', 'inflatable'], ctx: true }
];
export const OTHER = { key: 'other-travel', label: 'Other travel products' };

// Words in a programme's name that point to a travel-gear retailer (for the Awin list).
export const PROGRAMME_WORDS = ['luggage', 'suitcase', 'suitcases', 'bags', 'bag', 'travel', 'samsonite', 'antler', 'delsey', 'tripp',
  'cabin', 'cabinmax', 'eastpak', 'kipling', 'osprey', 'tumi', 'rimowa', 'eagle', 'creek', 'vango', 'outwell', 'coleman', 'camping',
  'outdoor', 'outdoors', 'millets', 'blacks', 'cotswold', 'trespass', 'regatta', 'berghaus', 'rucksack', 'backpack', 'backpacks',
  'adventure', 'hiking', 'trekking', 'snow', 'surf', 'beach', 'decathlon', 'mountain', 'warehouse', 'nomad', 'globetrotter', 'wanderlust'];
// Programmes that sell trips, not products: left out of the list.
export const PROGRAMME_NO = ['hotel', 'hotels', 'flight', 'flights', 'airline', 'airlines', 'airways', 'air', 'holidays', 'cruise', 'cruises',
  'car hire', 'rental', 'rentals', 'insurance', 'booking', 'tours', 'tour', 'parking', 'lounge', 'lounges', 'transfers', 'esim', 'rail', 'trains', 'ferry', 'ferries', 'resort', 'villas', 'cottages', 'experiences', 'tickets'];

const norm = s => ` ${String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9'+-]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const has = (t, w) => t.includes(` ${w} `);
const any = (t, list) => list.some(w => has(t, w));

// text = product name (+ short description); catText = the shop's category and Awin's category.
export function classify(name, catText = '') {
  const t = norm(name), c = norm(catText), all = `${t}${c}`;
  if (any(t, NO)) return { travel: false, why: 'no-list' };
  const ctx = any(all, CONTEXT);
  for (const cat of CATEGORIES) {
    if (!any(t, cat.yes)) continue;
    if (cat.ctx && !ctx) continue;
    return { travel: true, cat: cat.key };
  }
  // Second chance: the shop's own category says what it is.
  for (const cat of CATEGORIES) {
    if (any(c, cat.yes) && (ctx || !cat.ctx)) return { travel: true, cat: cat.key };
  }
  if (ctx && any(c, CONTEXT)) return { travel: true, cat: OTHER.key };
  return { travel: false };
}

export function isTravelProgramme(name, vertical = '') {
  const t = norm(name);
  if (any(t, PROGRAMME_NO)) return false;
  if (/travel|outdoor|sport/i.test(vertical) && any(t, PROGRAMME_WORDS)) return true;
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
    const a = byAdv.get(adv) || { advertiserId: Number(adv), merchant: '', files: [], rows: 0, travel: 0, travelInStock: 0,
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
        if (r.travel) {
          a.travel++;
          if (inStock(pick(rec, map.inStock)) !== false) a.travelInStock++;
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
  L.push(`TRAVEL FEED SCAN (read-only) - for Travel Gear World (VGW) ${generated.toISOString().slice(0, 16).replace('T', ' ')}`);
  L.push(`Archive: ${archive}`);
  const withTravel = advs.filter(a => a.travel > 0).sort((x, y) => y.travel - x.travel);
  const totalTravel = withTravel.reduce((t, a) => t + a.travel, 0);
  L.push(`Retailers in the archive: ${advs.length} | with travel products: ${withTravel.length} | travel products: ${fmt(totalTravel)}`);
  const errs = advs.filter(a => a.error);
  if (errs.length) L.push(`Could not read: ${errs.map(a => `${a.advertiserId} (${a.error})`).join('; ')}`);
  L.push('');
  L.push('== TRAVEL PRODUCTS PER CATEGORY (all retailers) ==');
  const tot = {};
  for (const a of withTravel) for (const [k, n] of Object.entries(a.cats)) tot[k] = (tot[k] || 0) + n;
  for (const c of [...CATEGORIES, OTHER]) L.push(`  ${c.label.padEnd(26)} ${fmt(tot[c.key] || 0).padStart(8)}`);
  L.push('');
  L.push('== RETAILERS WITH TRAVEL PRODUCTS (most first) ==');
  for (const a of withTravel) {
    L.push(`-- ${a.advertiserId} ${a.merchant || '?'}: ${fmt(a.travel)} travel of ${fmt(a.rows)} products (${pct(a.travel, a.rows)}) | travel in stock ${pct(a.travelInStock, a.travel)} | ${Object.entries(a.currencies).map(([c, n]) => `${c} ${n}`).join(', ')} | file ${a.ageDays}d old`);
    L.push(`   by category: ${Object.entries(a.cats).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${label(k)} ${fmt(n)}`).join(' | ')}`);
    L.push(`   shop categories: ${Object.entries(a.shopCats).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([c, n]) => `${c.slice(0, 50)} (${fmt(n)})`).join(' | ')}`);
    for (const [k, s] of Object.entries(a.samples)) for (const x of s.slice(0, 2)) L.push(`   e.g. [${label(k)}] ${x}`);
  }
  const none = advs.filter(a => a.travel === 0);
  L.push('');
  L.push(`== NO TRAVEL PRODUCTS (${none.length}) ==`);
  L.push('  ' + none.map(a => `${a.advertiserId} ${a.merchant || '?'}`).join(', '));
  if (list) {
    L.push('');
    const here = new Set(advs.map(a => String(a.advertiserId)));
    const joined = list.filter(r => /^(active|joined)$/i.test(r.membership));
    L.push(`== AWIN FEED LIST: ${list.length} feeds, ${joined.length} from programmes you joined ==`);
    const trav = list.filter(r => isTravelProgramme(`${r.name} ${r.feedName}`, r.vertical));
    const seen = new Set();
    const uniq = trav.filter(r => (seen.has(r.id) ? false : seen.add(r.id))).sort((x, y) => y.products - x.products);
    L.push('-- Travel-gear programmes you JOINED --');
    for (const r of uniq.filter(r => /^(active|joined)$/i.test(r.membership))) {
      L.push(`  ${r.id.padEnd(7)} ${r.name.slice(0, 40).padEnd(40)} ${r.region.padEnd(4)} ${fmt(r.products).padStart(9)} products | feed ${r.feedId} | file on this PC: ${here.has(r.id) ? 'yes' : 'NO'}`);
    }
    L.push('-- Travel-gear programmes NOT joined (apply: open the link, press "Join programme") --');
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
  return { text: L.join('\n') + '\n', withTravel };
}

function toCsv(advs) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const keys = [...CATEGORIES.map(c => c.key), OTHER.key];
  const rows = [['advertiser_id', 'merchant', 'products', 'travel_products', 'travel_in_stock', ...keys]];
  for (const a of advs) rows.push([a.advertiserId, a.merchant, a.rows, a.travel, a.travelInStock, ...keys.map(k => a.cats[k] || 0)]);
  return rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
}

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = resolve(val('archive') || '');
  const out = resolve(val('out') || 'travel-feed-scan');
  if (!val('archive') || !existsSync(archive)) { console.error(`Archive folder not found: ${archive}`); process.exit(2); }
  mkdirSync(out, { recursive: true });
  const advs = await scanArchive({ archive, maxRows: Number(val('max-rows')) || Infinity, log: m => process.stdout.write(`\r${m}`.padEnd(90)) });
  process.stdout.write('\n');
  const list = val('list') && existsSync(val('list')) ? await readList(val('list')) : null;
  const { text } = render({ advs, list, archive });
  writeFileSync(join(out, 'report.txt'), text);
  writeFileSync(join(out, 'retailers.csv'), '﻿' + toCsv(advs.sort((x, y) => y.travel - x.travel)));
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
