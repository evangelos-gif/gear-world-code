#!/usr/bin/env node
// Gear World - NEW SITE SCAN. READ-ONLY: reads the Awin feed files that are already on this PC and writes one report.
//
// Question it answers: "Which new site should we build next: Travel Gear World or Gaming Gear World?"
// For every AWIN_<advertiserId>_<feedId>.csv(.gz) in the Awin archive it counts the products that
//   1. have a name and a price, and are not marked out of stock, and
//   2. match a category of one of the candidate sites (CANDIDATES below: yes-words, needs-words, no-words, lesson L14).
// For every match it also asks the Technology Gear World rules whether TGW would already take that product,
// so the overlap with a live site is a number, not a guess.
// With --members (a list made by the .ps1 from the Awin feed list, without the key) it marks the retailers
// where the account is a member, and lists other retailers in the Awin list whose name points to the niche.
// Nothing is imported, nothing is sent anywhere, no file in the archive is changed.
//
// Usage: node tools/gw-new-site-scan.mjs --archive <dir> --out <report.txt> [--members <members.csv>] [--max-rows <n per feed>]
import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classify as tgwClassify } from '../sites/tgw/category-rules.js';
import { readCsvRecords, parsePrice, cleanText } from './tgw-import-plan.mjs';

export const VERSION = 'gw-new-site-scan v1';
const SAMPLES_PER_CATEGORY = 6;
const SAMPLES_PER_RETAILER = 2;
const RETAILERS_SHOWN = 15;

const words = list => new RegExp(`\\b(?:${list.join('|')})\\b`, 'i');
const anyOf = (...res) => new RegExp(res.map(r => r.source).join('|'), 'i');

// Things that share a word with the niche but are not gear: toys, merchandise clothes, pet items, beauty minis.
const TOYISH = words(['toys?', 'dolls?', 'barbie', 'lego', 'playmobil', 'sylvanian', 'play ?tents?', 'teepees?', 'tipis?', 'role ?play', 'pretend play',
  'dolls? house', 'miniature', 'keyrings?', 'key ?chains?', 'stickers?', 'cake toppers?', 'christmas decorations?', 'baubles?', 'ornaments?']);
const MERCH = words(['t-?shirts?', 'tees?', 'hoodies?', 'sweatshirts?', 'pyjamas?', 'pajamas?', 'socks', 'onesies?', 'mugs?', 'posters?', 'duvet covers?', 'bedding', 'cushions?', 'slippers?', 'phone cases?']);
const PET = words(['dogs?', 'cats?', 'puppy', 'puppies', 'kittens?', 'pets?', 'hamsters?', 'rabbits?', 'guinea pigs?', 'birds?', 'parrots?', 'horses?', 'equestrian']);

