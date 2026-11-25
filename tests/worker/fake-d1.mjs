// A D1 database for the tests of the catalogue of Mega Stores (lessons L228): real SQLite (node:sqlite) behind the
// small part of the D1 API the Worker uses (prepare, bind, all, first). Built from the SQL files that
// tools/ogw-catalog.mjs writes from a fake Linkwise feed, so the tests read what the import would load.
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, writeFileSync, readFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCatalog } from '../../tools/ogw-catalog.mjs';

const SCHEMA = readFileSync('sites/ogw/catalog-schema.sql', 'utf8');
export function fakeD1(sql = [], { failOn = null } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  for (const s of sql) db.exec(s);
  const prepare = text => {
    let args = [];
    const check = () => { if (failOn && failOn.test(text)) throw new Error('D1_ERROR: database is busy (import)'); };
    const api = {
      bind: (...a) => { args = a; return api; },
      all: async () => { check(); return { success: true, results: db.prepare(text).all(...args) }; },
      first: async () => { check(); return db.prepare(text).get(...args) ?? null; }
    };
    return api;
  };
  return { prepare, sqlite: db };
}

const COLS = ['product_name', 'merchant_deep_link', 'merchant_image_url', 'search_price', 'currency', 'in_stock', 'merchant_product_id', 'brand_name', 'merchant_category'];
export const feedCsv = rows => [COLS, ...rows.map(r => COLS.map(c => r[c] ?? ''))].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
// The SQL of a fake catalogue: { <programme>: rows }, feeds read `ago` ms before `now`. full/stateDir as the PC tool
// gets them (L231: without full, every store in full); states: the <programme>.state files the run wrote.
export async function catalogSql(feeds, now, ago = 3600000, { full = null, stateDir = '' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gw-ogw-cat-'));
  const out = join(dir, 'sql');
  try {
    for (const [program, rows] of Object.entries(feeds)) {
      const f = join(dir, `LINKWISE_${program}.csv.gz`);
      writeFileSync(f, gzipSync(feedCsv(rows)));
      utimesSync(f, (now - ago) / 1000, (now - ago) / 1000);
    }
    const { lines } = await buildCatalog({ archive: dir, out, programs: Object.keys(feeds).map(Number), config: 'sites/ogw/site.config.js', now, full, stateDir });
    const files = lines.filter(l => / OK /.test(l)).length ? readdirSorted(out) : [];
    const states = {};
    for (const f of lines.filter(l => / OK /.test(l)).length ? readdirSync(out).filter(x => x.endsWith('.state')) : []) states[f.replace(/\.state$/, '')] = readFileSync(join(out, f), 'utf8');
    const left = lines.filter(l => / OK /.test(l)).length ? readdirSync(out).filter(x => x.startsWith('tmp-')) : [];
    return { lines, sql: files.map(f => readFileSync(join(out, f), 'utf8')), states, left };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
import { readdirSync } from 'node:fs';
const readdirSorted = d => readdirSync(d).filter(f => f.endsWith('.sql')).sort();
// Kotsovolos with `n` products in one category of three levels, two in another, and the page of a set (L226).
export function kotsovolosRows(n = 60) {
  const rows = [];
  for (let i = 1; i <= n; i++) {
    rows.push({ product_name: `Καφετιέρα ${i}`, merchant_deep_link: `https://www.kotsovolos.gr/ProductDisplay?partNumber=${100000 + i}`, merchant_image_url: `https://assets.kotsovolos.gr/product/${100000 + i}-l.jpg`,
      search_price: (10 + i).toFixed(2), currency: 'EUR', in_stock: '1', merchant_product_id: String(100000 + i), brand_name: 'Acme', merchant_category: 'Μικροσυσκευές > Καφές > Καφετιέρες' });
  }
  rows.push({ product_name: 'Τηλεόραση 55"', merchant_deep_link: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=900001', merchant_image_url: 'https://assets.kotsovolos.gr/product/900001-l.jpg', search_price: '499.00', currency: 'EUR', in_stock: '1', merchant_product_id: '900001', brand_name: 'LG', merchant_category: 'Εικόνα & Ήχος > Τηλεοράσεις' });
  rows.push({ product_name: 'Delonghi Magnifica Start ECAM220.30.SB Μηχανή Espresso', merchant_deep_link: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=273143', merchant_image_url: 'https://assets.kotsovolos.gr/product/273143-l.jpg', search_price: '359.99', currency: 'EUR', in_stock: '1', merchant_product_id: '273143', brand_name: 'DeLonghi', merchant_category: 'Μικροσυσκευές > Καφές > Μηχανές Espresso' });
  return rows;
}
