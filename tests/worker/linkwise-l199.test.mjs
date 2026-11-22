// Linkwise, the Greek affiliate network (owner, 19 Nov 2026: "Linkwise in tonight's command so the Greek shop opens
// today", lessons L199): the feed tool, the tracking links, the Greek rules of the older sites, and that every Linkwise
// shop is seen only in Greece and/or Cyprus with Greek names, within the D1 limit of 100 values per query (L193).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { NETWORKS, isLinkwiseLink, networkOf, pageInLink } from '../../tools/network-links.mjs';
import { linkwiseFeedUrl, isAffiliateCode, euroPrice, categoryPath, toAwinRow, convertLinkwise, downloadProgramme, shopPage, LINKWISE_COLUMNS } from '../../tools/linkwise-feed.mjs';
import { feedPaths, planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import * as LW from '../../tools/import-rules/lib/linkwise.mjs';
import { PROGRAMMES } from '../../tools/import-rules/lib/linkwise-programmes.mjs';
import { viewFor, countryGroups } from '../../src/lib/visibility.js';
import { Readable } from 'node:stream';

// A made-up affiliate code: the real one never goes into the repository (it is kept encrypted on the owner's PC).
const CODE = ['CD', '0001234'].join('');
const LINK = page => `https://go.linkwi.se/z/11532-0/${CODE}/?lnkurl=${encodeURIComponent(page)}`;
const NOW = Date.parse('2026-11-19T12:00:00Z');
const config = {};
for (const s of LW.LEGACY_SITES) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
// Is a retailer's product shown to a visitor from a country (its view: only these, or all but these)?
const seen = (site, cc, name) => { const v = viewFor(site, cc, NOW); return v.only ? v.only.includes(name) : !(v.hidden || []).includes(name); };
const MODULES = readdirSync('tools/import-rules').filter(f => /^lw-\d+\.mjs$/.test(f)).map(f => Number(f.slice(3, -4))).sort((a, b) => a - b);

test('L199: Linkwise is a network: LINKWISE_<programme>.csv.gz, ids lw..., and only a go.linkwi.se click with our code pays', () => {
  assert.deepEqual(NETWORKS.linkwise, { label: 'Linkwise', file: 'LINKWISE', idPrefix: 'lw', isLink: isLinkwiseLink });
  assert.equal(isLinkwiseLink(LINK('https://www.24home.gr/x')), true);
  assert.equal(isLinkwiseLink(LINK('https://www.24home.gr/x'), CODE), true);
  assert.equal(isLinkwiseLink(LINK('https://www.24home.gr/x'), ['CD', '9999'].join('')), false, 'another affiliate code');
  assert.equal(isLinkwiseLink('http://go.linkwi.se/z/11532-0/' + CODE + '/?lnkurl=https%3A%2F%2Fa.gr%2F'), false, 'https only');
  assert.equal(isLinkwiseLink('https://go.linkwi.se/z/11532-0/' + CODE + '/'), false, 'no shop page');
  assert.equal(isLinkwiseLink('https://evil.example/z/11532-0/' + CODE + '/?lnkurl=https%3A%2F%2Fa.gr%2F'), false);
  assert.equal(pageInLink(LINK('https://www.24home.gr/x?a=1')), 'https://www.24home.gr/x?a=1');
  assert.equal(networkOf({ RULES: { network: 'linkwise' } }).file, 'LINKWISE');
  const dir = mkdtempSync(join(tmpdir(), 'lw-'));
  for (const f of ['LINKWISE_11532.csv.gz', 'LINKWISE_115320.csv.gz', 'DAISYCON_11532.csv.gz']) writeFileSync(join(dir, f), '');
  assert.deepEqual(feedPaths({ archive: dir, rules: { RULES: { network: 'linkwise', advertiserId: 11532 } } }).map(f => f.slice(dir.length + 1)), ['LINKWISE_11532.csv.gz']);
});

test('L199: the feed address, prices with a comma, the category path, and one Linkwise row in the Awin column names', () => {
  assert.equal(isAffiliateCode(CODE), true);
  assert.equal(isAffiliateCode('CDx1'), false);
  assert.throws(() => linkwiseFeedUrl('nope', 11532));
  assert.throws(() => linkwiseFeedUrl(CODE, '11532/../x'));
  assert.equal(linkwiseFeedUrl(CODE, 11532),
    `https://affiliate.linkwi.se/feeds/1.2/${CODE}/programs-joined/columns-${LINKWISE_COLUMNS.join(',')}/catinc-0/catex-0/proginc-11532/progex-0/feed.csv`);
  assert.deepEqual(['19,00', '1.299,00', '1299.5', '1.299', '', 'abc', '0,00'].map(euroPrice), ['19.00', '1299.00', '1299.50', '1299.00', '', '', '']);
  assert.equal(categoryPath('ΔΙΑΚΟΣΜΗΣΗ&gt;Σαλόνι &gt; Βάζα'), 'ΔΙΑΚΟΣΜΗΣΗ > Σαλόνι > Βάζα');
  const rec = { product_id: '77', sku: 'S-77', product_name: 'Βάζο  κεραμικό', category: 'Διακόσμηση&gt;Βάζα', brand_name: 'Aithrio',
    tracking_url: LINK('https://www.aithrio.gr/vazo-77'), image_url: 'https://img.aithrio.gr/77.jpg', in_stock: 'Y', price: '24,90', full_price: '29,90',
    program_name: 'Aithrio', currency: '', gtin: '5200000000017', availability: 'Άμεσα διαθέσιμο' };
  const row = toAwinRow(k => rec[k] || '', 12125);
  assert.equal(row.aw_product_id, 'lw12125-77');
  assert.equal(row.aw_deep_link, rec.tracking_url);
  assert.equal(row.merchant_deep_link, 'https://www.aithrio.gr/vazo-77');
  assert.equal(shopPage(rec.tracking_url), 'https://www.aithrio.gr/vazo-77');
  assert.deepEqual([row.search_price, row.rrp_price, row.currency, row.in_stock, row.merchant_category], ['24.90', '29.90', 'EUR', '1', 'Διακόσμηση > Βάζα']);
  assert.equal(toAwinRow(k => ({ ...rec, in_stock: 'N', full_price: '24,90' })[k] || '', 12125).in_stock, '0');
  assert.equal(toAwinRow(k => ({ ...rec, full_price: '24,90' })[k] || '', 12125).rrp_price, '', 'no RRP when it is not higher');
});

const csv = rows => [LINKWISE_COLUMNS.join(','), ...rows.map(r => LINKWISE_COLUMNS.map(c => `"${String(r[c] || '').replace(/"/g, '""')}"`).join(','))].join('\n') + '\n';
const sample = (i, extra = {}) => ({ product_id: String(i), product_name: `Φόρεμα μίντι ${i}`, category: 'Γυναικεία&gt;Φορέματα', tracking_url: LINK(`https://www.shop.gr/p/${i}`),
  image_url: `https://img.shop.gr/${i}.jpg`, in_stock: 'Y', price: '39,90', program_name: 'Shop', ...extra });

test('L199: the download writes LINKWISE_<id>.csv.gz, keeps the old copy in _old, and never takes a much smaller answer', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lwdl-'));
  let body = csv(Array.from({ length: 150 }, (_, i) => sample(i + 1)));
  let asked = '';
  const fetchImpl = async u => { asked = u; return new Response(body, { status: 200 }); };
  const first = await downloadProgramme({ code: CODE, programId: 11532, archive: dir, stamp: 'A', fetchImpl });
  assert.deepEqual(first, { programId: 11532, ok: true, rows: 150 });
  assert.ok(asked.includes('/proginc-11532/'));
  const text = gunzipSync(readFileSync(join(dir, 'LINKWISE_11532.csv.gz'))).toString('utf8');
  assert.ok(text.startsWith('"data_feed_id"') || text.startsWith('data_feed_id'), 'Awin column names');
  assert.ok(text.includes('lw11532-1') && text.includes('39.90'));
  body = csv(Array.from({ length: 40 }, (_, i) => sample(i + 1)));
  const small = await downloadProgramme({ code: CODE, programId: 11532, archive: dir, stamp: 'B', fetchImpl });
  assert.equal(small.ok, false);
  assert.match(small.why, /kept the old copy/);
  assert.equal(existsSync(join(dir, '_old', 'B')), false);
  body = csv(Array.from({ length: 160 }, (_, i) => sample(i + 1)));
  assert.equal((await downloadProgramme({ code: CODE, programId: 11532, archive: dir, stamp: 'C', fetchImpl })).ok, true);
  assert.equal(existsSync(join(dir, '_old', 'C', 'LINKWISE_11532.csv.gz')), true, 'old copy moved first');
  body = 'not,a,feed\n1,2,3\n';
  assert.equal((await downloadProgramme({ code: CODE, programId: 11533, archive: dir, stamp: 'D', fetchImpl })).ok, false);
  assert.equal((await downloadProgramme({ code: CODE, programId: 11534, archive: dir, stamp: 'D', fetchImpl: async () => new Response('', { status: 403 }) })).why, 'HTTP 403');
  const conv = await convertLinkwise(Readable.from([csv([sample(1), sample(2, { tracking_url: '' })])]), 5, join(dir, 'x.csv.gz'));
  assert.equal(conv.rows, 1, 'a row without a tracking link is left out');
});

