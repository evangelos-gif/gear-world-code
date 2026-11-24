// Linkwise, 24 Nov 2026 (lessons L230): 7 of the 8 new programmes (SHEIN, Abito Shop, geekbuying, Antallaktikaonline,
// EM Gems and Diamonds, De-sign it, Aliexpress) gave no feed, and the report said only "no product_name column". Now the
// tool says what came (an empty answer, a web page, or the first line, never the affiliate code), a programme number may
// have one digit (Tokotoukan is 5), a download never deletes the unfinished file of another programme or of a download
// still running in another window, and Aliexpress and Panora, like the 5 big shops, never reach the 13 sites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isLinkwiseLink } from '../../tools/network-links.mjs';
import { linkwiseFeedUrl, isProgrammeId, downloadProgramme, notAFeed } from '../../tools/linkwise-feed.mjs';
import * as LW from '../../tools/import-rules/lib/linkwise.mjs';
import { PROGRAMMES } from '../../tools/import-rules/lib/linkwise-programmes.mjs';
import { linkwiseSection } from '../../tools/import-rules/lib/linkwise-sections.mjs';

// A made-up affiliate code: the real one never goes into the repository.
const CODE = ['CD', '0007788'].join('');

test('L230: a Linkwise programme number has 1 to 9 digits (Tokotoukan is 5)', () => {
  for (const ok of ['5', 5, '12', '13924', '123456789']) assert.equal(isProgrammeId(ok), true, String(ok));
  for (const bad of ['', 'x5', '5a', '1234567890', '-5', '5 ', null, undefined]) assert.equal(isProgrammeId(bad), false, String(bad));
  assert.ok(linkwiseFeedUrl(CODE, 5).includes('/proginc-5/progex-0/'));
  assert.throws(() => linkwiseFeedUrl(CODE, '1234567890'), /programme id/);
  const link = `https://go.linkwi.se/z/5-0/${CODE}/?lnkurl=${encodeURIComponent('https://www.tokotoukan.gr/p/1')}`;
  assert.equal(isLinkwiseLink(link), true);
  assert.equal(isLinkwiseLink(link, CODE), true);
  assert.equal(isLinkwiseLink(link.replace('/z/5-0/', '/z/-0/')), false, 'no programme');
  const ps = readFileSync('tools/linkwise-feed-download.ps1', 'utf8');
  assert.ok(!ps.includes("'^\\d{2,9}$'"), 'the download tool takes one-digit programmes too');
  assert.equal((ps.match(/'\^\\d\{1,9\}\$'/g) || []).length, 2);
});

test('L230: when Linkwise gives no feed, the report says what came, never the affiliate code', async () => {
  assert.equal(notAFeed({ bytes: 0, head: '' }), 'empty answer (0 bytes)');
  assert.equal(notAFeed({ bytes: 3, head: '﻿\r\n' }, 'text/csv; charset=utf-8'), 'empty answer (3 bytes, text/csv)');
  const page = notAFeed({ bytes: 900, head: `<!DOCTYPE html><html><head><title>Linkwise | Είσοδος ${CODE}</title>` }, 'text/html');
  assert.match(page, /^a web page, not a feed \(900 bytes, title "Linkwise \| Είσοδος CD\*\*\*"\)$/);
  const text = notAFeed({ bytes: 60, head: `Program not joined for ${CODE}\nmore` }, 'text/plain', CODE);
  assert.equal(text, 'no product_name column (60 bytes, first line "Program not joined for ***")');
  const other = ['CD', '123456'].join('');
  assert.ok(!notAFeed({ bytes: 9, head: `${other},x` }).includes(other), 'any affiliate code is hidden');

  const dir = mkdtempSync(join(tmpdir(), 'gw-lw230-'));
  let body = '';
  let type = 'text/csv';
  const fetchImpl = async () => new Response(body, { status: 200, headers: { 'content-type': type } });
  const empty = await downloadProgramme({ code: CODE, programId: 13924, archive: dir, stamp: 'A', fetchImpl });
  assert.deepEqual(empty, { programId: 13924, ok: false, rows: 0, why: 'empty answer (0 bytes, text/csv)' });
  body = `<html><head><title>Login</title></head><body>${CODE}</body></html>`;
  type = 'text/html; charset=utf-8';
  const html = await downloadProgramme({ code: CODE, programId: 5, archive: dir, stamp: 'A', fetchImpl });
  assert.equal(html.ok, false);
  assert.match(html.why, /^a web page, not a feed \(\d+ bytes, title "Login"\)$/);
  body = 'product_id,product_name,tracking_url\n';
  type = 'text/csv';
  assert.equal((await downloadProgramme({ code: CODE, programId: 5, archive: dir, stamp: 'A', fetchImpl })).why, 'empty feed');
  for (const r of [empty, html]) assert.ok(!JSON.stringify(r).includes(CODE));
  assert.deepEqual(readdirSync(dir), [], 'nothing is left in the feed folder');
  assert.equal(existsSync(join(dir, 'LINKWISE_13924.csv.gz.part')), false);
});

