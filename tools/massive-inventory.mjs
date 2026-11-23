// Gear World - MASSIVE INVENTORY (owner via chat 7, 22 Nov 2026: "massive import for every approved retailer that is not
// on the sites yet, worldwide, UK and Greece first"). READ-ONLY.
// Lessons L207: before rules are written for a list of shops, each shop's feed is looked at (currency, language, count,
// sample names), not only its name. One paste downloads the feeds of hundreds of shops; their reports and profiles are
// far too long to send to the chat. This tool reads the candidates list (tools/massive/candidates-<day>.json), the feed
// folder and the download reports of the last hours, and writes ONE short line per feed: products, stock, currency,
// language, the shop's address, its top categories, two sample names and the age of the file. Shops of the list without
// a number in the sheet are looked up by name in the Awin and CJ lists of those reports. It changes nothing: no file in
// the feed folder, no site, no database.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { profileFile } from './feed-profile.mjs';

// Names compared without accents, case, punctuation and the usual company and country words.
const NOISE = new Set(['inc', 'ltd', 'limited', 'llc', 'co', 'corp', 'store', 'shop', 'official', 'uk', 'us', 'usa', 'eu', 'int',
  'de', 'fr', 'es', 'it', 'nl', 'be', 'ie', 'gr', 'cy', 'pl', 'global', 'international', 'the', 'com', 'online', 'gmbh', 'bv']);
export function normName(s) {
  const t = String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/\+/g, ' and ');
  return t.split(/[^a-z0-9]+/).filter(w => w && !NOISE.has(w)).join('');
}
// "Kentfaith (K&F Concept)" -> the whole name, the name without the brackets, and what is in them; "A · B" -> A and B.
export function nameVariants(s) {
  const raw = String(s || '');
  const parts = [raw, raw.replace(/\(.*?\)/g, ' '), ...[...raw.matchAll(/\(([^)]*)\)/g)].map(m => m[1]), ...raw.split(/\s[·|/]\s|\s\+\s/)];
  return [...new Set(parts.map(normName).filter(v => v.length >= 3))];
}
export function nameMatches(candidate, other) {
  const o = normName(other);
  if (o.length < 3) return false;
  return nameVariants(candidate).some(v => v === o || (v.length >= 5 && o.startsWith(v)) || (o.length >= 5 && v.startsWith(o)));
}

