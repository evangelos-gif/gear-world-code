// Joybuy UK -> Garden Gear World and Home Gear World: the mistakes of the plan of 25 Oct 2026 (lessons L55).
// Names in the form Joybuy (Amazon-style titles) gives them; the UniBond and TILSWALL names are the shop's own wording.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import { classify } from '../../tools/import-rules/joybuy.mjs';
import { gardenPlace } from '../../tools/import-rules/lib/garden.mjs';

const c = (name, feedCategory = 'Home & Garden') => classify({ name, feedCategory });

// Every name here was placed on GGW or HGW by the rules before the fix (checked on 25 Oct 2026).
const MISTAKES = [
  // Kitchen scissors in BBQ & Outdoor Cooking
  ['Kitchen Scissors Heavy Duty, Stainless Steel Meat Scissors for Chicken, Poultry, Fish and BBQ', 'Home & Garden > Kitchen & Dining > Kitchen Tools & Utensils'],
  ['Yaki Party Japanese BBQ Kitchen Scissors 24cm', 'Home & Garden > Kitchen & Dining'],
  // Towel set and diffusers in Plants, Growing & Garden Care
  ['Luxury 6 Piece Towel Set, 100% Egyptian Cotton, Wildflower Print', 'Home & Garden > Linens & Bedding > Towels'],
  ['Reed Diffuser Wildflower Meadow 100ml with 6 Rattan Sticks', 'Home & Garden > Decor > Home Fragrances'],
  ['Ultrasonic Aroma Diffuser, Ceramic Plant Pot Design, 7 LED Colours', 'Home & Garden > Decor'],
  ['Wildflower Meadow Scented Candle Jar 200g', 'Home & Garden > Decor > Candles & Home Fragrances'],
  // UniBond moisture absorber in Seeds & bulbs
  ['UniBond AERO 360 Moisture Absorber Wildflower Meadow Refill Tabs, 2 x 450 g', 'Home & Garden > Household Supplies'],
  // TILSWALL paint sprayers and shelves in Sheds
  ['TILSWALL Electric HVLP Paint Sprayer Shark800, 1300ml Spray Gun with 4 Nozzles & 3 Patterns for Fence, Shed, Furniture, Walls', 'Hardware > Tools > Paint Tools'],
  ['TILSWALL Brushless Motor Fence Cordless Electric Paint Sprayer Gun, Side Fill Design, Compatible with Dewalt 18V Battery (Not Included), Ideal for Walls and Ceilings, Fences and Shed Furnitures', 'Hardware > Tools'],
  ['TILSWALL Upgraded Ultra-Light Electric Paint Spray Gun with 600ml Detachable Cup, 2 Nozzles, 3 Patterns for Fence, Shed', 'Hardware > Tools'],
  ['5 Tier Garage Shelves Heavy Duty Boltless Metal Shelving Racking for Shed, Garage, 180x90x40cm', 'Furniture > Shelving'],
  ['Metal Storage Shelves 4 Tier, Garage Shed Shelving 160x80x40cm', 'Furniture > Shelving'],
  // The same kind: made FOR a shed or a fence, not one
  ['Wood Stain Spray for Fence, Shed and Decking 5L', 'Hardware > Paint'],
  // DJI action camera among HGW's security cameras
  ['DJI Osmo Action 5 Pro Standard Combo, 4K Action Camera, Wi-Fi Camera, Waterproof Outdoor Camera', 'Electronics > Cameras & Optics'],
  ['DJI Osmo Action 4 Adventure Combo - 4K/120fps Waterproof Action Camera, Wireless Camera for Vlogging', 'Electronics > Cameras & Optics > Cameras'],
  ['AKASO Brave 7 4K Action Camera, Wi-Fi Camera, Waterproof Outdoor Camera', 'Electronics > Cameras & Optics'],
  ['Mini Spy Wireless Camera 1080P HD, Small Wi-Fi Camera with Long Battery Life', 'Electronics > Cameras & Optics'],
  // Heater (and the same kind of appliance) in Smart Home
  ['Dreo Smart Space Heater, 2000W Electric Heater with WiFi, Works with Alexa & Google Home, Oscillating', 'Home & Garden > Household Appliances > Climate Control Appliances'],
  ['Smart Oil Filled Radiator 2000W, Wi-Fi Electric Heater, Works with Alexa, Smart Home Control', 'Home & Garden > Household Appliances'],
  ['Dreo Smart Tower Fan 42", Works with Alexa, Wi-Fi Bladeless Fan', 'Home & Garden > Household Appliances > Climate Control Appliances']
];

test('Joybuy plan of 25 Oct 2026: kitchen scissors, towels, diffusers, damp absorbers, paint sprayers, shelves, action cameras and heaters stay off GGW and HGW', () => {
  for (const [name, cat] of MISTAKES) {
    const r = c(name, cat);
    assert.ok(r.reject, `${name} must be left out, got ${JSON.stringify(r)}`);
  }
  // The report says why (one reason per kind, so the report groups them).
  assert.match(c(...MISTAKES[0]).reject, /scissors/);
  assert.match(c(...MISTAKES[6]).reject, /damp absorber/);
  assert.match(c(...MISTAKES[7]).reject, /paint sprayer/);
  assert.match(c(...MISTAKES[10]).reject, /shelves or racking/);
  assert.match(c(...MISTAKES[5]).reject, /wildflower/);
  assert.match(c(...MISTAKES[12]).reject, /made FOR a garden product/);
  assert.match(c(...MISTAKES[16]).reject, /not one that watches a home/);
  assert.match(c(...MISTAKES[17]).reject, /appliance with an app/);
});

