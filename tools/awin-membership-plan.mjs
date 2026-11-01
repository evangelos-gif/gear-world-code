#!/usr/bin/env node
// Which Awin programmes still pay (job 4 of 25 Oct 2026, lessons L61). READ-ONLY.
// Joins the shops that have active products on the older sites (wrangler output files: retailer, n, a sample link,
// bad links) with your Awin feed list (Membership Status, Last Imported), and says for every programme:
//   - you are a member and its feed is fresh            -> ΕΝΤΑΞΕΙ
//   - you are a member but its feed is older than 30 days -> ΠΡΟΣΟΧΗ (stale feed, see legacy-refresh -FromShop, L60)
//   - it is in the list but you are not a member          -> ΠΡΟΒΛΗΜΑ: the clicks on its products earn nothing
//   - it is not in the list at all                        -> ΠΡΟΒΛΗΜΑ: most likely closed or the partnership ended
//   - its Awin links have no product address (?ued=...)   -> ΠΡΟΒΛΗΜΑ: a click does not open the product
// With the Awin API (lessons L65) the partnership itself decides, not the feed list: a programme can be joined and pay
// with no feed in the list (GS Workwear sold on 27 Oct 2026 while the check called it "not in the list"):
//   - joined, fresh feed -> ΕΝΤΑΞΕΙ; joined, old feed or no feed -> ΠΡΟΣΟΧΗ (prices and stock are not refreshed)
//   - pending / suspended / rejected / not joined / unknown to Awin -> ΠΡΟΒΛΗΜΑ
// Nothing is changed anywhere. Hiding the products of a programme that does not pay is a separate step.
//
// node tools/awin-membership-plan.mjs --list <awin list csv> --site cgw=<wrangler json> [--site ...]
//      [--relation joined=<api json> --relation pending=<api json> ...] --out <dir> [--now <iso>]
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords } from './tgw-import-plan.mjs';
import { rowsFromWrangler } from './cleanup-rules/tidy.mjs';

export const STALE_DAYS = 30;
export const PUBLISHER_ID = '3057233';

