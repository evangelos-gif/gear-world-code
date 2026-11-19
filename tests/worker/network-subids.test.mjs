// Our clickref on CJ, Daisycon and Linkwise links (lessons L197): sid= / ws= / subid1= only when missing, the
// network's destination parameter kept after it, everything else byte for byte; Awin links and plain retailer addresses
// exactly as before; a network link is never wrapped in an Awin link; and no CJ deep link is invented for a promo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { affiliateTarget, createWorker } from '../../src/engine.js';
import { withNetworkSubId, networkOfLink, CJ_CLICK_HOSTS } from '../../src/lib/network-subids.js';
import { CJ_LINK_HOSTS, isCjLink } from '../../tools/cj-feed.mjs';
import { isDaisyconLink, bolLink, isBolLink, BOL_SITE_ID } from '../../tools/network-links.mjs';
import { subIdParts } from '../../src/networks/common.js';

// affiliateTarget as it was before lessons L197 (commit a6449786), to prove Awin links and plain addresses did not change.
function before(address, retailer, awin, clickRef, extra = {}) {
  const addExtra = t => {
    for (const k of ['clickref2', 'clickref3']) if (extra && extra[k] && !t.searchParams.has(k)) t.searchParams.set(k, extra[k]);
    return t;
  };
  let target;
  try { target = new URL(String(address || '')); } catch { return null; }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return null;
  if (/(^|\.)awin1\.com$/i.test(target.hostname)) {
    if (!target.searchParams.has('clickref')) target.searchParams.set('clickref', clickRef);
    return addExtra(target);
  }
  const mid = awin && awin.advertisers ? Number(awin.advertisers[String(retailer || '')]) : 0;
  const aff = awin ? Number(awin.publisherId) : 0;
  if (!(mid > 0) || !(aff > 0)) return target;
  const deep = new URL('https://www.awin1.com/cread.php');
  deep.searchParams.set('awinmid', String(mid));
  deep.searchParams.set('awinaffid', String(aff));
  deep.searchParams.set('clickref', clickRef);
  addExtra(deep);
  deep.searchParams.set('ued', target.toString());
  return deep;
}

const AWIN = { publisherId: 3057233, advertisers: { 'Tooled Up': 496, 'My Tool Shed': 49385 } };
const REFS = { clickref2: 'bf26', clickref3: 'google' };
const str = t => (t === null ? null : t.toString());

test('Awin links and plain retailer addresses are byte for byte as before', () => {
  const cases = [
    ['https://www.awin1.com/pclick.php?p=1&a=2&m=3', 'Joybuy'],
    ['https://www.awin1.com/cread.php?awinmid=496&awinaffid=3057233&ued=https%3A%2F%2Fwww.tooled-up.com%2Fx', 'Tooled Up'],
    ['https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&clickref=theirs&clickref2=x', 'X'],
    ['https://awin1.com/pclick.php?p=9', 'Y'],
    ['https://www.tooled-up.com/product/drill?x=1&y=a%20b', 'Tooled Up'],
    ['https://www.mytoolshed.co.uk/p/1', 'My Tool Shed'],
    ['https://www.joybuy.co.uk/p/1?ref=abc', 'Joybuy'],
    ['http://shop.example/p/1', 'Other'],
    ['https://shop.example/c/?si=1', 'Other'],
    ['https://go.linkwi.se.evil.com/z/1-0/CD1/', 'Other'],
    ['https://www.bol.com/nl/nl/p/lego-set/9200000012345678/', 'bol.com'],
    ['https://partner.bol.com/account/start', 'bol.com'],
    ['javascript:alert(1)', 'Tooled Up'],
    ['not a url', 'Tooled Up'],
    ['', 'Tooled Up']
  ];
  for (const [url, retailer] of cases) {
    for (const extra of [{}, REFS]) {
      assert.equal(str(affiliateTarget(url, retailer, AWIN, 'cgw-82540', extra)), str(before(url, retailer, AWIN, 'cgw-82540', extra)), `${url} ${JSON.stringify(extra)}`);
      assert.equal(str(affiliateTarget(url, retailer, {}, 'tgw-promo-x', extra)), str(before(url, retailer, {}, 'tgw-promo-x', extra)), `${url} without an Awin map`);
    }
  }
});