// ---------- Candidate sites ----------
// A product fits a category when `include` matches name + feed category, `needs` (if set) matches too, and `exclude` does not.
// The first matching category of a candidate wins; one product can count for both candidates (a gaming backpack).
// `overlap` names the live site that already sells that kind of product, for the report.
export const CANDIDATES = [
  { code: 'TRAVEL', name: 'Travel Gear World', domain: 'travelgearworld.com', categories: [
    { key: 'luggage', label: 'Suitcases and luggage', overlap: '', include: words(['suit ?cases?', 'luggage', 'carry[- ]?ons?', 'cabin (?:bags?|cases?|luggage|trolley|size bags?)',
      'hand luggage', 'trolley (?:cases?|bags?)', '(?:hard ?shell|hardside|soft ?side|spinner|check-?in) (?:cases?|suitcases?|luggage|trolley)', '\\d{2} ?cm (?:spinner|trolley|cabin|suitcase|case)',
      'luggage sets?', 'wheeled (?:bags?|holdalls?|duffels?|duffles?)', 'underseat bags?']),
      exclude: anyOf(TOYISH, PET, words(['luggage (?:tags?|scales?|straps?|locks?|covers?|labels?)', 'suitcase (?:covers?|locks?)', 'jewellery', 'make-?up (?:train )?cases?', 'cosmetic cases?', 'tool cases?', 'briefcases?', 'record', 'vinyl', 'pencil'])) },
    { key: 'bags-backpacks', label: 'Travel bags and backpacks', overlap: 'MGW/WGW bags', include: words(['holdalls?', 'duffel bags?', 'duffle bags?', 'duffels?', 'weekend(?:er)? bags?', 'overnight bags?', 'travel (?:bags?|backpacks?|rucksacks?|totes?|packs?)',
      'garment (?:bags?|carriers?)', 'suit carriers?', 'backpacking', '(?:hiking|trekking|travel|daypack|day) (?:backpacks?|rucksacks?|packs?)', 'daypacks?', 'rucksacks?', 'backpacks?', 'carry-?all bags?']),
      exclude: anyOf(TOYISH, MERCH, PET, words(['school', 'kids?', 'children', 'childrens', 'junior', 'nappy', 'changing bags?', 'baby', 'toddlers?', 'lunch', 'pencil', 'sprayers?', 'leaf blowers?', 'backpack (?:sprayers?|blowers?|vacuums?|hoovers?)', 'water ?pack', 'hydration bladders?'])) },
    { key: 'travel-accessories', label: 'Travel accessories', overlap: '', include: words(['travel (?:adapters?|adaptors?|plugs?|pillows?|wallets?|locks?|organi[sz]ers?|bottles?|kettles?|irons?|steamers?|hair ?dryers?|towels?|blankets?|cubes?|scales?|accessories)',
      '(?:universal|worldwide|international) (?:travel )?(?:adapters?|adaptors?|plugs?)', 'plug adapters?', 'neck pillows?', 'eye masks?', 'sleep masks?', 'packing cubes?', 'compression cubes?', 'luggage (?:tags?|scales?|straps?|locks?|covers?)',
      'tsa (?:locks?|approved)', 'passport (?:holders?|covers?|wallets?|cases?)', 'money belts?', 'toiletry bags?', 'wash bags?', 'washbags?', 'sponge bags?', 'dry bags?', 'document wallets?']),
      exclude: anyOf(TOYISH, PET, words(['travel size', 'travel-size', 'mini size', 'travel cot', 'travel system', 'pushchairs?', 'prams?', 'car seats?', 'travel mugs?', 'tumblers?', 'eye (?:creams?|gels?|serums?|patches)', 'gel', 'hydrating', 'hydrogel', 'collagen', 'skin ?care', 'beauty','face masks?', 'sheet masks?', 'masks? \\d+ ?ml'])) },
    { key: 'camping-outdoor', label: 'Camping and outdoor travel', overlap: '', include: words(['tents?', 'sleeping (?:bags?|mats?|pads?)', 'roll mats?', 'camping (?:stoves?|chairs?|tables?|lanterns?|lights?|cookware|kettles?|gear|beds?|pillows?|mats?|showers?|toilets?|equipment)',
      'camp (?:beds?|chairs?|stoves?|kitchens?)', 'bivvy', 'bivy', 'hammocks?', 'trekking poles?', 'walking poles?', 'hiking (?:boots?|poles?|shoes?)', 'head ?torch(?:es)?', 'water filter bottles?', 'mess tins?', 'gas canisters?']),
      exclude: anyOf(TOYISH, PET, words(['garden', 'gazebos?', 'event shelters?', 'party tents?', 'play', 'kids?', 'children', 'pop up (?:goals?|nets?)', 'tent pegs only', 'beer', 'wedding'])) }
  ] },
  { code: 'GAMING', name: 'Gaming Gear World', domain: 'gaminggearworld.com', categories: [
    { key: 'consoles', label: 'Consoles and handhelds', overlap: 'TGW Gaming', include: words(['playstation (?:5|portal)', 'ps5 (?:console|slim|pro|digital)', 'xbox series [xs]', 'xbox one (?:console|s|x)', 'nintendo switch(?: 2| oled| lite)?(?: console)?',
      'switch 2', 'switch oled', 'steam deck', 'rog ally', 'legion go', 'msi claw', 'games? consoles?', 'retro (?:consoles?|handhelds?)', 'handheld (?:consoles?|gaming)']),
      needs: words(['consoles?', 'console bundle', 'bundle', 'handheld', 'steam deck', 'rog ally', 'legion go', 'msi claw', 'oled model', 'lite', 'portal', 'slim', 'pro', 'digital edition', 'switch 2', '\\d+ ?(?:gb|tb)']),
      exclude: anyOf(TOYISH, MERCH, words(['console tables?', 'centre console', 'center console', 'tv consoles?', 'cases?', 'covers?', 'skins?', 'screen protectors?', 'stands?', 'chargers?', 'charging', 'docks?', 'cables?', 'bags?', 'games? (?:for|-)'])) },
    { key: 'video-games', label: 'Video games', overlap: 'TGW Gaming', include: anyOf(words(['video games?', 'computer games?', 'pc games?', 'game codes?', 'digital games?']),
      /\((?:ps5|ps4|xbox(?: series x\|s| series x| one)?|nintendo switch(?: 2)?|switch(?: 2)?|pc)\)|\b(?:ps5|ps4|xbox series x|nintendo switch 2?|switch 2) (?:game|edition)\b|[-–] (?:ps5|ps4|xbox series x|xbox one|nintendo switch 2?)\s*$/i),
      exclude: anyOf(TOYISH, MERCH, words(['consoles?', 'controllers?', 'headsets?', 'cases?', 'covers?', 'chargers?', 'cables?', 'books?', 'guides?', 'board games?', 'card games?', 'music cds?', 'blu-?ray', 'dvd'])) },
    { key: 'controllers-vr', label: 'Controllers, wheels and VR', overlap: 'TGW Gaming', include: words(['controllers?', 'game ?pads?', 'joy-?cons?', 'dualsense', 'dualshock', 'joysticks?', 'racing wheels?', 'steering wheels?', 'flight sticks?', 'hotas', 'arcade sticks?', 'fight sticks?',
      'vr headsets?', 'meta quest', 'oculus', 'ps vr2?', 'playstation vr2?', 'charging (?:stations?|docks?) for (?:ps5|xbox|switch|controllers?)', 'controller (?:chargers?|charging|stands?|grips?)']),
      needs: words(['ps5', 'ps4', 'playstation', 'xbox', 'nintendo', 'switch', 'gaming', 'games?', 'gamepads?', 'dualsense', 'dualshock', 'joy-?cons?', 'pc', 'steam', 'vr', 'quest', 'oculus', 'racing', 'flight', 'arcade', 'hotas', 'logitech g', 'thrustmaster', 'fanatec', 'razer', '8bitdo', 'turtle beach', 'nacon', 'powera', 'pdp']),
      exclude: anyOf(TOYISH, MERCH, words(['smart home', 'lighting controllers?', 'led controllers?', 'dj controllers?', 'midi', 'thermostats?', 'irrigation', 'sprinklers?', 'solar', 'charge controllers?', 'garage door', 'heating', 'drones?', 'rc cars?', 'remote control (?:cars?|boats?|trucks?)', 'mobility', 'wheelchairs?', 'car steering wheel covers?', 'tyres?', 'alloy'])) },
    { key: 'pc-gaming', label: 'PC gaming gear', overlap: 'TGW Gaming / Laptops', include: words(['gaming (?:mouse|mice|keyboards?|headsets?|headphones?|monitors?|laptops?|pcs?|desktops?|chairs?|desks?|mouse ?mats?|mouse ?pads?|mousepads?|microphones?|speakers?|routers?|earbuds?|glasses|towers?|cases?|seats?|stools?)',
      'mechanical keyboards?', 'esports', 'e-sports', 'graphics cards?', 'geforce rtx', 'rtx \\d{4}', 'radeon rx', 'capture cards?', 'stream decks?', 'elgato', 'racing (?:seats?|cockpits?|sim rigs?)', 'sim racing']),
      exclude: anyOf(TOYISH, MERCH, words(['casino', 'gambling', 'poker', 'roulette', 'fruit machines?'])) },
    { key: 'tabletop', label: 'Board, card and tabletop games', overlap: 'KGW toys', include: words(['board games?', 'card games?', 'trading cards?', 'tcg', 'booster (?:packs?|box(?:es)?|bundles?)', 'elite trainer box(?:es)?', 'warhammer', 'citadel', 'dungeons (?:&|and) dragons', 'd&d',
      'dice sets?', 'tabletop (?:games?|rpg)', 'roleplaying games?', 'rpg books?', 'miniatures? games?', 'magic: the gathering', 'magic the gathering', 'yu-?gi-?oh', 'pokemon (?:cards?|tcg)']),
      exclude: anyOf(MERCH, words(['jigsaw', 'puzzles?', 'baby', 'toddlers?', 'drinking games?', 'adult (?:games?|party)', 'sex', 'erotic', 'storage boxes', 'card holders?', 'greeting cards?', 'gift cards?', 'birthday cards?'])) }
  ] }
];

