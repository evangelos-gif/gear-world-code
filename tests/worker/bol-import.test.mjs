// bol.com NL import plumbing (lessons L204): the routing (the one list of src/lib/bol-lists.js, L205), the banned lists, the
// places on the 10 sites, one card per size, no brand, no "was" price, and the dry run of all 10 sites at once
// (tools/bol-import-plan.mjs) on synthetic feed files written with the download's own row code. Nothing is imported here.
// Since 28 Nov 2026 (L243) the import is no longer paused: the older sites load a "bol-nl:<site>" pair through the bol.com
// gate, and the newer sites read their bol.com entry only when an import names it (-Only <id>, "onlyWhenNamed").
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

test('L243: the import goes: not paused in the rules of the older sites; AGW, VGW, SGW and ZGW read bol.com only when named', () => {
  assert.ok(!('paused' in RULES.RULES), 'the older sites: tools/legacy-import.ps1 loads it (after the bol.com gate)');
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
    assert.ok(!e.paused && /-Only <id>/.test(e.onlyWhenNamed) && e.approved && e.sections === 'bol-nl' && e.retailer === 'bol.com' && e.currency === 'EUR' && e.country === 'NL' && e.ignoreWasPrice, s);
    assert.deepEqual(bolSourcesOf(s).map(x => 'paused' in x || 'onlyWhenNamed' in x), [false], `${s}: the dry run reads it`);
  }
  for (const s of ['tgw', 'bgw', 'pgw', ...B.LEGACY_SITES]) {
    const src = JSON.parse(read(`sites/${s}/sources.json`)).sources;
    assert.ok(!src.some(x => x.network === 'bol' || x.retailer === 'bol.com'), `${s}: no bol.com source`);
  }
  // tools/legacy-import.ps1: a paused plan (any shop, L146) still changes nothing (before its restore point and its first write).
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
let STAMP = '2026-11-22T06:00:00.000Z';
function writeFeed(dir, file, categoryId, categoryName, items) {
  const rows = items.map(p => rowOf(p, { country: 'NL', categoryId, categoryName, stamp: STAMP }).row).filter(Boolean);
  writeFileSync(join(dir, file), gzipSync(csvLine(BOL_COLUMNS) + rows.map(r => csvLine(BOL_COLUMNS.map(c => r[c]))).join('')));
  return rows;
}
function archive(stamp = '2026-11-22T06:00:00.000Z') {
  STAMP = stamp;
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
  assert.match(w, /'871\d{10}', 1, '2026-11-22 07:00:00', '2026-11-22 06:00:00'\)/, 'the EAN (13 digits); updated_at = the DOWNLOAD time (06:00), not the plan (07:00)');
  assert.match(sql('mgw'), /'Grooming & Fragrances', 'Fragrance', NULL, 'Dior Sauvage eau de toilette heren 100 ml'/);
  assert.match(sql('cgw'), /'Safety Boots', 'Safety Shoes', NULL, 'Safety Jogger werkschoenen S3'/);
  assert.equal((sql('cgw').match(/'Safety Jogger werkschoenen S3'/g) || []).length, 2, 'two sizes, one card');
  const plan = JSON.parse(read(join(out, 'older-sites', 'plan.json')));
  assert.equal(plan.paused, undefined, 'L243: not paused: tools/legacy-import.ps1 loads it, after the bol.com gate');
  // The newer sites: brand and was price empty, gtin 13 digits, the date and in_stock as the refresh reads them.
  const agw = readdirSync(join(out, 'agw', 'sql')).filter(f => /^\d{4}\.sql$/.test(f)).map(f => read(join(out, 'agw', 'sql', f))).join('\n');
  assert.match(agw, /'bol\.com', 'car-electronics', 'Dash Cams', NULL, 'Nextbase 322GW Dashcam - Full HD'/);
  assert.match(agw, /129\.99, NULL, 'EUR', 1, 'new', 'https:\/\/media\.s-bol\.com\/\d+\.jpg', 'https:\/\/partner\.bol\.com\/click\/click\?/, 'no was price (bol.com gives a strikethrough price: never used)');
  assert.match(agw, /'871\d{10}', NULL, NULL, 1, '2026-11-22 06:00:00'\)/, 'last_seen_at = the download time');
  assert.ok(!/'2026-11-22 07:00:00'\)/.test(agw), 'never the time of the plan on a bol.com row');
  const zgw = readdirSync(join(out, 'zgw', 'sql')).filter(f => /^\d{4}\.sql$/.test(f)).map(f => read(join(out, 'zgw', 'sql', f))).join('\n');
  assert.equal((zgw.match(/INSERT INTO products/g) || []).length, 1, 'two sizes of the dog bed, one card');
  assert.match(zgw, /'Hondenmand orthopedisch', 'hondenmand-orthopedisch'.*39\.95/);
  for (const s of ['agw', 'vgw', 'sgw', 'zgw']) assert.ok(read(join(out, s, 'report.txt')).length > 100, s);
});