// The Awin advertiser id of a product link: cread.php?awinmid=<id> or pclick.php?...&m=<id>. Empty for a plain shop link.
export function advertiserOf(link) {
  const s = String(link || '');
  if (!/^https:\/\/www\.awin1\.com\//i.test(s)) return '';
  const m = /[?&]awinmid=(\d{1,9})(?:&|$)/i.exec(s) || /[?&]m=(\d{1,9})(?:&|$)/i.exec(s);
  return m ? m[1] : '';
}

// The rows of your Awin feed list (CSV): one per feed. Membership "active" or "joined" means you are a member.
export async function readAwinList(path) {
  const out = [];
  let h = null;
  for await (const rec of readCsvRecords(createReadStream(path))) {
    if (!h) { h = rec.map(x => String(x).trim().toLowerCase().replace(/^﻿/, '')); continue; }
    const get = re => { const i = h.findIndex(c => re.test(c)); return i >= 0 ? String(rec[i] ?? '').trim() : ''; };
    const id = get(/^advertiser.?id$/);
    if (!/^\d{1,9}$/.test(id)) continue;
    out.push({ id, name: get(/^advertiser.?name$/), membership: get(/membership/).toLowerCase(), feedId: get(/^feed.?id$/),
      lastImported: get(/last.?imported/), products: Number(get(/(no|number).?of.?products/)) || 0, region: get(/region/) });
  }
  return out;
}

const isMember = s => /^(active|joined)$/i.test(String(s || '').trim());

export const RELATIONS = ['joined', 'pending', 'suspended', 'rejected', 'notjoined'];
// Advertiser id -> partnership, from GET /publishers/<id>/programmes?relationship=<r> (one answer per relationship).
export function readRelations(answers) {
  const out = new Map();
  for (const [rel, text] of answers) {
    const j = JSON.parse(String(text).replace(/^\uFEFF/, ''));
    if (!Array.isArray(j)) throw new Error('the Awin answer is not a list of programmes');
    for (const p of j) if (p && p.id != null && !(out.has(String(p.id)) && out.get(String(p.id)).rel === 'joined')) out.set(String(p.id), { rel, name: String(p.name || '') });
  }
  return out;
}
const REL_REASON = {
  pending: 'η αίτηση συνεργασίας εκκρεμεί: τα clicks δεν πληρώνουν ακόμα',
  suspended: 'η συνεργασία έχει ανασταλεί: τα clicks δεν πληρώνουν',
  rejected: 'το κατάστημα απέρριψε τη συνεργασία: τα clicks δεν πληρώνουν',
  notjoined: 'δεν είσαι μέλος: τα clicks δεν πληρώνουν'
};
const parseDate = s => { const t = Date.parse(String(s || '').trim().replace(' ', 'T')); return Number.isFinite(t) ? t : NaN; };

export function planMembership({ sites, list, relations = null, now = new Date() }) {
  const byId = new Map();
  for (const r of list) { if (!byId.has(r.id)) byId.set(r.id, []); byId.get(r.id).push(r); }
  const programmes = new Map();
  const plain = [];
  for (const { site, rows } of sites) {
    for (const r of rows) {
      const n = Number(r.n) || 0;
      const id = advertiserOf(r.link);
      if (!id) { plain.push({ site, retailer: r.retailer, n }); continue; }
      if (!programmes.has(id)) programmes.set(id, { id, retailers: new Set(), sites: [], total: 0, bad: 0 });
      const p = programmes.get(id);
      p.retailers.add(String(r.retailer));
      p.sites.push({ site, retailer: String(r.retailer), n });
      p.total += n;
      p.bad += Number(r.bad) || 0;
    }
  }
  const out = [];
  for (const p of programmes.values()) {
    const feeds = byId.get(p.id) || [];
    const api = relations && relations.size ? (relations.get(p.id) || { rel: 'unknown', name: '' }) : null;
    const member = api ? api.rel === 'joined' : feeds.some(f => isMember(f.membership));
    const statuses = api ? [api.rel] : [...new Set(feeds.map(f => f.membership || '?'))];
    const times = feeds.filter(f => isMember(f.membership) || !member || api).map(f => parseDate(f.lastImported)).filter(Number.isFinite);
    const newest = times.length ? Math.max(...times) : NaN;
    const days = Number.isFinite(newest) ? Math.floor((now.getTime() - newest) / 86400000) : null;
    let level, reason;
    if (api) {
      // The partnership from the Awin API decides (L65); the feed list only says how fresh the products are.
      if (api.rel === 'joined') {
        if (!feeds.length) { level = 'yellow'; reason = 'μέλος (Awin API), αλλά δεν έχει feed στη λίστα σου: τιμές και αποθέματα δεν ανανεώνονται από feed (L60, L65)'; }
        else if (days !== null && days > STALE_DAYS) { level = 'yellow'; reason = `μέλος (Awin API), αλλά το feed έχει να ανανεωθεί ${days} μέρες (L60)`; }
        else { level = 'green'; reason = 'μέλος (Awin API)' + (days !== null ? `, feed ${days} ημ.` : ''); }
      } else if (REL_REASON[api.rel]) { level = 'red'; reason = REL_REASON[api.rel] + ' (Awin API)'; }
      else { level = 'red'; reason = 'το Awin δεν το γνωρίζει πια: μάλλον έκλεισε το πρόγραμμα (Awin API)'; }
    } else if (!feeds.length) { level = 'red'; reason = 'δεν υπάρχει στη λίστα feeds του Awin: μάλλον έκλεισε ή έληξε η συνεργασία'; }
    else if (!member) { level = 'red'; reason = `δεν είσαι μέλος (${statuses.join(', ')}): τα clicks στα προϊόντα του δεν πληρώνουν`; }
    else if (days !== null && days > STALE_DAYS) { level = 'yellow'; reason = `μέλος, αλλά το feed έχει να ανανεωθεί ${days} μέρες (L60)`; }
    else { level = 'green'; reason = 'μέλος' + (days !== null ? `, feed ${days} ημ.` : ''); }
    out.push({ ...p, retailers: [...p.retailers], awinName: feeds[0] ? feeds[0].name : (api && api.name) || '', statuses, member, days,
      lastImported: Number.isFinite(newest) ? new Date(newest).toISOString().slice(0, 10) : '', level, reason });
  }
  const rank = { red: 0, yellow: 1, green: 2 };
  out.sort((a, b) => (rank[a.level] - rank[b.level]) || (b.total - a.total));
  return { programmes: out, plain, listed: list.length, api: Boolean(relations && relations.size) };
}

export function renderMembershipReport(plan) {
  const fmt = n => new Intl.NumberFormat('en-GB').format(n);
  const mark = { red: '🔴 ΠΡΟΒΛΗΜΑ', yellow: '🟡 ΠΡΟΣΟΧΗ', green: '🟢 ΕΝΤΑΞΕΙ' };
  const L = [];
  const reds = plan.programmes.filter(p => p.level === 'red');
  const bad = plan.programmes.filter(p => p.bad > 0);
  const atRisk = reds.reduce((s, p) => s + p.total, 0);
  L.push(`Προγράμματα με ενεργά προϊόντα: ${plan.programmes.length}. Λίστα Awin: ${fmt(plan.listed)} feeds. Συνεργασίες: ${plan.api ? 'από το Awin API' : 'μόνο από τη λίστα feeds (χωρίς κλειδί API)'}.`);
  L.push(`Σύνολο: ${reds.length} 🔴 ΠΡΟΒΛΗΜΑ · ${plan.programmes.filter(p => p.level === 'yellow').length} 🟡 ΠΡΟΣΟΧΗ · ${bad.length} με χαλασμένα links. Ενεργά προϊόντα σε προγράμματα που δεν πληρώνουν: ${fmt(atRisk)}.`);
  L.push('');
  for (const p of plan.programmes) {
    const where = p.sites.map(s => `${s.site.toUpperCase()} ${fmt(s.n)}`).join(', ');
    const names = p.retailers.join(' / ');
    L.push(`${mark[p.level]}: ${names} (Awin ${p.id}${p.awinName && p.awinName !== names ? `, «${p.awinName}»` : ''}) | ${where} | ${p.reason}`);
    if (p.level !== 'green') L.push(`   Έλεγχος στο Awin: https://ui.awin.com/merchant-profile/${p.id}`);
    if (p.bad > 0) L.push(`   🔴 ΠΡΟΒΛΗΜΑ: ${fmt(p.bad)} links χωρίς διεύθυνση προϊόντος (το ued= δεν ξεκινά με http): το click δεν ανοίγει το προϊόν.`);
  }
  if (plan.plain.length) {
    L.push('');
    L.push('Χωρίς link του Awin στη βάση (το /out/ το κάνει link του Awin μόνο αν το κατάστημα είναι στο awin.advertisers του site):');
    for (const x of plan.plain) L.push(`   ${x.site.toUpperCase()}: ${x.retailer} (${fmt(x.n)})`);
  }
  return L.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
  const sites = args.flatMap((a, i) => a === '--site' ? [args[i + 1]] : []).map(s => {
    const [site, file] = [s.slice(0, s.indexOf('=')), s.slice(s.indexOf('=') + 1)];
    return { site, rows: rowsFromWrangler(readFileSync(file, 'utf8')) };
  });
  const out = opt('--out');
  mkdirSync(out, { recursive: true });
  const list = opt('--list') ? await readAwinList(opt('--list')) : [];
  const rel = args.flatMap((a, i) => a === '--relation' ? [args[i + 1]] : []).map(s => [s.slice(0, s.indexOf('=')), readFileSync(s.slice(s.indexOf('=') + 1), 'utf8')]);
  const relations = rel.length ? readRelations(rel) : null;
  const plan = planMembership({ sites, list, relations, now: opt('--now') ? new Date(opt('--now')) : new Date() });
  writeFileSync(join(out, 'report.txt'), renderMembershipReport(plan));
  writeFileSync(join(out, 'summary.json'), JSON.stringify(plan.programmes.map(p => ({ id: p.id, retailers: p.retailers, total: p.total, level: p.level, member: p.member, days: p.days, bad: p.bad })), null, 2));
}
