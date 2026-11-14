// Feed profile (owner, 8 Nov 2026): read-only summary of new feeds, to write import rules and choose the site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, statSync, utimesSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chooseFiles, profileFile, render } from '../../tools/feed-profile.mjs';

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
