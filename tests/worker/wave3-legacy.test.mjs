// Wave 3 on the six older sites (approvals file of chat 7, 16 Nov 2026, lessons L171): 41 new Awin and CJ shops on HGW,
// GGW, WGW, MGW, KGW and CGW. Each shop's rules place its products in subcategories the site already has (L56), the
// US shops are shown only to the US and Zepter (euros) only to the EU, and the big catalogues keep at most
// RULES.maxPerSubcategory cards per subcategory (L164).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { deliveryCountries } from '../../src/lib/delivery.js';
import { audience, menClothSub, shoeSub } from '../../tools/import-rules/lib/wave3-legacy.mjs';
import { placeFragrance } from '../../tools/import-rules/lib/fragrance-us.mjs';

const KEYS = ['inspecial-home-us', 'sleepzone-us', 'sleepandbeyond-us', 'blindsmagic-us', 'yale-uk', 'drprepare-us', 'meeden-us', 'buture-us', 'gardepro-us',
  'everywherechair-us', 'garvee-us', 'aosom-us', 'mova-us', 'zepter-eu', 'pandahall-us', 'lensmart-us', 'ublins-us', 'deluvia-us', 'vo-uk', 'theshirtcompany-uk',
  'fragranceshop-us', 'perfumania-us', 'fragranceoutlet-us', 'ecosmetics-us', 'amoremall-us', 'buycoolshirts-us', 'efootwear-us', 'menseventwear-us', 'nortiv8-us',
  'incerunmen-us', 'tsarbomba-us', 'chamaripa-us', 'coofandy-us', 'skilhunt-us', 'wuben-us', 'nitecore-us', 'tameson-us', 'walabot-us', 'chessstore-us',
  'robotime-us', 'moonkie-us', 'reima-us', 'bcbabycare-us', 'destira-us'];
const rules = {};
for (const k of KEYS) rules[k] = await import(`../../tools/import-rules/${k}.mjs`);
const config = {};
for (const s of ['hgw', 'ggw', 'wgw', 'mgw', 'kgw', 'cgw']) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
const place = (key, name, extra = {}) => {
  const r = rules[key].classify({ name, feedCategory: '', awinCategory: '', url: '', brand: '', ...extra });
  return r.reject ? `out: ${r.reject}` : `${r.site} ${r.siteCategory} > ${r.subcategory}`;
};

test('L171: each shop is shown where it delivers: US shops only to the US, Zepter to the EU, the pound shops in the UK view', () => {
  for (const k of KEYS) {
    const R = rules[k].RULES;
    assert.equal(R.key, k);
    assert.match(R.retailer, /^[A-Za-z0-9 .-]{2,40}$/, `${k}: a name legacy-import.ps1 accepts`);
    for (const s of R.sites) {
      const where = deliveryCountries(config[s], R.retailer);
      if (R.currency === 'USD') assert.deepEqual(where, ['US'], `${k} on ${s}: only the US`);
      else if (R.currency === 'GBP') assert.ok(where.includes('GB') && !config[s].deliversTo.retailers[R.retailer], `${k} on ${s}: the default (GB)`);
      else assert.deepEqual(config[s].deliversTo.retailers[R.retailer], ['EU'], `${k} on ${s}: the EU`);
    }
  }
  // Every US shop's prices are in dollars, which each of these sites converts ("≈ £…").
  for (const s of Object.keys(config)) assert.ok(config[s].foreignCurrencies.includes('USD'), s);
  // A retailer named in deliversTo of these sites by wave 3 has its rules (no line for a shop that is not imported).
  const names = new Set(KEYS.map(k => rules[k].RULES.retailer));
  for (const s of Object.keys(config)) {
    const text = readFileSync(`sites/${s}/site.config.js`, 'utf8');
    const block = text.slice(text.indexOf('lessons L171'));
    const listed = [...block.slice(0, block.indexOf('}')).matchAll(/'([^']+)': \[|(\w+): \[/g)].map(m => m[1] || m[2]);
    for (const n of listed) assert.ok(names.has(n), `${s}: ${n} has wave 3 rules`);
  }
});

