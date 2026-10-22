// Gear World Hub: adds Travel Gear World (VGW) to the hub homepage files, after Car (AGW).
// Pure text changes, checked step by step. If the hub files do not look exactly as expected, it changes NOTHING.
// The hub must already have the AGW card (tools/gwh-agw-link.mjs): VGW becomes the 9th card.
//
//   node tools/gwh-vgw-link.mjs --hub <hub folder> [--out <folder>] [--write]
//     without --write: only reports what would change (and with --out writes patched copies there)
//     with --write:    writes public/index.html and public/translations.js in the hub folder
//
// The PowerShell tool gwh-vgw-link.ps1 makes the backup, asks for approval, deploys and checks.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGW_STYLE } from './gwh-agw-link.mjs';

export const VGW_URL = 'https://travelgearworld.com/';

// Card texts per hub language (same order and codes as the hub's LOCALES).
export const VGW_TEXT = {
  'en-GB': ['Travel', 'Luggage, travel bags, accessories and camping gear.'],
  'el-GR': ['Ταξίδι', 'Βαλίτσες, τσάντες ταξιδιού, αξεσουάρ και εξοπλισμός camping.'],
  'de-DE': ['Reisen', 'Koffer, Reisetaschen, Zubehör und Campingausrüstung.'],
  'fr-FR': ['Voyage', 'Valises, sacs de voyage, accessoires et matériel de camping.'],
  'it-IT': ['Viaggio', 'Valigie, borse da viaggio, accessori e attrezzatura da campeggio.'],
  'es-ES': ['Viaje', 'Maletas, bolsas de viaje, accesorios y equipo de camping.'],
  'pt-PT': ['Viagem', 'Malas, sacos de viagem, acessórios e equipamento de campismo.'],
  'nl-NL': ['Reizen', 'Koffers, reistassen, accessoires en kampeeruitrusting.'],
  'sq-AL': ['Udhëtim', 'Valixhe, çanta udhëtimi, aksesorë dhe pajisje kampingu.'],
  'ro-RO': ['Călătorii', 'Valize, genți de călătorie, accesorii și echipament de camping.'],
  'ru-RU': ['Путешествия', 'Чемоданы, дорожные сумки, аксессуары и снаряжение для кемпинга.']
};

// "eight" -> "nine" in the "Growing Network" sentence, per language (the words the AGW link wrote).
const NINE = {
  'en-GB': [/(?<!\p{L})eight(?!\p{L})/u, 'nine'],
  'el-GR': [/(?<!\p{L})οκτώ(?!\p{L})/u, 'εννέα'],
  'de-DE': [/(?<!\p{L})acht(?!\p{L})/u, 'neun'],
  'fr-FR': [/(?<!\p{L})huit(?!\p{L})/u, 'neuf'],
  'it-IT': [/(?<!\p{L})otto(?!\p{L})/u, 'nove'],
  'es-ES': [/(?<!\p{L})ocho(?!\p{L})/u, 'nueve'],
  'pt-PT': [/(?<!\p{L})oito(?!\p{L})/u, 'nove'],
  'nl-NL': [/(?<!\p{L})acht(?!\p{L})/u, 'negen'],
  'sq-AL': [/(?<!\p{L})tetë(?!\p{L})/u, 'nëntë'],
  'ro-RO': [/(?<!\p{L})opt(?!\p{L})/u, 'nouă'],
  'ru-RU': [/(?<!\p{L})восьми(?!\p{L})/u, 'девяти']
};

const EN_ONE_HUB_OLD = "Access Construction, Men's, Women's, Kids', Home, Garden, Technology and Car Gear World from one starting point.";
const EN_ONE_HUB_NEW = "Access Construction, Men's, Women's, Kids', Home, Garden, Technology, Car and Travel Gear World from one starting point.";
const EN_GROWING_OLD = 'Car Gear World is now live, expanding the Gear World network to eight specialist shopping worlds.';
const EN_GROWING_NEW = 'Travel Gear World is now live, expanding the Gear World network to nine specialist shopping worlds.';

function fail(msg) { const e = new Error(msg); e.code = 'HUB_LAYOUT'; throw e; }

function countOf(text, part) { return text.split(part).length - 1; }

function replaceOnce(text, oldPart, newPart, what) {
  if (countOf(text, oldPart) !== 1) fail(`${what}: expected text found ${countOf(text, oldPart)} times (need exactly 1)`);
  return text.replace(oldPart, () => newPart);
}

