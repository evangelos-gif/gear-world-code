// Lessons L206 (20 Nov 2026): more photos on every product page. The feed downloads keep the shops' extra photos, the
// imports write up to 4 of them into ONE new nullable column (products.images) when the database has it, and the product
// page shows them in a swipeable gallery whose extra photos load only when the visitor swipes or clicks. These tests prove:
// the download column lists; the parsing, the checks and the dedupe of the photos; the SQL of both import layouts with and
// without the column (exactly as before without it); both site layouts before the column, with it and empty, and with
// photos; the gallery HTML (lazy, data-src, schema array, texts in every dictionary); /api/products unchanged unless
// ?images=1; and the D1 reads and query plans of the hot pages unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import * as db from '../../src/db.js';
import { realImage, imageList, extraImages, encodeImages, parseImages, photoKey, notProductPhoto, PHOTO_LIMIT, EXTRA_IMAGE_COLUMNS } from '../../src/lib/photos.js';
import * as legacyPlan from '../../tools/legacy-import-plan.mjs';
import { planImport, rowExtraImages } from '../../tools/tgw-import-plan.mjs';
import * as cj from '../../tools/cj-feed.mjs';
import { mainImageOf } from '../../tools/tgw-import-plan.mjs';
import * as dc from '../../tools/daisycon-feed.mjs';
import { FEED_COLUMNS } from '../../tools/network-links.mjs';
import { BOL_COLUMNS, rowOf as bolRow } from '../../tools/bol-feed.mjs';
import { LINKWISE_COLUMNS } from '../../tools/linkwise-feed.mjs';
import { translatableTexts } from './i18n-keys.mjs';

const read = f => readFileSync(f, 'utf8');
const OLD = ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw'];
const NEW = ['tgw', 'agw', 'vgw', 'sgw', 'bgw', 'pgw', 'zgw'];
const config = {};
for (const s of [...OLD, ...NEW]) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ---------- the photos themselves ----------

test('L206: realImage moved to src/lib/photos.js unchanged, and legacy-import-plan still exports the same function', () => {
  assert.equal(legacyPlan.realImage, realImage);
  assert.equal(realImage('https://images2.productserve.com/noimage.gif'), '');
  assert.equal(realImage('https://images2.productserve.com/?w=200&h=200&url=ssl%3Acdn.shopify.com%2Fs%2Fa.png%3Fv%3D1&feedId=1'), 'https://cdn.shopify.com/s/a.png?v=1');
  assert.equal(realImage('http://cdn.shopify.com/a.jpg'), '');
  assert.equal(realImage('https://cdn.shopify.com/a/00.png?v=1,https://cdn.shopify.com/a/01.jpg'), 'https://cdn.shopify.com/a/00.png?v=1');
});

test('L206: imageList gives every photo of a comma list; extraImages keeps real https photos, never the main one, each once, at most 4', () => {
  assert.deepEqual(imageList('https://cdn.example.com/a/00.png?v=1,https://cdn.example.com/a/01.jpg, https://cdn.example.com/a/02.jpg'),
    ['https://cdn.example.com/a/00.png?v=1', 'https://cdn.example.com/a/01.jpg', 'https://cdn.example.com/a/02.jpg']);
  assert.deepEqual(imageList('https://cdn.example.com/x.jpg?w=1,2'), ['https://cdn.example.com/x.jpg?w=1,2'], 'a comma inside one link stays');
  const main = 'https://cdn.example.com/p/main.jpg?v=111';
  const got = extraImages(main, [
    'https://cdn.example.com/p/main.jpg?v=222', // the main photo again (another cache copy)
    'https://images2.productserve.com/?w=200&url=ssl%3Acdn.example.com%2Fp%2Fmain.jpg', // the main photo through Awin's proxy
    'https://cdn.example.com/p/2.jpg',
    'http://cdn.example.com/p/3.jpg', // not https
    'https://cdn.example.com/p/image-coming-soon.png', // a placeholder
    'https://images2.productserve.com/noimage.gif',
    'https://cdn.example.com/p/2.jpg?width=600', // photo 2 at another size
    'not a link',
    'https://cdn.example.com/p/4.jpg,https://cdn.example.com/p/5.jpg',
    'https://cdn.example.com/p/' + 'x'.repeat(1100) + '.jpg', // too long for a D1 statement (L118)
    'https://cdn.example.com/p/6.jpg',
    'https://cdn.example.com/p/7.jpg'
  ]);
  assert.deepEqual(got, ['https://cdn.example.com/p/2.jpg', 'https://cdn.example.com/p/4.jpg', 'https://cdn.example.com/p/5.jpg', 'https://cdn.example.com/p/6.jpg']);
  assert.equal(got.length, PHOTO_LIMIT);
  assert.deepEqual(extraImages(main, ['', null, undefined]), []);
  // Two photos that differ by a parameter that is not a size are two photos.
  assert.deepEqual(extraImages('https://img.example.com/get?id=1', ['https://img.example.com/get?id=2']), ['https://img.example.com/get?id=2']);
  assert.equal(photoKey('https://CDN.example.com/a.jpg?v=1&w=200'), photoKey('https://cdn.example.com/a.jpg'));
});