test('L171: the shared words: who it is for, the last garment word, shoes', () => {
  assert.equal(audience("Asics Gel Kayano 27 Men's Running Shoe"), 'men');
  assert.equal(audience("Hoka One One Mach 2 Women's Medieval Blue"), 'women');
  assert.equal(audience('Kids Quick Dry Water Shoes'), 'kids');
  assert.equal(audience('Batman Kids T-Shirt'), 'kids');
  assert.equal(audience('Aquaman Splash Adult Tee'), '', 'Batman/Aquaman: "man" inside a word is not a man');
  assert.equal(menClothSub('Mens Yoga T-shirt'), 'T-Shirts', 'a T-shirt is not a shirt');
  assert.equal(menClothSub("Men's Beach Resort Fit Soft Knit Button Front Booty Short"), 'Shorts', 'the last garment word');
  assert.equal(menClothSub('Short Sleeve Shirt'), 'Shirts');
  assert.equal(menClothSub('Diamond Chakras Sweat Shirt'), 'Sweatshirts');
  assert.equal(shoeSub('Mizuno Wave Inspire 19 Men\'s Running Wide EE', 'mgw'), 'Trainers');
  assert.equal(shoeSub('Pointed Heels', 'mgw'), 'Shoes', 'MGW has no Heels');
});

test('L171: Home and Garden shops: the site\'s own subcategories, parts and samples out', () => {
  assert.equal(place('sleepzone-us', 'Wrap Around Ruffled Bed Skirts'), 'hgw Bedding & Bath > Bed Linen', 'a bed skirt is not a bed');
  assert.equal(place('sleepzone-us', 'Fabric Shower Curtain - Retro Striped Farmhouse Style for Bathroom'), 'hgw Bedding & Bath > Bathroom Accessories');
  assert.equal(place('blindsmagic-us', 'BlindsMagic Smart Motorized Roller Shades 100% Blackout Melody'), 'hgw Home Decor > Blinds', 'motorized shades are blinds');
  assert.match(place('blindsmagic-us', 'BlindsMagic Zigbee Smart Motor'), /^out:/);
  assert.match(place('blindsmagic-us', 'Cellular Shades Battery Stick'), /^out:/);
  assert.equal(place('yale-uk', 'Conexis L2 Smart Lock'), 'hgw Smart Home > Smart Lock');
  assert.match(place('yale-uk', 'BS4 Maximum Security Nightlatch - Emergency Escape'), /mechanical lock/);
  assert.equal(place('everywherechair-us', 'Gold Medal 18 Inch Table Height COMMERCIAL Directors Chair'), 'ggw Garden Furniture & Outdoor Living > Chairs & benches');
  assert.match(place('everywherechair-us', 'Sunbrella Directors Chair Replacement Cover (FLAT STICK)'), /^out:/);
  assert.match(place('buture-us', 'Buture Beta05 Car Jump Starter 4000A'), /jump starter/);
  // Garvee: a marketplace-size catalogue, placed on the head of the name, never its cars, tools or bathroom fittings.
  const gv = (name, cat) => place('garvee-us', name, { feedCategory: cat });
  assert.equal(gv('Rattan Nightstand, Side Table with Storage, Modern Boho End Table', 'Furniture'), 'hgw Furniture > Bedside Table');
  assert.match(gv('36" × 36" Forklift Safety Cage, 1800 lb Foldable Steel Man Basket', 'Furniture'), /^out:/);
  assert.match(gv('Two Piece Toilet Elongated ADA 17.5" Height, Side Press Flush', 'Bathrooms & Accessories'), /^out:/);
  assert.match(gv('Garvee 12000 BTU Window Air Conditioner With Wi-fi', ''), /not one our sites show/, 'no group: left out');
  assert.equal(gv('Outdoor Light Blue & White 9x12 Rug – Reversible Medallion Pattern', 'Garden'), 'ggw Garden Furniture & Outdoor Living > Cushions & rugs', 'a rug, not a light');
  assert.equal(rules['garvee-us'].RULES.maxPerSubcategory, 60);
  const ao = (name, cat) => place('aosom-us', name, { feedCategory: cat });
  assert.equal(ao('HOMCOM Coffee Table for Living Room, 24" Round Center Table', 'Home Goods > Living Room > Coffee Tables'), 'hgw Furniture > Coffee Table');
  assert.match(ao('Qaba Foot to Floor Toddler Ride on Toy, Sliding Car', 'Toys & Hobbies > Ride On Toys > Push Cars'), /not one our sites show/);
  assert.match(ao('HOMCOM EVA Padded Shower Chair with Arms and Back', 'Home Goods > Bathroom > Bathroom Accessories'), /mobility/);
  assert.equal(ao('Outsunny Folding Chaise Lounge Chair, Pool Sun Tanning Chair', 'Outdoor > Patio Furniture > Chaise Lounges'), 'ggw Garden Furniture & Outdoor Living > Loungers');
  assert.equal(place('mova-us', 'MOVA P50 Ultra Robot Vacuum'), 'hgw Home Appliances > Vacuum Cleaner');
  assert.equal(place('mova-us', 'MOVA 60V 16" InstaLoad™ Brushless String Trimmer - Kit'), 'ggw Power Garden Tools > Grass Trimmers');
  assert.match(place('mova-us', 'MOVA Mop Pad (4-Packs)'), /^out:/);
  assert.ok(rules['mova-us'].RULES.shop.test('https://us.mova.tech/products/x') && !rules['mova-us'].RULES.shop.test('https://ca.mova.tech/products/x'), 'not the Canadian shop');
  // Zepter: only the English European shop, only cookware and tableware.
  assert.ok(rules['zepter-eu'].RULES.shop.test('https://shop.zepter.com/x') && !rules['zepter-eu'].RULES.shop.test('https://www.zepter.ro/x'));
  assert.equal(place('zepter-eu', 'Zepter mirror polished frying pan, 2.0 l, Ø 24 cm'), 'hgw Kitchen & Dining > Frying Pan');
  assert.match(place('zepter-eu', 'COFFEE CAPS DECAFFEINATO 1 BAG X 30 CAPS'), /^out:/);
  assert.equal(rules['zepter-eu'].displayName('ZEPTER MULTI-TOOL WITH GIFT BOX'), 'Zepter Multi-Tool With Gift Box');
});

