// Massive inventory of 22 Nov 2026 (tools/massive-inventory.mjs, lessons L207): one short line per feed of the candidates
// list, the shops without a number found by name in the Awin and CJ lists of the download reports, and every candidate
// without a feed with the reason. Read-only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { filesOf, inventory, nameMatches, normName, parseAwinReport, parseCjReport, parseDaisyconReport, parseRakutenReport, problemLines } from '../../tools/massive-inventory.mjs';

const HEAD = 'merchant_name,product_name,search_price,currency,in_stock,merchant_category,merchant_deep_link,aw_image_url,language,brand_name';
const csv = rows => gzipSync(Buffer.from([HEAD, ...rows].join('\n') + '\n', 'utf8'));

test('massive inventory: names are compared without case, accents, punctuation and company words', () => {
  assert.equal(normName('Kärcher UK Ltd.'), 'karcher');
  assert.equal(normName('Click & Grow'), normName('Click and Grow'));
  assert.ok(nameMatches('Kentfaith (K&F Concept)', 'K&F Concept'));
  assert.ok(nameMatches('Kentfaith (K&F Concept)', 'Kentfaith Official Store'));
  assert.ok(nameMatches('GL Technologies (GL.iNet)', 'GL.iNet'));
  assert.ok(!nameMatches('AGM', 'AGM Batteries Ltd and Something Else'), 'a short name is only an exact match');
  assert.ok(nameMatches('AGM', 'AGM'));
  assert.ok(!nameMatches('Baleaf', 'Bale'), 'a shorter other name needs 5 letters to match a beginning');
});

test('massive inventory: the Awin, CJ and Daisycon reports are read line by line', () => {
  const aw = parseAwinReport('﻿Λίστα Awin: 900 feeds\r\n131305 Rit Concept, feed 118000: μέλος: active | προϊόντα στο Awin: 5024 | ανανέωση Awin: 2026-11-22 | αντίγραφο εδώ: δεν υπάρχει\r\n'
    + '99999: δεν υπάρχει στη λίστα σου (δεν είσαι μέλος ή δεν έχει feed).\r\n  - 131305 Rit Concept (feed 118000, GB, προϊόντα 5024)\r\n');
  assert.equal(aw.listing.get('131305').feeds[0].products, '5024');
  assert.equal(aw.regions.get('131305'), 'GB');
  assert.ok(aw.notInList.has('99999'));
  const cj = parseCjReport('Καταστήματα του CJ που σε έχουν δεχτεί: 2\r\n  5755636 FOREO | Active | Beauty\r\n  1826017 Tenergy | Active | Electronics\r\n\r\n1826017: προϊόντα στο CJ: 120\r\n');
  assert.deepEqual(cj.joined.map(j => j.id), ['5755636', '1826017']);
  assert.equal(cj.counts.get('1826017'), 120);
  const dc = parseDaisyconReport('  feed 1: γλώσσα nl, νόμισμα EUR, προϊόντα 40, χώρες: NL\r\n21657 Elegant Showers: feeds 1 | διάλεξα γλώσσα en, νόμισμα GBP, προϊόντα 812 | το media σου γραμμένο στο feed: ναι\r\n'
    + '  Κατάστημα: https://www.elegantshowers.co.uk | στέλνει σε (κατά το Daisycon): GB\r\n19181 [GB]: δεν βγήκε feed: no feed (feeds στο Daisycon: 0)\r\n');
  assert.equal(dc.get('21657').currency, 'GBP');
  assert.equal(dc.get('21657').ships, 'GB');
  assert.match(dc.get('19181').noFeed, /no feed/);
  const rk = parseRakutenReport('MID 1606623 Cotton On UK: μορφή txt\r\nMID 1606623 Cotton On UK: OK, 3500 προϊόντα (καινούργιο), με link του Rakuten: 3500\r\n');
  assert.deepEqual(rk.get('1606623'), { id: '1606623', name: 'Cotton On UK', products: 3500 });
  const pr = problemLines('ok\n12: 🔴 ΠΡΟΒΛΗΜΑ: timeout\n  🟡 ΠΡΟΣΟΧΗ: big\n', 1);
  assert.equal(pr.count, 2);
  assert.equal(pr.shown.length, 1);
});

