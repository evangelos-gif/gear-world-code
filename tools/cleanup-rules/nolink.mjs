// Clean-up rule: products whose Awin link opens no product page. Found on 4 Nov 2026 on KGW: all 43 Juicy Couture UK
// cards (and 1 on HGW) had an Awin link "cread.php?awinmid=19471&awinaffid=3057233&ued=&utm_source=aw..." with no shop
// address after "ued=", so a parent who pressed "Buy" landed on the shop's home page, not on the bag they chose. The
// programme has no product feed, so the links cannot be refreshed (owner, 6 Nov 2026: hide them and ask for a feed; L96).
// Hidden: an active product whose link is an Awin "cread.php" link without "ued=http" (no product page). Product-level
// Awin links (pclick.php?p=...), CJ links and plain shop links are kept. The reason names the shop, so the dry run
// shows which shops it would touch before anything changes.
// Nothing is deleted: rows get is_active = 0, and the ids are kept for a rollback. A later import or refresh that
// brings a real product link shows the card again (the import sets is_active = 1).
// The SQL avoids the characters % < > & | ^ because the PowerShell tools pass it on a cmd line (wrangler --command).
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

export const REASON_SQL = `CASE WHEN instr(lower(affiliate_url), 'awin1.com/cread.php') BETWEEN 1 AND 100000
    AND NOT (instr(lower(affiliate_url), 'ued=http') BETWEEN 1 AND 100000)
  THEN replace('RETAILER: Awin link without a product page', 'RETAILER', coalesce(retailer, '?')) ELSE '' END`;

// One row per product to hide: id, reason, site_category, product_name.
export function hideSelect() {
  return `WITH h AS (SELECT id, reason, site_category, product_name FROM
    (SELECT id, site_category, product_name, ${REASON_SQL} AS reason FROM products WHERE is_active = 1) WHERE reason != '')`;
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

// node tools/cleanup-rules/nolink.mjs <summary|samples|ids|kept>  -> prints one SQL line
// node tools/cleanup-rules/nolink.mjs update <ids.txt> <0|1> <out.sql>
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
