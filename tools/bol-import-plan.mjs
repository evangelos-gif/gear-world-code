#!/usr/bin/env node
// bol.com NL - import PLAN (dry run) for its 10 sites at once (lessons L204). READ-ONLY: reads the bol.com feed files on
// this PC (BOL_<category>_NL.csv.gz and BOL_0_NL-<search>.csv.gz of tools/bol-feed-download.ps1) and writes, in a NEW
// folder, what WOULD be imported, site by site and category by category, and why the rest is left out. Nothing is sent
// to Cloudflare or to a database; the SQL files the planners write are never run by this tool.
//   older-sites/   tools/legacy-import-plan.mjs with tools/import-rules/bol-nl.mjs (HGW, CGW, GGW, WGW, MGW, KGW)
//   agw/ vgw/ sgw/ zgw/   tools/tgw-import-plan.mjs with the bol.com entries of sites/<site>/sources.json ("sections":
//                  "bol-nl"); those entries are "paused" there, so no import of those sites reads them: this plan reads
//                  them anyway (a copy of the entries without "paused", in the plan's own folder).
//   summary.txt    the short report for the owner and the Manager. A feed file older than 12 hours is planned all the
//                  same here, and listed: the import itself refuses it (run the download again first).
//
// Usage: node tools/bol-import-plan.mjs --archive <dir>[;<dir>] --out <new dir>
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { planLegacyImport } from './legacy-import-plan.mjs';
import { planImport, archiveList } from './tgw-import-plan.mjs';
import { BOL_FILE, BOL_SOURCES, BOL_SEARCHES, NEW_SITES, LEGACY_SITES, BOL_MAX_AGE_HOURS } from './import-rules/lib/bol-nl.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const fmt = n => new Intl.NumberFormat('en-GB').format(n);

// The bol.com files in the archive folder(s): [{ dir, name, category, search }].
export function bolFiles(archives) {
  const out = [];
  for (const dir of archiveList(archives)) {
    let names = [];
    try { names = readdirSync(dir); } catch { continue; }
    for (const name of names.sort()) {
      const m = BOL_FILE.exec(name);
      if (m) out.push({ dir, name, category: m[1], search: (m[2] || '').toLowerCase() });
    }
  }
  return out;
}

// The bol.com entries of a newer site's sources.json, without "paused" (only for this plan).
export function bolSourcesOf(site, root = ROOT) {
  const file = join(root, 'sites', site, 'sources.json');
  const list = JSON.parse(readFileSync(file, 'utf8')).sources.filter(s => s.network === 'bol');
  return list.map(s => { const c = { ...s }; delete c.paused; return c; });
}