test('L243: a full import of a newer site never reads the bol.com file; an import that names it (-Only 43646) does', async () => {
  const dir = archive();
  const out = mkdtempSync(join(tmpdir(), 'agw-plan-'));
  // Days after the download (the real clock): a full import of AGW neither reads nor refuses the old bol.com file.
  const r = await planImport({ archive: dir, sourcesFile: 'sites/agw/sources.json', outDir: out, rules: AGW_RULES, label: 'AGW' });
  assert.equal(r.products.filter(p => p.retailer === 'bol.com').length, 0);
  assert.equal(r.stats.oldBolFiles.length, 0);
  assert.ok(!existsSync(join(out, 'bol.txt')), 'no bol.com in a full import: no gate needed');
  // Named, within 12 hours of the download: read, and marked for the gate (bol.txt).
  const named = mkdtempSync(join(tmpdir(), 'agw-named-'));
  const n = await planImport({ archive: dir, sourcesFile: 'sites/agw/sources.json', outDir: named, now: new Date('2026-11-22T07:00:00Z'), rules: AGW_RULES, label: 'AGW', only: ['43646'] });
  assert.ok(n.products.filter(p => p.retailer === 'bol.com').length > 0);
  assert.match(read(join(named, 'bol.txt')), /bol\.com sources in this plan: 43646\n/);
  // Named, 13 hours after the download: refused (run the download again first).
  await assert.rejects(planImport({ archive: dir, sourcesFile: 'sites/agw/sources.json', outDir: mkdtempSync(join(tmpdir(), 'agw-old-')), now: new Date('2026-11-22T19:00:01Z'), rules: AGW_RULES, label: 'AGW', only: ['43646'] }));
});

