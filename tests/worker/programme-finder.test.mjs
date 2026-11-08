// Programme finder (read-only, 8 Nov 2026): topics, Awin and CJ answers, which programmes get details, the report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  TOPICS, MARK, termRegex, matchTerms, resolveTopics, cjKeywords, normAwin, isGb, isActive, awinMatch, awinTopicRows,
  pickDetails, missingCheckIds, formatCommission, commissionKey, cookieDays, parseDetails, parseCjXml, cjIsUk, buildReport, main
} from '../../tools/programme-finder.mjs';

const P = (id, name, o = {}) => ({ id, name, status: 'Active', primaryRegion: { countryCode: 'GB', name: 'United Kingdom' }, currencyCode: 'GBP', primarySector: 'Retail', description: '', displayUrl: 'https://www.example.co.uk', validDomains: [{ domain: 'example.co.uk' }], ...o });
const topic = key => resolveTopics(key).topics[0];

test('words match whole words, with plurals, y -> ies and a * ending', () => {
  assert.ok(termRegex('hamper').test('Hampers.co.uk'));
  assert.ok(termRegex('grocery').test('Fresh groceries delivered'));
  assert.ok(termRegex('deli').test('The Deli Shop'));
  assert.ok(!termRegex('deli').test('Free delivery'));
  assert.ok(!termRegex('carp').test('Carpet Right'));
  assert.ok(!termRegex('fish').test('Fishing tackle'));
  assert.ok(termRegex('photo*').test('Wedding photography'));
  assert.ok(termRegex('meal kit').test('Healthy meal-kits'));
  assert.ok(termRegex('DJ').test('DJ controllers'));
  assert.deepEqual(matchTerms('Guitars, pianos and DJ gear', TOPICS.music.terms), ['guitar', 'piano', 'DJ']);
});

test('topics: presets, own words, unknown names', () => {
  const r = resolveTopics('food,music', 'oyster,smoked salmon');
  assert.equal(r.ok, true);
  assert.deepEqual(r.topics.map(t => t.key), ['food', 'music', 'keywords']);
  assert.deepEqual(r.topics[2].terms, ['oyster', 'smoked salmon']);
  assert.equal(resolveTopics('food,sausages').ok, false);
  assert.equal(resolveTopics('food,sausages').error, 'unknown-topic:sausages');
  assert.equal(resolveTopics('', 'a"b').ok, false);
  assert.equal(resolveTopics('', '').ok, false);
  assert.deepEqual(resolveTopics('', 'carp').topics.map(t => t.key), ['keywords']);
  assert.ok(!cjKeywords(topic('food')).split(' ').includes('box'));
  assert.ok(cjKeywords(topic('food')).split(' ').includes('meat'));
});

test('Awin: only active programmes for GB', () => {
  assert.ok(isGb(normAwin(P(1, 'A'))));
  assert.ok(isGb(normAwin(P(1, 'A', { primaryRegion: { countryCode: 'IE' }, currencyCode: 'EUR', displayUrl: 'https://shop.co.uk', validDomains: [] }))));
  assert.ok(!isGb(normAwin(P(1, 'A', { primaryRegion: { countryCode: 'US' }, currencyCode: 'USD', displayUrl: 'https://a.com', validDomains: [{ domain: 'a.com' }] }))));
  assert.ok(isActive(normAwin(P(1, 'A'))));
  assert.ok(!isActive(normAwin(P(1, 'A', { status: 'Hidden' }))));
  assert.ok(!isActive(normAwin(P(1, 'A', { linkStatus: 'offline' }))));
});

test('Awin: relevance is name, then sector, then description', () => {
  const food = topic('food');
  assert.equal(awinMatch(normAwin(P(1, 'The Village Butcher')), food).tier, 3);
  assert.equal(awinMatch(normAwin(P(2, 'Musclefood', { primarySector: 'Food & Drink', displayUrl: 'https://musclefood.com', validDomains: [] })), food).tier, 2);
  assert.equal(awinMatch(normAwin(P(3, 'Pet Shop', { primarySector: 'Pets', description: 'Dog food' })), food).tier, 1);
  assert.equal(awinMatch(normAwin(P(4, 'Guitar Planet', { primarySector: 'Music' })), food).tier, 0);
});

