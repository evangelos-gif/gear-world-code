// The order of a search on the 13 sites (lessons L179, 17 Nov 2026). The sites ordered a search "featured" (in stock,
// then a fixed shuffle), so the most plentiful match won: drill bits for "drill", a kettle descaler for "kettle", duvet
// covers for "duvet", boot tassels for "womens boots", a cat toy for "cat litter". Gear World Hub orders its merged
// results by what the product IS (lessons L177, sites/gwh/worker.js rankHubResults); a site now does the same with its
// own results, in two steps:
//   1. the database: the matches in a rough order (coarseOrder), from the search index only (no row is read twice):
//      the words in the subcategory or the category name first, then in the product name as whole words, and a name
//      where an accessory word comes right after the searched word ("drill bit", "kettle descaler", "duvet cover") or
//      a toy lower; then in stock, then the fixed shuffle. The first SEARCH_WINDOW of them are read;
//   2. this file: those are ordered by the Hub's rules (rankWindow): what the product is, the words of its name before
//      "with", "for", "no" ..., brackets, accessories before or after the searched word, toys, copies of one name.
// Pages inside the window come from step 2, later pages from step 1, so a product never shows on two pages.
// The words a search matches (searchMatch) also take a plural ("boots" finds "Chelsea Boot"), a few true synonyms
// ("smartwatch" = "smart watch", "motorcycle" = "motorbike", "bbq" = "barbecue") and leave out the word a site says by
// itself when others remain ("womens boots" on Women's Gear World = its boots).
// The word lists are the Hub's of L177; a change to one belongs in both (the Hub: sites/gwh/worker.js).

export const SEARCH_WINDOW = 120;

const RANK_STOP = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'with', 'in', 'on', 'of', 'to', 'my', 'me', 'new', 'buy', 'best', 'cheap', 'i', 'want', 'need', 'should', 'what', 'which', 'some']);
const RANK_ACCESSORY = new Set(['brush', 'bit', 'attachment', 'adapter', 'adaptor', 'case', 'cover', 'holder', 'mount', 'strap', 'replacement', 'spare', 'accessory', 'refill', 'sticker', 'decal', 'stand', 'pocket', 'cufflink', 'costume', 'protector', 'charger', 'cable', 'pouch', 'organiser', 'organizer', 'hook', 'pattern', 'poster', 'bracket', 'descaler', 'blade', 'catcher', 'tassel', 'band']);
const RANK_TOY = new Set(['toy', 'pretend']);
const RANK_ACCESSORY_NAMES = new Set(['stand mixer', 'pocket knife', 'pocket watch', 'pocket sprung', 'side pocket', 'zip pocket',
  'chest pocket', 'kangaroo pocket', 'razer blade', 'cover up', 'hook and', 'strap top', 'case closed', 'cable knit',
  'ankle strap', 'hard case', 'stand up', 'duvet cover', 'pillow case', 'suit case', 'phone case']);
