// Lessons L236 (26 Nov 2026, chat 3): a re-import used as a refresh (fresh downloads first, then
// tools/legacy-import-batch.ps1 -FreshHours N) takes only feed files downloaded in the last N hours. An older copy - its
// download failed or was refused - would otherwise write today's «Price checked» on old prices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planLegacyImport, staleFeedFiles } from '../../tools/legacy-import-plan.mjs';

const HEAD = 'data_feed_id,merchant_id,merchant_name,aw_product_id,aw_deep_link,aw_image_url,aw_thumb_url,category_id,category_name,brand_id,brand_name,merchant_product_id,merchant_category,product_name,description,merchant_deep_link,merchant_image_url,search_price,stock_quantity,parent_product_id\n';
const row = (id, name, brand, cat, handle, price, qty, parent = '') =>
  `116078,30645,Coes,${id},https://www.awin1.com/pclick.php?p=${id}&a=3057233&m=30645,,,1,x,1,"${brand}",${id}0,${cat},"${name}",,https://www.coes.co.uk/products/${handle}?variant=${id}0,https://cdn.shopify.com/${id}.png,${price},${qty},${parent}\n`;

const NOW = new Date('2026-11-26T18:00:00Z');
function archive(downloadedAt) {
  const dir = mkdtempSync(join(tmpdir(), 'l236-'));
  const f = join(dir, 'AWIN_30645_116078.csv.gz');
  writeFileSync(f, gzipSync(HEAD + row(1, 'Barbour Beaufort Wax Jacket', 'Barbour', 'Menswear', 'beaufort-wax-jacket', 299, 1)
    + row(4, 'Holland Cooper Contour Skinny Jeans', 'Holland Cooper', 'Womenswear', 'contour-skinny-jeans', 99, 4)));
  const t = downloadedAt.getTime() / 1000;
  utimesSync(f, t, t);
  return { dir, f };
}

test('L236: staleFeedFiles lists only files downloaded before the limit, with their time', () => {
  const { f } = archive(new Date('2026-11-26T09:00:00Z'));
  assert.deepEqual(staleFeedFiles([f], 12, NOW), []);
  assert.deepEqual(staleFeedFiles([f], 6, NOW), [{ file: 'AWIN_30645_116078.csv.gz', at: '2026-11-26 09:00 UTC' }]);
  assert.equal(staleFeedFiles([join(tmpdir(), 'no-such-feed.csv.gz')], 6, NOW).length, 1, 'a missing file is never fresh');
});

test('L236: with GW_FEED_MAX_AGE_HOURS the plan refuses an older feed and takes a fresh one', async () => {
  const before = process.env.GW_FEED_MAX_AGE_HOURS;
  try {
    process.env.GW_FEED_MAX_AGE_HOURS = '8';
    const old = archive(new Date('2026-11-24T10:00:00Z'));
    await assert.rejects(
      planLegacyImport({ archive: old.dir, retailer: 'coes', outDir: join(old.dir, 'plan'), now: NOW }),
      e => /AWIN_30645_116078\.csv\.gz: το feed κατέβηκε 2026-11-24 10:00 UTC, πριν από πάνω από 8 ώρες: δεν έγινε εισαγωγή/.test(e.message) && /L236/.test(e.message));
    const fresh = archive(new Date('2026-11-26T16:30:00Z'));
    const r = await planLegacyImport({ archive: fresh.dir, retailer: 'coes', outDir: join(fresh.dir, 'plan'), now: NOW });
    assert.deepEqual(r.files, ['AWIN_30645_116078.csv.gz']);
    delete process.env.GW_FEED_MAX_AGE_HOURS;
    const any = await planLegacyImport({ archive: old.dir, retailer: 'coes', outDir: join(old.dir, 'plan2'), now: NOW });
    assert.deepEqual(any.files, ['AWIN_30645_116078.csv.gz'], 'without the setting nothing changes (dry runs, imports)');
  } finally {
    if (before === undefined) delete process.env.GW_FEED_MAX_AGE_HOURS; else process.env.GW_FEED_MAX_AGE_HOURS = before;
  }
});
