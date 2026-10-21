import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { matchGaps, scanFeeds } from '../../tools/gw-feed-gaps.mjs';

test('feed gaps: products go to the right thin category, look-alikes do not (lessons L14)', () => {
  const yes = [
    ['Bali 4 Seater Rattan Corner Sofa Set', 'GGW:furniture-outdoor-living'],
    ['Weber Spirit E-325 Gas BBQ', 'GGW:bbq'],
    ['Ooni Koda 16 Pizza Oven', 'GGW:bbq'],
    ['Forest Garden 6x4 Overlap Apex Shed', 'GGW:buildings-fencing'],
    ['Solar String Lights 100 LED Outdoor', 'GGW:garden-lighting'],
    ['Tulip Bulbs Mixed 50', 'GGW:plants-seeds'],
    ['Peat-free Multi-purpose Compost 50L', 'GGW:plants-seeds'],
    ['Paw Patrol Kids Backpack', 'KGW:school-bags'],
    ['Spider-Man Kids Backpack', 'KGW:school-bags'],
    ['Weber Master-Touch Charcoal BBQ with Hood', 'GGW:bbq'],
    ['Nike Air Max Kids Trainers', 'KGW:kids-shoes'],
    ['VTech KidiZoom Camera', 'KGW:kids-tech'],
    ['Girls Unicorn Beanie Hat', 'KGW:kids-accessories'],
    ['Chanel No 5 Eau de Parfum 100ml', 'WGW:beauty-fragrance'],
    ['Charlotte Tilbury Pillow Talk Lipstick', 'WGW:beauty-fragrance'],
    ['Leather Bifold Wallet', 'MGW:everyday-carry'],
    ['Hugo Boss Bottled Pour Homme EDT 100ml', 'MGW:grooming-fragrance'],
    ['Philips Hue White Smart Bulb E27', 'HGW:smart-home'],
    ['Shark Cordless Stick Vacuum', 'HGW:cleaning'],
    ['Vileda Steam Mop', 'HGW:cleaning']
  ];
  for (const [name, gap] of yes) assert.ok(matchGaps(name).includes(gap), `${name} -> ${gap}`);
  const no = ['Sesame Seeds 500g', 'LED Light Bulb E27 9W', 'Mens Leather Trainers', 'Blush Pink Midi Dress', 'Womens Leather Purse Wallet',
    'Razor A5 Lux Kick Scooter', 'Alexa Midi Dress', 'Thermos Vacuum Flask 1L', 'Long Duster Coat', 'BBQ Sauce Smoky 500ml', 'LEGO Garden Shed Set',
    'Dior Sauvage Eau de Toilette for Men', 'BBQ Hood (Brittany Blue) | XS | Stan Ray', 'Nappy Wallet - Leo Lion', 'Einhell 18V Cordless Grass and Seed Spreader',
    'Bosch Shrub Shear Blade 120mm', 'Baby Parasol for Pushchairs', 'Kids Lunchbox Soft Drink 8 x 200ml', 'Kids Thermal Socks 3 Pack'];
  const wrong = { 'Dior Sauvage Eau de Toilette for Men': 'WGW:beauty-fragrance' };
  for (const name of no) {
    const hits = matchGaps(name);
    if (wrong[name]) assert.ok(!hits.includes(wrong[name]), `${name} must not be ${wrong[name]}`);
    else assert.deepEqual(hits, [], name);
  }
  assert.ok(matchGaps('Dior Sauvage Eau de Toilette for Men').includes('MGW:grooming-fragrance'));
});

const HEADER = 'aw_deep_link,product_name,merchant_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,in_stock\n';
const row = (n, name, merchant, cat, price, opts = {}) =>
  `${opts.link || `https://www.awin1.com/pclick.php?p=${n}`},"${name}",${merchant},${n},M-${n},${opts.image || `https://img.example/${n}.jpg`},${cat},${price},${opts.currency || 'GBP'},${opts.stock ?? 1}\n`;

