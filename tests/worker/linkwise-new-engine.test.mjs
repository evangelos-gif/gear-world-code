// Greek Linkwise shops on the new-engine sites (chat 7 and the owner 21 Nov 2026, lessons L209): the engine knows the
// network, tools/import-rules/lib/linkwise-sections.mjs places Greek rows on SGW, TGW, VGW, AGW, BGW and ZGW, and each
// shop is seen only in Greece (and Cyprus) with its Greek names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { networkShopId, shopIdOf } from '../../tools/tgw-import-plan.mjs';
import { linkwiseSection, LINKWISE_SECTION_SITES } from '../../tools/import-rules/lib/linkwise-sections.mjs';
import { programme } from '../../tools/import-rules/lib/linkwise.mjs';
import { countryGroups, viewFor, retailerInView } from '../../src/lib/visibility.js';
import { deliveryConfigProblems } from '../../src/lib/delivery.js';

const NOW = Date.parse('2026-11-22T10:00:00Z');
const SITES = ['sgw', 'tgw', 'vgw', 'agw', 'bgw', 'zgw'];
const sources = site => JSON.parse(readFileSync(new URL(`../../sites/${site}/sources.json`, import.meta.url), 'utf8')).sources;
const shows = (site, cc, n) => retailerInView(viewFor(site, cc, NOW), n);
const config = {};
for (const s of SITES) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;

test('L209: the engine numbers a Linkwise shop of its own, never the number of an Awin or Daisycon shop', () => {
  const lw = networkShopId('linkwise', 13806);
  assert.ok(lw < 0, 'a network shop is negative');
  assert.notEqual(lw, networkShopId('daisycon', 13806));
  assert.notEqual(lw, 13806);
  assert.equal(shopIdOf({ network: 'linkwise', advertiserId: 13806 }), lw);
  assert.deepEqual(LINKWISE_SECTION_SITES, SITES);
});

