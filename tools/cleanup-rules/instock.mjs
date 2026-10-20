// Clean-up rules for products already on the older sites (MGW, WGW). Found on 20 Oct 2026:
//  - InStock UK has one product card per size and colour (an hoodie in 8 colours x 8 sizes = 64 cards):
//    keep one card per product (the cheapest), hide the rest.
//  - About 6,000 InStock "watches" are smartwatch straps, screen films, chargers, batteries and spare parts.
//  - Political party merchandise (slogans) from any retailer.
// Nothing is deleted: rows get is_active = 0, and the ids are kept for a rollback.
// The SQL avoids the characters % < > & | ^ because the PowerShell tools pass it on a cmd line (wrangler --command).

const has = (col, words) => '(' + words.map(w => `instr(${col}, '${w.replace(/'/g, "''")}') BETWEEN 1 AND 100000`).join(' OR ') + ')';

export const POLITICAL = ['restore britain', 'restore england', 'restore scotland', 'restore wales', 'detain deport', 'deport',
  'remigration', 'reform uk', 'make america great', 'maga hat', 'party politics', 'uk politics', 'political'];

export const WATCH_ACCESSORY = ['protector', 'protective', 'film', 'tempered glass', 'strap for', 'band for', 'case for', 'cover for',
  'watch band', 'watchband', 'watch strap', 'replacement', 'charging', 'charger', 'cable', 'bumper', 'holder', 'stand ', 'wristband',
  'wrist strap', 'magnetic strap', 'for apple watch', 'for samsung galaxy', 'for garmin', 'for huawei', 'for xiaomi', 'for fitbit',
  'for amazfit', 'for honor', 'for oppo', 'for suunto', 'for tomtom', 'for polar', 'for redmi', 'battery', 'batteries', 'lcd', 'digitizer',
  'screen assembly', 'winding box', 'winder', 'watch shaker', 'repair', 'removal tool', 'spring bar', 'link pin', 'adapter', 'dock'];

// Watch categories: 'Watches' and 'Jewellery & Watches' (matched by the word, so no '&' in the SQL).

// The shop page address inside the Awin link: ...products%2F<handle>%3Fvariant... ('%' is written as '~' first).
const U = `replace(affiliate_url, char(37), '~')`;
const HANDLE = `CASE WHEN instr(${U}, 'products~2F') BETWEEN 1 AND 100000 AND instr(${U}, '~3Fvariant') BETWEEN 1 AND 100000
  THEN substr(${U}, instr(${U}, 'products~2F') + 11, instr(${U}, '~3Fvariant') - instr(${U}, 'products~2F') - 11) END`;

// One row per product to hide: id, reason, site_category, product_name.
export function hideSelect() {
  return `WITH b AS (SELECT id, retailer, site_category, product_name, price, affiliate_url, lower(product_name) AS n,
    substr(lower(retailer), 1, 7) = 'instock' AS ins FROM products WHERE is_active = 1),
  f AS (SELECT id, site_category, product_name, price, ins,
    CASE WHEN ${has('n', POLITICAL)} THEN 'political merchandise'
         WHEN ins AND instr(site_category, 'Watches') BETWEEN 1 AND 100 AND ${has('n', WATCH_ACCESSORY)} THEN 'smartwatch strap, film or spare part'
         ELSE '' END AS reason,
    CASE WHEN ins THEN ${HANDLE} END AS handle FROM b),
  h AS (SELECT id, reason, site_category, product_name FROM f WHERE reason != ''
    UNION ALL
    SELECT id, 'same product, other size or colour', site_category, product_name FROM
      (SELECT id, site_category, product_name, ROW_NUMBER() OVER (PARTITION BY handle ORDER BY price, id) AS rn FROM f WHERE reason = '' AND handle IS NOT NULL)
      WHERE rn BETWEEN 2 AND 100000000)`;
}

export const summarySql = () => `${hideSelect()} SELECT reason, site_category, COUNT(*) AS n FROM h GROUP BY reason, site_category ORDER BY reason, n DESC`;
export const samplesSql = () => `${hideSelect()} SELECT reason, product_name FROM (SELECT reason, product_name, ROW_NUMBER() OVER (PARTITION BY reason ORDER BY random()) AS r FROM h) WHERE r BETWEEN 1 AND 15 ORDER BY reason`;
export const idsSql = () => `${hideSelect()} SELECT id FROM h ORDER BY id`;
// What stays: the products of each site category after the clean-up (for the report).
export const keptSql = () => `${hideSelect()} SELECT site_category, COUNT(*) AS n FROM products WHERE is_active = 1 AND id NOT IN (SELECT id FROM h) GROUP BY site_category ORDER BY n DESC`;

export function updateSql(ids, active) {
  const out = [];
  for (let i = 0; i < ids.length; i += 500) {
    const part = ids.slice(i, i + 500).map(Number).filter(Number.isFinite);
    out.push(`UPDATE products SET is_active = ${active ? 1 : 0}, updated_at = datetime('now') WHERE id IN (${part.join(', ')});`);
  }
  return out.join('\n') + '\n';
}

// node tools/cleanup-rules/instock.mjs <summary|samples|ids|kept>  -> prints one SQL line
// node tools/cleanup-rules/instock.mjs update <ids.txt> <0|1> <out.sql>
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
