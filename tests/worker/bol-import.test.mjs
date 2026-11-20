// bol.com NL import plumbing (lessons L204): the routing (the one list of src/lib/bol-lists.js, L205), the banned lists, the
// places on the 10 sites, one card per size, no brand, no "was" price, and the dry run of all 10 sites at once
// (tools/bol-import-plan.mjs) on synthetic feed files written with the download's own row code. Nothing is imported:
// the bol.com entries are paused in sources.json and in the rules, and tools/legacy-import.ps1 stops on a paused plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { BOL_CATEGORIES, BOL_SEARCHES as LIST_SEARCHES } from '../../src/lib/bol-lists.js';
import { rowOf, BOL_COLUMNS } from '../../tools/bol-feed.mjs';
import { csvLine } from '../../tools/network-links.mjs';
import * as B from '../../tools/import-rules/lib/bol-nl.mjs';
import * as RULES from '../../tools/import-rules/bol-nl.mjs';
import { BOL_SITES as SHOWN_ON } from '../../sites/_shared/bol.js';
import { planBol, bolFiles, bolSourcesOf } from '../../tools/bol-import-plan.mjs';
import { planImport } from '../../tools/tgw-import-plan.mjs';
import * as AGW_RULES from '../../sites/agw/category-rules.js';

const read = f => readFileSync(f, 'utf8');

test('L204 + L205: every category and search of src/lib/bol-lists.js has its Gear World; the 10 sites are the ones that show bol.com', () => {
  assert.deepEqual(B.BOL_SOURCES.map(s => s.id), BOL_CATEGORIES.map(c => String(c.id)), 'the same list, the same order (the commission)');
  for (const s of B.BOL_SOURCES) assert.ok(s.site, `${s.id} ${s.name}: a site`);
  assert.deepEqual(B.BOL_SEARCHES.map(s => s.term), [...LIST_SEARCHES]);
  for (const s of B.BOL_SEARCHES) assert.ok(s.site, s.term);
  assert.deepEqual([...B.BOL_SITES].sort(), Object.keys(SHOWN_ON).sort(), 'a product goes only to a site that shows bol.com');
  assert.deepEqual(Object.fromEntries(B.BOL_SOURCES.map(s => [s.name, s.site])), {
    'Auto & Motor': 'agw', 'Koken & Tafelen': 'hgw', Huishouden: 'hgw', 'Kamperen & Outdoor': 'vgw', Sport: 'sgw', Wonen: 'hgw', Klussen: 'cgw',
    Tuin: 'ggw', Dieren: 'zgw', Damesmode: 'wgw', Herenmode: 'mgw', Kindermode: 'kgw' });
  assert.deepEqual(B.SITE_OF_SEARCH, { parfum: { site: 'wgw', men: 'mgw' }, werkschoenen: { site: 'cgw' } });
  assert.deepEqual([...B.LEGACY_SITES, ...B.NEW_SITES].sort(), [...B.BOL_SITES].sort());
});

