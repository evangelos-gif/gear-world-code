// The affiliate networks other than Awin (13 Nov 2026, lessons L128): their feed files in the archive, the prefix of
// their product ids on the sites, and how to recognise their tracking links (the link that earns the commission).
// Each network's download tool writes <FILE>_<advertiser>.csv.gz with the Awin column names and the network's tracking
// link in aw_deep_link, so the import planner reads them like any other feed:
//   CJ        tools/cj-feed-download.ps1       CJ_<advertiser>.csv.gz        (lessons L86)
//   Rakuten   tools/rakuten-feed-download.ps1  RAKUTEN_<advertiser MID>.csv.gz
//   Daisycon  tools/daisycon-feed-download.ps1 DAISYCON_<program>.csv.gz
import { isCjLink } from './cj-feed.mjs';

const parse = u => { try { const x = new URL(String(u || '')); return /^https?:$/.test(x.protocol) ? x : null; } catch { return null; } };

// Rakuten (LinkShare): click.linksynergy.com/link?id=...&offerid=...&murl=... (or /deeplink, /fs-bin/click).
export const RAKUTEN_LINK_HOSTS = /(^|\.)linksynergy\.com$/i;
export function isRakutenLink(u) {
  const x = parse(u);
  return Boolean(x && RAKUTEN_LINK_HOSTS.test(x.hostname) && /^\/(link|deeplink|fs-bin\/)/i.test(x.pathname) && x.searchParams.get('id'));
}

// Daisycon: <tracking host>/c/?si=<program>&li=<link>&wi=<our media id>&dl=<page>. Daisycon uses many short tracking
// domains (ds1.nl, lt45.net ...), so the shape of the link is checked, and with a media id also that the click is ours.
export function isDaisyconLink(u, mediaId = '') {
  const x = parse(u);
  if (!x || !/^\/c\/?$/i.test(x.pathname) || !x.searchParams.get('si') || !x.searchParams.get('wi')) return false;
  return !mediaId || x.searchParams.get('wi') === String(mediaId);
}

export const NETWORKS = {
  cj: { label: 'CJ', file: 'CJ', idPrefix: 'cj', isLink: isCjLink },
  rakuten: { label: 'Rakuten', file: 'RAKUTEN', idPrefix: 'rk', isLink: isRakutenLink },
  daisycon: { label: 'Daisycon', file: 'DAISYCON', idPrefix: 'dc', isLink: isDaisyconLink }
};

export function networkOf(rules) {
  const n = rules && rules.RULES ? rules.RULES.network : rules && rules.network;
  return n ? NETWORKS[n] || null : null;
}

// The Awin column names the download tools write (the same as CJ's, lessons L86), and one CSV line.
export { COLUMNS as FEED_COLUMNS, csvLine } from './cj-feed.mjs';

// The shop's own page inside a tracking link (Rakuten murl=, Daisycon dl=, CJ url=), for the "shop" check of the rules.
export function pageInLink(u) {
  const x = parse(u);
  if (!x) return '';
  for (const k of ['murl', 'dl', 'url', 'ued']) {
    const v = x.searchParams.get(k);
    if (v && /^https?:\/\//i.test(v)) return v;
  }
  return '';
}
