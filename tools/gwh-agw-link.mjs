// Gear World Hub: adds Car Gear World (AGW) to the hub homepage files, after Technology (TGW).
// Pure text changes, checked step by step. If the hub files do not look exactly as expected, it changes NOTHING.
// The hub must already have the TGW card (tools/gwh-tgw-link.mjs): AGW becomes the 8th card.
//
//   node tools/gwh-agw-link.mjs --hub <hub folder> [--out <folder>] [--write]
//     without --write: only reports what would change (and with --out writes patched copies there)
//     with --write:    writes public/index.html and public/translations.js in the hub folder
//
// The PowerShell tool gwh-agw-link.ps1 makes the backup, asks for approval, deploys and checks.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { TGW_STYLE } from './gwh-tgw-link.mjs';

export const AGW_URL = 'https://cargearworld.com/';

// Card texts per hub language (same order and codes as the hub's LOCALES).
export const AGW_TEXT = {
  'en-GB': ['Car', 'Garage tools, parts, car care and dash cams.'],
  'el-GR': ['Αυτοκίνητο', 'Εργαλεία συνεργείου, ανταλλακτικά, περιποίηση και κάμερες.'],
  'de-DE': ['Auto', 'Werkstattwerkzeug, Teile, Autopflege und Dashcams.'],
  'fr-FR': ['Auto', 'Outils de garage, pièces, entretien et dashcams.'],
  'it-IT': ['Auto', 'Attrezzi da officina, ricambi, cura auto e dash cam.'],
  'es-ES': ['Coche', 'Herramientas de taller, recambios, cuidado y cámaras.'],
  'pt-PT': ['Automóvel', 'Ferramentas de oficina, peças, cuidado e câmaras.'],
  'nl-NL': ['Auto', 'Garagegereedschap, onderdelen, autoverzorging en dashcams.'],
  'sq-AL': ['Makina', 'Vegla garazhi, pjesë, kujdes makine dhe kamera.'],
  'ro-RO': ['Auto', 'Scule de garaj, piese, îngrijire auto și camere.'],
  'ru-RU': ['Авто', 'Гаражный инструмент, запчасти, уход и видеорегистраторы.']
};

// "seven" -> "eight" in the "Growing Network" sentence, per language (the words the TGW link wrote).
const EIGHT = {
  'en-GB': [/(?<!\p{L})seven(?!\p{L})/u, 'eight'],
  'el-GR': [/(?<!\p{L})επτά(?!\p{L})/u, 'οκτώ'],
  'de-DE': [/(?<!\p{L})sieben(?!\p{L})/u, 'acht'],
  'fr-FR': [/(?<!\p{L})sept(?!\p{L})/u, 'huit'],
  'it-IT': [/(?<!\p{L})sette(?!\p{L})/u, 'otto'],
  'es-ES': [/(?<!\p{L})siete(?!\p{L})/u, 'ocho'],
  'pt-PT': [/(?<!\p{L})sete(?!\p{L})/u, 'oito'],
  'nl-NL': [/(?<!\p{L})zeven(?!\p{L})/u, 'acht'],
  'sq-AL': [/(?<!\p{L})shtatë(?!\p{L})/u, 'tetë'],
  'ro-RO': [/(?<!\p{L})[șş]apte(?!\p{L})/u, 'opt'],
  'ru-RU': [/(?<!\p{L})семи(?!\p{L})/u, 'восьми']
};

const EN_ONE_HUB_OLD = "Access Construction, Men's, Women's, Kids', Home, Garden and Technology Gear World from one starting point.";
const EN_ONE_HUB_NEW = "Access Construction, Men's, Women's, Kids', Home, Garden, Technology and Car Gear World from one starting point.";
const EN_GROWING_OLD = 'Technology Gear World is now live, expanding the Gear World network to seven specialist shopping worlds.';
const EN_GROWING_NEW = 'Car Gear World is now live, expanding the Gear World network to eight specialist shopping worlds.';

function fail(msg) { const e = new Error(msg); e.code = 'HUB_LAYOUT'; throw e; }

function countOf(text, part) { return text.split(part).length - 1; }

function replaceOnce(text, oldPart, newPart, what) {
  if (countOf(text, oldPart) !== 1) fail(`${what}: expected text found ${countOf(text, oldPart)} times (need exactly 1)`);
  return text.replace(oldPart, () => newPart);
}

export function agwCard(nl) {
  return [
    '            <a',
    '  class="gwh-quick-world gwh-quick-world-live gwh-image-world"',
    `  href="${AGW_URL}"`,
    '  data-world="AGW"',
    "  style=\"--world-image:url('/hub-agw.jpg')\"",
    '  aria-label="Car">',
    '',
    '  <span class="gwh-legacy-world-text">',
    '    <strong>Car</strong>',
    '    <small>Garage Tools · Parts · Car Care · Dash Cams</small>',
    '  </span>',
    '',
    '  <span class="gwh-image-world-overlay">',
    '    <span class="gwh-image-world-code">AGW</span>',
    '    <strong class="gwh-image-world-title">Car</strong>',
    `    <small class="gwh-image-world-description">${AGW_TEXT['en-GB'][1]}</small>`,
    '    <span class="gwh-image-world-cta">Shop →</span>',
    '  </span>',
    '</a>'
  ].join(nl);
}

