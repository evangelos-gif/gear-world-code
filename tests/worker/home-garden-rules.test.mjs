// Home and Garden Gear World: the general category rules (phase 4 of "every product through the Hub", 31 Oct 2026).
// Names are real products from both live sites; the rules were tuned on them (85% of HGW and 95% of GGW in the same category).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as HGW from '../../sites/hgw/category-rules.js';
import * as GGW from '../../sites/ggw/category-rules.js';
import { lastAt } from '../../sites/_shared/fashion-rules.js';
import hgwConfig from '../../sites/hgw/site.config.js';
import ggwConfig from '../../sites/ggw/site.config.js';

const on = (R, name, feed = '', source = null) => {
  const c = R.classify(R.cleanProductName(name), feed, '', source);
  return c.ok ? `${c.slug}/${c.subcategory}` : `no: ${c.reason}`;
};
const ggwSources = JSON.parse(readFileSync(new URL('../../sites/ggw/sources.json', import.meta.url), 'utf8'));
const shop = re => (ggwSources.sources || ggwSources).find(s => re.test(s.retailer));

test('the slugs and names are the ones each site already uses (site.config.js, database.categories)', () => {
  for (const [R, cfg] of [[HGW, hgwConfig], [GGW, ggwConfig]]) {
    const cats = cfg.database.categories;
    for (const slug of R.CATEGORY_SLUGS) {
      assert.ok(cats[slug], `${cfg.code}: ${slug} is a page of the site`);
      assert.ok(cats[slug].includes(R.CATEGORY_DB_NAMES[slug]), `${cfg.code}: ${slug} is stored as "${R.CATEGORY_DB_NAMES[slug]}"`);
    }
  }
});

test('lastAt sees overlapping matches ("Stick Vacuum" and "Vacuum Cleaner")', () => {
  assert.equal(lastAt(/stick vacuums?|vacuum cleaners?/i, 'Cordless Stick Vacuum Cleaner'), 'Cordless Stick Vacuum Cleaner'.length);
});

test('Home Gear World: the product type is the last noun of the name', () => {
  const cases = [
    ['Eureka NEC520BK Cordless Stick Vacuum Cleaner', 'home-appliances/Vacuum Cleaner'],
    ['Vax Pick Up Pet Cylinder Vacuum Cleaner - Ideal for Pet Hair Removal', 'home-appliances/Vacuum Cleaner'],
    ['Russell Hobbs Inspire Kettle', 'home-appliances/Kettle'],
    ['Bialetti Moka Express Stovetop Espresso Coffee Maker', 'kitchen-dining/Kitchen Utensil'],
    ['Tefal Ingenio 5-Piece Saucepan Set', 'kitchen-dining/Saucepan'],
    ['Air Wick Plug-In Air Freshener Refill', 'home-decor/Home Fragrance'],
    ['Dettol Bathroom Spray 500ml', 'cleaning-laundry/Cleaning Products'],
    ['Yard Duvet Cover Set Barton Check 100% Cotton Biscuit Double Size', 'bedding-bath/Duvet'],
    ['Silentnight Deep Sleep Pillow Pair', 'bedding-bath/Pillow'],
    ['Habitat Oak Coffee Table', 'furniture/Coffee Table'],
    ['Fellowes Laptop Riser', 'home-office/Laptop Stand'],
    ['Tado Smart Thermostat Starter Kit', 'smart-home/Smart Thermostat']
  ];
  for (const [name, want] of cases) assert.equal(on(HGW, name), want, name);
});