test('L209: Greek rows go to the right category, fashion, medicine and other departments stay out', () => {
  const c = (site, name, cat, source = null) => linkwiseSection(site, name, cat, source);
  const ok = (r, slug) => { assert.equal(r.ok, true, r.reason); assert.equal(r.slug, slug); };
  ok(c('SGW', 'Nike Air Zoom Pegasus 42 Ανδρικά Παπούτσια για Τρέξιμο', 'Ανδρικά / Ανδρικά Αθλητικά Παπούτσια / Ανδρικά Παπούτσια για Τρέξιμο'), 'running');
  ok(c('SGW', 'Athlos Kettlebell Βινυλίου 12kg Μαύρο', 'Αρχική σελίδα, ΑΞΕΣΟΥΑΡ / ΕΞΟΠΛΙΣΜΟΣ, Kettlebell'), 'fitness-gym');
  ok(c('SGW', 'Μπάλα Μπάσκετ BX 100', 'Αρχική σελίδα, ΑΞΕΣΟΥΑΡ / ΕΞΟΠΛΙΣΜΟΣ, Μπάσκετ'), 'football-team-sports');
  ok(c('SGW', 'Swimming Goggles SPY EXTREME', 'Αρχική σελίδα, SWIMMING, ΑΞΕΣΟΥΑΡ'), 'water-sports');
  assert.equal(c('SGW', 'Nike Air Zoom Pegasus 42', 'Ανδρικά > Παπούτσια > Τρέξιμο').sub, 'Shoes', 'an English subcategory');
  assert.match(c('SGW', 'Puma X-Ray Speed Μποτάκια Μαύρα', 'Γυναικεία > Παπούτσια > Παπούτσια Μόδας > Μπότες').reason, /fashion/);
  assert.match(c('SGW', 'BIRKENSTOCK ARIZONA SANDALS', 'ΓΥΝΑΙΚΕΙΑ > ΠΑΠΟΥΤΣΙΑ > ΣΑΓΙΟΝΑΡΕΣ').reason, /fashion/);
  assert.match(c('SGW', 'Βελόνες βελονισμού 100τμχ', 'Βελονισμός - Εναλ. Θεραπείες').reason, /therapy or medical/);
  assert.match(c('SGW', 'Καπέλο τριγώνου', 'OFFERS > 2+1 Swimwear | μαγιο').reason, /beach swimwear|not sport/);
  ok(c('TGW', 'Φορτιστής USB-C 20W', 'Αξεσουάρ Κινητών & Smartwatches > Φορτιστές & Καλώδια > Φορτιστές - Αντάπτορες'), 'accessories-storage');
  ok(c('TGW', 'Θήκη MagSafe Clear', 'ΘΗΚΕΣ > Θήκες iPhone 17 Pro Max > Θήκες iPhone'), 'phones-smartwatches');
  assert.equal(c('TGW', 'Κούπα με στάμπα', 'Είδη σπιτιού > Είδη κουζίνας > Κούπες - Ποτήρια').ok, false);
  ok(c('VGW', 'Βαλίτσα 4 ρόδες FOCUS Size 81', 'Είδη Ταξιδίου > Βαλίτσες Ταξιδίου - Bαλίτσες Καμπίνας'), 'luggage-suitcases');
  ok(c('AGW', 'ΜΠΑΤΑΡΙΑ VARTA BLUE D43', 'ΜΠΑΤΑΡΙΕΣ ΑΥΤΟΚΙΝΗΤΟΥ'), 'diagnostics-battery');
  assert.match(c('AGW', 'ΜΠΑΤΑΡΙΑ YUASA YTX16-BS', 'ΜΠΑΤΑΡΙΕΣ ΜΟΤΟΣΥΚΛΕΤΩΝ').reason, /not a car product/);
  assert.match(c('AGW', 'Σετ 2 ηλιοπροστασίες αυτοκινήτου', 'Καμπίνα, Άνεση & Αξεσουάρ Εσωτερικού > Ηλιοπροστασία, Σκίαση').slug, /interior-comfort/,
    'sun shades are not tyres ("ηλιοπροστασια" holds "τασι")');
  assert.match(c('AGW', 'VenCore Επιτοίχιο Φωτιστικό', 'Τεχνολογια &gt; Φωτισμός & Αξεσουάρ &gt; Φωτιστικά', { retailer: 'DealsShop GR', onlyPath: 'auto - moto|αυτοκινητ|οχηματ' }).reason, /another department/);
  ok(c('BGW', 'ΚΡΑΝΟΣ HS399 ΜΑΥΡΟ ΜΑΤ', 'Κράνη'), 'helmets');
  assert.match(c('BGW', 'MX25 RKS', 'Ηλεκτρικά Ποδήλατα').reason, /Sporty/);
  ok(c('BGW', 'Μπαταρία Μοτοσυκλέτας VARTA TX5L-BS', 'Αρχική / Μπαταρίες Μοτοσυκλέτας', { sectionsFor: 'bgw-batteries' }), 'parts-maintenance');
  assert.equal(c('BGW', 'Μπαταρία Αυτοκινήτου VARTA F16', 'Αρχική / Μπαταρίες Αυτοκινήτου', { sectionsFor: 'bgw-batteries' }).ok, false);
  ok(c('ZGW', 'BRIT CARE Fillets In Jelly', 'Γάτα > Τροφή Γάτας > Κονσέρβα - Υγρή τροφή γάτας'), 'cats');
  ok(c('ZGW', 'Royal Canin Medium Adult 15kg', 'Σκύλος > Τροφή σκύλου > Ξηρά τροφή σκύλου'), 'food');
  assert.match(c('ZGW', 'Frontline Combo αμπούλες', 'Σκύλος > Αντιπαρασιτικά').reason, /veterinary/);
  assert.match(c('SGW', 'Πρωτεΐνη σε σκόνη whey 2kg', 'Διατροφή').reason, /supplement/);
});

