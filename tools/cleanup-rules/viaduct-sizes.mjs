// Clean-up rule: the old Viaduct Clothing cards, ONE PER SIZE ("... - White / L", "... - White / M"), written by the Hub
// import router (awin_product_id '125096:<Shopify variant number>'). Since 23 Oct 2026 the viaduct and viaduct-women
// plans write one card per product page (awin_product_id '125096:<page name>', all sizes), so the old cards are duplicates.
// Safe on its own: it hides old cards ONLY when the site already has at least 30 of the new cards (an import that did not
// run, or failed, leaves nothing to hide). Nothing is deleted (is_active = 0), and the ids are kept for a rollback.
// The SQL avoids the characters % < > & | ^ because the PowerShell tools pass it on a cmd line (wrangler --command).
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const OLD = "retailer = 'Viaduct Clothing' AND awin_product_id GLOB '125096:[0-9]*'";
const NEW = "retailer = 'Viaduct Clothing' AND NOT (awin_product_id GLOB '125096:[0-9]*')";

export function hideSelect() {
  return `WITH h AS (SELECT id, 'old card for one size (now one card per product)' AS reason, site_category, product_name FROM products
    WHERE is_active = 1 AND ${OLD} AND (SELECT COUNT(*) FROM products WHERE is_active = 1 AND ${NEW}) BETWEEN 30 AND 100000000)`;
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