test('massive inventory: feed files of one shop, and never another shop with the same first digits', () => {
  const names = ['AWIN_131305_118000.csv.gz', 'AWIN_1313050_1.csv.gz', 'DAISYCON_21657.csv.gz', 'DAISYCON_21657_GB.csv.gz', 'DAISYCON_216570.csv.gz', 'LINKWISE_13862.csv.gz', 'CJ_1826017.csv.gz'];
  assert.deepEqual(filesOf(names, 'awin', '131305'), ['AWIN_131305_118000.csv.gz']);
  assert.deepEqual(filesOf(names, 'daisycon', '21657'), ['DAISYCON_21657.csv.gz', 'DAISYCON_21657_GB.csv.gz']);
  assert.deepEqual(filesOf(names, 'linkwise', '13862'), ['LINKWISE_13862.csv.gz']);
  assert.deepEqual(filesOf(names, 'awin', ''), []);
  assert.deepEqual(filesOf(names, 'rakuten', '123'), []);
});

test('massive inventory: one line per feed, names looked up in the lists, and every shop without a feed with its reason', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw-massive-'));
  writeFileSync(join(dir, 'AWIN_131305_118000.csv.gz'), csv([
    'Rit Concept,Oslo 3 Seater Sofa,899.00,GBP,1,Sofas,https://www.ritconcept.co.uk/oslo,https://img/1.jpg,en,Rit',
    'Rit Concept,Milano Dining Table,450.00,GBP,1,Dining Tables,https://www.ritconcept.co.uk/milano,https://img/2.jpg,en,Rit'
  ]));
  writeFileSync(join(dir, 'AWIN_58779_9001.csv.gz'), csv(['Arenti,Arenti Indoor Camera,39.99,USD,1,Cameras,https://arenti.com/a,https://img/3.jpg,en,Arenti']));
  writeFileSync(join(dir, 'RAKUTEN_1606623.csv.gz'), csv(['Cotton On UK,Classic Tee,8.00,GBP,1,Mens > Tops,https://cottonon.com/GB/p/1,https://img/5.jpg,,Cotton On']));
  writeFileSync(join(dir, 'LINKWISE_13862.csv.gz'), csv(['Autodoc,Λάδι κινητήρα 5W30,24.90,EUR,1,Λάδια,https://www.autodoc.gr/x,https://img/4.jpg,el,Castrol']));
  const candidates = [
    { row: 1159, name: 'Rit Concept', net: 'awin', ids: ['131305'], site: 'hgw', country: 'GB', wave: 'uk' },
    { row: 1094, name: 'Arenti Official', net: 'awin', ids: [], site: 'tgw', country: '', wave: 'world' },
    { row: 1164, name: 'Autodoc', net: 'linkwise', ids: ['13862'], site: 'agw', country: 'GR', wave: 'gr' },
    { row: 1160, name: 'Redmagic WW', net: 'admitad', ids: ['20543'], site: 'pgw', country: 'GR', wave: 'gr' },
    { row: 105, name: 'Cotton On (UK)', net: 'rakuten', ids: [], site: 'wgw', country: 'UK', wave: 'uk' },
    { row: 91, name: 'Double Oak Essentials', net: 'awin', ids: ['110166'], site: 'hgw', country: '', wave: 'world' },
    { row: 658, name: 'Tenergy', net: 'cj', ids: [], site: 'tgw', country: 'US', wave: 'world' }
  ];
  const reports = [
    { name: 'AWIN_FEED_DOWNLOAD_20261122_120000.txt', text: '58779 Arenti, feed 9001: μέλος: active | προϊόντα στο Awin: 1 | ανανέωση Awin: 2026-11-22 | αντίγραφο εδώ: 2026-11-22 12:00\r\n110166: δεν υπάρχει στη λίστα σου (δεν είσαι μέλος ή δεν έχει feed).\r\n12: 🔴 ΠΡΟΒΛΗΜΑ: test\r\n' },
    { name: 'RAKUTEN_FEED_DOWNLOAD_20261122_131000.txt', text: 'MID 1606623 Cotton On UK: OK, 3 προϊόντα (καινούργιο)\r\n' },
    { name: 'CJ_FEED_DOWNLOAD_20261122_130000.txt', text: 'Καταστήματα του CJ που σε έχουν δεχτεί: 1\r\n  1826017 Tenergy | Active | Electronics\r\n' }
  ];
  const text = await inventory({ candidates, archive: dir, reports, maxRows: 1000, now: new Date('2026-11-22T13:00:00Z') });
  assert.match(text, /^#1159 UK awin 131305 Rit Concept \[hgw\|GB\] \| 2 \(2 σε απόθ\.\) \| GBP 100% \| en 100% \| ritconcept\.co\.uk \| Sofas \(1\); Dining Tables \(1\) \| «Oslo 3 Seater Sofa» 899\.00; «Milano Dining Table» 450\.00 \| \d+h$/m);
  assert.match(text, /^#1094 awin Arenti Official -> 58779 Arenti \(feed 9001, 1 προϊόντα\)$/m, 'a shop without a number is found by name');
  assert.match(text, /^#1094 WORLD awin 58779 Arenti Official .*USD 100%/m, 'and its feed is read');
  assert.match(text, /^#1164 GR linkwise 13862 Autodoc .*EUR 100% \| el 100%/m);
  assert.match(text, /^#1160 GR admitad 20543 Redmagic WW \[pgw\] : Admitad: δεν υπάρχει ακόμα εργαλείο λήψης$/m);
  assert.match(text, /^#105 rakuten Cotton On \(UK\) -> MID 1606623 Cotton On UK \| 3 προϊόντα$/m, 'a Rakuten shop is found by name in the download report');
  assert.match(text, /^#105 UK rakuten 1606623 Cotton On \(UK\) \[wgw\|UK\] \| 1 /m);
  assert.match(text, /^#91 WORLD awin 110166 Double Oak Essentials \[hgw\] : Awin: δεν είναι στη λίστα σου/m);
  assert.match(text, /^#658 cj Tenergy -> 1826017 Tenergy \| Active$/m);
  assert.match(text, /AWIN_FEED_DOWNLOAD_20261122_120000\.txt: 1 γραμμές με 🔴\/🟡\n {2}12: 🔴 ΠΡΟΒΛΗΜΑ: test/);
  assert.match(text, /Υποψήφια: 7 \(UK 2, Ελλάδα\/Κύπρος 2, κόσμος 3\)/);
});

test('massive inventory: the candidates list of 22 Nov 2026 is well formed and leaves out what the owner and chat 7 left out', () => {
  const list = JSON.parse(readFileSync(new URL('../../tools/massive/candidates-1122.json', import.meta.url), 'utf8')).candidates;
  assert.ok(list.length > 500);
  const nets = new Set(['awin', 'daisycon', 'cj', 'linkwise', 'rakuten', 'admitad', 'adtraction']);
  for (const c of list) {
    assert.ok(nets.has(c.net), `${c.name}: network`);
    assert.ok(['uk', 'gr', 'world'].includes(c.wave), `${c.name}: wave`);
    assert.ok(Array.isArray(c.ids) && c.ids.every(i => /^\d{2,9}$/.test(i)), `${c.name}: ids`);
  }
  const names = list.map(c => c.name.toLowerCase());
  for (const never of ['public', 'sephora', 'e-shop.gr', 'kotsovolos', 'ab vasilopoulos', 'paok fc official store', 'chargrilled', 'hrkgame', 'nexora max', 'ammunition depot', 'yuplay']) {
    assert.ok(!names.includes(never), `${never} is not a candidate`);
  }
  assert.ok(list.some(c => c.net === 'linkwise' && c.ids[0] === '13862'), 'Autodoc (Linkwise 13862)');
  assert.ok(list.some(c => c.net === 'linkwise' && c.ids[0] === '12134'), 'Monsterville (Linkwise 12134)');
  assert.equal(new Set(list.filter(c => c.ids.length).map(c => `${c.net}:${c.ids.join('+')}:${c.row}`)).size, list.filter(c => c.ids.length).length, 'no candidate twice');
  // Rev 39 (chat 7, 23 Nov 2026): the 8 🟢 Adtraction UK shops in wave 1; Phones Direct (🟡) is not a candidate.
  assert.equal(list.filter(c => c.net === 'adtraction' && c.wave === 'uk').length, 8);
  assert.ok(!names.includes('phones direct'));
});

test('L221: the Adtraction check report gives the programme numbers of the Adtraction shops by name', async () => {
  const { parseAdtractionReport, filesOf } = await import('../../tools/massive-inventory.mjs');
  const m = parseAdtractionReport('Εγκεκριμένα προγράμματα (GB): 2\r\n  1500  Living Chic  [GB, GBP]  feed: 420 προϊόντα  (κανάλι 12345, όχι ακόμα στον φάκελο)\r\n  1501  Showery  [GB, GBP]  feed: 0 προϊόντα  (κανάλι 12345, όχι ακόμα στον φάκελο)');
  assert.deepEqual([...m.keys()], ['1500', '1501']);
  assert.deepEqual([m.get('1500').name, m.get('1500').currency, m.get('1500').products], ['Living Chic', 'GBP', 420]);
  assert.deepEqual(filesOf(['ADTRACTION_1500.csv.gz', 'AWIN_1500_1.csv.gz'], 'adtraction', '1500'), ['ADTRACTION_1500.csv.gz']);
});
