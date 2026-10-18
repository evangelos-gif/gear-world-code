// Gear World Hub: adds Technology Gear World (TGW) to the hub homepage files.
// Pure text changes, checked step by step. If the hub files do not look exactly as expected, it changes NOTHING.
//
//   node tools/gwh-tgw-link.mjs --hub <hub folder> [--out <folder>] [--write]
//     without --write: only reports what would change (and with --out writes patched copies there)
//     with --write:    writes public/index.html and public/translations.js in the hub folder
//
// The PowerShell tool gwh-tgw-link.ps1 makes the backup, asks for approval, deploys and checks.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const TGW_URL = 'https://technologygearworld.com/';

// Card texts per hub language (same order and codes as the hub's LOCALES).
export const TGW_TEXT = {
  'en-GB': ['Technology', 'Laptops, phones, audio and gaming tech.'],
  'el-GR': ['Τεχνολογία', 'Laptop, κινητά, ήχος και gaming.'],
  'de-DE': ['Technik', 'Laptops, Handys, Audio und Gaming.'],
  'fr-FR': ['Technologie', 'Ordinateurs portables, téléphones, audio et gaming.'],
  'it-IT': ['Tecnologia', 'Laptop, smartphone, audio e gaming.'],
  'es-ES': ['Tecnología', 'Portátiles, móviles, audio y gaming.'],
  'pt-PT': ['Tecnologia', 'Portáteis, telemóveis, áudio e gaming.'],
  'nl-NL': ['Technologie', 'Laptops, telefoons, audio en gaming.'],
  'sq-AL': ['Teknologji', 'Laptopë, telefona, audio dhe gaming.'],
  'ro-RO': ['Tehnologie', 'Laptopuri, telefoane, audio și gaming.'],
  'ru-RU': ['Технологии', 'Ноутбуки, телефоны, аудио и игры.']
};

// "six" -> "seven" in the "Growing Network" sentence, per language.
const SEVEN = {
  'en-GB': [/(?<!\p{L})six(?!\p{L})/u, 'seven'],
  'el-GR': [/(?<!\p{L})έξι(?!\p{L})/u, 'επτά'],
  'de-DE': [/(?<!\p{L})sechs(?!\p{L})/u, 'sieben'],
  'fr-FR': [/(?<!\p{L})six(?!\p{L})/u, 'sept'],
  'it-IT': [/(?<!\p{L})sei(?!\p{L})/u, 'sette'],
  'es-ES': [/(?<!\p{L})seis(?!\p{L})/u, 'siete'],
  'pt-PT': [/(?<!\p{L})seis(?!\p{L})/u, 'sete'],
  'nl-NL': [/(?<!\p{L})zes(?!\p{L})/u, 'zeven'],
  'sq-AL': [/(?<!\p{L})gjashtë(?!\p{L})/u, 'shtatë'],
  'ro-RO': [/(?<!\p{L})([șş])ase(?!\p{L})/u, '$1apte'],
  'ru-RU': [/(?<!\p{L})шести(?!\p{L})/u, 'семи']
};

const EN_ONE_HUB_OLD = "Access Construction, Men's, Women's, Kids', Home and Garden Gear World from one starting point.";
const EN_ONE_HUB_NEW = "Access Construction, Men's, Women's, Kids', Home, Garden and Technology Gear World from one starting point.";
const EN_GROWING_OLD = 'Garden Gear World is now live, expanding the Gear World network to six specialist shopping worlds.';
const EN_GROWING_NEW = 'Technology Gear World is now live, expanding the Gear World network to seven specialist shopping worlds.';

function fail(msg) { const e = new Error(msg); e.code = 'HUB_LAYOUT'; throw e; }

function countOf(text, part) { return text.split(part).length - 1; }

function replaceOnce(text, oldPart, newPart, what) {
  if (countOf(text, oldPart) !== 1) fail(`${what}: expected text found ${countOf(text, oldPart)} times (need exactly 1)`);
  return text.replace(oldPart, () => newPart);
}

export function tgwCard(nl) {
  return [
    '            <a',
    '  class="gwh-quick-world gwh-quick-world-live gwh-image-world"',
    `  href="${TGW_URL}"`,
    '  data-world="TGW"',
    "  style=\"--world-image:url('/hub-tgw.jpg')\"",
    '  aria-label="Technology">',
    '',
    '  <span class="gwh-legacy-world-text">',
    '    <strong>Technology</strong>',
    '    <small>Laptops · Phones · Audio · Gaming</small>',
    '  </span>',
    '',
    '  <span class="gwh-image-world-overlay">',
    '    <span class="gwh-image-world-code">TGW</span>',
    '    <strong class="gwh-image-world-title">Technology</strong>',
    `    <small class="gwh-image-world-description">${TGW_TEXT['en-GB'][1]}</small>`,
    '    <span class="gwh-image-world-cta">Shop →</span>',
    '  </span>',
    '</a>'
  ].join(nl);
}

// Seven cards: on a desktop 4 columns with Technology as a wide card; on phones and tablets it fills the last row.
export const TGW_STYLE = [
  '<style id="gwh-tgw-card">',
  '/* GWH-TGW-CARD: 7 worlds. Technology is the wide card at the end of the grid. */',
  'body[data-gwh-compact-v2="true"] .gwh-image-world[data-world="TGW"]{grid-column:1 / -1;aspect-ratio:auto !important;min-height:118px !important;}',
  '@media (min-width:1051px){',
  'body[data-gwh-compact-v2="true"] .gwh-quick-worlds{grid-template-columns:repeat(4,minmax(0,1fr)) !important;}',
  'body[data-gwh-compact-v2="true"] .gwh-image-world[data-world="TGW"]{grid-column:span 2;min-height:0 !important;}',
  '}',
  '</style>'
];

