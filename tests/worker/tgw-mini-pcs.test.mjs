// TGW "Mini PCs" (owner, 6 Nov 2026, lessons L97): a subcategory found by words in the product name, with its own page,
// a link in the menu and a place in the sitemap. Other sites and subcategories (ZGW birds) keep working as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { nameMatch } from '../../src/db.js';
import { sitemapStatic } from '../../src/seo.js';
import site from '../../sites/tgw/site.config.js';

const COLS = 'stable_key, awin_advertiser_id, awin_product_id, merchant_product_id, retailer, category_slug, subcategory, brand, product_name, product_slug, description, price, was_price, in_stock, item_condition, image_url, affiliate_url, merchant_category, gtin, mpn, specs_json, first_seen_at, last_seen_at';
// Names as the live feeds write them (6 Nov 2026). The first five are mini PCs, the rest are not.
const ROWS = [
  ['laptops-computing', 'Computers', 'MSI', 'MSI Cubi NUC 1M Intel Core 5 120U Barebone, NUC, SFF, Mini Computer', 382.99],
  ['laptops-computing', 'Desktop Computers', 'Soyo', 'SOYO S5Air Mini PC, AMD Ryzen 5 7535HS Mini PC Windows 11 Pro', 332.99],
  ['laptops-computing', 'Computers', 'Lenovo', 'Lenovo ThinkCentre M70q Gen 5 Tiny Intel Core i5 16 GB 512 GB SSD', 833.99],
  ['laptops-computing', "PC's & Workstations", 'Asus', 'ASUS Chromebox CHROMEBOX6-S5007UN Intel Core 5 120U ChromeOS (Grade A - Good)', 299.99],
  ['laptops-computing', 'Computers', 'Dell', 'DELL Pro QCM1250 Intel Core i5 16 GB 512 GB SSD Windows 11 Pro Micro PC.', 821.99],
  ['laptops-computing', 'Computers', 'Lenovo', 'Lenovo ThinkCentre Tiny-In-One 24 computer monitor 60.5 cm', 146.39],
  ['laptops-computing', 'Computers', 'D-Link', 'D-Link Nuclias Connect Network Controller', 179.99],
  ['laptops-computing', 'Laptop Docking Stations', 'Acme', 'USB-C Docking Station for Mini PC and laptop', 59.99],
  ['laptops-computing', 'Laptops', 'Asus', 'ASUS Vivobook 15 Laptop 16GB 512GB', 499.99],
  ['accessories-storage', 'Power', 'Lenovo', 'Lenovo ThinkCentre Tiny 65W power adapter', 33.13]
];
const MINI = ROWS.slice(0, 5).map(r => r[3]);
const NOT_MINI = ROWS.slice(5).map(r => r[3]);

function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('sites/tgw/migrations/0001_init.sql', 'utf8'));
  sql.exec(readFileSync('tests/fixtures/tgw-seed.sql', 'utf8'));
  const ins = sql.prepare(`INSERT INTO products (${COLS}) VALUES (${COLS.split(',').map(() => '?').join(',')})`);
  ROWS.forEach(([cat, sub, brand, name, price], i) => ins.run(`99${i}:MINI-${i}`, 99000 + i, String(990000 + i), `MINI-${i}`, 'Sample Tech Store', cat, sub, brand, name,
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name, price, null, 1, 'new', '', `https://www.awin1.com/pclick.php?p=${990000 + i}&a=0&m=99000`,
    cat, '', '', '{}', '2026-11-06 10:00:00', '2026-11-06 10:00:00'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const FX_FETCH = async () => new Response(JSON.stringify([{ base: 'GBP', quote: 'EUR', rate: 1.15, date: '2026-11-06' }]), { headers: { 'Content-Type': 'application/json' } });
const worker = createWorker(site);
const get = (path, env) => worker.fetch(new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), env, { waitUntil: p => p });
const envOf = () => ({ DB: fakeD1(), FX_FETCH, CLICK_LOG: 'off' });
const LANGS = site.languages.map(l => l.code).filter(c => c !== 'en-GB');
const sub = site.categories.find(c => c.slug === 'laptops-computing').subcategories.find(s => s.slug === 'mini-pcs');

test('whole words only: "nuc" finds "Cubi NUC 1M", not "D-Link Nuclias"; "Micro PC." with its full stop counts', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE products (product_name TEXT)');
  for (const r of ROWS) db.prepare('INSERT INTO products VALUES (?)').run(r[3]);
  const m = nameMatch({ words: sub.match, not: sub.exclude });
  const names = db.prepare(`SELECT product_name FROM products p WHERE ${m.sql}`).all(...m.binds).map(r => r.product_name);
  assert.deepEqual(names.sort(), [...MINI].sort());
  assert.equal(nameMatch({ words: [] }), null, 'no words: no filter');
});

