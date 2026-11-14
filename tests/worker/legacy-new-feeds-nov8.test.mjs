// New Awin feeds of 8 Nov 2026 (owner: "feed download and import, all in one go"): Simply LED -> HGW Lighting and GGW
// outdoor lighting, Silver Cloud Beauty and Al Jazeera Perfumes -> WGW Beauty & Fragrances. Names are from the
// feed-profile report of 8 Nov 2026. 4x4 Predator (AGW) and AKKO (TGW, PGW) are new sources of the new-engine sites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as led from '../../tools/import-rules/simplyled.mjs';
import * as silver from '../../tools/import-rules/silvercloud.mjs';
import * as jaz from '../../tools/import-rules/aljazeera.mjs';

const GGW_LIGHT = 'Outdoor Lighting & Garden Electrical';

test('Simply LED: bulbs and indoor fittings to HGW in its own subcategories, outdoor lights to GGW, parts and trade fittings out', () => {
  const c = (name, feedCategory = 'Home & Garden > Lighting') => led.classify({ name, feedCategory });
  const hgw = [
    ['Crompton GU10 Spotlight LED Light Bulb 5W (50W Eqv) Warm White Clear Halogen Replacement High Performance', 'Light Bulb'],
    ['5-Pack Crompton Candle LED Light Bulbs B22 2.2W (25W Eqv) Warm White Pearl Filament Bayonet Frosted', 'Light Bulb'],
    ['Opus Golfball LED Light Bulb B22 4W Green Round Bayonet Coloured', 'Light Bulb'],
    ['Firstlight Phoenix 2-Light Flush Ceiling Light Contemporary Style in Cream', 'Ceiling Light'],
    ['Firstlight 450mm LED Picture/Mirror Wall Light 8W Contemporary Style Warm White in Brushed Steel', 'Wall Light'],
    ['Firstlight Fusion Pendant Light in Black', 'Pendant Light'],
    ['Spa Pyxis LED Bathroom Ceiling Light IP44 Chrome', 'Ceiling Light'],
    // From the dry run of 8 Nov 2026:
    ['Firstlight Orion LED Wall Spotlight 4W with On/Off Switch Modern Style Warm White in Brushed Steel', 'Wall Light'],
    ['Firstlight Chester Uplighter with On/Off Switch Modern Style Warm White in Black', 'Floor Lamp'],
    ['Firstlight Koko LED Rechargeable Table 2.2W with Dimmer Control Tri-Colour CCT in Black', 'Table Lamp']
  ];
  for (const [name, sub] of hgw) assert.deepEqual(c(name), { site: 'hgw', siteCategory: 'Lighting', subcategory: sub }, name);
  const ggw = [
    ['Zink HELIX Up and Down Wall Light in Black Outdoor Lights Exterior Front Door', 'Wall lights'],
    ['Crompton GLS LED Light Bulb B22 1.5W IP65 Amber Bayonet Coloured Garden Festoon', 'String & festoon lights'],
    ['Zink LED Ground Light Stainless Steel IP67', 'Path & spike lights'],
    ['Stanley 20W LED Floodlight with PIR Sensor', 'Floodlights & security lights'],
    ['Zink LETO Downlight with PIR sensor in Textured Black Up and Down Light Outdoor Exterior Front Door Lights', 'Floodlights & security lights']
  ];
  for (const [name, sub] of ggw) assert.deepEqual(c(name), { site: 'ggw', siteCategory: GGW_LIGHT, subcategory: sub }, name);
  assert.deepEqual(c('Zink LED Spike Light', 'Home & Garden > Lighting > Landscape Pathway Lighting').site, 'ggw');
  assert.ok(c('Zink Rechargeable LED Portable Work Light 20W Daylight in Yellow and Black').reject, 'a work light is for Construction');
  for (const name of ['LED Driver 12V 30W Constant Voltage', 'Culina 1 Gang Grid Kinetic Dimmable Switch Black', 'Emergency LED Bulkhead Maintained 3hr', '150W LED High Bay UFO Light', 'Christmas Star Light'])
    assert.ok(c(name).reject, name);
  assert.ok(c('Round LED Bathroom Mirror 600mm', 'Home & Garden > Decor > Mirrors').reject, 'a mirror is not a light');
  assert.ok(led.RULES.shop.test('https://www.simplyled.co.uk/products/x') && !led.RULES.shop.test('https://www.amazon.co.uk/x'));
});