test('L204 (review of L205): the retailer is exactly "bol.com" in every SQL row, and no site has another spelling of it', async () => {
  const dir = archive();
  const out = join(mkdtempSync(join(tmpdir(), 'bol-plan-')), 'plan');
  await planBol({ archive: dir, outDir: out, now: new Date('2026-11-22T07:00:00Z') });
  const all = [];
  for (const s of B.LEGACY_SITES) for (const f of readdirSync(join(out, 'older-sites', 'sql', s)).filter(x => x.endsWith('.sql'))) all.push(read(join(out, 'older-sites', 'sql', s, f)));
  for (const s of B.NEW_SITES) for (const f of readdirSync(join(out, s, 'sql')).filter(x => /^\d{4}\.sql$/.test(x))) all.push(read(join(out, s, 'sql', f)));
  const sql = all.join('\n');
  const legacyRows = sql.match(/\('bol1559450:[^']+', '[^']*', '([^']+)'/g) || [];
  assert.ok(legacyRows.length >= 12);
  for (const r of legacyRows) assert.match(r, /, 'bol\.com'$/, r);
  const newRows = sql.match(/VALUES \('-4\d{11}:[^']+', -4\d{11}, '[^']*', '[^']+', '([^']+)'/g) || [];
  assert.ok(newRows.length >= 5);
  for (const r of newRows) assert.match(r, /, 'bol\.com'$/, r);
  assert.ok(!/'bol\.com NL'|'Bol\.com'|'BOL\.COM'|'bol'[,)]/.test(sql));
  // The shown name of the older sites (database.retailerNames) never turns a bol.com row into another name, or another
  // shop's row into bol.com.
  for (const s of readdirSync('sites').filter(x => existsSync(`sites/${x}/site.config.js`))) {
    const cfg = (await import(`../../sites/${s}/site.config.js`)).default;
    for (const [from, to] of Object.entries((cfg.database && cfg.database.retailerNames) || {})) assert.ok(!/bol/i.test(from) && !/bol/i.test(to), `${s}: ${from} -> ${to}`);
  }
  assert.equal(RULES.RULES.retailer, 'bol.com');
  for (const s of B.NEW_SITES) assert.equal(bolSourcesOf(s)[0].retailer, 'bol.com');
});

test('L204 (review of L205): the import refuses bol.com files older than 12 hours; the dry run plans them and says so', async () => {
  const { planLegacyImport } = await import('../../tools/legacy-import-plan.mjs');
  assert.equal(B.BOL_MAX_AGE_HOURS, 12);
  assert.equal(B.bolStamp('2026-11-22T06:00:00.000Z'), '2026-11-22 06:00:00');
  assert.equal(B.bolStamp('', Date.parse('2026-11-22T05:00:00Z')), '2026-11-22 05:00:00', 'no stamp in the row: the file time');
  assert.equal(B.bolTooOld('2026-11-22 06:00:00', new Date('2026-11-22T17:59:00Z')), false);
  assert.equal(B.bolTooOld('2026-11-22 06:00:00', new Date('2026-11-22T18:01:00Z')), true);
  assert.equal(B.bolTooOld('', new Date()), true, 'no date at all: refused');
  const dir = archive('2026-11-20T06:00:00.000Z');
  const now = new Date('2026-11-22T07:00:00Z');
  const msg = /Το αρχείο του bol\.com BOL_\S+\.csv\.gz είναι από 2026-11-20 06:00:00 UTC, παλιότερο από 12 ώρες: τρέξε πρώτα ξανά τη λήψη \(tools\/bol-feed-download\.ps1 -Step download\) και μετά την εισαγωγή\. Δεν φορτώθηκε τίποτα\./;
  await assert.rejects(planLegacyImport({ archive: dir, retailer: 'bol-nl', outDir: mkdtempSync(join(tmpdir(), 'old-l-')), now }), msg);
  const sf = join(mkdtempSync(join(tmpdir(), 'old-s-')), 'sources.json');
  writeFileSync(sf, JSON.stringify({ sources: bolSourcesOf('agw') }));
  await assert.rejects(planImport({ archive: dir, sourcesFile: sf, outDir: mkdtempSync(join(tmpdir(), 'old-n-')), now, rules: AGW_RULES, label: 'AGW' }), msg);
  // The same files, fresh: no refusal.
  await planImport({ archive: archive(), sourcesFile: sf, outDir: mkdtempSync(join(tmpdir(), 'new-n-')), now: new Date('2026-11-22T07:00:00Z'), rules: AGW_RULES, label: 'AGW' });
  // The dry run: planned, and every old file named with its download time.
  const r = await planBol({ archive: dir, outDir: join(mkdtempSync(join(tmpdir(), 'old-p-')), 'plan'), now });
  assert.equal(r.oldFiles.length, 14);
  assert.match(r.text, /ΠΡΟΒΛΗΜΑ: 14 αρχεία είναι παλιότερα από 12 ώρες\. Η εισαγωγή θα τα αρνιόταν: τρέξε πρώτα ξανά τη λήψη/);
  assert.match(r.text, /BOL_43646_NL\.csv\.gz: λήψη 2026-11-20 06:00:00 UTC/);
  assert.equal(r.sites.agw.products, 2);
  // tools/legacy-import.ps1 shows the planner's message (the plan fails before any change).
  assert.match(read('tools/legacy-import.ps1'), /Το σχέδιο απέτυχε: .*δες το μήνυμα πιο πάνω\)\. Δεν άλλαξε τίποτα\./);
});