export function vgwCard(nl) {
  return [
    '            <a',
    '  class="gwh-quick-world gwh-quick-world-live gwh-image-world"',
    `  href="${VGW_URL}"`,
    '  data-world="VGW"',
    "  style=\"--world-image:url('/hub-vgw.jpg')\"",
    '  aria-label="Travel">',
    '',
    '  <span class="gwh-legacy-world-text">',
    '    <strong>Travel</strong>',
    '    <small>Luggage · Travel Bags · Accessories · Camping</small>',
    '  </span>',
    '',
    '  <span class="gwh-image-world-overlay">',
    '    <span class="gwh-image-world-code">VGW</span>',
    '    <strong class="gwh-image-world-title">Travel</strong>',
    `    <small class="gwh-image-world-description">${VGW_TEXT['en-GB'][1]}</small>`,
    '    <span class="gwh-image-world-cta">Shop →</span>',
    '  </span>',
    '</a>'
  ].join(nl);
}

// Nine cards: three full rows of 3 on a desktop. On phones (2 per row) the Travel card takes the whole last row,
// so no row is half empty. Replaces the 8-card block (gwh-agw-card).
export const VGW_STYLE = [
  '<style id="gwh-vgw-card">',
  '/* GWH-VGW-CARD: 9 worlds, all cards the same size. Replaces the 8-card block (gwh-agw-card). */',
  '@media (min-width:1051px){',
  'body[data-gwh-compact-v2="true"] .gwh-quick-worlds{grid-template-columns:repeat(3,minmax(0,1fr)) !important;}',
  '}',
  '@media (max-width:1050px){',
  'body[data-gwh-compact-v2="true"] .gwh-quick-worlds > [data-world="VGW"]{grid-column:1 / -1;}',
  '}',
  '</style>'
];

export function patchIndexHtml(html) {
  if (html.includes('data-world="VGW"') || html.includes(VGW_URL)) return { text: html, changes: [], already: true };
  const changes = [];
  const cardAttr = /^[ \t]*data-world="AGW"[ \t]*\r?$/gm;
  const hits = [...html.matchAll(cardAttr)];
  if (hits.length !== 1) fail('index.html: the Car (AGW) card was not found exactly once (link AGW to the hub first)');
  const start = hits[0].index;
  const close = html.indexOf('</a>', start);
  if (close < 0) fail('index.html: the end of the Car card was not found');
  const end = close + '</a>'.length;
  const nl = html.slice(start, end).includes('\r\n') ? '\r\n' : '\n';
  let text = html.slice(0, end) + nl + vgwCard(nl) + html.slice(end);
  changes.push('index.html: Travel card added after Car');
  let oldStyle = AGW_STYLE.join(nl);
  if (countOf(text, oldStyle) !== 1) oldStyle = AGW_STYLE.join(nl === '\n' ? '\r\n' : '\n');
  if (countOf(text, oldStyle) !== 1) fail('index.html: the 8-card style block (gwh-agw-card) was not found exactly as the AGW link wrote it');
  text = text.replace(oldStyle, () => VGW_STYLE.join(nl));
  changes.push('index.html: layout for 9 cards (3 rows of 3; Travel takes the whole last row on phones)');
  text = replaceOnce(text, EN_ONE_HUB_OLD, EN_ONE_HUB_NEW, 'index.html "One Central Hub"');
  changes.push('index.html: "One Central Hub" text lists Travel');
  text = replaceOnce(text, EN_GROWING_OLD, EN_GROWING_NEW, 'index.html "Growing Network"');
  changes.push('index.html: "Growing Network" text says Travel / nine');
  return { text, changes, already: false };
}

function locales(js) {
  const m = js.match(/const LOCALES = \[([\s\S]*?)\]/);
  if (!m) fail('translations.js: LOCALES list not found');
  const list = [...m[1].matchAll(/"([a-z]{2}-[A-Z]{2})"/g)].map(x => x[1]);
  const want = Object.keys(VGW_TEXT);
  if (list.length !== want.length || want.some(l => !list.includes(l))) fail(`translations.js: unexpected languages ${list.join(',')}`);
  return list;
}

function patchArrayLine(js, key, mapFn, what) {
  const re = new RegExp(`(\\n[ \\t]*${key}: )(\\[.*\\])(,?\\r?\\n)`);
  const matches = js.match(new RegExp(re.source, 'g')) || [];
  if (matches.length !== 1) fail(`translations.js: "${key}" found ${matches.length} times (need exactly 1)`);
  const m = js.match(re);
  let arr;
  try { arr = JSON.parse(m[2]); } catch { fail(`translations.js: "${key}" is not a simple list of texts`); }
  const next = mapFn(arr);
  return js.replace(re, (_, a, _b, c) => a + JSON.stringify(next) + c);
}