const COLS = {
  merchant: ['merchant_name'],
  name: ['product_name'],
  price: ['search_price', 'store_price', 'display_price', 'price'],
  currency: ['currency'],
  inStock: ['in_stock', 'is_for_sale', 'stock_status', 'stock_quantity'],
  gtin: ['ean', 'product_gtin', 'upc'],
  merchantCategory: ['merchant_category', 'merchant_product_category_path'],
  awinCategory: ['category_name']
};
function mapHeader(header) {
  const h = header.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
  return Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, names.map(n => h.indexOf(n)).filter(i => i >= 0)]));
}
const pick = (rec, idxs) => {
  for (const i of idxs) { const v = rec[i]; if (v !== undefined && String(v).trim() !== '') return String(v).trim(); }
  return '';
};
function inStock(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === '') return null;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  if (/^(yes|y|true|1|in stock|in_stock|instock|available|available to order|limited stock|low stock|pre-?order)$/.test(s)) return true;
  return false;
}

// Returns, for each candidate code, the category key the product fits (or nothing).
export function classifyProduct(name, feedCategory = '') {
  const text = `${name} | ${feedCategory}`;
  const out = {};
  for (const c of CANDIDATES) {
    for (const cat of c.categories) {
      if (!cat.include.test(text)) continue;
      if (cat.needs && !cat.needs.test(text)) continue;
      if (cat.exclude && cat.exclude.test(text)) continue;
      out[c.code] = cat.key;
      break;
    }
  }
  return out;
}

