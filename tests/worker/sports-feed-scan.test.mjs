// Sports feed scan (read-only): which feed products are sport products for the planned Sporty Gear World (SGW),
// which belong to another Gear World site, and which Awin programmes look like sports retailers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { classify, inStock, isSportProgramme, listFeedFiles, scanArchive, readList, render } from '../../tools/sports-feed-scan.mjs';

const cat = (n, c = '') => { const r = classify(n, c); return r.sport ? r.cat : null; };
const ov = (n, c = '') => classify(n, c).overlap || null;

test('sport products go to the proposed category', () => {
  assert.equal(cat('Adjustable Dumbbell Set 20kg'), 'fitness-gym');
  assert.equal(cat('Yoga Mat Non Slip 6mm'), 'fitness-gym');
  assert.equal(cat('Magnetic Exercise Bike'), 'fitness-gym');
  assert.equal(cat('Mini Stepper for Exercise'), 'fitness-gym');
  assert.equal(cat('Everlast Boxing Gloves 12oz'), 'combat');
  assert.equal(cat("Men's Running Shoes Lightweight"), 'running');
  assert.equal(cat('Carrera Road Bike 54cm'), 'cycling');
  assert.equal(cat('LED Rear Light', 'Sports & Outdoors > Cycling > Bike Lights'), 'cycling');
  assert.equal(cat('Nike Mercurial Football Boots FG'), 'team-sports');
  assert.equal(cat('Pop Up Football Goal for Garden'), 'team-sports');
  assert.equal(cat('Wilson Pro Staff Tennis Racket'), 'racket-sports');
  assert.equal(cat('Padel Racket Carbon'), 'racket-sports');
  assert.equal(cat('Callaway Golf Balls 12 Pack'), 'golf');
  assert.equal(cat('Inflatable Stand Up Paddle Board 10ft'), 'water-sports');
  assert.equal(cat('Swimming Goggles Anti Fog'), 'water-sports');
  assert.equal(cat('Ski Goggles OTG'), 'winter-sports');
  assert.equal(cat('Climbing Harness'), 'outdoor-climbing');
  assert.equal(cat('Protein Shaker Bottle 700ml'), 'bags-bottles');
  assert.equal(cat("Women's Sports Bra High Impact"), 'sportswear-shoes');
  assert.equal(cat('Gym Leggings High Waist'), 'sportswear-shoes');
  // owner, 25 Oct 2026: sports shoes, gym, supplements and all fitness belong on SGW
  assert.equal(cat('Nike Air Zoom Pegasus 41 Mens Trainers'), 'sportswear-shoes');
  assert.equal(cat('ASICS Gel-Kayano 31 Running Shoes'), 'running');
  assert.equal(cat('Whey Protein Powder 1kg Chocolate'), 'nutrition');
  assert.equal(cat('Creatine Monohydrate 500g'), 'nutrition');
  assert.equal(cat('Pre-Workout Fruit Punch 30 Servings'), 'nutrition');
  assert.equal(cat('Energy Gels Pack of 20'), 'nutrition');
  assert.equal(cat('Vitamin D3 Tablets', 'Sports Nutrition > Vitamins'), 'nutrition');
  assert.equal(cat('Vitamin D3 Tablets', 'Health > Vitamins'), null, 'a general supplement needs a sport word or a sport shop category');
});

test('not sport products, even with a sport word (L42)', () => {
  for (const n of ['Bicycle Playing Cards Standard', 'Tennis Bracelet Silver', 'VW Golf Mk7 Floor Mats', 'Daytime Running Lights LED Car',
    'Running Boards for Ford Ranger', 'Nema 17 Stepper Motor 2A', 'Boxing Day Deal TV 55"', 'Motorbike Helmet Full Face',
    'Night Mouth Guard for Teeth Grinding', 'Table Runner Christmas', 'Hose Reel with 30m Hose', 'Mouse Bait Station', 'Wireless Mouse']) {
    const r = classify(n, '');
    assert.equal(r.sport, false, n);
    assert.equal(r.overlap, undefined, n);
  }
});

test('sport products of another Gear World site are counted apart', () => {
  assert.equal(ov('Kids Balance Bike 12 inch'), 'kids');
  assert.equal(ov('Junior Football Boots Adidas'), 'kids');
  assert.equal(ov('Thule Towbar Bike Rack 3 Bikes'), 'car');
  assert.equal(ov('Bestway Above Ground Swimming Pool'), 'garden');
  assert.equal(ov('Mens Swim Shorts Quick Dry'), 'swimwear');
  assert.equal(ov('Hiking Boots Waterproof Mens'), 'vgw');
  // smartwatches and supplements are counted even without a sport word (owner decides TGW or SGW)
  assert.equal(ov('Garmin Forerunner 265'), 'watch');
  assert.equal(ov('Samsung Galaxy Watch 7 44mm', 'Electronics > Wearables'), 'watch');
  assert.equal(ov('Protein Shaker Bottle 700ml'), null);
  // trainers with no sport word and no sports brand: counted apart (sport or fashion, owner decides)
  assert.equal(ov('Chunky Platform Trainers White'), 'trainers');
  assert.equal(ov('Nike Air Zoom Pegasus 41 Mens Trainers'), null);
  assert.equal(ov('Cross Trainer Elliptical Machine'), null);
  assert.equal(ov('Kids Light Up Trainers'), 'kids');
  // a fitness trampoline is gym gear, a garden trampoline is not a sport product
  assert.equal(cat('Fitness Trampoline Rebounder 40 inch'), 'fitness-gym');
  assert.equal(classify('10ft Trampoline with Safety Net').sport, false);
});