test('CJ: sid= on click- links when missing, before url=, the rest unchanged; an existing SID and the /links/ form are kept', () => {
  const plain = 'https://www.anrdoezrs.net/click-101917444-15734567';
  assert.equal(str(affiliateTarget(plain, 'XPLORA UK', AWIN, 'tgw-77')), `${plain}?sid=tgw-77`);
  const deep = 'https://www.jdoqocy.com/click-101917444-15678?url=https%3A%2F%2Fxplora.co.uk%2Fproducts%2Fx6play%3Fv%3D1';
  assert.equal(str(affiliateTarget(deep, 'XPLORA UK', AWIN, 'tgw-77', REFS)), 'https://www.jdoqocy.com/click-101917444-15678?sid=tgw-77&url=https%3A%2F%2Fxplora.co.uk%2Fproducts%2Fx6play%3Fv%3D1');
  const mid = 'https://www.tkqlhce.com/click-1-2-1700475083000?cm_mmc=a&url=https%3A%2F%2Fshop.example%2F';
  assert.equal(str(affiliateTarget(mid, 'S', AWIN, 'cgw-1')), 'https://www.tkqlhce.com/click-1-2-1700475083000?cm_mmc=a&sid=cgw-1&url=https%3A%2F%2Fshop.example%2F');
  for (const kept of ['https://www.kqzyfj.com/click-1-2?sid=theirs', 'https://www.kqzyfj.com/click-1-2?SID=12345x67890', 'https://www.anrdoezrs.net/links/101917444/type/dlg/https://shop.example/p', 'https://www.dpbolvw.net/image-1-2']) {
    assert.equal(str(affiliateTarget(kept, 'S', AWIN, 'cgw-1')), new URL(kept).toString(), kept);
  }
  assert.equal(new URL(str(affiliateTarget(plain, 'S', AWIN, 'cgw-1', REFS))).searchParams.has('clickref2'), false, 'the Awin campaign refs stay Awin only');
});

test('a CJ, Daisycon or Linkwise link is never wrapped in an Awin link, even for a retailer in the Awin map', () => {
  const t = affiliateTarget('https://www.anrdoezrs.net/click-1-2?url=https%3A%2F%2Fwww.tooled-up.com%2F', 'Tooled Up', AWIN, 'ggw-5');
  assert.equal(t.hostname, 'www.anrdoezrs.net');
  assert.equal(t.searchParams.get('sid'), 'ggw-5');
  const d = affiliateTarget('https://lt45.net/c/?si=16029&li=1&wi=447289&dl=https%3A%2F%2Fwww.tooled-up.com%2F', 'Tooled Up', AWIN, 'ggw-5');
  assert.equal(d.hostname, 'lt45.net');
});

test('Daisycon: ws= when missing, before dl=, on any of its tracking domains; an existing ws is kept', () => {
  const l = 'https://ds1.nl/c/?si=16029&li=1660842&wi=447289&dl=https%3A%2F%2Fwww.superdry.com%2Fx%3Fa%3D1';
  assert.equal(str(affiliateTarget(l, 'Superdry EU', AWIN, 'mgw-555')), 'https://ds1.nl/c/?si=16029&li=1660842&wi=447289&ws=mgw-555&dl=https%3A%2F%2Fwww.superdry.com%2Fx%3Fa%3D1');
  assert.equal(str(affiliateTarget('https://lt45.net/c?si=1&li=2&wi=3', 'S', {}, 'hgw-1')), 'https://lt45.net/c?si=1&li=2&wi=3&ws=hgw-1');
  const kept = 'https://ds1.nl/c/?si=1&li=2&wi=3&ws=theirs&dl=https%3A%2F%2Fx.example%2F';
  assert.equal(str(affiliateTarget(kept, 'S', AWIN, 'mgw-1')), kept);
  assert.ok(isDaisyconLink(str(affiliateTarget(l, 'S', AWIN, 'mgw-1')), '447289'), 'still a Daisycon link of our media');
});

test('Linkwise: subid1= on go.linkwi.se/z/ links when missing, before lnkurl=', () => {
  const l = 'https://go.linkwi.se/z/11178-0/CD23593/?lnkurl=https%3A%2F%2Fwww.shop.gr%2Fp%2F1';
  assert.equal(str(affiliateTarget(l, 'Shop GR', AWIN, 'kgw-9')), 'https://go.linkwi.se/z/11178-0/CD23593/?subid1=kgw-9&lnkurl=https%3A%2F%2Fwww.shop.gr%2Fp%2F1');
  assert.equal(str(affiliateTarget('https://go.linkwi.se/z/1-0/CD2/', 'S', {}, 'kgw-9')), 'https://go.linkwi.se/z/1-0/CD2/?subid1=kgw-9');
  for (const kept of ['https://go.linkwi.se/z/1-0/CD2/?subid1=theirs', 'https://go.linkwi.se/delivery/js/crl.js']) assert.equal(str(affiliateTarget(kept, 'S', {}, 'kgw-9')), kept);
});

test('the sub id we add is the one the sales sync reads back', () => {
  const t = affiliateTarget('https://www.anrdoezrs.net/click-1-2', 'S', {}, 'zgw-4410');
  assert.deepEqual(subIdParts(t.searchParams.get('sid')), { sub_id: 'zgw-4410', site: 'zgw', product_ref: '4410' });
  const p = affiliateTarget('https://go.linkwi.se/z/1-0/CD2/', 'S', {}, 'bgw-promo-ihoverboard-bf8');
  assert.equal(subIdParts(p.searchParams.get('subid1')).site, 'bgw');
});

