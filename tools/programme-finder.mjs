#!/usr/bin/env node
// Programme finder (8 Nov 2026). READ-ONLY helper of tools/programme-finder.ps1.
// Which affiliate programmes are live right now and not joined yet, on Awin and on CJ, by topic.
// The three Awin profiles suggested from public pages (Musclefood 11002, Farmison 115479, Hampers.co.uk 29169) all said
// "The account you are trying to view is not active": the list must come from the APIs, not from public pages.
//
// The PowerShell tool makes every GET call (the tokens only in the Authorization header) and saves each answer in a
// work folder. This file reads those answers, keeps the programmes that fit each topic, picks which ones get the detail
// call (commission, approval, validation days) and writes the report text in Greek.
// It never makes a network call, never sees a token and never writes to stderr (in Windows PowerShell 5.1 a stderr line
// of a program stops the tool).
//
//   node tools/programme-finder.mjs plan   --topics food,music [--keywords "a,b"]
//   node tools/programme-finder.mjs pick   --dir <work> --topics ... [--keywords ...] [--max-details 40] [--check-ids 11002,...]
//   node tools/programme-finder.mjs report --dir <work> --topics ... [--keywords ...] [--check-ids ...] --awin <state>
//        --cj <state> [--max-rows 25] [--cid-tail 123] [--details-failed 0] --out <file>
// Files in the work folder (written by the PowerShell tool):
//   awin-<joined|pending|suspended|rejected|notjoined>.json   GET /publishers/<id>/programmes?relationship=...
//   awin-details-<id>.json                                    GET /publishers/<id>/programmedetails?advertiserId=<id>
//   awin-check-<id>.json | awin-check-<id>.err (HTTP code)     the same with relationship=any, for the suggested ids
//   cj-<topic>-<joined|notjoined>-<page>.xml                   GET advertiser-lookup (keywords of the topic)
//   cj-ocado-<joined|notjoined>.xml                            GET advertiser-lookup (advertiser-name=Ocado)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Topics: the words come from the owner's request (8 Nov 2026). A trailing * matches any ending (photo* = photography).
export const TOPICS = {
  food: {
    label: 'Φαγητό: κρέας, ψάρι, τυρί, καλάθια δώρων, σούπερ μάρκετ, έτοιμα γεύματα',
    terms: ['meat', 'butcher', 'steak', 'turkey', 'hamper', 'grocery', 'supermarket', 'food', 'fish', 'cheese', 'deli', 'meal kit', 'recipe box', 'organic', 'veg box'],
    sector: /(^|[^a-z])(food|drink|grocer)/i, sectorName: 'Food & Drink'
  },
  music: {
    label: 'Μουσικά όργανα, DJ, στούντιο, ήχος',
    terms: ['musical instrument', 'guitar', 'piano', 'keyboard', 'DJ', 'studio', 'audio'],
    sector: /music|instrument/i, sectorName: 'Music'
  },
  outdoor: {
    label: 'Camping, πεζοπορία, σκηνές, outdoor',
    terms: ['camping', 'hiking', 'outdoor', 'walking', 'tent'],
    sector: /outdoor|camping/i, sectorName: 'Outdoor'
  },
  camera: {
    label: 'Κάμερες, φωτογραφία, φακοί, drones, βίντεο',
    terms: ['camera', 'photo*', 'lens', 'drone', 'video'],
    sector: /photo|camera/i, sectorName: 'Photography'
  },
  fishing: {
    label: 'Ψάρεμα: καλάμια, δολώματα, carp',
    terms: ['fishing', 'angling', 'tackle', 'carp'],
    sector: /fishing|angling/i, sectorName: 'Fishing'
  }
};
export const CUSTOM = 'keywords';

// Names of the programmes we suggested from public pages (public advertiser ids), only for the report text.
export const SUGGESTED = { 11002: 'Musclefood', 115479: 'Farmison', 29169: 'Hampers.co.uk' };

// The marks, always with their words (the owner cannot tell the colours apart).
export const MARK = {
  notjoined: '🟢 ΕΝΕΡΓΟ – μπορείς να κάνεις αίτηση',
  joined: 'ℹ️ ΗΔΗ ΜΕΛΟΣ',
  pending: '🟡 ΣΕ ΑΝΑΜΟΝΗ',
  suspended: '⏸️ ΣΕ ΑΝΑΣΤΟΛΗ',
  rejected: '⛔ ΑΠΟΡΡΙΦΘΗΚΕ'
};
export const RELATIONS = ['joined', 'pending', 'suspended', 'rejected', 'notjoined'];
// Words of CJ keywords that would match far too much on their own ("meal kit" -> "meal").
const CJ_STOP = new Set(['box', 'kit', 'the', 'and', 'of']);
const NOT_FOUND = new Set([400, 404, 410, 422]);

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const termName = spec => String(spec).replace(/\*$/, '').trim();

