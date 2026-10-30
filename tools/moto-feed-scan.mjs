#!/usr/bin/env node
// Biker feed scan. READ-ONLY: reads the Awin feed files on this PC (and, if given, a copy of the Awin feed list)
// and writes a report. It imports nothing and changes no file.
// For the planned Biker Gear World site (bikergearworld.com, proposed code BGW).
// Owner (29 Oct 2026): motorbikes and scooters. Bicycles and e-bikes stay on Sporty Gear World (SGW), so they are
// counted apart, like the products of the other sites. Kick scooters, for adults and children, are BGW products.
//
// 1. Feeds on this PC, in one or more folders (AWIN_<advertiserId>_<feedId>.csv[.gz] and Google Shopping files
//    "<advertiserId>-<name>.csv[.gz]"). When the same file is in two folders, the newest copy counts (L41).
//    Per retailer: how many DIFFERENT biker products (Google files: all sizes of a product are one product, L34),
//    per proposed category, in stock, currencies, top shop categories and samples.
// 2. Products that belong to another Gear World site are counted apart, for the "yes" and "no" rules (L14):
//    bicycles and e-bikes (SGW), kids' ride-on toys (KGW). Products that also fit the real SGW, AGW, VGW or TGW
//    rules stay BGW products and are flagged.
// 3. Awin feed list (optional, --list <csv>): which programmes look like motorbike or scooter retailers, joined or
//    not, with the link to apply. Insurance, training courses, rentals and finance are left out (no products to show).
//
// Usage: node tools/moto-feed-scan.mjs --archive <dir>[;<dir>...] --out <dir> [--list <feed list csv>] [--max-rows <n per feed>]
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords, googleBaseName } from './tgw-import-plan.mjs';
import * as TGW_RULES from '../sites/tgw/category-rules.js';
import * as AGW_RULES from '../sites/agw/category-rules.js';
import * as VGW_RULES from '../sites/vgw/category-rules.js';
import * as SGW_RULES from '../sites/sgw/category-rules.js';

