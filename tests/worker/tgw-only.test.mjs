// L92: the TGW plan CLI takes --only, so the refresh can load one shop at a time, each with its own approval,
// and the finish step hides missing products only for that shop. The report warns that cross-shop duplicates are not checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, '..', '..', 'tools', 'tgw-import-plan.mjs');

test('CLI --only: plans just the named shop, and its finish SQL names only that shop', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgw-only-'));
  const arch = join(dir, 'awin');
  mkdirSync(arch);
  const csv = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean\n' +
    'https://www.awin1.com/pclick.php?p=1&a=1&m=123932,Sony WH-1000XM5 Wireless Headphones,1,JB-1,https://img.example/1.jpg,Audio,279.00,GBP,Sony,1,4006381333931\n';
  writeFileSync(join(arch, 'AWIN_123932_114093.csv.gz'), gzipSync(csv));
  const out = join(dir, 'plan');
  execFileSync(process.execPath, [cli, '--archive', arch, '--out', out, '--only', '123932'], { stdio: 'pipe' });
  const report = readFileSync(join(out, 'report.txt'), 'utf8');
  assert.match(report, /\(only these\)/);
  assert.match(report, /duplicates with the other shops of the site are NOT checked/);
  assert.match(report, /Joybuy \(123932/);
  assert.doesNotMatch(report, /PCHUB\.UK \(126641/);
  const finish = readFileSync(join(out, 'sql', '9999-finish.sql'), 'utf8');
  assert.match(finish, /awin_advertiser_id IN \(123932\)/);
  assert.doesNotMatch(finish, /126641|61655|125822/);
  assert.ok(readdirSync(join(out, 'sql')).length >= 2);
});