// A whole-word, case-insensitive match of a term, with the usual English endings (s, es; y -> ies).
export function termRegex(spec) {
  const raw = String(spec).trim().toLowerCase();
  const prefix = raw.endsWith('*');
  const base = (prefix ? raw.slice(0, -1) : raw).trim();
  let core = base.split(/\s+/).map(escapeRe).join('[\\s\\-]+');
  let tail = '(?:s|es)?';
  if (prefix) tail = '[\\p{L}\\p{N}]*';
  else if (/[^aeiou]y$/.test(base)) { core = core.slice(0, -1); tail = '(?:y|ies)'; }
  return new RegExp(`(?<![\\p{L}\\p{N}])${core}${tail}(?![\\p{L}\\p{N}])`, 'iu');
}

export function matchTerms(text, terms) {
  const t = String(text || '');
  if (!t) return [];
  return terms.filter(spec => termRegex(spec).test(t)).map(termName);
}

// The topics asked for: known names and/or the owner's own words (-Keywords).
export function resolveTopics(topicsArg, keywordsArg) {
  const out = [];
  const names = String(topicsArg || '').split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  for (const n of names) {
    if (!TOPICS[n]) return { ok: false, error: `unknown-topic:${n}`, known: Object.keys(TOPICS) };
    if (!out.some(x => x.key === n)) out.push({ key: n, ...TOPICS[n] });
  }
  const words = String(keywordsArg || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const w of words) {
    if (w.length < 2 || w.length > 40 || !/^[\p{L}\p{N}][\p{L}\p{N} &'\-]*\*?$/u.test(w)) return { ok: false, error: `bad-keyword:${w}` };
  }
  if (words.length > 30) return { ok: false, error: 'too-many-keywords' };
  if (words.length) out.push({ key: CUSTOM, label: 'Οι δικές σου λέξεις', terms: words, sector: null, sectorName: '' });
  if (!out.length) return { ok: false, error: 'no-topic', known: Object.keys(TOPICS) };
  return { ok: true, topics: out };
}

// CJ keywords: OR of the single words of the topic (CJ supports + and -, and OR is the default).
export function cjKeywords(topic) {
  const words = [];
  for (const spec of topic.terms) {
    for (const w of termName(spec).toLowerCase().split(/\s+/)) {
      if (w.length >= 2 && !CJ_STOP.has(w) && !words.includes(w)) words.push(w);
    }
  }
  return words.join(' ');
}

// ---------------- Awin ----------------
const stripBom = s => String(s || '').replace(/^﻿/, '');
function readJson(file) {
  try { return JSON.parse(stripBom(readFileSync(file, 'utf8'))); } catch { return null; }
}
const hostOf = u => { try { return new URL(String(u)).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };

export function normAwin(p) {
  const region = p && p.primaryRegion ? p.primaryRegion : {};
  const domains = Array.isArray(p && p.validDomains) ? p.validDomains.map(d => String((d && d.domain) || d || '').toLowerCase()).filter(Boolean) : [];
  return {
    id: Number(p && p.id),
    name: String((p && p.name) || '').trim(),
    status: String((p && p.status) || '').trim(),
    linkStatus: String((p && p.linkStatus) || '').trim(),
    region: String(region.countryCode || '').toUpperCase(),
    regionName: String(region.name || ''),
    currency: String((p && p.currencyCode) || '').toUpperCase(),
    sector: String((p && p.primarySector) || '').trim(),
    description: String((p && p.description) || ''),
    displayUrl: String((p && p.displayUrl) || ''),
    domains
  };
}

// The answer of GET programmes: an array (or an object that holds one).
export function awinArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.programmes)) return data.programmes;
  return [];
}