test('L204: the import waits: paused in the rules of the older sites and in sources.json of AGW, VGW, SGW and ZGW', () => {
  assert.match(RULES.RULES.paused, /bol-remove\.ps1/);
  assert.equal(RULES.RULES.retailer, 'bol.com');
  assert.equal(RULES.RULES.currency, 'EUR');
  assert.equal(RULES.RULES.network, 'bol');
  for (const s of B.NEW_SITES) {
    const all = JSON.parse(read(`sites/${s}/sources.json`)).sources.filter(x => x.network === 'bol');
    assert.equal(all.length, 1, s);
    const e = all[0];
    const cat = B.BOL_SOURCES.find(x => x.site === s);
    assert.equal(String(e.advertiserId), cat.id, s);
    assert.ok(new RegExp(e.file).test(`BOL_${cat.id}_NL.csv.gz`) && !new RegExp(e.file).test(`BOL_${cat.id}_BE.csv.gz`), s);
    assert.ok(e.paused && e.approved && e.sections === 'bol-nl' && e.retailer === 'bol.com' && e.currency === 'EUR' && e.country === 'NL' && e.ignoreWasPrice, s);
    assert.deepEqual(bolSourcesOf(s).map(x => 'paused' in x), [false], `${s}: the dry run reads it`);
  }
  for (const s of ['tgw', 'bgw', 'pgw', ...B.LEGACY_SITES]) {
    const src = JSON.parse(read(`sites/${s}/sources.json`)).sources;
    assert.ok(!src.some(x => x.network === 'bol' || x.retailer === 'bol.com'), `${s}: no bol.com source`);
  }
  // tools/legacy-import.ps1: a paused plan changes nothing (before its restore point and its first write).
  const li = read('tools/legacy-import.ps1');
  const iPaused = li.indexOf("-contains 'paused') -and $plan.paused");
  assert.ok(iPaused > 0 && iPaused < li.indexOf('d1 time-travel info') && iPaused < li.indexOf('--remote --file'));
  assert.match(li, /if \(\$Apply\) \{ Say \('Δεν φορτώθηκε τίποτα: το \{0\} δεν φορτώνεται ακόμα \(μόνο το σχέδιο\)\.' -f \$RetailerName\) 'Yellow'; Finish 15 \}/);
});

test('L204: one card for every size: the size goes from the name', () => {
  const cases = {
    'Nike Sportswear Club T-shirt Heren - Maat M': 'Nike Sportswear Club T-shirt Heren',
    'Dames jeans skinny, maat 38': 'Dames jeans skinny',
    'Safety Jogger werkschoenen S3 - Maat 43': 'Safety Jogger werkschoenen S3',
    'Enkellaarsjes - 38/39': 'Enkellaarsjes',
    'Kinder pyjama (maat 110/116)': 'Kinder pyjama',
    'Zomerjurk - XL': 'Zomerjurk',
    'Rok maat: L': 'Rok',
    'Werkhandschoenen maat 10 - 12 paar': 'Werkhandschoenen maat 10 - 12 paar',
    'Kettlebell 12 kg': 'Kettlebell 12 kg',
    'Philips Airfryer XL HD9270 - 6,2 L': 'Philips Airfryer XL HD9270 - 6,2 L'
  };
  for (const [a, b] of Object.entries(cases)) assert.equal(B.bolBaseName(a), b, a);
  assert.equal(B.bolEan('871010300001'), '0871010300001', '12 digits: 13 with a 0, as the refresh finds it');
  assert.equal(B.bolEan('8710103000012'), '8710103000012');
});

test('L204: never the products banned on every site (ammunition, CD keys, pet prescription medicines, adult costumes ...)', () => {
  const banned = ['Luchtbuks kogels 4.5 mm 500 stuks', 'Steam Wallet cadeaukaart 50 euro', 'FIFA 26 PS5 CD-key', 'Ontwormingsmiddel hond - op recept',
    'Diergeneesmiddel voor katten', 'Carnavalskostuum piraat volwassenen', 'Sexy verkleedkostuum dames', 'Vibrator roze', 'E-sigaret starterset', 'Rode wijn Merlot 6 flessen',
    'Paracetamol 500 mg', 'Garantieverlenging 2 jaar', 'Pepperspray', 'Airsoft pistool'];
  for (const n of banned) assert.match(B.bannedReason(n), /^banned on every Gear World site/, n);
  const fine = ['Herenkostuum slim fit', 'Wijnglazen set van 6', 'Kogellager 6204', 'Halloween pompoen decoratie', 'Hondenspeelgoed bal', 'Kinder verkleedkostuum prinses'];
  for (const n of fine) assert.equal(B.bannedReason(n), '', n);
  assert.match(B.placeBol('zgw', { name: 'Antibiotica tabletten hond' }).reject, /pet prescription/);
  assert.match(B.placeBol('kgw', { name: 'Carnavalskostuum piraat volwassenen' }).reject, /adult costume/);
});

