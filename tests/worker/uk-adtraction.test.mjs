// Wave 1 UK, Adtraction (chat 7 sheet, approved 23 Nov 2026, lessons L225): Garden Chic (GGW + HGW), Online Bedrooms,
// Sheet Story, Showery and Defender (HGW), and the shops whose programme closed on 23-24 Nov 2026 (The Body Shop GR,
// Camping World UK). Cases from the Adtraction feeds of 24 Nov 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as chic from '../../tools/import-rules/gardenchic-uk.mjs';
import * as beds from '../../tools/import-rules/onlinebedrooms-uk.mjs';
import * as sheet from '../../tools/import-rules/sheetstory-uk.mjs';
import * as showery from '../../tools/import-rules/showery-uk.mjs';
import * as defender from '../../tools/import-rules/defender-uk.mjs';
import * as closed from '../../tools/cleanup-rules/closed.mjs';
import { isAdtractionLink } from '../../tools/network-links.mjs';

const at = c => (c.reject ? `out: ${c.reject}` : `${c.site} ${c.siteCategory} > ${c.subcategory}`);
const SHOPS = [chic, beds, sheet, showery, defender];

test('L225 the five Adtraction shops: Adtraction rules, pounds, a shop name the import tool takes (L63), feed links that pay', () => {
  for (const m of SHOPS) {
    assert.equal(m.RULES.network, 'adtraction', m.RULES.key);
    assert.equal(m.RULES.currency, 'GBP', m.RULES.key);
    assert.match(m.RULES.retailer, /^[A-Za-z0-9 .-]+$/, `${m.RULES.key}: letters, digits, spaces, dots and hyphens only`);
    assert.ok(/^\d{9,10}$/.test(String(m.RULES.advertiserId)), m.RULES.key);
  }
  assert.deepEqual(chic.RULES.sites, ['ggw', 'hgw']);
  // The Adtraction tracking links of these feeds (the shops' own tracking hosts, our channel 2130571848).
  assert.ok(isAdtractionLink('https://id.gardenchic.co.uk/t/t?a=2039557172&as=2130571848&t=2&tk=1&cupa_sku=401330&fid=32', '2130571848'));
  assert.ok(isAdtractionLink('https://at.defendersecurityproducts.co.uk/t/t?a=1974721416&as=2130571848&t=2&tk=1&cupa_sku=CC00454', '2130571848'));
});

