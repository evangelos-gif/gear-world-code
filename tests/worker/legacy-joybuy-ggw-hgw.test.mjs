// Joybuy UK -> Garden Gear World and Home Gear World: the mistakes of the plan of 25 Oct 2026 (lessons L55).
// The REAL_* names are copied from the plan report of 25 Oct 2026 09:07 (old rules); the others are in the same form.
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

// From the plan report of 25 Oct 2026 09:07 (the rules before L55): what was placed wrongly, word for word.
const REAL_OUT = [
  ['Wangmazi Kitchen Scissors, Sharp Heavy-Duty Shears, for Food, Chicken Bones and Duck Bones, Household Stainless Steel Food Scissors, for Deveining Shrimp, Barbecue Essential', /scissors/],
  ['COOKER KING Silicone Food Clip Multi-Use Steak Clip BBQ Food Clip Bread Clip Baking Clip', /clip/],
  ['Thread & Loom Towel Set 2 x Bath Towels, 2 x Hand Towels, 2 x Face Cloths Poppy Seed Black', /towel/],
  ['Emma Molly Wildflower Bloom No-Fire Diffuser 300ml with Scented Paper Sticks and Rattan (Rose/Currant/Ambergris)', /home scent/],
  ['UniBond AERO 360 Moisture Absorber Wildflower Meadow Refill (Pack 2)', /damp absorber/],
  ['TILSWALL Paint Sprayer, Upgraded Ultra-Light Electric Paint Spray Gun with 600ml Detachable Cup, 2 Nozzles & 3 Patterns - Perfect for Fences, Sheds, Walls, Ceilings, Furniture, Cabinets, Garden, White', /paint sprayer/],
  ['TILSWALL Upgraded Ultra-Light Electric Paint Sprayer, with 600 ml Detachable Cup + 2 Nozzles, 3 Spray Patterns, Suitable for Spraying Fences, Sheds, Walls, Ceilings, Cabinets, Furniture and Gardens, Blue', /paint sprayer/],
  ['JOYFURNOS 2-Pack Heavy Duty Steel Shelving – 5 Shelves, Bolt-Free Assembly, Each Unit Size 75×30×150 cm, Load Capacity 650 kg per Unit – Suitable for Garage or Storage Shed, Silver', /shelves or racking/],
  ['Sloosh Inflatable Tanning Pool Lounger Float, 70" x 46" Extra Large Pool Floats Adult with Pillow, 4 in 1 Suntan Tub Raft Floatie,Sunbathing Bed Lounge for Water Blow Up Party Gifts, L-Blue', /pool float/],
  ['【Black Friday Early Deals】DJI Osmo Action 4 Adventure Combo - 4K/120fps Waterproof Action Camera with a 1/1.3-Inch Sensor, 10-bit & D-Log M Color Performance, 155° FOV, Up to 7.5 h with 3 Extra Batteries, Outdoor Camera', /not one that watches a home/],
  ['KAWA 64GB Micro SD Card, High Endurance Video Monitoring Card, microSDXC Flash Memory Card, A1, U3, Class10, V30, High Speed TF Card for DashCam, Security Camera, Baby Monitor, Phones, Tablets', /not one that watches a home/],
  ['COOKER KING Food Grade Aluminium Foil for Barbecue Baking, 15μm, 20m x 30cm', /made FOR a garden product/],
  ['AIRMATE 1800W PTC Ceramic Tower Heater, Fast Heating with 80° Oscillation, Smart Thermostat, 4-Stage Sleep Mode, 24H Timer, Remote Control & Child Lock', /appliance with an app/]
];
// ... and from the same report, products that were right: they stay (sheds and a deck box "with Shelves", a BBQ tool set
// that lists a "Food Clip", plant pots "Suitable for Herbs", security cameras, smart locks and sensors).
const REAL_IN = [
  ['Aoxun Garden Shed Made Of Weatherproof Wood With 3 Shelves And Asphalt Roof', 'ggw', 'Sheds'],
  ['Aoxun Outdoor Storage Cabinet, Wooden Garden Tool Shed with Waterproof Steel Roof, 3 Adjustable Shelves, Magnetic Door Closure, Powder Coated Handles, Weather Resistant, 81.5 x 34 x 161.5 cm, Black', 'ggw', 'Sheds'],
  ['Costway 318 L Patio Wicker Storage Cabinet Deck Box with Removable Shelves-Brown', 'ggw', 'Garden storage'],
  ['SuperFOIL Self-Adhesive Shed Insulation - 1m x 10m', 'ggw', 'Sheds'],
  ['Large-capacity Vertical Firewood Rack Freestanding Metal Log Storage Holder for Fireplace, Patio, Indoor, Outdoor, Home Wood Organization', 'ggw', 'Log stores'],
  ['Vonhaus Deep Walk in Greenhouse', 'ggw', 'Greenhouses'],
  ['SUCOJIA Complete Set BBQ Grilling Tools Set | Disposable Gloves, Wooden Handle Oil Brush, Carbon Clip, Food Clip, Barbecue Skewers Set & Aluminum Foil Paper | Essential Barbecue Accessories, for Grill Enthusiasts', 'ggw', 'BBQ accessories'],
  ['SUCOJIA Fish Grill Baskets for Outdoor Grill Vegetables, Stainless Steel BBQ Grill Basket for Fish Vegetables Shrimp, Tight Mesh Bold Encryption, Batch Barbecue Master, Extended Handle Anti-Scalding and Anti-Skid', 'ggw', 'BBQ accessories'],
  ['Huacan cleaning barbecue brush, wire brush, wire brush for barbecue grills and barbecue stoves, cleaning brush, barbecue tool', 'ggw', 'BBQ accessories'],
  ['Huacan Portable Charcoal BBQ Grill for Camping & Home – 1 Pack', 'ggw', 'BBQs'],
  ['Vonhaus Outdoor Pizza Oven with Accessories', 'ggw', 'Pizza ovens'],
  // Second plan of 25 Oct 2026 (09:33): BBQ tool sets that list scissors stay; only scissors that ARE the product go.
  ['BJ Stainless Steel BBQ Set, 3-Piece with Barbecue Scissors & Steak Clips', 'ggw', 'BBQs'],
  ['Maxcook 3pcs Stainless Steel BBQ Grilling Accessories Set - BBQ Tongs, Oil Brush, Scissors Set (Black) MCPJ9562', 'ggw', 'BBQ accessories'],
  ['MADLAND 3 Self-Watering Plant Pots, 16.5cm Diameter, Beige Resin Flower Pots with Bottom Trays, Deep Water Storage Reservoir, Clean and Mess-Free Small Planting Pots, Suitable for Herbs, Succulents, Pothos, Windowsills and Gardens', 'ggw', 'Plants'],
  ['Miracle Gro Quick Grow Lawn Seed 56m2', 'ggw', 'Seeds & bulbs'],
  ['UME 2 Pack Solar Pathway Lights Outdoor, Bright Solar Garden Lights with Metal Design–IP65 Waterproof, Auto On/Off, 3000K LED Landscape Lighting for Yard, Lawn, Walkway, Driveway, Patio Decor', 'ggw', 'Solar lights'],
  ['Vonhaus Hudson Grey Sun Lounger Chair With Cushion', 'ggw', 'Loungers'],
  // The one product moved on purpose: a planter "with Topped Trellis" is a planter, not fencing.
  ['Outsunny 72.5x31.5x149.5cm 45L Garden Wooden Pine Trough Planter with Topped Trellis Climbing Plants Flower Raised Bed Orange', 'ggw', 'Growing'],
  ['JOOAN 2K Outdoor Security Camera LAN 2.4G WiFi 360°PTZ Cam for Home Surveillance IP66 Waterproof Motion Detect & Alert Sound Alarms Color Night 24/7 Record Cloud/8-256G Card Storage Auto Tracking', 'hgw', 'Security Camera'],
  ['Rexsun X6 Smart Doorbell – Compact Aluminum Alloy Video Doorbell, Real-Time View, Long Battery Life, Easy Installation, Voice Recording & MP3 Playback, Compatible with Windows, iOS & Linux, Memory Card Not Included', 'hgw', 'Video Doorbell'],
  ['Tapo C460 KIT Solar-Powered Security Camera Kit', 'hgw', 'Security Camera'],
  ['Xiaomi Self-Install Smart Lock (Keypad Included)', 'hgw', 'Smart Lock'],
  ['TP-Link tapo T300 Smart Water Leak Sensor', 'hgw', 'Smart Sensor'],
  ['Eve Energy Matter Smart Plug with Power Meter, Smart Home Wi-Fi Power Outlet, Energy Monitoring, Remote Control, Thread Technology, Compatible with Apple Home, Alexa, Google Home & SmartThings, UK Type G Plug', 'hgw', 'Smart Plug']
];