// The download reports (UTF-8 with BOM, one line per Say of the tool).
const lines = text => String(text || '').replace(/^﻿/, '').split(/\r?\n/);
export function parseAwinReport(text) {
  const listing = new Map();
  const regions = new Map();
  const notInList = new Set();
  for (const l of lines(text)) {
    let m = l.match(/^(\d{2,9}) (.*), feed (\d+): μέλος: (.*?) \| προϊόντα στο Awin: (.*?) \| ανανέωση Awin: (.*?) \| αντίγραφο εδώ: (.*)$/);
    if (m) {
      const e = listing.get(m[1]) || { id: m[1], name: m[2], feeds: [] };
      if (!e.feeds.some(f => f.feedId === m[3])) e.feeds.push({ feedId: m[3], member: m[4].trim(), products: m[5].trim(), updated: m[6].trim(), local: m[7].trim() });
      listing.set(m[1], e);
      continue;
    }
    m = l.match(/^\s*- (\d{2,9}) (.*) \(feed (\d+), (.*?), προϊόντα (.*)\)$/);
    if (m) { regions.set(m[1], m[4].trim()); continue; }
    m = l.match(/^(\d{2,9}): δεν υπάρχει στη λίστα σου/);
    if (m) notInList.add(m[1]);
  }
  return { listing, regions, notInList };
}
export function parseCjReport(text) {
  const joined = [];
  const counts = new Map();
  let inJoined = false;
  for (const l of lines(text)) {
    if (/^Καταστήματα του CJ που σε έχουν δεχτεί:/.test(l)) { inJoined = true; continue; }
    let m = inJoined && l.match(/^ {2}(\d{4,9}) (.+?) \| (.*?) \| (.*)$/);
    if (m) { joined.push({ id: m[1], name: m[2], status: m[3], category: m[4] }); continue; }
    if (inJoined && !/^ {2}\d/.test(l)) inJoined = false;
    m = l.match(/^(\d{4,9}): προϊόντα στο CJ: (\d+)/);
    if (m) counts.set(m[1], Number(m[2]));
  }
  return { joined, counts };
}
export function parseDaisyconReport(text) {
  const progs = new Map();
  let cur = null;
  for (const l of lines(text)) {
    let m = l.match(/^(\d{3,6}) (.*?): feeds (\d+) \| διάλεξα γλώσσα (.*?), νόμισμα (.*?), προϊόντα (\d+)/);
    if (m) { cur = { id: m[1], name: m[2], feeds: Number(m[3]), language: m[4], currency: m[5], products: Number(m[6]), ships: '', noFeed: '' }; progs.set(m[1], cur); continue; }
    m = cur && l.match(/^ {2}Κατάστημα: .*? \| στέλνει σε \(κατά το Daisycon\): (.*)$/);
    if (m) { cur.ships = m[1].trim(); continue; }
    m = l.match(/^(\d{3,6})(?:_[A-Z]{2}| \[[A-Z]{2}\])?: (δεν βγήκε feed|δεν κατέβηκε): (.*)$/);
    if (m) { const e = progs.get(m[1]) || { id: m[1], name: '', ships: '' }; e.noFeed = m[3].slice(0, 90); progs.set(m[1], e); }
  }
  return progs;
}
// Rakuten (lessons L219): the advertiser number (MID) and name of each catalogue, from the sample or download lines.
export function parseRakutenReport(text) {
  const mids = new Map();
  for (const l of lines(text)) {
    const m = l.match(/^MID (\d{2,10}) (.+?): (?:μορφή (?:txt|xml)|OK, (\d+) προϊόντα)/);
    if (m) mids.set(m[1], { id: m[1], name: m[2], products: m[3] ? Number(m[3]) : (mids.get(m[1]) || {}).products });
  }
  return mids;
}
// The Adtraction check (tools/adtraction-feed-download.ps1, L221): "  <programme>  <name>  [GB, GBP]  feed: <n> προϊόντα".
export function parseAdtractionReport(text) {
  const out = new Map();
  for (const l of lines(text)) {
    const m = l.match(/^\s+(\d{2,12})\s{2}(.+?)\s{2}\[([A-Z]{2,3}), ?([A-Z]{0,3})\]\s{2}feed: (\d+)/);
    if (m) out.set(m[1], { id: m[1], name: m[2], market: m[3], currency: m[4], products: Number(m[5]) });
  }
  return out;
}
// Lines a person has to see: a problem (🔴) or a warning (🟡) of any download.
export function problemLines(text, max = 25) {
  const out = lines(text).filter(l => /🔴|🟡|ΠΡΟΒΛΗΜΑ|ΠΡΟΣΟΧΗ/.test(l)).map(l => l.trim().slice(0, 200));
  return { count: out.length, shown: out.slice(0, max) };
}

// The feed files of one shop in the feed folder (file names of tools/network-links.mjs and the download tools).
const PREFIX = { awin: 'AWIN', daisycon: 'DAISYCON', cj: 'CJ', linkwise: 'LINKWISE', rakuten: 'RAKUTEN', admitad: 'ADMITAD', adtraction: 'ADTRACTION' };
export function filesOf(names, net, id) {
  const p = PREFIX[net];
  if (!p || !/^\d{2,12}$/.test(String(id))) return [];
  const re = net === 'awin' ? new RegExp(`^AWIN_${id}_\\d+\\.csv(\\.gz)?$`, 'i') : new RegExp(`^${p}_${id}(_[A-Za-z0-9-]{1,40})?\\.csv(\\.gz)?$`, 'i');
  return names.filter(n => re.test(n)).sort();
}