// A list of regex fragments -> one regex with word edges (L42: "gin" must not match "Original").
const words = list => new RegExp(`(?<![a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');

// Words that say "this is for a motorbike or a scooter rider". The shop's own category counts too.
// "Riding" alone is not one (horse riding); "bike" alone is not one either (bicycles stay on SGW).
export const BIKER_CTX = words(['motorcycles?', 'motor ?cycles?', 'motorbikes?', 'motor ?bikes?', 'moto', 'motocross', 'mx', 'enduro', 'trials? bikes?',
  'bikers?', "biker's", 'superbikes?', 'sports? bikes?', 'adventure bikes?', 'touring bikes?', 'cafe racers?', 'mopeds?', 'scooters?', 'e-?scooters?',
  'motorcycling', 'riders? (?:jackets?|gloves?|boots?|jeans|trousers|suits?|armou?r)', 'cbt', 'pit ?bikes?', 'dirt ?bikes?', 'quad bikes?', 'atv']);
// A shop category that says motorbike or scooter ("Motorcycle > Clothing", "Electric Scooters > Parts").
export const BIKER_SHOP = words(['motorcycles?', 'motorbikes?', 'motorcycling', 'moto', 'motocross', 'bikers?', 'mopeds?', 'scooters?', 'e-?scooters?',
  'electric scooters?', 'kick scooters?', 'rider (?:wear|clothing|gear)', 'riding (?:gear|apparel)(?! (?:horse|equestrian))', 'powersports']);

// Not biker products, even with a biker word (L42): toys and models, prints and decor, horse riding, phone cases.
export const NO = words(['die ?cast', 'diecast', 'scale models?', 'model kits?', '1 ?: ?\\d+ scale', 'lego', 'playmobil', 'toy (?:motorbikes?|motorcycles?|scooters?)',
  'rc (?:motorbikes?|motorcycles?)', 'remote control', 'posters?', 'wall art', 'canvas prints?', 'framed prints?', 'stickers?', 'decals?', 'mugs?', 'keyrings?',
  'key chains?', 'greeting cards?', 'birthday cards?', 'gift cards?', 'vouchers?', 'books?', 'paperback', 'hardback', 'magazines?', 'calendars?', 'jigsaws?',
  'puzzles?', 'costumes?', 'fancy dress', 'party', 'balloons?', 'cake toppers?', 'bedding', 'duvet(?: cover)?s?', 'cushions?', 'curtains?', 'wallpaper',
  'phone cases?', 'iphone cases?', 'video games?', 'ps4', 'ps5', 'xbox', 'nintendo', 'horse riding', 'equestrian', 'jodhpurs', 'riding (?:hats?|boots?) for horse',
  'mobility scooters?', 'scooter (?:batteries for|for) (?:mobility|disabled)', 'lawn ?mowers?', 'scooter parks?', 'snow ?scooters?', 'jet ?skis?', 'water scooters?',
  'underwater scooters?', 'sea scooters?', 'diving scooters?', 'dive scooters?', 'perfumes?', 'eau de (?:toilette|parfum)', 'aftershave', 't-?shirts? with', 'print t-?shirts?']);

// Proposed BGW categories (first match wins; "ctx" words count only with a biker word or a biker shop category).
export const CATEGORIES = [
  {
    key: 'helmets', label: 'Motorbike helmets',
    sure: words(['(?:motorcycle|motorbike|moto|motocross|mx|enduro|scooter|moped|full ?face|flip ?(?:front|up)|modular|open ?face|jet|adventure|dual sport|off ?road) helmets?',
      'helmet visors?', 'pinlock(?: inserts?)?', 'helmet (?:locks?|bags?)', 'shoei', 'arai', 'agv', 'hjc', 'shark (?:spartan|skwal|ridill|evo|race)', 'nolan', 'schuberth', 'ls2', 'caberg', 'bell (?:mx|moto|qualifier|srt|star|eliminator)']),
    ctx: words(['helmets?', 'visors?']),
    shop: words(['helmets?'])
  },
  {
    key: 'jackets-trousers', label: 'Motorbike jackets & trousers',
    sure: words(['(?:motorcycle|motorbike|moto|biker|riding|textile|cordura|kevlar|armou?red|motocross|mx|enduro|touring|adventure|scooter) (?:jackets?|trousers|pants|jeans|leggings|suits?|leathers)',
      '(?:one|two|1|2) ?-?piece (?:leathers|suits?)', 'race (?:leathers|suits?)', 'kevlar (?:jeans|leggings|hoodies?|shirts?)', 'armou?red (?:hoodies?|shirts?|jeans)', 'over ?suits?',
      'rain ?suits? for (?:motorcycle|motorbike)', 'mx (?:jerseys?|shirts?)', 'motocross (?:jerseys?|shirts?)', 'heated (?:jackets?|vests?|gilets?) for (?:motorcycle|motorbike|riding)']),
    ctx: words(['jackets?', 'trousers', 'pants', 'jeans', 'leggings', 'suits?', 'leathers', 'jerseys?', 'hoodies?', 'base ?layers?', 'thermal', 'waterproofs?', 'gilets?']),
    shop: words(['jackets?', 'trousers', 'clothing', 'apparel', 'leathers', 'textiles?'])
  },
  {
    key: 'boots-gloves', label: 'Motorbike boots & gloves',
    sure: words(['(?:motorcycle|motorbike|moto|motocross|mx|enduro|touring|racing|riding|biker|scooter) (?:boots?|shoes|trainers?|gloves?|gauntlets?)',
      'heated (?:gloves?|insoles?) for (?:motorcycle|motorbike)', 'glove liners?', 'handlebar muffs?', 'hand ?guards?', 'bar mitts?']),
    ctx: words(['boots?', 'gloves?', 'gauntlets?', 'shoes', 'socks?']),
    shop: words(['boots?', 'gloves?', 'footwear'])
  },
  {
    key: 'parts-maintenance', label: 'Parts & maintenance',
    sure: words(['(?:motorcycle|motorbike|moto|scooter|moped) (?:oil|batter(?:y|ies)|chains?|tyres?|tires?|inner tubes?|brake pads?|brake discs?|spark plugs?|filters?|mirrors?|indicators?|levers?|grips?|exhausts?|silencers?|sprockets?|clutch|cables?|bulbs?|lights?|headlights?|parts?|spares?)',
      'chain (?:lube|lubes|cleaner|wax|kits?)', 'sprocket kits?', 'paddock stands?', '(?:motorcycle|motorbike) (?:lifts?|jacks?|ramps?|stands?)', 'front stands?', 'rear stands?', 'wheel chocks?',
      '10w-?40 4t', '20w-?50 4t', '4t (?:engine )?oil', '2t (?:engine )?oil', 'fork oil', 'optimate', 'battery tenders?', 'tyre (?:levers?|warmers?)', 'puncture repair kits?']),
    ctx: words(['oil', 'batter(?:y|ies)', 'chains?', 'tyres?', 'tires?', 'brake pads?', 'brake discs?', 'spark plugs?', 'filters?', 'mirrors?', 'indicators?', 'levers?',
      'grips?', 'exhausts?', 'silencers?', 'sprockets?', 'bulbs?', 'headlights?', 'parts?', 'spares?', 'cleaners?', 'polish', 'tools?', 'stands?', 'chargers?', 'tubes?', 'motors?', 'controllers?', 'throttles?', 'wheels?']),
    shop: words(['parts?', 'spares?', 'maintenance', 'workshop', 'tyres?', 'oils?', 'lubricants?', 'batter(?:y|ies)', 'tools?'])
  },
  {
    key: 'luggage-security', label: 'Luggage, locks & covers',
    sure: words(['top ?box(?:es)?', 'top ?cases?', 'panniers?', 'tank ?bags?', 'tail ?bags?', 'seat ?bags? for (?:motorcycle|motorbike)', 'saddle ?bags?', 'roll ?bags? for (?:motorcycle|motorbike)',
      'disc ?locks?', 'disk ?locks?', 'ground anchors?', '(?:motorcycle|motorbike|scooter|moped) (?:covers?|locks?|alarms?|trackers?|chains? and locks?|luggage|bags?|racks?|backrests?)',
      'luggage racks? for (?:motorcycle|motorbike|scooter)', 'givi', 'kriega', 'oxford (?:monster|boss|hd|patriot)', 'almax', 'abus granit']),
    ctx: words(['bags?', 'covers?', 'locks?', 'alarms?', 'racks?', 'luggage', 'backpacks?', 'trackers?']),
    shop: words(['luggage', 'security', 'locks?', 'covers?', 'bags?'])
  },
  {
    key: 'electronics', label: 'Intercoms, cameras & sat nav',
    sure: words(['(?:motorcycle|motorbike|helmet|bike to bike) (?:intercoms?|communicators?|headsets?|speakers?|bluetooth)', 'cardo (?:packtalk|freecom|spirit)', 'sena (?:\\d+[a-z]*|spider|50s|30k|20s|10s|smh)',
      'helmet (?:cameras?|cams?|mounts?)', '(?:motorcycle|motorbike|scooter) (?:phone (?:mounts?|holders?)|sat ?navs?|gps|usb (?:chargers?|sockets?)|dash ?cams?|cameras?)', 'heated grips?',
      'tom ?tom rider', 'garmin zumo', 'quad ?lock', 'sp connect']),
    ctx: words(['intercoms?', 'headsets?', 'bluetooth', 'cameras?', 'dash ?cams?', 'phone (?:mounts?|holders?)', 'sat ?navs?', 'gps', 'usb', 'chargers?', 'mounts?']),
    shop: words(['electronics', 'communication', 'intercoms?', 'cameras?', 'navigation'])
  },
  {
    key: 'electric-scooters', label: 'Electric scooters',
    sure: words(['e-?scooters?', 'electric (?:kick )?scooters?', 'electric folding scooters?', 'xiaomi (?:mi )?(?:electric )?scooters?', 'segway ninebot', 'ninebot (?:max|kickscooter|f\\d+|g\\d+|e\\d+|d\\d+)',
      'pure (?:air|advance|escape|flex)', 'iscooter', 'e-?scooter (?:tyres?|tires?|batter(?:y|ies)|chargers?|mudguards?|bags?|locks?|parts?|inner tubes?)']),
    ctx: words(['electric', 'e-?scooters?', 'motorised', 'motorized', 'battery powered', '\\d{3,4} ?w', '\\d{2} ?km/h', '\\d{2} ?mph']),
    shop: words(['electric scooters?', 'e-?scooters?', 'e-?mobility', 'personal mobility'])
  },
  {
    key: 'kick-scooters', label: 'Kick scooters',
    sure: words(['kick ?scooters?', 'push scooters?', 'stunt scooters?', 'pro scooters?', 'micro (?:maxi|mini|sprite|scooters?)', 'folding scooters?', '(?:2|3|two|three) wheel(?:ed)? scooters?',
      '(?:kids|childrens?|adult|teen|junior) scooters?', 'scooter (?:wheels?|decks?|bars?|grips?|clamps?|forks?|bearings?|pegs?)', 'trikke']),
    ctx: words(['scooters?']),
    shop: words(['scooters?', 'kick scooters?', 'stunt scooters?'])
  },
  {
    key: 'electric-mopeds', label: 'Electric mopeds & motorbikes',
    sure: words(['electric (?:mopeds?|motorbikes?|motorcycles?|motor ?scooters?)', 'e-?mopeds?', '(?:50|125) ?cc (?:mopeds?|scooters?|motorbikes?|motorcycles?)', 'mopeds?',
      'pit ?bikes?', 'dirt ?bikes?', 'super ?soco', 'niu (?:n|m|nqi|mqi|uqi)', 'talaria', 'sur-?ron', 'quad bikes?', 'atv']),
    ctx: words(['electric', 'petrol', '\\d{2,4} ?cc', 'road legal']),
    shop: words(['mopeds?', 'electric motorbikes?', 'electric motorcycles?', 'vehicles?', 'powersports'])
  },
  {
    key: 'safety', label: 'Protection & visibility',
    sure: words(['back protectors?', 'chest protectors?', 'body armou?r', 'ce (?:level )?[12] (?:armou?r|protectors?)', 'airbag (?:vests?|jackets?)', 'knee sliders?', 'neck braces?',
      'body protectors?', '(?:motorcycle|motorbike|riding) ear ?plugs?', 'hi-?vis (?:vests?|belts?|bibs?) for (?:motorcycle|motorbike|riders?|bikers?)', 'reflective (?:vests?|belts?|stickers? for helmets?)',
      'knee (?:pads?|guards?) for (?:scooter|motorcycle|motocross)', 'elbow (?:pads?|guards?) for (?:scooter|motorcycle|motocross)', 'roost (?:guards?|deflectors?)', 'pressure suits?']),
    ctx: words(['armou?r', 'protectors?', 'airbags?', 'hi-?vis', 'reflective', 'pads?', 'guards?', 'ear ?plugs?', 'neck tubes?', 'balaclavas?', 'snoods?']),
    shop: words(['protection', 'armou?r', 'safety', 'hi-?vis'])
  }
];
export const OTHER = { key: 'other-biker', label: 'Other motorbike & scooter products' };

// Products that go to another Gear World site. Checked in this order, before the biker category.
// Kids' kick scooters are BGW products (owner, 29 Oct 2026); kids' ride-on toys are not.
export const OVERLAPS = [
  { key: 'bicycles', always: true, label: 'Bicycles & e-bikes (stay on Sporty Gear World, SGW)', re: words(['bicycles?', 'cycling', 'cyclists?', 'cycle (?:helmets?|lights?|locks?|jerseys?|shorts|shoes|computers?|pumps?|racks?)',
    'mtb', 'mountain ?bikes?', 'road ?bikes?', 'gravel ?bikes?', 'hybrid ?bikes?', 'bmx', 'e-?bikes?', 'electric (?:bikes?|bicycles?)', 'pedal assist', 'turbo trainers?', 'bike (?:pedals?|saddles?|derailleurs?|cassettes?|chainrings?)',
    'shimano', 'sram', 'brompton', 'tern', 'carrera (?:crossfire|subway|vengeance|impel|zelos|fury|valour)']),
    unless: words(['motorcycles?', 'motorbikes?', 'motocross', 'scooters?', 'mopeds?', 'pit ?bikes?', 'dirt ?bikes?']) },
  // "Biker jacket" and "biker boots" are also a fashion style (leather, studs) sold by fashion shops.
  { key: 'fashion', always: true, label: 'Fashion biker jackets & boots (Men\'s / Women\'s Gear World)', re: words(['biker (?:style )?(?:jackets?|boots?|coats?|ankle boots?)',
    '(?:faux|vegan|pu) leather (?:biker|moto)', 'moto (?:style )?jackets?', 'biker chic']),
    unless: words(['motorcycles?', 'motorbikes?', 'armou?r(?:ed)?', 'ce (?:level|approved|certified)', 'protectors?', 'cordura', 'kevlar', 'textile', 'touring', 'racing', 'waterproof motorcycle', 'riding']) },
  { key: 'kids', label: 'Kids\' ride-on toys (Kids\' Gear World, KGW)', re: words(['ride ?on', 'ride-ons?', 'kids? (?:electric )?(?:motorbikes?|motorcycles?|quads?|atvs?|cars?)', 'children\'?s (?:electric )?(?:motorbikes?|motorcycles?|quads?)',
    'toddler', 'baby', 'babies', 'balance bikes?', 'trikes?', 'tricycles?', 'toys?']), unless: words(['scooters?']) }
];
// Checked with the real rules of the other new sites, only for products that matched a BGW category.
export const SITE_RULES = [
  { key: 'sgw', label: 'Also matches the Sporty Gear World rules (SGW)', rules: SGW_RULES },
  { key: 'agw', label: 'Also matches the Car Gear World rules (AGW)', rules: AGW_RULES },
  { key: 'vgw', label: 'Also matches the Travel Gear World rules (VGW)', rules: VGW_RULES },
  { key: 'tgw', label: 'Also matches the Technology Gear World rules (TGW)', rules: TGW_RULES }
];
const OVERLAP_KEYS = OVERLAPS.map(o => o.key);
const ALSO_KEYS = SITE_RULES.map(s => s.key);
const overlapLabel = k => (OVERLAPS.find(o => o.key === k) || SITE_RULES.find(s => s.key === k) || { label: k }).label;

// Words in a programme's name that point to a motorbike or scooter retailer (for the Awin list).
export const PROGRAMME_WORDS = words(['motorcycles?', 'motorbikes?', 'motorcycling', 'moto', 'motocross', 'mx', 'bikers?', 'superbikes?', 'mopeds?', 'scooters?', 'e-?scooters?',
  'helmets?', 'leathers', 'sportsbikeshop', 'sportsbike', 'ghost ?bikes', 'wemoto', 'j ?& ?s', 'jands', 'demon ?tweeks', 'infinity motorcycles', 'motorcycle ?(?:clothing|products|direct)',
  'pure electric', 'segway', 'ninebot', 'iscooter', 'e-?mobility', 'oxford products', 'cardo', 'sena', 'givi', 'richa', 'alpinestars', 'dainese', 'rst', 'furygan', 'held', 'rev\\W?it']);
// Programmes that sell insurance, training, rentals, finance or trips, not products: left out of the list.
export const PROGRAMME_NO = words(['insurance', 'insure', 'cover(?:age)?', 'training', 'lessons?', 'courses?', 'cbt', 'rentals?', 'hire', 'finance', 'loans?', 'leasing',
  'tours?', 'holidays?', 'hotels?', 'tickets?', 'events?', 'magazines?', 'subscriptions?', 'mobility']);

export function isBikerProgramme(name, vertical = '') {
  const t = String(name || '');
  if (PROGRAMME_NO.test(t)) return false;
  return PROGRAMME_WORDS.test(t) || /motor|scooter/i.test(String(vertical || ''));
}

const low = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[’`]/g, "'").replace(/[ \s]+/g, ' ').trim();

