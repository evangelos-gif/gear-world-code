// Clean-up rule: products shown without a picture. Found on 23 Oct 2026 on GGW: 114 Gardenista and 7 Mint Outdoor
// products whose feed has no shop image, so the plan took Awin's placeholder (images2.productserve.com/noimage.gif) and
// the site showed "No image available". A product with no picture does not sell and looks broken: hide it.
// Hidden: an active product whose image_url is empty, not https, or Awin's "noimage" placeholder.
// Nothing is deleted: rows get is_active = 0, and the ids are kept for a rollback. A later import that finds a real
// picture for the same product shows it again (the import sets is_active = 1).
// The SQL avoids the characters % < > & | ^ because the PowerShell tools pass it on a cmd line (wrangler --command).
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

export const REASON_SQL = `CASE WHEN image_url IS NULL OR trim(image_url) = '' THEN 'no picture'
  WHEN instr(lower(image_url), 'productserve.com/noimage') BETWEEN 1 AND 100000 THEN 'Awin placeholder picture (noimage)'
  WHEN NOT (substr(lower(image_url), 1, 8) = 'https://') THEN 'picture not on https' ELSE '' END`;

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

// node tools/cleanup-rules/noimage.mjs <summary|samples|ids|kept>  -> prints one SQL line
// node tools/cleanup-rules/noimage.mjs update <ids.txt> <0|1> <out.sql>
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