// Eight cards: two full rows of 4 on a desktop, four rows of 2 on phones. Technology is no longer the wide card,
// so the TGW style block is replaced by this one.
export const AGW_STYLE = [
  '<style id="gwh-agw-card">',
  '/* GWH-AGW-CARD: 8 worlds, all cards the same size. Replaces the 7-card block (gwh-tgw-card). */',
  '@media (min-width:1051px){',
  'body[data-gwh-compact-v2="true"] .gwh-quick-worlds{grid-template-columns:repeat(4,minmax(0,1fr)) !important;}',
  '}',
  '</style>'
];

export function patchIndexHtml(html) {
  if (html.includes('data-world="AGW"') || html.includes(AGW_URL)) return { text: html, changes: [], already: true };
  const changes = [];
  // The card attribute is on its own line; the 7-card style block also names [data-world="TGW"].
  const cardAttr = /^[ \t]*data-world="TGW"[ \t]*\r?$/gm;
  const hits = [...html.matchAll(cardAttr)];
  if (hits.length !== 1) fail('index.html: the Technology (TGW) card was not found exactly once (link TGW to the hub first)');
  const start = hits[0].index;
  const close = html.indexOf('</a>', start);
  if (close < 0) fail('index.html: the end of the Technology card was not found');
  const end = close + '</a>'.length;
  const nl = html.slice(start, end).includes('\r\n') ? '\r\n' : '\n';
  let text = html.slice(0, end) + nl + agwCard(nl) + html.slice(end);
  changes.push('index.html: Car card added after Technology');
  let oldStyle = TGW_STYLE.join(nl);
  if (countOf(text, oldStyle) !== 1) oldStyle = TGW_STYLE.join(nl === '\n' ? '\r\n' : '\n');
  if (countOf(text, oldStyle) !== 1) fail('index.html: the 7-card style block (gwh-tgw-card) was not found exactly as the TGW link wrote it');
  text = text.replace(oldStyle, () => AGW_STYLE.join(nl));
  changes.push('index.html: layout for 8 cards (2 rows of 4; Technology no longer wide)');
  text = replaceOnce(text, EN_ONE_HUB_OLD, EN_ONE_HUB_NEW, 'index.html "One Central Hub"');
  changes.push('index.html: "One Central Hub" text lists Car');
  text = replaceOnce(text, EN_GROWING_OLD, EN_GROWING_NEW, 'index.html "Growing Network"');
  changes.push('index.html: "Growing Network" text says Car / eight');
  return { text, changes, already: false };
}

function locales(js) {
  const m = js.match(/const LOCALES = \[([\s\S]*?)\]/);
  if (!m) fail('translations.js: LOCALES list not found');
  const list = [...m[1].matchAll(/"([a-z]{2}-[A-Z]{2})"/g)].map(x => x[1]);
  const want = Object.keys(AGW_TEXT);
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

function appendToList(block, key, value, what, expected = 7) {
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
  if (js.includes('Car Gear World') || js.includes('"Авто"')) return { text: js, changes: [], already: true };
  const langs = locales(js);
  const changes = [];
  let text = patchArrayLine(js, 'oneHubDesc', arr => {
    if (arr.length !== langs.length) fail('translations.js: oneHubDesc has the wrong number of languages');
    return arr.map((s, i) => {
      if (!/Garden (\S+) Technology Gear World/.test(s)) fail(`translations.js: oneHubDesc (${langs[i]}) has an unexpected text`);
      return s.replace(/Garden (\S+) Technology Gear World/, 'Garden, Technology $1 Car Gear World');
    });
  });
  changes.push('translations.js: "One Central Hub" text lists Car in 11 languages');
  text = patchArrayLine(text, 'growingDesc', arr => {
    if (arr.length !== langs.length) fail('translations.js: growingDesc has the wrong number of languages');
    return arr.map((s, i) => {
      const [re, to] = EIGHT[langs[i]];
      if (countOf(s, 'Technology Gear World') !== 1 || !re.test(s)) fail(`translations.js: growingDesc (${langs[i]}) has an unexpected text`);
      return s.replace('Technology Gear World', 'Car Gear World').replace(re, to);
    });
  });
  changes.push('translations.js: "Growing Network" text says Car / eight in 11 languages');

  const v2 = text.indexOf('const V2 = {');
  if (v2 < 0) fail('translations.js: card translations (V2) not found');
  for (const lang of langs) {
    const head = `"${lang}": {`;
    const s = text.indexOf(head, v2);
    if (s < 0) fail(`translations.js: card texts for ${lang} not found`);
    const nextLang = text.slice(s + head.length).search(/"[a-z]{2}-[A-Z]{2}": \{/);
    const e = nextLang < 0 ? text.length : s + head.length + nextLang;
    let block = text.slice(s, e);
    block = appendToList(block, 'titles', AGW_TEXT[lang][0], `translations.js ${lang}`);
    block = appendToList(block, 'descriptions', AGW_TEXT[lang][1], `translations.js ${lang}`);
    text = text.slice(0, s) + block + text.slice(e);
  }
  changes.push('translations.js: Car card title and text in 11 languages');
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
  if (!hub) { console.error('usage: node gwh-agw-link.mjs --hub <folder> [--out <folder>] [--write]'); process.exit(2); }
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

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('gwh-agw-link.mjs')) main();
