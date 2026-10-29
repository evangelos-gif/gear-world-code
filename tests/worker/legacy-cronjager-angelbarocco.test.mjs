// Angel Barocco (Awin 70252) -> WGW jewellery, and Cronjager (Awin 98661) -> WGW, MGW, HGW and GGW (29 Oct 2026).
// Names, brands and feed categories are from the owner's feed samples of 29 Oct 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import * as AB from '../../tools/import-rules/angelbarocco.mjs';
import * as CJ from '../../tools/import-rules/cronjager.mjs';

test('Angel Barocco: pearl and silver jewellery go to WGW Women\'s Jewellery with WGW\'s own subcategories', () => {
  const c = name => AB.classify({ name });
  const place = name => `${c(name).siteCategory} > ${c(name).subcategory}`;
  assert.equal(place('Gold Petal Pearl Drop Earrings'), "Women's Jewellery > Earrings");
  assert.equal(place('Stars Baroque Pearl Drop Earrings'), "Women's Jewellery > Earrings");
  assert.equal(place('Siren Nugget Cluster Barocco Pearl Bracelet'), "Women's Jewellery > Bracelets");
  assert.equal(place('Gold Natural Pearl Bracelet'), "Women's Jewellery > Bracelets");
  assert.equal(place('Silver Initial Letter Ring'), "Women's Jewellery > Rings");
  assert.equal(place('Initial Cubic Zirconia Necklace & Ring Set'), "Women's Jewellery > Jewellery", 'a set of two kinds');
  assert.equal(place('Baroque Pearl Pendant Necklace'), "Women's Jewellery > Necklaces");
  assert.equal(place('Gold Moon Ear Jacket'), "Women's Jewellery > Earrings");
  assert.equal(c('Angel Barocco Gift Card').reject, 'gift card, packaging or service, not jewellery');
  assert.match(c("Men's Pearl Bracelet").reject, /men's jewellery/);
  assert.match(c('Gift Wrapping Service').reject, /not sure|gift/);
  // Dry run 29 Oct 2026: a travel case is packaging; a hair clip is an accessory, not jewellery.
  assert.match(c('Portable Zip Jewellery Travel Case – Velvet Lined').reject, /packaging/);
  assert.equal(place('Baroque Pearl Floral Hair Clip with Golden Accents'), 'Bags & Accessories > Accessories');
  for (const n of ['Gold Petal Pearl Drop Earrings', 'Silver Initial Letter Ring']) assert.equal(c(n).site, 'wgw');
});

test('Cronjager: the GBP feed is found by reading the start of each file, so pounds and euros never mix', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cj-sniff-'));
  const head = 'aw_product_id,product_name,description,currency,merchant_deep_link\n';
  const rows = cur => Array.from({ length: 40 }, (_, i) => `${i},"Ring ${i}","A ""quoted"", long
text, with commas",${cur},https://cronjager.com/products/r${i}?currency=${cur}\n`).join('');
  writeFileSync(join(dir, 'AWIN_98661_95541.csv.gz'), gzipSync(head + rows('CAD')));
  writeFileSync(join(dir, 'AWIN_98661_95545.csv.gz'), gzipSync(head + rows('GBP')));
  writeFileSync(join(dir, 'AWIN_98661_115331.csv.gz'), gzipSync(head + rows('EUR')));
  writeFileSync(join(dir, 'AWIN_70252_115384.csv.gz'), gzipSync(head + rows('GBP')));
  assert.equal(CJ.feedCurrency(join(dir, 'AWIN_98661_95541.csv.gz')), 'CAD');
  assert.deepEqual(CJ.feedFiles(dir).map(f => f.split(/[\\/]/).pop()), ['AWIN_98661_95545.csv.gz']);
  assert.deepEqual(CJ.feedFiles(join(dir, 'missing')), []);
  assert.equal(CJ.currencyOfCsv('a,currency\n1,GBP\n2,EUR\n3,GBP\n'), '', 'mixed currencies: not sure, so the file is not used');
  assert.equal(CJ.feedCurrency(join(dir, 'nope.csv.gz')), '');
});