test('L206: the column holds the photos joined by ONE space (NULL for none); a site reads back only safe https addresses', () => {
  assert.equal(encodeImages([]), null);
  assert.equal(encodeImages(null), null);
  assert.equal(encodeImages(['https://a.example/1.jpg', 'https://a.example/2.jpg']), 'https://a.example/1.jpg https://a.example/2.jpg');
  assert.equal(encodeImages(['https://a/1', 'https://a/2', 'https://a/3', 'https://a/4', 'https://a/5']).split(' ').length, 4);
  // No address the URL serializer writes has a raw space, so the space never cuts an address in two.
  const spaced = realImage('https://cdn.example.com/a photo "x".jpg');
  assert.ok(spaced && !/[\s"<>]/.test(spaced), spaced);
  assert.deepEqual(parseImages(encodeImages(['https://a.example/1.jpg', spaced]), ''), ['https://a.example/1.jpg', spaced]);
  const main = 'https://a.example/main.jpg';
  assert.deepEqual(parseImages(`https://a.example/main.jpg?v=9 javascript:alert(1) http://a.example/x.jpg https://a.example/"><b>.jpg https://a.example/2.jpg https://a.example/2.jpg`, main),
    ['https://a.example/2.jpg']);
  assert.deepEqual(parseImages(null, main), []);
  assert.deepEqual(parseImages(undefined, main), []);
  assert.deepEqual(parseImages('', main), []);
  assert.equal(parseImages(Array.from({ length: 9 }, (_, i) => `https://a.example/${i}.jpg`).join(' '), main).length, 4);
});

// ---------- the downloads ----------

test('L206: the Awin download asks for alternate_image ... alternate_image_four, and still for every column it asked for before', () => {
  const t = read('tools/awin-feed-download.ps1');
  const cols = (t.match(/\$Columns = '([^']+)'/) || [])[1].split(',');
  const before = 'data_feed_id,merchant_id,merchant_name,aw_product_id,aw_deep_link,aw_image_url,aw_thumb_url,category_id,category_name,brand_id,brand_name,merchant_product_id,merchant_category,ean,product_GTIN,mpn,product_name,description,merchant_deep_link,merchant_image_url,large_image,search_price,store_price,rrp_price,currency,delivery_cost,in_stock,stock_quantity,stock_status,condition,colour,size,fashion_size,fashion_suitable_for,parent_product_id,product_type,keywords,last_updated,merchant_product_category_path,merchant_product_second_category,merchant_product_third_category'.split(',');
  assert.deepEqual(cols.filter(c => !EXTRA_IMAGE_COLUMNS.includes(c)), before, 'the old columns, in the old order');
  assert.deepEqual(cols.slice(cols.indexOf('large_image') + 1, cols.indexOf('large_image') + 5), EXTRA_IMAGE_COLUMNS);
  assert.equal(new Set(cols).size, cols.length);
});

test('L206 (review): size charts, banners, logos, promotion and sale pictures are never extra photos', () => {
  for (const u of ['https://cdn.example.com/p/size-chart.jpg', 'https://cdn.example.com/p/SizeChart_men.png', 'https://cdn.example.com/p/size_guide.jpg',
    'https://cdn.example.com/p/maattabel.jpg', 'https://cdn.example.com/banner_2.jpg', 'https://cdn.example.com/logo.png', 'https://cdn.example.com/promo/x.jpg',
    'https://cdn.example.com/black-friday-sale.jpg', 'https://cdn.example.com/p/size%20chart.jpg']) assert.equal(notProductPhoto(u), true, u);
  for (const u of ['https://cdn.example.com/p/shoe-2.jpg', 'https://cdn.example.com/wholesale/x.jpg', 'https://cdn.example.com/salem-boot.jpg']) assert.equal(notProductPhoto(u), false, u);
  assert.deepEqual(extraImages('https://cdn.example.com/p/1.jpg', ['https://cdn.example.com/p/size-chart.jpg', 'https://cdn.example.com/p/2.jpg', 'https://cdn.example.com/sale-banner.jpg']),
    ['https://cdn.example.com/p/2.jpg']);
  assert.deepEqual(parseImages('https://cdn.example.com/p/logo.png https://cdn.example.com/p/3.jpg', ''), ['https://cdn.example.com/p/3.jpg']);
});

test('L206 (review): a CJ file has the photo columns only when the query asked for additionalImageLink (never on the fallback query)', () => {
  assert.equal(cj.feedColumns([{ id: 1, imageLink: 'https://c/1.jpg', additionalImageLink: null }]), cj.CJ_COLUMNS, 'asked: the columns, even when empty');
  assert.equal(cj.feedColumns([{ id: 1, imageLink: 'https://c/1.jpg', additionalImageLink: ['https://c/2.jpg'] }]), cj.CJ_COLUMNS);
  assert.equal(cj.feedColumns([{ id: 1, imageLink: 'https://c/1.jpg' }]), cj.COLUMNS, 'not asked (FALLBACK_PRODUCT): no photo columns, so the photos stay');
  assert.equal(cj.feedColumns([]), cj.COLUMNS);
  assert.ok(!cj.productQuery({ shape: null, cid: '1', pid: '2', advertiser: '3' }).includes('additionalImageLink'), 'the fallback query does not ask for it');
});

test('L206: CJ keeps additionalImageLink as up to 4 extra photo columns; large_image stays the first one, as before', () => {
  assert.deepEqual(cj.PHOTO_COLUMNS, EXTRA_IMAGE_COLUMNS);
  assert.deepEqual(cj.CJ_COLUMNS, [...cj.COLUMNS, ...EXTRA_IMAGE_COLUMNS], 'a CJ file: the Awin columns, then the photo columns');
  assert.deepEqual(cj.COLUMNS, ['data_feed_id', 'merchant_id', 'merchant_name', 'aw_product_id', 'aw_deep_link', 'brand_name', 'merchant_product_id',
    'merchant_category', 'category_name', 'ean', 'mpn', 'product_name', 'description', 'merchant_deep_link', 'merchant_image_url', 'large_image',
    'search_price', 'store_price', 'rrp_price', 'currency', 'in_stock', 'stock_status', 'parent_product_id', 'last_updated']);
  const strings = cj.toFeedRow({ id: 1, imageLink: 'https://c.example/main.jpg', additionalImageLink: ['https://c.example/1.jpg', 'https://c.example/2.jpg', 'https://c.example/3.jpg', 'https://c.example/4.jpg', 'https://c.example/5.jpg'] });
  assert.equal(strings.merchant_image_url, 'https://c.example/main.jpg');
  assert.equal(strings.large_image, 'https://c.example/1.jpg', 'as before');
  assert.deepEqual(EXTRA_IMAGE_COLUMNS.map(c => strings[c]), ['https://c.example/1.jpg', 'https://c.example/2.jpg', 'https://c.example/3.jpg', 'https://c.example/4.jpg']);
  const objects = cj.toFeedRow({ id: 2, imageLink: { url: 'https://c.example/m.jpg' }, additionalImageLink: [{ url: 'https://c.example/a.jpg' }, { link: 'https://c.example/b.jpg' }] });
  assert.deepEqual(EXTRA_IMAGE_COLUMNS.map(c => objects[c]), ['https://c.example/a.jpg', 'https://c.example/b.jpg', '', '']);
  const none = cj.toFeedRow({ id: 3, imageLink: 'https://c.example/m.jpg' });
  assert.deepEqual(EXTRA_IMAGE_COLUMNS.map(c => none[c]), ['', '', '', ''], 'no extra photo: empty columns');
  assert.equal(none.large_image, '');
});

test('L206: Daisycon keeps the 2nd to 5th photo of its images list; Rakuten, Linkwise and bol.com files have no photo columns at all', () => {
  const row = dc.toFeedRow({ product_info: { title: 'Trui', images: [{ location: 'https://d.example/1.jpg' }, { location: 'https://d.example/2.jpg' }, 'https://d.example/3.jpg'] } }, { programId: 1 });
  assert.equal(row.merchant_image_url, 'https://d.example/1.jpg', 'the main photo as before');
  assert.deepEqual(EXTRA_IMAGE_COLUMNS.map(c => row[c]), ['https://d.example/2.jpg', 'https://d.example/3.jpg', '', '']);
  assert.ok(EXTRA_IMAGE_COLUMNS.every(c => dc.DC_COLUMNS.includes(c)));
  // Rakuten, Linkwise and bol.com cannot say which extra photos a product has: their files keep the columns of before, so an
  // import from them leaves the photos on the site as they are (the imports read "no photo columns" that way).
  for (const c of EXTRA_IMAGE_COLUMNS) assert.ok(!FEED_COLUMNS.includes(c) && !BOL_COLUMNS.includes(c) && !LINKWISE_COLUMNS.includes(c), c);
  assert.equal(FEED_COLUMNS, cj.COLUMNS);
  // bol.com's Marketing Catalog API gives one image per product (include-image: the main one); the row has no extra photo.
  const b = bolRow({ ean: '8712345678906', offer: { price: 10, deliveryDescription: 'x' }, url: 'https://www.bol.com/nl/nl/p/x/9200000000000001/', title: 'X', image: { url: 'https://media.s-bol.com/a.jpg' } });
  assert.ok(b.row && EXTRA_IMAGE_COLUMNS.every(c => !(c in b.row)), 'one photo');
});

// ---------- the import plans ----------

const HEAD = 'data_feed_id,merchant_id,merchant_name,aw_product_id,aw_deep_link,aw_image_url,aw_thumb_url,category_id,category_name,brand_id,brand_name,merchant_product_id,merchant_category,product_name,description,merchant_deep_link,merchant_image_url,search_price,stock_quantity,parent_product_id';
const ALT = ',alternate_image,alternate_image_two,alternate_image_three,alternate_image_four';
const coesRow = (id, name, cat, handle, price, image, alts) =>
  `116078,30645,Coes,${id},https://www.awin1.com/pclick.php?p=${id}&a=3057233&m=30645,,,1,x,1,"Barbour",${id}0,${cat},"${name}",,https://www.coes.co.uk/products/${handle}?variant=${id}0,"${image}",${price},1,` + (alts ? ',' + alts.map(a => `"${a}"`).join(',') : '');
function coesFeed(withAlternates) {
  const dir = mkdtempSync(join(tmpdir(), 'l206-coes-'));
  const rows = [
    coesRow(1, 'Barbour Beaufort Wax Jacket', 'Menswear', 'beaufort', 299, 'https://cdn.shopify.com/1.png?v=1,https://cdn.shopify.com/1b.png', ['https://cdn.shopify.com/1c.png', 'https://cdn.shopify.com/1.png?v=2', '', 'https://cdn.shopify.com/1d.png']),
    coesRow(2, 'Barbour International Duke Jacket', 'Menswear', 'duke', 249, 'https://cdn.shopify.com/2.png', ['', '', '', '']),
    coesRow(3, 'Holland Cooper Contour Skinny Jeans', 'Womenswear', 'contour', 99, 'https://cdn.shopify.com/3.png', ['https://cdn.shopify.com/3b.png', '', '', ''])
  ].map(r => (withAlternates ? r : r.replace(/,("[^"]*",?){4}$/, ',')));
  writeFileSync(join(dir, 'AWIN_30645_116078.csv.gz'), gzipSync((withAlternates ? HEAD + ALT : HEAD) + '\n' + rows.join('\n') + '\n'));
  return dir;
}
const LEGACY_TABLE = read('tests/fixtures/ggw-legacy-schema.sql').replace('CREATE UNIQUE INDEX ux_products_refresh_stable_key', 'CREATE UNIQUE INDEX ux_products_awin ON products(awin_product_id);\nCREATE UNIQUE INDEX ux_products_refresh_stable_key');
const sqlOf = dir => readdirSync(join(dir, 'sql', 'mgw')).filter(f => f.endsWith('.sql')).sort().map(f => read(join(dir, 'sql', 'mgw', f))).join('\n');
const NOW = new Date('2026-11-20T18:00:00Z');

test('L206: the older sites\' plan writes the extra photos only with the column; without it the SQL is exactly as before', async () => {
  const before = mkdtempSync(join(tmpdir(), 'l206-plan-'));
  await legacyPlan.planLegacyImport({ archive: coesFeed(false), retailer: 'coes', outDir: before, now: NOW, images: false });
  const same = mkdtempSync(join(tmpdir(), 'l206-plan-'));
  const r0 = await legacyPlan.planLegacyImport({ archive: coesFeed(true), retailer: 'coes', outDir: same, now: NOW, images: false });
  assert.equal(sqlOf(same), sqlOf(before), 'a feed with the extra photo columns, no images column: the same SQL as a feed without them');
  assert.doesNotMatch(sqlOf(same), /images/);
  assert.match(r0.text, /Extra photos \(L206\): 2 of 3 products have 1-4 more photos in the feed; the SQL does not write them/);
  const jacket = r0.accepted.mgw.find(p => /Beaufort/.test(p.product_name));
  assert.equal(jacket.image_url, 'https://cdn.shopify.com/1.png?v=1');
  // The rest of the comma list first, then the alternates; the main photo at another cache copy is left out.
  assert.equal(jacket.images, 'https://cdn.shopify.com/1b.png https://cdn.shopify.com/1c.png https://cdn.shopify.com/1d.png');
  assert.equal(r0.accepted.mgw.find(p => /Duke/.test(p.product_name)).images, null);

  const withCol = mkdtempSync(join(tmpdir(), 'l206-plan-'));
  const r1 = await legacyPlan.planLegacyImport({ archive: coesFeed(true), retailer: 'coes', outDir: withCol, now: NOW, images: true });
  const sql = sqlOf(withCol);
  assert.match(sql, /INSERT INTO products \(awin_product_id, [^)]*, updated_at, images\) VALUES/);
  assert.match(sql, /images=excluded\.images/);
  assert.match(r1.text, /the SQL writes them \(column images\)/);
  // The SQL runs on the older layout with the column, and a second run (an update) keeps exactly one row per product.
  const d = new DatabaseSync(':memory:');
  d.exec(LEGACY_TABLE);
  d.exec(db.IMAGES_COLUMN_SQL);
  d.exec(sql);
  d.exec(sql);
  const rows = d.prepare('SELECT product_name, image_url, images FROM products ORDER BY id').all();
  assert.equal(rows.length, 2);
  assert.equal(rows.find(x => /Beaufort/.test(x.product_name)).images, jacket.images);
  assert.equal(rows.find(x => /Duke/.test(x.product_name)).images, null);
  // Without the column the SQL of before runs, and the SQL with the column would not: why the tools ask the database first.
  const old = new DatabaseSync(':memory:');
  old.exec(LEGACY_TABLE);
  old.exec(sqlOf(same));
  assert.throws(() => new DatabaseSync(':memory:').exec(LEGACY_TABLE + '\n' + sql), /no column named images/);
  // Manager, 20 Nov 2026: a feed WITHOUT the photo columns (an older download, Rakuten, Linkwise, bol.com) never names the
  // column, so the photos already on the site stay; a feed WITH the columns sets them, and clears them when they are empty.
  const noCols = mkdtempSync(join(tmpdir(), 'l206-plan-'));
  const r2 = await legacyPlan.planLegacyImport({ archive: coesFeed(false), retailer: 'coes', outDir: noCols, now: NOW, images: true });
  const keepSql = sqlOf(noCols);
  assert.equal(keepSql, sqlOf(same), 'no photo columns in the feed: the SQL of before, even with the images column');
  assert.match(r2.text, /3 come from a feed without the photo columns: their photos on the site stay as they are/);
  d.exec(keepSql);
  assert.equal(d.prepare("SELECT images FROM products WHERE product_name LIKE '%Beaufort%'").get().images, jacket.images, 'kept');
  const emptied = coesFeed(true);
  const csv = gunzipSync(readFileSync(join(emptied, 'AWIN_30645_116078.csv.gz'))).toString().replace(/,"https:\/\/cdn\.shopify\.com\/1c\.png","https:\/\/cdn\.shopify\.com\/1\.png\?v=2","","https:\/\/cdn\.shopify\.com\/1d\.png"/, ',"","","",""')
    .replace('"https://cdn.shopify.com/1.png?v=1,https://cdn.shopify.com/1b.png"', '"https://cdn.shopify.com/1.png?v=1"');
  writeFileSync(join(emptied, 'AWIN_30645_116078.csv.gz'), gzipSync(csv));
  const clearDir = mkdtempSync(join(tmpdir(), 'l206-plan-'));
  await legacyPlan.planLegacyImport({ archive: emptied, retailer: 'coes', outDir: clearDir, now: NOW, images: true });
  assert.match(sqlOf(clearDir), /images=excluded\.images/);
  d.exec(sqlOf(clearDir));
  assert.equal(d.prepare("SELECT images FROM products WHERE product_name LIKE '%Beaufort%'").get().images, null, 'the retailer has no extra photo now: cleared');
  // Mixed rows in one statement batch: the rows without photo columns go in their own INSERT without the column.
  const mixed = legacyPlan.insertSql([
    { awin_product_id: '1:a', retailer: 'R', site_category: 'C', product_name: 'A', price: 1, affiliate_url: 'x', images: 'https://a/1.jpg', photosKnown: true },
    { awin_product_id: '1:b', retailer: 'R', site_category: 'C', product_name: 'B', price: 1, affiliate_url: 'x', images: null, photosKnown: false }
  ], '2026-11-20 18:00:00', { images: true });
  const parts = mixed.trim().split(/;\n/);
  assert.equal(parts.length, 2);
  assert.ok(/updated_at, images\) VALUES/.test(parts[0]) && /'1:a'/.test(parts[0]) && !/'1:b'/.test(parts[0]));
  assert.ok(!/images/.test(parts[1]) && /'1:b'/.test(parts[1]));
  // Review (P2): a product whose only photo is in alternate_image is left out ("no image"), and the report says why.
  const altOnlyDir = mkdtempSync(join(tmpdir(), 'l206-coes-'));
  writeFileSync(join(altOnlyDir, 'AWIN_30645_116078.csv.gz'), gzipSync(HEAD + ALT + '\n'
    + coesRow(7, 'Barbour Beaufort Wax Jacket', 'Menswear', 'beaufort', 299, '', ['https://cdn.shopify.com/7b.png', '', '', '']) + '\n'));
  const altOut = mkdtempSync(join(tmpdir(), 'l206-plan-'));
  const r3 = await legacyPlan.planLegacyImport({ archive: altOnlyDir, retailer: 'coes', outDir: altOut, now: NOW, images: true });
  assert.equal(r3.accepted.mgw.length, 0);
  assert.equal((r3.rejected['no image'] || []).length, 1);
  assert.match(r3.text, /1 products have a photo only in the extra photo columns \(alternate_image \.\.\.\); it is never taken as the main photo, so they are left out/);
  // The import tools set GW_IMAGES_COLUMN=1 only after the database said it has the column.
  process.env.GW_IMAGES_COLUMN = '1';
  try {
    const env = mkdtempSync(join(tmpdir(), 'l206-plan-'));
    await legacyPlan.planLegacyImport({ archive: coesFeed(true), retailer: 'coes', outDir: env, now: NOW });
    assert.equal(sqlOf(env), sql);
  } finally { delete process.env.GW_IMAGES_COLUMN; }
});

test('L206: the statement size limit (L118) holds with long photo lists', () => {
  const long = n => `https://cdn.example.com/${'p'.repeat(900)}/${n}.jpg`;
  const items = Array.from({ length: 80 }, (_, i) => ({ awin_product_id: `1:${i}`, merchant_product_id: String(i), retailer: 'R', site_category: 'C', subcategory: 'S',
    brand: 'B', product_name: `P ${i}`, feed_product_name: `P ${i}`, price: 1, currency: 'GBP', stock_status: 'in stock', merchant_category: 'M',
    image_url: long('m'), affiliate_url: 'https://www.awin1.com/x', ean: null, images: encodeImages([long(1), long(2), long(3), long(4)]) }));
  const sql = legacyPlan.insertSqlLimited(items, '2026-11-20 18:00:00', { images: true });
  const statements = sql.split(/;\n/).filter(s => s.trim());
  assert.ok(statements.length > 1, 'split');
  for (const s of statements) assert.ok(Buffer.byteLength(s) <= legacyPlan.MAX_STATEMENT_BYTES, `${Buffer.byteLength(s)} bytes`);
});

function tgwFeed(header, rows) {
  const dir = mkdtempSync(join(tmpdir(), 'l206-tgw-'));
  const archive = join(dir, 'archive');
  mkdirSync(archive, { recursive: true });
  const line = v => v.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',');
  writeFileSync(join(archive, 'AWIN_123932_114093.csv.gz'), gzipSync([line(header), ...rows.map(line)].join('\n') + '\n'));
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: [{ advertiserId: 123932, feedIds: [114093], retailer: 'Joybuy', currency: 'GBP', condition: 'new', approved: true }] }));
  return { dir, archive, sourcesFile };
}

