// Gear World Hub /api/registry "shop_categories" (owner, 4/11/2026, option A): the categories of each site's own menu,
// from sites/<code>/site.config.js, for the Gear World app. The D1 "categories" (which also feeds /api/classify and the
// central import) does not change, and "categories" in the answer stays exactly what the D1 says (lessons L70).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import hub from '../../sites/gwh/worker.js';
import { shopCategories, block, currentBlock } from '../../tools/gwh-shop-categories.mjs';

const workerText = readFileSync(new URL('../../sites/gwh/worker.js', import.meta.url), 'utf8');

function makeEnv() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE sites (id INTEGER PRIMARY KEY, site_key TEXT, site_name TEXT, domain TEXT, audience TEXT, gender TEXT,
              age_min INTEGER, age_max INTEGER, destination_db TEXT, destination_worker TEXT, priority INTEGER, is_active INTEGER);
            CREATE TABLE categories (id INTEGER PRIMARY KEY, site_id INTEGER, category_key TEXT, category_name TEXT, slug TEXT,
              audience TEXT, gender TEXT, age_min INTEGER, age_max INTEGER, priority INTEGER, is_active INTEGER);`);
  const add = sql.prepare('INSERT INTO sites (id, site_key, site_name, domain, audience, priority, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)');
  add.run(1, 'KGW', 'Kids Gear World', 'kidsgearworld.com', 'kids', 10);
  add.run(2, 'TGW', 'Technology Gear World', 'technologygearworld.com', 'technology', 20);
  add.run(3, 'ZGW', 'Pets Gear World', 'petsgearworld.com', 'pets', 30);
  sql.prepare("INSERT INTO categories (site_id, category_key, category_name, slug, audience, priority, is_active) VALUES (1, 'clothing', 'Clothing', 'clothing', 'kids', 10, 1)").run();
  const wrap = (text, args = []) => ({
    bind: (...a) => wrap(text, a),
    first: async () => sql.prepare(text).get(...args) ?? null,
    all: async () => ({ results: sql.prepare(text).all(...args) }),
    run: async () => { sql.prepare(text).run(...args); return { success: true }; }
  });
  return { gear_world_registry: { prepare: (text) => wrap(text) } };
}

test('shop categories: the list in worker.js is the same as the site settings (node tools/gwh-shop-categories.mjs --write)', async () => {
  const map = await shopCategories();
  assert.equal(currentBlock(workerText), block(map));
  // The 7 worlds without D1 categories, and the 6 older ones too.
  for (const key of ['TGW', 'AGW', 'VGW', 'SGW', 'BGW', 'PGW', 'ZGW', 'CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW']) {
    assert.ok(map[key] && map[key].length >= 6, `${key} has its menu categories (${map[key] && map[key].length})`);
    for (const c of map[key]) {
      assert.ok(c.name && c.slug, `${key}: name and slug`);
      assert.match(c.url, /^https:\/\/[a-z]+gearworld\.com\/category\/[a-z0-9-]+\/$/, `${key}: ${c.url}`);
      assert.ok(!/\/(out|go)\//.test(c.url));
    }
  }
});

test('shop categories: /api/registry adds shop_categories and keeps "categories" exactly as the D1 says', async () => {
  const res = await hub.fetch(new Request('https://gearworldhub.com/api/registry'), makeEnv(), { waitUntil() {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  const by = Object.fromEntries(data.sites.map(s => [s.site_key, s]));
  const map = await shopCategories();
  assert.deepEqual(by.TGW.categories, [], 'TGW: no D1 categories, as before');
  assert.deepEqual(by.TGW.shop_categories, map.TGW);
  assert.deepEqual(by.ZGW.shop_categories, map.ZGW);
  assert.equal(by.KGW.categories.length, 1, 'KGW: the D1 category stays');
  assert.equal(by.KGW.categories[0].category_key, 'clothing');
  assert.deepEqual(by.KGW.shop_categories, map.KGW);
  assert.equal(data.category_count, 1, 'category_count still counts only the D1 categories');
});

test('shop categories: /api/classify and the D1 are not touched (lessons L70)', () => {
  // SHOP_CATEGORIES is defined once and used once (in /api/registry); the classify query still joins the D1 categories.
  assert.equal((workerText.match(/SHOP_CATEGORIES/g) || []).length, 2);
  const reg = workerText.indexOf('url.pathname === "/api/registry"');
  const use = workerText.indexOf('SHOP_CATEGORIES[row.site_key]');
  const cls = workerText.indexOf('/api/classify');
  assert.ok(reg > 0 && use > reg && (cls < 0 || use < cls || use > reg), 'used inside /api/registry');
  assert.match(workerText, /JOIN categories c\s+ON c\.site_id = s\.id\s+AND c\.is_active = 1\s+LEFT JOIN routing_rules r/);
  assert.ok(!/INSERT INTO categories|UPDATE categories|DELETE FROM categories/i.test(workerText), 'no writes to the D1 categories');
});