test('L199: the command line needs the code in GW_LW_CODE and never prints it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lwcli-'));
  const run = env => { try { return execFileSync(process.execPath, ['tools/linkwise-feed.mjs', 'download', '--archive', dir, '--programs', '11532'], { env: { ...process.env, ...env }, encoding: 'utf8' }); } catch (e) { return String(e.stdout || ''); } };
  assert.match(run({ GW_LW_CODE: '' }), /ERROR no Linkwise affiliate code/);
  assert.match(run({ GW_LW_CODE: 'nope' }), /ERROR no Linkwise affiliate code/);
});

test('L199: Greek names and categories go to the subcategories the older sites already have', () => {
  const c = sites => LW.classifierFor(sites);
  const w = c('wgw'), m = c('mgw'), k = c('kgw'), h = c('hgw'), g = c('ggw');
  const is = (r, site, cat, sub) => assert.deepEqual([r.site, r.siteCategory, r.subcategory], [site, cat, sub], JSON.stringify(r));
  is(w({ name: 'Γυναικείο Φόρεμα Μίντι Σατέν' }), 'wgw', 'Clothing', 'Dresses');
  is(w({ name: 'Μπότες Pikolinos SAN SEBASTIA', feedCategory: 'Γυναίκα > Παπούτσια' }), 'wgw', 'Shoes', 'Boots');
  is(w({ name: 'Σανδάλια με τακούνι Migato' }), 'wgw', 'Shoes', 'Heels');
  is(w({ name: 'Κολιέ ασημένιο με σταυρό' }), 'wgw', "Women's Jewellery", 'Necklaces');
  is(w({ name: 'Τσάντα χιαστί δερμάτινη' }), 'wgw', 'Bags & Accessories', 'Bags');
  is(w({ name: 'Rochas Madame Rochas Eau de Toilette για γυναίκες 100 ml', feedCategory: 'Health & Beauty > Personal Care' }), 'wgw', 'Beauty & Fragrances', 'Fragrance');
  is(w({ name: 'Bourjois Volume Glamour αδιάβροχη μάσκαρα', feedCategory: 'Health & Beauty > Personal Care' }), 'wgw', 'Beauty & Fragrances', 'Make-up');
  is(w({ name: 'Clinique Lash Power Mascara Long-Wearing Formula', feedCategory: 'Health & Beauty' }), 'wgw', 'Beauty & Fragrances', 'Make-up');
  is(w({ name: 'Babaria Aloe Vera σαπούνι με αλόη βέρα 500 ml', feedCategory: 'Health & Beauty' }), 'wgw', 'Beauty & Fragrances', 'Bath & body');
  is(w({ name: 'Κρέμα προσώπου με Βιταμίνη C', feedCategory: 'Καλλυντικά' }), 'wgw', 'Beauty & Fragrances', 'Skincare');
  assert.match(w({ name: 'Armani Acqua di Giò βάλσαμο για μετά το ξύρισμα για άντρες' }).reject, /men's product/);
  assert.match(w({ name: 'Φόρεμα για κορίτσι', feedCategory: 'ΠΑΙΔΙ > ΚΟΡΙΤΣΙ' }).reject, /children's product/);
  is(m({ name: 'LACOSTE ΜΠΟΥΦΑΝ PARKAS & BLOUSONS 3BJ3543-031 Black', feedCategory: 'ΑΝΔΡΑΣ > ΡΟΥΧΑ' }), 'mgw', 'Clothing', 'Jackets');
  is(m({ name: 'GANT ΦΟΥΤΕΡ ΜΜ ARCHIVE SHIELD CREW NECK SWEATSHIRT', feedCategory: 'ΑΝΔΡΑΣ > ΡΟΥΧΑ' }), 'mgw', 'Clothing', 'Sweatshirts');
  is(k({ name: 'Πάνες Babylino Pants Cotton Soft Unisex No8 26τεμ' }), 'kgw', 'Baby & Toddler', 'Nappies');
  is(k({ name: 'UNISEX ΠΑΙΔΙΚΗ ΚΟΥΝΙΣΤΗ ΛΟΥΤΡΙΝΗ ΚΑΜΗΛΟΠΑΡΔΑΛΗ' }), 'kgw', 'Toys & Games', 'Stuffed Animals & Cuddly Toys');
  is(k({ name: 'Βαμβακερή μπλούζα μακό, αγόρι - ΣΟΚΟΛΑΤΙ' }), 'kgw', 'Clothing', 'Clothing');
  is(k({ name: 'Playgo Καλάθι Με Τρόφιμα (3752)', feedCategory: 'Παιχνίδια Ρόλων-Μίμησης' }), 'kgw', 'Toys & Games', 'Toys & Games');
  is(k({ name: 'Παιδικό όπλο νερού Splash' }), 'kgw', 'Toys & Games', 'Toy Weapons & Gadgets');
  is(h({ name: 'vidaXL Σκελετός Κρεβατιού Χωρίς Στρώμα 140x200 εκ Μασίφ Ξύλο' }), 'hgw', 'Furniture', 'Bed Frame');
  is(h({ name: 'vidaXL Ντουλάπι TV με συρτάρι Μαύρη Οξυά 100 x 34,5 x 44,5 εκ.' }), 'hgw', 'Furniture', 'TV Unit');
  is(h({ name: 'Μαξιλάρι Διακοσμητικό (Με Γέμιση) Βελουτέ 230 Black Viopros' }), 'hgw', 'Home Decor', 'Cushion');
  is(h({ name: 'Φωτιστικού Τοίχου S-42ΑΡ Bronze 34-0189 Ε/27 Heronia' }), 'hgw', 'Lighting', 'Wall Light');
  is(h({ name: 'Σποτ Χωνευτό Led 1926 2x9W 3000K' }), 'hgw', 'Lighting', 'Ceiling Light');
  is(h({ name: 'Φωτιστικό Οροφής The Island CL50285 25X35X25Cm MindTheGap' }), 'hgw', 'Lighting', 'Ceiling Light');
  is(h({ name: 'Σετ Σαλόνι California 6Τμχ K/D Twin Natural/Grey', feedCategory: 'Έπιπλα Σαλονιού, Κουζίνας & Κήπου > Έπιπλα Κήπου' }), 'hgw', 'Furniture', 'Sofa');
  is(h({ name: 'Σεντόνια Κούπερ Με Λάστιχο Σετ 4τμχ Blue Viopros' }), 'hgw', 'Bedding & Bath', 'Bed Sheet');
  is(g({ name: 'Λάστιχο ποτίσματος 20 μέτρα' }), 'ggw', 'Watering & Irrigation', 'Hose Pipes');
  is(g({ name: 'Γλάστρα πλαστική στρογγυλή 30cm' }), 'ggw', 'Plants, Growing & Garden Care', 'Pots & planters');
  // Never: medicines and supplements, adult products, smoking, alcohol, vouchers.
  for (const name of ['Solgar Vitamin D3 60 caps', 'Συμπλήρωμα διατροφής με μαγνήσιο', 'Ariel 40 Κάψουλες Πλυντηρίου', 'Αποκριάτικη Στολή Sexy Δασκάλα', 'Δωροεπιταγή 50€', 'Κρασί ερυθρό 750ml']) {
    assert.match(w({ name }).reject, /medicine|supplement|adult|smoking|food|service/, name);
  }
  // ... but not "unisex", a capsule toy, the colour chocolate or a vitamin C cream.
  assert.equal(k({ name: 'Stitch Μίνι Κάψουλες-1Τμχ', feedCategory: 'Παιδικά Παιχνίδια > Φιγούρες' }).site, 'kgw');
});

test('L14 (22 Nov 2026): fashion words that look like beauty words, and "table-top" is not a table', () => {
  // The Greek wave of 22 Nov 2026 (dry run of 113 shops): "δερμάτινο" (leather), "κρεμαστό" (pendant), "skinny",
  // "μάλλινο" (woollen), "brown", "πλατφόρμα" and "επιτραπέζιο" had put ~1,000 products in the wrong subcategory.
  const w = LW.classifierFor('wgw'), m = LW.classifierFor('mgw'), h = LW.classifierFor('hgw');
  const is = (r, cat, sub) => assert.deepEqual([r.siteCategory, r.subcategory], [cat, sub], JSON.stringify(r));
  is(w({ name: 'Καφέ δερμάτινη γόβα' }), 'Shoes', 'Heels');
  is(w({ name: 'Γκρι δερμάτινο Australian Boot Classic L7830' }), 'Shoes', 'Boots');
  is(w({ name: 'Γυναικεία λεπτή δερμάτινη ζώνη - BLACK' }), 'Bags & Accessories', 'Belts');
  is(w({ name: 'Midi δερματίνη φούστα σε καφέ χρώμα' }), 'Clothing', 'Skirts');
  is(w({ name: 'Skinny fit τζιν παντελόνι - BLACK' }), 'Clothing', 'Jeans');
  is(w({ name: 'Κρεμαστό με όνομα Λουκία ασημένιο' }), "Women's Jewellery", 'Necklaces');
  is(w({ name: 'Κρεμαστά μακριά σκουλαρίκια με στρας (SILVER)' }), "Women's Jewellery", 'Earrings');
  is(w({ name: 'Jt Λαμπρερή ατσάλινη αλυσίδα σώματος bodychain Ασημί' }), "Women's Jewellery", 'Jewellery');
  is(w({ name: 'Pro Socks Wool Cozy Berry – Γυναικεία Μάλλινη Κάλτσα' }), 'Clothing', 'Socks');
  is(w({ name: 'Soma Blush Dots Soft Touch Γυναικείες Χνουδωτές Κάλτσες' }), 'Clothing', 'Socks');
  is(w({ name: 'Σετ 2 μικρά κλάμερ μαλλιών (OFF WHITE)' }), 'Bags & Accessories', 'Hair Accessories');
  is(w({ name: 'Ταμπά δερμάτινη πλατφόρμα' }), 'Shoes', 'Shoes');
  is(w({ name: 'Platform Slides με Φιόγκο' }), 'Shoes', 'Sandals');
  is(w({ name: 'Jt Προσωποποιημένο Μπρελόκ Πλακέτα για Χάραξη' }), 'Bags & Accessories', 'Accessories');
  is(w({ name: 'Ρολόι Unisex Brown Leather Strap, OOZOO' }), 'Watches', 'Watches');
  is(w({ name: 'TIMBERLAND SUEDE BRUSH TB0A2K6Z0001' }), 'Bags & Accessories', 'Accessories');
  is(w({ name: 'Μπουρνούζι βαμβακερό με γιακά και ζώνη' }), 'Clothing', 'Nightwear');
  is(m({ name: 'Ανδρικό Σετ Δώρου Πορτοφόλι+Μπρελόκ Tommy Hilfiger' }), 'Bags & Accessories', 'Wallets & Purses');
  is(m({ name: 'Ανδρικό Μάλλινο Κασκόλ Calvin Klein' }), 'Bags & Accessories', 'Scarves');
  is(m({ name: 'Cherry Blossom Dubbin Wax Λίπος Φυσικό' }), 'Bags & Accessories', 'Accessories');
  // ... and the beauty products stay beauty.
  is(w({ name: 'Ενυδατική Κρέμα Ημέρας για Ξηρό Δέρμα 50ml' }), 'Beauty & Fragrances', 'Skincare');
  is(w({ name: 'Ορός Προσώπου για Λάμψη Glow' }), 'Beauty & Fragrances', 'Skincare');
  is(w({ name: 'Αποτριχωτικές ταινίες κεριού (μπικίνι & μασχάλες) 24τεμ' }), 'Beauty & Fragrances', 'Hair removal');
  is(w({ name: 'Stradivarius N.170 Sweet Blush Elixir Parfum 100 Ml' }), 'Beauty & Fragrances', 'Fragrance');
  is(w({ name: 'Stradivarius N.179 Coco Kiss Hair & Body Parfum' }), 'Beauty & Fragrances', 'Fragrance');
  is(w({ name: 'Σαμπουάν για λιπαρά μαλλιά 500ml' }), 'Beauty & Fragrances', 'Hair care');
  is(w({ name: 'Long Lasting Matte Lip Gloss' }), 'Beauty & Fragrances', 'Make-up');
  // Home things in a fashion feed go to Home Gear World.
  assert.match(w({ name: 'Πετσέτα Προσώπου 50×90 Selena Grey' }).reject, /home product/);
  assert.match(w({ name: 'Αρωματικό Κερί FOREST ESCAPE' }).reject, /home product/);
  // "Επιτραπέζιο" is table-top: not a dining table.
  is(h({ name: 'Ψηφιακό Ρολόι Επιτραπέζιο με Ξυπνητήρι VST-716' }), 'Home Decor', 'Clock');
  is(h({ name: 'Τραπέζι Καθιστικού Henshaw Black' }), 'Furniture', 'Coffee Table');
  is(h({ name: 'Τραπέζι Πλαϊνό Rosalind Cotton White' }), 'Furniture', 'Side Table');
  is(h({ name: 'Τραπεζαρία Οξιάς 160x90' }), 'Furniture', 'Dining Table');
  is(h({ name: 'Ταπέτο Rattan Flower 70cm Rythmos' }), 'Home Decor', 'Rug');
  assert.notEqual(h({ name: 'Επιτραπέζια Ηλεκτρική Εστία Εμαγιέ 1000W' }).subcategory, 'Dining Table');
  assert.match(h({ name: 'Κλιπ Συγκράτησης Προφυλακτήρα 10τμχ' }).reject, /car product/);
});

test('L14 (22 Nov 2026): Filinda is a home shop: home on HGW, women on WGW, children on KGW', () => {
  const p = PROGRAMMES.find(x => x.id === 13088);
  assert.equal(p.site, 'hgw');
  const c = LW.classifierFor(LW.programmeSites(p));
  assert.equal(c({ name: 'ΣΕΝΤΟΝΙΑ ΕΜΠΡΙΜΕ ΣΕΤ 3 τεμ Ήρα 425 160X240 White-Denim Blue' }).site, 'hgw');
  assert.equal(c({ name: 'Γυναικεία Νυχτικιά Minerva Glam Αμάνικη Χακί' }).site, 'wgw');
  assert.equal(c({ name: 'Παιδική Πυτζάμα Energiers για αγόρια' }).site, 'kgw');
});

test('L199: a shop that sells for everyone goes to the site of each audience', () => {
  const all = LW.classifierFor(['wgw', 'mgw', 'kgw']);
  assert.equal(all({ name: 'Sneakers adidas Runfalcon 3.0', feedCategory: 'Γυναίκα > Παπούτσια' }).site, 'wgw');
  assert.equal(all({ name: 'Sneakers adidas Runfalcon 3.0', feedCategory: 'Άνδρας > Παπούτσια' }).site, 'mgw');
  assert.equal(all({ name: 'Sneakers adidas Runfalcon 3.0', feedCategory: 'Παιδί > Αγόρι' }).site, 'kgw');
  assert.equal(all({ name: 'Τσάντα Guess', feedCategory: 'modivo' }).site, 'wgw', 'no audience: the shop\'s own site');
  assert.equal(LW.audience('calvin klein jeans ls t-shirt women'), 'women');
  assert.equal(LW.audience('παιδικα ρουχα'), 'kids');
  assert.equal(LW.audience('αγορα με εκπτωση'), '', 'αγορά (purchase) is not αγόρι');
});

test('L199: the page key: CJ clicks unwrapped, the product in the query kept', () => {
  assert.equal(LW.shopPageOf('https://www.jdoqocy.com/click-100914861-13511721?url=https%3A%2F%2Fwww.notino.gr%2Floreal%2Fp-68506%2F%3Fcolor%3D2'), 'https://www.notino.gr/loreal/p-68506/');
  assert.equal(LW.shopPageOf('https://energiers.gr/index.php?route=product/product&product_id=12041'), 'https://energiers.gr/index.php?product_id=12041');
  assert.equal(LW.shopPageOf('https://www.shop.gr/p/9?utm_source=lw'), 'https://www.shop.gr/p/9');
  assert.equal(LW.retailerName({ name: 'Answear CY', cc: ['CY'] }), 'Answear CY');
  assert.equal(LW.retailerName({ name: 'Spartoo', cc: ['GR', 'CY'] }), 'Spartoo GR');
});

test('L199: every Linkwise shop with import rules is seen only in Greece and/or Cyprus, with Greek names', async () => {
  assert.ok(MODULES.length >= 50, `${MODULES.length} programmes`);
  for (const id of MODULES) {
    const p = LW.programme(id);
    assert.ok(p, `lw-${id}: a programme of the table`);
    assert.ok(!LW.NEVER_SHOPS.test(p.name), p.name);
    const src = readFileSync(`tools/import-rules/lw-${id}.mjs`, 'utf8');
    assert.ok(src.includes(`linkwiseRules(${id})`), `lw-${id}.mjs`);
    const rules = await import(`../../tools/import-rules/lw-${id}.mjs`);
    assert.equal(rules.RULES.network, 'linkwise');
    assert.equal(rules.RULES.retailer, LW.retailerName(p));
    for (const s of rules.RULES.sites) {
      const cfg = config[s].deliversTo;
      const cc = cfg.retailers[rules.RULES.retailer];
      assert.ok(cc.every(c => p.cc.includes(c)) && cc.every(c => c === 'GR' || c === 'CY'), `${s} ${rules.RULES.retailer}: ${cc}`);
      assert.equal(cfg.languages[rules.RULES.retailer], 'el', `${s} ${rules.RULES.retailer}`);
      for (const country of ['GB', 'US', 'PL', 'DE', 'FR', 'IE']) assert.equal(seen(config[s], country, rules.RULES.retailer), false, `${s}: ${rules.RULES.retailer} hidden in ${country}`);
      assert.equal(seen(config[s], 'GR', rules.RULES.retailer), true, `${s}: ${rules.RULES.retailer} seen in Greece`);
      assert.equal(seen(config[s], 'CY', rules.RULES.retailer), cc.includes('CY'), `${s}: ${rules.RULES.retailer} in Cyprus only where it delivers`);
    }
  }
  // Never: the shops that do not accept comparison sites (Linkwise's terms).
  for (const name of ['Public', 'Sephora', 'e-shop.gr', 'Kotsovolos']) assert.ok(LW.NEVER_SHOPS.test(name), name);
  // A programme without its visibility limit cannot even be planned (the rules refuse to load).
  const missing = PROGRAMMES.find(p => LW.LEGACY_SITES.includes(p.site) && !MODULES.includes(p.id) && !Object.keys(config[p.site].deliversTo.retailers).includes(LW.retailerName(p)));
  if (missing) await assert.rejects(LW.linkwiseRules(missing.id), /is not limited to/);
});

test('L199 + L193 + L202: the views of the older sites stay within the D1 limits, and Greece is one group', () => {
  for (const s of LW.LEGACY_SITES) {
    const groups = countryGroups(config[s]);
    // Since L202 the hidden names are quoted text in the SQL, not values: the limit is the D1 statement (100,000 characters),
    // tested with 600 names in tests/worker/fast-lists-legacy.test.mjs (massive import of 22 Nov 2026: 119 Greek shops on WGW).
    for (const g of groups.list) assert.ok((g.hidden || g.only || []).length <= 600, `${s} ${g.id}: ${(g.hidden || g.only || []).length} names`);
    assert.ok(groups.list.length <= 10, `${s}: ${groups.list.length} groups`);
    assert.equal(viewFor(config[s], 'GR', NOW).group.startsWith('lang-'), true, `${s}: Greece sees the Greek shops`);
  }
});

test('L199: the affiliate code is never in the repository', () => {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(f => f && !/\.(gz|png|jpg|webp|ico|woff2?)$/i.test(f));
  for (const f of files) {
    if (!existsSync(f)) continue;
    assert.ok(!/(?<![A-Za-z0-9])CD\d{4,9}(?!\d)/.test(readFileSync(f, 'utf8')), `${f} has a Linkwise affiliate code`);
  }
});

test('L199: a plan of a Linkwise shop: Greek names in their subcategories, euros, the Linkwise link, ids lw<programme>:', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lwplan-'));
  const rows = [
    sample(1, { product_name: 'Φόρεμα μίντι σατέν', category: 'Γυναικεία&gt;Φορέματα' }),
    sample(2, { product_name: 'Μπλούζα πλεκτή', category: 'Γυναικεία&gt;Πλεκτά', price: '1.299,00' }),
    sample(3, { product_name: 'Φούστα μίντι', tracking_url: 'https://www.shop.gr/p/3' }),
    sample(4, { product_name: 'Συμπλήρωμα διατροφής κολλαγόνο' })
  ];
  await convertLinkwise(Readable.from([csv(rows)]), 23, join(dir, 'LINKWISE_23.csv.gz'));
  const plan = await planLegacyImport({ archive: dir, retailer: 'lw-23', outDir: join(dir, 'out'), now: new Date(NOW) });
  const got = plan.accepted.wgw.map(p => [p.product_name, p.site_category, p.subcategory, p.price, p.currency, p.retailer]);
  assert.deepEqual(got, [['Φόρεμα μίντι σατέν', 'Clothing', 'Dresses', 39.9, 'EUR', 'La Redoute GR'], ['Μπλούζα πλεκτή', 'Clothing', 'Tops & Blouses', 1299, 'EUR', 'La Redoute GR']]);
  assert.ok(plan.accepted.wgw.every(p => isLinkwiseLink(p.affiliate_url, CODE) && p.awin_product_id.startsWith('lw23:')));
  assert.equal(Object.values(plan.rejected).flat().length, 2, 'no Linkwise link, and a supplement');
});