test('L225 Garden Chic: garden buildings and furniture to GGW by the shop category, House & Home to HGW by the name', () => {
  const c = (name, feedCategory = '') => at(chic.classify({ name, feedCategory }));
  assert.equal(c('Tongue & Groove Pent Shed 10 x 7', 'Garden Buildings - Garden Sheds - Wooden Sheds'), 'ggw Garden Buildings, Fencing & Storage > Sheds');
  assert.equal(c('Sally Log Cabin 5.1m x 3.9m', 'Garden Buildings - Leisure Buildings - Log Cabins'), 'ggw Garden Buildings, Fencing & Storage > Summerhouses & log cabins');
  assert.equal(c('Lean To Grow House 2 x 4', 'Garden Buildings - Greenhouses - Aluminium Greenhouses'), 'ggw Garden Buildings, Fencing & Storage > Greenhouses');
  assert.equal(c('Helena Open Sided Gazebo', 'Garden Buildings - Leisure Buildings - Gazebos'), 'ggw Garden Furniture & Outdoor Living > Parasols, gazebos & shade');
  assert.equal(c('Muskoka 4 - 6 Person Hot Tub', 'Outdoor Living - Hot Tubs Spas & Saunas - Hot Tubs'), 'ggw Garden Furniture & Outdoor Living > Hot tubs & accessories');
  assert.equal(c('Winchester Royal Rattan Corner Dining Sofa Set Beige 8 Seater', 'Outdoor Living - Garden Furniture - Garden Furniture Sets'), 'ggw Garden Furniture & Outdoor Living > Dining sets');
  // A cover sold as "Aerocover Table 160 x 100 x 70cm" is a cover, not a table; a swing seat sold with its cover is a swing seat.
  assert.equal(c('Aerocover Table 160 x 100 x 70cm', 'Outdoor Living - Garden Furniture - Cushions & Covers'), 'ggw Garden Furniture & Outdoor Living > Furniture covers');
  assert.equal(c('Miami 2 Seater Swing Seat and Cover Package'), 'ggw Garden Furniture & Outdoor Living > Hammocks & swing seats');
  assert.equal(c('3.3L Handheld Seed Spreader Orange', 'Garden Care & Tools'), 'ggw Plants, Growing & Garden Care > Lawn Spreaders');
  assert.equal(c('Pizzaro Pizza Oven', 'Outdoor Living - BBQs & Outdoor Ovens - Pizza & Outdoor Ovens'), 'ggw BBQ & Outdoor Cooking > Pizza ovens');
  // House & Home: furniture words before appliance words ("Coffee Table" is a table, not a coffee machine).
  assert.equal(c('Kalani White Marble Square Coffee Table', 'House & Home - Indoor Furniture - Living Room Furniture'), 'hgw Furniture > Coffee Table');
  assert.doesNotMatch(c('Kitchen Coastal Style Cupboard Microwave Stand MDF White', 'House & Home - Indoor Furniture - Kitchen Furniture'), /Microwave/, 'a stand, not a microwave');
  assert.equal(c('Ceramic Space Heater Tower White Tall 2000w', 'House & Home - Heating & Cooling - Heaters & Fires'), 'hgw Home Appliances > Heater');
  assert.equal(c('Arc Tree Floor Lamp with 3000K/4500K/6500K Colour Temperatures Black', 'House & Home - Heating & Cooling - Heaters & Fires'), 'hgw Lighting > Floor Lamp');
  assert.equal(c('Set of 2 Potted Artificial Plants Ball Tree with Lavender Flowers 110cm', 'House & Home - Home Accessories'), 'hgw Home Decor > Artificial Plants');
  assert.equal(c('Predecorated Artificial Christmas Tree Green 6ft', 'House & Home - Christmas Store - Christmas Trees'), 'hgw Home Decor > Christmas');
  // Never on these two sites.
  for (const [n, cat] of [['Wooden Dog Kennel with Porch', 'Garden Buildings - Animal Houses - Kennels'], ['3 in 1 Kids Slide with Climber Basketball Hoop and Ball Grey', 'Garden Buildings - Play Houses'],
    ['Kids Mini Sofa Children Armchair Seating Bedroom Playroom Furniture Grey', 'House & Home - Indoor Furniture - Living Room Furniture'],
    ['Indoor Bench Press Barbell Rack Black & Red', 'House & Home - Home Accessories'], ['Radiator Cover Slatted MDF White', 'House & Home - Heating & Cooling'],
    ['3 Section Adjustable Massage Table Beauty Bed for Spa Lash White', 'House & Home - Indoor Furniture - Bedroom Furniture'],
    ['Rust-Free Aluminium Bath Chair with Adjustable Height Light Blue', 'House & Home - Indoor Furniture - Bathroom Furniture'],
    ['The Nutcracker Hamper', 'House & Home - Christmas Store - Christmas Gifts'], ['Worktop Dishwasher with 4 Place Settings 6 Programs Black', 'House & Home - Heating & Cooling - Heaters & Fires']]) {
    assert.match(c(n, cat), /^out: /, n);
  }
  assert.equal(c('Shiplap Poppy Playhouse 5 x 5', 'Garden Buildings - Play Houses - Wooden Playhouses'), 'ggw Garden Buildings, Fencing & Storage > Playhouses');
});

test('L225 Online Bedrooms: one card per page without the size, wardrobes, media walls and furniture; handles and add-ons out', () => {
  const c = (name, feedCategory = '') => at(beds.classify({ name, feedCategory }));
  assert.equal(beds.displayName('Freestanding Single Wardrobe With 2 Drawers - W: 300mm x H: 2250mm x D: 620mm, W: 600mm | H: 2250mm | D: 620mm / White'), 'Freestanding Single Wardrobe With 2 Drawers');
  assert.equal(beds.displayName('3 Door Front Frame Fitted Wardrobe - Widths Available 1401mm - 2000mm, Dust Grey'), '3 Door Front Frame Fitted Wardrobe, 1401-2000mm wide');
  assert.equal(beds.displayName('Blyth Tall Smooth Media Wall Base Unit, 4836mm / Up to 130" TV / Light Grey'), 'Blyth Tall Smooth Media Wall Base Unit');
  assert.equal(c('Blyth Tall Smooth Media Wall Base Unit, 4836mm / Up to 130" TV / Light Grey', 'media wall'), 'hgw Furniture > TV Unit');
  assert.equal(c('4 Door 4 Panel Shaker Front Frame Fitted Wardrobe - Widths Available 2001 - 2600mm, Sage Green', 'face frame'), 'hgw Furniture > Wardrobe');
  assert.equal(c('Single Panel Sliding Wardrobe Doors - Widths Available 1262mm - 2070mm', 'sliding wardrobe doors'), 'hgw Furniture > Wardrobe');
  assert.equal(c('Woodborough Shaker Boot Room Furniture, 3036mm / White', 'Boot Room Furniture'), 'hgw Storage & Organisation > Storage Unit');
  assert.equal(c('Chest of Drawers - 3 Drawers, W: 800mm | H: 760mm | D: 520mm / White', 'Chest of Drawers'), 'hgw Furniture > Chest Of Drawers');
  assert.equal(c('Sherwood Office Desk - W: 1200mm x H: 760mm x D: 520mm, W: 1600mm | H: 760mm | D: 520mm / Cashmere', 'Office Desks'), 'hgw Home Office > Office Desk');
  for (const [n, cat] of [['Abbey Black Handle - 768mm', 'Configurable'], ['Walnut Matt Colour Sample', 'Samples'], ['Double Dresser LED Strip Lighting Upgrade – Remote Controlled', 'Media Wall Lighting Upgrade'],
    ['TV Backing Panel - Up To 69" TVs, 60–69 inch TV — 1830 × 1200mm panel / White', 'Media Wall Accessories'], ['Side Bracket for Oval Wardrobe Rail', 'Furniture - Shelving - Bookcases & Standing Shelves'],
    ['500mm Open Back Storage Units For Sliding Wardrobes, 4 Shelves & 3 Drawers', 'Furniture - Shelving - Bookcases & Standing Shelves']]) assert.match(c(n, cat), /^out: /, n);
});