test('L206: the new-layout plan writes the extra photos only with the column; without it the SQL is exactly as before', async () => {
  const base = ['aw_deep_link', 'product_name', 'aw_product_id', 'merchant_product_id', 'merchant_image_url', 'search_price', 'currency', 'brand_name', 'in_stock'];
  const link = id => `https://www.awin1.com/pclick.php?p=${id}&a=1&m=123932`;
  const rows = [
    [link(1), 'Sony WH-1000XM5 Wireless Headphones', '1', 'JB-1', 'https://img.example/1.jpg', '279', 'GBP', 'Sony', '1'],
    [link(2), 'Anker Power Bank 20000mAh', '2', 'JB-2', 'https://img.example/2.jpg', '29.99', 'GBP', 'Anker', '1']
  ];
  const alts = [['https://img.example/1b.jpg', 'https://img.example/1.jpg?v=3', 'https://img.example/1c.jpg', ''], ['', '', '', '']];
  const plain = tgwFeed(base, rows);
  const extra = tgwFeed([...base, ...EXTRA_IMAGE_COLUMNS], rows.map((r, i) => [...r, ...alts[i]]));
  const run = async (f, images) => {
    const out = join(f.dir, `out-${images}`);
    mkdirSync(out, { recursive: true });
    const r = await planImport({ archive: f.archive, sourcesFile: f.sourcesFile, outDir: out, now: NOW, images });
    return { r, sql: read(join(out, 'sql', '0001.sql')), report: read(join(out, 'report.txt')) };
  };
  const a = await run(plain, false);
  const b = await run(extra, false);
  assert.equal(b.sql, a.sql, 'no images column: the same SQL as before');
  assert.doesNotMatch(b.sql, /images/);
  assert.match(b.report, /extra photos \(L206\): 1 products have 1-4 more photos in the feed; the SQL does not write them/);
  assert.equal(b.r.products.find(p => p.merchant_product_id === 'JB-1').images, 'https://img.example/1b.jpg https://img.example/1c.jpg');
  const c = await run(extra, true);
  assert.match(c.sql, /, last_seen_at, images\) VALUES \(/);
  assert.match(c.sql, /images = excluded\.images, updated_at = datetime\('now'\);/);
  const d = new DatabaseSync(':memory:');
  for (const f of readdirSync('sites/tgw/migrations').filter(f => f.endsWith('.sql')).sort()) d.exec(read(`sites/tgw/migrations/${f}`));
  d.exec(c.sql);
  d.exec(c.sql);
  assert.deepEqual(d.prepare('SELECT merchant_product_id, images FROM products ORDER BY id').all().map(x => ({ ...x })),
    [{ merchant_product_id: 'JB-1', images: 'https://img.example/1b.jpg https://img.example/1c.jpg' }, { merchant_product_id: 'JB-2', images: null }]);
  // Review (P3d): a comma list gives its first photo as the main one and the rest to the gallery (before: one broken
  // address); a photo only in alternate_image is never the main one, and the report counts it.
  assert.deepEqual(mainImageOf(['https://img.example/5.jpg, https://img.example/5b.jpg'], { images: [0] }), { image: 'https://img.example/5.jpg', raw: 'https://img.example/5.jpg,https://img.example/5b.jpg' });
  const lists = tgwFeed([...base, ...EXTRA_IMAGE_COLUMNS], [
    [link(5), 'Sony WH-CH720N Wireless Headphones', '5', 'JB-5', 'https://img.example/5.jpg,https://img.example/5b.jpg', '99', 'GBP', 'Sony', '1', 'https://img.example/5c.jpg', '', '', ''],
    [link(6), 'Anker Soundcore Speaker Bluetooth', '6', 'JB-6', '', '49', 'GBP', 'Anker', '1', 'https://img.example/6b.jpg', '', '', '']
  ]);
  const l = await run(lists, true);
  const p5 = l.r.products.find(p => p.merchant_product_id === 'JB-5');
  assert.equal(p5.image_url, 'https://img.example/5.jpg');
  assert.equal(p5.images, 'https://img.example/5b.jpg https://img.example/5c.jpg');
  assert.ok(!l.r.products.some(p => p.merchant_product_id === 'JB-6'), 'only an extra photo: never the main one');
  assert.match(l.report, /extra photos \(L206\): 1 rows have a photo only in the extra photo columns/);
  // A file without the photo columns, with the images column in the database: the SQL of before, the photos stay.
  const keep = await run(plain, true);
  assert.equal(keep.sql, a.sql, 'no photo columns in the file: never names the column');
  assert.match(keep.report, /2 come from a feed without the photo columns: their photos on the site stay as they are/);
  d.exec(keep.sql);
  assert.equal(d.prepare("SELECT images FROM products WHERE merchant_product_id = 'JB-1'").get().images, 'https://img.example/1b.jpg https://img.example/1c.jpg', 'kept');
  // A file with the columns, now empty: cleared.
  const cleared = tgwFeed([...base, ...EXTRA_IMAGE_COLUMNS], rows.map(r => [...r, '', '', '', '']));
  const e = await run(cleared, true);
  d.exec(e.sql);
  assert.equal(d.prepare("SELECT images FROM products WHERE merchant_product_id = 'JB-1'").get().images, null, 'the shop has no extra photo now: cleared');
  // An http:// photo counts only on a host the source names (L194), as for the main photo.
  const map = { alternates: [0, 1] };
  assert.deepEqual(rowExtraImages(['http://static.miscota.com/2.jpg', 'http://other.example/3.jpg'], map, 'https://static.miscota.com/1.jpg', { httpsImageHosts: ['static.miscota.com'] }),
    ['https://static.miscota.com/2.jpg']);
});