export function isGb(p) {
  if (p.region === 'GB' || p.region === 'UK') return true;
  if (p.currency === 'GBP') return true;
  return [...p.domains, hostOf(p.displayUrl)].some(d => /\.uk$/.test(String(d).replace(/^https?:\/\//, '').split('/')[0]));
}
export function isActive(p) {
  return /^(active|live)$/i.test(p.status) && !/^offline$/i.test(p.linkStatus);
}

// How well a programme fits a topic: 3 = its name or web address, 2 = its sector, 1 = only its description.
export function awinMatch(p, topic) {
  const where = [];
  const nameHits = matchTerms([p.name, hostOf(p.displayUrl), ...p.domains].join(' '), topic.terms);
  const sectorHit = Boolean(p.sector) && ((topic.sector && topic.sector.test(p.sector)) || matchTerms(p.sector, topic.terms).length > 0);
  const descHits = matchTerms(p.description, topic.terms);
  let tier = 0;
  if (descHits.length) { tier = 1; where.push('περιγραφή'); }
  if (sectorHit) { tier = 2; where.unshift('τομέας'); }
  if (nameHits.length) { tier = 3; where.unshift('όνομα'); }
  const hits = [...new Set([...nameHits, ...descHits])];
  return { tier, hits, where };
}

export function readAwinLists(dir) {
  const lists = {};
  for (const rel of RELATIONS) {
    const f = join(dir, `awin-${rel}.json`);
    lists[rel] = existsSync(f) ? awinArray(readJson(f)).map(normAwin).filter(p => Number.isFinite(p.id) && p.id > 0) : null;
  }
  return lists;
}

// Every programme once, with the relationship it has (joined wins over pending, ... over not joined).
export function awinIndex(lists) {
  const idx = new Map();
  for (const rel of RELATIONS) for (const p of lists[rel] || []) if (!idx.has(p.id)) idx.set(p.id, { ...p, rel });
  return idx;
}

export function awinTopicRows(lists, topic) {
  const rows = [];
  let skipped = 0;
  for (const p of awinIndex(lists).values()) {
    if (!['notjoined', 'joined', 'pending'].includes(p.rel)) continue;
    const m = awinMatch(p, topic);
    if (!m.tier) continue;
    if (!isGb(p) || !isActive(p)) { skipped++; continue; }
    rows.push({ ...p, network: 'Awin', tier: m.tier, hits: m.hits, where: m.where });
  }
  return { rows, skipped };
}

const byRelevance = (a, b) => (b.tier - a.tier) || (b.hits.length - a.hits.length) || a.name.localeCompare(b.name, 'en');

// Which programmes get the detail call: the best matches of every topic in turn (round robin), up to max.
export function pickDetails(lists, topics, max) {
  const queues = topics.map(t => awinTopicRows(lists, t).rows.filter(r => r.rel !== 'joined').sort(byRelevance));
  const picked = [];
  const seen = new Set();
  let more = true;
  for (let i = 0; more && picked.length < max; i++) {
    more = false;
    for (const q of queues) {
      if (i < q.length) {
        more = true;
        const r = q[i];
        if (!seen.has(r.id) && picked.length < max) { seen.add(r.id); picked.push({ id: r.id, rel: r.rel }); }
      }
    }
  }
  const total = new Set(queues.flat().map(r => r.id)).size;
  return { details: picked, total };
}

export function missingCheckIds(lists, ids) {
  const idx = awinIndex(lists);
  return ids.filter(id => !idx.has(id));
}

const num = x => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x))) ? null : Number(x);
const trimNum = n => (Math.round(n * 100) / 100).toString();
const SYMBOL = { GBP: '£', EUR: '€', USD: '$' };

export function formatCommission(ranges, currency) {
  const list = Array.isArray(ranges) ? ranges : (ranges ? [ranges] : []);
  const parts = [];
  for (const r of list) {
    const min = num(r && r.min);
    const max = num(r && r.max);
    if (min === null && max === null) continue;
    const lo = min === null ? max : min;
    const hi = max === null ? min : max;
    if (/percent/i.test(String(r.type || ''))) parts.push(lo === hi ? `${trimNum(hi)}%` : `${trimNum(lo)}%–${trimNum(hi)}%`);
    else {
      const sym = SYMBOL[currency] || (currency ? currency + ' ' : '');
      parts.push(lo === hi ? `${sym}${hi.toFixed(2)}` : `${sym}${lo.toFixed(2)}–${sym}${hi.toFixed(2)}`);
    }
  }
  return [...new Set(parts)].join(' / ');
}

// For sorting: the highest percentage and the highest fixed amount.
export function commissionKey(ranges) {
  let pct = -1;
  let amt = -1;
  for (const r of Array.isArray(ranges) ? ranges : (ranges ? [ranges] : [])) {
    const hi = num(r && r.max) ?? num(r && r.min);
    if (hi === null) continue;
    if (/percent/i.test(String(r.type || ''))) pct = Math.max(pct, hi); else amt = Math.max(amt, hi);
  }
  return { pct, amt };
}