// For the order (as the Hub). Own keys only (a Map): a search for "constructor" must not find Object.prototype.constructor.
const RANK_SYNONYMS = new Map(Object.entries({
  bbq: ['barbecue'], barbecue: ['bbq'], tv: ['television'], television: ['tv'], mower: ['lawnmower'], lawnmower: ['mower'],
  hoover: ['vacuum'], sneaker: ['trainer'], trainer: ['sneaker'], pram: ['pushchair', 'stroller'], pushchair: ['pram', 'stroller'],
  stroller: ['pram', 'pushchair'], nappy: ['diaper'], diaper: ['nappy'], sofa: ['couch'], couch: ['sofa'], earphone: ['earbud'],
  earbud: ['earphone'], ps5: ['playstation 5', 'playstation5'], ps4: ['playstation 4', 'playstation4'],
  mobile: ['phone'], cellphone: ['phone'], notebook: ['laptop'], hivis: ['hi vis'],
  perfume: ['parfum', 'fragrance', 'eau de toilette'], fragrance: ['perfume', 'parfum'], parfum: ['perfume'],
  smartwatch: ['smart watch'], motorcycle: ['motorbike'], motorbike: ['motorcycle'], bike: ['bicycle'], bicycle: ['bike'],
  tyre: ['tire'], tire: ['tyre'], dashcam: ['dash cam'], airfryer: ['air fryer']
}));
// For the words a search FINDS: only true equivalents (a search for "mobile" on Kids' Gear World is a baby mobile, so it
// does not look for phones; "fragrance" also names home fragrance, so "perfume" does not look for it).
const MATCH_SYNONYMS = new Map(Object.entries({
  bbq: ['barbecue'], barbecue: ['bbq'], tv: ['television'], television: ['tv'], mower: ['lawnmower'], lawnmower: ['lawn mower'],
  hoover: ['vacuum'], sneaker: ['trainer'], trainer: ['sneaker'], pram: ['pushchair', 'stroller'], pushchair: ['pram', 'stroller'],
  stroller: ['pram', 'pushchair'], nappy: ['diaper'], diaper: ['nappy'], sofa: ['couch'], couch: ['sofa'], earphone: ['earbud'],
  earbud: ['earphone'], ps5: ['playstation 5'], ps4: ['playstation 4'], perfume: ['parfum', 'eau de toilette'],
  smartwatch: ['smart watch'], motorcycle: ['motorbike'], motorbike: ['motorcycle'], bike: ['bicycle'], bicycle: ['bike'],
  tyre: ['tire'], tire: ['tyre'], hivis: ['hi vis'], dashcam: ['dash cam'], airfryer: ['air fryer']
}));
// Words a Gear World says by itself.
const RANK_SITE_WORDS = new Map(Object.entries({
  wgw: ['women', 'woman', 'womens', 'ladies', 'lady', 'her'], mgw: ['men', 'man', 'mens', 'gent', 'him'],
  kgw: ['kid', 'child', 'children', 'baby', 'boy', 'girl', 'junior', 'toddler'], zgw: ['pet']
}));
const RANK_IRREGULAR = new Map(Object.entries({
  scarves: 'scarf', knives: 'knife', shelves: 'shelf', leaves: 'leaf', wolves: 'wolf', halves: 'half', calves: 'calf',
  lives: 'life', wives: 'wife', bikinis: 'bikini', skis: 'ski', minis: 'mini', taxis: 'taxi', lens: 'lens', lenses: 'lens',
  mice: 'mouse', children: 'child', men: 'men', women: 'women', feet: 'foot', teeth: 'tooth', geese: 'goose'
}));

export function rankStem(word) {
  let t = String(word || '');
  if (RANK_IRREGULAR.has(t)) return RANK_IRREGULAR.get(t);
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 4 && t.endsWith('ie')) return `${t.slice(0, -2)}y`;
  if (t.length > 4 && /(ches|shes|xes|sses|zzes)$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !/(ss|us|is)$/.test(t)) t = t.slice(0, -1);
  return t;
}
// Words as the search index splits them (unicode61, accents removed, lower case): letters and digits.
export function rankWords(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '')
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
export function rankTokens(text) {
  const raw = rankWords(text);
  const out = new Set(raw.map(rankStem));
  for (let i = 0; i + 1 < raw.length; i++) out.add(rankStem(raw[i] + raw[i + 1])); // "lawn mower" = "lawnmower"
  return out;
}

// The written forms of a word in a product's text, for the search index's exact tokens: "drill" -> drill, drills;
// "boots" -> boot, boots; "battery" -> battery, batteries; "dress" -> dress, dresses.
function forms(stem) {
  const out = new Set([stem]);
  if (/(ch|sh|x|ss|z)$/.test(stem)) out.add(`${stem}es`);
  else if (/[^aeiou]y$/.test(stem)) out.add(`${stem.slice(0, -1)}ies`);
  else out.add(`${stem}s`);
  for (const [plural, single] of RANK_IRREGULAR) if (single === stem && plural !== stem) out.add(plural);
  return [...out];
}
const quote = t => `"${String(t).replace(/"/g, '""')}"`;

// The words of a search: { raw (as typed, max 8), match (what the index must find), rank (for the order) }.
function searchWords(text, siteCode) {
  const raw = (String(text ?? '').normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || []).slice(0, 8);
  const lower = rankWords(raw.join(' '));
  const said = new Set((RANK_SITE_WORDS.get(String(siteCode || '').toLowerCase()) || []).map(rankStem));
  // The word a site says by itself, when other words remain: "womens boots" on Women's Gear World finds its boots,
  // "kids bike" on Kids' Gear World its bikes (singulars compared, as the Hub does).
  const keep = lower.filter(w => !said.has(rankStem(w)));
  const matchWords = keep.length && keep.length < lower.length ? keep : lower;
  const rank = matchWords.filter(w => !RANK_STOP.has(w)).map(rankStem).filter(w => w.length >= 2 || /\d/.test(w));
  return { raw: lower, match: matchWords, rank: rank.length ? rank : matchWords.map(rankStem) };
}

