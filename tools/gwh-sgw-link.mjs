// Gear World Hub: adds Sporty Gear World (SGW) to the hub homepage files, after Travel (VGW).
// Pure text changes, checked step by step. If the hub files do not look exactly as expected, it changes NOTHING.
// The hub must already have the VGW card (tools/gwh-vgw-link.mjs): SGW becomes the 10th card.
//
//   node tools/gwh-sgw-link.mjs --hub <hub folder> [--out <folder>] [--write]
//     without --write: only reports what would change (and with --out writes patched copies there)
//     with --write:    writes public/index.html and public/translations.js in the hub folder
//
// The PowerShell tool gwh-sgw-link.ps1 makes the backup, asks for approval, deploys and checks.
// It never touches the hub's worker.js (search, photo search) or any other hub file.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { VGW_STYLE } from './gwh-vgw-link.mjs';

export const SGW_URL = 'https://sportygearworld.com/';

// Card texts per hub language (same order and codes as the hub's LOCALES).
export const SGW_TEXT = {
  'en-GB': ['Sport', 'Fitness, running, cycling, team sports and nutrition.'],
  'el-GR': ['Αθλητισμός', 'Γυμναστική, τρέξιμο, ποδήλατο, ομαδικά αθλήματα και διατροφή.'],
  'de-DE': ['Sport', 'Fitness, Laufen, Radsport, Teamsport und Sporternährung.'],
  'fr-FR': ['Sport', 'Fitness, course à pied, vélo, sports collectifs et nutrition.'],
  'it-IT': ['Sport', 'Fitness, corsa, ciclismo, sport di squadra e nutrizione.'],
  'es-ES': ['Deporte', 'Fitness, running, ciclismo, deportes de equipo y nutrición.'],
  'pt-PT': ['Desporto', 'Fitness, corrida, ciclismo, desportos coletivos e nutrição.'],
  'nl-NL': ['Sport', 'Fitness, hardlopen, fietsen, teamsporten en sportvoeding.'],
  'sq-AL': ['Sport', 'Fitnes, vrapim, çiklizëm, sporte ekipore dhe ushqyerje sportive.'],
  'ro-RO': ['Sport', 'Fitness, alergare, ciclism, sporturi de echipă și nutriție.'],
  'ru-RU': ['Спорт', 'Фитнес, бег, велоспорт, командные виды спорта и спортивное питание.']
};

// "nine" -> "ten" in the "Growing Network" sentence, per language (the words the VGW link wrote).
const TEN = {
  'en-GB': [/(?<!\p{L})nine(?!\p{L})/u, 'ten'],
  'el-GR': [/(?<!\p{L})εννέα(?!\p{L})/u, 'δέκα'],
  'de-DE': [/(?<!\p{L})neun(?!\p{L})/u, 'zehn'],
  'fr-FR': [/(?<!\p{L})neuf(?!\p{L})/u, 'dix'],
  'it-IT': [/(?<!\p{L})nove(?!\p{L})/u, 'dieci'],
  'es-ES': [/(?<!\p{L})nueve(?!\p{L})/u, 'diez'],
  'pt-PT': [/(?<!\p{L})nove(?!\p{L})/u, 'dez'],
  'nl-NL': [/(?<!\p{L})negen(?!\p{L})/u, 'tien'],
  'sq-AL': [/(?<!\p{L})nëntë(?!\p{L})/u, 'dhjetë'],
  'ro-RO': [/(?<!\p{L})nouă(?!\p{L})/u, 'zece'],
  'ru-RU': [/(?<!\p{L})девяти(?!\p{L})/u, 'десяти']
};

const EN_ONE_HUB_OLD = "Access Construction, Men's, Women's, Kids', Home, Garden, Technology, Car and Travel Gear World from one starting point.";
const EN_ONE_HUB_NEW = "Access Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel and Sporty Gear World from one starting point.";
const EN_GROWING_OLD = 'Travel Gear World is now live, expanding the Gear World network to nine specialist shopping worlds.';
const EN_GROWING_NEW = 'Sporty Gear World is now live, expanding the Gear World network to ten specialist shopping worlds.';