function appendToList(block, key, value, what, expected = 8) {
  const open = block.indexOf(`${key}: [`);
  if (open < 0) fail(`${what}: "${key}" not found`);
  const close = block.indexOf(']', open);
  const inner = block.slice(open + key.length + 3, close);
  const items = [...inner.matchAll(/"((?:[^"\\]|\\.)*)"/g)];
  if (items.length !== expected) fail(`${what}: "${key}" has ${items.length} entries (expected ${expected})`);
  const last = items[items.length - 1];
  const lastEnd = open + key.length + 3 + last.index + last[0].length;
  const lineStart = block.lastIndexOf('\n', open + key.length + 3 + last.index) + 1;
  const indent = block.slice(lineStart, open + key.length + 3 + last.index);
  const nl = block.slice(lineStart - 2, lineStart) === '\r\n' ? '\r\n' : '\n';
  return block.slice(0, lastEnd) + ',' + nl + indent + JSON.stringify(value) + block.slice(lastEnd);
}

export function patchTranslations(js) {
  if (js.includes('Travel Gear World') || js.includes('"Путешествия"')) return { text: js, changes: [], already: true };
  const langs = locales(js);
  const changes = [];
  let text = patchArrayLine(js, 'oneHubDesc', arr => {
    if (arr.length !== langs.length) fail('translations.js: oneHubDesc has the wrong number of languages');
    return arr.map((s, i) => {
      if (!/Technology (\S+) Car Gear World/.test(s)) fail(`translations.js: oneHubDesc (${langs[i]}) has an unexpected text`);
      return s.replace(/Technology (\S+) Car Gear World/, 'Technology, Car $1 Travel Gear World');
    });
  });
  changes.push('translations.js: "One Central Hub" text lists Travel in 11 languages');
  text = patchArrayLine(text, 'growingDesc', arr => {
    if (arr.length !== langs.length) fail('translations.js: growingDesc has the wrong number of languages');
    return arr.map((s, i) => {
      const [re, to] = NINE[langs[i]];
      if (countOf(s, 'Car Gear World') !== 1 || !re.test(s)) fail(`translations.js: growingDesc (${langs[i]}) has an unexpected text`);
      return s.replace('Car Gear World', 'Travel Gear World').replace(re, to);
    });
  });
  changes.push('translations.js: "Growing Network" text says Travel / nine in 11 languages');

  const v2 = text.indexOf('const V2 = {');
  if (v2 < 0) fail('translations.js: card translations (V2) not found');
  for (const lang of langs) {
    const head = `"${lang}": {`;
    const s = text.indexOf(head, v2);
    if (s < 0) fail(`translations.js: card texts for ${lang} not found`);
    const nextLang = text.slice(s + head.length).search(/"[a-z]{2}-[A-Z]{2}": \{/);
    const e = nextLang < 0 ? text.length : s + head.length + nextLang;
    let block = text.slice(s, e);
    block = appendToList(block, 'titles', VGW_TEXT[lang][0], `translations.js ${lang}`);
    block = appendToList(block, 'descriptions', VGW_TEXT[lang][1], `translations.js ${lang}`);
    text = text.slice(0, s) + block + text.slice(e);
  }
  changes.push('translations.js: Travel card title and text in 11 languages');
  return { text, changes, already: false };
}

function readKeepBom(path) {
  const buf = readFileSync(path);
  const bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  return { bom, text: buf.toString('utf8', bom ? 3 : 0) };
}

function writeKeepBom(path, text, bom) {
  writeFileSync(path, Buffer.concat([bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0), Buffer.from(text, 'utf8')]));
}

function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const hub = val('hub');
  if (!hub) { console.error('usage: node gwh-vgw-link.mjs --hub <folder> [--out <folder>] [--write]'); process.exit(2); }
  const files = { 'index.html': patchIndexHtml, 'translations.js': patchTranslations };
  const result = { already: true, changes: [], error: '' };
  const out = {};
  try {
    for (const [name, fn] of Object.entries(files)) {
      const src = readKeepBom(join(hub, 'public', name));
      const r = fn(src.text);
      out[name] = { ...src, next: r.text };
      result.changes.push(...r.changes);
      if (!r.already) result.already = false;
    }
  } catch (err) {
    result.error = err.message;
    console.log(JSON.stringify(result));
    process.exit(err.code === 'HUB_LAYOUT' ? 3 : 1);
  }
  const outDir = val('out');
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    for (const [name, f] of Object.entries(out)) writeKeepBom(join(outDir, name), f.next, f.bom);
  }
  if (args.includes('--write')) {
    for (const [name, f] of Object.entries(out)) if (f.next !== f.text) writeKeepBom(join(hub, 'public', name), f.next, f.bom);
  }
  console.log(JSON.stringify(result));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('gwh-vgw-link.mjs')) main();
