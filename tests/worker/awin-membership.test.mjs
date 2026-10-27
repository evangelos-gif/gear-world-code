// Job 4 of 25 Oct 2026 (lessons L61): which Awin programmes still pay for the shops on the older sites. Links in the shape
// of the live databases (26 Oct 2026): cread.php?awinmid=..., pclick.php?...&m=..., plain shop links (GGW Tooled Up), and
// Juicy Couture UK links whose ?ued= had no product address ("&utm_source=aw...").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readKnownMembers, advertiserOf, readAwinList, planMembership, renderMembershipReport } from '../../tools/awin-membership-plan.mjs';

const cread = (id, ued) => `https://www.awin1.com/cread.php?awinmid=${id}&awinaffid=3057233&ued=${ued}`;

test('the advertiser id comes from cread (awinmid) and pclick (m) links; a plain shop link has none', () => {
  assert.equal(advertiserOf(cread(125248, 'https%3A%2F%2Ffinediam.com%2Fx')), '125248');
  assert.equal(advertiserOf('https://www.awin1.com/pclick.php?p=43276243639&a=3057233&m=122382'), '122382');
  assert.equal(advertiserOf('https://www.tooled-up.com/bahco-3846t-pruning-saw/prod/149903/?Referrer=affwin'), '');
  assert.equal(advertiserOf('https://evil.example/cread.php?awinmid=1'), '');
});

const LIST = 'Advertiser ID,Advertiser Name,Primary Region,Membership Status,Feed ID,Last Imported,No of products\n'
  + '30645,Coes,GB,active,116078,2026-10-25 06:00:00,4400\n'
  + '122382,Watch Enclave,GB,active,112068,2026-10-25 06:00:00,979\n'
  + '125248,Finediam,GB,not joined,99,2026-10-20 06:00:00,10000\n'
  + '56439,Red Gorilla International,GB,active,1,2026-05-15 09:00:00,532\n';

function sites() {
  return [
    { site: 'mgw', rows: [
      { retailer: 'Coes', n: 4358, link: cread(30645, 'https%3A%2F%2Fwww.coes.co.uk%2Fa'), bad: 0 },
      { retailer: 'Watch Enclave', n: 295, link: 'https://www.awin1.com/pclick.php?p=43276243639&a=3057233&m=122382', bad: 0 },
      { retailer: 'Watch Enclave Affiliate Programme', n: 294, link: cread(122382, 'https%3A%2F%2Fwatchenclave.com%2Fx'), bad: 0 },
      { retailer: 'Finediam', n: 267, link: cread(125248, 'https%3A%2F%2Ffinediam.com%2Fx'), bad: 0 }] },
    { site: 'kgw', rows: [{ retailer: 'Juicy Couture UK', n: 43, link: cread(19471, '%26utm_source%3Daw%26u'), bad: 43 }] },
    { site: 'cgw', rows: [{ retailer: 'Red Gorilla International', n: 72, link: cread(56439, 'https%3A%2F%2Fwww.redgorilla.red%2Fx'), bad: 0 }] },
    { site: 'ggw', rows: [{ retailer: 'Tooled Up', n: 710, link: 'https://www.tooled-up.com/x/?Referrer=affwin', bad: 0 }] }
  ];
}