// name: product name; shopCat: the shop's category and Awin's category. Returns
//   { sport: true, cat }                         a product for BGW ("sport" keeps the shared report code)
//   { sport: true, cat, also }                   a product for BGW that also fits the rules of SGW, AGW, VGW or TGW
//   { sport: false, overlap, cat }               a product that belongs to another site
//   { sport: false }                             not a BGW product
export function classify(name, shopCat = '') {
  const n = low(name), c = low(shopCat);
  if (!n || NO.test(n)) return { sport: false, why: 'no-list' };
  const bikerShop = BIKER_SHOP.test(c);
  const ctx = BIKER_CTX.test(n) || bikerShop;
  // Bicycles first: they stay on SGW, even in a motorbike shop (owner, 29 Oct 2026).
  for (const o of OVERLAPS) {
    if (!o.always && !ctx) continue;
    if (o.re.test(n) && !(o.unless && o.unless.test(n))) {
      let cat = null;
      for (const k of CATEGORIES) if (k.sure.test(n)) { cat = k.key; break; }
      return { sport: false, overlap: o.key, cat };
    }
  }
  // First the clear names of every category, then the general words (so "helmet camera" is electronics, not a helmet).
  let cat = null;
  for (const k of CATEGORIES) if (k.sure.test(n)) { cat = k.key; break; }
  if (!cat && ctx) for (const k of CATEGORIES) if (k.ctx && k.ctx.test(n)) { cat = k.key; break; }
  // Second chance: the shop's own biker category says which one ("Motorcycle > Clothing > Gloves").
  if (!cat && bikerShop) for (const k of CATEGORIES) if (k.shop && k.shop.test(c)) { cat = k.key; break; }
  if (!cat && bikerShop && BIKER_CTX.test(n)) cat = OTHER.key;
  if (!cat) return { sport: false };
  for (const s of SITE_RULES) {
    let ok = false;
    try { ok = !!s.rules.classify(name, shopCat, shopCat).ok; } catch { ok = false; }
    if (ok) return { sport: true, cat, also: s.key };
  }
  return { sport: true, cat };
}