// Cookie days are not in the Awin API: only when the programme's own description says them ("30 day cookie").
export function cookieDays(text) {
  const t = String(text || '');
  const a = /(\d{1,3})[\s-]*days?[\s-]*cookie/i.exec(t);
  if (a) return a[1];
  const b = /cookie[^.\n]{0,40}?(\d{1,3})[\s-]*days?/i.exec(t);
  return b ? b[1] : '';
}

export function parseDetails(data) {
  const d = Array.isArray(data) ? data[0] : data;
  if (!d || typeof d !== 'object') return null;
  const info = d.programmeInfo || {};
  const kpi = d.kpi || {};
  return {
    info: normAwin(info),
    membership: String(info.membershipStatus || ''),
    commissionRange: d.commissionRange || [],
    approval: num(kpi.approvalPercentage),
    validationDays: num(kpi.validationDays),
    epc: num(kpi.epc),
    conversionRate: num(kpi.conversionRate),
    awinIndex: num(kpi.awinIndex),
    paymentTime: String(kpi.averagePaymentTime || '')
  };
}

// ---------------- CJ (advertiser lookup, XML) ----------------
const decodeXml = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&').trim();
const tag = (xml, name) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(String(xml || ''));
  return m ? decodeXml(m[1]) : '';
};

export function parseCjXml(text) {
  const t = String(text || '');
  const error = tag(t, 'error-message');
  const head = /<advertisers\b([^>]*)>/i.exec(t);
  const total = head ? Number((/total-matched="(\d+)"/i.exec(head[1]) || [])[1] || 0) : 0;
  const advertisers = [];
  for (const m of t.matchAll(/<advertiser>([\s\S]*?)<\/advertiser>/gi)) {
    const b = m[1];
    const cat = /<primary-category>([\s\S]*?)<\/primary-category>/i.exec(b);
    const parent = cat ? tag(cat[1], 'parent') : '';
    const child = cat ? tag(cat[1], 'child') : '';
    const actions = [];
    for (const a of b.matchAll(/<action>([\s\S]*?)<\/action>/gi)) {
      const com = /<commission>([\s\S]*?)<\/commission>/i.exec(a[1]);
      let rates = [];
      if (com) {
        rates = [...com[1].matchAll(/<default(?:\s[^>]*)?>([\s\S]*?)<\/default>/gi)].map(x => decodeXml(x[1])).filter(Boolean);
        if (!rates.length && !/</.test(com[1])) rates = [decodeXml(com[1])].filter(Boolean);
      }
      const label = tag(a[1], 'name') || tag(a[1], 'type');
      if (rates.length) actions.push(`${label ? label + ': ' : ''}${rates.join(', ')}`);
    }
    advertisers.push({
      id: tag(b, 'advertiser-id'),
      name: tag(b, 'advertiser-name'),
      accountStatus: tag(b, 'account-status'),
      rel: tag(b, 'relationship-status').toLowerCase().replace(/[^a-z]/g, ''),
      rank: tag(b, 'network-rank'),
      url: tag(b, 'program-url'),
      language: tag(b, 'language'),
      category: [parent, child].filter(Boolean).join(' > '),
      commission: [...new Set(actions)].join(' / ').slice(0, 140)
    });
  }
  return { total, advertisers, error };
}

export function cjIsUk(a) {
  const h = hostOf(a.url);
  return /\.uk$/.test(h) || /(^|[^a-z])(uk|gb|united kingdom)([^a-z]|$)/i.test(a.name);
}
export function cjActive(a) {
  return !a.accountStatus || /^active$/i.test(a.accountStatus);
}
const cjRel = r => (/^notjoined$/.test(r) ? 'notjoined' : /pend/.test(r) ? 'pending' : /^joined$/.test(r) ? 'joined' : (r || 'notjoined'));

export function cjMatch(a, topic) {
  const nameHits = matchTerms(`${a.name} ${hostOf(a.url)}`, topic.terms);
  const catHit = Boolean(a.category) && ((topic.sector && topic.sector.test(a.category)) || matchTerms(a.category, topic.terms).length > 0);
  if (nameHits.length) return { tier: 3, hits: nameHits, where: ['όνομα'].concat(catHit ? ['κατηγορία'] : []) };
  if (catHit) return { tier: 2, hits: matchTerms(a.category, topic.terms), where: ['κατηγορία'] };
  return { tier: 1, hits: [], where: ['προϊόντα (CJ)'] };
}