const P = (site, name, gpc = '', search = '') => B.placeBol(site, { name, gpc, search });
test('L204: each site\'s own category and subcategory, from the GS1 path first, else the head of the name (CHECK)', () => {
  const want = [
    ['agw', 'Nextbase 322GW Dashcam - Full HD', 'Auto & Motor > Auto-elektronica > Dashcams', 'car-electronics', 'Dash Cams', false],
    ['agw', 'Rubber automatten set universeel - 4 delig', '', 'interior-comfort', 'Car Mats', true],
    ['agw', 'Shell Helix motorolie 5W-30 5 liter', '', 'parts-maintenance', 'Oils & Fluids', true],
    ['agw', 'Sneeuwkettingen 9 mm', '', 'safety-winter', 'Snow Chains & Socks', true],
    ['hgw', 'Tefal koekenpan 28 cm', 'Koken & Tafelen > Pannen > Koekenpannen', 'Kitchen & Dining', 'Cookware', false],
    ['hgw', 'Philips Airfryer XL HD9270 - 6,2 L', '', 'Home Appliances', 'Air Fryer', true],
    ['hgw', 'Dyson V15 steelstofzuiger', '', 'Home Appliances', 'Vacuum Cleaner', true],
    ['hgw', 'Sierkussen velours groen 45x45 cm', '', 'Home Decor', 'Cushion', true],
    ['hgw', 'Strijkplank 124 x 38 cm', '', 'Cleaning & Laundry', 'Ironing & Clothes Care', true],
    ['vgw', 'Coleman koepeltent 4 persoons', '', 'camping-outdoor', 'Tents', true],
    ['vgw', 'Samsonite koffer 55 cm handbagage', '', 'luggage-suitcases', 'Suitcases', true],
    ['sgw', 'Kettlebell 12 kg gietijzer', '', 'fitness-gym', 'Weights', true],
    ['sgw', 'Wilson tennisracket pro', '', 'racket-sports', 'Rackets', true],
    ['cgw', 'Bosch Professional GSR 12V-15 accuschroefboormachine - incl. 2 accu', '', 'Power Tools', 'Drills & Drivers', true],
    ['cgw', 'Safety Jogger werkschoenen S3', '', 'Safety Boots', 'Safety Shoes', true],
    ['cgw', 'Werkhandschoenen maat 10 - 12 paar', '', 'PPE', 'Work Gloves', true],
    ['cgw', 'Stanley waterpas 60 cm', '', 'Hand Tools', 'Measuring Tools', true],
    ['ggw', 'Gardena tuinslang 20 m', '', 'Watering & Irrigation', 'Hoses & reels', true],
    ['ggw', 'Bosch accu heggenschaar 18V', '', 'Power Garden Tools', 'Hedge Trimmers', true],
    ['ggw', 'Wolf-Garten heggenschaar handmatig', '', 'Garden Tools', 'Pruning', true],
    ['zgw', 'Hondenmand orthopedisch', '', 'beds-crates', 'Beds & Crates', true],
    ['zgw', 'Kattenbakvulling 10 liter', '', 'cats', 'Cat Litter & Trays', true],
    ['zgw', 'Kippenhok met ren', '', 'birds', 'Chickens & Poultry', true],
    ['wgw', 'Zomerjurk dames bloemen', '', 'Clothing', 'Dresses', true],
    ['wgw', 'Leren handschoenen dames', '', 'Bags & Accessories', 'Gloves', true],
    ['wgw', 'Gouden oorbellen', '', "Women's Jewellery", 'Earrings', true],
    ['mgw', 'Heren overhemd slim fit', '', 'Clothing', 'Shirts', true],
    ['mgw', 'Heren sneakers wit', '', 'Shoes', 'Trainers', true],
    ['kgw', 'Meisjes jurk feest', '', 'Clothing', 'Dresses', true],
    ['kgw', 'Kinder rugzak dino', '', 'Accessories', 'Bags', true]
  ];
  for (const [site, name, gpc, cat, sub, doubt] of want) {
    const p = P(site, name, gpc);
    assert.deepEqual({ cat: p.cat, sub: p.sub, doubt: Boolean(p.doubt) }, { cat, sub, doubt }, `${site}: ${name} (${p.reject || ''})`);
  }
  // Left out, never a wrong category.
  for (const [site, name, why] of [
    ['agw', 'Motorhelm integraal', /not sure/], ['cgw', 'Muurverf wit 10 liter', /not sure/], ['hgw', 'Lego Star Wars set', /not a home product/],
    ['wgw', 'Heren overhemd slim fit', /men's or boys'/], ['mgw', 'Dames blouse', /women's or girls'/], ['kgw', 'Dames jurk', /adult product/],
    ['sgw', 'Proteïne shake chocolade 1 kg', /not sure/], ['zgw', 'Knuffel hond voor kinderen', /not sure/]
  ]) assert.match(P(site, name).reject || '', why, `${site}: ${name}`);
  // The perfume search: Women's, clearly men's perfume to Men's.
  assert.deepEqual(B.routeOf({ search: 'parfum', name: 'Dior Sauvage eau de toilette heren 100 ml' }).site, 'mgw');
  assert.deepEqual(B.routeOf({ search: 'parfum', name: 'Chanel Coco Mademoiselle eau de parfum 100 ml' }).site, 'wgw');
  assert.deepEqual(P('wgw', 'Chanel Coco Mademoiselle eau de parfum 100 ml', '', 'parfum'), { cat: 'Beauty & Fragrances', sub: 'Fragrance' });
  assert.deepEqual(P('mgw', 'Dior Sauvage eau de toilette heren 100 ml', '', 'parfum'), { cat: 'Grooming & Fragrances', sub: 'Fragrance' });
  assert.match(P('wgw', 'Parfumflesje leeg navulbaar', '', 'parfum').reject || '', /not a perfume/);
  assert.match(B.routeOf({ categoryId: '99999' }).reject, /no Gear World/);
  // The newer sites' planner gets a product only for its own site.
  assert.deepEqual(B.bolSection('AGW', 'Nextbase 322GW Dashcam - Maat L', { categoryId: '43646' }), { ok: true, slug: 'car-electronics', sub: 'Dash Cams', name: 'Nextbase 322GW Dashcam', doubt: true });
  assert.match(B.bolSection('VGW', 'Nextbase 322GW Dashcam', { categoryId: '43646' }).reason, /a product of AGW, not this site/);
});