test('L225 Sheet Story, Showery and Defender: bed linen, bathroom and home security to HGW; refills, speakers and personal items out', () => {
  const s = (name, feedCategory = '') => at(sheet.classify({ name, feedCategory }));
  assert.equal(sheet.displayName('Ackly Bamboo - Beige Fitted Sheet, Double'), 'Ackly Bamboo Beige Fitted Sheet');
  assert.equal(s('Ackly Bamboo - Beige Fitted Sheet, Double', 'Fitted Sheet'), 'hgw Bedding & Bath > Bed Sheet');
  assert.equal(s('Ella Cotton White Duvet Cover Set, Double', 'Complete Bed Set'), 'hgw Bedding & Bath > Duvet');
  assert.equal(s('Ackly Bamboo White Full Bedding Set, Double', 'Complete Bed Set'), 'hgw Bedding & Bath > Bed Linen');
  assert.equal(s('ROSA Quilted Pillow Protectors – 50 x 75 cm, Pack of 2', 'Pillow Protector'), 'hgw Bedding & Bath > Pillow');
  assert.equal(s('NOVA Quilted Waterproof Cot Mattress Protector – 60 x 120 cm, Single', 'Mattress Protector'), 'hgw Bedding & Bath > Mattress Protector');
  const w = name => at(showery.classify({ name }));
  assert.equal(showery.displayName('Showery® 4 in 1 High Pressure Shower Head, Silver'), '4 in 1 High Pressure Shower Head');
  assert.equal(w('Showery® 4 in 1 High Pressure Shower Head, Silver'), 'hgw Bedding & Bath > Bathroom Accessories');
  assert.equal(w('Showery® Super Non Slip Bath Mat, Semi Oval - Living Simple'), 'hgw Bedding & Bath > Bath Mat');
  assert.equal(w('Showery® Drain Weasel Pro - Fast Drain Unblocking, Drain Weasel Pro'), 'hgw Cleaning & Laundry > Cleaning Products');
  for (const n of ['Showery® Halo Replacement Shower Head Filters, Pack of x1', 'Showery® Propeller Shower Head Cotton Filters',
    'Showery® Replacement Filter Stones Refill Pack - 12 Months Supply', 'Showery® Beat Waterproof Bluetooth Bathroom & Shower Speaker, Black']) assert.match(w(n), /^out: /, n);
  const d = name => at(defender.classify({ name }));
  assert.equal(d('Defender Video Doorbell with Chime'), 'hgw Smart Home > Video Doorbell');
  assert.equal(d('Defender Apollo Touch CCTV Kit'), 'hgw Smart Home > Security Camera');
  assert.equal(d('Defender 10yr Carbon Monoxide Alarm'), 'hgw Smart Home > Smoke Alarm');
  assert.equal(d('Defender Dual Activation Shed Alarm'), 'hgw Smart Home > Smart Sensor');
  assert.equal(d('Defender Smart Plug - 4 Pack'), 'hgw Smart Home > Smart Plug');
  assert.equal(d('Defender 24 Hour Digital Timer'), 'hgw Smart Home > Smart Socket');
  assert.equal(d('Burton Keyguard XL Key Safe'), 'hgw Smart Home > Smart Home Accessories');
  assert.equal(d('Defender Max II Solar Security Light'), 'hgw Lighting > Outdoor Light');
  for (const n of ['Defender IIIT Ultra-Loud Personal Attack Alarm', 'Card Defender Vault - RFID Blocking Card Holder', 'Defender Lumos XL Torch',
    'Defender Lumos Pro USB Bike Light Set', 'Check Your Drink Strips - 5 Pack', 'Defender Car Number Plate Fixing Kit']) assert.match(d(n), /^out: /, n);
  assert.equal(defender.displayBrand('Co'), '', 'the feed brand "Co" is not shown');
});