test('Cronjager: each kind of product goes to its site with that site\'s own subcategory names (L56)', () => {
  const c = (name, feedCategory, brand) => CJ.classify({ name, feedCategory, brand, url: '' });
  const place = (...a) => { const r = c(...a); return r.reject ? `REJECT ${r.reject}` : `${r.site} ${r.siteCategory} > ${r.subcategory}`; };
  const yes = [
    ['Holly Aqua Gem Charm Gold Hoop Earrings', "Women's Jewellery", 'Gecko Jewellery Retail', "wgw Women's Jewellery > Earrings"],
    ['Sapphire Birthstone Necklace', "Women's Jewellery", 'Made Here with Love', "wgw Women's Jewellery > Necklaces"],
    ['Peach Moonstone Bracelet and Earring Set', "Women's Jewellery", 'Made Here with Love', "wgw Women's Jewellery > Jewellery"],
    ['Scarlet Crystal Ring', "Women's Jewellery", 'Made Here with Love', "wgw Women's Jewellery > Rings"],
    ['Gold Moon Ear Jacket', "Women's Jewellery", 'Gecko Jewellery Retail', "wgw Women's Jewellery > Earrings"],
    ['Sea Shell Tiles Rectangular Cufflinks', "Men's Jewellery", 'Silver Steed', "mgw Men's Jewellery > Cufflinks"],
    ['Duke Watch - Small Model with Diamonds', "Men's Watches", 'Marchand Watch Company', "mgw Watches > Men's Watches"],
    ['Blue Dog Tooth Slim Fit Shirt', "Women's Tops", 'Wecord London', 'wgw Clothing > Tops & Blouses'],
    ['Claudine Linen Blouse  - Marigold', 'Maternity', 'Má + Lin_online', 'wgw Clothing > Tops & Blouses'],
    ['Maeve Linen Wool Blazer  - Cinnamon', "Women's Outerwear", 'Má + Lin_online', 'wgw Clothing > Jackets & Coats'],
    ["Hot pink Silk satin 'Mirasol' Ultra Skinny silk scarf with sunflowers", "Women's Accessories", 'Alice Acreman Silks', 'wgw Bags & Accessories > Scarves'],
    ['Hema Blush Swirl Hair Clip Set', 'Haircare Appliances', 'Hugs & Co.', 'wgw Bags & Accessories > Accessories'],
    ['Tokyomilk Dark - 65 Poison Ivy - Eau de Parfum 45ml', 'Cosmetics', 'Twist Distribution', 'wgw Beauty & Fragrances > Fragrance'],
    ['Wolf Moon Mens T-Shirt', 'General Clothing', 'Spiral Direct', 'mgw Clothing > T-Shirts'],
    ['Travertine Pendant Light Beige Brown Kitchen Island Ceiling Light', 'Living Room', 'RESBEAM Studio', 'hgw Lighting > Pendant Light'],
    ['DRACONIS - Single Duvet Cover + UK And EU Pillow case', 'Beds', 'Spiral Direct', 'hgw Bedding & Bath > Duvet'],
    ['Fairy Dust - Wax Melt Clamshell', 'Cakes, Snacks & Sweets', 'Light My House', 'hgw Home Decor > Home Fragrance'],
    ['Interlude Lavender Soy Candle', 'Art', 'Interlude Candles', 'hgw Home Decor > Home Fragrance'],
    ['Rad Spa | Room & Pillow Spray', 'House Accessories', 'Rad Wax', 'hgw Home Decor > Home Fragrance'],
    ['Skull Candle Holder', 'Decorations', '8th Sin', 'hgw Home Decor > Ornament'],
    ['Alchemy Gothic The Seal of Lilith Hanging Decoration', 'Decorations', '8th Sin', 'hgw Home Decor > Ornament'],
    ['Rainbow Crystal Charm Suncatcher', 'Art', 'SunCatcher-UK', 'hgw Home Decor > Ornament'],
    ['Silver Moon Ring Dish', "Women's Jewellery", 'Gecko Jewellery Retail', 'hgw Home Decor > Ornament'],
    ['Large Tree Panel Mirror Set', 'Furniture Accessories', 'SunCatcher-UK', 'hgw Home Decor > Mirror'],
    ['Original Oil Painting - Harbour at Dusk', 'Art', 'Terry Kneeshaw Art', 'hgw Home Decor > Wall Art'],
    ['Floral Print Mug', 'Crockery', 'Printworks', 'hgw Kitchen & Dining > Drinkware'],
    ['GEM MUG', 'Crockery', 'Printworks', 'hgw Kitchen & Dining > Drinkware'],
    ['Time Zone Cup London & Berlin/Rome', 'Drinkware', 'Printworks', 'hgw Kitchen & Dining > Drinkware'],
    ['Alchemy Purrfect Brew Stemless Glass', 'Glassware', '8th Sin', 'hgw Kitchen & Dining > Glassware'],
    ['Silver Steed Set of FOUR Silver Coated Shot Glasses', 'Cookware & Utensils', 'Silver Steed', 'hgw Kitchen & Dining > Glassware'],
    ['Fred Bennett Hip Flask with Leather Sleeve', 'Haircare Products', 'Silver Steed', 'hgw Kitchen & Dining > Bar Accessories'],
    ['Ceramic Cat Shaped Tea Spoon Set – 4 Colors, Hang-on Cup Design', 'Kitchen Units', '', 'hgw Kitchen & Dining > Cutlery'],
    ['Chinese Elm Bonsai Tree', 'Agricultural Products', 'Yorkshire Bonsai', 'ggw Plants, Growing & Garden Care > Plants'],
    ['Bonsai Training Wire 2mm', '', 'Yorkshire Bonsai', 'ggw Plants, Growing & Garden Care > Ties & Wire'],
    ['Glazed Bonsai Pot 20cm', '', 'Yorkshire Bonsai', 'ggw Plants, Growing & Garden Care > Growing'],
    // Fixed after the first dry run (29 Oct 2026):
    ['Blue Sapphire & Blue Topaz Half Eternity Band in Sterling Silver', "Women's Jewellery", 'Vianne Jewellery', "wgw Women's Jewellery > Rings"],
    ['Pink Heart Ring Ankle Cuffs', "Women's Jewellery", '8th Sin', "wgw Women's Jewellery > Bracelets"],
    ['Alchemy Black Rose Droppers', "Women's Jewellery", '8th Sin', "wgw Women's Jewellery > Earrings"],
    ['Mortar Board Graduation Cap Personalised Silver Charm', "Women's Jewellery", 'Scarlett Jewellery', "wgw Women's Jewellery > Jewellery"],
    ['Peridot Halo Stud Earrings with Jackets in 18k Gold Vermeil', "Women's Jewellery", 'Vianne Jewellery', "wgw Women's Jewellery > Earrings"],
    ['Lilac Cape Amethyst Gemstone Bracelet', "Women's Jewellery", 'Made Here with Love', "wgw Women's Jewellery > Bracelets"],
    ['Pearl Chain Ring-to-Bracelet Hand Harness', "Women's Jewellery", 'Savaé Design', "wgw Women's Jewellery > Bracelets"],
    ['Fred Bennett Tungsten Ring with Brown Wood Inlay', "Women's Jewellery", 'Gecko Jewellery Retail', "mgw Men's Jewellery > Jewellery"],
    ['Fred Bennett Navy Blue Leather Wallet', 'Bags', 'Gecko Jewellery Retail', 'mgw Bags & Accessories > Wallets & Purses'],
    ['Silver Steed Show Jumper Brooch / Stock Tie Pin', "Men's Jewellery", 'Silver Steed', "mgw Men's Jewellery > Jewellery"],
    ['White & Black Floral Print Short Sleeves Shirt', "Women's Tops", 'Pamoni', 'mgw Clothing > Shirts'],
    ['Navy Blue Silk Tie, \'Enticement\' Pink Serpent design and tropical flowers', "Women's Accessories", 'Alice Acreman Silks', 'mgw Bags & Accessories > Ties'],
    ['Dark in Love Larissa Lace Robe', "Men's Outerwear", "Kate's Clothing", 'wgw Clothing > Nightwear'],
    ['Vixxsin Halston Pants - Mens Trousers', "Men's Outerwear", "Kate's Clothing", 'mgw Clothing > Trousers'],
    ['TOP DOG - T-Shirt Black', 'General Clothing', 'Spiral Direct', 'mgw Clothing > T-Shirts'],
    ['INFERNAL UNICORN - Boat Neck Bat Sleeve Top Black', 'General Clothing', 'Spiral Direct', 'wgw Clothing > Tops & Blouses'],
    ['Freya Linen Cropped Blouse - Chocolate', 'General Clothing', 'Má + Lin_online', 'wgw Clothing > Tops & Blouses'],
    ['Hot Air Balloon Sock Box - 3 Pairs of Bamboo Socks (His)', 'General Clothing', 'Swole Panda', 'mgw Clothing > Socks'],
    ['Radioactive Unicorn Hallow-Queen Nail Polish', 'Cosmetics', "Kate's Clothing", 'wgw Beauty & Fragrances > Nails'],
    ['Manic Panic Divine Wine Semi-Permanent Hair Dye - Deep Burgundy Wine Red Vegan', 'Haircare Appliances', "Kate's Clothing", 'wgw Beauty & Fragrances > Hair care'],
    ['Rad Spa | Hand Soap', 'Cleaning', 'Rad Wax', 'wgw Beauty & Fragrances > Bath & body'],
    ['Dark in Love Belladonna Embroidered Folding Parasol', 'Accessories', "Kate's Clothing", 'wgw Bags & Accessories > Accessories'],
    ['BURNT ROSE - Fleece Blanket with Double Sided Print', 'Home Textiles', 'Spiral Direct', 'hgw Bedding & Bath > Bed Linen'],
    ['Bauhaus Wall Art - Geometric Wall Sculpture - Home Decor - Colourful Art', 'Art', 'We Are Lunarium', 'hgw Home Decor > Wall Art'],
    ['Countryside Tapestry', 'Art', 'Printworks', 'hgw Home Decor > Wall Art'],
    ['Lady Wearing Glasses, a portrait', 'Art', 'Rhia Janta-Cooper Fine Art', 'hgw Home Decor > Wall Art'],
    ['Eliza with towel-white Swimmer - Penzance - Giclée Screen Print', 'Art', "The Artist's House Gallery", 'hgw Home Decor > Wall Art'],
    ['Manchester United FC Shirts A3', 'Art', 'Terry Kneeshaw Art', 'hgw Home Decor > Wall Art'],
    ['Alchemy Gothic Poe’s Raven Mug & Spoon Set', 'Crockery', "Kate's Clothing", 'hgw Kitchen & Dining > Drinkware'],
    ['Gothic Gifts Deadly Nightshade Decorative Glass Potion Bottle', 'Art', "Kate's Clothing", 'hgw Home Decor > Ornament'],
    ['2 Goose Seasoning Bottle – Handcrafted Ceramic Spice Bottle', 'Crockery', '4AM STUDIO', 'hgw Kitchen & Dining > Tableware'],
    ['BLACK MAGIC 180G CITRUS & VANILLA', 'Art', 'Parks Candles', 'hgw Home Decor > Home Fragrance'],
    ['Tamarind and Resin Coffee Table - Sky Blue', 'Living Room', 'Yorkshire Bonsai', 'hgw Furniture > Coffee Table'],
    ['Gothic Gifts Poisonous Plants Plant Pot', 'Art', "Kate's Clothing", 'ggw Plants, Growing & Garden Care > Growing'],
    ['RAD-ARONDACK CHAIR BLACK FERN', 'Beds', 'Twist Distribution', 'ggw Garden Furniture & Outdoor Living > Chairs & benches'],
    // Fixed after the second dry run (29 Oct 2026, 22:58):
    ['Beginnings Trace Chain Necklace', 'Cycling', 'Gecko Jewellery Retail', "wgw Women's Jewellery > Necklaces"],
    ['Women’s One-Piece Training Swimsuit – Tie Back', 'Swimming Accessories', 'Macke Swimwear', 'wgw Clothing > Clothing'],
    ['CELTIC DRAGON - 2in1 Boot-Cut Leggings with Micro Slant Skirt', 'General Clothing', 'Spiral Direct', 'wgw Clothing > Trousers'],
    ['Dark in Love Gwen Pleated Garter Shorts', 'General Clothing', "Kate's Clothing", 'wgw Clothing > Shorts'],
    ['Radioactive Unicorn Pumpkin Spice Liquid Eye Shadow', 'Cosmetics', "Kate's Clothing", 'wgw Beauty & Fragrances > Make-up'],
    ['Tyre Sole Laced Driving Loafers, slate grey suede', "Children's Footwear", 'Hugs & Co.', 'mgw Shoes > Shoes'],
    ["Women's Penny Driving Loafers, brown suede", "Children's Footwear", 'Hugs & Co.', 'wgw Shoes > Shoes'],
    ["Hot pink 'Fuchsia' silk folding hand fan with butterfly and mushroom painted artwork", 'General Clothing', 'Alice Acreman Silks', 'wgw Bags & Accessories > Accessories'],
    ['A Ceramic Duck Egg Cup – Handmade Breakfast Egg Holder', 'Crockery', '4AM STUDIO', 'hgw Kitchen & Dining > Tableware'],
    ['Gothic Gifts Coffin Shelving Display', 'Art', "Kate's Clothing", 'hgw Storage & Organisation > Shelving Unit'],
    ['Vissla Center Line Eco Ss Shirt', 'General Clothing', 'www.remixd.store', 'mgw Clothing > Shirts'],
    ['AFENDS Blair Mini Dress', 'General Clothing', 'www.remixd.store', 'wgw Clothing > Dresses'],
    ['Marble Ball Print Pure Cotton Shirt', 'General Clothing', 'Pamoni', 'mgw Clothing > Shirts'],
    ['GRIM RIPPER - Back Pack - With Laptop Pocket', 'Bags', 'Spiral Direct', 'wgw Bags & Accessories > Bags']
  ];
  for (const [n, cat, brand, want] of yes) assert.equal(place(n, cat, brand), want, n);
  const no = [
    ['Irish Army - Glass Jar Soy Wax Candle', 'Art', 'Irish Army', /print-on-demand/],
    ['ENGLAND - Unisex Hoodie', 'General Clothing', 'English.Army', /print-on-demand/],
    ['Christian Nation - Premium Pique Polo Shirt', 'General Clothing', '', /print-on-demand/],
    ["Air Jordan 4 Retro Wmns 'Frozen Moments'", "Children's Footwear", 'www.remixd.store', /resold trainers/],
    ["Air Jordan 4 Retro 'Fear' 2024", "Children's Footwear", 'My Store', /resold trainers/],
    ['Cool Wax', 'General Clothing', 'Rad Wax', /Sporty Gear World/],
    ['Sierra Designs Flex Trail 40L-60L Rucksack - Wild Dove/Peat', 'Bags', 'Twist Distribution', /Sporty Gear World/],
    ['Will you be my Maid of Honor box', "Women's Jewellery", 'Made Here with Love', /gift boxes/],
    ['Laura Ashley Fashion Drawstring Gift Pouch', 'Bags', 'Gecko Jewellery Retail', /gift boxes/],
    ['CTHULHU - Kids T-Shirt Black', 'General Clothing', 'Spiral Direct', /children/],
    ['AIXO Pastel De Mint Padel Racket Full Carbon', 'Badminton', 'Aixo', /Sporty Gear World/],
    ['Sierra Designs High Route 3000 1 Person Tent Min Weight 930gms', 'Outdoor Adventure', '', /Sporty Gear World/],
    ['40mm Premium Judo Mats', 'Cleaning', 'Sprung Gym Flooring', /Sporty Gear World/],
    ['Changing Robe Circle One', "Women's Sportswear", 'Circle One Surf', /Sporty Gear World/],
    ['Daytona Viper Shield Inner- Smoke', 'Vehicle Security', 'Daytona Helmets UK', /Car Gear World/],
    ['Old Fashioned Car Diffuser', 'Car Parts', 'Light My House', /Car Gear World/],
    ['SPARE- RETRO SHIELD COVER HARDWARE', 'Appliance Spares', '', /spare part/],
    ['Tower Juicer (pre-sell)', 'Juicers', '', /pre-order/],
    ['Silver Steed Gift Boxes', 'Adult Gifts', 'Silver Steed', /not for these sites/],
    ['Kids Unicorn Necklace', "Women's Jewellery", 'Gecko Jewellery Retail', /children/],
    ['Deflow SUPRA QUATTRO - Quad fins', 'Swimming Accessories', 'www.remixd.store', /Sporty Gear World/],
    ['Team Phun Sunday phunday hooded sweat', 'General Clothing', 'www.remixd.store', /no men\/women in the name \(www\.remixd\.store\)/]
  ];
  for (const [n, cat, brand, want] of no) assert.match(place(n, cat, brand), want, n);
  // A garment's jewellery words are a print or a detail; a jewellery name with a garment word stays jewellery.
  assert.doesNotMatch(place('Ring Spun Cotton Tee', 'General Clothing', 'Kate\'s Clothing'), /Jewellery/);
  assert.match(place('Wolf Moon T-Shirt', 'General Clothing', 'Spiral Direct'), /^mgw Clothing > T-Shirts/, 'Spiral\'s unisex cut');
  assert.match(place('Charm Print Midi Dress', 'General Clothing', 'Má + Lin_online'), /^wgw Clothing > Dresses/);
  // Placed only because of the feed category: marked for the report's CHECK list.
  assert.equal(c('Lunar Phase Silver', "Women's Jewellery", 'We Are Lunarium').doubt, true);
  assert.equal(CJ.displayBrand('Má + Lin_online'), 'Má + Lin');
  assert.equal(CJ.displayName('Rad Spa | Room & Pillow Spray'), 'Rad Spa Room & Pillow Spray');
});