// ---- The dry run of the 10 sites on synthetic feed files (the download's own rowOf) ----
const ean = body => { let s = 0; for (let i = 0; i < 12; i++) s += Number(body[11 - i]) * (i % 2 === 0 ? 3 : 1); return body + ((10 - (s % 10)) % 10); };
let seq = 100000;
function product(title, price, gpc = []) {
  const e = ean(`871${String(seq++).padStart(9, '0')}`);
  return { ean: e, bolProductId: `92${e.slice(-10)}`, title, url: `https://www.bol.com/nl/nl/p/x/${e}/`, image: { url: `https://media.s-bol.com/${e}.jpg` },
    offer: { price, strikethroughPrice: price * 2, deliveryDescription: 'Morgen in huis' }, rating: 4.2, gpc: gpc.map((name, i) => ({ level: i + 1, name })) };
}
function writeFeed(dir, file, categoryId, categoryName, items) {
  const rows = items.map(p => rowOf(p, { country: 'NL', categoryId, categoryName, stamp: '2026-11-22T06:00:00Z' }).row).filter(Boolean);
  writeFileSync(join(dir, file), gzipSync(csvLine(BOL_COLUMNS) + rows.map(r => csvLine(BOL_COLUMNS.map(c => r[c]))).join('')));
  return rows;
}
function archive() {
  const dir = mkdtempSync(join(tmpdir(), 'bol-archive-'));
  writeFeed(dir, 'BOL_43646_NL.csv.gz', '43646', 'Auto & Motor', [product('Nextbase 322GW Dashcam - Full HD', 129.99, ['Auto & Motor', 'Auto-elektronica', 'Dashcams']),
    product('Rubber automatten set universeel - 4 delig', 24.95), product('Motorhelm integraal - Maat L', 89), product('Luchtbuks kogels 4.5 mm', 9.99)]);
  writeFeed(dir, 'BOL_11764_NL.csv.gz', '11764', 'Koken & Tafelen', [product('Tefal koekenpan 28 cm', 34.99, ['Koken & Tafelen', 'Pannen', 'Koekenpannen'])]);
  writeFeed(dir, 'BOL_12001_NL.csv.gz', '12001', 'Huishouden', [product('Philips Airfryer XL HD9270 - 6,2 L', 149), product('Dyson V15 steelstofzuiger', 599)]);
  writeFeed(dir, 'BOL_15270_NL.csv.gz', '15270', 'Kamperen & Outdoor', [product('Coleman koepeltent 4 persoons', 119)]);
  writeFeed(dir, 'BOL_14648_NL.csv.gz', '14648', 'Sport', [product('Kettlebell 12 kg gietijzer', 39.95), product('Proteïne shake chocolade 1 kg', 29.95)]);
  writeFeed(dir, 'BOL_14035_NL.csv.gz', '14035', 'Wonen', [product('Sierkussen velours groen 45x45 cm', 19.99)]);
  writeFeed(dir, 'BOL_13155_NL.csv.gz', '13155', 'Klussen', [product('Bosch Professional GSR 12V-15 accuschroefboormachine - incl. 2 accu', 179), product('Muurverf wit 10 liter', 49)]);
  writeFeed(dir, 'BOL_12974_NL.csv.gz', '12974', 'Tuin', [product('Gardena tuinslang 20 m', 39.99)]);
  writeFeed(dir, 'BOL_12748_NL.csv.gz', '12748', 'Dieren', [product('Hondenmand orthopedisch - Maat L', 49.95), product('Hondenmand orthopedisch - Maat M', 39.95),
    product('Ontwormingsmiddel hond - op recept', 19.95)]);
  writeFeed(dir, 'BOL_46673_NL.csv.gz', '46673', 'Damesmode', [product('Zomerjurk dames bloemen - Maat 38', 39.99), product('Zomerjurk dames bloemen - Maat 40', 34.99),
    product('Zomerjurk dames bloemen - Maat 42', 39.99)]);
  writeFeed(dir, 'BOL_47024_NL.csv.gz', '47024', 'Herenmode', [product('Heren overhemd slim fit - Maat XL', 44.95)]);
  writeFeed(dir, 'BOL_16947_NL.csv.gz', '16947', 'Kindermode', [product('Meisjes jurk feest - Maat 116', 24.95), product('Carnavalskostuum piraat volwassenen', 29.95)]);
  writeFeed(dir, 'BOL_0_NL-parfum.csv.gz', '', 'search "parfum"', [product('Chanel Coco Mademoiselle eau de parfum 100 ml', 139), product('Dior Sauvage eau de toilette heren 100 ml', 99)]);
  writeFeed(dir, 'BOL_0_NL-werkschoenen.csv.gz', '', 'search "werkschoenen"', [product('Safety Jogger werkschoenen S3 - Maat 43', 79.95), product('Safety Jogger werkschoenen S3 - Maat 44', 74.95)]);
  return dir;
}