test('Awin: rows per topic, joined/pending kept, others filtered, details picked in turn and capped', () => {
  const lists = {
    notjoined: [P(10, 'Fresh Fish Direct', { primarySector: 'Food & Drink' }), P(11, 'Guitar Planet UK', { primarySector: 'Music' }), P(12, 'US Steak', { primaryRegion: { countryCode: 'US' }, currencyCode: 'USD', displayUrl: 'https://s.com', validDomains: [] }), P(13, 'Butcher Bob', { status: 'Hidden' })].map(normAwin),
    joined: [P(29169, 'Hampers.co.uk', { primarySector: 'Food & Drink' })].map(normAwin),
    pending: [P(14, 'Deli Delights', { primarySector: 'Food & Drink' })].map(normAwin),
    suspended: [], rejected: [P(15, 'Cheese Board', { primarySector: 'Food & Drink' })].map(normAwin)
  };
  const { rows, skipped } = awinTopicRows(lists, topic('food'));
  assert.deepEqual(rows.map(r => r.id).sort(), [10, 14, 29169]);
  assert.equal(skipped, 2);
  const p = pickDetails(lists, [topic('food'), topic('music')], 2);
  assert.deepEqual(p.details, [{ id: 14, rel: 'pending' }, { id: 11, rel: 'notjoined' }]);
  assert.deepEqual(missingCheckIds(lists, [29169, 115479]), [115479]);
});

test('Awin details: commission range, KPIs, cookie days from the description', () => {
  assert.equal(formatCommission([{ min: 3, max: 8, type: 'percentage' }], 'GBP'), '3%–8%');
  assert.equal(formatCommission([{ min: 2.5, max: 2.5, type: 'amount' }], 'GBP'), '£2.50');
  assert.equal(formatCommission([{ min: 5, max: 5, type: 'percentage' }, { min: 1, max: 3, type: 'amount' }], 'EUR'), '5% / €1.00–€3.00');
  assert.deepEqual(commissionKey([{ min: 3, max: 8, type: 'percentage' }, { min: 1, max: 4, type: 'amount' }]), { pct: 8, amt: 4 });
  assert.equal(cookieDays('Great meat. 30 day cookie.'), '30');
  assert.equal(cookieDays('Cookie length: 45 days'), '45');
  assert.equal(cookieDays('No info'), '');
  const d = parseDetails({ programmeInfo: { id: 1, name: 'X' }, kpi: { approvalPercentage: 92.4, validationDays: 30 }, commissionRange: [] });
  assert.equal(d.approval, 92.4);
  assert.equal(d.validationDays, 30);
});

test('CJ: the advertiser lookup XML', () => {
  const xml = '<?xml version="1.0"?><cj-api><advertisers total-matched="2" records-returned="2" page-number="1">' +
    '<advertiser><advertiser-id>7001</advertiser-id><advertiser-name>Farm &amp; Field UK</advertiser-name><program-url>https://www.farm.co.uk</program-url>' +
    '<relationship-status>notjoined</relationship-status><network-rank>4</network-rank><primary-category><parent>Food &amp; Drinks</parent><child>Gourmet</child></primary-category>' +
    '<actions><action><name>Sale</name><type>advanced sale</type><id>1</id><commission><default type="item-level">6.00%</default></commission></action></actions></advertiser>' +
    '<advertiser><advertiser-id>7003</advertiser-id><account-status>Deactive</account-status><advertiser-name>Old Shop</advertiser-name><program-url>https://old.com</program-url>' +
    '<relationship-status>joined</relationship-status><network-rank>1</network-rank></advertiser></advertisers></cj-api>';
  const p = parseCjXml(xml);
  assert.equal(p.total, 2);
  assert.equal(p.advertisers[0].name, 'Farm & Field UK');
  assert.equal(p.advertisers[0].category, 'Food & Drinks > Gourmet');
  assert.equal(p.advertisers[0].commission, 'Sale: 6.00%');
  assert.equal(p.advertisers[0].rank, '4');
  assert.equal(p.advertisers[1].accountStatus, 'Deactive');
  assert.ok(cjIsUk(p.advertisers[0]));
  assert.ok(!cjIsUk(p.advertisers[1]));
  assert.equal(parseCjXml('<cj-api><error-message>Not Authenticated</error-message></cj-api>').error, 'Not Authenticated');
});

