// Clean-up rule for Home Gear World (17 Nov 2026, lessons L179): food filed under appliances. Joybuy UK's crisps of the
// "Kettle" brand, a hotpot "Kettle Base Oil", Pop-Tarts "toaster pastries", air fryer seasoning, frozen chips and coffee
// pods sat in Home Appliances (Kettle, Toaster, Air Fryer, Coffee Machine, Microwave) because their names name the
// appliance, and came first for "kettle" (the search of 17/11 found Kettle Crisps before the kettles). An older import
// placed them; joybuy.mjs has left out "Food, Beverages ..." since lessons L55. Home Gear World does not sell food, so
// every active product whose shop files it under "Food, Beverages & Tobacco" is hidden on HGW (9 on 17 Nov 2026).
// Nothing is deleted: rows get is_active = 0 and the ids are kept for a rollback (same interface as instock.mjs). Run it
// again after a refresh that brings them back.
// (substr, not LIKE '...%', and no ampersand: the command goes through cmd.exe, where %, >, & and | mean something else.)
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { updateSql } from './instock.mjs';

export const FOOD_PATH = 'Food, Beverages ';

export function hideSelect() {
  return `WITH h AS (SELECT id, 'food (the shop files it under Food, Beverages and Tobacco): Home Gear World does not sell food' AS reason, site_category, product_name
    FROM products WHERE is_active = 1 AND substr(COALESCE(merchant_category, ''), 1, ${FOOD_PATH.length}) = '${FOOD_PATH}')`;
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
