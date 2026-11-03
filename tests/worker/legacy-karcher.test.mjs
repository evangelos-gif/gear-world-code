// L89: Kärcher UK (CJ 5030015) on Home and Garden Gear World (3 Nov 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, RULES } from '../../tools/import-rules/karcher.mjs';

const place = (name, cat = '', url = '') => { const c = classify({ name, feedCategory: cat, url }); return c.reject ? 'out' : `${c.site} ${c.siteCategory}/${c.subcategory}${c.doubt ? ' (doubt)' : ''}`; };

test('L89: first CJ samples: professional range out, garden hose to GGW', () => {
  assert.equal(place('Kärcher Power nozzle 15°, 055', 'Accessories > Professional > High-pressure cleaners > Kärcher power nozzle', 'https://www.karcher.com/gb/en/professional/products/x'), 'out');
  assert.equal(place('Kärcher CarpetPro Conditioner RM 763', 'Cleaning Agents > Professional > Carpet'), 'out');
  assert.equal(place('Kärcher Disc brush complete black D51', 'Accessories > Professional > Scrubber-dryers > Disc Brushes for BD'), 'out');
  assert.equal(place('Kärcher PrimoFlex® hose 1/2" - 20 m', 'Products > Home & Garden > Watering systems > Hoses'), 'ggw Watering & Irrigation/Hose Pipes');
});

test('L89: home and garden products go to places HGW and GGW already have', () => {
  const hg = 'Products > Home & Garden > ';
  assert.equal(place('Kärcher K 5 Power Control Pressure Washer', hg + 'High-pressure cleaners'), 'ggw Power Garden Tools/Outdoor Power Tools');
  assert.equal(place('Kärcher T 7 Plus T-Racer Surface Cleaner', hg + 'High-pressure cleaner accessories'), 'ggw Power Garden Tools/Outdoor Power Tools');
  assert.equal(place('Kärcher Hose Reel HR 4.525', hg + 'Watering systems > Hose reels'), 'ggw Watering & Irrigation/Hose Reels & Storage');
  assert.equal(place('Kärcher OS 5.320 S Oscillating Sprinkler', hg + 'Watering systems'), 'ggw Watering & Irrigation/Garden Sprinklers');
  assert.equal(place('Kärcher SP 16.000 Dirt Submersible Pump', hg + 'Pumps'), 'ggw Watering & Irrigation/Watering Accessories');
  assert.equal(place('Kärcher WD 3 Wet and Dry Vacuum Cleaner', hg + 'Wet and dry vacuum cleaners'), 'hgw Home Appliances/Vacuum Cleaner');
  assert.equal(place('Kärcher SC 3 Upright Steam Cleaner', hg + 'Steam cleaners'), 'hgw Cleaning & Laundry/Steam Cleaner');
  assert.equal(place('Kärcher WV 6 Plus Window Vac', hg + 'Window vacs'), 'hgw Cleaning & Laundry/Cleaning Products');
  assert.equal(place('Kärcher FC 7 Cordless Hard Floor Cleaner', hg + 'Hard floor cleaners'), 'hgw Cleaning & Laundry/Mop');
  assert.equal(place('Kärcher AF 20 Air Purifier', hg + 'Air purifiers'), 'hgw Home Appliances/Air Purifier');
  assert.equal(place('Kärcher Fleece filter bags for WD 3', hg + 'Accessories'), 'hgw Cleaning & Laundry/Vacuum Accessories');
});

test('L89: retailer name without the umlaut; CJ shop', () => {
  assert.equal(RULES.network, 'cj');
  assert.equal(RULES.advertiserId, 5030015);
  assert.match(RULES.retailer, /^[\x20-\x7e]+$/);
  assert.ok(RULES.shop.test('https://www.karcher.com/gb/en/home-and-garden/products/primoflexr-hose-1-2-20-m-p26451380?utm_content=feed'));
});

test('L89, first dry run: outdoor accessories and batteries to GGW, floor care to HGW', () => {
  assert.equal(place('Kärcher G 180 Q gun', 'Accessories > Home & Garden > Consumer Outdoor > Trigger guns'), 'ggw Power Garden Tools/Outdoor Power Tools');
  assert.equal(place('Kärcher WB 7 Plus', 'Accessories > Home & Garden > Consumer Outdoor > Brushes'), 'ggw Power Garden Tools/Outdoor Power Tools');
  assert.equal(place('Kärcher Battery Power 18/50', 'Accessories > Home & Garden > Retail Battery Platform > Batteries'), 'ggw Power Garden Tools/Outdoor Power Tools');
  assert.equal(place('Kärcher PC 15', 'Accessories > Home & Garden > Consumer Outdoor > Pipe Cleaning'), 'ggw Power Garden Tools/Outdoor Power Tools');
  assert.equal(place('Kärcher Floor care waxed parquet/parquet with oil-wax finish', 'Cleaning Agents > Home & Garden > Floor Polisher > Floor care'), 'hgw Cleaning & Laundry/Cleaning Products');
  assert.equal(place('Kärcher Textile Surface Protector', 'Cleaning Agents > Home & Garden > Spray extraction cleaners > Textile care'), 'hgw Cleaning & Laundry/Cleaning Products');
  assert.equal(place('Kärcher Car Shampoo 3-in-1 RM 610, 1l', 'Cleaning Agents > Home & Garden > High pressure washers'), 'ggw Power Garden Tools/Outdoor Power Tools');
});
