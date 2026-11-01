// Pets feed scan (read-only): which feed products are for the planned Pets Gear World (ZGW, petsgearworld.com), which
// belong to another Gear World site (children's toys, wild birds, vacuums, dog-print clothing), horse and riding gear (the
// 11th category, owner 1 Nov 2026), and which Awin programmes look like pet retailers (not insurance or vets).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { classify, isPetProgramme, scanArchive, readList, render } from '../../tools/pets-feed-scan.mjs';

const cat = (n, c = '') => { const r = classify(n, c); return r.sport ? r.cat : null; };
const ov = (n, c = '') => classify(n, c).overlap || null;

test('pet products go to the proposed category (names from the live Gear World sites, 1 Nov 2026)', () => {
  assert.equal(cat('PawHut Dog Crate Furniture with Removable Cushion'), 'beds-crates', 'a crate, not a cushion');
  assert.equal(cat('FUNNYFUZZY Dog Bed, Small Gray Calming Plush Sofa'), 'beds-crates');
  assert.equal(cat('Good Boy Dog Toy – Durable Squeaky Plush Play Toy'), 'toys', 'a dog toy, not a child\'s plush (it is on KGW today)');
  assert.equal(cat('Retractable Dog Lead 5m'), 'walking');
  assert.equal(cat('Halloween Dog Costume Pumpkin'), 'walking', 'clothing for the dog');
  assert.equal(cat('Royal Canin Mini Adult Dry Dog Food 8kg'), 'food');
  assert.equal(cat('Catsan Hygiene Cat Litter 10L'), 'cats');
  assert.equal(cat('PawHut Small Cat Tree for Indoor Cats with Sisal'), 'cats');
  assert.equal(cat('Dog Conditioner for All Coat Types'), 'grooming', 'on KGW today');
  assert.equal(cat('PawHut Foldable Pet Grooming Arm w/Clamp 30 Inch'), 'grooming', 'on CGW today');
  assert.equal(cat('Seresto Flea and Tick Collar for Large Dogs'), 'grooming', 'a flea collar, not a walking collar');
  assert.equal(cat('Adore Pets Grey Dog Food Storage Bin with Scoop'), 'feeding', 'storage, not food');
  assert.equal(cat('Stable Non-Slip Dog Bowl'), 'feeding');
  assert.equal(cat('60cm Foldable Pet Carrier Cat Bag w/ Cushion'), 'travel');
  assert.equal(cat('Rabbit Hutch with Run 2 Tier'), 'small-pets');
  assert.equal(cat('Fluval Flex Aquarium 57L'), 'small-pets');
  assert.equal(cat('Omlet Eglu Cube Chicken Coop'), 'outdoor');
  assert.equal(cat('Pet Gate Baby Gate for Dogs Extra Wide'), 'beds-crates', '"baby" here is for the dog');
  assert.equal(cat('Stainless Steel Bowl Set', 'Pet Supplies > Dogs > Bowls'), 'feeding', 'the shop says pets');
});

test('look-alike names, pest control, live animals and prescriptions are not pet products', () => {
  for (const n of ['Hush Puppies Mens Shoes', 'Cat 6 Ethernet Cable 5m', 'Caterpillar CAT Holton Boots', 'CAT S62 Pro Rugged Phone', 'Kitten Heels Black', 'Hot Dog Toaster', 'Bulldog Clips 50 Pack',
    'Flexi Hose 30m', 'Snakes and Ladders Board Game', 'Rat Trap 2 Pack', 'Live Mealworms 100g', 'Prescription Dog Food (vet only)', 'Recycled PET Plastic Bottles 1L', 'Turtle Beach Stealth 600',
    'Chicken Breast Fillets 1kg', 'Dog Walking Insurance Gift Card']) {
    assert.equal(classify(n, '').sport, false, n);
  }
  assert.equal(classify('Garden Hose Reel', '').sport, false, 'no pet word: not counted');
  assert.equal(classify('Dog', '').sport, false, 'a pet word alone, without a pet shop or a category word, is not counted');
});

test('products of another site are counted apart; horse gear is its own category', () => {
  assert.equal(ov('Paw Patrol Chase Plush 20cm'), 'kids');
  assert.equal(ov('Kids Dog Costume'), 'kids', 'a costume for a child');
  assert.equal(ov('Wild Bird Feeder Station with 4 Feeders'), null, 'no pet word: not counted at all');
  assert.equal(ov('Cat Repeller Ultrasonic Solar'), 'garden');
  assert.equal(ov('Pet Hair Vacuum Cleaner Cordless'), 'home');
  assert.equal(ov('Mens Dog Walking Jacket Waterproof'), 'merch');
  assert.equal(ov('Womens Cat Print Pyjamas'), 'merch');
  assert.equal(ov('Dog Print Backpack'), 'merch');
  assert.equal(cat('Horse Fly Mask Full Face'), 'horse', 'horse and riding: the 11th category (owner, 1 Nov 2026)');
  assert.equal(cat('Equestrian Saddle Pad Navy'), 'horse');
  assert.equal(cat('Hoof Chews for Dogs'), 'food', 'a dog chew, not horse gear');
  assert.equal(classify('PONY DANCE Eyelet Blackout Curtains', '').sport, false);
  assert.equal(classify('Charles Buyers Horse Moulded Top Stick', '').sport, false, 'a horse word without a horse product word');
});