// ---------- the sites ----------

function memD1(schemaParts) {
  const sql = new DatabaseSync(':memory:');
  for (const p of schemaParts) sql.exec(p);
  const log = [];
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => { log.push({ text, args }); return { results: sql.prepare(text).all(...args).map(r => ({ ...r })) }; },
    first: async () => { log.push({ text, args }); const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, log, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const schemaOf = (code, withColumn) => {
  if (OLD.includes(code)) {
    const parts = [read('tests/fixtures/ggw-legacy-schema.sql'), read(`tests/fixtures/${code}-seed.sql`)];
    if (config[code].database.groupTable) parts.splice(1, 0, 'CREATE TABLE IF NOT EXISTS product_group_offers (group_id INTEGER NOT NULL, product_id INTEGER NOT NULL UNIQUE, PRIMARY KEY (group_id, product_id));');
    if (withColumn) parts.push(read(`sites/${code}/migrations/0002_product_images.sql`));
    return parts;
  }
  const migs = readdirSync(`sites/${code}/migrations`).filter(f => f.endsWith('.sql')).sort().filter(f => withColumn || f !== '0004_product_images.sql');
  return [...migs.map(f => read(`sites/${code}/migrations/${f}`)), read(`tests/fixtures/${code}-seed.sql`)];
};
const workers = {};
const get = (code, path, env) => {
  workers[code] ||= createWorker(config[code]);
  return workers[code].fetch(new Request(`https://${config[code].domain}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), env, { waitUntil: p => p });
};
// A product whose page shows the normal page (not the notice of L107), and its address.
async function shownProduct(code, d) {
  const ids = d.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id LIMIT 60').all().map(r => r.id);
  for (const id of ids) {
    db.useLayout(config[code]);
    const p = await db.getProduct(d, id);
    if (!p) continue;
    const path = `/product/${OLD.includes(code) ? db.legacySlug(p.product_name) : p.product_slug}-${id}/`;
    const html = await (await get(code, path, { DB: d })).text();
    if (html.includes('class="shelf"')) return { id, path, product: p };
  }
  throw new Error(`${code}: no product page shown`);
}
const photosOf = id => [`https://cdn.example.com/p${id}/2.jpg`, `https://cdn.example.com/p${id}/3.jpg`];

for (const code of ['mgw', 'cgw', 'tgw', 'agw']) {
  test(`L206 ${code.toUpperCase()}: the product page and /api/products are exactly as before without the column and with it empty; the column read once, never a failing SELECT`, async () => {
    const without = memD1(schemaOf(code, false));
    const empty = memD1(schemaOf(code, true));
    const { id, path } = await shownProduct(code, without);
    const a = await (await get(code, path, { DB: without })).text();
    const b = await (await get(code, path, { DB: empty })).text();
    assert.equal(b, a, 'the same page');
    assert.ok(!a.includes('data-gallery') && a.includes('"image":["'), 'one photo, as before');
    const apiA = await (await get(code, '/api/products?limit=10', { DB: without })).text();
    const apiB = await (await get(code, '/api/products?limit=10', { DB: empty })).text();
    assert.equal(apiB, apiA);
    // ?images=1 without the column: no images field, and only the column check (no SELECT of a missing column).
    without.log.length = 0;
    const apiC = await (await get(code, '/api/products?limit=10&images=1', { DB: without })).json();
    assert.ok(apiC.products.length > 0 && apiC.products.every(p => !('images' in p)));
    assert.ok(!without.log.some(q => /\bimages\b/.test(q.text) && !/pragma_table_info/.test(q.text)), 'no SELECT of the column');
    assert.ok(id > 0);
  });

  test(`L206 ${code.toUpperCase()}: with photos, the gallery (main photo first, the others lazy with data-src only), the schema image array, and /api/products?images=1`, async () => {
    const d = memD1(schemaOf(code, true));
    const { id, path, product } = await shownProduct(code, d);
    d.sql.prepare('UPDATE products SET images = ? WHERE id = ?').run(encodeImages(photosOf(id)), id);
    const page = await (await get(code, path, { DB: d })).text();
    assert.match(page, /<div class="product-photo product-gallery" data-gallery>/);
    const slides = [...page.matchAll(/<div class="gallery-slide" id="photo-(\d)">(<img [^>]+>)<\/div>/g)];
    assert.deepEqual(slides.map(m => m[1]), ['1', '2', '3']);
    const main = slides[0][2];
    assert.ok(!/loading=|data-src/.test(main) && /decoding="async"/.test(main), 'the main photo loads as before (eager)');
    for (const [i, m] of slides.slice(1).entries()) {
      assert.ok(m[2].includes(`src="${BLANK}"`) && m[2].includes(`data-src="${photosOf(id)[i]}"`) && m[2].includes('loading="lazy"'), m[2]);
      assert.ok(m[2].includes(` – Photo ${i + 2} of 3"`) && m[2].includes('width="560" height="560"'), m[2]);
    }
    // Nothing of an extra photo in an eager place of the page: only its data-src and the schema.
    for (const u of photosOf(id)) assert.equal(page.split(u).length - 1, 2, `${u}: data-src and the structured data only`);
    assert.match(page, /<button type="button" class="gallery-arrow gallery-prev" data-gallery-prev aria-label="Previous photo" hidden>/);
    assert.match(page, /<button type="button" class="gallery-arrow gallery-next" data-gallery-next aria-label="Next photo" hidden>/);
    assert.match(page, /<a href="#photo-1" data-gallery-dot="0" aria-current="true"><span class="visually-hidden"><span data-i18n="Photo \{0\} of \{1\}" data-i18n-0="1" data-i18n-1="3">Photo 1 of 3<\/span><\/span><\/a>/);
    assert.ok(!/ on[a-z]+="/.test(page), 'no inline event handler (CSP: the site script handles a photo that fails)');
    const ld = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1])).find(x => x['@type'] === 'Product');
    assert.deepEqual(ld.image, [product.image_url, ...photosOf(id)].map(u => (OLD.includes(code) ? db.sharperImage(u) : u)));
    const og = (page.match(/<meta property="og:image" content="([^"]*)"/) || [])[1] || '';
    assert.ok(og && !photosOf(id).some(u => og.includes(u)), 'og:image: the main photo only');
    // Every text of the gallery is in every dictionary of the site (lessons L24).
    const gallery = page.slice(page.indexOf('<div class="product-photo product-gallery"'), page.indexOf('<div class="product-label">'));
    const keys = [...translatableTexts(gallery)];
    assert.deepEqual(keys.sort(), ['Next photo', 'Photo {0} of {1}', 'Previous photo']);
    for (const f of readdirSync(`sites/${code}/public/assets/i18n`)) {
      const dict = JSON.parse(read(`sites/${code}/public/assets/i18n/${f}`));
      for (const k of keys) assert.ok(dict[k] && dict[k] !== k, `${code}/${f}: ${k}`);
    }
    // Lists and cards keep one photo: the home page and the category have no gallery and no extra photo.
    const home = await (await get(code, '/', { DB: d })).text();
    assert.ok(!home.includes('data-gallery') && !photosOf(id).some(u => home.includes(u)));
    // The API: the same answer as before, and with ?images=1 the array on that product only.
    const all = await (await get(code, '/api/products?limit=60', { DB: d })).json();
    assert.ok(all.products.every(p => !('images' in p)));
    const asked = await (await get(code, '/api/products?limit=60&images=1', { DB: d })).json();
    const mine = asked.products.find(p => p.id === id);
    if (mine) assert.deepEqual(mine.images, photosOf(id));
    assert.ok(asked.products.filter(p => p.id !== id).every(p => !('images' in p)));
    assert.deepEqual(asked.products.map(p => { const { images, ...rest } = p; return rest; }), all.products, 'every other field as before');
  });
}

test('L206: the column is looked for once per database binding (10 minutes), never with a SELECT that can fail', async () => {
  db.useLayout(config.mgw);
  const without = memD1(schemaOf('mgw', false));
  const withCol = memD1(schemaOf('mgw', true));
  assert.equal(await db.hasImagesColumn(without), false);
  assert.equal(await db.hasImagesColumn(withCol), true);
  withCol.log.length = 0;
  assert.equal(await db.hasImagesColumn(withCol), true);
  assert.equal(withCol.log.length, 0, 'kept: no second read');
  assert.equal(await db.hasImagesColumn({ prepare: () => { throw new Error('D1_ERROR: boom'); } }), false);
  assert.equal(await db.hasImagesColumn(null), false);
  // A rollback with DROP COLUMN inside the 10 minutes: the page reads the old way at once, no error.
  const id = withCol.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id LIMIT 1').get().id;
  withCol.sql.exec('ALTER TABLE products DROP COLUMN images');
  const p = await db.getProduct(withCol, id, { photos: true });
  assert.ok(p && Array.isArray(p.images) && p.images.length === 0);
  assert.equal(await db.hasImagesColumn(withCol), false, 'and it is not looked for in the view again');
});

test('L206: D1 reads of the hot pages unchanged: the same statements with and without the column, the product read by its key', async () => {
  for (const code of ['mgw', 'cgw', 'agw', 'tgw']) {
    const site = config[code];
    const without = memD1(schemaOf(code, false));
    const withCol = memD1(schemaOf(code, true));
    for (const path of ['/', `/category/${site.categories[0].slug}/`, '/search?q=a', '/api/products?limit=24']) {
      without.log.length = 0;
      withCol.log.length = 0;
      await get(code, path, { DB: without });
      await get(code, path, { DB: withCol });
      assert.deepEqual(withCol.log.map(q => q.text), without.log.map(q => q.text), `${code} ${path}: the same statements`);
      assert.ok(!withCol.log.some(q => /pragma_table_info|\bimages\b/.test(q.text)), `${code} ${path}: the column is never asked for`);
    }
    // The product page: one look at the column per database binding, then the product row by its primary key.
    const { path } = await shownProduct(code, withCol);
    withCol.log.length = 0;
    await get(code, path, { DB: withCol });
    const read = withCol.log.find(q => /SELECT \* FROM/.test(q.text) && /p\.id = \?/.test(q.text));
    const plan = withCol.sql.prepare(`EXPLAIN QUERY PLAN ${read.text}`).all(...read.args).map(r => r.detail);
    assert.ok(plan.some(l => /SEARCH (products|p) USING INTEGER PRIMARY KEY/.test(l)) && !plan.some(l => /^SCAN (products|p)\b/.test(l)), `${code}: ${plan.join(' | ')}`);
    if (OLD.includes(code)) assert.match(read.text, /,\n    images\s+FROM products\)/, `${code}: the older view with the column at the end`);
    // /api/products?images=1: one more read, by primary key, of only the listed ids.
    withCol.log.length = 0;
    await get(code, '/api/products?limit=24&images=1', { DB: withCol });
    const extra = withCol.log.filter(q => /SELECT id, images FROM products/.test(q.text));
    assert.equal(extra.length, 1);
    const ePlan = withCol.sql.prepare(`EXPLAIN QUERY PLAN ${extra[0].text}`).all(...extra[0].args).map(r => r.detail);
    assert.ok(ePlan.some(l => /SEARCH products USING INTEGER PRIMARY KEY/.test(l)) && !ePlan.some(l => /^SCAN products\b/.test(l)), ePlan.join(' | '));
  }
});

// ---------- the migrations, the tools and the front end ----------

test('L206: every site\'s migration is exactly IMAGES_COLUMN_SQL (ASCII, one statement); the tool knows the 13 databases', () => {
  for (const code of [...OLD, ...NEW]) {
    const f = OLD.includes(code) ? `sites/${code}/migrations/0002_product_images.sql` : `sites/${code}/migrations/0004_product_images.sql`;
    assert.ok(existsSync(f), f);
    const text = read(f);
    assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(text), `${code}: ASCII`);
    assert.deepEqual(text.split('\n').filter(l => l.trim() && !l.startsWith('--')), [db.IMAGES_COLUMN_SQL], code);
  }
  const tool = read('tools/d1-photo-column.ps1');
  for (const code of [...OLD, ...NEW]) {
    const dbName = (read(`sites/${code}/wrangler.jsonc.example`).match(/"database_name":\s*"([^"]+)"/) || [])[1];
    assert.ok(dbName && tool.includes(`code = '${code}'; db = '${dbName}'`), `${code}: ${dbName} in the tool`);
  }
  assert.equal((tool.match(/@\{ code = '[a-z]{3}'; db = /g) || []).length, 13);
  assert.ok(tool.includes("'ΕΓΚΡΙΝΩ ΣΤΗΛΗ ΦΩΤΟΓΡΑΦΙΩΝ'"), 'the approval phrase');
  assert.ok(tool.includes('time-travel info') && tool.includes('pragma_table_info'), 'a restore point first, the column list read');
});

test('L206: every import tool asks the database (read-only) for the column before the plan, and sets GW_IMAGES_COLUMN only then', () => {
  for (const f of ['legacy-import', 'agw-cloudflare', 'bgw-cloudflare', 'pgw-cloudflare', 'sgw-cloudflare', 'tgw-cloudflare', 'vgw-cloudflare', 'zgw-cloudflare']) {
    const t = read(`tools/${f}.ps1`);
    const ask = t.indexOf("pragma_table_info('products') WHERE name = 'images'");
    const set = t.indexOf("$env:GW_IMAGES_COLUMN = '1'");
    const plan = t.search(/& node (\(Join-Path|@planArgs)/);
    assert.ok(ask > 0 && set > ask && plan > set, `${f}: ask, then set, then the plan`);
    assert.ok(t.includes('Remove-Item Env:\\GW_IMAGES_COLUMN'), `${f}: cleared after the plan`);
  }
});

test('L206: the site script handles the gallery (no library, no inline handler) and every site has the TGW copy', () => {
  const js = read('sites/tgw/public/assets/site.js');
  assert.ok(js.includes('function setupGallery()') && js.includes("img.getAttribute('data-src')") && js.includes("addEventListener('error'"));
  assert.ok(/setupGallery\(\);\s*\n\s*\/\/ Language first/.test(js), 'runs at once, before the language is loaded');
  // Review (P3b): the alt texts in the visitor's language, with the dictionary text "Photo {0} of {1}" (L24).
  assert.ok(js.includes("img.setAttribute('alt', name + ' \\u2013 ' + tf('Photo {0} of {1}'") && /loadLanguage\(\)\.then\(function \(\) \{\s*\n\s*relabelGalleries\(\);/.test(js));
  const css = read('sites/tgw/public/assets/site.css');
  assert.ok(css.includes('scroll-snap-type: x mandatory') && css.includes('.product-gallery:not([data-ready]) .gallery-slide + .gallery-slide { display: none; }'));
  for (const code of [...OLD, ...NEW]) assert.equal(read(`sites/${code}/public/assets/site.js`), js, code);
  for (const code of [...OLD, ...NEW]) assert.match(config[code].assetVersion, /^(2026-11-20-[a-z]{3}-photos|2026-11-21-[a-z]{3}-au|2026-11-25-[a-z]{3}-app)-1$/, `${code}: new asset version (L31)`);
});