test('L225 the closed programmes: the clean-up hides The Body Shop GR and Camping World UK, their rules reject everything', async () => {
  const sql = closed.summarySql();
  assert.doesNotMatch(sql, /[%<>&|^]/, 'no character that breaks the cmd line of wrangler --command');
  for (const r of ['The Body Shop GR', 'Camping World UK']) assert.ok(sql.includes(`'${r}'`), r);
  assert.match(closed.idsSql(), /is_active = 1/);
  assert.equal(closed.updateSql([3, 4], false).trim(), "UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id IN (3, 4);");
  const body = await import('../../tools/import-rules/lw-11742.mjs');
  assert.match(body.classify({ name: 'Shea Body Butter 200ml' }).reject, /programme closed/);
  assert.equal(body.RULES.network, 'linkwise');
  const camp = await import('../../tools/import-rules/campingworld-kids.mjs');
  assert.match(camp.classify({ name: 'Olang Zaza Kids Snow Boots' }).reject, /programme closed/);
  const vgw = JSON.parse(readFileSync('sites/vgw/sources.json', 'utf8')).sources.find(s => s.advertiserId === 124426);
  assert.match(String(vgw.closed), /2026/, 'Camping World UK on VGW is marked closed');
});

test('L225 a closed source of a new-engine site is never read and ALL its products are hidden, with --only too', async () => {
  const { planImport } = await import('../../tools/tgw-import-plan.mjs');
  const rules = await import('../../sites/vgw/category-rules.js');
  const dir = mkdtempSync(join(tmpdir(), 'gw-closed-'));
  const archive = join(dir, 'archive');
  mkdirSync(archive);
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: [
    { advertiserId: 124426, feedIds: [114026], retailer: 'Camping World UK', currency: 'GBP', approved: true, closed: '24 Nov 2026: Awin programme closed', campingShop: true },
    { advertiserId: 999, feedIds: [1], retailer: 'Open Shop', currency: 'GBP', approved: true }
  ] }));
  for (const [only, out] of [[['124426'], 'a'], [null, 'b'], [['999'], 'c']]) {
    const outDir = join(dir, out);
    mkdirSync(outDir);
    await planImport({ archive, sourcesFile, outDir, rules, label: 'VGW', only, now: new Date('2026-11-24T12:00:00Z') });
    const finish = readFileSync(join(outDir, 'sql', '9999-finish.sql'), 'utf8');
    const report = readFileSync(join(outDir, 'report.txt'), 'utf8');
    if (out === 'c') {
      assert.doesNotMatch(finish, /124426/, 'a plan of another shop does not touch the closed one');
    } else {
      assert.match(finish, /UPDATE products SET is_active = 0, updated_at = datetime\('now'\) WHERE awin_advertiser_id IN \(124426\) AND is_active = 1;/);
      assert.match(report, /Camping World UK: CLOSED \(24 Nov 2026: Awin programme closed\), not read/);
    }
  }
});

test('L225 the one UK apply list: the 14 checked pairs of uk-wave1-1124.txt first, then the 6 Adtraction pairs, each rules file real', () => {
  const read = f => readFileSync(f, 'utf8').split(/\r?\n/).map(l => l.split('#')[0].trim()).filter(Boolean);
  const wave1 = read('tools/massive/uk-wave1-1124.txt');
  const all = read('tools/massive/uk-final-1124.txt');
  assert.deepEqual(all.slice(0, wave1.length), wave1);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(all.slice(wave1.length), ['gardenchic-uk:ggw', 'gardenchic-uk:hgw', 'onlinebedrooms-uk:hgw', 'sheetstory-uk:hgw', 'showery-uk:hgw', 'defender-uk:hgw']);
  for (const p of all) {
    const [key, site] = p.split(':');
    const rules = readFileSync(`tools/import-rules/${key}.mjs`, 'utf8');
    assert.ok(new RegExp(`sites: \\[[^\\]]*'${site}'`).test(rules), `${p}: the site is in the rules`);
  }
});