test('Awin programmes that sell pet products, not insurance or vets', () => {
  for (const p of ['zooplus.co.uk', 'VioVet', 'Omlet UK', 'Pets at Home', 'Monster Pet Supplies', 'Lords & Labradors']) assert.ok(isPetProgramme(p), p);
  for (const p of ['ManyPets Insurance', 'Petplan Pet Insurance', 'Joii Online Vets', 'Rover Dog Sitting', 'Joybuy UK', 'Catering Supplies Direct']) assert.ok(!isPetProgramme(p), p);
});

test('scan: counts per retailer and category, other sites apart, Awin list with links, no insurance', async () => {
  const root = mkdtempSync(join(tmpdir(), 'petsscan-'));
  const dir = join(root, 'GW_AWIN_NEW_20261101');
  mkdirSync(dir);
  const head = 'merchant_name,aw_product_id,product_name,search_price,currency,in_stock,stock_quantity,merchant_category\n';
  writeFileSync(join(dir, 'AWIN_111_1.csv.gz'), gzipSync(head
    + 'Pet Shop,1,"Royal Canin Mini Adult Dry Dog Food 8kg",49,GBP,1,3,Pet Supplies\n'
    + 'Pet Shop,2,"Catsan Hygiene Cat Litter 10L",9,GBP,1,0,Pet Supplies\n'
    + 'Pet Shop,3,"Paw Patrol Chase Plush 20cm",12,GBP,1,2,Toys\n'
    + 'Pet Shop,4,"Garden Hose 30m",19,GBP,1,9,Garden\n'));
  const { advs, files } = await scanArchive({ archives: [dir], now: Date.now() });
  const a = advs.find(x => x.advertiserId === 111);
  assert.equal(a.products, 4);
  assert.equal(a.sport, 2);
  assert.equal(a.sportInStock, 1, 'the litter with quantity 0 is out of stock (L64)');
  assert.equal(a.cats.food, 1);
  assert.equal(a.cats.cats, 1);
  assert.equal(a.overlaps.kids, 1);
  const listFile = join(root, 'list.csv');
  writeFileSync(listFile, 'Advertiser ID,Advertiser Name,Primary Region,Membership Status,Feed ID,Feed Name,Vertical,No of products\n'
    + '111,Pet Shop,GB,active,1,Main,Retail,4\n'
    + '2940,zooplus.co.uk,GB,notjoined,7,Main,Retail,9000\n'
    + '444,ManyPets Insurance,GB,notjoined,8,Main,Insurance,10\n');
  const list = await readList(listFile);
  const { text } = render({ advs, files, list, archives: [dir] });
  assert.match(text, /^PETS FEED SCAN \(read-only\) - for Pets Gear World \(petsgearworld\.com, code ZGW\)/);
  assert.match(text, /111 Pet Shop: 2 pet of 4 products/);
  assert.match(text, /Children's toys, costumes & books with animals \(Kids' Gear World, KGW\)\s+1/);
  assert.match(text, /https:\/\/ui\.awin\.com\/merchant-profile\/2940/);
  assert.doesNotMatch(text, /merchant-profile\/444/, 'insurance is not a pet retailer');
  assert.match(text, /apply WITH petsgearworld\.com/);
  assert.doesNotMatch(text, /aming|gaminggearworld|Biker/, 'no text of another site (L01)');
});

test('first scan on the PC (1 Nov 2026): look-alike brands, cables, PET plastic, drones, traps and toy brands are not pet products', () => {
  for (const [n, c] of [['Dassy Stretch-Arbeitshose Hong Kong PESCO41 201099', ''], ['Schütze Sicherheitsstiefel FELIX 6383X KH S3S ESD', ''], ['LOVE STORIES Slip TRIXIE tiger braun', ''],
    ['FDL IP68 RATED CAT.6A WEATHERPROOF ENCLOSURE BOX', 'Default Category>PC Components>Other'], ['Zebra Wristbands/Tags. Paper/PET. 4.25x11in', ''], ['Nintendo Donkey Kong Bananza Standard', ''],
    ['Parrot PF070312 camera drone part/accessory Battery', 'Computers'], ['Proctor Brothers Cage Rabbit Trap', ''], ['NitroLift Volvo Dog Guard Gas Strut 235N', ''], ['Palmolive Aquarium Hand Soap 300ml', 'Household'],
    ['Rino & Pelle Feline Faux Fur Jacket With Knitted Sleeves', 'Womenswear'], ['Vizrt Connect Tetra 4-Channel 12G/3G-SDI - NDI Converter', ''], ['ALFI Isolierkanne Juwel 1l Edelstahl silber', ''],
    ['Makita Smartholder Chainsaw Log Horse', ''], ['Uberstar Budgie Bottle Opener Corkscrew', 'Gifts']]) {
    assert.equal(classify(n, c).sport, false, n);
  }
  assert.equal(ov('Keel Toys Soft Cuddly Rabbit - White', 'Toys'), 'kids');
  assert.equal(ov("Fisher Price Puppy's Activity Cube Learning Toy"), 'kids');
  assert.equal(cat('Good Boy Pork and Hide Twisters 60g', 'Animals & Pet Supplies > Pet Supplies > Dog Supplies'), 'food', 'a treat, not a reptile hide');
  assert.equal(cat('Felix As Good As It Looks Cat Food 12x100g'), 'food');
  assert.equal(cat('KONG Classic Dog Toy Large'), 'toys');
  assert.equal(cat('Barbour Dog Small Quilted Carrier', 'Gifts'), 'travel');
});
