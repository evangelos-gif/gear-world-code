// Clean-up rules for Kids' Gear World (a site for parents), chosen by the owner on 20 Oct 2026:
//  - Food supplements and vitamins (about 90 in "Kids Tech": vitamins, probiotics, "height growth", sleep aids).
//  - Medicines (Calpol, allergy tablets, laxatives, colic drops, gripe water...). A toy doctor's "medicine box" stays.
//  - Adult clothing in Clothing, Shoes and Accessories (women's and men's T-shirts, a "sexy halter" dress).
//  - Items for the mother: maternity and nursing bras, breast pumps, breast pads, pregnancy pillows, prenatal vitamins.
//    Baby feeding items stay: bottles, teats, soothers, bibs, sippy cups, milk storage bags and coolers.
// Nothing is deleted: rows get is_active = 0, and the ids are kept for a rollback.
// The SQL avoids the characters % < > & | ^ because the PowerShell tools pass it on a cmd line (wrangler --command),
// and uses ASCII only (the .cmd file is written as ASCII).

const sq = w => w.replace(/'/g, "''");
// instr() is 0 when the word is missing, so it works as true/false (and keeps the SQL short for the cmd line).
const has = (col, words) => '(' + words.map(w => `instr(${col}, '${sq(w)}')`).join(' OR ') + ')';

export const MEDICINE = ['medicine', 'laxative', 'loratadine', 'zyrtec', 'cetirizine', 'antihistamine', 'allergy relief', 'allergy medicine',
  'allergy support', 'calpol', 'paracetamol', 'ibuprofen', 'oral suspension', 'colic drops', 'colic relief', 'gripe water', 'teething pain',
  'dramamine', 'motion sickness tablet', 'anxiocalm', 'simeticone', 'cough syrup', 'cough medicine', 'decongestant', 'nasal spray'];
// A toy doctor's set with a "medicine box", a pretend-play kit: not a medicine.
export const MEDICINE_NOT = ['toy', 'role play', 'role-play', 'pretend', 'playset', 'doctor kit', 'doctor set'];

export const SUPPLEMENT = ['multivitamin', 'multi vitamin', 'vitamin', 'probiotic', 'prebiotic', 'supplement', 'chewable', 'gummies',
  'lozenjet', 'softgel', 'capsules', 'colostrum', 'elderberry', 'echinacea', 'digestive enzyme', 'heightfactor', 'height growth',
  'omega-3', 'fish oil', 'melatonin', 'sleep aid', 'sleepology', 'calm mind', 'focus support', 'concentration formula', 'immune support',
  'magnesium', 'lacteeze', 'mightyzyme', 'b complex', 'iron 5 mg', 'iron 15 mg', 'zinc 5 mg', 'calcium 250 mg', 'dha +', 'mg dha'];
// Baby milk with added vitamins, toothpaste, bubble bath and toys are not supplements.
export const SUPPLEMENT_NOT = ['collector', 'milk powder', 'baby milk', 'follow on', 'first milk', 'toothpaste', 'bubble bath', 'toy', 'shampoo', 'lotion'];

// Only in the clothing, shoes and accessories categories (a "Baby & Toddler" item may mention a mother).
export const ADULT_CLOTHING = ['women', 'ladies', "men's", 'mens ', 'sexy', 'lingerie', 'halter', 'nightclub', 'push up', 'thong'];
export const ADULT_CATEGORIES = ['Clothing', 'Shoes', 'Accessories'];

export const MOTHER = ['maternity', 'pregnancy', 'nursing bra', 'sleep bra', 'breast pump', 'breast pads', 'nursing pads',
  'breast massager', 'nipple', 'prenatal', 'postnatal', 'nursing pillow', 'breastfeed apron', 'breastfeeding cover'];
// Baby feeding items stay, also when the name mentions breastfeeding or a pump.
export const MOTHER_NOT = ['bag', 'pouch', 'storage', 'cooler', 'bottle', 'teat', 'soother', 'dummy', 'dummies', 'bib', 'sippy', 'cup',
  'warmer', 'steriliser', 'sterilizer', 'baby care kit', 'muslin', 'nappies', 'pacifier', 'feeder'];

const inCats = cats => `site_category IN (${cats.map(c => `'${sq(c)}'`).join(', ')})`;

// One row per product to hide: id, reason, site_category, product_name.
export function hideSelect() {
  return `WITH b AS (SELECT id, site_category, product_name, lower(product_name) AS n FROM products WHERE is_active = 1),
  h AS (SELECT id, CASE
      WHEN ${has('n', MEDICINE)} AND NOT ${has('n', MEDICINE_NOT)} THEN 'medicine'
      WHEN ${has('n', SUPPLEMENT)} AND NOT ${has('n', SUPPLEMENT_NOT)} THEN 'food supplement or vitamin'
      WHEN ${inCats(ADULT_CATEGORIES)} AND ${has('n', ADULT_CLOTHING)} THEN 'adult clothing'
      WHEN ${has('n', MOTHER)} AND NOT ${has('n', MOTHER_NOT)} THEN 'for the mother (maternity, nursing, pregnancy)'
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

// node tools/cleanup-rules/family.mjs <summary|samples|ids|kept>  -> prints one SQL line
// node tools/cleanup-rules/family.mjs update <ids.txt> <0|1> <out.sql>
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