function fail(msg) { const e = new Error(msg); e.code = 'HUB_LAYOUT'; throw e; }

function countOf(text, part) { return text.split(part).length - 1; }

function replaceOnce(text, oldPart, newPart, what) {
  if (countOf(text, oldPart) !== 1) fail(`${what}: expected text found ${countOf(text, oldPart)} times (need exactly 1)`);
  return text.replace(oldPart, () => newPart);
}

export function sgwCard(nl) {
  return [
    '            <a',
    '  class="gwh-quick-world gwh-quick-world-live gwh-image-world"',
    `  href="${SGW_URL}"`,
    '  data-world="SGW"',
    "  style=\"--world-image:url('/hub-sgw.jpg')\"",
    '  aria-label="Sport">',
    '',
    '  <span class="gwh-legacy-world-text">',
    '    <strong>Sport</strong>',
    '    <small>Fitness · Running · Cycling · Team Sports</small>',
    '  </span>',
    '',
    '  <span class="gwh-image-world-overlay">',
    '    <span class="gwh-image-world-code">SGW</span>',
    '    <strong class="gwh-image-world-title">Sport</strong>',
    `    <small class="gwh-image-world-description">${SGW_TEXT['en-GB'][1]}</small>`,
    '    <span class="gwh-image-world-cta">Shop →</span>',
    '  </span>',
    '</a>'
  ].join(nl);
}

// Ten cards. Five columns made every card too small (titles over the labels, harder to read), so the hub keeps its own
// columns (2 up to 620px wide, 3 from 621px, measured on the live hub 25 Oct 2026). With 3 per row the Sport card takes
// the whole last row as a wide card of the same height (5:1 next to the 5:3 cards); with 2 per row ten cards fill five
// rows and nothing spans. Replaces the 9-card block (gwh-vgw-card).
export const SGW_STYLE = [
  '<style id="gwh-sgw-card">',
  '/* GWH-SGW-CARD: 10 worlds. 3 per row with Sport as one wide card on the last row; 2 per row up to 620px. Replaces gwh-vgw-card. */',
  '@media (min-width:621px){',
  'body[data-gwh-compact-v2="true"] .gwh-quick-worlds > [data-world="SGW"]{grid-column:1 / -1;aspect-ratio:5 / 1;background-position:center 12% !important;}',
  '}',
  '</style>'
];

export function patchIndexHtml(html) {
  if (html.includes('data-world="SGW"') || html.includes(SGW_URL)) return { text: html, changes: [], already: true };
  const changes = [];
  const cardAttr = /^[ \t]*data-world="VGW"[ \t]*\r?$/gm;
  const hits = [...html.matchAll(cardAttr)];
  if (hits.length !== 1) fail('index.html: the Travel (VGW) card was not found exactly once (link VGW to the hub first)');
  const start = hits[0].index;
  const close = html.indexOf('</a>', start);
  if (close < 0) fail('index.html: the end of the Travel card was not found');
  const end = close + '</a>'.length;
  const nl = html.slice(start, end).includes('\r\n') ? '\r\n' : '\n';
  let text = html.slice(0, end) + nl + sgwCard(nl) + html.slice(end);
  changes.push('index.html: Sport card added after Travel');
  let oldStyle = VGW_STYLE.join(nl);
  if (countOf(text, oldStyle) !== 1) oldStyle = VGW_STYLE.join(nl === '\n' ? '\r\n' : '\n');
  if (countOf(text, oldStyle) !== 1) fail('index.html: the 9-card style block (gwh-vgw-card) was not found exactly as the VGW link wrote it');
  text = text.replace(oldStyle, () => SGW_STYLE.join(nl));
  changes.push('index.html: layout for 10 cards (3 per row with Sport as a wide card on the last row; 2 per row on phones)');
  text = replaceOnce(text, EN_ONE_HUB_OLD, EN_ONE_HUB_NEW, 'index.html "One Central Hub"');
  changes.push('index.html: "One Central Hub" text lists Sporty');
  text = replaceOnce(text, EN_GROWING_OLD, EN_GROWING_NEW, 'index.html "Growing Network"');
  changes.push('index.html: "Growing Network" text says Sporty / ten');
  return { text, changes, already: false };
}

