// Clean-up rules for Construction Gear World (a site for trades and DIY), 21 Oct 2026.
// General shops (InStock UK, Joybuy UK) send products that have nothing to do with construction: 1000-piece jigsaw
// puzzles in "Power Tools", herbal "respiratory support" supplements in "PPE", toys and baby items, Apple Watch parts.
// Only those general shops are checked: a tool shop's "jigsaw" is a saw and stays.
// Nothing is deleted: rows get is_active = 0, and the ids are kept for a rollback.
// The SQL is short ASCII without % < > & | ^ or double quotes, because the PowerShell tools pass it on a cmd line.

const sq = w => w.replace(/'/g, "''");
// instr() is 0 when the word is missing, so it works as true/false (and keeps the SQL short for the cmd line).
const has = (col, words) => '(' + words.map(w => `instr(${col}, '${sq(w)}')`).join(' OR ') + ')';

export const RETAILERS = ['InStock UK', 'Joybuy UK'];

export const HEALTH = ['supplement', 'vitamin', 'capsule', ' caps)', 'tincture', 'gummies', 'softgel', 'probiotic', 'collagen',
  'respiratory support', 'respiratory health', 'respiratory tract', 'respiratory formula', 'respiratory relief', 'immune support',
  'immune defense', 'lung support', 'lung health', 'for lungs', 'mullein', 'herbal', 'chest rub', 'toothpaste', 'oregano oil',
  'black seed', 'mushroom', 'saline', 'l-lysine', 'nac ', 'n-acetyl', 'quercetin', 'beadlets', 'licorice', 'liquid drops',
  'tablets, 1 box', 'massager', 'sound machine', 'for healing'];
export const TOY = ['jigsaw puzzle', 'piece jigsaw', 'puzzle', 'toy', 'game machine', 'christmas'];
export const KIDS = ['baby', 'infant', 'toddler', 'children', 'kids', 'for cats', 'for dogs'];
export const GADGET = ['apple watch', 'iphone', 'ps4', 'watch strap', 'pedicure', 'manicure', 'nail clipper', 'tenderizer', 'meat hammer'];
// A screwdriver or repair kit for phones and watches is a hand tool: it stays.
export const GADGET_NOT = ['screwdriver', 'repair', 'tool kit', 'toolkit'];

// One row per product to hide: id, reason, site_category, product_name.
export function hideSelect() {
  return `WITH b AS (SELECT id, site_category, product_name, lower(product_name) AS n FROM products
    WHERE is_active = 1 AND retailer IN (${RETAILERS.map(r => `'${sq(r)}'`).join(', ')})),
  h AS (SELECT id, CASE
      WHEN ${has('n', HEALTH)} THEN 'health product or supplement'
      WHEN ${has('n', TOY)} THEN 'puzzle, toy or game'
      WHEN ${has('n', KIDS)} THEN 'for babies, children or pets'
      WHEN ${has('n', GADGET)} AND NOT ${has('n', GADGET_NOT)} THEN 'phone, watch, beauty or kitchen item'
      ELSE '' END AS reason, site_category, product_name FROM b)`;
}
const H = () => `${hideSelect()}, x AS (SELECT * FROM h WHERE reason != '')`;

export const summarySql = () => `${H()} SELECT reason, site_category, COUNT(*) AS n FROM x GROUP BY reason, site_category ORDER BY reason, n DESC`;
export const samplesSql = () => `${H()} SELECT reason, product_name FROM (SELECT reason, product_name, ROW_NUMBER() OVER (PARTITION BY reason ORDER BY random()) AS r FROM x) WHERE r BETWEEN 1 AND 15 ORDER BY reason`;
export const idsSql = () => `${H()} SELECT id FROM x ORDER BY id`;
export const keptSql = () => `${H()} SELECT site_category, COUNT(*) AS n FROM products WHERE is_active = 1 AND id NOT IN (SELECT id FROM x) GROUP BY site_category ORDER BY n DESC`;

export function updateSql(ids, active) {
  const out = [];
  for (let i = 0; i < ids.length; i += 500) {
    const part = ids.slice(i, i + 500).map(Number).filter(Number.isFinite);
    out.push(`UPDATE products SET is_active = ${active ? 1 : 0}, updated_at = datetime('now') WHERE id IN (${part.join(', ')});`);
  }
  return out.join('\n') + '\n';
}

// node tools/cleanup-rules/trade.mjs <summary|samples|ids|kept>  -> prints one SQL line
// node tools/cleanup-rules/trade.mjs update <ids.txt> <0|1> <out.sql>
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
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