test('L61/L79: member and fresh = ΕΝΤΑΞΕΙ; not a member = ΠΡΟΒΛΗΜΑ; not in the list or stale feed = ΠΡΟΣΟΧΗ; broken links counted', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'awin-list-'));
  writeFileSync(join(dir, 'list.csv'), '﻿' + LIST);
  const list = await readAwinList(join(dir, 'list.csv'));
  assert.equal(list.length, 4);
  const plan = planMembership({ sites: sites(), list, now: new Date('2026-10-26T22:00:00Z') });
  const by = Object.fromEntries(plan.programmes.map(p => [p.id, p]));
  assert.equal(by['30645'].level, 'green');
  assert.equal(by['122382'].level, 'green', 'both shop names of Watch Enclave are the same programme (L33)');
  assert.deepEqual(by['122382'].retailers.sort(), ['Watch Enclave', 'Watch Enclave Affiliate Programme']);
  assert.equal(by['122382'].total, 589);
  assert.equal(by['125248'].level, 'red');
  assert.match(by['125248'].reason, /δεν είσαι μέλος \(not joined\)/);
  // L79: the feed list only has programmes with a feed; Juicy Couture UK was "Joined" on its Awin page (27 Oct 2026).
  assert.equal(by['19471'].level, 'yellow');
  assert.match(by['19471'].reason, /δεν υπάρχει στη λίστα feeds του Awin, που έχει μόνο προγράμματα με feed/);
  assert.equal(by['19471'].bad, 43);
  assert.equal(by['56439'].level, 'yellow', 'Red Gorilla: member, feed from 15 May');
  assert.deepEqual(plan.plain.map(x => x.retailer), ['Tooled Up']);
  assert.deepEqual(plan.programmes.map(p => p.level), ['red', 'yellow', 'yellow', 'green', 'green'], 'problems first');
  const report = renderMembershipReport(plan);
  assert.match(report, /Σύνολο: 1 🔴 ΠΡΟΒΛΗΜΑ · 2 🟡 ΠΡΟΣΟΧΗ · 1 με χαλασμένα links\. Ενεργά προϊόντα σε προγράμματα που δεν πληρώνουν: 267\./);
  assert.match(report, /🔴 ΠΡΟΒΛΗΜΑ: Finediam \(Awin 125248\) \| MGW 267 \| δεν είσαι μέλος/);
  assert.match(report, /https:\/\/ui\.awin\.com\/awin\/affiliate\/3057233\/merchant-profile\/19471/);
  assert.match(report, /43 links χωρίς διεύθυνση προϊόντος/);
  assert.match(report, /GGW: Tooled Up \(710\)/);
  assert.doesNotMatch(report, /merchant-profile\/30645/, 'no link for a programme that is fine');
  // With the owner's confirmation (tools/awin-known-members.json) it is ΕΝΤΑΞΕΙ, and its broken links are still counted.
  const known = { 19471: { id: 19471, status: 'joined', confirmed: '2026-10-27' } };
  const plan2 = planMembership({ sites: sites(), list, known, now: new Date('2026-10-26T22:00:00Z') });
  const j = plan2.programmes.find(p => p.id === '19471');
  assert.equal(j.level, 'green');
  assert.match(j.reason, /«Joined» στη σελίδα του Awin, 2026-10-27/);
  assert.match(renderMembershipReport(plan2), /43 links χωρίς διεύθυνση προϊόντος/);
  // The feed list still wins over the confirmation file: a programme the list says "not joined" stays ΠΡΟΒΛΗΜΑ.
  const plan3 = planMembership({ sites: sites(), list, known: { 125248: { id: 125248, status: 'joined' } } });
  assert.equal(plan3.programmes.find(p => p.id === '125248').level, 'red');
});

test('L79: the confirmed members file of the repo is valid and holds the three programmes seen as Joined on 27 Oct 2026', () => {
  const known = readKnownMembers(join(process.cwd(), 'tools', 'awin-known-members.json'));
  for (const id of ['48473', '125248', '19471']) {
    assert.equal(known[id].status, 'joined', id);
    assert.match(known[id].confirmed, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('command line: wrangler output files and the Awin list in, report and summary out; without a list everything is "not in the list"', () => {
  const dir = mkdtempSync(join(tmpdir(), 'awin-cli-'));
  const f = join(dir, 'mgw.json.txt');
  writeFileSync(f, 'wrangler text\n' + JSON.stringify([{ results: sites()[0].rows, success: true }]));
  writeFileSync(join(dir, 'list.csv'), LIST);
  const tool = join(process.cwd(), 'tools', 'awin-membership-plan.mjs');
  execFileSync(process.execPath, [tool, '--site', `mgw=${f}`, '--list', join(dir, 'list.csv'), '--out', join(dir, 'out'), '--now', '2026-10-26T22:00:00Z', '--known', 'none']);
  const summary = JSON.parse(readFileSync(join(dir, 'out', 'summary.json'), 'utf8'));
  assert.deepEqual(summary.map(s => [s.id, s.level]), [['125248', 'red'], ['30645', 'green'], ['122382', 'green']]);
  // Without a list nothing is known: ΠΡΟΣΟΧΗ for all, not ΠΡΟΒΛΗΜΑ (L79); with the repo's file Finediam is ΕΝΤΑΞΕΙ.
  execFileSync(process.execPath, [tool, '--site', `mgw=${f}`, '--out', join(dir, 'out2'), '--known', 'none']);
  assert.match(readFileSync(join(dir, 'out2', 'report.txt'), 'utf8'), /Σύνολο: 0 🔴 ΠΡΟΒΛΗΜΑ · 3 🟡 ΠΡΟΣΟΧΗ/);
  execFileSync(process.execPath, [tool, '--site', `mgw=${f}`, '--out', join(dir, 'out3')]);
  const s3 = JSON.parse(readFileSync(join(dir, 'out3', 'summary.json'), 'utf8'));
  assert.equal(s3.find(s => s.id === '125248').level, 'green');
});
