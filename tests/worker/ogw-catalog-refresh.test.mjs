// L231: the catalogue of Mega Stores refreshed with only what changed (D1 bills every row written: a daily full load
// would cost ~$110-210 a month), AB Vasilopoulos's categories from the address of its products, and a photo on every
// category card like the other Gear World sites. Real SQLite behind the D1 API (tests/worker/fake-d1.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import site from '../../sites/ogw/site.config.js';
import { createGuidesWorker } from '../../src/marketplace-guides.js';
import { MAX_STATEMENT, rangeDeletes, sortKeys, OTHER } from '../../tools/ogw-catalog.mjs';
import { PATH_CATEGORIES, pathLevels } from '../../tools/ogw-catalog-paths.mjs';
import { fakeD1, feedCsv, catalogSql, kotsovolosRows } from './fake-d1.mjs';

const NOW = Date.parse('2026-11-25T19:30:00Z');
const LIVE = 'https://megastoresgearworld.com';
const BROWSER = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const dump = db => JSON.stringify([
  db.prepare('SELECT * FROM products ORDER BY program, pid').all(),
  db.prepare('SELECT * FROM categories ORDER BY program, id').all(),
  db.prepare('SELECT program, slug, checked_at, products, loading, picks FROM stores ORDER BY program').all()
]);
// The rows SQLite changed for a set of files (D1 bills the rows a statement writes).
const changes = (db, sql) => {
  const t = db.prepare('SELECT total_changes() AS n').get().n;
  for (const s of sql) db.exec(s);
  return db.prepare('SELECT total_changes() AS n').get().n - t;
};
const stateDir = states => {
  const d = mkdtempSync(join(tmpdir(), 'gw-ogw-state-'));
  for (const [p, t] of Object.entries(states)) writeFileSync(join(d, `${p}.tsv`), t);
  return d;
};
const statements = sql => sql.join('\n').split('\n').filter(Boolean);

// The next day's feed: one product gone, one dearer, one new, one in another category, one with a new photo.
function nextDay() {
  const rows = kotsovolosRows(60).filter(r => r.merchant_product_id !== '100005');
  rows.find(r => r.merchant_product_id === '100010').search_price = '99.00';
  rows.find(r => r.merchant_product_id === '900001').merchant_category = 'Εικόνα & Ήχος > Προτζέκτορες';
  rows.find(r => r.merchant_product_id === '100020').merchant_image_url = 'https://assets.kotsovolos.gr/product/100020-new.jpg';
  rows.push({ ...rows[0], product_name: 'Καφετιέρα νέα', merchant_deep_link: 'https://www.kotsovolos.gr/ProductDisplay?partNumber=100100', merchant_image_url: 'https://assets.kotsovolos.gr/product/100100-l.jpg', merchant_product_id: '100100' });
  return rows;
}