test('stock: a quantity number wins over the flag (L64), the flag counts when there is no quantity (L37)', () => {
  assert.equal(inStock('0', '1'), false);
  assert.equal(inStock('3', '0'), true);
  assert.equal(inStock('', '1'), true);
  assert.equal(inStock('', '0'), false);
  assert.equal(inStock('', 'in stock'), true);
  assert.equal(inStock('', 'out_of_stock'), false);
  assert.equal(inStock('', ''), null);
});

test('Awin programmes that sell sport products, not tickets, bets or memberships', () => {
  for (const p of ['Decathlon UK', 'Wiggle', 'Sweaty Betty', 'Gymshark', 'Myprotein', 'Pro:Direct Soccer']) assert.ok(isSportProgramme(p), p);
  for (const p of ['PureGym Membership', 'Sky Bet', 'Ticketmaster', 'Jet2 Holidays', 'Coes', 'Joybuy UK']) assert.ok(!isSportProgramme(p), p);
});

test('scan: two folders (newest copy counts), Google feed sizes joined, quantity 0 out of stock, other CSV files skipped', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sportscan-'));
  const oldDir = join(root, 'GW_AWIN_BULK_ARCHIVE');
  const newDir = join(root, 'GW_AWIN_NEW_20261025');
  mkdirSync(oldDir); mkdirSync(newDir);
  const head = 'merchant_name,aw_product_id,product_name,search_price,currency,in_stock,stock_quantity,merchant_category\n';
  writeFileSync(join(oldDir, 'AWIN_111_1.csv.gz'), gzipSync(head + 'Sport Shop,1,"Old Feed Kettlebell 8kg",20,GBP,1,5,Fitness\n'));
  writeFileSync(join(newDir, 'AWIN_111_1.csv.gz'), gzipSync(head
    + 'Sport Shop,1,"Kettlebell 12kg Cast Iron",29,GBP,1,5,Fitness\n'
    + 'Sport Shop,2,"Yoga Mat 6mm",15,GBP,1,0,Yoga\n'
    + 'Sport Shop,3,"Garmin Forerunner 265",349,GBP,1,2,Wearables\n'
    + 'Sport Shop,4,"Garden Hose 30m",19,GBP,1,9,Garden\n'));
  const t0 = new Date('2026-10-20T10:00:00Z'), t1 = new Date('2026-10-25T10:00:00Z');
  utimesSync(join(oldDir, 'AWIN_111_1.csv.gz'), t0, t0);
  utimesSync(join(newDir, 'AWIN_111_1.csv.gz'), t1, t1);
  writeFileSync(join(root, '222-retail-en_GB.csv.gz'), gzipSync('id,title,link,price,sale_price,availability,brand,product_type\n'
    + 'a1,"Trail Running Shoes - Black / UK 8",https://shop.example/p1,89.99 GBP,,in stock,Fast,Running > Shoes\n'
    + 'a2,"Trail Running Shoes - Black / UK 9",https://shop.example/p1,84.99 GBP,,in stock,Fast,Running > Shoes\n'
    + 'a3,"Trail Running Shoes - Blue / UK 8",https://shop.example/p1,89.99 GBP,,out of stock,Fast,Running > Shoes\n'));
  writeFileSync(join(root, '2025-bank-statement.csv'), 'date,amount,payee\n2025-01-01,10,Shop\n');
  const files = listFeedFiles([oldDir, newDir, root]);
  assert.equal(files.filter(f => f.advertiserId === 111).length, 1);
  assert.equal(files.find(f => f.advertiserId === 111).dir, newDir);
  const { advs, files: used } = await scanArchive({ archives: [oldDir, newDir, root], now: t1.getTime() });
  assert.ok(!used.some(f => /bank/.test(f.file)), 'the other CSV file is not listed');
  assert.ok(!advs.some(a => a.advertiserId === 2025));
  const a = advs.find(x => x.advertiserId === 111);
  assert.equal(a.products, 4);
  assert.equal(a.sport, 2);
  assert.equal(a.sportInStock, 1, 'yoga mat with quantity 0 is out of stock');
  assert.equal(a.overlaps.watch, 1);
  assert.equal(a.cats['fitness-gym'], 2);
  const g = advs.find(x => x.advertiserId === 222);
  assert.equal(g.google, true);
  assert.equal(g.sport, 1, 'all sizes and colours of the Google feed are one product');
  assert.equal(g.cats.running, 1);
  const listFile = join(root, 'list.csv');
  writeFileSync(listFile, 'Advertiser ID,Advertiser Name,Primary Region,Membership Status,Feed ID,Feed Name,Vertical,No of products\n'
    + '111,Sport Shop,GB,active,1,Main,Retail,4\n'
    + '222,Fast Running,GB,active,9,Google,Retail,3\n'
    + '333,Decathlon UK,GB,notjoined,7,Main,Sports,90000\n'
    + '444,Sky Bet,GB,notjoined,8,Odds,Sports,10\n'
    + '555,Home Shop,GB,active,2,Main,Retail,10\n');
  const list = await readList(listFile);
  const { text } = render({ advs, files: used, list, archives: [oldDir, newDir, root] });
  assert.match(text, /111 Sport Shop: 2 sport of 4 products/);
  assert.match(text, /222 Fast Running: 1 sport of 1 products .*Google format/);
  assert.match(text, /Awin: JOINED/);
  assert.match(text, /Smartwatches & fitness trackers \(decide: TGW or SGW\)\s+1/);
  assert.match(text, /https:\/\/ui\.awin\.com\/merchant-profile\/333/);
  assert.doesNotMatch(text, /merchant-profile\/444/);
  assert.doesNotMatch(text, /merchant-profile\/111/);
  assert.doesNotMatch(text, /bank-statement/);
  assert.match(text, /file on this PC: yes/);
});