test('L209: every Linkwise source is a Greek shop of the L199 list, with its own file and euros', () => {
  for (const s of SITES) {
    for (const x of sources(s).filter(y => y.network === 'linkwise')) {
      const p = programme(x.advertiserId);
      assert.ok(p, `${s} ${x.retailer}: a Linkwise programme that accepted Gear World`);
      assert.equal(x.retailer, `${p.name} ${p.cc.length === 1 && p.cc[0] === 'CY' ? 'CY' : 'GR'}`);
      assert.equal(x.sections, 'linkwise-gr');
      assert.equal(x.currency, 'EUR');
      assert.equal(x.approved, true);
      assert.ok(new RegExp(x.file).test(`LINKWISE_${x.advertiserId}.csv.gz`) && !new RegExp(x.file).test(`LINKWISE_${x.advertiserId}1.csv.gz`), `${x.retailer}: its file`);
      assert.deepEqual(config[s].deliversTo.retailers[x.retailer], p.cc, `${s} ${x.retailer}: where it delivers`);
      assert.equal(config[s].deliversTo.languages[x.retailer], 'el', `${s} ${x.retailer}: Greek names`);
    }
  }
  // Left out (21 Nov 2026): PAOK FC (its feed has no product names), Ekdromi.gr and Xenodoxeio (travel services), Plus4u (a
  // fashion shop: nothing for Technology Gear World).
  const all = SITES.flatMap(s => sources(s).filter(y => y.network === 'linkwise').map(y => y.advertiserId));
  for (const id of [11261, 177, 205, 385]) assert.equal(all.includes(id), false, `programme ${id}`);
});

test('L209: the Greek shops are seen only in Greece and Cyprus; at most 10 page groups per site', () => {
  for (const s of SITES) {
    const site = config[s];
    assert.deepEqual(deliveryConfigProblems(site), [], s);
    const lw = Object.keys(site.deliversTo.retailers).filter(n => site.deliversTo.languages[n] === 'el' && sources(s).some(x => x.network === 'linkwise' && x.retailer === n));
    assert.ok(lw.length > 0, s);
    for (const cc of ['GB', 'FR', 'DE', 'US', '']) for (const n of lw) assert.equal(shows(site, cc, n), false, `${s} ${cc || 'unknown'}: ${n} hidden`);
    for (const n of lw) assert.equal(shows(site, 'GR', n), true, `${s} GR: ${n} seen`);
    for (const n of lw) assert.equal(shows(site, 'CY', n), site.deliversTo.retailers[n].includes('CY'), `${s} CY: ${n}`);
    assert.ok(countryGroups(site).list.length <= 10, `${s}: ${countryGroups(site).list.length} groups`);
  }
});

