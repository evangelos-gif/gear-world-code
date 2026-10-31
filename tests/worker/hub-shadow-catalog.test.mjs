// Hub shadow catalogue (phase 1, 31 Oct 2026): every joined shop offered to the 5 sites with general rules, READ-ONLY.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { archiveFeeds, offeredShops, shadowCatalog, siteSources } from '../../tools/hub-shadow-catalog.mjs';
import { readList } from '../../tools/moto-feed-scan.mjs';

const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean\n';
const link = (p, m) => `https://www.awin1.com/pclick.php?p=${p}&a=1&m=${m}`;
const TOOLS = 'Cycle & Motorcycle > Motorcycle > Motorcycle Tools';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'hub-shadow-'));
  const a = join(dir, 'GW_AWIN_BULK_ARCHIVE'), b = join(dir, 'GW_AWIN_NEW_20261031');
  mkdirSync(a); mkdirSync(b);
  writeFileSync(join(a, 'AWIN_496_89987.csv.gz'), gzipSync(head
    + `${link(1, 496)},Sealey Motorcycle Paddock Stand Rear,1,T-1,https://img.example/1.jpg,${TOOLS},69.95,GBP,Sealey,1,\n`
    + `${link(2, 496)},Draper 18V Combi Drill,2,T-2,https://img.example/2.jpg,Power Tools > Drills,99,GBP,Draper,1,\n`));
  // A shop no site lists yet: the Hub offers it to every site, each site's rules decide by the name.
  writeFileSync(join(b, 'AWIN_99001_1.csv.gz'), gzipSync(head
    + `${link(3, 99001)},Shoei NXR2 Full Face Motorcycle Helmet,3,M-1,https://img.example/3.jpg,Helmets,399,GBP,Shoei,1,\n`
    + `${link(4, 99001)},Sony WH-1000XM5 Wireless Headphones,4,M-2,https://img.example/4.jpg,Audio,279,GBP,Sony,1,\n`
    + `${link(5, 99001)},Garden Hose Reel 30m,5,M-3,https://img.example/5.jpg,Garden,25,GBP,Hozelock,1,\n`));
  // A shop whose programme the owner has NOT joined: never counted when the Awin list is known.
  writeFileSync(join(b, 'AWIN_99002_2.csv.gz'), gzipSync(head
    + `${link(6, 99002)},AGV K6 S Motorcycle Helmet,6,N-1,https://img.example/6.jpg,Helmets,449,GBP,AGV,1,\n`));
  writeFileSync(join(b, 'CJ_7000001.csv.gz'), gzipSync(head));
  const listFile = join(dir, 'list.csv');
  writeFileSync(listFile, 'Advertiser ID,Advertiser Name,Primary Region,Membership Status,Feed ID,Feed Name,No of products\n'
    + '496,Tooled Up,GB,active,89987,Tooled Up,2\n'
    + '99001,Moto Test Shop,GB,active,1,Main,3\n'
    + '99003,Missing Shop,GB,active,7,Main,5000\n'
    + '99002,Not Joined Shop,GB,notjoined,2,Main,1\n');
  return { dir, archive: `${a};${b}`, files: [join(a, 'AWIN_496_89987.csv.gz'), join(b, 'AWIN_99001_1.csv.gz')], listFile };
}
const hash = f => createHash('sha256').update(readFileSync(f)).digest('hex');

test('offered shops: joined AND on this PC, joined feeds only; missing and not-joined are reported', async () => {
  const fx = fixture();
  const { byAdv, cj } = archiveFeeds(fx.archive.split(';'));
  assert.equal(cj, 1);
  const list = await readList(fx.listFile);
  const { offered, missing, notJoined, joinedCount } = offeredShops(byAdv, list);
  assert.deepEqual([...offered.keys()].sort(), [496, 99001]);
  assert.equal(joinedCount, 3);
  assert.deepEqual(missing.map(m => m.adv), [99003]);
  assert.deepEqual(notJoined, [99002]);
  const none = offeredShops(byAdv, null);
  assert.equal(none.offered.size, 3, 'without the Awin list every shop on the PC is offered');
});

