// What really sells and from which site (1 Nov 2026, lessons L64): the Awin Publisher API transactions, read-only.
// Transactions in the shape the API returns: clickRefs.clickRef is our "<site>-<product id>" (src/engine.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { siteOf, readTransactions, readProgrammes, productIdsBySite, planSales, renderSalesReport } from '../../tools/awin-sales-plan.mjs';

const tx = (id, o) => ({ id, advertiserId: 496, commissionStatus: 'pending', commissionAmount: { amount: 1.2, currency: 'GBP' },
  saleAmount: { amount: 40, currency: 'GBP' }, transactionDate: '2026-10-20T10:00:00', clickDate: '2026-10-20T09:50:00', ...o });

test('the site and product come from our clickref; else from the page; else unknown', () => {
  assert.deepEqual(siteOf(tx(1, { clickRefs: { clickRef: 'tgw-6883' } })), { site: 'tgw', productId: 6883, promoId: null, ref: 'tgw-6883', from: 'clickref' });
  assert.equal(siteOf(tx(2, { clickRefs: { clickRef: 'cgw-promo-12' } })).promoId, 12);
  assert.equal(siteOf(tx(3, { clickRefs: { clickRef: 'PGW-397' } })).site, 'pgw');
  assert.equal(siteOf(tx(4, { clickRefs: {}, publisherUrl: 'https://www.constructiongearworld.com/product/x-5/' })).site, 'cgw');
  assert.equal(siteOf(tx(5, { clickRef: 'xyz-1', url: 'https://example.com' })).site, '');
});

test('several 31-day answers: each sale once; programme names; product ids per site', () => {
  const a = JSON.stringify([tx(10, { clickRefs: { clickRef: 'cgw-13819' } }), tx(11, { clickRefs: { clickRef: 'tgw-6883' } })]);
  const b = JSON.stringify([tx(11, { clickRefs: { clickRef: 'tgw-6883' } }), tx(12, { clickRefs: { clickRef: 'cgw-13819' } })]);
  const list = readTransactions([a, '﻿' + b]);
  assert.equal(list.length, 3);
  assert.deepEqual(productIdsBySite(list), { cgw: [13819], tgw: [6883] });
  assert.deepEqual(readProgrammes(JSON.stringify([{ id: 496, name: 'Tooled Up' }, { id: 7 }])), { 496: 'Tooled Up' });
  assert.throws(() => readTransactions(['{"error":"unauthorised"}']));
});

test('totals leave declined sales out; by site and shop; every sale listed with its product name', () => {
  const list = [
    tx(1, { clickRefs: { clickRef: 'cgw-13819' }, commissionAmount: { amount: 1.35, currency: 'GBP' }, saleAmount: { amount: 45, currency: 'GBP' } }),
    tx(2, { clickRefs: { clickRef: 'cgw-13819' }, commissionStatus: 'approved', transactionDate: '2026-10-25T08:00:00' }),
    tx(3, { clickRefs: { clickRef: 'tgw-6883' }, advertiserId: 61655, commissionStatus: 'declined', declineReason: 'Returned' }),
    tx(4, { clickRefs: {}, advertiserId: 123932, commissionAmount: { amount: 2, currency: 'EUR' }, saleAmount: { amount: 30, currency: 'EUR' } })
  ];
  const plan = planSales({ transactions: list, programmes: { 496: 'Tooled Up', 61655: 'Back to the Office' }, names: { 'cgw-13819': 'Stabila Masons Spirit Level 48"' } });
  assert.equal(plan.live, 3);
  assert.deepEqual(plan.commission, { GBP: 2.55, EUR: 2 });
  assert.equal(plan.unknown, 1);
  assert.equal(plan.bySite[0].key, 'cgw');
  const text = renderSalesReport(plan, { from: '2026-08-03', to: '2026-11-01' });
  assert.match(text, /Σύνολο: 4 πωλήσεις\. Χωρίς τις απορριφθείσες: 3, αξία £85\.00 \+ €30\.00, προμήθεια £2\.55 \+ €2\.00/);
  assert.match(text, /CGW\s+2 πωλήσεις · προμήθεια £2\.55/);
  assert.match(text, /Tooled Up \(Awin 496\): 2 πωλήσεις/);
  assert.match(text, /2026-10-25 {2}CGW {5}Tooled Up {2}«Stabila Masons Spirit Level 48"» \(προϊόν #13819\) {2}αξία £40\.00 {2}προμήθεια £1\.20 {2}εγκρίθηκε/);
  assert.match(text, /Back to the Office .* απορρίφθηκε \(Returned\)/);
  assert.match(text, /άγνωστο = η πώληση δεν έχει clickref/);
  assert.equal(renderSalesReport(planSales({ transactions: [] })).includes('Καμία πώληση'), true);
});

test('command line: ids for the database look-up, then the report with names from wrangler output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw-sales-'));
  const w1 = join(dir, 'w1.json');
  writeFileSync(w1, JSON.stringify([tx(1, { clickRefs: { clickRef: 'cgw-13819' } }), tx(2, { clickRefs: { clickRef: 'agw-40216' }, advertiserId: 82533 })]));
  const tool = new URL('../../tools/awin-sales-plan.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  execFileSync(process.execPath, [tool, '--in', w1, '--ids-out', join(dir, 'ids.txt')]);
  assert.equal(readFileSync(join(dir, 'ids.txt'), 'utf8'), 'agw car-gear-world 40216\ncgw construction-gear-customers 13819\n');
  writeFileSync(join(dir, 'cgw.txt'), 'some warning\n[{"results":[{"id":13819,"product_name":"Bahco Schlüssel"}],"success":true}]');
  writeFileSync(join(dir, 'prog.json'), JSON.stringify([{ id: 496, name: 'Tooled Up' }]));
  execFileSync(process.execPath, [tool, '--in', w1, '--programmes', join(dir, 'prog.json'), '--names', `cgw=${join(dir, 'cgw.txt')}`, '--from', '2026-10-01', '--to', '2026-11-01', '--out', join(dir, 'out')]);
  const rep = readFileSync(join(dir, 'out', 'report.txt'), 'utf8');
  assert.match(rep, /«Bahco Schlüssel» \(προϊόν #13819\)/);
  assert.match(rep, /AGW\s+Awin 82533/);
  assert.equal(JSON.parse(readFileSync(join(dir, 'out', 'summary.json'), 'utf8')).sales, 2);
});
