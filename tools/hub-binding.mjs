// "Get deal updates" (lessons L90): small changes to the Worker configs that stay on the PC.
//   - the 6 newer sites (wrangler.jsonc): the service binding HUB -> gear-world-hub, so their form reaches the Hub;
//   - the Hub (wrangler.toml): a cron every 30 minutes, which copies new members with consent to MailerLite.
// Like tools/poster-config.mjs: the text is changed in one place only, comments and layout stay, and the result is
// read back (everything that was there is still there).
//
//   node tools/hub-binding.mjs check-hub <wrangler.jsonc>    prints "has" or "missing"
//   node tools/hub-binding.mjs add-hub <wrangler.jsonc>      prints "added" or "already" (exit 1 on any doubt)
//   node tools/hub-binding.mjs check-cron <wrangler.toml>    prints "has" or "missing"
//   node tools/hub-binding.mjs add-cron <wrangler.toml>      prints "added" or "already" (exit 1 on any doubt)
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { blankJsonc, parseJsonc } from './poster-config.mjs';

export const BINDING = 'HUB';
export const SERVICE = 'gear-world-hub';
export const CRON = '*/30 * * * *';
const ENTRY = `{ "binding": "${BINDING}", "service": "${SERVICE}" }`;

const hasHub = cfg => Array.isArray(cfg.services) && cfg.services.some(s => s && s.binding === BINDING);

export function addHubJsonc(text) {
  const before = parseJsonc(text);
  if (!before || typeof before !== 'object' || Array.isArray(before) || !before.name) throw new Error('not a Worker config');
  if (before.name === SERVICE) throw new Error('the Hub does not bind to itself');
  if (hasHub(before)) {
    const entry = before.services.filter(s => s && s.binding === BINDING);
    if (entry.length !== 1 || entry[0].service !== SERVICE) throw new Error('HUB points somewhere else');
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
    if (o) out = text.slice(0, o.index) + `${o[1]}"services": [${ENTRY}],${nl}` + text.slice(o.index);
    else {
      const open = blank.indexOf('{');
      if (open < 0) throw new Error('no object');
      out = text.slice(0, open + 1) + `${nl}  "services": [${ENTRY}],` + text.slice(open + 1);
    }
  }
  const after = parseJsonc(out);
  if (!hasHub(after)) throw new Error('HUB not found after the change');
  const strip = cfg => { const copy = { ...cfg }; delete copy.services; return JSON.stringify(copy); };
  if (strip(before) !== strip(after)) throw new Error('other settings changed');
  if (JSON.stringify(before.services || []) !== JSON.stringify(after.services.filter(s => !(s && s.binding === BINDING)))) throw new Error('other services changed');
  return { text: out, changed: true };
}

const cronHas = text => /^\s*crons\s*=\s*\[[^\]]*"\*\/30 \* \* \* \*"[^\]]*\]\s*$/m.test(text);

// The Hub's wrangler.toml: [triggers] crons = ["*/30 * * * *"] at the end (a table of its own).
export function addCronToml(text) {
  if (!/^\s*name\s*=\s*"gear-world-hub"\s*$/m.test(text)) throw new Error('not the Hub config');
  if (cronHas(text)) return { text, changed: false };
  if (/^\s*\[triggers\]\s*$/m.test(text) || /^\s*crons\s*=/m.test(text)) throw new Error('the Hub already has other triggers');
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const body = text.replace(/[\r\n]+$/, '');
  const out = `${body}${nl}${nl}# Members with consent are copied to MailerLite every 30 minutes (lessons L90), added by tools/hub-members.ps1${nl}[triggers]${nl}crons = ["${CRON}"]${nl}`;
  if (!out.startsWith(body) || !cronHas(out)) throw new Error('change failed');
  return { text: out, changed: true };
}

function main(argv) {
  const [mode, file] = argv;
  if (!file || !['check-hub', 'add-hub', 'check-cron', 'add-cron'].includes(mode)) { console.log('usage: hub-binding.mjs check-hub|add-hub|check-cron|add-cron <file>'); return 2; }
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { console.log('missing-file'); return 2; }
  const bom = text.charCodeAt(0) === 0xfeff;
  if (bom) text = text.slice(1);
  try {
    if (mode === 'check-hub') { console.log(hasHub(parseJsonc(text)) ? 'has' : 'missing'); return 0; }
    if (mode === 'check-cron') { console.log(cronHas(text) ? 'has' : 'missing'); return 0; }
    const r = mode === 'add-hub' ? addHubJsonc(text) : addCronToml(text);
    if (r.changed) writeFileSync(file, (bom ? '﻿' : '') + r.text, 'utf8');
    console.log(r.changed ? 'added' : 'already');
    return 0;
  } catch (e) {
    console.log(`error: ${e.message}`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = main(process.argv.slice(2));