test('Garden Gear World: garden words and garden shops move indoor types to their garden twin', () => {
  const lights4fun = shop(/lights4fun/i), tooledUp = shop(/tooled up/i);
  assert.ok(lights4fun && lights4fun.gardenShop, 'Lights4fun is a garden shop');
  const cases = [
    ['Lyme Crackle Glass Solar Wall Light', '', lights4fun, 'outdoor-lighting-garden-electrical/Wall lights'],
    ['Outdoor Dining Lighting Bundle', '594', lights4fun, 'outdoor-lighting-garden-electrical/Outdoor lights'],
    ['Einhell GE-CM 18/33 Li Cordless Lawnmower', 'Garden Tools > Lawnmowers', tooledUp, 'power-garden-tools/Lawnmowers & Accessories'],
    ['Spear & Jackson Stainless Steel Border Spade', 'Garden Tools', tooledUp, 'garden-tools/Spades'],
    ['Weber Spirit E-325 Gas Barbecue', '', null, 'bbq-outdoor-cooking/BBQs'],
    ['Keter Store It Out Max Garden Storage Box', '', null, 'garden-buildings-fencing-storage/Garden storage'],
    ['Hozelock Auto Reel 40m Hose', '', null, 'watering-irrigation/Hose Pipes'],
    ['Garden Rattan 4 Seater Sofa Set', '', null, 'garden-furniture-outdoor-living/Lounge & corner sets'],
    ['Westland Multi Purpose Compost 50L', '', null, 'plants-growing-garden-care/Growing'],
    ['Patio Broom Stiff Bristle', '', null, 'garden-tools/Garden Brooms and Brushes']
  ];
  for (const [name, feed, source, want] of cases) assert.equal(on(GGW, name, feed, source), want, name);
});

test('each product goes to one of the pair, and other Gear Worlds\' products stay out', () => {
  assert.equal(on(HGW, 'Garden Rattan 4 Seater Sofa Set'), 'no: Garden Furniture & Outdoor Living (Garden Gear World)');
  assert.equal(on(HGW, 'Smartwares Outdoor Wall Light'), 'no: Outdoor Lighting & Garden Electrical (Garden Gear World)');
  assert.equal(on(GGW, 'Habitat Oak Coffee Table'), 'no: Furniture (Home Gear World)');
  assert.equal(on(HGW, 'Kettle Crisps Sea Salt 130g'), 'no: food or drink (not shown)');
  assert.equal(on(HGW, 'Kids Bunk Bed with Storage'), 'no: children\'s product (Kids\' Gear World)');
  assert.equal(on(HGW, 'Dog Bed Large Grey'), 'no: pet item (not shown yet)');
  assert.equal(on(HGW, 'Gift Card £50'), 'no: gift card or voucher');
  // Owner, 31 Oct 2026: Home Office is furniture and the desk set-up; printers and office supplies stay on Technology.
  assert.match(on(HGW, 'HP OfficeJet Pro 9010e All-in-One Printer'), /^no: /);
  assert.match(on(HGW, 'Leitz Lever Arch File A4'), /^no: /);
  assert.equal(on(HGW, 'Habitat Oak Writing Desk'), 'home-office/Office Desk');
  // Shadow catalogue 31 Oct 2026: printer parts, network cables, a colour and a brooch placed by one word of the name.
  const office = 'no: office or computer part (Technology Gear World)';
  assert.equal(on(HGW, 'OKI 44289103 Fuser kit. 60K pages for OKI C 612/711'), office);
  assert.equal(on(HGW, 'Epson 1005246 printer/scanner spare part'), office);
  assert.equal(on(GGW, 'Cables Direct B5-102 networking cable Black 2 m Cat5e U/UTP (UTP)'), office);
  assert.equal(on(GGW, 'StarTech.com 6.6ft (2m) Laptop Cable Lock - 4-Digit Combination'), office);
  assert.equal(on(HGW, 'NitroLift Autotrail Bed Gas Strut'), office);
  assert.match(on(GGW, 'Mackinaw Jacket (Charcoal) | XS | Stan Ray®'), /^no: /);
  assert.match(on(GGW, 'Weber Briquettes 4kg'), /^bbq-outdoor-cooking/);
  assert.equal(on(HGW, 'Natural Freshwater Pearl Fan Brooch with Zircon'), 'no: jewellery (Women\'s / Men\'s Gear World)');
});