// Members list made by the .ps1: advertiser_id,advertiser,region,membership,products,feed_name,vertical (no key, no URL).
export function readMembers(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const map = new Map();
  if (lines.length < 2) return map;
  const parse = line => {
    const out = []; let f = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { out.push(f); f = ''; } else f += ch;
    }
    out.push(f); return out;
  };
  const head = parse(lines[0]).map(h => h.trim().toLowerCase());
  const at = n => head.indexOf(n);
  for (const line of lines.slice(1)) {
    const r = parse(line);
    const id = Number(r[at('advertiser_id')]);
    if (!id) continue;
    const m = map.get(id) || { id, name: r[at('advertiser')] || '', region: r[at('region')] || '', membership: r[at('membership')] || '', products: 0, feeds: [], vertical: r[at('vertical')] || '' };
    m.products += Number(r[at('products')]) || 0;
    if (r[at('feed_name')]) m.feeds.push(r[at('feed_name')]);
    // One retailer can have several feeds: a member on any of them is a member.
    const status = String(r[at('membership')] || '').trim();
    if (status && !isMember(m)) m.membership = status;
    map.set(id, m);
  }
  return map;
}
export const isMember = m => !!m && /^(active|joined)$/i.test(String(m.membership || '').trim());

// Retailer names in the Awin list that point to a niche (only a hint: a person checks the programme).
export const NAME_HINTS = {
  TRAVEL: words(['travel', 'luggage', 'suitcases?', 'bags?', 'backpacks?', 'rucksacks?', 'outdoors?', 'camping', 'hiking', 'adventure', 'trek', 'samsonite', 'american tourister', 'antler', 'osprey',
    'eastpak', 'kipling', 'tumi', 'delsey', 'cabin ?max', 'cabin zero', 'tripp', 'rimowa', 'herschel', 'deuter', 'vango', 'coleman', 'go outdoors', 'blacks', 'millets', 'cotswold', 'snow \\+ rock', 'trespass', 'regatta', 'berghaus', 'karrimor', 'decathlon']),
  GAMING: words(['games?', 'gaming', 'gamer', 'consoles?', 'esports', 'playstation', 'xbox', 'nintendo', 'razer', 'corsair', 'logitech', 'steelseries', 'hyperx', 'turtle beach', 'secretlab', 'noblechairs',
    'scan', 'overclockers', 'cex', 'ccl', 'novatech', 'chillblast', 'pc specialist', 'pcspecialist', 'alienware', 'msi', 'asus rog', 'warhammer', 'zatu', 'board ?games?', 'magic madhouse', 'chaos cards'])
};