function locales(js) {
  const m = js.match(/const LOCALES = \[([\s\S]*?)\]/);
  if (!m) fail('translations.js: LOCALES list not found');
  const list = [...m[1].matchAll(/"([a-z]{2}-[A-Z]{2})"/g)].map(x => x[1]);
  const want = Object.keys(SGW_TEXT);
  if (list.length !== want.length || want.some(l => !list.includes(l))) fail(`translations.js: unexpected languages ${list.join(',')}`);
  return list;
}

function patchArrayLine(js, key, mapFn) {
  const re = new RegExp(`(\\n[ \\t]*${key}: )(\\[.*\\])(,?\\r?\\n)`);
  const matches = js.match(new RegExp(re.source, 'g')) || [];
  if (matches.length !== 1) fail(`translations.js: "${key}" found ${matches.length} times (need exactly 1)`);
  const m = js.match(re);
  let arr;
  try { arr = JSON.parse(m[2]); } catch { fail(`translations.js: "${key}" is not a simple list of texts`); }
  const next = mapFn(arr);
  return js.replace(re, (_, a, _b, c) => a + JSON.stringify(next) + c);
}

function appendToList(block, key, value, what, expected = 9) {
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
  if (js.includes('Sporty Gear World')) return { text: js, changes: [], already: true };
  const langs = locales(js);
  const changes = [];
  let text = patchArrayLine(js, 'oneHubDesc', arr => {
    if (arr.length !== langs.length) fail('translations.js: oneHubDesc has the wrong number of languages');
    return arr.map((s, i) => {
      if (!/Car (\S+) Travel Gear World/.test(s)) fail(`translations.js: oneHubDesc (${langs[i]}) has an unexpected text`);
      return s.replace(/Car (\S+) Travel Gear World/, 'Car, Travel $1 Sporty Gear World');
    });
  });
  changes.push('translations.js: "One Central Hub" text lists Sporty in 11 languages');
  text = patchArrayLine(text, 'growingDesc', arr => {
    if (arr.length !== langs.length) fail('translations.js: growingDesc has the wrong number of languages');
    return arr.map((s, i) => {
      const [re, to] = TEN[langs[i]];
      if (countOf(s, 'Travel Gear World') !== 1 || !re.test(s)) fail(`translations.js: growingDesc (${langs[i]}) has an unexpected text`);
      return s.replace('Travel Gear World', 'Sporty Gear World').replace(re, to);
    });
  });
  changes.push('translations.js: "Growing Network" text says Sporty / ten in 11 languages');

  const v2 = text.indexOf('const V2 = {');
  if (v2 < 0) fail('translations.js: card translations (V2) not found');
  for (const lang of langs) {
    const head = `"${lang}": {`;
    const s = text.indexOf(head, v2);
    if (s < 0) fail(`translations.js: card texts for ${lang} not found`);
    const nextLang = text.slice(s + head.length).search(/"[a-z]{2}-[A-Z]{2}": \{/);
    const e = nextLang < 0 ? text.length : s + head.length + nextLang;
    let block = text.slice(s, e);
    block = appendToList(block, 'titles', SGW_TEXT[lang][0], `translations.js ${lang}`);
    block = appendToList(block, 'descriptions', SGW_TEXT[lang][1], `translations.js ${lang}`);
    text = text.slice(0, s) + block + text.slice(e);
  }
  changes.push('translations.js: Sport card title and text in 11 languages');
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
  if (!hub) { console.error('usage: node gwh-sgw-link.mjs --hub <folder> [--out <folder>] [--write]'); process.exit(2); }
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

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('gwh-sgw-link.mjs')) main();