test('L171: Women\'s and Men\'s shops: fragrances by who they are for, never a copy, a tester or a character set', () => {
  const f = (name, cat = '', brand = '', url = '') => { const r = placeFragrance(name, cat, brand, url); return r.reject ? `out: ${r.reject}` : `${r.site} ${r.subcategory} | ${r.name}`; };
  assert.equal(f('Montblanc Legend Perfume - 1.7 oz.', 'Eau De Toilette', 'Montblanc', 'https://perfumania.com/products/montblanc-legend-for-men-edt'), 'mgw Fragrance | Montblanc Legend Perfume - 1.7 oz.', 'the page says for men');
  assert.equal(f('Skin Couture Perfume - 3.4  oz.', 'Eau De Parfum', 'Armaf'), 'wgw Fragrance | Armaf Skin Couture Perfume - 3.4 oz.', 'the maker in front');
  assert.equal(f('Stella Perfume - 1 oz.', 'Eau de Parfum', 'Stella McCartney'), 'wgw Fragrance | Stella Perfume - 1 oz.', 'not twice when the name starts with it');
  assert.equal(f('Tommy Bahama Set Sail Martinique Body Spray - 8.0 oz.', 'Body'), 'wgw Bath & body | Tommy Bahama Set Sail Martinique Body Spray - 8.0 oz.', '"Set Sail" is not a gift set');
  assert.equal(f('Cuba Royal by Cuba for Men - 2 Pc Gift Set - 3.3 oz.', 'Gift Set'), 'mgw Gift sets | Cuba Royal by Cuba for Men - 2 Pc Gift Set - 3.3 oz.');
  assert.match(f('Honey Perfume for Women by Marc Jacobs Type Perfume Oil 1/3 oz Roll-on', 'Oils'), /copy/);
  assert.match(f('Boss Orange Perfume for Women by Hugo Boss TESTER Eau de Toilette Spray', 'Unboxed/Testers'), /tester/);
  assert.match(f('Trolls Gift Set - Default Title', 'Gift Set'), /character/);
  const ec = (name, cat) => place('ecosmetics-us', name, { feedCategory: cat });
  assert.equal(ec('Saaf Body Face And Body Soap Bar | Turmeric 4.5Oz', 'Bath & Body > Bath & Shower > Soap'), 'wgw Beauty & Fragrances > Bath & body');
  assert.equal(ec('Kenneth Cole Black All Over Body Spray 6Oz', "Fragrance > Men's > Body Spray"), 'mgw Grooming & Fragrances > Deodorant', 'MGW has no Bath & body');
  assert.match(ec('Some Candle 8Oz', 'Fragrance > Candles & Home Fragrance > Candles'), /not one our sites show/);
  // WGW Beauty & Fragrances has about 15,000 products: the caps keep it under the 20,000 of the Manager's rule.
  for (const k of ['fragranceshop-us', 'perfumania-us', 'fragranceoutlet-us', 'ecosmetics-us', 'amoremall-us']) assert.ok(rules[k].RULES.maxPerSubcategory <= 250, k);
  assert.equal(place('amoremall-us', 'OSULLOC Rooibos Caramel Berry (20 count)').startsWith('out:'), true, 'tea is not beauty');
  assert.equal(rules['amoremall-us'].productKey(c => (c === 'product_name' ? 'TONEWORK VEGAN 200+ FOUNDATION TO-GO(CUSHION) AIRY MATTE 38N1 15G' : '')),
    rules['amoremall-us'].productKey(c => (c === 'product_name' ? 'TONEWORK VEGAN 200+ FOUNDATION TO-GO(CUSHION) SHEER GLOW 23C1 15G' : '')), 'one card per foundation, not one per shade');
  assert.equal(place('lensmart-us', 'Zuri'), 'wgw Bags & Accessories > Eyeglasses');
  assert.equal(rules['lensmart-us'].classify({ name: 'Zuri' }).name, 'Zuri Glasses');
  assert.equal(place('vo-uk', 'Tiny Embroidered Dinosaur Kids Sweatshirt (Unisex)'), 'kgw Clothing > Clothing');
  assert.equal(place('vo-uk', 'Bee Kind Hoodie (Unisex)'), 'wgw Clothing > Hoodies');
  assert.equal(place('theshirtcompany-uk', 'CHRISTIANE SHIRT DRESS - Black, Triple Crepe'), 'wgw Clothing > Dresses');
  assert.equal(rules['theshirtcompany-uk'].displayName('CATALINA SHIRT - THE TAILORED - White, Cotton Poplin'), 'Catalina Shirt - The Tailored - White, Cotton Poplin');
  // Buycoolshirts: only the plain sport groups, never film, band or character merchandise.
  assert.match(place('buycoolshirts-us', 'Batman Kids T-Shirt - Gotham Crusader Youth Navy Blue Tee', { feedCategory: 'Batman T-shirts' }), /merchandise/);
  assert.equal(place('buycoolshirts-us', 'Mens Yoga Hoodie Floral Ajna Hoody', { feedCategory: 'Yoga Shirts for Men' }), 'mgw Clothing > Hoodies');
  assert.equal(place('efootwear-us', "Asics Gel Kayano 27 Men's Running Shoe Glacier Grey"), 'mgw Shoes > Trainers');
  assert.equal(place('efootwear-us', "Hey Dude Wally Woven Women's Beige"), 'wgw Shoes > Shoes');
  assert.equal(place('menseventwear-us', 'Menseventwear Formal 3 Pieces Mens Suit Slim Fit Flat Peak Lapel Tuxedos (Blazer+Pants) - 3XL / Red'), 'mgw Clothing > Suits');
  assert.equal(rules['incerunmen-us'].displayName('Mens Solid Color Sheer Mesh Hooded Tank SKUL10706 - Apricot / S'), "Men's Solid Color Sheer Mesh Hooded Tank");
  assert.match(place('incerunmen-us', "Men's Mesh Sheer Briefs"), /^out:/);
  assert.equal(rules['coofandy-us'].displayName('Slim Fit Turtleneck Knitted Twisted Pullover Sweaters (US Only), Khaki / M'), 'Slim Fit Turtleneck Knitted Twisted Pullover Sweaters');
  assert.match(place('tsarbomba-us', 'TSAR BOMBA Light matter-TB8223 Transparent Automatik Skelett Herrenuhr'), /another language/);
  assert.equal(rules['tsarbomba-us'].classify({ name: 'TSAR BOMBA (Ship from US)Carbon Fiber Automatic Tonneau Watch for Men' }).name, 'TSAR BOMBA Carbon Fiber Automatic Tonneau Watch for Men');
  assert.equal(place('nortiv8-us', 'Kids Snow Boots'), 'kgw Shoes > Winter Boots');
  assert.equal(rules['nortiv8-us'].displayName('ActiveFloat  Men s Comfortable Lightweight Running Shoes'), "ActiveFloat Men's Comfortable Lightweight Running Shoes");
});