test('Cronjager plan: only the GBP feed is read, one card per product page, left-out reasons in the report', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cj-plan-'));
  const HEAD = 'aw_product_id,brand_name,merchant_category,category_name,product_name,description,merchant_deep_link,merchant_image_url,search_price,currency,in_stock,stock_quantity,stock_status\n';
  const row = (id, brand, cat, name, handle, price, cur) =>
    `${id},"${brand}","${cat}","${cat}","${name}",,https://cronjager.com/products/${handle}?variant=${id}&om=8616&currency=${cur},https://cdn.shopify.com/s/${id}.jpg,${price},${cur},1,,in_stock\n`;
  const products = cur => [
    row(1, 'Made Here with Love', "Women's Jewellery", 'Sapphire Birthstone Necklace', 'sapphire-birthstone-necklace', cur === 'GBP' ? 37 : 70, cur),
    row(2, 'Made Here with Love', "Women's Jewellery", 'Sapphire Birthstone Necklace', 'sapphire-birthstone-necklace', cur === 'GBP' ? 35 : 66, cur),
    row(3, 'Interlude Candles', 'Art', 'Interlude Lavender Soy Candle', 'lavender-candle', cur === 'GBP' ? 24 : 45, cur),
    row(4, 'Irish Army', 'Accessories', 'Irish Army - Travel Mug With A Handle', 'travel-mug-with-a-handle', cur === 'GBP' ? 70 : 132, cur),
    row(5, 'Yorkshire Bonsai', 'Agricultural Products', 'Chinese Elm Bonsai Tree', 'chinese-elm-bonsai', cur === 'GBP' ? 30 : 56, cur),
    row(6, 'Silver Steed', "Men's Jewellery", 'Sea Shell Tiles Rectangular Cufflinks', 'sea-shell-cufflinks', cur === 'GBP' ? 40 : 75, cur)
  ].join('');
  writeFileSync(join(dir, 'AWIN_98661_95541.csv.gz'), gzipSync(HEAD + products('CAD')));
  writeFileSync(join(dir, 'AWIN_98661_95545.csv.gz'), gzipSync(HEAD + products('GBP')));
  const out = mkdtempSync(join(tmpdir(), 'cj-out-'));
  const r = await planLegacyImport({ archive: dir, retailer: 'cronjager', outDir: out, now: new Date('2026-10-29T22:30:00Z') });
  assert.deepEqual(r.files, ['AWIN_98661_95545.csv.gz'], 'the CAD feed is not read');
  assert.equal(r.rows, 6);
  const necklace = r.accepted.wgw.find(p => p.product_name === 'Sapphire Birthstone Necklace');
  assert.equal(necklace.price, 35, 'lowest option price, in pounds');
  assert.equal(necklace.currency, 'GBP');
  assert.equal(necklace.awin_product_id, '98661:sapphire-birthstone-necklace');
  assert.match(necklace.affiliate_url, /awinmid=98661&awinaffid=3057233&ued=https%3A%2F%2Fcronjager\.com%2Fproducts%2Fsapphire-birthstone-necklace$/);
  assert.equal(r.accepted.hgw[0].subcategory, 'Home Fragrance');
  assert.equal(r.accepted.ggw[0].subcategory, 'Plants');
  assert.equal(r.accepted.ggw[0].merchant_product_id, 'chinese-elm-bonsai', 'GGW keeps the product handle as its stable key');
  assert.equal(r.accepted.mgw[0].subcategory, 'Cufflinks');
  const text = readFileSync(join(out, 'report.txt'), 'utf8');
  assert.match(text, /print-on-demand slogan merch/);
  assert.match(text, /Prices are GBP/);
});
