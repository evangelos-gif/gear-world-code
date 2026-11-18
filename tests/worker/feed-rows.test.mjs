// tools/feed-rows.mjs (lessons L185): rows and header of a gzip feed, read as a stream so a feed over 512 MB no longer
// stops the downloaders with ERR_STRING_TOO_LONG.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, createGzip } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { feedRows } from '../../tools/feed-rows.mjs';

const dir = mkdtempSync(join(tmpdir(), 'feed-rows-'));
const tool = new URL('../../tools/feed-rows.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('feed-rows: header check and rows like the old check (empty lines and a last line without newline)', async () => {
  const f = join(dir, 'a.csv.gz');
  writeFileSync(f, gzipSync('aw_deep_link,Product_Name,price\r\nx,a,1\r\n\r\n  \ny,b,2\nz,c,3'));
  assert.deepEqual(await feedRows(f), { ok: true, rows: 3 });
  assert.deepEqual(await feedRows(f, ['product_name', 'aw_deep_link']), { ok: true, rows: 3 });
  assert.deepEqual(await feedRows(f, ['merchant_name']), { ok: false, rows: 3 });
  assert.equal(execFileSync(process.execPath, [tool, f, 'product_name', 'aw_deep_link'], { encoding: 'utf8' }).trim(), 'ok 3');
});

test('feed-rows: a file that is not gzip, a missing file and a header-only file', async () => {
  const bad = join(dir, 'b.csv.gz');
  writeFileSync(bad, '<html>Error</html>');
  assert.deepEqual(await feedRows(bad), { ok: false, rows: 0 });
  assert.deepEqual(await feedRows(join(dir, 'missing.csv.gz')), { ok: false, rows: 0 });
  assert.equal(execFileSync(process.execPath, [tool, join(dir, 'missing.csv.gz')], { encoding: 'utf8' }).trim(), 'bad 0');
  const head = join(dir, 'c.csv.gz');
  writeFileSync(head, gzipSync('product_name,price\n'));
  assert.deepEqual(await feedRows(head), { ok: true, rows: 0 });
});

test('feed-rows: a big feed is counted as a stream (200,000 rows, the header split over two chunks)', async () => {
  const f = join(dir, 'big.csv.gz');
  await new Promise((resolve, reject) => {
    const out = createWriteStream(f);
    const gz = createGzip();
    gz.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    gz.write('aw_deep_link,' + 'x'.repeat(70000) + ',product_name\n');
    const line = 'https://www.awin1.com/pclick.php?p=1,' + 'Some product name with words '.repeat(4) + ',9.99\n';
    for (let i = 0; i < 200000; i++) gz.write(line);
    gz.end();
  });
  const r = await feedRows(f);
  assert.equal(r.rows, 200000);
});