test('the CJ click domains are the same as the feed tool’s, and look-alike hosts are not networks', () => {
  assert.equal(CJ_CLICK_HOSTS.source, CJ_LINK_HOSTS.source);
  for (const h of ['www.anrdoezrs.net', 'dpbolvw.net', 'www.jdoqocy.com', 'www.kqzyfj.com', 'www.tkqlhce.com', 'www.emjcd.com']) {
    assert.equal(networkOfLink(new URL(`https://${h}/click-1-2`)), 'cj', h);
    assert.ok(isCjLink(`https://${h}/click-1-2`));
  }
  for (const bad of ['https://anrdoezrs.net.evil.com/click-1-2', 'https://evilanrdoezrs.net/click-1-2', 'https://linkwi.se/z/1-0/CD2/', 'ftp://www.anrdoezrs.net/click-1-2']) {
    assert.equal(networkOfLink(new URL(bad)), null, bad);
  }
  assert.equal(withNetworkSubId(new URL('https://www.tooled-up.com/p'), 'cgw-1'), null, 'a plain address is not a network link');
});

test('/go/: a promo keeps its Awin deep link, and a CJ shop without a verified CJ link gets no invented one (L196)', () => {
  // promoOut passes { publisherId, advertisers: { [retailer]: awinMid } }; a CJ shop has no awinMid.
  const cjPromo = affiliateTarget('https://www.kaercher.com/uk/black-friday', 'Kärcher UK', { publisherId: 3057233, advertisers: { 'Kärcher UK': undefined } }, 'cgw-promo-karcher-black20');
  assert.equal(str(cjPromo), 'https://www.kaercher.com/uk/black-friday', 'the plain page, as before: no CJ link is made up');
  const verified = affiliateTarget('https://www.anrdoezrs.net/click-101917444-1?url=https%3A%2F%2Fwww.kaercher.com%2Fuk%2F', 'Kärcher UK', { publisherId: 3057233, advertisers: { 'Kärcher UK': undefined } }, 'cgw-promo-karcher-black20');
  assert.equal(verified.searchParams.get('sid'), 'cgw-promo-karcher-black20', 'once a verified CJ link is there, it gets our sid');
  const awinPromo = affiliateTarget('https://www.ihoverboard.co.uk/', 'iHoverboard', { publisherId: 3057233, advertisers: { iHoverboard: 12345 } }, 'bgw-promo-ihoverboard-bf8');
  assert.equal(str(awinPromo), str(before('https://www.ihoverboard.co.uk/', 'iHoverboard', { publisherId: 3057233, advertisers: { iHoverboard: 12345 } }, 'bgw-promo-ihoverboard-bf8')));
});

function tgwDb() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('sites/tgw/migrations/0001_init.sql', 'utf8'));
  sql.exec(readFileSync('tests/fixtures/tgw-seed.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}

test('TGW /out/: a CJ product goes to CJ with sid=tgw-<id>; an Awin product exactly as before', async () => {
  const site = (await import('../../sites/tgw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = tgwDb();
  const env = { DB, FX_FETCH: async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }) };
  const go = async id => {
    const r = await worker.fetch(new Request(`https://${site.domain}/out/${id}`, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } }), env, { waitUntil() {} });
    assert.equal(r.status, 302);
    return r.headers.get('Location');
  };
  const awinUrl = DB.sql.prepare('SELECT affiliate_url FROM products WHERE id = 1').get().affiliate_url;
  assert.equal(await go(1), str(before(awinUrl, 'x', site.awin, 'tgw-1')), 'the Awin product: the same address as before');
  DB.sql.prepare('UPDATE products SET affiliate_url = ? WHERE id = 1').run('https://www.anrdoezrs.net/click-101917444-15734567?url=https%3A%2F%2Fxplora.co.uk%2Fproducts%2Fx6play');
  assert.equal(await go(1), 'https://www.anrdoezrs.net/click-101917444-15734567?sid=tgw-1&url=https%3A%2F%2Fxplora.co.uk%2Fproducts%2Fx6play');
});

test('bol.com: subid= on partner links when missing (an empty one is filled in place), everything else byte for byte', () => {
  const link = bolLink('https://www.bol.com/nl/nl/p/lego-set/9200000012345678/', 'Lego set');
  const out = str(affiliateTarget(link, 'bol.com', AWIN, 'kgw-77'));
  assert.equal(out, `${link}&subid=kgw-77`);
  assert.ok(isBolLink(out, BOL_SITE_ID), 'still our partner link');
  assert.equal(new URL(out).searchParams.get('url'), 'https://www.bol.com/nl/nl/p/lego-set/9200000012345678/');
  const kept = `${link}&subid=theirs`;
  assert.equal(str(affiliateTarget(kept, 'bol.com', AWIN, 'kgw-77')), kept);
  const emptyOne = 'http://partnerprogramma.bol.com/click/click?p=1&t=url&s=1559450&url=https%3A%2F%2Fwww.bol.com%2Fnl%2Fp%2Fx%2F1%2F&f=WP_BSL&subid=&name=Test';
  assert.equal(str(affiliateTarget(emptyOne, 'bol.com', AWIN, 'hgw-5')), emptyOne.replace('subid=&', 'subid=hgw-5&'));
  assert.equal(subIdParts(new URL(out).searchParams.get('subid')).site, 'kgw', 'the Reporting API gives it back as subId');
  assert.equal(networkOfLink(new URL('https://partner.bol.com.evil.com/click/click?s=1')), null);
});