test('L204 + L205 (re-review): no bol.com row is loaded while the refresh kill switch is off or not set up', async () => {
  // The shared gate: one read-only SELECT on gear-world-awin, and a Greek message for each refusal.
  const g = read('tools/lib/bol-guard.ps1');
  assert.ok(g.startsWith('﻿') && g.includes('\r\n'), 'UTF-8 with BOM, CRLF');
  assert.ok(g.includes("$script:BolGateDb = 'gear-world-awin'"));
  assert.ok(g.includes(`$script:BolGateSql = "SELECT value FROM bol_refresh_meta WHERE key = 'enabled'"`));
  assert.ok(!/--file|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b/.test(g), 'the gate only reads');
  assert.match(g, /if \(\$v -eq '1'\) \{ return 'on' \}/, 'only "1" opens the gate');
  assert.match(g, /no such table/, 'no table: the refresh was never set up');
  assert.match(g, /tools\/bol-refresh-setup\.ps1 -Step apply/, 'not set up: the refresh setup step first');
  assert.match(g, /-Step enable/);
  assert.match(g, /ΜΗΝ τον ανοίξεις/, 'switched off by the removal tool: never on again for an import');
  // The older sites: tools/legacy-import.ps1 reads it with -Apply, before the paused stop, the restore point and any write.
  const li = read('tools/legacy-import.ps1');
  assert.ok(li.includes(". (Join-Path (Join-Path (Join-Path $repo 'tools') 'lib') 'bol-guard.ps1')"));
  const iGate = li.indexOf("if ($Apply -and ($RetailerName -eq 'bol.com' -or $Retailer -like 'bol-*')) {");
  assert.ok(iGate > 0 && li.indexOf('if (-not (Test-BolImportGate $WorkDir -OldestDownload $bolOldest -BolRows ([int]$sp.products))) { Finish 16 }', iGate) > iGate);
  // Re-review of 51a8b88: bol.com products and no download time (an older plan): refused, never loaded unchecked.
  assert.ok(g.includes("if (-not $OldestDownload -and $BolRows -ne 0) {") && g.includes('[int]$BolRows = -1'));
  assert.match(g, /δεν λέει πότε κατέβηκαν τα αρχεία τους/);
  assert.ok(li.indexOf("$bolOldest = [string]$plan.oldestFeedStamp") > iGate, 'the plan\'s oldest download time, checked again when it loads');
  // Review of 6954a135: a successful refresh run in the last 2 hours, the 12 hours again at load time, Price Watch reminded.
  assert.ok(g.includes(`$q = "SELECT COUNT(*) AS n FROM bol_refresh_runs WHERE ok = 1 AND ran_at BETWEEN '{0}' AND '9999'" -f $cut`));
  assert.ok(g.includes('$script:BolGateRunHours = 2') && g.includes('$script:BolGateMaxAgeHours = 12'));
  assert.match(g, /δεν έχει τρέξει ακόμα με επιτυχία/);
  assert.match(g, /παλιότερα από \{1\} ώρες τώρα που φορτώνονται/);
  assert.match(g, /ΥΠΕΝΘΥΜΙΣΗ: το Price Watch \(gear-world-prices\)/);
  assert.ok(iGate < li.indexOf("-contains 'paused') -and $plan.paused") && iGate < li.indexOf('time-travel info') && iGate < li.indexOf('--remote --file'));
  // The newer sites: the planner marks a plan that reads bol.com (bol.txt) ...
  const dir = archive();
  const now = new Date('2026-11-22T07:00:00Z');
  const sf = join(mkdtempSync(join(tmpdir(), 'gate-s-')), 'sources.json');
  writeFileSync(sf, JSON.stringify({ sources: bolSourcesOf('agw') }));
  const on = mkdtempSync(join(tmpdir(), 'gate-on-'));
  await planImport({ archive: dir, sourcesFile: sf, outDir: on, now, rules: AGW_RULES, label: 'AGW' });
  assert.match(read(join(on, 'bol.txt')), /bol\.com sources in this plan: 43646\nbol\.com products: 2\n/);
  const full = mkdtempSync(join(tmpdir(), 'gate-off-'));
  await planImport({ archive: dir, sourcesFile: 'sites/agw/sources.json', outDir: full, now, rules: AGW_RULES, label: 'AGW' });
  assert.ok(!existsSync(join(full, 'bol.txt')), 'onlyWhenNamed (L243): a full import does not read it, no gate needed');
  // ... and the import step of each site tool reads the switch then, before the approval, the restore point and the SQL.
  for (const s of ['tgw', 'agw', 'vgw', 'sgw', 'zgw', 'bgw', 'pgw']) {
    const t = read(`tools/${s}-cloudflare.ps1`);
    assert.ok(t.includes(". (Join-Path (Join-Path (Join-Path $repo 'tools') 'lib') 'bol-guard.ps1')"), s);
    const iA = t.indexOf('Confirm-Approval $Phrases.import');
    const iT = t.indexOf(`Invoke-Wrangler $${s} ('d1 time-travel info {0}' -f $DbName) -NonInteractive -Retry`, iA);
    const iG = t.indexOf(`if (-not (Test-BolImportGate $${s} -NonInteractive -OldestDownload (Get-BolPlanStamp $planDir) -BolRows (Get-BolPlanCount $planDir))) { Finish 16 }`);
    const iF = t.indexOf('if (Test-Path -LiteralPath (Join-Path $planDir $script:BolGatePlanFile)) {');
    assert.ok(iF > 0 && iF < iG && iG < iA && iA < iT, `${s}: the gate before the approval and the restore point`);
    assert.ok(t.lastIndexOf("if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }", iG) > t.lastIndexOf("'import' {", iG), `${s}: the dry run never needs it`);
  }
  assert.match(read('tools/tgw-import-plan.mjs'), /writeFileSync\(join\(outDir, 'bol\.txt'\)/);
  assert.match(read('tools/lib/bol-guard.ps1'), /\$script:BolGatePlanFile = 'bol\.txt'/);
});

test('L204 (first real download, 20 Nov 2026): the name places it, gendered clothing by its words, sizes joined, more left out', async () => {
  // Sizes without "maat" in letters; numbers never ("Kraan 1/2" is a product).
  for (const [a, b] of Object.entries({ 'Thermo Panty L/XL': 'Thermo Panty', 'FALKE Huissokken baby roze - maat 80-92': 'FALKE Huissokken baby roze',
    'Meisjes legging - Maat 140/146': 'Meisjes legging', 'Dames jurk - 48': 'Dames jurk', 'Kraan 1/2': 'Kraan 1/2' })) assert.equal(B.bolBaseName(a), b, a);
  // Veterinary diets, knives: out on every site; kitchen knives and a DIY utility knife are fine.
  for (const n of ['Royal Canin S/O Moderate Calorie kattenvoer 1,5 kg', 'Royal Canin Veterinary Diet Renal hond', 'Hill\'s Urinary Care kattenbrokken',
    'Hypoallergenic hondenvoer zalm 12 kg', 'Victorinox zakmes Spartan', 'Opinel vouwmes no. 8', 'Survival mes met schede', 'Machete 45 cm'])
    assert.match(B.bannedReason(n), /^banned on every Gear World site \((pet prescription medicine|knife)\)/, n);
  for (const n of ['Koksmes 20 cm', 'Messenblok met 6 messen', 'Stanley afbreekmes 18 mm', 'Hypoallergene hondenshampoo']) assert.equal(B.bannedReason(n), '', n);
  const at = (categoryId, name, search = '') => { const p = B.bolPlace({ categoryId, search, name, rawName: name }); return p.reject ? `out: ${p.reject}` : `${p.site} ${p.cat} / ${p.sub}`; };
  const want = [
    // merchant_category is only the top category: every part of the name, and brands that look like a product word do not count.
    ['46673', 'Skechers KEEPSAKES COZY - COZY MINI Dames Instappers - Taupe', 'wgw Shoes / Shoes'],
    ['47024', 'JACK&JONES ESSENTIALS - JJEBRADLEY SWEAT CREW NOOS Heren Trui', 'mgw Clothing / Knitwear'],
    // Gendered clothing of other categories goes to the fashion site its words say (the category's own site first).
    ['15270', 'Jack Wolfskin Heren Softshell Jas - Zwart', 'mgw Clothing / Jackets & Coats'],
    ['14648', 'Dames winterjas gewatteerd - Maat M', 'wgw Clothing / Jackets & Coats'],
    ['14648', 'Legging - Maat 140/146', 'kgw Clothing / Trousers'],
    ['14648', 'Heren hardloopschoenen Pegasus - Maat 44', 'sgw running / Running'],
    ['46673', 'FALKE Huissokken baby roze - maat 74-80', 'kgw Clothing / Socks'],
    ['46673', 'Heren overhemd slim fit - Maat L', 'mgw Clothing / Shirts'],
    ['47024', 'Dames trui babyblauw', 'wgw Clothing / Knitwear'],
    ['47024', 'Thermo Panty L/XL', 'mgw Clothing / Socks'],
    ['15270', 'Softshell jas unisex', 'out: not sure where it goes on the site (left out)'],
    // Tuin: no party items. Klussen: what is not DIY stays out, home products go to Home Gear World.
    ['12974', 'Feest lampion rood 10 stuks', 'out: a party item (not a garden product)'],
    ['12974', 'Feestartikelen verjaardag set', 'out: a party item (not a garden product)'],
    ['13155', 'Badmat antislip 60x90 cm', 'hgw Bedding & Bath / Bath Mat'],
    ['13155', 'Verpakkingstape transparant 6 rollen', 'out: not a DIY tool or hardware (Klussen)'],
    ['13155', 'Anker SOLIX Solarbank 2 E1600 Pro thuisbatterij 7 kWh', 'out: a home battery or energy storage (not a DIY tool)'],
    ['13155', 'Bosch Professional GSR 12V-15 accuschroefboormachine - incl. 2 accu', 'cgw Power Tools / Drills & Drivers'],
    ['12748', 'Royal Canin S/O Moderate Calorie kattenvoer', 'out: banned on every Gear World site (pet prescription medicine)']
  ];
  for (const [c, n, w] of want) assert.equal(at(c, n), w, n);
  // The perfume search: Herenparfum / for Men -> Men's, Damesparfum / for Women -> Women's.
  for (const [n, s] of [['Hugo Boss Bottled Herenparfum 100 ml', 'mgw'], ['Azzaro Wanted for Men eau de toilette', 'mgw'], ['Paco Rabanne Olympea Damesparfum', 'wgw'],
    ['Lancôme Idôle for Women eau de parfum', 'wgw'], ['Calvin Klein CK One unisex eau de toilette', 'wgw']]) assert.equal(B.bolPlace({ search: 'parfum', name: n }).site, s, n);
  // The older sites' plan reads every category's file, so a men's jacket of Kamperen & Outdoor reaches Men's; the same name
  // in four sizes (four EANs) is one card at the lowest price.
  const dir = mkdtempSync(join(tmpdir(), 'bol-real-'));
  STAMP = '2026-11-22T06:00:00.000Z';
  writeFeed(dir, 'BOL_46673_NL.csv.gz', '46673', 'Damesmode', [39.99, 34.99, 36.5, 41].map(pr => product('Skechers KEEPSAKES COZY - COZY MINI Dames Instappers - Taupe', pr)));
  writeFeed(dir, 'BOL_47024_NL.csv.gz', '47024', 'Herenmode', [49.99, 44.99, 47, 49.99].map(pr => product('JACK&JONES ESSENTIALS - JJEBRADLEY SWEAT CREW NOOS Heren Trui', pr)));
  writeFeed(dir, 'BOL_15270_NL.csv.gz', '15270', 'Kamperen & Outdoor', [product('Jack Wolfskin Heren Softshell Jas - Zwart', 99), product('Coleman koepeltent 4 persoons', 119)]);
  writeFeed(dir, 'BOL_12974_NL.csv.gz', '12974', 'Tuin', [product('Feest lampion rood 10 stuks', 9.99), product('Gardena tuinslang 20 m', 39.99)]);
  const { planLegacyImport } = await import('../../tools/legacy-import-plan.mjs');
  const r = await planLegacyImport({ archive: dir, retailer: 'bol-nl', outDir: mkdtempSync(join(tmpdir(), 'bol-real-p-')), now: new Date('2026-11-22T07:00:00Z') });
  const names = s => r.accepted[s].map(p => `${p.product_name} ${p.price}`);
  assert.deepEqual(names('wgw'), ['Skechers KEEPSAKES COZY - COZY MINI Dames Instappers - Taupe 34.99']);
  assert.deepEqual(names('mgw').sort(), ['JACK&JONES ESSENTIALS - JJEBRADLEY SWEAT CREW NOOS Heren Trui 44.99', 'Jack Wolfskin Heren Softshell Jas - Zwart 99']);
  assert.deepEqual(names('ggw'), ['Gardena tuinslang 20 m 39.99']);
  assert.ok(Object.keys(r.rejected).some(k => /a product of VGW \(planned by that site's own import\)/.test(k)), 'the tent is left to VGW');
});

test('L204 (review of 6954a135): end to end on the AGW schema: the plan loads its bol.com rows and its finish step keeps them', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { networkShopId } = await import('../../tools/tgw-import-plan.mjs');
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync('sites/agw/migrations').sort()) db.exec(read(`sites/agw/migrations/${f}`));
  const shop = networkShopId('bol', 43646, 'NL');
  const ins = db.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, product_name, product_slug, price, image_url, affiliate_url, last_seen_at)
    VALUES (?, ?, ?, ?, 'interior-comfort', ?, ?, 9, 'https://i/x.jpg', ?, ?)`);
  // A bol.com row of an earlier import that is no longer in the files (last seen two days ago), and another shop's row.
  ins.run(`${shop}:8710000000001`, shop, '8710000000001', 'bol.com', 'Oude automat', 'oude-automat', 'https://partner.bol.com/click/click?x=1', '2026-11-20 06:00:00');
  ins.run('496:A', 496, 'A', 'Tooled Up', 'Car mat set', 'car-mat-set', 'https://www.awin1.com/x', '2026-11-20 06:00:00');
  const sf = join(mkdtempSync(join(tmpdir(), 'e2e-s-')), 'sources.json');
  writeFileSync(sf, JSON.stringify({ sources: bolSourcesOf('agw') }));
  const out = mkdtempSync(join(tmpdir(), 'e2e-p-'));
  const r = await planImport({ archive: archive(), sourcesFile: sf, outDir: out, now: new Date('2026-11-22T07:00:00Z'), rules: AGW_RULES, label: 'AGW' });
  assert.equal(r.products.length, 2);
  const finish = read(join(out, 'sql', '9999-finish.sql'));
  assert.match(finish, new RegExp(`WHERE awin_advertiser_id IN \\(${shop}\\) AND is_active = 1 AND last_seen_at < '2026-11-22 06:00:00';`), 'bol.com: the oldest download of the plan, not the plan time');
  for (const f of readdirSync(join(out, 'sql')).sort()) db.exec(read(join(out, 'sql', f)));
  const active = db.prepare("SELECT product_name, last_seen_at FROM products WHERE retailer = 'bol.com' AND is_active = 1 ORDER BY product_name").all().map(x => `${x.product_name} ${x.last_seen_at}`);
  assert.deepEqual(active, ['Nextbase 322GW Dashcam - Full HD 2026-11-22 06:00:00', 'Rubber automatten set universeel - 4 delig 2026-11-22 06:00:00'], 'the rows just loaded stay active');
  assert.equal(db.prepare("SELECT is_active FROM products WHERE stable_key = ?").get(`${shop}:8710000000001`).is_active, 0, 'the row no longer in the files is hidden');
  assert.equal(db.prepare("SELECT is_active FROM products WHERE stable_key = '496:A'").get().is_active, 1, 'another shop is not touched');
  assert.match(read(join(out, 'bol.txt')), /bol\.com oldest download \(UTC\): 2026-11-22 06:00:00\n/);
});

test('L204 (review of 6954a135): a bare number is a size only for clothing and shoes; one card keeps the cheapest size\'s own link and EAN', async () => {
  for (const [a, b] of Object.entries({ 'Nextbase Dashcam - 322': 'Nextbase Dashcam - 322', 'Samsung Galaxy Tab A9 - 64/128': 'Samsung Galaxy Tab A9 - 64/128',
    'Duracell AA, 12/24': 'Duracell AA, 12/24', 'Kraan 1/2': 'Kraan 1/2', 'Dames pumps - 39': 'Dames pumps', 'Heren jeans slim, 32/34': 'Heren jeans slim',
    'Hardloopschoenen Pegasus - 44': 'Hardloopschoenen Pegasus', 'Hondenjas - 40 cm': 'Hondenjas', 'Rubber automat - Maat L': 'Rubber automat',
    // Re-review of 51a8b88: a number with its unit or "maat" is a size only for clothing and shoes; pans and umbrellas differ.
    'Tefal koekenpan - 24 cm': 'Tefal koekenpan - 24 cm', 'Samsonite koffer - 55 cm': 'Samsonite koffer - 55 cm', 'Knielkussen - maat 42': 'Knielkussen - maat 42',
    'Hondenmand orthopedisch - Maat L': 'Hondenmand orthopedisch', 'Zwarte paraplu - 120 cm': 'Zwarte paraplu - 120 cm' })) assert.equal(B.bolBaseName(a), b, a);
  assert.equal(B.bolBaseName('Paraplu stormvast - 100 cm', true), 'Paraplu stormvast - 100 cm', 'an umbrella of a fashion category: its length stays');
  assert.equal(B.bolBaseName('Dames handtas - 30 cm', true), 'Dames handtas - 30 cm');
  assert.equal(B.bolBaseName('Zomerjurk - 40', true), 'Zomerjurk');
  assert.notEqual(B.bolBaseName('Tefal koekenpan - 24 cm'), B.bolBaseName('Tefal koekenpan - 28 cm'), 'two pans, two cards');
  assert.equal(B.bolBaseName('COZY MINI - 38', true), 'COZY MINI', 'a fashion category: the bare number is a size');
  assert.equal(B.bolBaseName('COZY MINI - 38', false), 'COZY MINI - 38');
  assert.equal(RULES.field('product_name', c => ({ product_name: 'Skechers COZY MINI - 38', bol_category_id: '46673' })[c] || ''), 'Skechers COZY MINI');
  assert.equal(RULES.field('product_name', c => ({ product_name: 'Nextbase Dashcam - 322', bol_category_id: '43646' })[c] || ''), 'Nextbase Dashcam - 322');
  // Three sizes, three EANs: the card is the cheapest size with ITS link and EAN (the daily refresh finds a row by its EAN).
  const dir = mkdtempSync(join(tmpdir(), 'bol-cheap-'));
  STAMP = '2026-11-22T06:00:00.000Z';
  const rows = writeFeed(dir, 'BOL_46673_NL.csv.gz', '46673', 'Damesmode', [product('Zomerjurk dames bloemen - Maat 38', 39.99), product('Zomerjurk dames bloemen - Maat 40', 34.99),
    product('Zomerjurk dames bloemen - Maat 42', 41.5)]);
  const { planLegacyImport } = await import('../../tools/legacy-import-plan.mjs');
  const r = await planLegacyImport({ archive: dir, retailer: 'bol-nl', outDir: mkdtempSync(join(tmpdir(), 'bol-cheap-p-')), now: new Date('2026-11-22T07:00:00Z') });
  assert.equal(r.accepted.wgw.length, 1);
  const card = r.accepted.wgw[0];
  const cheap = rows[1];
  assert.equal(card.price, 34.99);
  assert.equal(card.ean, B.bolEan(cheap.ean), 'the EAN of the 34.99 size');
  assert.equal(card.affiliate_url, cheap.aw_deep_link, 'the link of the 34.99 size');
  assert.equal(card.awin_product_id, `bol1559450:${B.bolEan(cheap.ean)}`, 'the key of the 34.99 size');
  assert.ok(Object.keys(r.rejected).some(k => /another size at a higher price/.test(k)));
});