test('site sources: a listed shop keeps its own rules, an unlisted one is added without a section filter', () => {
  const own = [{ advertiserId: 496, feedIds: [89987], retailer: 'Tooled Up', approved: true, allowPaths: ['motorcycle'] },
    { advertiserId: 118435, retailer: 'VEVOR', approved: false }];
  const offered = new Map([[496, { name: 'Tooled Up', feedIds: [89987, 118473] }], [99001, { name: 'Moto Test Shop', feedIds: [1] }], [118435, { name: 'VEVOR', feedIds: [1] }]]);
  const { sources, listed } = siteSources(own, offered);
  assert.deepEqual(sources.find(s => s.advertiserId === 496), own[0], 'L65: the allowPaths of a listed shop stay');
  assert.equal(sources.find(s => s.advertiserId === 118435).approved, false, 'a shop the site keeps out stays out');
  const added = sources.find(s => s.advertiserId === 99001);
  assert.equal(added.approved, true);
  assert.equal(added.allowPaths, undefined);
  assert.ok(listed.has(496) && !listed.has(99001));
});

test('shadow catalogue: new shop routed by each site\'s rules, not-joined shop out, no SQL, feeds unchanged', async () => {
  const fx = fixture();
  const before = fx.files.map(hash);
  const out = join(fx.dir, 'out');
  mkdirSync(out);
  const list = await readList(fx.listFile);
  const { summary, results, multi } = await shadowCatalog({ archive: fx.archive, outDir: out, list, now: new Date('2026-10-31T15:00:00Z') });
  const site = code => results.find(r => r.site.code === code);
  const names = code => site(code).rows.map(p => p.name);
  assert.ok(names('BGW').includes('Shoei NXR2 Full Face Motorcycle Helmet'), 'the new shop\'s helmet goes to Biker');
  assert.ok(names('BGW').includes('Sealey Motorcycle Paddock Stand Rear'), 'the listed shop keeps its motorbike section');
  assert.ok(!names('BGW').some(n => /AGV/.test(n)), 'a shop the owner has not joined never counts');
  assert.ok(!names('BGW').some(n => /Drill/.test(n)), 'L65 still holds for Tooled Up on Biker');
  assert.ok(names('TGW').includes('Sony WH-1000XM5 Wireless Headphones'), 'the new shop\'s headphones go to Technology');
  assert.ok(!names('BGW').includes('Sony WH-1000XM5 Wireless Headphones'));
  assert.equal(typeof multi, 'number');
  assert.match(summary, /ΚΑΤΑΛΟΓΟΣ «ΣΤΗ ΣΚΙΑ»/);
  assert.match(summary, /ΜΟΝΟ ΑΝΑΓΝΩΣΗ/);
  assert.match(summary, /ΛΕΙΠΟΥΝ από τον υπολογιστή: 1/);
  assert.match(summary, /99003 Missing Shop/);
  assert.match(summary, /ΔΕΝ είσαι μέλος/);
  assert.match(summary, /Αρχεία CJ στον υπολογιστή: 1/);
  assert.match(summary, /BGW Biker .*νέα \+ +1 /);
  assert.match(summary, /Moto Test Shop/);
  assert.match(summary, /CGW, MGW, WGW, KGW, HGW, GGW: .*Φάση 4/);
  for (const r of results) {
    assert.ok(existsSync(join(out, r.site.code, 'report.txt')), `${r.site.code} report written`);
    assert.ok(!existsSync(join(out, r.site.code, 'sql')), `${r.site.code}: no SQL`);
  }
  assert.ok(existsSync(join(out, 'summary.txt')));
  assert.deepEqual(fx.files.map(hash), before, 'the feed files are not changed');
});

test('shadow catalogue without the Awin list: every shop on the PC counts, with a warning', async () => {
  const fx = fixture();
  const out = join(fx.dir, 'out2');
  mkdirSync(out);
  const { summary, results } = await shadowCatalog({ archive: fx.archive, outDir: out, list: null, now: new Date('2026-10-31T15:00:00Z') });
  assert.match(summary, /δεν διαβάστηκε η λίστα του Awin/);
  assert.ok(results.find(r => r.site.code === 'BGW').rows.some(p => /AGV/.test(p.name)));
});