// ---------- Reading the feeds ----------

const AWIN_COLS = {
  merchant: ['merchant_name'], name: ['product_name'], desc: ['product_short_description'],
  price: ['search_price', 'store_price', 'display_price', 'price'], currency: ['currency'],
  qty: ['stock_quantity'], flag: ['in_stock', 'is_for_sale', 'stock_status'],
  shopCat: ['merchant_category', 'merchant_product_category_path'], awinCat: ['category_name'], brand: ['brand_name']
};
const GOOGLE_COLS = {
  merchant: [], name: ['title'], desc: ['description'], price: ['sale_price', 'price'], currency: [], qty: [], flag: ['availability'],
  shopCat: ['product_type'], awinCat: ['google_product_category'], brand: ['brand']
};
function mapHeader(header) {
  const h = header.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
  const google = !h.includes('product_name') && h.includes('title') && (h.includes('link') || h.includes('id'));
  const cols = google ? GOOGLE_COLS : AWIN_COLS;
  return { google, ...Object.fromEntries(Object.entries(cols).map(([k, names]) => [k, names.map(x => h.indexOf(x)).filter(i => i >= 0)])) };
}
const pick = (rec, idxs) => { for (const i of idxs) { const v = rec[i]; if (v !== undefined && String(v).trim() !== '') return String(v).trim(); } return ''; };