test('feed gaps: scan counts candidates per retailer, skips TGW sources, bad rows and older copies', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw-gaps-'));
  writeFileSync(join(dir, 'AWIN_123932_114093.csv.gz'), gzipSync(HEADER +
    row(1, 'Sony 55" BRAVIA 4K Smart Google TV', 'Joybuy UK', 'Electronics > Video > Televisions', 499) +
    row(2, 'Solar Garden Lights 10 Pack', 'Joybuy UK', 'Home & Garden > Lighting', 19.99) +
    row(3, 'Rattan Garden Furniture Set 4 Seater', 'Joybuy UK', 'Home & Garden > Garden', 299)));
  const home = HEADER +
    row(10, 'Philips Hue Smart Bulb E27', 'Home Store', 'Lighting', 39.99) +
    row(11, 'Philips Hue Smart Bulb E27', 'Home Store', 'Lighting', 39.99) +
    row(12, 'Shark Cordless Stick Vacuum', 'Home Store', 'Floorcare', 199) +
    row(13, 'Weber Kettle Charcoal BBQ', 'Home Store', 'Garden', 129, { stock: 0 }) +
    row(14, 'Weber Gas BBQ', 'Home Store', 'Garden', 329, { currency: 'EUR' }) +
    row(15, 'Steam Mop', 'Home Store', 'Floorcare', 49, { image: 'http://img.example/15.jpg' }) +
    row(16, 'Outdoor Festoon Lights', 'Home Store', 'Garden', 25, { link: 'https://shop.example/16' });
  writeFileSync(join(dir, 'AWIN_5555_777.csv.gz'), gzipSync(home));
  mkdirSync(join(dir, 'old'));
  const oldFile = join(dir, 'old', 'AWIN_5555_777.csv.gz');
  writeFileSync(oldFile, gzipSync(HEADER + row(20, 'Old Garden Shed', 'Home Store', 'Garden', 500)));
  const past = new Date('2026-01-01T00:00:00Z');
  utimesSync(oldFile, past, past);
  writeFileSync(join(dir, 'datafeeds.csv'), 'Advertiser ID,Advertiser Name,Membership Status,Feed ID\n123932,Joybuy UK,active,114093\n5555,Home Store,active,777\n');
  const before = readFileSync(join(dir, 'AWIN_5555_777.csv.gz'));

  process.env.GW_QUIET = '1';
  const { report, gapData, feeds } = await scanFeeds({ archive: dir, now: new Date('2026-10-21T20:00:00Z') });
  const count = (gap, adv) => (gapData.get(gap)?.get(adv)?.names.size) || 0;

  assert.equal(feeds.length, 2, 'two feeds, the older copy is skipped');
  assert.match(report, /older copies skipped: 1/);
  assert.equal(count('GGW:garden-lighting', 123932), 1, 'Joybuy solar lights count for Garden');
  assert.equal(count('GGW:furniture-outdoor-living', 123932), 1);
  assert.equal(count('TGW:tv-home-cinema', 123932), 0, 'Joybuy is already on TGW: skipped for TGW');
  assert.equal(count('HGW:smart-home', 5555), 1, 'same name twice counts once');
  assert.equal(count('TGW:smart-home-wifi', 5555), 1, 'another retailer counts for TGW');
  assert.equal(count('HGW:cleaning', 5555), 1, 'http image row skipped');
  assert.equal(count('GGW:bbq', 5555), 0, 'out of stock and EUR rows skipped');
  assert.equal(count('GGW:garden-lighting', 5555), 0, 'non-Awin link skipped');
  assert.equal(count('GGW:buildings-fencing', 5555), 0, 'older copy not read');
  assert.match(report, /Awin feed list found: membership status for 2 advertisers/);
  assert.match(report, /Home Store \(5555\) \[active\]/);
  assert.match(report, /Garden Gear World: Garden lighting {2}\[1 retailer\(s\)\]/);
  assert.match(report, /Nothing was imported/);
  assert.deepEqual(readFileSync(join(dir, 'AWIN_5555_777.csv.gz')), before, 'archive unchanged');
});
