// Retailers whose affiliate terms forbid alerts on their products (lessons L204).
// bol.com Partnerprogramma (site ID 1559450): "stock alerts worden niet toegelaten", prices refreshed every day, and every
// product removable at once when the partnership ends. So a bol.com product never gets a stock alert, a price alert, a
// price-drop or back-in-stock notice, or "Remind me" (lessons L182), on a product page, a card, the Hub or in an email,
// and it is never written to the price history of Price Watch (sites/prices/price-log.js, D1 gear-world-prices).
// A product is a bol.com product by its retailer name OR by its link (the partner link of bol.com), so a row with another
// spelling of the name (database.retailerNames of the older sites) is still caught.
export const NO_ALERT_RETAILERS = Object.freeze(['bol.com']);
export const BOL_PARTNER_PREFIX = 'https://partner.bol.com/';

const lower = v => String(v ?? '').trim().toLowerCase();

// True for a product (or a retailer name and link) that must never get an alert, a reminder or a price history.
export function noAlerts(retailerOrProduct, link = '') {
  const p = retailerOrProduct && typeof retailerOrProduct === 'object' ? retailerOrProduct : null;
  const name = p ? p.retailer : retailerOrProduct;
  const url = p ? (p.affiliate_url || p.link || '') : link;
  return NO_ALERT_RETAILERS.some(n => lower(n) === lower(name)) || String(url || '').startsWith(BOL_PARTNER_PREFIX);
}

// The product key of Price Watch (price_last.pkey, price_log.pkey) of a bol.com product:
//  - older sites: "<retailer>:<merchant product id>", the retailer as the database has it ("bol.com:8710..." or any
//    other spelling given in `names`);
//  - newer sites: the stable key "<shop number>:<id>". bol.com's shop number is networkShopId('bol', <bol category>,
//    <country>) of tools/tgw-import-plan.mjs: always "-4" and 11 more digits (code 4, never an Awin advertiser, CJ (-1),
//    Daisycon (-2) or Rakuten (-3)).
export const BOL_STABLE_KEY = /^-4\d{11}:/;
export function bolPriceKey(pkey, legacy, names = NO_ALERT_RETAILERS) {
  const k = String(pkey ?? '');
  if (legacy) return names.some(n => k.toLowerCase().startsWith(`${lower(n)}:`));
  return BOL_STABLE_KEY.test(k);
}

// SQL that keeps bol.com rows out of a SELECT on a site's products (Price Watch): no bound value, fixed text only.
export function noAlertsSql(alias = '') {
  const a = alias ? `${alias}.` : '';
  const names = NO_ALERT_RETAILERS.map(n => `'${n.replace(/'/g, "''")}'`).join(', ');
  return `+${a}retailer NOT IN (${names}) AND substr(COALESCE(${a}affiliate_url, ''), 1, ${BOL_PARTNER_PREFIX.length}) <> '${BOL_PARTNER_PREFIX}'`;
}