export async function planBol({ archive, outDir, now = new Date(), root = ROOT }) {
  mkdirSync(outDir, { recursive: true });
  const files = bolFiles(archive);
  const sites = {};
  // The older sites: one plan for the six (the rules route each row).
  const legacyDir = files.find(f => !f.search || BOL_SEARCHES.some(q => q.term === f.search))?.dir || archiveList(archive)[0] || '.';
  const legacy = await planLegacyImport({ archive: legacyDir, retailer: 'bol-nl', outDir: join(outDir, 'older-sites'), now, allowOld: true });
  const oldFiles = [...legacy.oldFiles];
  for (const s of LEGACY_SITES) {
    const list = legacy.accepted[s] || [];
    const byCat = {};
    for (const p of list) ((byCat[p.site_category] ||= {})[p.subcategory] ||= []).push(p.product_name);
    sites[s] = { products: list.length, byCat, check: list.filter(p => p.doubt).length, report: join(outDir, 'older-sites', 'report.txt') };
  }
  // The products of AGW, VGW, SGW and ZGW in the files the older sites' plan reads too are counted by those sites' plans.
  const legacyLeft = Object.fromEntries(Object.entries(legacy.rejected).filter(([why]) => !/planned by that site's own import/.test(why)).map(([why, l]) => [why, l.length]));
  // The newer sites: their own planner, with their bol.com entries.
  const newLeft = {};
  for (const s of NEW_SITES) {
    const sources = bolSourcesOf(s, root);
    const dir = join(outDir, s);
    mkdirSync(dir, { recursive: true });
    const sourcesFile = join(dir, 'sources-bol.json');
    writeFileSync(sourcesFile, JSON.stringify({ _comment: `bol.com plan ${now.toISOString()} (tools/bol-import-plan.mjs): the bol.com entries of sites/${s}/sources.json, read although paused there`, sources }, null, 2));
    const rules = await import(pathToFileURL(join(root, 'sites', s, 'category-rules.js')).href);
    const r = await planImport({ archive, sourcesFile, outDir: dir, now, rules, label: s.toUpperCase(), allowOldBol: true });
    oldFiles.push(...r.stats.oldBolFiles);
    const byCat = {};
    for (const p of r.products) ((byCat[p.category_slug] ||= {})[p.subcategory || '-'] ||= []).push(p.product_name);
    sites[s] = { products: r.products.length, byCat, check: 0, report: join(dir, 'report.txt') };
    for (const [why, n] of Object.entries(r.stats.rejected)) newLeft[why] = (newLeft[why] || 0) + n;
  }
  // The older sites' plan reads every bol.com file (gendered clothing of any category, lib/bol-nl.mjs bolPlace): a file
  // that is also a newer site's is named once.
  const seenOld = new Set();
  const oldOnce = oldFiles.filter(([f]) => { const k = basename(String(f)); if (seenOld.has(k)) return false; seenOld.add(k); return true; });
  const text = renderSummary({ files, sites, legacyRows: legacy.rows, legacyLeft, newLeft, now, oldFiles: oldOnce });
  writeFileSync(join(outDir, 'summary.txt'), text);
  return { files, sites, text, oldFiles: oldOnce };
}

function renderSummary({ files, sites, legacyRows, legacyLeft, newLeft, now, oldFiles = [] }) {
  const L = [`bol.com NL - ΔΟΚΙΜΗ ΕΙΣΑΓΩΓΗΣ (dry run, μόνο ανάγνωση, ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC)`,
    'Τίποτα δεν φορτώθηκε: ούτε βάση, ούτε site, ούτε Cloudflare. Τα αρχεία SQL του σχεδίου ΔΕΝ εκτελούνται.', ''];
  const known = new Set([...BOL_SOURCES.map(s => s.id)]);
  L.push(`Αρχεία bol.com: ${files.length}`);
  for (const f of files) {
    const src = f.search ? BOL_SEARCHES.find(q => q.term === f.search) : BOL_SOURCES.find(s => s.id === f.category);
    const where = src ? (f.search ? `αναζήτηση «${f.search}» -> ${String(src.site).toUpperCase()}${src.men ? ` (ανδρικά -> ${src.men.toUpperCase()})` : ''}` : `${src.name} -> ${src.site.toUpperCase()}`) : 'ΠΡΟΒΛΗΜΑ: άγνωστη κατηγορία, δεν διαβάζεται';
    L.push(`  ${f.name}: ${where}`);
  }
  const missing = BOL_SOURCES.filter(s => !files.some(f => !f.search && f.category === s.id)).map(s => `${s.id} ${s.name}`);
  for (const q of BOL_SEARCHES) if (!files.some(f => f.search === q.term)) missing.push(`αναζήτηση «${q.term}»`);
  if (missing.length) L.push(`  ΛΕΙΠΟΥΝ (δεν βρέθηκαν στον φάκελο): ${missing.join(', ')}`);
  if (files.some(f => !f.search && !known.has(f.category))) L.push('  Σημείωση: αρχεία άλλης κατηγορίας δεν διαβάζονται.');
  if (oldFiles.length) {
    L.push(`  ΠΡΟΒΛΗΜΑ: ${oldFiles.length} αρχεία είναι παλιότερα από ${BOL_MAX_AGE_HOURS} ώρες. Η εισαγωγή θα τα αρνιόταν: τρέξε πρώτα ξανά τη λήψη (tools/bol-feed-download.ps1 -Step download).`);
    for (const [f, s] of oldFiles) L.push(`    ${f}: λήψη ${s || '?'} UTC`);
  } else if (files.length) L.push(`  Όλα τα αρχεία είναι νεότερα από ${BOL_MAX_AGE_HOURS} ώρες: ΕΝΤΑΞΕΙ.`);
  L.push('');
  let total = 0;
  for (const [s, info] of Object.entries(sites)) {
    total += info.products;
    L.push(`== ${s.toUpperCase()}: ${fmt(info.products)} προϊόντα${info.check ? ` (ΕΛΕΓΧΟΣ: ${fmt(info.check)} μπήκαν μόνο από το όνομα)` : ''}`);
    for (const [cat, subs] of Object.entries(info.byCat).sort((a, b) => count(b[1]) - count(a[1]))) {
      L.push(`   ${cat}: ${fmt(count(subs))} | ` + Object.entries(subs).sort((a, b) => b[1].length - a[1].length).map(([sub, l]) => `${sub} ${fmt(l.length)}`).join(', '));
      const sample = Object.values(subs).flat().slice(0, 3);
      for (const n of sample) L.push(`      - ${String(n).slice(0, 90)}`);
    }
    L.push(`   (πλήρες σχέδιο: ${info.report})`);
  }
  L.push('', `ΣΥΝΟΛΟ: ${fmt(total)} προϊόντα σε ${Object.values(sites).filter(x => x.products).length} sites. Γραμμές των αρχείων των παλιών sites: ${fmt(legacyRows)}.`);
  L.push('', 'Έξω, ανά λόγο (παλιά sites):');
  for (const [why, n] of Object.entries(legacyLeft).sort((a, b) => b[1] - a[1]).slice(0, 25)) L.push(`  ${fmt(n)}  ${why}`);
  L.push('Έξω, ανά λόγο (AGW, VGW, SGW, ZGW):');
  for (const [why, n] of Object.entries(newLeft).sort((a, b) => b[1] - a[1]).slice(0, 25)) L.push(`  ${fmt(n)}  ${why}`);
  L.push('', 'Κανόνες: μόνο NL και BE (στο HGW μόνο NL), στα ολλανδικά· χωρίς μάρκα και «πριν» τιμή· ίδιο όνομα σε άλλο μέγεθος = μία κάρτα·',
    'ποτέ τα απαγορευμένα (πυρομαχικά, CD keys, φάρμακα κατοικιδίων με συνταγή, στολές ενηλίκων ...). Ό,τι δεν μπαίνει με σιγουριά μένει έξω.',
    'Η εισαγωγή είναι ΣΕ ΑΝΑΜΟΝΗ: μόνο μετά το tools/bol-remove.ps1 και την καθημερινή ανανέωση, με ΕΓΚΡΙΝΩ ALL IMPORTS.');
  return L.join('\n') + '\n';
}
const count = subs => Object.values(subs).reduce((a, l) => a + l.length, 0);

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? String(args[i + 1] ?? '') : ''; };
  const archive = val('archive');
  const out = val('out');
  if (!archive || !out) { console.error('usage: node tools/bol-import-plan.mjs --archive <dir>[;<dir>] --out <new dir>'); process.exit(2); }
  if (existsSync(join(out, 'summary.txt'))) { console.error(`Output folder already has a plan: ${out}. Use a new folder.`); process.exit(2); }
  const r = await planBol({ archive: archiveList(archive).map(a => resolve(a)), outDir: resolve(out) });
  if (!r.files.length) { console.error('No bol.com feed file (BOL_<category>_NL.csv.gz) in the archive folder(s).'); process.exit(4); }
  console.log(`summary: ${join(resolve(out), 'summary.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(e => { console.error(e && e.message ? e.message : e); process.exit(1); });
