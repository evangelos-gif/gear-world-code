// The affiliate networks other than Awin (13 Nov 2026, lessons L128): their feed files in the archive, the prefix of
// their product ids on the sites, and how to recognise their tracking links (the link that earns the commission).
// Each network's download tool writes <FILE>_<advertiser>.csv.gz with the Awin column names and the network's tracking
// link in aw_deep_link, so the import planner reads them like any other feed:
//   CJ        tools/cj-feed-download.ps1       CJ_<advertiser>.csv.gz        (lessons L86)
//   Rakuten   tools/rakuten-feed-download.ps1  RAKUTEN_<advertiser MID>.csv.gz
//   Daisycon  tools/daisycon-feed-download.ps1 DAISYCON_<program>.csv.gz
//   bol.com   tools/bol-feed-download.ps1      BOL_<bol category>_<country>.csv.gz (chat 9, 16 Nov 2026, lessons L154)
//   Linkwise  tools/linkwise-feed-download.ps1 LINKWISE_<programme>.csv.gz (Greece and Cyprus, 19 Nov 2026, lessons L199)
//   Adtraction tools/adtraction-feed-download.ps1 ADTRACTION_<programme>.csv.gz (UK programmes, 23 Nov 2026, lessons L219)
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

// bol.com Partnerprogramma (site ID 1559450, gearworldhub.com, lessons L154): the product link of the partner programme,
// https://partner.bol.com/click/click?p=2&t=url&s=<site ID>&f=TXL&url=<bol.com page>&name=<product name>. It lives in
// src/lib/bol-catalog.js (plain JavaScript, shared with the private Worker gear-world-bol-refresh, lessons L205).
import { BOL_SITE_ID, bolLink, isBolLink } from '../src/lib/bol-catalog.js';
export { BOL_SITE_ID, bolLink, isBolLink };

// Linkwise (Greece and Cyprus, lessons L199): https://go.linkwi.se/z/<programme>-<n>/<affiliate code>/?lnkurl=<shop page>.
// With a code, also that the click is ours (the code itself never goes into the repository).
export function isLinkwiseLink(u, code = '') {
  const x = parse(u);
  if (!x || x.protocol !== 'https:' || x.hostname !== 'go.linkwi.se') return false;
  const m = /^\/z\/(\d{2,9})-\d+\/(CD\d{3,9})\/?$/.exec(x.pathname);
  return Boolean(m && /^https?:\/\//i.test(x.searchParams.get('lnkurl') || '') && (!code || m[2] === code));
}

// Adtraction (lessons L219): <tracking host>/t/t?a=<programme>&as=<our channel>&t=2&tk=1&url=<shop page>. Adtraction also
// uses the shops' own tracking domains, so the shape is checked (path /t/t, a= and as= numbers), and with a channel also
// that the click is ours.
export function isAdtractionLink(u, channel = '') {
  const x = parse(u);
  if (!x || x.protocol !== 'https:' || !/^\/t\/t\/?$/i.test(x.pathname)) return false;
  const a = x.searchParams.get('a') || '', as = x.searchParams.get('as') || '';
  return /^\d{2,12}$/.test(a) && /^\d{3,12}$/.test(as) && (!channel || as === String(channel));
}
// The standard Adtraction deep link to one page of the shop (t=2: a deep link).
export function adtractionLink(programId, channel, page) {
  return `https://track.adtraction.com/t/t?a=${encodeURIComponent(programId)}&as=${encodeURIComponent(channel)}&t=2&tk=1&url=${encodeURIComponent(page)}`;
}

export const NETWORKS = {
  cj: { label: 'CJ', file: 'CJ', idPrefix: 'cj', isLink: isCjLink },
  rakuten: { label: 'Rakuten', file: 'RAKUTEN', idPrefix: 'rk', isLink: isRakutenLink },
  daisycon: { label: 'Daisycon', file: 'DAISYCON', idPrefix: 'dc', isLink: isDaisyconLink },
  bol: { label: 'bol.com', file: 'BOL', idPrefix: 'bol', isLink: isBolLink },
  linkwise: { label: 'Linkwise', file: 'LINKWISE', idPrefix: 'lw', isLink: isLinkwiseLink },
  adtraction: { label: 'Adtraction', file: 'ADTRACTION', idPrefix: 'at', isLink: isAdtractionLink }
};

export function networkOf(rules) {
  const n = rules && rules.RULES ? rules.RULES.network : rules && rules.network;
  return n ? NETWORKS[n] || null : null;
}

// The Awin column names the download tools write (the same as CJ's, lessons L86), and one CSV line.
export { COLUMNS as FEED_COLUMNS, csvLine } from './cj-feed.mjs';

// The shop's own page inside a tracking link (Rakuten murl=, Daisycon dl=, CJ and Adtraction url=), for the "shop" check of the rules.
export function pageInLink(u) {
  const x = parse(u);
  if (!x) return '';
  for (const k of ['murl', 'dl', 'url', 'ued', 'lnkurl']) {
    const v = x.searchParams.get(k);
    if (v && /^https?:\/\//i.test(v)) return v;
  }
  return '';
}