test('Joybuy GGW/HGW: products that were right before the fix stay where they were', () => {
  const ggw = (name, siteCategory, subcategory) => assert.deepEqual(c(name), { site: 'ggw', siteCategory, subcategory }, name);
  const hgw = (name, subcategory) => assert.deepEqual(c(name), { site: 'hgw', siteCategory: 'Smart Home', subcategory }, name);
  // BBQ accessories named after the BBQ they are for
  ggw('Grill Cover for Weber Spirit BBQ, Waterproof 600D', 'BBQ & Outdoor Cooking', 'BBQ accessories');
  ggw('Waterproof Cover for BBQ, Heavy Duty 600D Oxford Fabric', 'BBQ & Outdoor Cooking', 'BBQ accessories');
  ggw('Vonhaus Barrel Charcoal Barbecue', 'BBQ & Outdoor Cooking', 'BBQs');
  ggw('Charcoal BBQ Grill, 57cm Kettle Barbecue with Thermometer & Adjustable Air Vent', 'BBQ & Outdoor Cooking', 'BBQs');
  // Garden buildings
  ggw('AOXUN 1800L high plastic shed with base, large garden storage box', 'Garden Buildings, Fencing & Storage', 'Sheds');
  ggw('Mini Greenhouse 4 Tier with Shelves, Portable Plant Greenhouse with PVC Cover', 'Garden Buildings, Fencing & Storage', 'Greenhouses');
  ggw('Large Vertical Firewood Rack, Log Storage Holder for Fireplace, Patio, Indoor, Outdoor', 'Garden Buildings, Fencing & Storage', 'Log stores');
  // A light "for Shed" is an outdoor light, not a shed (the one product this fix moves on purpose: before, it went to Sheds)
  ggw('Solar Lights for Shed, Motion Sensor Outdoor Wall Light', 'Outdoor Lighting & Garden Electrical', 'Solar lights');
  // Wildflower SEEDS are seeds
  ggw('Wildflower Seeds Mix 100g, Native British Meadow', 'Plants, Growing & Garden Care', 'Seeds & bulbs');
  ggw('Peat-Free Multi-Purpose Compost 50L for Pots and Borders', 'Plants, Growing & Garden Care', 'Compost & feed');
  // Smart home devices and home cameras
  hgw('TP-Link Tapo C200 Pan/Tilt Wi-Fi Camera, 1080p Home Security', 'Security cameras & doorbells');
  hgw('JOOAN 2K Outdoor Security Camera LAN 2.4G WiFi 360 PTZ Cam', 'Security cameras & doorbells');
  hgw('eufy E340 2K Dual Cameras Smart Video Doorbell with Chime', 'Security cameras & doorbells');
  hgw('Blink Mini 2 Wireless Camera', 'Security cameras & doorbells');
  hgw('tado Smart Radiator Thermostat X - Add-on Unit', 'Smart home');
  hgw('WIZ Smart Plug White: Wi-Fi Connected Smart Home Device', 'Smart plugs & switches');
  // A kids' camera is still kids tech, not a reject
  assert.equal(c('VTech KidiZoom Duo DX Kids Camera, Wi-Fi Camera', 'Toys & Games').site, 'kgw');
});

test('the shared garden rules are unchanged for the other shops (Gardenista, Mint Outdoor, My Tool Shed)', () => {
  // The Joybuy checks live in joybuy.mjs; lib/garden.mjs still answers as before for the same names.
  assert.equal(gardenPlace('Metal Storage Shelves 4 Tier, Garage Shed Shelving 160x80x40cm').subcategory, 'Sheds');
  assert.equal(gardenPlace('Wildflower Seeds Mix 100g, Native British Meadow').subcategory, 'Seeds & bulbs');
});

const HEAD = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,merchant_name,merchant_id,brand_name,currency,merchant_deep_link,ean\n';
const row = (n, name, cat, price) =>
  `https://www.awin1.com/pclick.php?p=${n}&a=3057233&m=123932,"${name.replace(/"/g, '""')}",9${n},2055${n},https://images1.joy-sourcing.com/${n}.jpg,"${cat}",${price},Joybuy UK,123932,Brand,GBP,https://www.joybuy.co.uk/landingPage/dp/item-${n}/2055${n}?siteCode=GB&lang=en,\n`;

test('Joybuy plan for GGW and HGW: the mistakes are listed under LEFT OUT with their reason, the right products are in', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'joybuy-l55-'));
  let csv = HEAD;
  MISTAKES.forEach(([name, cat], i) => { csv += row(10 + i, name, cat, 49.99); });
  csv += row(90, 'Grill Cover for Weber Spirit BBQ, Waterproof 600D', 'Home & Garden', 19.99)
    + row(91, 'TP-Link Tapo C200 Pan/Tilt Wi-Fi Camera, 1080p Home Security', 'Electronics', 24.99);
  writeFileSync(join(dir, 'AWIN_123932_114093.csv.gz'), gzipSync(csv));
  const out = mkdtempSync(join(tmpdir(), 'joybuy-l55-out-'));
  const r = await planLegacyImport({ archive: dir, retailer: 'joybuy', outDir: out, now: new Date('2026-10-25T10:00:00Z') });
  assert.deepEqual(r.accepted.ggw.map(p => p.product_name), ['Grill Cover for Weber Spirit BBQ, Waterproof 600D']);
  assert.deepEqual(r.accepted.hgw.map(p => p.product_name), ['TP-Link Tapo C200 Pan/Tilt Wi-Fi Camera, 1080p Home Security']);
  const text = readFileSync(join(out, 'report.txt'), 'utf8');
  assert.match(text, /== LEFT OUT, by reason ==/);
  assert.match(text, /paint sprayer\)\n[\s\S]*TILSWALL/);
  assert.match(text, /appliance with an app[\s\S]*Dreo Smart Space Heater/);
});
