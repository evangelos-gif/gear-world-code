// Clean-up rules for Finediam on MGW (20 Oct 2026): 10,069 cards are 265 ring designs, one card for every
// metal and width ("... Gold Band - 9k Yellow Gold / 5mm", "... - 18k Rose Gold / 8mm"). One card per design
// stays (the cheapest, so the card shows the "from" price); the shop page lets the buyer pick metal and width.
// Nothing is deleted: rows get is_active = 0 and the ids are kept for a rollback (same interface as instock.mjs).
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { updateSql } from './instock.mjs';

const BASE = `CASE WHEN instr(product_name, ' - ') BETWEEN 2 AND 100000 THEN substr(product_name, 1, instr(product_name, ' - ') - 1) ELSE product_name END`;

export function hideSelect() {
  return `WITH f AS (SELECT id, site_category, product_name, price, ${BASE} AS base FROM products WHERE is_active = 1 AND lower(retailer) = 'finediam'),
  h AS (SELECT id, 'same ring design, other metal or width' AS reason, site_category, product_name FROM
    (SELECT id, site_category, product_name, ROW_NUMBER() OVER (PARTITION BY site_category, base ORDER BY price, id) AS rn FROM f)
    WHERE rn BETWEEN 2 AND 100000000)`;
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