// In stock: a quantity number wins (L64: "in stock" with quantity 0 is out of stock), else the flag (L37).
export function inStock(qty, flag) {
  const q = String(qty || '').trim();
  if (/^\d+(\.0+)?$/.test(q)) return Number(q) > 0;
  const s = String(flag || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === '') return null;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  if (/^(yes|y|true|in_stock|instock|available|available_to_order|limited_stock|preorder|backorder)$/.test(s)) return true;
  return false;
}

// Every feed file in the folders. The same file name in two folders: the newest copy counts (L41).
export function listFeedFiles(archives) {
  const best = new Map();
  for (const dir of archives) {
    let names = [];
    try { names = readdirSync(dir); } catch { continue; }
    for (const f of names) {
      const awin = f.match(/^AWIN_(\d+)_(\d+)\.csv(\.gz)?$/i);
      const google = !awin && f.match(/^(\d{2,7})-[^\\/]*\.csv(\.gz)?$/i);
      if (!awin && !google) continue;
      const full = join(dir, f);
      let mtime = 0;
      try { const st = statSync(full); if (!st.isFile()) continue; mtime = st.mtimeMs; } catch { continue; }
      const key = f.toLowerCase().replace(/\.gz$/, '');
      const had = best.get(key);
      if (!had || mtime > had.mtime) best.set(key, { file: f, path: full, dir, mtime, advertiserId: Number((awin || google)[1]), kind: awin ? 'awin' : 'google' });
    }
  }
  return [...best.values()].sort((a, b) => a.advertiserId - b.advertiserId || a.file.localeCompare(b.file));
}

