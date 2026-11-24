// Clean-up rule: the products of shops whose affiliate programme was closed or removed (lessons L225). A click on them
// would not pay and may land on a shop that no longer takes our visitors, so the cards are hidden the day we hear of it.
// 24 Nov 2026 (chat 7's Gmail check, the Linkwise email of 23 Nov to Julia): The Body Shop GR (Linkwise 11742, removed by
// Linkwise at the end of 23 Nov, on WGW) and Camping World UK (Awin 124426, closed 24 Nov, on KGW; its 2,317 cards on
// Travel Gear World are hidden by the VGW import, sites/vgw/sources.json "closed"). Their import rules reject every
// product from now on (tools/import-rules/lw-11742.mjs, campingworld-kids.mjs), so no refresh shows them again.
// Hidden: an active product whose retailer is one of CLOSED below. Nothing is deleted (is_active = 0, ids kept for a
// rollback). A shop that reopens: take it out of CLOSED and out of its rules' closed note, then import it again.
// The SQL avoids the characters % < > & | ^ because the PowerShell tools pass it on a cmd line (wrangler --command).
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

export const CLOSED = [
  { retailer: 'The Body Shop GR', network: 'Linkwise 11742', since: '2026-11-23', sites: ['wgw'] },
  { retailer: 'Camping World UK', network: 'Awin 124426', since: '2026-11-24', sites: ['kgw'] }
];

const quote = s => `'${String(s).replace(/'/g, "''")}'`;
export const REASON_SQL = `CASE ${CLOSED.map(c => `WHEN retailer = ${quote(c.retailer)} THEN ${quote(`${c.retailer}: programme closed (${c.network}, ${c.since})`)}`).join(' ')} ELSE '' END`;

// One row per product to hide: id, reason, site_category, product_name.
export function hideSelect() {
  return `WITH h AS (SELECT id, reason, site_category, product_name FROM
    (SELECT id, site_category, product_name, ${REASON_SQL} AS reason FROM products WHERE is_active = 1 AND retailer IN (${CLOSED.map(c => quote(c.retailer)).join(', ')})) WHERE reason != '')`;
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

// node tools/cleanup-rules/closed.mjs <summary|samples|ids|kept>  -> prints one SQL line
// node tools/cleanup-rules/closed.mjs update <ids.txt> <0|1> <out.sql>
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