export function readCjFiles(dir, prefix) {
  const out = new Map();
  let error = '';
  let total = 0;
  if (!existsSync(dir)) return { ads: [], error, total };
  const files = readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.xml')).sort();
  for (const f of files) {
    const p = parseCjXml(readFileSync(join(dir, f), 'utf8'));
    if (p.error && !error) error = p.error;
    total += p.total;
    for (const a of p.advertisers) {
      if (!a.id) continue;
      const rel = cjRel(a.rel);
      const prev = out.get(a.id);
      if (!prev || (prev.rel !== 'joined' && rel === 'joined')) out.set(a.id, { ...a, rel });
    }
  }
  return { ads: [...out.values()], error, total, files: files.length };
}

export function cjTopicRows(dir, topic) {
  const { ads, error, files } = readCjFiles(dir, `cj-${topic.key}-`);
  const rows = [];
  let skipped = 0;
  for (const a of ads) {
    if (!cjActive(a)) { skipped++; continue; }
    const m = cjMatch(a, topic);
    rows.push({ ...a, network: 'CJ', tier: m.tier, hits: m.hits, where: m.where, uk: cjIsUk(a) });
  }
  return { rows, skipped, error, files };
}

// ---------------- report ----------------
const cut = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const dash = s => (s === null || s === undefined || s === '' ? '—' : String(s));
export const awinLink = id => `https://ui.awin.com/merchant-profile/${id}`;

function awinTable(rows, detailsById, maxRows) {
  const sorted = rows.map(r => {
    const d = detailsById.get(r.id) || null;
    const ck = commissionKey(d ? d.commissionRange : null);
    return { ...r, d, ck };
  }).sort((a, b) => (b.tier - a.tier) || (b.hits.length - a.hits.length) || (b.ck.pct - a.ck.pct) || (b.ck.amt - a.ck.amt) || a.name.localeCompare(b.name, 'en'));
  const lines = ['Δίκτυο | Κατάστημα | ID | Κατάσταση | Σχέση | Προμήθεια | Έγκριση | Επικύρωση (μέρες) | Cookie (μέρες) | Τομέας | Ταιριάζει σε | Link'];
  let shown = 0;
  let hidden = 0;
  for (const r of sorted) {
    if (r.rel === 'notjoined') { if (shown >= maxRows) { hidden++; continue; } shown++; }
    const d = r.d;
    const commission = d ? formatCommission(d.commissionRange, r.currency || d.info.currency) : '';
    const approval = d && d.approval !== null ? `${Math.round(d.approval)}%` : '';
    const days = d && d.validationDays !== null ? String(d.validationDays) : '';
    const cookie = cookieDays(r.description) || (d ? cookieDays(d.info.description) : '');
    const match = `${r.where.join(', ')}${r.hits.length ? ': ' + r.hits.join(', ') : ''}`;
    lines.push(['Awin', cut(r.name, 45), r.id, r.status || '—', MARK[r.rel] || r.rel, dash(commission), dash(approval), dash(days), dash(cookie), dash(cut(r.sector, 30)), cut(match, 60), awinLink(r.id)].join(' | '));
  }
  return { lines, hidden, count: sorted.length };
}

function cjTable(rows, maxRows) {
  const sorted = [...rows].sort((a, b) => (b.tier - a.tier) || (Number(b.uk) - Number(a.uk)) || (b.hits.length - a.hits.length) ||
    ((Number(b.rank) || 0) - (Number(a.rank) || 0)) || a.name.localeCompare(b.name, 'en'));
  const lines = ['Δίκτυο | Κατάστημα | ID | Κατάσταση | Χώρα | Σχέση | Network rank | Προμήθεια | Cookie (μέρες) | Κατηγορία | Ταιριάζει σε | Link (site του καταστήματος)'];
  let shown = 0;
  let hidden = 0;
  for (const r of sorted) {
    if (r.rel === 'notjoined') { if (shown >= maxRows) { hidden++; continue; } shown++; }
    const match = `${r.where.join(', ')}${r.hits.length ? ': ' + r.hits.join(', ') : ''}`;
    lines.push(['CJ', cut(r.name, 45), r.id, r.accountStatus || 'Active', r.uk ? 'UK' : 'όχι σίγουρα UK', MARK[r.rel] || r.rel, dash(r.rank), dash(r.commission), '—', dash(cut(r.category, 40)), cut(match, 50), dash(r.url)].join(' | '));
  }
  return { lines, hidden, count: sorted.length };
}

const countRel = (rows, rel) => rows.filter(r => r.rel === rel).length;