test('Joybuy plan report of 25 Oct 2026, real names: the mistakes are left out with their reason, the right products stay', () => {
  for (const [name, why] of REAL_OUT) {
    const r = c(name);
    assert.ok(r.reject, `${name} must be left out, got ${JSON.stringify(r)}`);
    assert.match(r.reject, why, name);
  }
  for (const [name, site, subcategory] of REAL_IN) {
    const r = c(name);
    assert.equal(r.site, site, name);
    assert.equal(r.subcategory, subcategory, name);
  }
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
  hgw('TP-Link Tapo C200 Pan/Tilt Wi-Fi Camera, 1080p Home Security', 'Security Camera');
  hgw('JOOAN 2K Outdoor Security Camera LAN 2.4G WiFi 360 PTZ Cam', 'Security Camera');
  hgw('eufy E340 2K Dual Cameras Smart Video Doorbell with Chime', 'Video Doorbell');
  hgw('Blink Mini 2 Wireless Camera', 'Security Camera');
  hgw('tado Smart Radiator Thermostat X - Add-on Unit', 'Smart Thermostat');
  hgw('WIZ Smart Plug White: Wi-Fi Connected Smart Home Device', 'Smart Plug');
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
  assert.match(text, /pool float\)\n[\s\S]*TILSWALL/);
  assert.match(text, /appliance with an app[\s\S]*Dreo Smart Space Heater/);
});
