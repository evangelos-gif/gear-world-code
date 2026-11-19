// Our click reference on the tracking links of the networks other than Awin (lessons L197), so their sales show which
// site and product brought them, like the Awin clickref (lessons L15). The sync (src/network-sync.js) reads it back.
// Only a link of that network gets it, only when the link has no value of its own under that name, and the network's
// destination parameter (CJ url=, Daisycon dl=, Linkwise lnkurl=) stays where it was, after ours. Everything else in the
// link is kept byte for byte. A plain retailer address is never changed here (it is not a network link: null).
//
//   CJ        click-<PID>-<AID> links on CJ's click domains get sid=<ref>. Official: CJ developer docs, Publisher Site
//             Tracking > On-Click Tracking ("https://www.anrdoezrs.net/click-99999-1234567?SID=12345x67890"); the
//             Commission Detail API gives it back as shopperId. The /links/<PID>/type/dlg/... form carries a SID as a
//             path part, not a parameter, so it is left as it is (our feeds give click- links: tools/cj-feed.mjs).
//   Daisycon  <tracking host>/c/?si=<programme>&li=<link>&wi=<media>&dl=<page> (Daisycon uses many short tracking
//             domains, so the shape is checked, as tools/network-links.mjs isDaisyconLink) gets ws=<ref>. Official:
//             Daisycon publisher FAQ "How to set up a Sub ID" ("&ws=", first Sub ID up to 100 characters).
//   Linkwise  go.linkwi.se/z/<programme>-<id>/CD<publisher>/ links get subid1=<ref>. Official: Linkwise's own click
//             script https://go.linkwi.se/delivery/js/crl.js sends subid1 ... subid5.

// The CJ click domains: the same list as tools/cj-feed.mjs CJ_LINK_HOSTS (a test keeps them equal). The engine cannot
// import that file (it uses Node's file system).
export const CJ_CLICK_HOSTS = /(^|\.)(anrdoezrs\.net|dpbolvw\.net|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|emjcd\.com|qksrv\.net|ftjcfx\.com|lduhtrp\.net|awltovhc\.com|tqlkg\.com|apmebf\.com|afcyhf\.com|lqdhgjs\.com|yceml\.net|mjbpab\.com)$/i;

const has = (u, name) => [...u.searchParams.keys()].some(k => k.toLowerCase() === name);

// name=value put in the query just before the `before` parameter (or at the end), the other parts left as they are.
function insertParam(u, name, value, before) {
  const raw = u.search.replace(/^\?/, '');
  const parts = raw ? raw.split('&') : [];
  const pair = `${name}=${encodeURIComponent(value)}`;
  const i = before ? parts.findIndex(p => decodeName(p) === before) : -1;
  if (i >= 0) parts.splice(i, 0, pair); else parts.push(pair);
  u.search = `?${parts.join('&')}`;
  return u;
}
const decodeName = p => { const n = p.split('=')[0]; try { return decodeURIComponent(n).toLowerCase(); } catch { return n.toLowerCase(); } };

// Which network a tracking link belongs to: 'cj' | 'daisycon' | 'linkwise' | null.
export function networkOfLink(u) {
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) return null;
  if (CJ_CLICK_HOSTS.test(u.hostname)) return 'cj';
  if (/^go\.linkwi\.se$/i.test(u.hostname)) return 'linkwise';
  if (/^\/c\/?$/i.test(u.pathname) && u.searchParams.get('si') && u.searchParams.get('wi')) return 'daisycon';
  return null;
}

// The link with our reference added (a new URL), the same link when it already has one or has no place for it, or null
// when it is not a CJ, Daisycon or Linkwise tracking link.
export function withNetworkSubId(target, clickRef) {
  const net = networkOfLink(target);
  if (!net) return null;
  const u = new URL(target.toString());
  const ref = String(clickRef || '');
  if (!ref) return u;
  if (net === 'cj') {
    if (!/^\/click-\d+-\d+/i.test(u.pathname) || has(u, 'sid')) return u;
    return insertParam(u, 'sid', ref, 'url');
  }
  if (net === 'daisycon') {
    if (has(u, 'ws')) return u;
    return insertParam(u, 'ws', ref, 'dl');
  }
  if (!/^\/z\//i.test(u.pathname) || has(u, 'subid1')) return u;
  return insertParam(u, 'subid1', ref, 'lnkurl');
}