// The search index expression: every word (as typed or as its singular, or a true synonym), as the start of a word.
// "boots" -> ("boot"*), "batteries" -> ("batteries"* OR "battery"*), "smartwatch" -> ("smartwatch"* OR ("smart"* AND "watch"*)).
export function searchMatch(text, siteCode = '') {
  const { match } = searchWords(text, siteCode);
  if (!match.length) return '';
  return match.map(w => {
    // The singular as the order reads it ("shoes" -> shoe, "watches" -> watch, "batteries" -> battery), but not for
    // -sses ("glasses" would also find glass bottles): those stay as typed, as before.
    const singular = w.endsWith('sses') ? w : rankStem(w);
    const starts = [...new Set([w, singular])];
    // A start that is the start of another is enough ("boot"* already finds "boots").
    const alone = starts.filter(a => !starts.some(b => b !== a && a.startsWith(b)));
    const alts = [...alone.map(a => `${quote(a)}*`), ...(MATCH_SYNONYMS.get(w) || MATCH_SYNONYMS.get(singular) || [])
      .map(s => s.split(' ').filter(Boolean)).map(p => (p.length === 1 ? `${quote(p[0])}*` : `(${p.map(x => `${quote(x)}*`).join(' AND ')})`))];
    return alts.length === 1 ? alts[0] : `(${alts.join(' OR ')})`;
  }).join(' AND ');
}

// The plan of one search on one site: null when the search has no words. site = { code, categories: [{ slug, name }] }.
export function searchPlan(text, site = {}) {
  const words = searchWords(text, site.code);
  if (!words.match.length) return null;
  const w = words.rank;
  const askedForAccessory = w.some(x => RANK_ACCESSORY.has(x));
  const askedForToy = w.some(x => RANK_TOY.has(x));
  const wordForms = x => [...new Set([...forms(x), ...(RANK_SYNONYMS.get(x) || []).filter(s => !s.includes(' ')).flatMap(s => forms(rankStem(s)))])];
  const anyOf = x => `(${wordForms(x).map(quote).join(' OR ')})`;
  const allOf = list => list.map(anyOf).join(' AND ');
  // The categories whose names hold every word (Tablets, Kettle, Hedge Trimmers ...).
  const catNames = new Map(((site.categories) || []).map(c => [c.slug, c.name]));
  const catSlugs = [...catNames].filter(([, name]) => { const t = rankTokens(name); return w.every(x => t.has(x)); }).map(([slug]) => slug);
  // An accessory word right after a searched word ("drill bit", "kettle descaler", "duvet cover", "boot tassels").
  const accessoryPhrases = askedForAccessory ? [] : w.flatMap(x => wordForms(x).flatMap(f => [...RANK_ACCESSORY].map(a => `${quote(`${f} ${a}`)}*`)));
  const fts = () => 'p.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ?)';
  const parts = [];
  const binds = [];
  // What the product is: its subcategory or category.
  parts.push(`(CASE WHEN ${fts()}${catSlugs.length ? ` OR p.category_slug IN (${catSlugs.map(() => '?').join(', ')})` : ''} THEN 4 ELSE 0 END)`);
  binds.push(`subcategory : (${allOf(w)})`, ...catSlugs);
  // Every word in the name, as a whole word.
  parts.push(`(CASE WHEN ${fts()} THEN 3 ELSE 0 END)`);
  binds.push(`product_name : (${allOf(w)})`);
  if (accessoryPhrases.length) { parts.push(`(CASE WHEN ${fts()} THEN -4 ELSE 0 END)`); binds.push(`product_name : (${accessoryPhrases.join(' OR ')})`); }
  if (!askedForToy) { parts.push(`(CASE WHEN ${fts()} THEN -3 ELSE 0 END)`); binds.push('product_name : ("toy" OR "toys" OR "pretend")'); }
  const coarse = { sql: `(${parts.join(' + ')}) DESC`, binds };

  // The same rough order in JavaScript (tools/sites-search-check.mjs --replay, and the test that both agree).
  const tokens = t => new Set(rankWords(t));
  const hasAll = set => w.every(x => wordForms(x).some(f => set.has(f)));
  const phrase = name => { const t = rankWords(name); return accessoryPhrases.length > 0 && w.some(x => wordForms(x).some(f => t.some((tok, i) => tok === f && i + 1 < t.length && [...RANK_ACCESSORY].some(a => t[i + 1].startsWith(a))))); };
  const coarseScore = row => (hasAll(tokens(row.subcategory)) || catSlugs.includes(row.category_slug) ? 4 : 0) +
    (hasAll(tokens(row.product_name)) ? 3 : 0) + (phrase(row.product_name) ? -4 : 0) +
    (!askedForToy && rankWords(row.product_name).some(t => t === 'toy' || t === 'toys' || t === 'pretend') ? -3 : 0);

  const rankWindow = rows => rankRows(rows, words, catNames);
  return {
    words: w,
    match: searchMatch(text, site.code),
    coarse,
    coarseScore,
    rankWindow,
    // The whole order in JavaScript, for rows already read in the site's "featured" order (the replay of the check).
    order: rows => rankWindow(rows.map((r, i) => [r, coarseScore(r), i]).sort((a, b) => b[1] - a[1] || (Number(b[0].in_stock) || 0) - (Number(a[0].in_stock) || 0) || a[2] - b[2])
      .map(x => x[0]).slice(0, SEARCH_WINDOW))
  };
}