test('L230: the download clears only its own unfinished files, and stops when another download is still writing', () => {
  const ps = readFileSync('tools/linkwise-feed-download.ps1', 'utf8');
  assert.ok(!ps.includes("-Filter 'LINKWISE_*.csv.gz.part'"), 'never every .part file of the folder');
  assert.ok(ps.includes("'LINKWISE_{0}.csv.gz.part' -f $id"), 'the .part file of each programme of this run');
  assert.ok(ps.includes('AddMinutes(-15)') && ps.includes('Finish 5'), 'a .part written in the last 15 minutes stops the run');
  // Each reason is explained in Greek (the tool prints it under the line).
  for (const k of ["'empty answer*'", "'a web page*'", "'no product_name column*'", "'empty feed*'"]) assert.ok(ps.includes(k), k);
  const b = readFileSync('tools/linkwise-feed-download.ps1');
  assert.deepEqual([...b.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 with BOM');
  assert.ok(!/[^\r]\n/.test(b.toString('utf8')), 'CRLF');
});

test('L230: Aliexpress and Panora, like the 5 big shops, are only for Mega Stores: never on the 13 sites', async () => {
  for (const name of ['Aliexpress', 'AliExpress', 'Panora', 'Public', 'Sephora', 'e-shop.gr', 'Kotsovolos', 'AB Vasilopoulos', 'ΑΒ Βασιλόπουλος', 'Κωτσόβολος']) assert.ok(LW.NEVER_SHOPS.test(LW.gr(name)), name);
  for (const name of ['Panorama Optics', 'Pandora', 'Republic', 'publicity', 'SHEIN', 'geekbuying', 'Κωτσοβολοσάκης']) assert.equal(LW.NEVER_SHOPS.test(LW.gr(name)), false, name);
  assert.deepEqual([...LW.NEVER_PROGRAMMES].sort((a, b) => a - b), [138, 469, 11183, 11754, 12158, 13026, 13327]);
  for (const id of LW.NEVER_PROGRAMMES) {
    assert.equal(existsSync(`tools/import-rules/lw-${id}.mjs`), false, `no import rules for ${id}`);
    assert.equal(PROGRAMMES.some(p => p.id === id), false, `${id} is not in the table of the 13 sites`);
    await assert.rejects(LW.linkwiseRules(id), /never goes on the sites/);
  }
  for (const s of readdirSync('sites').filter(d => existsSync(`sites/${d}/sources.json`))) {
    const src = JSON.parse(readFileSync(`sites/${s}/sources.json`, 'utf8')).sources || [];
    for (const x of src.filter(x => x.network === 'linkwise')) {
      assert.equal(LW.NEVER_PROGRAMMES.has(Number(x.advertiserId)), false, `${s}: ${x.advertiserId}`);
      assert.equal(LW.NEVER_SHOPS.test(String(x.retailer || '')), false, `${s}: ${x.retailer}`);
    }
  }
  // The new engine refuses such a shop even if someone adds it to a sources.json.
  const r = linkwiseSection('tgw', 'Ασύρματα ακουστικά Bluetooth', 'Ήχος > Ακουστικά', { advertiserId: 11183, network: 'linkwise', retailer: 'Aliexpress GR' });
  assert.match(JSON.stringify(r), /never on the sites/);
  const p = linkwiseSection('tgw', 'Ασύρματα ακουστικά Bluetooth', 'Ήχος > Ακουστικά', { advertiserId: 13327, network: 'linkwise', retailer: 'Panora GR' });
  assert.match(JSON.stringify(p), /never on the sites/);
});