function readDetails(dir) {
  const map = new Map();
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir)) {
    const m = /^awin-details-(\d+)\.json$/.exec(f);
    if (!m) continue;
    const d = parseDetails(readJson(join(dir, f)));
    if (d) map.set(Number(m[1]), d);
  }
  return map;
}

function awinStateText(state) {
  const s = String(state || '');
  if (s === 'ok') return '';
  if (s === 'missing') return 'δεν διαβάστηκε: λείπει το κλειδί API (δες πιο πάνω τι κάνεις)';
  if (s === 'unreadable') return 'δεν διαβάστηκε: το φυλαγμένο κλειδί δεν ανοίγει (δες πιο πάνω τι κάνεις)';
  if (s.startsWith('rejected')) return `δεν διαβάστηκε: το Awin δεν δέχτηκε το κλειδί (${s.split(':')[1] || '401'}, δες πιο πάνω τι κάνεις)`;
  return `δεν διαβάστηκε (απάντηση ${s.split(':')[1] || s})`;
}
function cjStateText(state) {
  const s = String(state || '');
  if (s === 'ok') return '';
  if (s === 'no-token') return 'δεν ελέγχθηκε: δεν υπάρχει φυλαγμένο κλειδί του CJ σε αυτόν τον υπολογιστή';
  if (s === 'unreadable') return 'δεν ελέγχθηκε: το φυλαγμένο κλειδί του CJ δεν ανοίγει';
  if (s === 'no-cid') return 'δεν ελέγχθηκε: λείπει ο αριθμός του λογαριασμού σου στο CJ (CID)';
  if (s.startsWith('rejected')) return `δεν ελέγχθηκε: το CJ δεν δέχτηκε το κλειδί (${s.split(':')[1] || '401'})`;
  if (s.startsWith('cid-failed')) return `δεν ελέγχθηκε: κανένας αριθμός λογαριασμού (CID) δεν δούλεψε (${s.split(':')[1] || ''})`;
  return `δεν ελέγχθηκε (απάντηση ${s.split(':')[1] || s})`;
}