test('report: marks in words, suggested ids, Ocado, nothing when Awin was not read', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pf-'));
  writeFileSync(join(dir, 'awin-notjoined.json'), JSON.stringify([P(11002, 'Musclefood', { primarySector: 'Food & Drink' }), P(50001, 'The Village Butcher')]));
  writeFileSync(join(dir, 'awin-joined.json'), JSON.stringify([P(29169, 'Hampers.co.uk')]));
  for (const r of ['pending', 'suspended', 'rejected']) writeFileSync(join(dir, `awin-${r}.json`), '[]');
  writeFileSync(join(dir, 'awin-details-50001.json'), JSON.stringify({ programmeInfo: { id: 50001 }, kpi: { approvalPercentage: 70, validationDays: 45 }, commissionRange: [{ min: 4, max: 9, type: 'percentage' }] }));
  writeFileSync(join(dir, 'awin-check-115479.err'), '404');
  writeFileSync(join(dir, 'cj-ocado-notjoined.xml'), '<cj-api><advertisers total-matched="1"><advertiser><advertiser-id>7010</advertiser-id><advertiser-name>Ocado</advertiser-name><relationship-status>notjoined</relationship-status><network-rank>5</network-rank></advertiser></advertisers></cj-api>');
  writeFileSync(join(dir, 'cj-food-notjoined-1.xml'), '<cj-api><advertisers total-matched="0"></advertisers></cj-api>');
  const r = buildReport({ dir, topics: resolveTopics('food').topics, checkIds: [11002, 115479, 29169], awinState: 'ok', cjState: 'ok' });
  const text = r.lines.join('\n');
  assert.ok(text.includes(`Awin | The Village Butcher | 50001 | Active | ${MARK.notjoined} | 4%–9% | 70% | 45`));
  assert.ok(text.includes('https://ui.awin.com/merchant-profile/50001'));
  assert.ok(text.indexOf('The Village Butcher') < text.indexOf('| Musclefood |'), 'name match before sector match');
  assert.ok(text.includes(`11002 Musclefood: ${MARK.notjoined}`));
  assert.ok(text.includes('115479 (Farmison): δεν υπάρχει πια στο Awin για εσένα'));
  assert.ok(text.includes(`29169 Hampers.co.uk: ${MARK.joined}`));
  assert.ok(text.includes(`CJ: Ocado (7010): ${MARK.notjoined}`));
  assert.ok(text.includes('Awin: το Ocado δεν βρέθηκε'));
  const off = buildReport({ dir, topics: resolveTopics('food').topics, checkIds: [11002], awinState: 'rejected:401', cjState: 'no-cid' }).lines.join('\n');
  assert.ok(off.includes('το Awin δεν δέχτηκε το κλειδί (401'));
  assert.ok(off.includes('11002 (Musclefood): δεν ελέγχθηκε'));
  assert.ok(off.includes('λείπει ο αριθμός του λογαριασμού σου στο CJ (CID)'));
  assert.ok(!off.includes(MARK.notjoined + ' |'));
  const out = join(dir, 'report.txt');
  assert.equal(main(['report', '--dir', dir, '--topics', 'food', '--check-ids', '115479', '--awin', 'ok', '--cj', 'ok', '--out', out]).ok, true);
  assert.ok(readFileSync(out, 'utf8').includes('δεν υπάρχει πια στο Awin για εσένα'));
  assert.equal(main(['plan', '--topics', 'nope']).ok, false);
});
