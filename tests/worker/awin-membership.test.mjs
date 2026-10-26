// Job 4 of 25 Oct 2026 (lessons L61): which Awin programmes still pay for the shops on the older sites. Links in the shape
// of the live databases (26 Oct 2026): cread.php?awinmid=..., pclick.php?...&m=..., plain shop links (GGW Tooled Up), and
// Juicy Couture UK links whose ?ued= had no product address ("&utm_source=aw...").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { advertiserOf, readAwinList, planMembership, renderMembershipReport } from '../../tools/awin-membership-plan.mjs';

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

test('L61: member and fresh = ΕΝΤΑΞΕΙ; not a member or not in the list = ΠΡΟΒΛΗΜΑ; stale feed = ΠΡΟΣΟΧΗ; broken links counted', async () => {
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
  assert.equal(by['19471'].level, 'red');
  assert.match(by['19471'].reason, /δεν υπάρχει στη λίστα/);
  assert.equal(by['19471'].bad, 43);
  assert.equal(by['56439'].level, 'yellow', 'Red Gorilla: member, feed from 15 May');
  assert.deepEqual(plan.plain.map(x => x.retailer), ['Tooled Up']);
  assert.deepEqual(plan.programmes.map(p => p.level), ['red', 'red', 'yellow', 'green', 'green'], 'problems first');
  const report = renderMembershipReport(plan);
  assert.match(report, /Σύνολο: 2 🔴 ΠΡΟΒΛΗΜΑ · 1 🟡 ΠΡΟΣΟΧΗ · 1 με χαλασμένα links\. Ενεργά προϊόντα σε προγράμματα που δεν πληρώνουν: 310\./);
  assert.match(report, /🔴 ΠΡΟΒΛΗΜΑ: Finediam \(Awin 125248\) \| MGW 267 \| δεν είσαι μέλος/);
  assert.match(report, /https:\/\/ui\.awin\.com\/merchant-profile\/19471/);
  assert.match(report, /43 links χωρίς διεύθυνση προϊόντος/);
  assert.match(report, /GGW: Tooled Up \(710\)/);
  assert.doesNotMatch(report, /merchant-profile\/30645/, 'no link for a programme that is fine');
});

test('command line: wrangler output files and the Awin list in, report and summary out; without a list everything is "not in the list"', () => {
  const dir = mkdtempSync(join(tmpdir(), 'awin-cli-'));
  const f = join(dir, 'mgw.json.txt');
  writeFileSync(f, 'wrangler text\n' + JSON.stringify([{ results: sites()[0].rows, success: true }]));
  writeFileSync(join(dir, 'list.csv'), LIST);
  const tool = join(process.cwd(), 'tools', 'awin-membership-plan.mjs');
  execFileSync(process.execPath, [tool, '--site', `mgw=${f}`, '--list', join(dir, 'list.csv'), '--out', join(dir, 'out'), '--now', '2026-10-26T22:00:00Z']);
  const summary = JSON.parse(readFileSync(join(dir, 'out', 'summary.json'), 'utf8'));
  assert.deepEqual(summary.map(s => [s.id, s.level]), [['125248', 'red'], ['30645', 'green'], ['122382', 'green']]);
  execFileSync(process.execPath, [tool, '--site', `mgw=${f}`, '--out', join(dir, 'out2')]);
  assert.match(readFileSync(join(dir, 'out2', 'report.txt'), 'utf8'), /Σύνολο: 3 🔴 ΠΡΟΒΛΗΜΑ/);
});
