// Clean-up rule (lessons L84): the old "Watch Enclave Affiliate Programme" cards on MGW (294) and WGW (106), written by the
// Hub import router on 28 Sep 2026 (awin_product_id '122382:<Shopify variant>', names with broken dashes "â€“"), are the
// same watches as the "Watch Enclave" cards that the Awin feed refreshes (same merchant_product_id, checked on 29 Oct
// 2026: all 294 on MGW, 99 of 106 on WGW). Every watch was shown twice, once with a price from 28 Sep.
// It hides an old card ONLY when the same watch is active under "Watch Enclave" (at least 30 of them on the site), so a
// watch that only the old card has stays. Nothing is deleted (is_active = 0), and the ids are kept for a rollback.
// The SQL avoids the characters % < > & | ^ because the PowerShell tools pass it on a cmd line (wrangler --command).
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const OLD = "retailer = 'Watch Enclave Affiliate Programme'";
const NEW = "retailer = 'Watch Enclave' AND is_active = 1";

export function hideSelect() {
  return `WITH n AS (SELECT merchant_product_id FROM products WHERE ${NEW}),
    h AS (SELECT id, 'second card for a watch already shown under Watch Enclave' AS reason, site_category, product_name FROM products
    WHERE is_active = 1 AND ${OLD} AND merchant_product_id IN (SELECT merchant_product_id FROM n) AND (SELECT COUNT(*) FROM n) BETWEEN 30 AND 100000000)`;
}

export const summarySql = () => `${hideSelect()} SELECT reason, site_category, COUNT(*) AS n FROM h GROUP BY reason, site_category ORDER BY reason, n DESC`;
export const samplesSql = () => `${hideSelect()} SELECT reason, product_name FROM (SELECT reason, product_name, ROW_NUMBER() OVER (PARTITION BY reason ORDER BY random()) AS r FROM h) WHERE r BETWEEN 1 AND 15 ORDER BY reason`;
export const idsSql = () => `${hideSelect()} SELECT id FROM h ORDER BY id`;
export const keptSql = () => `${hideSelect()} SELECT site_category, COUNT(*) AS n FROM products WHERE is_active = 1 AND id NOT IN (SELECT id FROM h) GROUP BY site_category ORDER BY n DESC`;

export function updateSql(ids, active) {
  const out = [];
  for (let i = 0; i < ids.length; i += 500) {
    const part = ids.slice(i, i + 500).map(Number).filter(Number.isFinite);
    out.push(`UPDATE products SET is_active = ${active ? 1 : 0}, updated_at = datetime('now') WHERE id IN (${part.join(', ')});`);
  }
  return out.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [what, a, b, c] = process.argv.slice(2);
  const one = s => s.replace(/\s+/g, ' ').trim();
  if (what === 'summary') console.log(one(summarySql()));
  else if (what === 'samples') console.log(one(samplesSql()));
  else if (what === 'ids') console.log(one(idsSql()));
  else if (what === 'kept') console.log(one(keptSql()));
  else if (what === 'update') {
    const ids = readFileSync(a, 'utf8').split(/\s+/).filter(Boolean);
    writeFileSync(c, updateSql(ids, b === '1'));
  } else { console.error('usage'); process.exit(2); }
}
