// Feed profile (owner, 8 Nov 2026): read-only summary of new feeds, to write import rules and choose the site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, statSync, utimesSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chooseFiles, feedOf, parseNetworks, profileFile, render } from '../../tools/feed-profile.mjs';

const HEAD = 'merchant_name,product_name,brand_name,search_price,rrp_price,currency,in_stock,merchant_category,aw_deep_link,merchant_image_url,language';
const link = p => `"https://www.awin1.com/pclick.php?p=1&a=0&m=1&ued=https%3A%2F%2Fwww.silvercloud.example%2F${p}"`;
const ROWS = [
  `Silver Cloud Beauty,Silver Pillowcase,Silver Cloud,39.00,49.00,GBP,1,Pillowcases,${link('a')},https://img/a.jpg,en`,
  `Silver Cloud Beauty,Silver Make-up Sponge,Silver Cloud,12.50,,GBP,0,Make-up Tools,${link('b')},,en`,
  `Silver Cloud Beauty,Silver Hair Wrap,Silver Cloud,25.00,,GBP,1,Pillowcases,${link('c')},https://img/c.jpg,en`
];

test('profile: products, stock, prices, shop address from "ued", categories, brands, samples; the file is unchanged', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'feed-prof-'));
  const file = join(dir, 'AWIN_102901_99999.csv.gz');
  writeFileSync(file, gzipSync([HEAD, ...ROWS].join('\n') + '\n'));
  const before = readFileSync(file);
  const p = await profileFile(file);
  assert.deepEqual([p.rows, p.inStock, p.priced, p.withWas, p.withImage], [3, 2, 3, 1, 2]);
  assert.deepEqual(p.hosts, { 'silvercloud.example': 3 });
  assert.equal(p.categories.Pillowcases, 2);
  const text = render({ profiles: [p], archive: dir, days: 2 });
  assert.match(text, /=== Silver Cloud Beauty \(Awin 102901, feed 99999\)/);
  assert.match(text, /Προϊόντα: 3 \| σε απόθεμα: 2 \| με τιμή: 3 \| με «πριν» τιμή: 1 \| με εικόνα: 2/);
  assert.match(text, /Τιμές: από 12\.50 \| μέση 25\.00 \| έως 39\.00/);
  assert.match(text, /Site καταστήματος: silvercloud\.example 3/);
  assert.match(text, /Κατηγορίες \(2\): Pillowcases \(2\); Make-up Tools \(1\)/);
  assert.ok(readFileSync(file).equals(before));
});

test('which files: the recent ones by default, or exactly the advertisers asked for', () => {
  const dir = mkdtempSync(join(tmpdir(), 'feed-prof-'));
  for (const f of ['AWIN_1_10.csv.gz', 'AWIN_2_20.csv.gz', 'notes.txt']) writeFileSync(join(dir, f), 'x');
  const old = (Date.now() - 10 * 86400000) / 1000;
  utimesSync(join(dir, 'AWIN_1_10.csv.gz'), old, old);
  assert.deepEqual(chooseFiles(dir, { days: 2 }), ['AWIN_2_20.csv.gz']);
  assert.deepEqual(chooseFiles(dir, { advertisers: ['1'] }), ['AWIN_1_10.csv.gz']);
  assert.ok(statSync(join(dir, 'AWIN_1_10.csv.gz')).mtimeMs < Date.now() - 86400000);
});

test('L133: CJ, Daisycon and Rakuten catalogues are profiled too; -Advertiser with -AlsoHours = the shops asked for and everything just downloaded', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'feed-prof-'));
  const cjHead = 'data_feed_id,merchant_id,merchant_name,aw_deep_link,product_name,merchant_deep_link,search_price,currency,in_stock,merchant_category';
  writeFileSync(join(dir, 'CJ_5531758.csv.gz'), gzipSync([cjHead,
    'cj,5531758,Haglofs,https://www.anrdoezrs.net/links/1/type/dlg/x,Korp Mid Jacket Men,https://www.haglofs.com/en/gb/korp,65.00,GBP,in stock,Jackets'].join('\n') + '\n'));
  for (const f of ['AWIN_1_10.csv.gz', 'AWIN_2_20.csv.gz', 'DAISYCON_16029.csv.gz', 'RAKUTEN_388061.csv.gz', '120435-retail-en_GB.csv.gz', 'CJ_x.csv.gz']) writeFileSync(join(dir, f), 'x');
  const old = (Date.now() - 10 * 86400000) / 1000;
  for (const f of ['AWIN_1_10.csv.gz', 'RAKUTEN_388061.csv.gz']) utimesSync(join(dir, f), old, old);
  assert.deepEqual(chooseFiles(dir, { days: 2 }), ['AWIN_2_20.csv.gz', 'CJ_5531758.csv.gz', 'DAISYCON_16029.csv.gz']);
  assert.deepEqual(chooseFiles(dir, { advertisers: ['388061'] }), ['RAKUTEN_388061.csv.gz']);
  assert.deepEqual(chooseFiles(dir, { advertisers: ['1', '388061'], alsoDays: 0.25 }),
    ['AWIN_1_10.csv.gz', 'AWIN_2_20.csv.gz', 'CJ_5531758.csv.gz', 'DAISYCON_16029.csv.gz', 'RAKUTEN_388061.csv.gz']);
  const p = await profileFile(join(dir, 'CJ_5531758.csv.gz'));
  assert.equal(p.network, 'CJ');
  assert.deepEqual(p.hosts, { 'haglofs.com': 1 }, 'the shop page, not the CJ tracking host');
  const text = render({ profiles: [p], archive: dir, advertisers: ['5531758'], alsoDays: 0.25 });
  assert.match(text, /=== Haglofs \(CJ 5531758\)/);
  assert.match(text, /Καταστήματα: 5531758 και ό,τι κατέβηκε τις τελευταίες 6 ώρες \(1 feeds\)/);
});