test('Laptops & Computing: an "All | Mini PCs (5)" row, and Mini PCs in the menu of every page', async () => {
  const env = envOf();
  const cat = await (await get('/category/laptops-computing/', env)).text();
  assert.match(cat, /\?sub=mini-pcs"[^>]*>Mini PCs <span class="sub-n" translate="no">\(5\)<\/span>/);
  const home = await (await get('/', env)).text();
  const bar = home.slice(home.indexOf('class="catbar"'), home.indexOf('</nav>', home.indexOf('class="catbar"')));
  assert.match(bar, /href="\/category\/laptops-computing\/">[^<]+<\/a><\/li><li><a href="\/category\/laptops-computing\/\?sub=mini-pcs">Mini PCs<\/a>/, 'right after its category');
});

test('the Mini PCs page: only mini PCs, its own heading, title, text and an address search engines may list', async () => {
  const res = await get('/category/laptops-computing/?sub=mini-pcs', envOf());
  assert.equal(res.status, 200);
  const html = await res.text();
  for (const n of MINI) assert.ok(html.includes(n.replace(/&/g, '&amp;').replace(/'/g, '&#39;')) || html.includes(n.slice(0, 40)), `listed: ${n}`);
  for (const n of NOT_MINI) assert.ok(!html.includes(n.slice(0, 30)), `not listed: ${n}`);
  assert.match(html, /<h1>Mini PCs<\/h1>/);
  assert.match(html, /<title>Mini PCs \| Compare prices \| Technology Gear World<\/title>/);
  assert.ok(html.includes(sub.intro));
  assert.match(html, /<meta name="robots" content="index,follow">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/technologygearworld\.com\/category\/laptops-computing\/\?sub=mini-pcs">/);
  assert.match(html, /<input type="hidden" name="sub" value="mini-pcs">/, 'the filters keep the Mini PCs page');
  assert.ok(html.includes('5 products'));
});

test('Mini PCs with a brand filter: "noindex", canonical back to the Mini PCs page, brands of mini PCs only', async () => {
  const html = await (await get('/category/laptops-computing/?sub=mini-pcs&brand=MSI', envOf())).text();
  assert.match(html, /<meta name="robots" content="noindex,follow">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/technologygearworld\.com\/category\/laptops-computing\/\?sub=mini-pcs">/);
  assert.ok(html.includes('1 product'));
  const brands = (html.match(/<select name="brand"[\s\S]*?<\/select>/) || [''])[0];
  assert.ok(brands.includes('>MSI') && !brands.includes('>D-Link') && !brands.includes('>Acme'), 'brand list of mini PCs only');
});

test('sitemap: the Mini PCs page after its category; translations of the new words in all 10 languages', () => {
  const xml = sitemapStatic(site, { 'laptops-computing': 10 });
  assert.ok(xml.includes('<loc>https://technologygearworld.com/category/laptops-computing/?sub=mini-pcs</loc>'));
  assert.ok(!sitemapStatic(site, { audio: 3 }).includes('?sub=mini-pcs'), 'not while Laptops & Computing is empty');
  for (const lang of LANGS) {
    const dict = JSON.parse(readFileSync(`sites/tgw/public/assets/i18n/${lang}.json`, 'utf8').replace(/^﻿/, ''));
    for (const k of ['Mini PCs', 'All', sub.intro]) assert.ok(Object.hasOwn(dict, k) && dict[k].trim(), `${lang}: ${k.slice(0, 40)}`);
    assert.ok(/NUC/.test(dict[sub.intro]) && /Tiny/.test(dict[sub.intro]), `${lang}: product names stay as they are`);
  }
});
