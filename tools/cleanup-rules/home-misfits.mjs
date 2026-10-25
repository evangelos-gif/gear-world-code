// Clean-up rules for Home Gear World (20 Oct 2026, and 25 Oct 2026 for Joybuy, lessons L56): products of shops that do not sell home goods ended up in
// Home Decor and Lighting because of words in their names ("Mirror Finish" gold rings from Finediam, "Akko Mirror
// Switch" keyboards from AKKO). They are hidden on HGW only (the rings belong on MGW, the keyboards on TGW).
// Nothing is deleted: rows get is_active = 0 and the ids are kept for a rollback (same interface as instock.mjs).
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { updateSql } from './instock.mjs';

export const NOT_HOME = ['finediam', 'akko uk'];

// Joybuy products that the cleaning rules placed on HGW before lessons L56 (import of 25 Oct 2026): toilet paper, personal
// hygiene wipes, a toiletry bag, a pet grooming kit and a pest killer. The words are the ones joybuy.mjs now leaves out.
// (instr ... BETWEEN, not LIKE '%...%' or >, and char(38) for the ampersand, without ||: the command goes through cmd.exe, where %, >, & and | mean
// something else.)
export const JOYBUY_NOT_CLEANING = ['toilet roll', 'toilet tissue', 'toilet wipe', 'hygiene wipes', 'wet wipes for adult', 'body wipe', 'babycare', 'wash bag',
  'pet grooming', 'pest killer', 'bed bug'];

export function hideSelect() {
  const list = NOT_HOME.map(r => `'${r}'`).join(', ');
  const words = JOYBUY_NOT_CLEANING.map(w => `instr(lower(product_name), '${w}') BETWEEN 1 AND 100000`).join(' OR ');
  return `WITH h AS (SELECT id, 'shop that does not sell home goods (rings, keyboards)' AS reason, site_category, product_name
    FROM products WHERE is_active = 1 AND lower(retailer) IN (${list})
    UNION ALL SELECT id, 'not a home cleaning product (toilet paper, personal wipes, toiletry bag, pet grooming, pest killer)' AS reason, site_category, product_name
    FROM products WHERE is_active = 1 AND retailer = 'Joybuy UK' AND site_category IN (replace('Cleaning + Laundry', '+', char(38)), 'Home Appliances') AND (${words}))`;
}

export const summarySql = () => `${hideSelect()} SELECT reason, site_category, COUNT(*) AS n FROM h GROUP BY reason, site_category ORDER BY reason, n DESC`;
export const samplesSql = () => `${hideSelect()} SELECT reason, product_name FROM (SELECT reason, product_name, ROW_NUMBER() OVER (PARTITION BY reason ORDER BY random()) AS r FROM h) WHERE r BETWEEN 1 AND 15 ORDER BY reason`;
export const idsSql = () => `${hideSelect()} SELECT id FROM h ORDER BY id`;
export const keptSql = () => `${hideSelect()} SELECT site_category, COUNT(*) AS n FROM products WHERE is_active = 1 AND id NOT IN (SELECT id FROM h) GROUP BY site_category ORDER BY n DESC`;
export { updateSql };

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [what, a, b, c] = process.argv.slice(2);
  const one = s => s.replace(/\s+/g, ' ').trim();
  if (what === 'summary') console.log(one(summarySql()));
  else if (what === 'samples') console.log(one(samplesSql()));
  else if (what === 'ids') console.log(one(idsSql()));
  else if (what === 'kept') console.log(one(keptSql()));
  else if (what === 'update') writeFileSync(c, updateSql(readFileSync(a, 'utf8').split(/\s+/).filter(Boolean), b === '1'));
  else { console.error('usage'); process.exit(2); }
}