test('chat 9, 16 Nov 2026: files per country (DAISYCON_<id>_<CC>, L163) and per search (CJ_<id>_<search>, L161) are profiled; -Network picks one network even when two ids are the same number', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'feed-prof-'));
  const dcHead = 'merchant_name,product_name,brand_name,search_price,currency,in_stock,merchant_category,merchant_deep_link,aw_deep_link,last_updated,language';
  writeFileSync(join(dir, 'DAISYCON_14965_DE.csv.gz'), gzipSync([dcHead,
    'Superdry DE,Vintage Logo Hoodie,Superdry,59.99,EUR,1,Hoodies,https://www.superdry.de/p/1,https://lt45.net/c/?si=14965&dl=p%2F1,2026-11-15 22:10:00,de',
    'Superdry DE,Cargo Hose,Superdry,69.99,EUR,1,Hosen,https://www.superdry.de/p/2,https://lt45.net/c/?si=14965&dl=p%2F2,2026-10-01 09:00:00,de'].join('\n') + '\n'));
  for (const f of ['DAISYCON_14965_NL.csv.gz', 'DAISYCON_20164_GB.csv.gz', 'DAISYCON_12502.csv.gz', 'AWIN_12502_777.csv.gz', 'CJ_3992613_kids-winter-boots.csv.gz', 'DAISYCON_1_x y.csv.gz', 'DAISYCON_14965_DE.csv.gz.part']) writeFileSync(join(dir, f), 'x');
  assert.deepEqual(feedOf('DAISYCON_14965_de.csv.gz'), { network: 'Daisycon', advertiserId: 14965, feedId: null, part: 'DE' });
  assert.deepEqual(feedOf('CJ_3992613_kids-winter-boots.csv.gz'), { network: 'CJ', advertiserId: 3992613, feedId: null, part: 'kids-winter-boots' });
  assert.equal(feedOf('DAISYCON_14965_DE.csv.gz.part'), null, 'a half download is never read');
  assert.deepEqual(chooseFiles(dir, { days: 1 }), ['AWIN_12502_777.csv.gz', 'CJ_3992613_kids-winter-boots.csv.gz', 'DAISYCON_12502.csv.gz',
    'DAISYCON_14965_DE.csv.gz', 'DAISYCON_14965_NL.csv.gz', 'DAISYCON_20164_GB.csv.gz']);
  assert.deepEqual(chooseFiles(dir, { days: 1, networks: ['Daisycon'] }), ['DAISYCON_12502.csv.gz', 'DAISYCON_14965_DE.csv.gz', 'DAISYCON_14965_NL.csv.gz', 'DAISYCON_20164_GB.csv.gz']);
  assert.deepEqual(chooseFiles(dir, { advertisers: ['12502'], networks: ['Daisycon'] }), ['DAISYCON_12502.csv.gz'], 'not the Awin shop with the same number');
  assert.deepEqual(parseNetworks('daisycon'), ['Daisycon']);
  assert.deepEqual(parseNetworks(' CJ, Daisycon;cj '), ['CJ', 'Daisycon']);
  assert.deepEqual(parseNetworks(''), []);
  assert.equal(parseNetworks('Daisy'), null, 'an unknown name stops the tool instead of an empty report');
  const p = await profileFile(join(dir, 'DAISYCON_14965_DE.csv.gz'));
  assert.equal(p.part, 'DE');
  assert.equal(p.newest, '2026-11-15');
  const text = render({ profiles: [p], archive: dir, days: 1, networks: ['Daisycon'], generated: new Date('2026-11-16T21:00:00Z') });
  assert.match(text, /Δίκτυα: μόνο Daisycon/);
  assert.match(text, /=== Superdry DE \(Daisycon 14965 DE\)/);
  assert.match(text, /Νεότερη αλλαγή προϊόντος: 2026-11-15\n/);
  const stale = render({ profiles: [{ ...p, newest: '2026-07-31' }], archive: dir, days: 1, generated: new Date('2026-11-16T21:00:00Z') });
  assert.match(stale, /Νεότερη αλλαγή προϊόντος: 2026-07-31 \(πάνω από 14 μέρες, L147/);
});