export async function scanArchive({ archives, maxRows = Infinity, log = () => {}, now = Date.now() }) {
  const all = listFeedFiles(archives);
  const files = [];
  const byAdv = new Map();
  let i = 0;
  for (const fi of all) {
    i++;
    const a = byAdv.get(fi.advertiserId) || { advertiserId: fi.advertiserId, merchant: '', files: [], rows: 0, products: 0, sport: 0, sportInStock: 0,
      cats: {}, also: {}, alsoSamples: {}, overlaps: {}, overlapSamples: {}, shopCats: {}, currencies: {}, samples: {}, ageDays: 9999, google: false, error: '', seen: new Set(), seenAll: new Set() };
    let map = null;
    try {
      const raw = createReadStream(fi.path);
      const stream = /\.gz$/i.test(fi.file) ? raw.pipe(createGunzip()) : raw;
      let n = 0;
      for await (const rec of readCsvRecords(stream)) {
        if (!map) {
          map = mapHeader(rec);
          // Not a product feed (another CSV that starts with a number): skip it, and do not list its name.
          if (!map.name.length) break;
          if (map.google) a.google = true;
          continue;
        }
        if (rec.length < 3) continue;
        n++; a.rows++;
        if (!a.merchant && map.merchant.length) a.merchant = pick(rec, map.merchant);
        let name = pick(rec, map.name);
        if (map.google) name = googleBaseName(name);
        const key = low(name);
        if (!key) continue;
        const brand = pick(rec, map.brand);
        const shopCat = [pick(rec, map.shopCat), pick(rec, map.awinCat)].filter(Boolean).join(' | ');
        const prodKey = `${low(brand)}|${key}`;
        if (!a.seenAll.has(prodKey)) { a.seenAll.add(prodKey); a.products++; }
        const r = classify(name, shopCat);
        if (!r.sport && !r.overlap) { if (n >= maxRows) break; continue; }
        const bucket = r.sport ? `cat:${r.cat}` : `ov:${r.overlap}`;
        if (a.seen.has(`${bucket}|${prodKey}`)) { if (n >= maxRows) break; continue; }
        a.seen.add(`${bucket}|${prodKey}`);
        const priceText = pick(rec, map.price);
        const cur = (pick(rec, map.currency) || (priceText.match(/\b([A-Z]{3})\b/) || [])[1] || '?').toUpperCase();
        const price = (priceText.match(/\d+(?:[.,]\d+)?/) || [''])[0];
        if (r.sport) {
          a.sport++;
          if (inStock(pick(rec, map.qty), pick(rec, map.flag)) !== false) a.sportInStock++;
          a.cats[r.cat] = (a.cats[r.cat] || 0) + 1;
          if (r.also) {
            a.also[r.also] = (a.also[r.also] || 0) + 1;
            const al = (a.alsoSamples[r.also] ||= []);
            if (al.length < 2 && (a.also[r.also] % 17 === 1)) al.push(`${name.slice(0, 70)} | ${price} ${cur}`);
          }
          const sc = pick(rec, map.shopCat) || pick(rec, map.awinCat) || '(no category)';
          a.shopCats[sc] = (a.shopCats[sc] || 0) + 1;
          a.currencies[cur] = (a.currencies[cur] || 0) + 1;
          const list = (a.samples[r.cat] ||= []);
          if (list.length < 3 && (a.cats[r.cat] % 23 === 1)) list.push(`${name.slice(0, 80)} | ${price} ${cur}`);
        } else {
          a.overlaps[r.overlap] = (a.overlaps[r.overlap] || 0) + 1;
          const list = (a.overlapSamples[r.overlap] ||= []);
          if (list.length < 2 && (a.overlaps[r.overlap] % 17 === 1)) list.push(`${name.slice(0, 70)} | ${price} ${cur}`);
        }
        if (n >= maxRows) break;
      }
    } catch (e) {
      if (!map && fi.kind !== 'awin') { log(`${i}/${all.length} skipped`); continue; }
      a.error = String(e && e.message || e).slice(0, 160);
    }
    if (fi.kind !== 'awin' && !(map && map.name.length)) { log(`${i}/${all.length} skipped`); continue; }
    a.files.push(`${fi.file} (${new Date(fi.mtime).toISOString().slice(0, 10)})`);
    a.ageDays = Math.min(a.ageDays, Math.floor((now - fi.mtime) / 86400000));
    files.push(fi);
    byAdv.set(fi.advertiserId, a);
    log(`${i}/${all.length} ${fi.file}`);
  }
  const advs = [...byAdv.values()];
  for (const a of advs) { delete a.seen; delete a.seenAll; }
  return { advs, files };
}

export async function readList(file) {
  const out = [];
  let head = null;
  for await (const rec of readCsvRecords(createReadStream(file))) {
    if (!head) { head = rec.map(h => String(h).trim().toLowerCase().replace(/^﻿/, '')); continue; }
    if (rec.length < 3) continue;
    const col = re => { const i = head.findIndex(h => re.test(h)); return i >= 0 ? String(rec[i] || '').trim() : ''; };
    out.push({ id: col(/^advertiser.?id$/), name: col(/^advertiser.?name$/), region: col(/region/), membership: col(/membership/),
      feedId: col(/^feed.?id$/), feedName: col(/^feed.?name$/), vertical: col(/vertical/), products: Number(col(/(no|number).?of.?products/)) || 0 });
  }
  return out;
}

const JOINED = /^(active|joined)$/i;