export async function scan({ archive, members = new Map(), maxRows = Infinity, log = () => {} }) {
  const files = readdirSync(archive).filter(f => /^AWIN_\d+_\d+\.csv(\.gz)?$/i.test(f)).sort();
  const res = { files: files.length, rows: 0, errors: [], candidates: {} };
  for (const c of CANDIDATES) {
    res.candidates[c.code] = { code: c.code, retailers: new Map(), cats: Object.fromEntries(c.categories.map(k => [k.key, { rows: 0, keys: new Set(), samples: [], tgw: 0 }])),
      keys: new Set(), rows: 0, outOfStock: 0, tgw: 0, gbp: [], currencies: {} };
  }
  let i = 0;
  for (const f of files) {
    i++;
    const adv = Number(f.match(/^AWIN_(\d+)_/i)[1]);
    try {
      const raw = createReadStream(join(archive, f));
      const stream = /\.gz$/i.test(f) ? raw.pipe(createGunzip()) : raw;
      let map = null, n = 0;
      for await (const rec of readCsvRecords(stream)) {
        if (!map) { map = mapHeader(rec); continue; }
        if (rec.length < 3) continue;
        n++; res.rows++;
        if (n > maxRows) break;
        const name = cleanText(pick(rec, map.name));
        if (!name) continue;
        const cat = cleanText([pick(rec, map.merchantCategory), pick(rec, map.awinCategory)].filter(Boolean).join(' > '));
        const fit = classifyProduct(name, cat);
        const codes = Object.keys(fit);
        if (!codes.length) continue;
        const price = parsePrice(pick(rec, map.price));
        if (!(price > 0)) continue;
        const stock = inStock(pick(rec, map.inStock));
        const cur = (pick(rec, map.currency).toUpperCase() || '?').slice(0, 3);
        const gtin = pick(rec, map.gtin).replace(/\D/g, '');
        const merchant = pick(rec, map.merchant);
        const key = /^\d{8,14}$/.test(gtin) ? `ean:${gtin.replace(/^0+/, '')}` : `${adv}:${name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
        const tgw = tgwClassify(name, cat);
        for (const code of codes) {
          const C = res.candidates[code];
          if (stock === false) { C.outOfStock++; continue; }
          const k = fit[code];
          const r = C.retailers.get(adv) || { id: adv, merchant: '', rows: 0, keys: new Set(), tgw: 0, prices: [], currencies: {}, cats: {}, samples: [] };
          r.merchant = r.merchant || merchant;
          r.rows++; r.keys.add(key); r.prices.push(price); r.currencies[cur] = (r.currencies[cur] || 0) + 1; r.cats[k] = (r.cats[k] || 0) + 1;
          if (tgw.ok) r.tgw++;
          if (r.samples.length < SAMPLES_PER_RETAILER && r.rows % 37 === 1) r.samples.push(`${name.slice(0, 70)} (${price} ${cur})`);
          C.retailers.set(adv, r);
          const K = C.cats[k];
          K.rows++; K.keys.add(key); if (tgw.ok) K.tgw++;
          if (K.samples.length < SAMPLES_PER_CATEGORY && K.rows % 53 === 1) K.samples.push(`${name.slice(0, 70)} | ${merchant || adv} | ${price} ${cur}${tgw.ok ? ' | TGW takes it' : ''}`);
          C.rows++; C.keys.add(key); if (tgw.ok) C.tgw++;
          C.currencies[cur] = (C.currencies[cur] || 0) + 1;
          if (cur === 'GBP' && C.gbp.length < 400000) C.gbp.push(price);
        }
      }
    } catch (e) {
      res.errors.push(`${f}: ${String(e && e.message || e).slice(0, 120)}`);
    }
    log(`${i}/${files.length} ${f}`);
  }
  res.members = members;
  return res;
}

const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const share = (a, min) => (a.length ? Math.round((a.filter(p => p >= min).length / a.length) * 100) : 0);
const fmt = n => new Intl.NumberFormat('en-GB').format(n);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
const topCur = c => (Object.entries(c).sort((a, b) => b[1] - a[1])[0] || ['?'])[0];

export function renderReport(res, { archive = '', membersChecked = false, generated = new Date() } = {}) {
  const L = [];
  const members = res.members || new Map();
  L.push(`GEAR WORLD NEW SITE SCAN (read-only) ${generated.toISOString().slice(0, 16).replace('T', ' ')} | ${VERSION}`);
  L.push(`Archive: ${archive}`);
  L.push(`Feed files: ${res.files} | Rows read: ${fmt(res.rows)} | Awin membership: ${membersChecked ? `checked (${members.size} retailers in the Awin list)` : 'NOT checked (no saved Awin feed key on this PC)'}`);
  if (res.errors.length) L.push(`Files that could not be read: ${res.errors.length} (${res.errors.slice(0, 3).join('; ')})`);
  L.push('Counts: products with a name and a price, not marked out of stock. "Distinct" joins the same EAN from different retailers.');
  L.push('"TGW takes it": the Technology Gear World rules would already put the product on technologygearworld.com.');
  L.push('');

  const summary = [];
  for (const c of CANDIDATES) {
    const C = res.candidates[c.code];
    const advs = [...C.retailers.values()];
    const joined = advs.filter(r => isMember(members.get(r.id)));
    const joinedRows = joined.reduce((t, r) => t + r.rows, 0);
    const joinedKeys = new Set(); for (const r of joined) for (const k of r.keys) joinedKeys.add(k);
    summary.push({ c, C, advs, joined, joinedRows, joinedKeys });
  }
  L.push('== SIDE BY SIDE ==');
  const row = (label, f) => L.push(`  ${label.padEnd(44)} ${summary.map(s => String(f(s)).padStart(20)).join('')}`);
  row('', s => s.c.name.replace(' Gear World', ''));
  row('Retailers with matching products', s => fmt(s.advs.length));
  if (membersChecked) row('  of which you are a member', s => fmt(s.joined.length));
  row('Products (in stock or unknown)', s => fmt(s.C.rows));
  row('Distinct products', s => fmt(s.C.keys.size));
  if (membersChecked) row('Distinct products from member retailers', s => fmt(s.joinedKeys.size));
  row('TGW already takes them', s => `${fmt(s.C.tgw)} (${pct(s.C.tgw, s.C.rows)})`);
  row('Products NOT on TGW rules', s => fmt(s.C.rows - s.C.tgw));
  row('Median price (GBP products)', s => (s.C.gbp.length ? `£${median(s.C.gbp)}` : '-'));
  row('Share priced £50 or more (GBP)', s => `${share(s.C.gbp, 50)}%`);
  row('Share priced £100 or more (GBP)', s => `${share(s.C.gbp, 100)}%`);
  row('Products in other currencies', s => fmt(s.C.rows - (s.C.currencies.GBP || 0)));
  row('Marked out of stock (not counted)', s => fmt(s.C.outOfStock));
  L.push('');

  for (const s of summary) {
    const { c, C, advs } = s;
    L.push(`== ${c.name.toUpperCase()} (${c.domain}) ==`);
    L.push('-- Categories --');
    for (const cat of c.categories) {
      const K = C.cats[cat.key];
      L.push(`  ${cat.label.padEnd(36)} ${fmt(K.rows).padStart(9)} products  ${fmt(K.keys.size).padStart(9)} distinct  TGW takes ${pct(K.tgw, K.rows).padStart(4)}${cat.overlap ? `  (overlap: ${cat.overlap})` : ''}`);
      for (const smp of K.samples) L.push(`      - ${smp}`);
    }
    L.push(`-- Retailers (biggest first, ${Math.min(advs.length, RETAILERS_SHOWN)} of ${advs.length}) --`);
    for (const r of advs.sort((a, b) => b.rows - a.rows).slice(0, RETAILERS_SHOWN)) {
      const m = members.get(r.id);
      const status = membersChecked ? (m ? (isMember(m) ? 'MEMBER' : (m.membership || '?')) : 'not in list') : '';
      const cats = Object.entries(r.cats).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${(c.categories.find(x => x.key === k) || {}).label || k} ${fmt(n)}`).join(', ');
      L.push(`  ${String(r.id).padEnd(7)} ${(r.merchant || (m && m.name) || '?').slice(0, 30).padEnd(30)} ${fmt(r.rows).padStart(8)}  median ${median(r.prices)} ${topCur(r.currencies)}  TGW takes ${pct(r.tgw, r.rows)}${status ? `  ${status}` : ''}${m && m.region ? ` ${m.region}` : ''}`);
      L.push(`          ${cats}`);
      for (const smp of r.samples) L.push(`          - ${smp}`);
    }
    if (membersChecked) {
      const have = new Set(advs.map(r => r.id));
      const hints = [...members.values()].filter(m => !have.has(m.id) && NAME_HINTS[c.code].test(`${m.name} ${m.feeds.join(' ')} ${m.vertical}`))
        .sort((a, b) => (isMember(b) - isMember(a)) || (b.products - a.products)).slice(0, 25);
      L.push(`-- Other retailers in your Awin list whose name points to ${c.code.toLowerCase()} (no feed on this PC yet; check each programme) --`);
      if (!hints.length) L.push('  (none)');
      for (const m of hints) L.push(`  ${String(m.id).padEnd(7)} ${m.name.slice(0, 34).padEnd(34)} ${(isMember(m) ? 'MEMBER' : (m.membership || '?')).padEnd(12)} ${m.region.padEnd(4)} ${fmt(m.products).padStart(9)} products in the Awin list`);
    }
    L.push('');
  }
  L.push('Note: the words decide a first sort (L14); before any import each retailer still gets its own plan with samples.');
  L.push('Commission rates are not in the feeds: check them on each programme page in Awin before deciding.');
  return L.join('\n') + '\n';
}

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = resolve(val('archive') || '');
  const out = resolve(val('out') || 'new-site-scan.txt');
  if (!val('archive') || !existsSync(archive)) { console.error(`Archive folder not found: ${archive}`); process.exit(2); }
  const membersFile = val('members');
  const membersChecked = !!(membersFile && existsSync(membersFile));
  const members = membersChecked ? readMembers(readFileSync(membersFile, 'utf8')) : new Map();
  const res = await scan({ archive, members, maxRows: Number(val('max-rows')) || Infinity, log: m => process.stdout.write(`\r${m}`.padEnd(100)) });
  process.stdout.write('\n');
  writeFileSync(out, '﻿' + renderReport(res, { archive, membersChecked }));
  console.log(`Report: ${out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