// Step 2: the Hub's order (rankHubResults, L177) on one site's rows. A row: product_name, brand, subcategory,
// category_slug (or site_category / category), merchant_category, in_stock. Equal scores keep the database's order.
function rankRows(rows, words, catNames) {
  const q = words.raw.join(' ');
  const joined = words.raw.length > 1 ? rankStem(words.raw.join('')) : '';
  const w = words.rank;
  const askedForAccessory = w.some(x => RANK_ACCESSORY.has(x));
  const askedForToy = w.some(x => RANK_TOY.has(x));
  const alts = x => RANK_SYNONYMS.get(x) || [];
  const has = (set, x) => set.has(x) || alts(x).some(alt => alt.split(' ').map(rankStem).every(t => set.has(t)) || set.has(rankStem(alt.replace(/ /g, ''))));
  const all = set => w.length > 0 && (w.every(x => has(set, x)) || (joined !== '' && set.has(joined)));
  const some = set => w.some(x => has(set, x));
  const exact = set => [...set].filter(t => !RANK_STOP.has(t) && t.length > 1).every(t => w.includes(t) || t === joined || w.join('') === t || w.some(x => alts(x).includes(t)));
  const score = new Map();
  for (const row of rows) {
    const name = String(row.product_name || '');
    const main = name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').split(' | ')[0];
    const head = main.split(/\s(?:with|without|no|inc|incl|including|for|compatible|fits|suitable)\s|\s\+\s/i)[0];
    const N = rankTokens(head);
    const full = rankTokens(name);
    const S = rankTokens(row.subcategory);
    const C = rankTokens(row.site_category || row.category || catNames.get(row.category_slug) || '');
    const M = rankTokens(row.merchant_category);
    let type = 0;
    if (all(S)) type = exact(S) ? 90 : 70;
    else if (all(C)) type = exact(C) ? 75 : 60;
    else if (all(M)) type = 30;
    else if (some(S) || some(C)) type = 20;
    let value = type;
    if (all(N)) value += 45;
    else if (all(full)) value += 20;
    else if (w.length) value += Math.round(30 * w.filter(x => has(N, x)).length / w.length);
    if (q.length >= 2 && rankWords(main).join(' ').includes(q)) value += 10;
    const brand = rankWords(row.brand).join(' ');
    if (brand && brand === q) value += 60;
    else if (brand && w.length && w.every(x => rankTokens(brand).has(x))) value += 20;
    const order = rankWords(head).map(rankStem);
    const at = order.findIndex(t => w.some(x => t === x || alts(x).includes(t)));
    if (!askedForAccessory && at >= 0 && order.slice(at + 1).some(t => RANK_ACCESSORY.has(t))) value -= 45;
    else if (!askedForAccessory && at > 0 && order.slice(0, at).some((t, i, list) => RANK_ACCESSORY.has(t) &&
      !RANK_ACCESSORY_NAMES.has(`${list[i - 1] || ''} ${t}`) && !RANK_ACCESSORY_NAMES.has(`${t} ${list[i + 1] || order[at] || ''}`))) value -= 25;
    if (!askedForToy && order.some(t => RANK_TOY.has(t))) value -= 30;
    if (Number(row.in_stock) === 1) value += 3;
    score.set(row, value);
  }
  // The same name many times (sizes and colours of one product): the 3rd and later copies go down.
  const copies = new Map();
  const sorted = rows.map((r, i) => [r, i]).sort((a, b) => score.get(b[0]) - score.get(a[0]) || a[1] - b[1]);
  for (const [row] of sorted) {
    const key = String(row.product_name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const n = (copies.get(key) || 0) + 1;
    copies.set(key, n);
    if (n > 2) score.set(row, score.get(row) - 25);
  }
  return rows.map((r, i) => [r, i]).sort((a, b) => score.get(b[0]) - score.get(a[0]) || a[1] - b[1]).map(x => x[0]);
}