export function render({ advs, files = [], list = null, archives = [], generated = new Date() }) {
  const fmt = x => new Intl.NumberFormat('en-GB').format(x);
  const pct = (x, y) => (y ? `${Math.round((x / y) * 100)}%` : '-');
  const label = k => (CATEGORIES.find(c => c.key === k) || OTHER).label;
  const names = new Map();
  const joinedIds = new Set();
  if (list) for (const r of list) { if (r.id && r.name && !names.has(r.id)) names.set(r.id, r.name); if (JOINED.test(r.membership)) joinedIds.add(r.id); }
  const who = a => a.merchant || names.get(String(a.advertiserId)) || (a.google ? 'Google Shopping feed' : '?');
  const L = [];
  L.push(`BIKER FEED SCAN (read-only) - for Biker Gear World (bikergearworld.com, proposed code BGW): motorbikes and scooters ${generated.toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  L.push(`Folders read: ${archives.join(' ; ') || '-'}`);
  L.push(`Feed files: ${files.length} (newest copy of each file name)`);
  const withSport = advs.filter(a => a.sport > 0).sort((x, y) => y.sport - x.sport);
  const totalSport = withSport.reduce((t, a) => t + a.sport, 0);
  const totalInStock = withSport.reduce((t, a) => t + a.sportInStock, 0);
  L.push(`Retailers in the feeds: ${advs.length} | with motorbike/scooter products: ${withSport.length} | different motorbike/scooter products: ${fmt(totalSport)} (in stock ${pct(totalInStock, totalSport)})`);
  const errs = advs.filter(a => a.error);
  if (errs.length) L.push(`Could not read: ${errs.map(a => `${a.advertiserId} (${a.error})`).join('; ')}`);
  L.push('');
  L.push('== MOTORBIKE & SCOOTER PRODUCTS PER PROPOSED CATEGORY (all retailers) ==');
  const tot = {}, shops = {};
  for (const a of withSport) for (const [k, x] of Object.entries(a.cats)) { tot[k] = (tot[k] || 0) + x; shops[k] = (shops[k] || 0) + 1; }
  for (const c of [...CATEGORIES, OTHER]) {
    L.push(`  ${(c.label + (c.scan ? ' *' : '')).padEnd(46)} ${fmt(tot[c.key] || 0).padStart(8)}  from ${shops[c.key] || 0} retailer(s)`);
  }
  L.push('');
  L.push('== BGW PRODUCTS THAT ALSO FIT THE RULES OF ANOTHER NEW SITE - counted above too (the yes/no rules decide) ==');
  const al = {}, alShops = {};
  for (const a of advs) for (const [k, x] of Object.entries(a.also)) { al[k] = (al[k] || 0) + x; alShops[k] = (alShops[k] || 0) + 1; }
  for (const k of ALSO_KEYS) L.push(`  ${overlapLabel(k).padEnd(62)} ${fmt(al[k] || 0).padStart(8)}  from ${alShops[k] || 0} retailer(s)`);
  L.push('');
  L.push('== PRODUCTS THAT BELONG TO ANOTHER GEAR WORLD SITE - not counted above ==');
  const ov = {}, ovShops = {};
  for (const a of advs) for (const [k, x] of Object.entries(a.overlaps)) { ov[k] = (ov[k] || 0) + x; ovShops[k] = (ovShops[k] || 0) + 1; }
  for (const k of OVERLAP_KEYS) L.push(`  ${overlapLabel(k).padEnd(62)} ${fmt(ov[k] || 0).padStart(8)}  from ${ovShops[k] || 0} retailer(s)`);
  L.push('');
  L.push('== RETAILERS WITH MOTORBIKE & SCOOTER PRODUCTS (most first) ==');
  for (const a of withSport) {
    const joined = list ? (joinedIds.has(String(a.advertiserId)) ? ' | Awin: JOINED' : ' | Awin: not joined or not in the list') : '';
    L.push(`-- ${a.advertiserId} ${who(a)}: ${fmt(a.sport)} motorbike/scooter of ${fmt(a.products)} products (${pct(a.sport, a.products)}) | in stock ${pct(a.sportInStock, a.sport)} | ${Object.entries(a.currencies).map(([c, x]) => `${c} ${fmt(x)}`).join(', ')} | file ${a.ageDays}d old${a.google ? ' | Google format (sizes joined)' : ''}${joined}`);
    L.push(`   by category: ${Object.entries(a.cats).sort((x, y) => y[1] - x[1]).map(([k, x]) => `${label(k)} ${fmt(x)}`).join(' | ')}`);
    const o = Object.entries(a.overlaps).sort((x, y) => y[1] - x[1]);
    if (o.length) L.push(`   other sites: ${o.map(([k, x]) => `${k} ${fmt(x)}`).join(' | ')}`);
    const al2 = Object.entries(a.also).sort((x, y) => y[1] - x[1]);
    if (al2.length) L.push(`   also fit: ${al2.map(([k, x]) => `${k} ${fmt(x)}`).join(' | ')}`);
    L.push(`   shop categories: ${Object.entries(a.shopCats).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([c, x]) => `${c.slice(0, 50)} (${fmt(x)})`).join(' | ')}`);
    for (const [k, s] of Object.entries(a.samples)) for (const x of s.slice(0, 2)) L.push(`   e.g. [${label(k)}] ${x}`);
    for (const [k, s] of Object.entries(a.overlapSamples)) for (const x of s.slice(0, 1)) L.push(`   e.g. other site [${k}] ${x}`);
    for (const [k, s] of Object.entries(a.alsoSamples)) for (const x of s.slice(0, 1)) L.push(`   e.g. also fits [${k}] ${x}`);
  }
  const onlyOverlap = advs.filter(a => a.sport === 0 && Object.keys(a.overlaps).length);
  if (onlyOverlap.length) {
    L.push('');
    L.push('== RETAILERS WITH ONLY OTHER-SITE PRODUCTS (e.g. bicycles) ==');
    for (const a of onlyOverlap) L.push(`  ${a.advertiserId} ${who(a)}: ${Object.entries(a.overlaps).map(([k, x]) => `${k} ${fmt(x)}`).join(' | ')}`);
  }
  const none = advs.filter(a => a.sport === 0 && !Object.keys(a.overlaps).length);
  L.push('');
  L.push(`== NO MOTORBIKE OR SCOOTER PRODUCTS (${none.length}) ==`);
  L.push('  ' + none.map(a => `${a.advertiserId} ${who(a)}`).join(', '));
  L.push('');
  L.push('== FEED FILES USED ==');
  for (const f of files) L.push(`  ${f.file}  (${new Date(f.mtime).toISOString().slice(0, 10)}, ${f.dir})`);
  if (list) {
    L.push('');
    const here = new Set(advs.map(a => String(a.advertiserId)));
    L.push(`== AWIN FEED LIST: ${list.length} feeds, ${list.filter(r => JOINED.test(r.membership)).length} from programmes you joined ==`);
    const sport = list.filter(r => isBikerProgramme(`${r.name} ${r.feedName}`, r.vertical));
    const byId = new Map();
    for (const r of sport) { const had = byId.get(r.id); if (!had) byId.set(r.id, { ...r }); else had.products += r.products; }
    const uniq = [...byId.values()].sort((x, y) => y.products - x.products);
    L.push('-- Motorbike & scooter programmes you JOINED --');
    for (const r of uniq.filter(r => JOINED.test(r.membership))) {
      L.push(`  ${r.id.padEnd(7)} ${r.name.slice(0, 40).padEnd(40)} ${r.region.padEnd(4)} ${fmt(r.products).padStart(9)} products | file on this PC: ${here.has(r.id) ? 'yes' : 'NO'}`);
    }
    L.push('-- Motorbike & scooter programmes NOT joined (apply later WITH bikergearworld.com, after it is live: open the link, "Join programme") --');
    for (const r of uniq.filter(r => !JOINED.test(r.membership))) {
      L.push(`  ${r.id.padEnd(7)} ${r.name.slice(0, 40).padEnd(40)} ${r.region.padEnd(4)} ${fmt(r.products).padStart(9)} products | ${r.membership || '?'} | https://ui.awin.com/merchant-profile/${r.id}`);
    }
    L.push('Note: the list match is by name only; check each profile before applying.');
  } else {
    L.push('');
    L.push('Awin feed list: not read (no saved feed key on this PC).');
  }
  L.push('');
  L.push('Note: a first sort by keywords, products counted once per retailer (same brand and name). Before any import, each retailer');
  L.push('gets its own yes/no rules and a dry-run report with samples (L14). Nothing was imported and no file was changed.');
  return { text: L.join('\n') + '\n', withSport };
}

