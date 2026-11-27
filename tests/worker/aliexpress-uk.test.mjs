// AliExpress UK, first wave (owner, 27 Nov 2026, lessons L239).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as ali from '../../tools/import-rules/aliexpress-uk.mjs';
import { viewFor, isShown } from '../../src/lib/visibility.js';

const place = (name, feedCategory = '') => {
  const c = ali.classify({ name, feedCategory });
  return c.reject ? `out: ${c.reject}` : `${c.site} ${c.siteCategory} > ${c.subcategory}`;
};
const site = name => import(`../../sites/${name}/site.config.js`).then(m => m.default);

test('L239: the rules of AliExpress UK: Awin 7035 in pounds, four older sites, five feeds, caps per subcategory', () => {
  const R = ali.RULES;
  assert.equal(R.key, 'aliexpress-uk');
  assert.equal(R.advertiserId, 7035);
  assert.equal(R.retailer, 'AliExpress UK');
  assert.equal(R.currency, 'GBP');
  assert.deepEqual(R.sites, ['wgw', 'mgw', 'kgw', 'hgw']);
  assert.equal(R.keepQuery, true);
  assert.equal(R.maxPerSubcategory, 300);
  assert.equal(R.maxPerSubcategoryIn["Women's Jewellery"], 60);
  assert.ok(R.shop.test('https://www.aliexpress.com/item/1005006051018604.html?isdl=y&aff_fsk=x'));
  assert.ok(!R.shop.test('https://pl.aliexpress.com/item/1005006051018604.html'));
  const files = ali.feedFiles('/x');
  assert.equal(files.length, 5);
  assert.ok(files.every(f => /AWIN_7035_\d+\.csv\.gz$/.test(f)));
  assert.equal(ali.productKey(k => (k === 'merchant_deep_link' ? 'https://www.aliexpress.com/item/1005007174665510.html?src=AWINUK2' : '')), '1005007174665510');
});

test('L239 / L107: card names without seller and sale words, at most about 110 characters', () => {
  assert.equal(ali.displayName('Hot Sale Women Summer Dress Free Shipping'), 'Women Summer Dress');
  const long = ali.displayName('Women Wool Blend Knit Henley Neck Pullover Thin Sweater Top 60s Worsted Lightweight Jumper Soft Knitwear Autumn Winter Casual Daily');
  assert.ok(long.length <= 110 && !/\s$/.test(long));
  assert.equal(ali.displayBrand('NONE'), 'AliExpress');
  assert.equal(ali.displayBrand('Nike'), 'AliExpress');
  assert.equal(ali.displayBrand('HiBREW'), 'HiBREW');
});

test('L239: places on Women\'s, Men\'s, Kids\' and Home Gear World', () => {
  assert.equal(place('Chic Bohemian Yellow Dress Draped Chiffon Vintage Women Dresses Party', "Women's Clothing , Dresses"), 'wgw Clothing > Dresses');
  assert.equal(place('8XL Men New Autumn Winter Warm Waterproof Parkas Jacket Coat Mens Hooded Casual Outwear Detachable Hat', "Men's Clothing , Parkas"), 'mgw Clothing > Jackets');
  assert.equal(place("Men'S Fleece Hooded Sweatshirt Versatile Sports Casual", "Women's Clothing , Hoodies & Sweatshirts"), 'mgw Clothing > Hoodies');
  assert.equal(place('Women Vintage Grid Loose Jacket Oversize Loose Stand Collar Coat', "Shoes , Women's Shoes , Pumps"), 'wgw Clothing > Jackets & Coats');
  assert.equal(place('HNSP Waterproof Stainless Steel Cuban Chain Bracelet With Push Button Clasp For Men Jewelry', 'Jewelry & Accessories , Fashion Jewelry , Chain Bracelets'), "mgw Men's Jewellery > Bracelets");
  assert.match(place('6Pcs/Set PVC Mini Sneaker Shoe Charms Keychain Pendant For Men', 'Jewelry & Accessories , Fashion Jewelry , Pendants'), /^out: jewellery making/);
  assert.equal(place('813pcs Flower Bouquet Building Blocks DIY Rose Plant Set Girls Birthday Gift', 'Toys & Hobbies , Building & Construction Toys , Blocks'), 'kgw Toys & Games > Construction Set Toys');
  assert.equal(place('Cute Orange Fox Plush Toy Soft Cuddly Fox Pillow', 'Toys & Hobbies , Stuffed Animals & Plush , Stuffed & Plush Animals'), 'kgw Toys & Games > Stuffed Animals & Cuddly Toys');
  assert.equal(place('Flower Girls Dresses For Wedding Luxurious Beaded 3D Floral Princess Gown Elegant Cape Sleeve', "Mother & Kids , Kids Accessories , Hats"), 'kgw Clothing > Clothing');
  assert.equal(place('Modern Natural Stone LED Pendant Light Nordic Retro Travertine Chandelier for Dining Room', 'Lights & Lighting , Indoor Lighting , Pendant Lights'), 'hgw Lighting > Chandelier');
});