const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
const cut = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
export function feedLine(c, file, p, { maxRows, extra = '' } = {}) {
  const tail = (file.match(/_([A-Za-z0-9-]{1,40})\.csv/i) || [])[1];
  const head = `#${c.row} ${c.wave.toUpperCase()} ${c.net} ${c.id} ${cut(c.name, 40)} [${c.site || '-'}|${cut(c.country || '-', 14)}]${c.net !== 'awin' && tail && !/^\d+$/.test(tail) ? ` ${tail}` : ''}`;
  if (p.error) return `${head} | ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ: ${cut(p.error, 80)}`;
  const share = (o) => { const t = top(o, 1)[0]; return t ? `${t[0] || '?'} ${Math.round(100 * t[1] / Math.max(1, p.rows))}%` : '?'; };
  const cats = top(p.categories, 3).map(([k, v]) => `${cut(k, 26)} (${v})`).join('; ');
  const s = p.samples.length ? [p.samples[0], p.samples[Math.min(5, p.samples.length - 1)]] : [];
  const samples = [...new Set(s.map(x => `«${cut(x.name, 42)}» ${x.price ? x.price.toFixed(2) : '?'}`))].join('; ');
  const rows = `${p.rows}${p.rows >= maxRows ? '+' : ''}`;
  return `${head} | ${rows} (${p.inStock} σε απόθ.) | ${share(p.currencies)} | ${share(p.languages)} | ${cut(top(p.hosts, 1).map(x => x[0])[0] || '?', 30)} | ${cats} | ${samples} | ${p.ageHours}h${extra}`;
}