function toCsv(advs) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const keys = [...CATEGORIES.map(c => c.key), OTHER.key];
  const rows = [['advertiser_id', 'merchant', 'products', 'biker_products', 'biker_in_stock', ...keys, ...ALSO_KEYS.map(k => `also_fits_${k}`), ...OVERLAP_KEYS.map(k => `other_site_${k}`)]];
  for (const a of advs) rows.push([a.advertiserId, a.merchant, a.products, a.sport, a.sportInStock, ...keys.map(k => a.cats[k] || 0), ...ALSO_KEYS.map(k => a.also[k] || 0), ...OVERLAP_KEYS.map(k => a.overlaps[k] || 0)]);
  return rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
}

async function main() {
  const args = process.argv.slice(2);
  const val = x => { const i = args.indexOf(`--${x}`); return i >= 0 ? args[i + 1] : ''; };
  const archives = String(val('archive') || '').split(';').map(s => s.trim()).filter(Boolean).map(s => resolve(s));
  const found = archives.filter(d => existsSync(d));
  if (!found.length) { console.error(`Archive folder not found: ${archives.join(' ; ') || '(none given)'}`); process.exit(2); }
  const out = resolve(val('out') || 'moto-feed-scan');
  mkdirSync(out, { recursive: true });
  const { advs, files } = await scanArchive({ archives: found, maxRows: Number(val('max-rows')) || Infinity, log: m => process.stdout.write(`\r${m}`.padEnd(90).slice(0, 90)) });
  process.stdout.write('\n');
  const list = val('list') && existsSync(val('list')) ? await readList(val('list')) : null;
  const { text } = render({ advs, files, list, archives: found });
  writeFileSync(join(out, 'report.txt'), text);
  writeFileSync(join(out, 'retailers.csv'), '﻿' + toCsv(advs.sort((x, y) => y.sport - x.sport)));
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