export function buildReport({ dir, topics, checkIds = [], awinState = 'ok', cjState = 'ok', maxRows = 25, cidTail = '', detailsFailed = 0 }) {
  const L = [];
  const awinOk = awinState === 'ok';
  const cjOk = cjState === 'ok';
  const lists = awinOk ? readAwinLists(dir) : null;
  const details = awinOk ? readDetails(dir) : new Map();
  const summary = [];

  if (awinOk) {
    const c = rel => (lists[rel] ? lists[rel].length : 0);
    L.push(`Awin (λίστες του API): όχι μέλος στο GB ${c('notjoined')} · μέλος ${c('joined')} · σε αναμονή ${c('pending')} · σε αναστολή ${c('suspended')} · απορρίφθηκε ${c('rejected')}. Λεπτομέρειες (προμήθεια, έγκριση) για ${details.size} προγράμματα.`);
    if (detailsFailed > 0) L.push(`  🟡 ΠΡΟΣΟΧΗ: ${detailsFailed} κλήσεις λεπτομερειών δεν απάντησαν: εκεί η προμήθεια γράφει «—».`);
  } else {
    L.push(`Awin: ${awinStateText(awinState)}.`);
  }
  if (cjOk) L.push(`CJ (advertiser lookup): ΕΝΤΑΞΕΙ${cidTail ? `, λογαριασμός CID …${cidTail}` : ''}.`);
  else L.push(`CJ: ${cjStateText(cjState)}.`);
  L.push('Μέρες cookie: δεν τις δίνει κανένα από τα δύο API· γράφονται μόνο όταν τις λέει η περιγραφή του προγράμματος. Το CJ δεν δείχνει «σε αναμονή».');
  L.push('Σειρά: πρώτα όσα ταιριάζουν στο όνομα, μετά στον τομέα/κατηγορία, μετά μόνο στην περιγραφή ή στα προϊόντα· μέσα σε κάθε ομάδα η μεγαλύτερη προμήθεια πρώτα.');

  for (const t of topics) {
    L.push('');
    L.push(`=== Θέμα: ${t.key} (${t.label}) ===`);
    L.push(`Λέξεις: ${t.terms.map(termName).join(', ')}${t.sectorName ? ` | Τομέας: ${t.sectorName}` : ''}`);
    const s = { key: t.key, awin: null, cj: null };
    if (awinOk) {
      const { rows, skipped } = awinTopicRows(lists, t);
      const tb = awinTable(rows, details, maxRows);
      s.awin = { notjoined: countRel(rows, 'notjoined'), joined: countRel(rows, 'joined'), pending: countRel(rows, 'pending') };
      L.push(`-- Awin: ${rows.length} προγράμματα (${s.awin.notjoined} «${MARK.notjoined}», ${s.awin.joined} «${MARK.joined}», ${s.awin.pending} «${MARK.pending}») --`);
      if (rows.length) for (const line of tb.lines) L.push(line);
      else L.push('Κανένα ενεργό πρόγραμμα του Awin στο GB με αυτές τις λέξεις.');
      if (tb.hidden) L.push(`(και ${tb.hidden} ακόμα «όχι μέλος» με μικρότερη σχέση: δεν γράφονται εδώ· -MaxRows για περισσότερα)`);
      if (skipped) L.push(`(${skipped} ακόμα ταιριάζουν αλλά δεν είναι ενεργά τώρα ή δεν είναι για το GB: δεν γράφονται)`);
    } else {
      L.push(`-- Awin: ${awinStateText(awinState)} --`);
    }
    if (cjOk) {
      const { rows, skipped, error, files } = cjTopicRows(dir, t);
      const tb = cjTable(rows, maxRows);
      s.cj = { notjoined: countRel(rows, 'notjoined'), joined: countRel(rows, 'joined') };
      L.push(`-- CJ: ${rows.length} προγράμματα (${s.cj.notjoined} «${MARK.notjoined}», ${s.cj.joined} «${MARK.joined}») --`);
      if (error) L.push(`🟡 ΠΡΟΣΟΧΗ: το CJ απάντησε: ${cut(error, 200)}`);
      if (!files) L.push('🟡 ΠΡΟΣΟΧΗ: δεν ήρθε απάντηση του CJ για αυτό το θέμα.');
      if (rows.length) for (const line of tb.lines) L.push(line);
      else if (files) L.push('Κανένα πρόγραμμα του CJ με αυτές τις λέξεις.');
      if (tb.hidden) L.push(`(και ${tb.hidden} ακόμα «όχι μέλος» με μικρότερη σχέση: δεν γράφονται εδώ· -MaxRows για περισσότερα)`);
      if (skipped) L.push(`(${skipped} ακόμα δεν είναι ενεργά: δεν γράφονται)`);
      if (rows.some(r => r.rel === 'notjoined')) L.push('Αίτηση στο CJ: https://members.cj.com → Advertisers → αναζήτηση με το ID.');
    } else {
      L.push(`-- CJ: ${cjStateText(cjState)} --`);
    }
    summary.push(s);
  }

  // The programmes suggested earlier from public pages.
  L.push('');
  L.push('=== Τα προγράμματα του Awin που είχαμε προτείνει (από δημόσιες σελίδες) ===');
  const idx = awinOk ? awinIndex(lists) : new Map();
  for (const id of checkIds) {
    const label = SUGGESTED[id] ? `${id} (${SUGGESTED[id]})` : String(id);
    if (!awinOk) { L.push(`${label}: δεν ελέγχθηκε (το Awin δεν διαβάστηκε).`); continue; }
    const p = idx.get(id);
    if (p) {
      const live = isActive(p) ? '' : ' | ΔΕΝ είναι ενεργό τώρα';
      L.push(`${id} ${p.name}: ${MARK[p.rel] || p.rel} | κατάσταση: ${p.status || '—'}${p.linkStatus ? ` (links: ${p.linkStatus})` : ''}${live} | περιοχή: ${p.region || '—'} | ${awinLink(id)}`);
      continue;
    }
    const okFile = join(dir, `awin-check-${id}.json`);
    const errFile = join(dir, `awin-check-${id}.err`);
    const d = existsSync(okFile) ? parseDetails(readJson(okFile)) : null;
    if (d && d.info.id === id && d.info.name) {
      const rel = String(d.membership || '').toLowerCase().replace(/[^a-z]/g, '');
      L.push(`${id} ${d.info.name}: βρέθηκε μόνο με την κλήση λεπτομερειών | σχέση: ${MARK[rel] || d.membership || '—'} | κατάσταση: ${d.info.status || '—'} | περιοχή: ${d.info.region || '—'} | ${awinLink(id)}`);
      continue;
    }
    const code = existsSync(errFile) ? Number(String(readFileSync(errFile, 'utf8')).trim()) : 0;
    if (code && !NOT_FOUND.has(code)) { L.push(`${label}: δεν μπόρεσα να το ελέγξω τώρα (απάντηση ${code}). Ξανατρέξε αργότερα.`); continue; }
    L.push(`${label}: δεν υπάρχει πια στο Awin για εσένα`);
  }

  // Ocado, on both networks.
  L.push('');
  L.push('=== Ocado ===');
  if (awinOk) {
    const found = [...idx.values()].filter(p => /ocado/i.test(p.name));
    if (!found.length) L.push('Awin: το Ocado δεν βρέθηκε σε καμία λίστα του Awin για εσένα (όχι μέλος στο GB, μέλος, σε αναμονή, σε αναστολή, απορρίφθηκε).');
    for (const p of found) L.push(`Awin: ${p.name} (${p.id}): ${MARK[p.rel] || p.rel} | κατάσταση: ${p.status || '—'}${isActive(p) ? '' : ' | ΔΕΝ είναι ενεργό τώρα'} | περιοχή: ${p.region || '—'} | ${awinLink(p.id)}`);
  } else L.push(`Awin: ${awinStateText(awinState)}.`);
  if (cjOk) {
    const { ads, error } = readCjFiles(dir, 'cj-ocado-');
    const found = ads.filter(a => /ocado/i.test(a.name));
    if (error) L.push(`CJ: 🟡 ΠΡΟΣΟΧΗ: το CJ απάντησε: ${cut(error, 200)}`);
    if (!found.length) L.push('CJ: το Ocado δεν βρέθηκε στο CJ (ούτε μέλος ούτε όχι μέλος).');
    for (const a of found) {
      const live = cjActive(a) ? '' : ` | ΔΕΝ είναι ενεργό (${a.accountStatus})`;
      L.push(`CJ: ${a.name} (${a.id}): ${MARK[a.rel] || a.rel}${live} | network rank: ${dash(a.rank)} | προμήθεια: ${dash(a.commission)} | κατηγορία: ${dash(a.category)} | ${dash(a.url)}`);
    }
  } else L.push(`CJ: ${cjStateText(cjState)}.`);

  // Summary.
  L.push('');
  L.push('=== Σύνοψη ===');
  for (const s of summary) {
    const a = s.awin ? `Awin: ${s.awin.notjoined} μπορείς να κάνεις αίτηση, ${s.awin.joined} ήδη μέλος, ${s.awin.pending} σε αναμονή` : 'Awin: δεν διαβάστηκε';
    const c = s.cj ? `CJ: ${s.cj.notjoined} μπορείς να κάνεις αίτηση, ${s.cj.joined} ήδη μέλος` : 'CJ: δεν ελέγχθηκε';
    L.push(`${s.key}: ${a} · ${c}`);
  }
  return { lines: L, summary };
}