test('Silver Cloud Beauty: pillowcases and masks are beauty tools, sets are gift sets; "My Store" shows as Silver Cloud', () => {
  const c = name => silver.classify({ name });
  assert.deepEqual(c('White Satin Pillowcase infused with Silver Ions'), { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Beauty tools' });
  assert.equal(c('Heart Print Satin Pillowcase & Sleep Mask Gift Set With Silver Ions').subcategory, 'Gift sets');
  assert.equal(c('Silver Sleep Mask').subcategory, 'Beauty tools');
  assert.equal(c('Soft Satin Pink Heatless Hair Curler Set').subcategory, 'Hair tools');
  assert.ok(c('Silver Cloud e-Gift Card').reject);
  assert.equal(silver.displayBrand('My Store'), 'Silver Cloud');
  assert.equal(silver.displayBrand('Silver Cloud'), 'Silver Cloud');
  // The two feeds list the same products: one key per product page.
  const get = k => ({ merchant_deep_link: 'https://silvercloudbeauty.com/products/white-satin-pillowcase', merchant_product_id: '123' })[k];
  assert.equal(silver.productKey(get), 'products/white-satin-pillowcase');
});

test('Al Jazeera Perfumes: scent-only names get the brand, in normal case; samples and gift cards out', () => {
  const c = (name, brand) => jaz.classify({ name, brand });
  assert.deepEqual(c('LOS ANGELES', 'ALJAZEERA PERFUMES'), { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Fragrance', name: 'Al Jazeera Perfumes Los Angeles' });
  assert.equal(c('AMBER OUD', 'ORYX PERFUMES').name, 'Oryx Perfumes Amber Oud');
  assert.equal(c('ROSE OF THE DESERT', 'LUXURY COLLECTION').name, 'Luxury Collection Rose of the Desert');
  assert.equal(c('Al Jazeera Perfumes Discovery Set', 'ALJAZEERA PERFUMES').subcategory, 'Gift sets');
  assert.equal(c('Al Jazeera Perfumes Discovery Set', 'ALJAZEERA PERFUMES').name, 'Al Jazeera Perfumes Discovery Set');
  for (const n of ['Perfume Samples', 'Gift Card £50', 'Oryx Roses Scented Candle']) assert.ok(c(n, 'ALJAZEERA PERFUMES').reject, n);
});

test('new-engine sources: 4x4 Predator on Car Gear World, AKKO on Technology and Gaming Gear World', () => {
  const src = site => { const d = JSON.parse(readFileSync(`sites/${site}/sources.json`, 'utf8').replace(/^﻿/, '')); return d.sources || d; };
  const has = (site, adv, feed, retailer) => src(site).some(s => s.advertiserId === adv && (s.feedIds || []).includes(feed) && s.retailer === retailer && s.approved === true && s.currency === 'GBP');
  assert.ok(has('agw', 104931, 104075, '4x4 Predator'));
  assert.ok(has('tgw', 69178, 94438, 'AKKO'));
  assert.ok(has('pgw', 69178, 94438, 'AKKO'));
});

test('Car Gear World: a shop category map (4x4 Predator) decides before the general rules; other shops are unchanged (L102)', async () => {
  const agw = await import('../../sites/agw/category-rules.js');
  const d = JSON.parse(readFileSync('sites/agw/sources.json', 'utf8').replace(/^﻿/, ''));
  const src = d.sources.find(s => s.advertiserId === 104931);
  const c = (name, cat) => agw.classify(name, cat, '', src);
  assert.deepEqual(c('Jaecoo J7 2025+ Black Aluminium Side Steps Pair', 'Side Steps'), { ok: true, slug: 'roof-towing-exterior' });
  assert.deepEqual(c('Ford Transit Custom MK2 23+ Gloss Black Tailgate Rear Spoiler', 'Styling'), { ok: true, slug: 'roof-towing-exterior' });
  assert.deepEqual(c('Stealth LED VW Crafter 2017+ Twin 7" Luminous LED Integration Kit - 10,080 Lumens', 'Integration Kits'), { ok: true, slug: 'car-electronics' });
  assert.deepEqual(c('Toyota Hilux Revo 30mm Hubcentric Wheel Spacers', 'Spacers'), { ok: true, slug: 'tyres-wheels' });
  assert.deepEqual(c('Universal Tailgate Damper', 'Tailgate Struts'), { ok: true, slug: 'parts-maintenance' });
  assert.deepEqual(c('Suzuki Jimny Rubber Floor Mats', 'Floor Mats'), { ok: true, slug: 'interior-comfort' });
  assert.deepEqual(c('Defender Wading Plug Kit', 'Accessories'), { ok: true, slug: 'roof-towing-exterior' }, 'categoryDefault for the shop\'s other sections');
  assert.equal(agw.mapByShop('Side Steps', { categoryMap: { 'Side Steps': 'no-such-slug' } }), '', 'an unknown slug is ignored');
  assert.equal(agw.mapByShop('Side Steps', null), '');
  assert.deepEqual(agw.classify('Ford Ranger Side Steps', 'Side Steps'), agw.classify('Ford Ranger Side Steps', 'Side Steps', '', { retailer: 'Tooled Up' }), 'no map: as before');
});

test('Baccus: men\'s clothes, shoes and accessories to MGW in its existing subcategories; vouchers out', async () => {
  const b = await import('../../tools/import-rules/baccus.mjs');
  const c = (name, awinCategory = "Men's Clothing", feedCategory = 'Clothing') => b.classify({ name, feedCategory, awinCategory });
  assert.deepEqual(c('Ed Hardy - Laser Etched Dragon Repeat Jeans - Blue'), { site: 'mgw', siteCategory: 'Clothing', subcategory: 'Jeans' });
  assert.equal(c('Ed Hardy - Multi-Graphic Relaxed T-Shirt - Grey').subcategory, 'T-Shirts');
  assert.equal(c('Tommy Hilfiger - Austin Lightweight Cargo Trousers - Newsprint (Beige)', "Men's Trousers", 'Cargos & Trousers').subcategory, 'Trousers');
  assert.deepEqual(c('HUGO - Yarrow Trainers - Light Beige', "Men's Footwear", 'Footwear'), { site: 'mgw', siteCategory: 'Shoes', subcategory: 'Trainers' });
  assert.deepEqual(c('Goorin Bros - The Boss Trucker Cap - Grey', 'Accessories', 'Accessories'), { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Hats & Caps' });
  assert.ok(c('Gift Voucher', '', 'Gift Vouchers').reject);
  assert.ok(b.RULES.shop.test('https://baccusstore.co.uk/products/x'));
});

test('fixes of 8 Nov 2026 evening: car diffusers and headlight bulbs on AGW, AKKO keyboards on PGW, Baccus socks and trunks', async () => {
  const agw = await import('../../sites/agw/category-rules.js');
  const pgw = await import('../../sites/pgw/category-rules.js');
  const b = await import('../../tools/import-rules/baccus.mjs');
  const d = JSON.parse(readFileSync('sites/agw/sources.json', 'utf8').replace(/^﻿/, ''));
  const pred = d.sources.find(s => s.advertiserId === 104931);
  assert.equal(agw.classify('VW Transporter T7 25+ Gloss Black Rear Bumper Diffuser', 'Styling', '', pred).ok, true);
  assert.equal(agw.classify('Stealth LED H7 Headlight Bulb Pair – 2800 lumens', 'LED Bulbs', '', pred).ok, true);
  assert.equal(agw.classify('Reed Diffuser Lavender 100ml', 'Home').ok, false, 'a home diffuser stays out');
  assert.equal(agw.classify('LED Headlight 300 lumens Rechargeable Head Torch', 'Torches').ok, false, 'a head torch stays out');
  const ps = JSON.parse(readFileSync('sites/pgw/sources.json', 'utf8').replace(/^﻿/, '')).sources.find(s => s.retailer === 'AKKO');
  assert.deepEqual(pgw.classify('Black & Gold 3068B Plus ISO', 'Keyboards', '', ps), { ok: true, slug: 'mice-keyboards' });
  assert.deepEqual(pgw.classify('Verge S9 Ultra Gaming Headset', 'Keyboards', '', ps), { ok: true, slug: 'headsets' });
  assert.equal(pgw.classify('Black & Gold 3068B Plus ISO', 'Keyboards', '', { retailer: 'Other' }).ok, false, 'other shops unchanged');
  const c = (name, awinCategory = "Men's Clothing") => b.classify({ name, feedCategory: 'Clothing', awinCategory });
  assert.equal(c('BOSS - Six Pack Ribbed Cotton Socks - White', 'Accessories').subcategory, 'Socks');
  assert.equal(c('HUGO - Tripple-Pack Galaxy Cotton Trunks - Black').subcategory, 'Underwear');
  assert.equal(c('Lyle & Scott - Skinny ML822 Sweatpant - Navy').subcategory, 'Trousers');
  assert.equal(c('Weekend Offender - Gacha Padded Gillet - Black').subcategory, 'Jackets');
  assert.equal(c('Lacoste - Half Zip Sweater AH1980 - Beige').subcategory, 'Knitwear');
});