test('L171: Construction and Kids shops: lights to Site Equipment, nothing more in Hand Tools; chess, toys and baby goods', () => {
  assert.equal(place('wuben-us', 'WUBEN L50 1200 Lumens LED Flashlight'), 'cgw Site Equipment > Lighting');
  assert.match(place('wuben-us', 'WUBEN AC1 White Silicone flashlight diffuser'), /^out:/);
  assert.match(place('skilhunt-us', 'BL-135 3500mAh 18650 Protected Battery'), /^out:/);
  const nc = rules['nitecore-us'];
  assert.equal(nc.field('merchant_deep_link', () => 'http://www.NitecoreStore.com/ProductDetails.asp?ProductCode=FL-NITE-EC23'), 'https://www.NitecoreStore.com/ProductDetails.asp?ProductCode=FL-NITE-EC23');
  assert.equal(nc.productKey(() => 'https://www.NitecoreStore.com/ProductDetails.asp?ProductCode=fl-nite-ec23'), 'code-FL-NITE-EC23', 'one card per product code, not one for the whole shop page');
  assert.equal(nc.RULES.keepQuery, true, 'the link keeps the product code');
  const tm = (name, cat) => place('tameson-us', name, { feedCategory: cat });
  assert.equal(tm('Festo Air Preparation Unit G3/4\'\' 2.5-12bar', 'Pneumatics and Compressed Air'), 'cgw Site Equipment > Industrial Equipment');
  assert.equal(tm('NBR O-ring 79 x 7mm', 'Sealant, Adhesive and Tape'), 'cgw Site Equipment > DIY');
  assert.match(tm('Relay 24VDC', 'Electrical'), /left out/);
  for (const k of ['skilhunt-us', 'wuben-us', 'nitecore-us', 'tameson-us', 'walabot-us']) {
    assert.deepEqual(rules[k].RULES.sites, ['cgw']);
    for (const name of ['WUBEN L50 Flashlight', 'Walabot DIY Plus X', 'Festo valve']) {
      const r = rules[k].classify({ name, feedCategory: 'Valves' });
      assert.notEqual(r.siteCategory, 'Hand Tools', `${k}: CGW Hand Tools is over 20,000 products`);
    }
  }
  assert.equal(rules['chessstore-us'].field('merchant_deep_link', () => 'http://thechessstore.com/x/'), 'https://thechessstore.com/x/');
  assert.equal(place('chessstore-us', 'German Knight Easy-Carry Plastic Chess Set Wood Grain Pieces with Floppy Board - Black'), 'kgw Toys & Games > Board Games');
  assert.match(place('chessstore-us', 'The Chess Store 2 Compartment Loose-Piece Chess Box - Medium'), /^out:/);
  assert.equal(place('robotime-us', 'ROBUD Wooden Play Kitchen Playset for Kids WG194'), 'kgw Toys & Games > Toy Kitchens & Play Food');
  assert.match(place('robotime-us', 'ROBOTIME Basswood & Walnut Plywood Sheets for Laser Cutting'), /^out:/);
  assert.equal(place('moonkie-us', 'Astrid Classic Silicone Pacifier (Shifting sand/Blush)'), 'kgw Baby & Toddler > Baby Soothers');
  assert.match(place('moonkie-us', 'Personalized Service'), /^out:/);
  assert.equal(place('reima-us', 'Reima Kids Snow Boots - Nefar'), 'kgw Shoes > Winter Boots');
  assert.equal(place('bcbabycare-us', 'CLOUD SKIN™ Diaper Trial Pack'), 'kgw Baby & Toddler > Nappies');
  assert.match(place('destira-us', 'Unicorn Magic Doll Size Leotard'), /doll/);
  assert.equal(place('destira-us', 'Spellbound Leotard', { feedCategory: 'Leotard' }), 'kgw Clothing > Dancewear');
});