test('L239: never adult, weapons, costumes, anime, licensed characters, well-known brands or hidden names', () => {
  for (const [name, cat] of [
    ['Sexy Women High Cut Bodysuit', "Women's Clothing , Tops & Tees , Bodysuits"],
    ['Tactical Vest MOLLE Phone Holder', "Men's Clothing , Coats & Jackets"],
    ['David Martinez Cosplay Fantasia Costume for Adult Men', 'Novelty & Special Use , Cosplay Costumes'],
    ['Marin Kitagawa Bunny Girl Tapestry Anime Wall Hanging For Fans', 'Home & Garden , Home Decor , Tapestry'],
    ['Nike Style Running Shoes for Men', "Shoes , Men's Shoes , Casual Shoes"],
    ['NEW 699PCS MOC the Venator Class StarDestroyer Building Blocks', 'Toys & Hobbies , Building & Construction Toys , Blocks'],
    ['W-Wobbly Life Throw Soft Flannel Throw Summer Blanket', 'Home & Garden , Home Textile , Blanket'],
    ['2026 The Romantic Tour TEE American Singer Fashion Tee-shirt', "Women's Clothing , Tops & Tees , T-Shirts"],
    ['Custom Blanket Personalized Gifts for Mom Dad', 'Home & Garden , Home Textile , Blanket'],
    ['Faux Women Real Fur Coat Winter', "Women's Clothing , Real Fur"]
  ]) assert.match(place(name, cat), /^out: /, name);
  // Style words with a hyphen are fine.
  assert.equal(place('Women V-Neck A-Line T-Shirt Dress', "Women's Clothing , Dresses"), 'wgw Clothing > Dresses');
});

test("L239: Kids' Gear World leaves out collector goods, safety products and products for grown-ups", () => {
  for (const [name, cat] of [
    ['POP MART Series Plush Pendant Mystery Box', 'Toys & Hobbies , Trendy Blind Box , Blind Box'],
    ['Action Figure 18cm Model Toy', 'Toys & Hobbies , Action & Toy Figures , Action Figures'],
    ['Portable Foldable Baby Playpen Play Yard Mesh Safety Gate', 'Mother & Kids , Activity & Gear , Playards'],
    ['Solid Color Baby Crib Fence Cotton Bed Protection Bumper', 'Mother & Kids , Bedding , Crib Bumpers'],
    ['2026 High-End Retro Women\'s Crossbody Bag Solid Color Shoulder Bag', 'Mother & Kids , Activity & Gear , Toys'],
    ['TRUMPETER 1/72 Tank Destroyer Plastic Assembly Puzzle Model Toy', 'Toys & Hobbies , Games and Puzzles , Puzzles'],
    ['Random 50pcs Cartoon Graffiti Sticker Suitcase Guitar', 'Toys & Hobbies , Classic Toys , Stickers'],
    ['MEUS Racing Soft Silicone Rubber Inserts for 1.9-Inch Tires RC Crawlers', 'Toys & Hobbies , Remote Control Toys , Parts']
  ]) assert.match(place(name, cat), /^out: /, name);
});

test('L239: Home Gear World leaves out appliances, desks, covers, foreign plugs and the garden', () => {
  for (const [name, cat] of [
    ['Portable Air Cooler 12L Evaporative Cooling Fan with Remote', 'Home Appliances , Household Appliances , Fans'],
    ['High Stretch Elastic Sofa Cover Slipcover Universal Couch Cover', 'Furniture , Home Furniture , Sofas'],
    ['European standard electric ceramic stove household single-head', 'Home Appliances , Kitchen Appliances , Stoves'],
    ['Solar Garden Lights Outdoor Waterproof', 'Lights & Lighting , Outdoor Lighting , Solar Lamps'],
    ['Plant Pot Hanging Basket', 'Home & Garden , Garden Supplies , Flower Pots']
  ]) assert.match(place(name, cat), /^out: /, name);
});

test('L239: AliExpress UK is shown in the UK (the sites\' default delivery), and the pairs file has the four sites', async () => {
  for (const s of ['wgw', 'mgw', 'kgw', 'hgw']) {
    const cfg = await site(s);
    assert.deepEqual(cfg.deliversTo.default, ['GB'], s);
    assert.equal(cfg.deliversTo.retailers['AliExpress UK'], undefined, `${s}: no special delivery line`);
    assert.equal(isShown(viewFor(cfg, 'GB', Date.parse('2026-11-28T09:00:00Z')), { retailer: 'AliExpress UK', last_seen_at: '2026-11-28 08:00:00' }), true, s);
  }
  const pairs = readFileSync('tools/massive/aliexpress-uk-1128.txt', 'utf8').split('\n').map(l => l.split('#')[0].trim()).filter(Boolean);
  assert.deepEqual(pairs, ['aliexpress-uk:wgw', 'aliexpress-uk:mgw', 'aliexpress-uk:kgw', 'aliexpress-uk:hgw']);
});