export function patchIndexHtml(html) {
  if (html.includes('data-world="TGW"') || html.includes(TGW_URL)) return { text: html, changes: [], already: true };
  const changes = [];
  if (countOf(html, 'data-world="GGW"') !== 1) fail('index.html: the Garden (GGW) card was not found exactly once');
  const start = html.indexOf('data-world="GGW"');
  const close = html.indexOf('</a>', start);
  if (close < 0) fail('index.html: the end of the Garden card was not found');
  const end = close + '</a>'.length;
  const nl = html.slice(start, end).includes('\r\n') ? '\r\n' : '\n';
  let text = html.slice(0, end) + nl + tgwCard(nl) + html.slice(end);
  changes.push('index.html: Technology card added after Garden');
  if (countOf(text, '</head>') !== 1) fail('index.html: </head> not found exactly once');
  text = text.replace('</head>', () => TGW_STYLE.join(nl) + nl + '</head>');
  changes.push('index.html: layout for 7 cards (style block before </head>)');
  text = replaceOnce(text, EN_ONE_HUB_OLD, EN_ONE_HUB_NEW, 'index.html "One Central Hub"');
  changes.push('index.html: "One Central Hub" text lists Technology');
  text = replaceOnce(text, EN_GROWING_OLD, EN_GROWING_NEW, 'index.html "Growing Network"');
  changes.push('index.html: "Growing Network" text says Technology / seven');
  return { text, changes, already: false };
}

function locales(js) {
  const m = js.match(/const LOCALES = \[([\s\S]*?)\]/);
  if (!m) fail('translations.js: LOCALES list not found');
  const list = [...m[1].matchAll(/"([a-z]{2}-[A-Z]{2})"/g)].map(x => x[1]);
  const want = Object.keys(TGW_TEXT);
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

function appendToList(block, key, value, what) {
  const open = block.indexOf(`${key}: [`);
  if (open < 0) fail(`${what}: "${key}" not found`);
  const close = block.indexOf(']', open);
  const inner = block.slice(open + key.length + 3, close);
  const items = [...inner.matchAll(/"((?:[^"\\]|\\.)*)"/g)];
  if (items.length !== 6) fail(`${what}: "${key}" has ${items.length} entries (expected 6)`);
  const last = items[items.length - 1];
  const lastEnd = open + key.length + 3 + last.index + last[0].length;
  const lineStart = block.lastIndexOf('\n', open + key.length + 3 + last.index) + 1;
  const indent = block.slice(lineStart, open + key.length + 3 + last.index);
  const nl = block.slice(lineStart - 2, lineStart) === '\r\n' ? '\r\n' : '\n';
  return block.slice(0, lastEnd) + ',' + nl + indent + JSON.stringify(value) + block.slice(lastEnd);
}

export function patchTranslations(js) {
  if (js.includes('Technology Gear World') || js.includes('"Технологии"')) return { text: js, changes: [], already: true };
  const langs = locales(js);
  const changes = [];
  let text = patchArrayLine(js, 'oneHubDesc', arr => {
    if (arr.length !== langs.length) fail('translations.js: oneHubDesc has the wrong number of languages');
    return arr.map((s, i) => {
      if (!/Home (\S+) Garden Gear World/.test(s)) fail(`translations.js: oneHubDesc (${langs[i]}) has an unexpected text`);
      return s.replace(/Home (\S+) Garden Gear World/, 'Home, Garden $1 Technology Gear World');
    });
  });
  changes.push('translations.js: "One Central Hub" text lists Technology in 11 languages');
  text = patchArrayLine(text, 'growingDesc', arr => {
    if (arr.length !== langs.length) fail('translations.js: growingDesc has the wrong number of languages');
    return arr.map((s, i) => {
      const [re, to] = SEVEN[langs[i]];
      if (countOf(s, 'Garden Gear World') !== 1 || !re.test(s)) fail(`translations.js: growingDesc (${langs[i]}) has an unexpected text`);
      return s.replace('Garden Gear World', 'Technology Gear World').replace(re, to);
    });
  });
  changes.push('translations.js: "Growing Network" text says Technology / seven in 11 languages');

  const v2 = text.indexOf('const V2 = {');
  if (v2 < 0) fail('translations.js: card translations (V2) not found');
  for (const lang of langs) {
    const head = `"${lang}": {`;
    const s = text.indexOf(head, v2);
    if (s < 0) fail(`translations.js: card texts for ${lang} not found`);
    const nextLang = text.slice(s + head.length).search(/"[a-z]{2}-[A-Z]{2}": \{/);
    const e = nextLang < 0 ? text.length : s + head.length + nextLang;
    let block = text.slice(s, e);
    block = appendToList(block, 'titles', TGW_TEXT[lang][0], `translations.js ${lang}`);
    block = appendToList(block, 'descriptions', TGW_TEXT[lang][1], `translations.js ${lang}`);
    text = text.slice(0, s) + block + text.slice(e);
  }
  changes.push('translations.js: Technology card title and text in 11 languages');
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
  if (!hub) { console.error('usage: node gwh-tgw-link.mjs --hub <folder> [--out <folder>] [--write]'); process.exit(2); }
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

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('gwh-tgw-link.mjs')) main();