test('L171: every wave 3 rules file is named in this test, and none is left without a site', () => {
  const files = readdirSync('tools/import-rules').filter(f => f.endsWith('.mjs'));
  for (const f of files) {
    const text = readFileSync(`tools/import-rules/${f}`, 'utf8');
    if (/lessons L171/.test(text.slice(0, 600))) assert.ok(KEYS.includes(f.replace(/\.mjs$/, '')), `${f}: listed in KEYS`);
  }
  for (const k of KEYS) assert.ok(rules[k].RULES.sites.length >= 1 && rules[k].RULES.sites.every(s => config[s]), k);
});

test('L171 after the ALL IMPORTS dry run (17 Nov 2026): compost goes to subcategories Garden Gear World has', () => {
  const gv = (name, cat) => place('garvee-us', name, { feedCategory: cat });
  assert.equal(gv('Compost Spreader, 24IN Peat Moss Spreader with Upgraded T-Handles', 'Garden'), 'ggw Plants, Growing & Garden Care > Lawn Spreaders');
  assert.equal(gv('Large Metal Wire Compost Bin 15 Cu Ft XL Capacity Powder-Coated Frame', 'Garden'), 'ggw Plants, Growing & Garden Care > Growing');
  const ao = name => place('aosom-us', name, { feedCategory: 'Outdoor > Lawn & Garden > Composters' });
  assert.equal(ao('Outsunny Tumbling Compost Bin Outdoor 360° Dual Chamber Rotating Composter 43 Gallon, Orange'), 'ggw Plants, Growing & Garden Care > Growing');
});