test('L211: Technology Gear World keeps phones, chargers and cameras; toner, spy gear, cheating earpieces and home items stay out', () => {
  const c = (name, cat) => linkwiseSection('TGW', name, cat);
  const ok = (r, slug) => { assert.equal(r.ok, true, r.reason); assert.equal(r.slug, slug); };
  const out = (r, re) => { assert.equal(r.ok, false, `${r.slug} accepted`); assert.match(r.reason, re); };
  // The dry run of 21 Nov 2026 17:39 (VNP GR, DealsShop GR, Vour.gr GR, Stark Stores GR):
  out(c('Toshiba Toner T-409E-R T409ER Μαύρο black (6B000001169)', 'Αρχική > Toner Cartridges'), /toner or ink/);
  out(c('Brother Cartridge TN-243 TN243 Yellow Gelb (TN243Y)', 'Αρχική > Toner Cartridges'), /toner or ink/);
  out(c('Activejet ATH-543N Toner (replacement for HP 125A CB543A)', 'Αρχική > Toners > For HP printers (with head)'), /toner or ink/);
  out(c('Smartcheater Στυλό V2 Bluetooth με Spy Ακουστικό', 'Σπιτι - Γραφειο > Συστήματα Ασφαλείας > Συσκεύες Παρακολούθησης'), /spy or hidden/);
  out(c('SmartCheater Bluetooth SE με Μικροσκοπικό Ακουστικό Ψείρα', 'Σπιτι - Γραφειο > Συστήματα Ασφαλείας > Συσκεύες Παρακολούθησης'), /spy or hidden/);
  out(c('JNN Q82 Καταγραφικό Ήχου USB με Ανίχνευση Ήχου', 'Σπιτι - Γραφειο > Συστήματα Ασφαλείας > Συσκεύες Παρακολούθησης'), /spy or hidden/);
  out(c('S-Talk S6 Κρυφή Κάμερα σε Φορτιστή Πρίζας WiFi 1080P', 'Σπιτι - Γραφειο > Συστήματα Ασφαλείας > Κάμερες'), /spy or hidden/);
  out(c('ΚΑΜΕΡΑ ΑΣΦΑΛΕΙΑΣ ΟΜΟΙΩΜΑ ΜΕ LED ΦΩΤΙΣΜΟ', 'Σπιτι - Γραφειο > Συστήματα Ασφαλείας'), /spy or hidden/);
  out(c('Gaming κρεμαστή πινακίδα - 14 εκ.', 'Διακοσμητικά > Πίνακες'), /not a technology/);
  out(c('Κορνίζα τηλεόραση - 25 εκ.', 'Διακοσμητικά > Κορνίζες'), /not a technology/);
  out(c('Ποιος Που Πότε Γιατί Party Edition - Τηλεόραση', 'Παιχνίδια > Επιτραπέζια παιχνίδια > Party'), /not a technology/);
  out(c('Selfie κλιπ με λιχουδιά για κατοικίδια', 'Είδη σπιτιού > Είδη κατοικιδίων'), /not a technology/);
  out(c('Κεφαλή Ντους TurboCharger Μπλε Herzberg HG-8087-BLU', 'Οικιακός Εξοπλισμός > Μπάνιο'), /not a technology/);
  out(c('Beper Επαναφορτιζόμενο Ασύρματο Μίξερ Χειρός USB P102SBA007', 'Ασύρματες - Επαναφορτιζόμενες'), /not a technology/);
  out(c('Zilan Μικρός Επαναφορτιζόμενος Επιτραπέζιος Ανεμιστήρας USB ZLN4000', 'Summer Offers'), /not a technology/);
  out(c('Τσάντα Guess Crossbody Triangle Logo 10″ Brown', 'GADGETS > ΤΣΑΝΤΕΣ LAPTOP'), /not a technology/);
  // ... and what is technology stays:
  ok(c('HP LaserJet Pro M404dn Printer', 'Αρχική > Printers'), 'laptops-computing');
  ok(c('Suntek HC-960Ultra-Li 4G Κάμερα Ασφαλείας με Εφαρμογή', 'Σπιτι - Γραφειο > Συστήματα Ασφαλείας > Κάμερες'), 'smart-home-wifi');
  ok(c('Drone LF632 5G με 4K Κάμερα και Χειριστήριο', 'Τεχνολογια > Gadgets > Διάφορα Gadgets'), 'cameras-drones');
  ok(c('Anker 511 Charger (Nano 3, 30W) White', 'Electronics'), 'accessories-storage');
  ok(c('Θήκη MagSafe Clear', 'ΘΗΚΕΣ > Θήκες iPhone 17 Pro Max > Θήκες iPhone'), 'phones-smartwatches');
  ok(c('Λουράκι Apple Watch Sport Band 45mm', 'APPLE WATCH > ΛΟΥΡΑΚΙΑ APPLE WATCH > ΛΟΥΡΑΚΙΑ APPLE WATCH 44/45/46/49mm'), 'phones-smartwatches');
  ok(c('Βάση laptop με ανεμιστήρα ψύξης', 'Αρχική > Laptop accessories'), 'laptops-computing');
  ok(c('Συσκευή Αναπαραγωγής Bluetooth Ηχείο', 'Τεχνολογια > Ήχος > Ηχεία'), 'audio');
});
