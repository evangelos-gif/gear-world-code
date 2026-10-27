// Poster QR scans (lessons L76): adds the service binding POSTERS -> gear-world-posters to a Worker config on the PC.
// Used by tools/poster-setup.ps1 for the live configs that stay on the PC (TGW, AGW, VGW, SGW: wrangler.jsonc;
// the Hub: wrangler.toml). The text is changed in one place only, comments and layout stay as they are, and the
// result is read back: every setting that was there is still there, and POSTERS is there once.
//
//   node tools/poster-config.mjs check <file>   read-only: prints "has" or "missing"
//   node tools/poster-config.mjs add <file>     prints "added" or "already" (exit 1 and nothing written on any doubt)
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const BINDING = 'POSTERS';
export const SERVICE = 'gear-world-posters';
const ENTRY = `{ "binding": "${BINDING}", "service": "${SERVICE}" }`;

// JSONC (wrangler.jsonc) without comments and trailing commas, so JSON.parse can read it.
// Positions of strings are kept (comments become spaces), so an index found here is an index in the original text.
export function blankJsonc(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') { if (text[j] === '\\') j++; j++; }
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && n === '/') {
      let j = i;
      while (j < text.length && text[j] !== '\n' && text[j] !== '\r') j++;
      out += ' '.repeat(j - i);
      i = j;
    } else if (c === '/' && n === '*') {
      let j = text.indexOf('*/', i + 2);
      j = j < 0 ? text.length : j + 2;
      out += text.slice(i, j).replace(/[^\r\n]/g, ' ');
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

export function parseJsonc(text) {
  const blank = blankJsonc(text);
  // Trailing commas: a comma followed (after spaces) by } or ], outside strings.
  let clean = '';
  let inString = false;
  for (let i = 0; i < blank.length; i++) {
    const c = blank[i];
    if (inString) {
      clean += c;
      if (c === '\\') { clean += blank[i + 1]; i++; } else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; clean += c; continue; }
    if (c === ',') {
      let j = i + 1;
      while (j < blank.length && /\s/.test(blank[j])) j++;
      if (blank[j] === '}' || blank[j] === ']') { clean += ' '; continue; }
    }
    clean += c;
  }
  return JSON.parse(clean);
}

const hasJsonc = cfg => Array.isArray(cfg.services) && cfg.services.some(s => s && s.binding === BINDING);

// Adds the binding to a wrangler.jsonc text. Returns { text, changed }. Throws when the text is not what it should be.
export function addPostersJsonc(text) {
  const before = parseJsonc(text);
  if (!before || typeof before !== 'object' || Array.isArray(before) || !before.name) throw new Error('not a Worker config');
  if (hasJsonc(before)) {
    const entry = before.services.filter(s => s && s.binding === BINDING);
    if (entry.length !== 1 || entry[0].service !== SERVICE) throw new Error('POSTERS points somewhere else');
    return { text, changed: false };
  }
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const blank = blankJsonc(text);
  let out;
  const m = /"services"\s*:\s*\[/.exec(blank);
  if (m) {
    const at = m.index + m[0].length;
    let j = at;
    while (j < blank.length && /\s/.test(blank[j])) j++;
    const empty = blank[j] === ']';
    out = text.slice(0, at) + ENTRY + (empty ? '' : ', ') + text.slice(at);
  } else {
    const o = /^([ \t]*)"observability"\s*:/m.exec(blank);
    if (o) {
      out = text.slice(0, o.index) + `${o[1]}"services": [${ENTRY}],${nl}` + text.slice(o.index);
    } else {
      const open = blank.indexOf('{');
      if (open < 0) throw new Error('no object');
      out = text.slice(0, open + 1) + `${nl}  "services": [${ENTRY}],` + text.slice(open + 1);
    }
  }
  const after = parseJsonc(out);
  if (!hasJsonc(after)) throw new Error('POSTERS not found after the change');
  // Everything that was there is still there, and only services changed.
  const strip = cfg => { const copy = { ...cfg }; delete copy.services; return JSON.stringify(copy); };
  if (strip(before) !== strip(after)) throw new Error('other settings changed');
  const oldServices = JSON.stringify(before.services || []);
  const newServices = JSON.stringify(after.services.filter(s => !(s && s.binding === BINDING)));
  if (oldServices !== newServices) throw new Error('other services changed');
  return { text: out, changed: true };
}

const tomlHas = text => /^\s*binding\s*=\s*"POSTERS"\s*$/m.test(text);

// Adds the binding to a wrangler.toml text (the Hub). [[services]] is a table of its own, so it goes at the end.
export function addPostersToml(text) {
  if (!/^\s*name\s*=\s*"[a-z0-9-]+"\s*$/m.test(text)) throw new Error('not a Worker config');
  if (tomlHas(text)) {
    if (!new RegExp(`^\\s*service\\s*=\\s*"${SERVICE}"\\s*$`, 'm').test(text)) throw new Error('POSTERS points somewhere else');
    return { text, changed: false };
  }
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const body = text.replace(/[\r\n]+$/, '');
  const out = `${body}${nl}${nl}# Poster QR scans (lessons L76), added by tools/poster-setup.ps1${nl}[[services]]${nl}binding = "${BINDING}"${nl}service = "${SERVICE}"${nl}`;
  if (!out.startsWith(body) || !tomlHas(out)) throw new Error('change failed');
  return { text: out, changed: true };
}

export function hasPosters(file, text) {
  return file.toLowerCase().endsWith('.toml') ? tomlHas(text) : hasJsonc(parseJsonc(text));
}

function main(argv) {
  const [mode, file] = argv;
  if (!file || !['check', 'add'].includes(mode)) { console.log('usage: poster-config.mjs check|add <file>'); return 2; }
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { console.log('missing-file'); return 2; }
  const bom = text.charCodeAt(0) === 0xfeff;
  if (bom) text = text.slice(1);
  try {
    if (mode === 'check') { console.log(hasPosters(file, text) ? 'has' : 'missing'); return 0; }
    const r = file.toLowerCase().endsWith('.toml') ? addPostersToml(text) : addPostersJsonc(text);
    if (r.changed) writeFileSync(file, (bom ? '\uFEFF' : '') + r.text, 'utf8');
    console.log(r.changed ? 'added' : 'already');
    return 0;
  } catch (e) {
    console.log(`error: ${e.message}`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = main(process.argv.slice(2));