test('L204: the dry run of the 10 sites: counts per site and category, sizes joined, banned out, nothing else', async () => {
  const dir = archive();
  const out = join(mkdtempSync(join(tmpdir(), 'bol-plan-')), 'plan');
  assert.equal(bolFiles(dir).length, 14);
  const r = await planBol({ archive: dir, outDir: out, now: new Date('2026-11-22T07:00:00Z') });
  const n = Object.fromEntries(Object.entries(r.sites).map(([s, x]) => [s, x.products]));
  assert.deepEqual(n, { hgw: 4, cgw: 2, ggw: 1, wgw: 2, mgw: 2, kgw: 1, agw: 2, vgw: 1, sgw: 1, zgw: 1 });
  const text = r.text;
  assert.match(text, /== AGW: 2 προϊόντα/);
  assert.match(text, /car-electronics: 1 \| Dash Cams 1/);
  assert.match(text, /Clothing: 1 \| Dresses 1/);
  assert.match(text, /banned on every Gear World site \(ammunition or a weapon\)/);
  assert.match(text, /banned on every Gear World site \(pet prescription medicine\)/);
  assert.match(text, /banned on every Gear World site \(adult costume\)/);
  assert.match(text, /ΣΕ ΑΝΑΜΟΝΗ|σε αναμονή|ΣΥΝΟΛΟ: 17 προϊόντα/);
  assert.ok(!/ΛΕΙΠΟΥΝ/.test(text), 'every file of the list was found');
  // Older sites: the SQL that WOULD load them (never run here).
  const sql = s => readdirSync(join(out, 'older-sites', 'sql', s)).filter(f => f.endsWith('.sql')).map(f => read(join(out, 'older-sites', 'sql', s, f))).join('\n');
  const w = sql('wgw');
  assert.equal((w.match(/Zomerjurk dames bloemen/g) || []).length, 2, 'three sizes, one card (product_name and feed_product_name)');
  assert.match(w, /'bol\.com', 'Clothing', 'Dresses', NULL, 'Zomerjurk dames bloemen', 'Zomerjurk dames bloemen', 34\.99, 'EUR', 'in stock'/, 'no brand, the lowest price, EUR, in stock');
  assert.match(w, /'https:\/\/partner\.bol\.com\/click\/click\?p=2&t=url&s=1559450&f=TXL&url=/);
  assert.match(w, /'871\d{10}', 1, '2026-11-22 07:00:00', '2026-11-22 07:00:00'\)/, 'the EAN (13 digits) and the date as the refresh reads it');
  assert.match(sql('mgw'), /'Grooming & Fragrances', 'Fragrance', NULL, 'Dior Sauvage eau de toilette heren 100 ml'/);
  assert.match(sql('cgw'), /'Safety Boots', 'Safety Shoes', NULL, 'Safety Jogger werkschoenen S3'/);
  assert.equal((sql('cgw').match(/'Safety Jogger werkschoenen S3'/g) || []).length, 2, 'two sizes, one card');
  const plan = JSON.parse(read(join(out, 'older-sites', 'plan.json')));
  assert.match(plan.paused, /bol-remove\.ps1/, 'tools/legacy-import.ps1 stops on it');
  // The newer sites: brand and was price empty, gtin 13 digits, the date and in_stock as the refresh reads them.
  const agw = readdirSync(join(out, 'agw', 'sql')).filter(f => /^\d{4}\.sql$/.test(f)).map(f => read(join(out, 'agw', 'sql', f))).join('\n');
  assert.match(agw, /'bol\.com', 'car-electronics', 'Dash Cams', NULL, 'Nextbase 322GW Dashcam - Full HD'/);
  assert.match(agw, /129\.99, NULL, 'EUR', 1, 'new', 'https:\/\/media\.s-bol\.com\/\d+\.jpg', 'https:\/\/partner\.bol\.com\/click\/click\?/, 'no was price (bol.com gives a strikethrough price: never used)');
  assert.match(agw, /'871\d{10}', NULL, NULL, 1, '2026-11-22 07:00:00'\)/);
  const zgw = readdirSync(join(out, 'zgw', 'sql')).filter(f => /^\d{4}\.sql$/.test(f)).map(f => read(join(out, 'zgw', 'sql', f))).join('\n');
  assert.equal((zgw.match(/INSERT INTO products/g) || []).length, 1, 'two sizes of the dog bed, one card');
  assert.match(zgw, /'Hondenmand orthopedisch', 'hondenmand-orthopedisch'.*39\.95/);
  for (const s of ['agw', 'vgw', 'sgw', 'zgw']) assert.ok(read(join(out, s, 'report.txt')).length > 100, s);
});

test('L204: the normal import of a newer site never reads the bol.com file while it is paused', async () => {
  const dir = archive();
  const out = mkdtempSync(join(tmpdir(), 'agw-plan-'));
  const r = await planImport({ archive: dir, sourcesFile: 'sites/agw/sources.json', outDir: out, rules: AGW_RULES, label: 'AGW', only: ['43646'] });
  assert.equal(r.products.filter(p => p.retailer === 'bol.com').length, 0);
  assert.ok(!existsSync(join(out, 'sql', '0001.sql')) || !read(join(out, 'sql', '0001.sql')).includes('bol.com'));
});
