// Lessons L179 (17 Nov 2026): the order and the words of a search on the 13 sites themselves. They ordered a search
// "featured" (in stock, then a fixed shuffle), so the most plentiful match came first: drill bits for "drill" on
// Construction Gear World, a kettle descaler for "kettle" and duvet covers for "duvet" on Home Gear World, boot tassels for
// "womens boots", a cat toy for "cat litter". Now a search in the default order is ordered by what the product is
// (src/lib/search-rank.js, the rules of Gear World Hub, L177), and its words take plurals and a few true synonyms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { useLayout, listProducts, searchFacets, ftsQuery } from '../../src/db.js';
import { searchMatch, searchPlan, rankStem, SEARCH_WINDOW } from '../../src/lib/search-rank.js';
import { homeView } from '../../src/lib/visibility.js';
import { TEST_DAY } from './test-clock.mjs';

const read = f => readFileSync(f, 'utf8');
const agw = (await import('../../sites/agw/site.config.js')).default;
const hgw = (await import('../../sites/hgw/site.config.js')).default;
const wgw = (await import('../../sites/wgw/site.config.js')).default;
const NOW = Date.parse(`${TEST_DAY}T12:00:00Z`);

function memD1(...sqlTexts) {
  const sql = new DatabaseSync(':memory:');
  for (const t of sqlTexts) if (t) sql.exec(t);
  const seen = [];
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => { seen.push(text); return { results: sql.prepare(text).all(...args).map(r => ({ ...r })) }; },
    first: async () => { seen.push(text); const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, seen, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}

// The newer layout (AGW's migrations: products_fts with product_name, brand, subcategory, retailer).
const agwSchema = readdirSync('sites/agw/migrations').sort().map(f => read(`sites/agw/migrations/${f}`)).join('\n');
function newShop(rows) {
  const d = memD1(agwSchema);
  const ins = d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name,
    product_slug, price, currency, in_stock, image_url, affiliate_url, last_seen_at, first_seen_at, subcategory, gtin) VALUES (?, 1, ?, 'Example Motor Parts', ?, ?, ?, ?, ?, 'GBP', ?,
    'https://img.example/x.jpg', 'https://shop.example/x', '${TEST_DAY} 06:00:00', '${TEST_DAY} 06:00:00', ?, ?)`);
  rows.forEach(([name, sub, cat = 'garage-tools-equipment', price = 20, stock = 1, brand = 'Acme'], i) =>
    ins.run(`1:${i}`, String(i), cat, brand, name, name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), price, stock, sub, `G${i}`));
  return d;
}
// The older layout (Home Gear World: old category names, stock words, offers grouped by EAN).
function oldShop(rows) {
  const d = memD1(read('tests/fixtures/ggw-legacy-schema.sql'));
  const ins = d.sql.prepare(`INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, subcategory, brand, product_name, price,
    currency, stock_status, merchant_category, image_url, affiliate_url, ean, is_active, created_at, updated_at)
    VALUES (?, ?, 'Home Shop', ?, ?, ?, ?, ?, 'GBP', ?, ?, 'https://img.example/x.jpg', 'https://shop.example/x', ?, 1, '${TEST_DAY} 06:00:00', '${TEST_DAY} 06:00:00')`);
  rows.forEach(([name, sub, cat = 'Home Appliances', price = 20, stock = 'in stock', merchant = ''], i) =>
    ins.run(`a${i}`, `m${i}`, cat, sub, 'Acme', name, price, stock, merchant, `E${i}`));
  return d;
}
const names = r => r.products.map(p => p.product_name);

test('L179: the words a search finds: the singular, a few true synonyms, the word a site says by itself', () => {
  assert.equal(searchMatch('drill'), '"drill"*');
  assert.equal(searchMatch('boots'), '"boot"*', '"boots" also finds "Chelsea Boot"');
  assert.equal(searchMatch('running shoes'), '"running"* AND "shoe"*');
  assert.equal(searchMatch('watches'), '"watch"*');
  assert.equal(searchMatch('batteries'), '("batteries"* OR "battery"*)');
  assert.equal(searchMatch('glasses'), '"glasses"*', 'not "glass": a glass bottle is not glasses');
  assert.equal(searchMatch('smartwatch'), '("smartwatch"* OR ("smart"* AND "watch"*))');
  assert.equal(searchMatch('motorcycle cover'), '("motorcycle"* OR "motorbike"*) AND "cover"*');
  assert.equal(searchMatch('bbq'), '("bbq"* OR "barbecue"*)');
  assert.equal(searchMatch('ps5'), '("ps5"* OR ("playstation"* AND "5"*))');
  assert.equal(searchMatch('mobile', 'kgw'), '"mobile"*', 'a baby mobile, not phones');
  assert.equal(searchMatch('perfume'), '("perfume"* OR "parfum"* OR ("eau"* AND "de"* AND "toilette"*))', 'not "fragrance": home fragrance is not perfume');
  // A Gear World's own word is left out when other words remain.
  assert.equal(searchMatch('womens boots', 'wgw'), '"boot"*');
  assert.equal(searchMatch('womens', 'wgw'), '"women"*', 'alone it stays (its singular also finds "Women\'s")');
  assert.equal(searchMatch('mens watch', 'mgw'), '"watch"*');
  assert.equal(searchMatch('mens watch', 'tgw'), '"men"* AND "watch"*', 'another site keeps it');
  assert.equal(searchMatch('kids bike', 'kgw'), '("bike"* OR "bicycle"*)');
  // Safe for the search index whatever is typed (as ftsQuery, lessons L13), and never an inherited key.
  assert.equal(searchMatch('USB-C "charger"; DROP TABLE'), '"usb"* AND "c"* AND "charger"* AND "drop"* AND "table"*');
  assert.equal(searchMatch('***'), '');
  assert.equal(searchMatch('constructor'), '"constructor"*');
  assert.equal(searchMatch('hasOwnProperty toString'), '"hasownproperty"* AND "tostring"*');
  assert.equal(searchMatch('a b c d e f g h i j'), '"a"* AND "b"* AND "c"* AND "d"* AND "e"* AND "f"* AND "g"* AND "h"*', 'at most 8 words');
  assert.equal(ftsQuery('drill'), '"drill"*', 'the old expression is kept for anything else');
  assert.equal(rankStem('hoodies'), 'hoody');
});

test('L179: "drill" (newer layout): the drills first, then the bits; the brush, the toy and the trousers lower', async () => {
  const rows = [
    ...Array.from({ length: 40 }, (_, i) => [`Bosch Drill Bit Set ${i + 2}pc HSS`, 'Drill Bits']),
    ['Drill Brush Attachment Set for Cordless Drill', 'Cleaning'],
    ['Toy Drill for Kids', 'Toys'],
    ['Natural Drill Cotton Work Trousers', 'Workwear'],
    ['Makita DHP482Z 18V Cordless Combi Drill Body Only', 'Drills', 'garage-tools-equipment', 89, 0],
    ['DeWalt DCD796 18V Cordless Combi Drill with 2 Batteries', 'Drills', 'garage-tools-equipment', 149, 1]
  ];
  const d = newShop(rows);
  useLayout(agw);
  const view = homeView(agw, NOW);
  const r = await listProducts(d, { search: 'drill', view }, { page: 1, perPage: 8 });
  assert.equal(r.total, rows.length);
  assert.deepEqual(names(r).slice(0, 2), ['DeWalt DCD796 18V Cordless Combi Drill with 2 Batteries', 'Makita DHP482Z 18V Cordless Combi Drill Body Only']);
  assert.ok(names(r).slice(2).every(n => /Drill Bit Set/.test(n)), names(r).join(' / '));
  // Every page together: each match once, the brush, the toy and the trousers among the last.
  const all = [];
  for (let page = 1; page <= 6; page++) all.push(...names(await listProducts(d, { search: 'drill', view }, { page, perPage: 8 })));
  assert.equal(all.length, rows.length);
  assert.equal(new Set(all).size, rows.length);
  for (const n of ['Drill Brush Attachment Set for Cordless Drill', 'Toy Drill for Kids', 'Natural Drill Cotton Work Trousers']) assert.ok(all.indexOf(n) >= 40, `${n}: ${all.indexOf(n)}`);
  // Another order asked for is kept exactly (price, newest ...).
  const cheap = await listProducts(d, { search: 'drill', view }, { sort: 'price-desc', page: 1, perPage: 3 });
  assert.deepEqual(cheap.products.map(p => p.price), [149, 89, 20]);
});

test('L179: pages beyond the window continue in the rough order, never a product twice', async () => {
  const rows = [
    ...Array.from({ length: SEARCH_WINDOW + 30 }, (_, i) => [`Socket Wrench Set ${i}`, i % 3 ? 'Socket Sets' : 'Wrenches']),
    ...Array.from({ length: 20 }, (_, i) => [`Wrench Holder Rail ${i}`, 'Storage'])
  ];
  const d = newShop(rows);
  useLayout(agw);
  const view = homeView(agw, NOW);
  const seen = [];
  let pages = 0;
  for (let page = 1; ; page++) {
    const r = await listProducts(d, { search: 'wrench', view }, { page, perPage: 24 });
    pages = r.pages;
    seen.push(...r.products.map(p => p.id));
    if (page >= r.pages) break;
  }
  assert.equal(seen.length, rows.length);
  assert.equal(new Set(seen).size, rows.length, 'no product on two pages');
  assert.equal(pages, Math.ceil(rows.length / 24));
  // A page that crosses the window's end (perPage 50: 100-149) is whole.
  const crossing = await listProducts(d, { search: 'wrench', view }, { page: 3, perPage: 50 });
  assert.equal(crossing.products.length, 50);
  const first2 = [1, 2].map(p => listProducts(d, { search: 'wrench', view }, { page: p, perPage: 50 }));
  const ids = [...(await first2[0]).products, ...(await first2[1]).products, ...crossing.products].map(p => p.id);
  assert.equal(new Set(ids).size, 150);
  // The holders ("Wrench Holder": an accessory right after the word) are after every wrench.
  const holders = seen.map((id, i) => [id, i]).filter(([id]) => id > SEARCH_WINDOW + 30).map(([, i]) => i);
  assert.ok(Math.min(...holders) >= SEARCH_WINDOW + 30, `first holder at ${Math.min(...holders)}`);
});

test('L179: the rough order of the database and its copy in JavaScript agree on every row', () => {
  const rows = [
    ['Russell Hobbs Electric Kettle 1.7L', 'Kettles'], ['Kettle Descaler Tablets', 'Cleaning'], ['Kettler Sports Bag', 'Bags'],
    ['Duvet Cover Double', 'Bedding'], ['Hungarian Goose Down Duvet 13.5 Tog', 'Duvets'], ['Chelsea Boot Tassels', 'Accessories'],
    ['Suede Chelsea Boot', 'Boots'], ['Pretend Play Kettle Toy', 'Toys'], ['Kettle and Toaster Set', 'Kettles'],
    ['Cat Litter Tray', 'Cat Litter'], ['Cat Toy Mouse', 'Cat Toys'], ['Clumping Cat Litter 10L', 'Cat Litter'],
    ['Glass Kettle with Tea Infuser', ''], ['Hedge Trimmer Blade Cover', 'Hedge Trimmers'], ['Cordless Hedge Trimmer 18V', 'Hedge Trimmers']
  ];
  const d = newShop(rows.map(([n, s]) => [n, s, 'garage-tools-equipment']));
  useLayout(agw);
  for (const q of ['kettle', 'duvet', 'boots', 'cat litter', 'hedge trimmer', 'kettle toy', 'trimmer cover']) {
    const plan = searchPlan(q, { code: 'agw', categories: agw.categories });
    const expr = plan.coarse.sql.replace(/ DESC$/, '');
    const sqlScores = d.sql.prepare(`SELECT p.id, p.product_name, p.subcategory, p.category_slug, ${expr} AS s FROM products p ORDER BY p.id`).all(...plan.coarse.binds);
    for (const r of sqlScores) assert.equal(plan.coarseScore(r), Number(r.s), `${q}: ${r.product_name}`);
  }
});

test('L179: Home Gear World (older layout, offers grouped): "kettle" and "duvet" give the item, not its accessory', async () => {
  const rows = [
    ['Food Grade Citric Acid Hot Water Kettle Descaler', 'Kettle', 'Home Appliances', 5],
    ['Hotpot Sauce Spicy 400g', 'Kettle', 'Home Appliances', 3],
    ['Kettler Gym Bag', 'Bags', 'Home Decor', 25],
    ['DAEWOO Sienna Retro 1.7L Jug Kettle', 'Kettle', 'Home Appliances', 30],
    ['HOMCOM 1.7L 3000W Fast Boil Electric Kettle', 'Kettle', 'Home Appliances', 22, 'out of stock'],
    ['Under Construction Duvet Cover - Single', 'Duvet Covers', 'Bedding & Bath', 15],
    ['Toile 200 Thread Count Cotton Rich Duvet Cover', 'Duvet Covers', 'Bedding & Bath', 18],
    ['Hungarian Goose Down Duvet 10.5 Tog Double', 'Duvets', 'Bedding & Bath', 120],
    ['Snuggledown Hollowfibre Duvet King', 'Duvets', 'Bedding & Bath', 40]
  ];
  const d = oldShop(rows);
  useLayout(hgw);
  const view = homeView(hgw, NOW);
  const kettle = names(await listProducts(d, { search: 'kettle', view }, { page: 1, perPage: 8 }));
  assert.deepEqual(kettle.slice(0, 2), ['DAEWOO Sienna Retro 1.7L Jug Kettle', 'HOMCOM 1.7L 3000W Fast Boil Electric Kettle']);
  assert.ok(kettle.indexOf('Food Grade Citric Acid Hot Water Kettle Descaler') > 1);
  assert.ok(kettle.indexOf('Kettler Gym Bag') > 2, 'Kettler is not a kettle');
  const duvet = names(await listProducts(d, { search: 'duvet', view }, { page: 1, perPage: 8 }));
  assert.deepEqual(duvet.slice(0, 2).sort(), ['Hungarian Goose Down Duvet 10.5 Tog Double', 'Snuggledown Hollowfibre Duvet King']);
  // A search for the accessory itself puts it first.
  const covers = names(await listProducts(d, { search: 'duvet cover', view }, { page: 1, perPage: 8 }));
  assert.ok(/Duvet Cover/.test(covers[0]), covers[0]);
  // The shops and brands of a search use the same words.
  const facets = await searchFacets(d, 'kettle', view);
  assert.equal(facets.retailers[0].n, 5);
});

test('L179: "womens boots" on Women\'s Gear World finds its boots, not only the names that say "womens"', async () => {
  const d = oldShop([
    ['Fairfax & Favor Suede Boot Tassels for Women', 'Shoe Accessories', 'Shoes', 30],
    ['EMU Australia Platinum Slim Darling Boot', 'Boots', 'Shoes', 120],
    ['Dune London Pheobe Knee High Boots', 'Boots', 'Shoes', 150],
    ['Womens Ankle Socks 5 Pack', 'Socks', 'Clothing', 8]
  ]);
  useLayout(wgw);
  const r = await listProducts(d, { search: 'womens boots', view: homeView(wgw, NOW) }, { page: 1, perPage: 8 });
  assert.equal(r.total, 3, 'the boots and the tassels, not the socks');
  assert.ok(/Boots?$/.test(r.products[0].product_name), r.products[0].product_name);
  assert.equal(r.products[2].product_name, 'Fairfax & Favor Suede Boot Tassels for Women');
});

test('L179: a fault in the order leaves the old order, never an empty page', async () => {
  const d = newShop([['Cordless Drill', 'Drills'], ['Drill Bit Set', 'Drill Bits']]);
  const prepare = d.prepare;
  d.prepare = text => (/THEN 4 ELSE 0 END/.test(text) ? { bind: () => ({ all: async () => { throw new Error('no such column'); }, first: async () => null }) } : prepare(text));
  useLayout(agw);
  const r = await listProducts(d, { search: 'drill', view: homeView(agw, NOW) }, { page: 1, perPage: 8 });
  assert.equal(r.total, 2);
  assert.equal(r.products.length, 2);
});

test('L179: the order reads no more rows than before: the same matches, three or four look-ups in the search index', async () => {
  const d = newShop(Array.from({ length: 60 }, (_, i) => [`Drill Bit ${i}`, 'Drill Bits']));
  useLayout(agw);
  d.seen.length = 0;
  await listProducts(d, { search: 'drill', view: homeView(agw, NOW) }, { page: 1, perPage: 24 });
  const window = d.seen.find(s => /THEN 4 ELSE 0 END/.test(s));
  assert.ok(window, 'the window query');
  assert.equal((window.match(/products_fts MATCH \?/g) || []).length, 5, 'the search, the subcategory, the name, the accessories, the toys');
  assert.match(window, /LIMIT \?$/);
  const plan = d.sql.prepare(`EXPLAIN QUERY PLAN ${window}`).all(...searchPlan('drill', { code: 'agw', categories: agw.categories }).coarse.binds.map(() => null).concat([]));
  assert.ok(plan.length > 0);
});