// ---------------- command line ----------------
function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { out[a.slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'; } else out._.push(a);
  }
  return out;
}
// JSON for the PowerShell tool, in ASCII only (the console code page of Windows PowerShell 5.1 does not matter then).
const ascii = o => JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const ids = s => String(s || '').split(/[,\s]+/).filter(x => /^\d{1,12}$/.test(x)).map(Number);

export function main(argv) {
  const a = args(argv);
  const mode = a._[0];
  const r = resolveTopics(a.topics, a.keywords);
  if (!r.ok) return { ok: false, error: r.error, known: r.known || [] };
  if (mode === 'plan') return { ok: true, topics: r.topics.map(t => ({ key: t.key, terms: t.terms.map(termName), cj: cjKeywords(t) })) };
  if (mode === 'pick') {
    const lists = readAwinLists(a.dir);
    const max = Math.max(0, Math.min(200, Number(a['max-details'] || 40)));
    const p = pickDetails(lists, r.topics, max);
    return { ok: true, details: p.details, matches: p.total, check: missingCheckIds(lists, ids(a['check-ids'])) };
  }
  if (mode === 'report') {
    const rep = buildReport({
      dir: a.dir, topics: r.topics, checkIds: ids(a['check-ids']), awinState: a.awin || 'ok', cjState: a.cj || 'ok',
      maxRows: Math.max(1, Number(a['max-rows'] || 25)), cidTail: /^\d{1,4}$/.test(a['cid-tail'] || '') ? a['cid-tail'] : '',
      detailsFailed: Number(a['details-failed'] || 0) || 0
    });
    writeFileSync(a.out, rep.lines.join('\n') + '\n', 'utf8');
    return { ok: true, lines: rep.lines.length };
  }
  return { ok: false, error: 'unknown-mode' };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let res;
  try { res = main(process.argv.slice(2)); } catch (e) { res = { ok: false, error: `crash: ${e && e.message ? e.message : e}` }; }
  process.stdout.write(ascii(res) + '\n');
  process.exitCode = res.ok ? 0 : 1;
}
