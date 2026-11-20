// Import rules for bol.com NL on the six older sites (lessons L204): Koken & Tafelen, Huishouden and Wonen -> HGW,
// Klussen and the search "werkschoenen" -> CGW, Tuin -> GGW, Damesmode and the search "parfum" -> WGW (clearly men's
// perfume -> MGW), Herenmode -> MGW, Kindermode -> KGW; clearly gendered clothing of any category by its words (Heren ->
// MGW, Dames -> WGW, Kinder/Baby/maat 62-176 -> KGW), Klussen's home products (bath mats) -> HGW. The newer sites (AGW, VGW, SGW, ZGW) read their own bol.com
// files through sites/<site>/sources.json ("sections": "bol-nl"). Where each product goes: lib/bol-nl.mjs.
// The feed files: BOL_<category>_NL.csv.gz and BOL_0_NL-<search>.csv.gz of tools/bol-feed-download.ps1 in the archive.
// Shown only to visitors from the Netherlands and Belgium, in Dutch (site.config deliversTo, sites/_shared/bol.js).
//
// PAUSED: the plan (dry run) works, but tools/legacy-import.ps1 stops before any change while RULES.paused is set: the
// import comes only after the removal tool (tools/bol-remove.ps1) and the daily price refresh (bol.com's terms 3.6), and
// with the owner's ΕΓΚΡΙΝΩ ALL IMPORTS. Taking the line out is the change that allows it.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BOL_FILE, BOL_SOURCES, BOL_SEARCHES, LEGACY_SITES, BOL_RETAILER, bolPlace, bolBaseName, FASHION_CATEGORY_IDS, bolEan, bolStamp, bolTooOld, oldFileMessage } from './lib/bol-nl.mjs';

export const RULES = {
  key: 'bol-nl',
  network: 'bol',
  // bol.com's Partnerprogramma site ID: the number in our product ids ("bol1559450:<EAN>"), never an Awin advertiser.
  advertiserId: 1559450,
  retailer: BOL_RETAILER,
  currency: 'EUR',
  shop: /^https:\/\/www\.bol\.com\//i,
  sites: LEGACY_SITES,
  minPrice: 3,
  maxPrice: 5000,
  // One shop must not fill a whole subcategory of an older site (lessons L161, L164).
  maxPerSubcategory: 400,
  // Sizes of one product are separate rows with the same name once the size is taken off (bolBaseName): one card, the
  // cheapest size WITH its own link, EAN and key (review of 6954a135: a joined card kept the first row's link and EAN,
  // and the daily refresh, which finds a row by its EAN, then wrote the dearer size's price on it).
  sameNameCheapest: true,
  sameNameCheapestReason: 'the same name in another size at a higher price (the cheapest size is kept, with its own link and EAN)',
  paused: 'bol.com (L204): the import waits for tools/bol-remove.ps1 and the daily price refresh (gear-world-bol-refresh) to be live, then ΕΓΚΡΙΝΩ ALL IMPORTS'
};

// The files of every bol.com category and search: clearly gendered clothing of the other categories (a men's jacket in
// Kamperen & Outdoor or Sport) goes to Men's, Women's or Kids' (lib/bol-nl.mjs bolPlace); the products of AGW, VGW, SGW
// and ZGW are left to those sites' own import.
export function feedFiles(archive) {
  const ids = new Set(BOL_SOURCES.filter(s => s.site).map(s => s.id));
  let names = [];
  try { names = readdirSync(archive); } catch { return []; }
  return names.filter(n => {
    const m = BOL_FILE.exec(n);
    if (!m) return false;
    return m[2] ? BOL_SEARCHES.some(q => q.term === m[2].toLowerCase()) : ids.has(m[1]);
  }).map(n => join(archive, n));
}

// No brand and no "was" price on a bol.com card (lessons L178); the name without its size, so the sizes are one card;
// the EAN in 13 digits, as the daily refresh finds the row (src/bol-refresh.js reads the ean column).
export function field(c, column) {
  // A bare number is a size only in the fashion categories and the work-shoe search (or with a clothing word in the name).
  if (c === 'product_name') return bolBaseName(column('product_name'), FASHION_CATEGORY_IDS.has(column('bol_category_id')) || /search "werkschoenen"/i.test(column('merchant_category')) || undefined);
  // The name with its size, for the children's sizes (maat 62 to 176) of the routing.
  if (c === 'bol_raw_name') return column('product_name');
  if (c === 'ean') return bolEan(column('ean'));
  if (c === 'brand_name' || c === 'rrp_price') return '';
  return column(c);
}

// One product = one EAN (the download keeps each EAN once).
export function productKey(get) {
  return get('ean') || bolEan(get('aw_product_id'));
}

// The bol.com category, the GS1 path and the search of the row's file (BOL_0_NL-<search>.csv.gz).
export function rowInfo(get, file = '') {
  const m = BOL_FILE.exec(String(file || ''));
  return { categoryId: get('bol_category_id') || (m ? m[1] : ''), gpc: get('bol_gpc') || get('category_name'), search: m && m[2] ? m[2].toLowerCase() : '',
    rawName: get('bol_raw_name') };
}

// The freshness date of a row: the time of its download (tools/legacy-import-plan.mjs writes it to updated_at), and the
// import's refusal of a file older than 12 hours (the plan of the dry run, tools/bol-import-plan.mjs, only warns).
export function rowStamp(get, fileMs) {
  return bolStamp(get('last_updated'), fileMs);
}
export const feedTooOld = (stamp, now) => bolTooOld(stamp, now);
export { oldFileMessage };

export function classify({ name, info }) {
  const i = info || {};
  if (!name) return { reject: 'no name' };
  const p = bolPlace({ categoryId: i.categoryId, search: i.search, name, rawName: i.rawName || name, gpc: i.gpc });
  if (p.reject) return { reject: p.reject };
  if (!LEGACY_SITES.includes(p.site)) return { reject: `bol.com ${p.source.name}: a product of ${p.site.toUpperCase()} (planned by that site's own import)` };
  return { site: p.site, siteCategory: p.cat, subcategory: p.sub, name, ...(p.doubt ? { doubt: true } : {}) };
}