test('L231: a refresh sends only what changed and ends exactly like a full load of the same feed', async () => {
  const day1 = await catalogSql({ 138: kotsovolosRows(60) }, NOW);
  const db = fakeD1(day1.sql).sqlite;
  assert.equal(day1.left.length, 0, 'no temporary file left');
  const state1 = day1.states['138'].trim().split('\n');
  assert.equal(state1[0], `#loaded ${fakeD1(day1.sql).sqlite.prepare('SELECT run FROM stores').get().run}`, 'the id of that load first, the same as in the database');
  assert.match(state1[0], /^#loaded [0-9a-f]{16}$/);
  assert.equal(state1.length, 63, 'then one line per product');
  assert.ok(state1.slice(1).every(l => /^[^\t]+\t[0-9a-f]{16}\t[0-9a-f]{8}$/.test(l)), 'id, the hash of the row, the hash of its place and categories');
  // The same feed again: nothing to send but the store's row.
  const dir = stateDir(day1.states);
  try {
    const same = await catalogSql({ 138: kotsovolosRows(60) }, NOW, 3600000, { full: [], stateDir: dir });
    assert.match(same.lines[0], / OK 62 \d+ 0 \S+ 1 refresh 0 0$/);
    const before = dump(db);
    assert.ok(changes(db, same.sql) <= 1, 'only the time of the feed is written');
    assert.equal(dump(db), before);
    // The next day: 4 products sent (dearer, new, moved, new photo), 1 gone.
    const day2 = await catalogSql({ 138: nextDay() }, NOW, 3600000, { full: [], stateDir: dir });
    assert.match(day2.lines[0], / OK 62 \d+ 0 \S+ 1 refresh 4 1$/);
    const text = day2.sql.join('\n');
    assert.ok(!/loading\) VALUES \(138, 'kotsovolos-gr', '[^']+', 0, 1\)|DELETE FROM products WHERE program = 138;/.test(text), 'never "loading", never every product out');
    assert.ok(statements(day2.sql).every(l => Buffer.byteLength(l) <= MAX_STATEMENT), 'every statement under the D1 limit');
    // Review 25/11/2026 (D1 cost): a new price or photo updates only the product's own columns (no index row); a new
    // product or one in another category, every column.
    const light = statements(day2.sql).filter(l => /DO UPDATE SET name = excluded\.name/.test(l));
    const whole = statements(day2.sql).filter(l => /^INSERT INTO products .* DO UPDATE SET pos = excluded\.pos/.test(l));
    assert.equal(light.length, 1);
    assert.ok(light[0].includes("'100010'") && light[0].includes("'100020'") && !light[0].includes("'900001'") && !/c1 = excluded/.test(light[0]));
    assert.equal(whole.length, 1);
    assert.ok(whole[0].includes("'900001'") && whole[0].includes("'100100'") && !whole[0].includes("'100010'"));
    const written = changes(db, day2.sql);
    const fresh = fakeD1((await catalogSql({ 138: nextDay() }, NOW)).sql).sqlite;
    assert.equal(dump(db), dump(fresh), 'the refreshed store is the same as a full load of the new feed');
    assert.ok(written < 15, `only the changes are written (${written} rows)`);
    assert.equal(db.prepare("SELECT price FROM products WHERE pid = '100010'").get().price, 99);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products WHERE pid = '100005'").get().n, 0);
    assert.equal(db.prepare("SELECT name FROM categories WHERE id = (SELECT c2 FROM products WHERE pid = '900001')").get().name, 'Προτζέκτορες');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM categories WHERE name = 'Τηλεοράσεις'").get().n, 0, 'an empty category goes');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  // Without a state file (the first refresh, or a send that stopped half-way): every product goes, with the WHERE
  // that skips the rows that are already right, and the result is the same.
  const db2 = fakeD1(day1.sql).sqlite;
  const check = await catalogSql({ 138: nextDay() }, NOW, 3600000, { full: [] });
  assert.match(check.lines[0], / OK 62 \d+ 0 \S+ 1 check 62 -1$/);
  const w2 = changes(db2, check.sql);
  assert.equal(dump(db2), dump(fakeD1((await catalogSql({ 138: nextDay() }, NOW)).sql).sqlite));
  assert.ok(w2 < 15, `a row that is already right is not written again (${w2} rows)`);
  // A store with no products in the feed: no files, no state, nothing of it is touched.
  const none = await catalogSql({ 138: [] }, NOW, 3600000, { full: [] });
  assert.match(none.lines[0], / NONE 0 /);
  assert.deepEqual(none.sql, []);
  assert.deepEqual(none.states, {});
});

test('L231: the old products go a range of ids at a time, in the database\'s own order, nothing else', () => {
  const keep = [];
  for (let i = 0; i < 12000; i++) keep.push(`P${String(i * 7).padStart(6, '0')}`, `Ελληνικό-${i}`, `x${i}-🙂`);
  const strays = ['', '0', 'P000001', 'P0839999', 'Ελληνικό-', 'Ελληνικό-5000a', 'zzz', '🙂', 'x5-🙂z', 'Ω'];
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE products (program INTEGER NOT NULL, pid TEXT NOT NULL, PRIMARY KEY (program, pid)) WITHOUT ROWID');
  const ins = db.prepare('INSERT INTO products VALUES (?, ?)');
  for (const k of [...keep, ...strays]) ins.run(138, k);
  ins.run(469, 'P000001');
  const sorted = sortKeys(keep);
  assert.deepEqual(sorted, db.prepare("SELECT pid FROM products WHERE program = 138 AND pid NOT IN (" + strays.map(s => `'${s}'`).join(',') + ') ORDER BY pid').all().map(r => r.pid), 'the same order as SQLite');
  const del = rangeDeletes('products', 138, 'pid', sorted, v => `'${String(v).replace(/'/g, "''")}'`);
  assert.ok(del.length > 3, 'several statements');
  assert.ok(del.every(s => Buffer.byteLength(s) <= MAX_STATEMENT), 'each under the D1 limit');
  assert.ok(!/ >= /.test(del[0]) && !/ < '/.test(del[del.length - 1]), 'the first range has no lower end, the last no upper end');
  for (const s of del) db.exec(s);
  assert.deepEqual(db.prepare('SELECT pid FROM products WHERE program = 138 ORDER BY pid').all().map(r => r.pid), sorted, 'every stray is gone, every kept one stays');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products WHERE program = 469').get().n, 1, 'never a row of another store');
});

test('L231: AB Vasilopoulos: its categories from the address of each product, with Greek names, never made up', async () => {
  const spec = PATH_CATEGORIES[12158];
  assert.deepEqual(pathLevels('https://www.ab.gr/el/eshop/Kava-anapsyktika-nera-xiroi-karpoi/Mpyres/Lager/p/7001', spec), ['Κάβα, αναψυκτικά, νερά & ξηροί καρποί', 'Μπύρες']);
  assert.deepEqual(pathLevels('https://www.ab.gr/el/eshop/Vegan-Proionta/Evlogimeno-Nistisimo-Classic-Fetes-200g/p/7002', spec), ['Vegan προϊόντα'], 'a second slug without a name: only the first level');
  assert.equal(pathLevels('https://www.ab.gr/el/eshop/c/Keri-Diarkeias/p/7003', spec), null, 'an unknown first level: none');
  assert.equal(pathLevels('https://www.ab.gr/en/shop/Kava/p/1', spec), null);
  assert.equal(pathLevels('not a url', spec), null);
  const names = Object.values(spec.names).flatMap(([n, subs]) => [n, ...Object.values(subs)]);
  assert.ok(names.length > 120 && names.every(n => n && n === n.trim() && !/[a-z]-[a-z]/i.test(n.replace(/Healthy Corner|Delicatessen|dressings|Vegan/g, ''))), 'every name written in Greek, no slug');
  const ab = (id, path, price) => ({ product_name: `ΑΒ ${id}`, merchant_deep_link: `https://www.ab.gr/el/eshop/${path}/p/${id}`, merchant_image_url: `https://static.ab.gr/medias/${id}.jpg`, search_price: price, currency: 'EUR', in_stock: '', merchant_product_id: String(id), merchant_category: '2915' });
  const { lines, sql } = await catalogSql({ 12158: [
    ab(7001, 'Kava-anapsyktika-nera-xiroi-karpoi/Mpyres/Lager', '1.20'),
    ab(7002, 'Kava-anapsyktika-nera-xiroi-karpoi/Krasia/Leyka', '8.50'),
    ab(7003, 'c/Keri-Diarkeias', '2.00'),
    ab(7004, 'Ola-gia-to-moro/Panes-Moroy/Panes', '12.90')
  ] }, NOW);
  assert.match(lines[0], /^CATALOG ab-gr 12158 OK 4 /);
  const db = fakeD1(sql).sqlite;
  const tree = db.prepare('SELECT c.level, c.name, p.name AS up FROM categories c LEFT JOIN categories p ON p.program = c.program AND p.id = c.parent ORDER BY c.level, c.name').all().map(r => `${r.level}:${r.up ? `${r.up} › ` : ''}${r.name}`);
  assert.ok(tree.includes('2:Κάβα, αναψυκτικά, νερά & ξηροί καρποί › Μπύρες') && tree.includes(`1:${OTHER}`) && !tree.some(t => /2915|Kava|Mpyres/.test(t)), 'the names of AB, never the number of its feed or a slug');
  assert.ok(tree.includes('1:Όλα για το μωρό') && tree.includes('2:Όλα για το μωρό › Πάνες μωρού') && tree.includes('2:Κάβα, αναψυκτικά, νερά & ξηροί καρποί › Κρασιά'));
  assert.equal(tree.length, 6);
});

test('L231: every category gets a photo: the middle one of its 20 dearest products', async () => {
  const { sql } = await catalogSql({ 138: kotsovolosRows(60) }, NOW);
  const db = fakeD1(sql).sqlite;
  const img = name => db.prepare('SELECT image FROM categories WHERE name = ?').get(name).image;
  // Καφετιέρες: prices 11-70, the 20 dearest are 70…51, the middle one 61 (100051).
  assert.equal(img('Καφετιέρες'), 'https://assets.kotsovolos.gr/product/100051-l.jpg');
  // Μικροσυσκευές: the espresso machine (359.99) and 70…52: the middle one is 62 (100052), not the one odd price.
  assert.equal(img('Μικροσυσκευές'), 'https://assets.kotsovolos.gr/product/100052-l.jpg');
  assert.equal(img('Τηλεοράσεις'), 'https://assets.kotsovolos.gr/product/900001-l.jpg', 'a category of one product: its photo');
  assert.ok(db.prepare('SELECT image FROM categories').all().every(r => /^https:\/\/assets\.kotsovolos\.gr\//.test(r.image)), 'always one of the store\'s own photos');
});

async function get(path, env, cache = null) {
  const fetch = async () => new Response(JSON.stringify({ ok: true, products: [] }), { headers: { 'Content-Type': 'application/json' } });
  const w = createGuidesWorker(site, { fetch, photoFetch: null, cache, now: () => NOW });
  const req = new Request(LIVE + path, { headers: { 'user-agent': BROWSER } });
  Object.defineProperty(req, 'cf', { value: { country: 'GR' } });
  const r = await w.fetch(req, env);
  return { r, text: await r.text() };
}
const tiles = t => [...t.matchAll(/<li><a class="cat-tile" href="([^"]+)">([\s\S]*?)<\/a><\/li>/g)].map(m => ({ href: m[1], body: m[2] }));

test('L231: the store page and a category show their categories as photo cards like the other sites', async () => {
  const { sql } = await catalogSql({ 138: kotsovolosRows(60) }, NOW);
  const env = { LINKWISE_CODE: 'CD12345', CATALOG: fakeD1(sql) };
  const { r, text } = await get('/gr/stores/kotsovolos-gr/', env);
  assert.equal(r.status, 200);
  const t = tiles(text);
  assert.equal(t[0].href, '#sets-h', 'the sets first');
  const micro = t.find(x => x.body.includes('Μικροσυσκευές'));
  assert.ok(micro && micro.body.includes('<img src="https://assets.kotsovolos.gr/product/100052-l.jpg" alt="" width="300" height="200" loading="lazy" decoding="async" referrerpolicy="no-referrer">'), 'the photo of the category');
  assert.ok(micro.body.includes('<span class="cat-name" translate="no">Μικροσυσκευές</span><span class="cat-count">61 προϊόντα</span>'));
  assert.ok(!/cat-list|\/out\/|\/go\//.test(text));
  const css = readFileSync('sites/ogw/public/assets/ogw.css', 'utf8');
  assert.ok(css.includes('.cat-grid {') && css.includes('.cat-tile img, .cat-tile .cat-noimg {') && css.includes('object-fit: contain'), 'the cards have their style (the whole product in the photo)');
  // A category: the categories below it as cards too.
  const cat = await get(micro.href, env);
  const sub = tiles(cat.text);
  assert.ok(sub.length === 1 && sub[0].body.includes('Καφές') && sub[0].body.includes('<img src="https://assets.kotsovolos.gr/product/100052-l.jpg"'));
  // A photo that did not open at the last check (L211): the card stays, without the photo.
  const cache = { match: async () => new Response(JSON.stringify({ broken: ['https://assets.kotsovolos.gr/product/100052-l.jpg'] })), put: async () => {} };
  const b = tiles((await get('/gr/stores/kotsovolos-gr/', env, cache)).text).find(x => x.body.includes('Μικροσυσκευές'));
  assert.ok(b && b.body.startsWith('<span class="cat-noimg" aria-hidden="true"></span>') && !b.body.includes('<img'));
  // A database made before the photos (no column `image`): the same cards, without photos, never a failed page.
  const old = fakeD1(sql);
  old.sqlite.exec('ALTER TABLE categories DROP COLUMN image');
  const o = await get('/gr/stores/kotsovolos-gr/', { LINKWISE_CODE: 'CD12345', CATALOG: old });
  const ot = tiles(o.text);
  assert.ok(ot.length >= 3 && ot.slice(1).every(x => x.body.startsWith('<span class="cat-noimg"')), 'cards without photos');
  const oc = await get(micro.href, { LINKWISE_CODE: 'CD12345', CATALOG: old });
  assert.equal(oc.r.status, 200);
  assert.equal(tiles(oc.text).length, 1);
});

test('L231: the PC tool from the command line: --full 0 (no store in full) and --state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw-ogw-cli-'));
  try {
    const f = join(dir, 'LINKWISE_138.csv.gz');
    writeFileSync(f, gzipSync(feedCsv(kotsovolosRows(3))));
    const t = (NOW - 3600000) / 1000;
    utimesSync(f, t, t);
    const run = (...extra) => spawnSync(process.execPath, ['tools/ogw-catalog.mjs', '--archive', dir, '--out', join(dir, 'out'), '--program', '138', '--now', new Date(NOW).toISOString(), ...extra], { encoding: 'utf8' });
    assert.match(run().stdout, /^CATALOG kotsovolos-gr 138 OK 5 \d+ 0 \S+ 1 full 5 -1\r?\n/, 'without --full: in full, as before');
    assert.match(run('--full', '0', '--state', join(dir, 'none')).stdout, / OK 5 \d+ 0 \S+ 1 check 5 -1\r?\n/, '--full 0: a refresh; no state file: every product checked');
    writeFileSync(join(dir, '138.tsv'), readFileSync(join(dir, 'out', '138.state'), 'utf8'));
    rmSync(join(dir, 'out'), { recursive: true, force: true });
    assert.match(run('--full', '0', '--state', dir).stdout, / OK 5 \d+ 0 \S+ 1 refresh 0 0\r?\n/, 'with the state file: nothing to send');
    const id = readFileSync(join(dir, '138.tsv'), 'utf8').split('\n')[0].slice('#loaded '.length);
    assert.match(id, /^[0-9a-f]{16}$/);
    assert.match(run('--full', '0', '--state', dir, '--have', `138=${id}`).stdout, / refresh 0 0\r?\n/, '--have with the id of that load: a refresh');
    assert.match(run('--full', '0', '--state', dir, '--have', '0').stdout, / check 5 -1\r?\n/, '--have without the store: every product checked');
    assert.match(run('--full', '0', '--state', dir, '--have', '138=0123456789abcdef').stdout, / check 5 -1\r?\n/, '--have with another load: every product checked');
    assert.ok(readdirSync(join(dir, 'out')).includes('138.state'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('L231 review: the state file counts only when it is the load the database has (a restore, another PC)', async () => {
  const DAY1 = NOW - 24 * 3600000;
  const day1 = await catalogSql({ 138: kotsovolosRows(60) }, DAY1);
  const db = fakeD1(day1.sql).sqlite;
  const before = fakeD1(day1.sql).sqlite; // the database as it was before day 2 (a Time Travel restore brings it back)
  const run = d => d.prepare('SELECT run FROM stores').get().run;
  assert.equal(run(db), run(before), 'the same files, the same load id');
  const dir = stateDir(day1.states);
  try {
    // Day 2 with the database's own load id: a refresh.
    const day2 = await catalogSql({ 138: nextDay() }, NOW, 3600000, { full: [], stateDir: dir, loaded: { 138: run(db) } });
    assert.match(day2.lines[0], / refresh 4 1$/);
    changes(db, day2.sql);
    writeFileSync(join(dir, '138.tsv'), day2.states['138']);
    // The database restored to the day before: its time is day 1's, the file says day 2: every product is checked,
    // and the store ends exactly as the feed says (without the review fix, the dearer price and the new product were lost).
    assert.notEqual(run(db), run(before), 'each load its own id');
    const again = await catalogSql({ 138: nextDay() }, NOW, 3600000, { full: [], stateDir: dir, loaded: { 138: run(before) } });
    assert.match(again.lines[0], / check 62 -1$/);
    changes(before, again.sql);
    assert.equal(dump(before), dump(fakeD1((await catalogSql({ 138: nextDay() }, NOW)).sql).sqlite));
    // The same feed loaded twice (the second with other rows), then the database restored to the first: the feed
    // time is the same, the load id is not, so every product is checked (second review 25/11/2026).
    const t1 = fakeD1(day1.sql).sqlite;
    const sameFeed = await catalogSql({ 138: nextDay() }, DAY1, 3600000, { full: [], stateDir: dir, loaded: { 138: run(t1) } });
    assert.match(sameFeed.lines[0], / check /, 'the file is of day 2, the database of day 1');
    // No id for the store in the database, or a file without its first line: checked too.
    assert.match((await catalogSql({ 138: nextDay() }, NOW, 3600000, { full: [], stateDir: dir, loaded: {} })).lines[0], / check /);
    const hdr = day2.states['138'].split('\n')[0].slice('#loaded '.length);
    writeFileSync(join(dir, '138.tsv'), day2.states['138'].split('\n').slice(1).join('\n'));
    assert.match((await catalogSql({ 138: nextDay() }, NOW, 3600000, { full: [], stateDir: dir, loaded: { 138: hdr } })).lines[0], / check /);
    // A product whose id starts with "#" is still in the state (only the first line is the header).
    writeFileSync(join(dir, '138.tsv'), `#loaded ${hdr}\n#weird\tabcdabcdabcdabcd\tabcdabcd\n`);
    const { readState } = await import('../../tools/ogw-catalog.mjs');
    assert.deepEqual([...readState(dir, 138, hdr).keys()], ['#weird']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('L231 review: a slug like "constructor" is no category; an id of 2 KB keeps every delete under the limit', () => {
  const spec = PATH_CATEGORIES[12158];
  for (const bad of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.equal(pathLevels(`https://www.ab.gr/el/eshop/${bad}/x/p/1`, spec), null, bad);
    assert.deepEqual(pathLevels(`https://www.ab.gr/el/eshop/Oporopoleio/${bad}/p/1`, spec), ['Οπωροπωλείο'], bad);
  }
  const keys = sortKeys(Array.from({ length: 300 }, (_, i) => `https://www.kotsovolos.gr/${"'".repeat(900)}${String(i).padStart(4, '0')}`));
  const del = rangeDeletes('products', 138, 'pid', keys, v => `'${String(v).replace(/'/g, "''")}'`);
  assert.ok(del.length > 1 && del.every(x => Buffer.byteLength(x) <= MAX_STATEMENT), Math.max(...del.map(x => Buffer.byteLength(x))));
});
