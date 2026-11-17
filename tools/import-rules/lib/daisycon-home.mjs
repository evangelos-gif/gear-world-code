// Daisycon home shops in Dutch, German or French for Home Gear World (Wave 3, chat 9, 17 Nov 2026): one rules file per
// programme (tools/import-rules/<key>.mjs) made by daisyconHomeRules. The place comes from lib/home-eu.mjs, the card keeps
// the shop's own name (in its language) and each shop is shown only in its own country and language (site.config
// deliversTo + languages, lessons L165).
//
// Where the shop page comes from: these feeds have no shop page column (download of 16-17 Nov 2026: "με σελίδα
// καταστήματος: 0"), only Daisycon's tracking link. The page is then read from the link's "dl" (lessons L145); when the
// link has none, a page is made from the product number, and only for a link of THIS programme ("si=<programme>"), so a
// row of another shop can never pass. The page is used only for the shop check and the product key: the card's button
// always goes through Daisycon's own tracking link (L86), never to this address.
import { daisyconField, pageKey } from './daisycon-shop.mjs';
import { homePlaceEu } from './home-eu.mjs';

export function programmeOf(link) {
  try { return new URL(String(link || '')).searchParams.get('si') || ''; } catch { return ''; }
}

export function daisyconPageField(shopUrl, programmeId) {
  const base = daisyconField(shopUrl);
  const root = String(shopUrl).replace(/\/?$/, '/');
  return (c, column) => {
    const v = base(c, column);
    if (c !== 'merchant_deep_link' || v) return v;
    const id = String(column('merchant_product_id') || column('aw_product_id') || '').trim();
    if (!id || programmeOf(column('aw_deep_link')) !== String(programmeId)) return '';
    return `${root}#product-${encodeURIComponent(id)}`;
  };
}

// opts: key, advertiserId, retailer (letters, digits, space, dot, dash: legacy-import.ps1), shopUrl, language (nl, de, fr),
// brand (a prefix of the feed's names to drop, "Miss Towels - ..."), minPrice, maxPrice, maxPerSubcategory.
export function daisyconHomeRules(o) {
  const host = new URL(o.shopUrl).host.replace(/^www\./, '');
  const RULES = {
    key: o.key,
    network: 'daisycon',
    advertiserId: o.advertiserId,
    retailer: o.retailer,
    currency: 'EUR',
    shop: new RegExp(`^https://(www\\.)?${host.replace(/\./g, '\\.')}/`, 'i'),
    sites: ['hgw'],
    minPrice: o.minPrice ?? 5,
    maxPrice: o.maxPrice ?? 5000,
    // One shop must not fill a whole subcategory of the site (lessons L161, L164).
    maxPerSubcategory: o.maxPerSubcategory ?? 400,
    // Sizes of one product are separate rows with the same name: one card (the lowest in-stock price).
    joinSameNameAcrossFeeds: true
  };
  const brand = o.brand || '';
  const displayName = name => {
    let n = String(name || '').replace(/\s{2,}/g, ' ').trim();
    if (brand && n.toLowerCase().startsWith(brand.toLowerCase() + ' - ')) n = n.slice(brand.length + 3).trim();
    return n;
  };
  function classify({ name, feedCategory = '' }) {
    const n = displayName(name);
    if (!n) return { reject: 'no name' };
    const p = homePlaceEu({ name, feedCategory, lang: o.language, brand });
    if (p.reject) return { reject: p.reject };
    return { site: 'hgw', siteCategory: p.siteCategory, subcategory: p.subcategory, name: n, ...(p.doubt ? { doubt: true } : {}) };
  }
  return { RULES, SHOP_URL: o.shopUrl, LANGUAGE: o.language, field: daisyconPageField(o.shopUrl, o.advertiserId), productKey: pageKey, displayName, classify };
}