export async function inventory({ candidates, archive, reports = [], maxRows = 100000, now = new Date(), progress = () => {} }) {
  const names = existsSync(archive) ? readdirSync(archive) : [];
  const aw = { listing: new Map(), regions: new Map(), notInList: new Set() };
  const cj = { joined: [], counts: new Map() };
  const dc = new Map();
  const rk = new Map();
  const at = new Map();
  const probs = [];
  for (const r of reports) {
    const kind = r.name.replace(/_\d{8}_\d{6}.*$/, '');
    if (kind === 'AWIN_FEED_DOWNLOAD') {
      const a = parseAwinReport(r.text);
      for (const [k, v] of a.listing) aw.listing.set(k, v);
      for (const [k, v] of a.regions) aw.regions.set(k, v);
      for (const k of a.notInList) aw.notInList.add(k);
    } else if (kind === 'CJ_FEED_DOWNLOAD') {
      const c = parseCjReport(r.text);
      for (const j of c.joined) if (!cj.joined.some(x => x.id === j.id)) cj.joined.push(j);
      for (const [k, v] of c.counts) cj.counts.set(k, v);
    } else if (kind === 'RAKUTEN_FEED_DOWNLOAD') {
      for (const [k, v] of parseRakutenReport(r.text)) rk.set(k, { ...(rk.get(k) || {}), ...v });
    } else if (kind === 'ADTRACTION_FEED_CHECK' || kind === 'ADTRACTION_FEED_DOWNLOAD') {
      for (const [k, v] of parseAdtractionReport(r.text)) at.set(k, v);
    } else if (kind === 'DAISYCON_FEED_DOWNLOAD') {
      for (const [k, v] of parseDaisyconReport(r.text)) dc.set(k, { ...(dc.get(k) || {}), ...v });
    }
    if (/_FEED_DOWNLOAD$/.test(kind)) probs.push({ name: r.name, ...problemLines(r.text) });
  }

  // Shops with no number in the sheet: by name in the Awin and CJ lists.
  const found = [];
  const work = [];
  for (const c of candidates) {
    let ids = (c.ids || []).map(String);
    if (!ids.length && c.net === 'awin') {
      const hits = [...aw.listing.values()].filter(e => nameMatches(c.name, e.name)).slice(0, 3);
      found.push({ c, hits: hits.map(e => `${e.id} ${e.name} (${e.feeds.map(f => `feed ${f.feedId}, ${f.products} προϊόντα${aw.regions.get(e.id) ? `, ${aw.regions.get(e.id)}` : ''}`).join('; ')})`) });
      ids = hits.map(e => e.id);
    } else if (!ids.length && c.net === 'cj') {
      const hits = cj.joined.filter(j => nameMatches(c.name, j.name)).slice(0, 3);
      found.push({ c, hits: hits.map(j => `${j.id} ${j.name} | ${j.status}${cj.counts.has(j.id) ? ` | ${cj.counts.get(j.id)} προϊόντα` : ''}`) });
      ids = hits.map(j => j.id);
    } else if (!ids.length && c.net === 'adtraction') {
      const hits = [...at.values()].filter(e => nameMatches(c.name, e.name)).slice(0, 3);
      found.push({ c, hits: hits.map(e => `${e.id} ${e.name} | ${e.market}, ${e.currency} | ${e.products} προϊόντα`) });
      ids = hits.map(e => e.id);
    } else if (!ids.length && c.net === 'rakuten') {
      const hits = [...rk.values()].filter(e => nameMatches(c.name, e.name)).slice(0, 3);
      found.push({ c, hits: hits.map(e => `MID ${e.id} ${e.name}${e.products ? ` | ${e.products} προϊόντα` : ''}`) });
      ids = hits.map(e => e.id);
    }
    for (const id of ids) work.push({ ...c, id });
    if (!ids.length) work.push({ ...c, id: '' });
  }

  const out = { uk: [], gr: [], world: [] };
  const none = [];
  let nFeeds = 0;
  for (const c of work) {
    const files = filesOf(names, c.net, c.id);
    if (!files.length) {
      let why = '';
      if (c.net === 'rakuten' && !c.id) why = 'Rakuten: δεν βρέθηκε κατάλογος με αυτό το όνομα στον server';
      else if (c.net === 'admitad') why = 'Admitad: δεν υπάρχει ακόμα εργαλείο λήψης';
      else if (c.net === 'adtraction' && !c.id) why = 'Adtraction: δεν είναι στα εγκεκριμένα του ελέγχου (adtraction-feed-download -Step check)';
      else if (c.net === 'adtraction') why = 'Adtraction: δεν κατέβηκε ακόμα (adtraction-feed-download -Step download)';
      else if (!c.id) why = 'δεν βρέθηκε αριθμός (ούτε στο φύλλο ούτε στη λίστα του δικτύου)';
      else if (c.net === 'awin' && aw.notInList.has(c.id)) why = 'Awin: δεν είναι στη λίστα σου (όχι μέλος ή χωρίς feed)';
      else if (c.net === 'awin' && aw.listing.has(c.id)) why = `Awin: ${aw.listing.get(c.id).feeds.map(f => `${f.member}, ${f.products} προϊόντα`).join('; ')}, δεν κατέβηκε`;
      else if (c.net === 'daisycon' && dc.get(c.id) && dc.get(c.id).noFeed) why = `Daisycon: ${dc.get(c.id).noFeed}`;
      else why = 'δεν υπάρχει αρχείο feed στον υπολογιστή';
      none.push(`#${c.row} ${c.wave.toUpperCase()} ${c.net} ${c.id || '-'} ${cut(c.name, 44)} [${c.site || '-'}] : ${why}`);
      continue;
    }
    for (const f of files) {
      progress(f);
      const p = await profileFile(join(archive, f), { maxRows });
      nFeeds++;
      let extra = '';
      const d = c.net === 'daisycon' && dc.get(c.id);
      if (d && d.ships) extra += ` | στέλνει: ${cut(d.ships, 40)}`;
      if (c.net === 'awin' && aw.regions.get(c.id)) extra += ` | περιοχή Awin: ${aw.regions.get(c.id)}`;
      (out[c.wave] || out.world).push(feedLine(c, f, p, { maxRows, extra }));
    }
  }

  const waves = candidates.reduce((o, c) => { o[c.wave] = (o[c.wave] || 0) + 1; return o; }, {});
  const L = [
    'Gear World - MASSIVE INVENTORY (μόνο ανάγνωση)',
    `Ώρα: ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    `Υποψήφια: ${candidates.length} (UK ${waves.uk || 0}, Ελλάδα/Κύπρος ${waves.gr || 0}, κόσμος ${waves.world || 0}) | feeds που διαβάστηκαν: ${nFeeds} | χωρίς feed: ${none.length}`,
    'Γραμμή: #γραμμή φύλλου ΚΥΜΑ δίκτυο αριθμός όνομα [site|χώρα] | προϊόντα (σε απόθεμα) | νόμισμα | γλώσσα | site καταστήματος | κατηγορίες | δείγματα | ηλικία αρχείου',
    ''
  ];
  L.push('== Λήψεις (αναφορές των τελευταίων ωρών)');
  if (!probs.length) L.push('Δεν βρέθηκε αναφορά λήψης.');
  for (const p of probs) { L.push(`${p.name}: ${p.count} γραμμές με 🔴/🟡`); for (const s of p.shown) L.push(`  ${s}`); }
  L.push('');
  L.push('== Χωρίς αριθμό στο φύλλο: ταιριάσματα με τις λίστες του Awin, του CJ και του Rakuten');
  for (const f of found) L.push(`#${f.c.row} ${f.c.net} ${cut(f.c.name, 44)} -> ${f.hits.length ? f.hits.join(' || ') : '(κανένα)'}`);
  for (const w of ['uk', 'gr', 'world']) {
    L.push('');
    L.push(`== Κύμα ${w === 'uk' ? '1 · UK' : w === 'gr' ? '2 · Ελλάδα/Κύπρος' : '3 · κόσμος'}: ${out[w].length} feeds`);
    for (const l of out[w]) L.push(l);
  }
  L.push('');
  L.push(`== Χωρίς feed (${none.length})`);
  for (const l of none) L.push(l);
  L.push('');
  L.push('Μόνο ανάγνωση: δεν άλλαξε τίποτα (ούτε αρχεία, ούτε sites, ούτε βάσεις).');
  return L.join('\n') + '\n';
}

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = resolve(val('archive') || '');
  const list = resolve(val('list') || '');
  const reportsDir = val('reports') ? resolve(val('reports')) : '';
  const out = resolve(val('out') || 'massive-inventory');
  if (!val('archive') || !existsSync(archive)) { console.error(`Archive folder not found: ${archive}`); process.exit(2); }
  if (!val('list') || !existsSync(list)) { console.error(`Candidates list not found: ${list}`); process.exit(2); }
  const hours = Number(val('hours')) || 12;
  // 22 Nov 2026: 100,000 rows of each of ~600 feeds took three hours on the PC; the first 20,000 show the same categories.
  const maxRows = Number(val('max-rows')) || 20000;
  const candidates = JSON.parse(readFileSync(list, 'utf8').replace(/^﻿/, '')).candidates || [];
  const reports = [];
  if (reportsDir && existsSync(reportsDir)) {
    const since = Date.now() - hours * 3600000;
    for (const n of readdirSync(reportsDir).filter(n => /^((AWIN|CJ|DAISYCON|LINKWISE|RAKUTEN|ADTRACTION)_FEED_DOWNLOAD|ADTRACTION_FEED_(CHECK|DOWNLOAD))_.*\.txt$/.test(n)).sort()) {
      const p = join(reportsDir, n);
      if (statSync(p).mtimeMs >= since) reports.push({ name: n, text: readFileSync(p, 'utf8') });
    }
  }
  mkdirSync(out, { recursive: true });
  const text = await inventory({ candidates, archive, reports, maxRows, progress: f => process.stdout.write(`\r${f}`.padEnd(70)) });
  process.stdout.write('\n');
  writeFileSync(join(out, 'report.txt'), text);
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
