// The 13 Gear World sites whose prices the private Worker gear-world-prices logs every day (lessons L100), in the
// order of the Hub home page (promos/network.js). binding: the read-only D1 binding in sites/prices/wrangler.jsonc.example;
// database: the site's own D1 database (as in sites/<code>/wrangler.jsonc.example); legacy: the older database layout
// (sites/<code>/site.config.js, database.layout). tests/worker/prices.test.mjs checks this list against those files.
export const PRICE_SITES = [
  { code: 'cgw', binding: 'DB_CGW', database: 'construction-gear-customers', legacy: true },
  { code: 'mgw', binding: 'DB_MGW', database: 'mens-gear-world', legacy: true },
  { code: 'wgw', binding: 'DB_WGW', database: 'womens-gear-world', legacy: true },
  { code: 'kgw', binding: 'DB_KGW', database: 'kids-gear-world', legacy: true },
  { code: 'hgw', binding: 'DB_HGW', database: 'home-gear-world', legacy: true },
  { code: 'ggw', binding: 'DB_GGW', database: 'garden-gear-world', legacy: true },
  { code: 'tgw', binding: 'DB_TGW', database: 'technology-gear-world', legacy: false },
  { code: 'agw', binding: 'DB_AGW', database: 'car-gear-world', legacy: false },
  { code: 'vgw', binding: 'DB_VGW', database: 'travel-gear-world', legacy: false },
  { code: 'sgw', binding: 'DB_SGW', database: 'sporty-gear-world', legacy: false },
  { code: 'bgw', binding: 'DB_BGW', database: 'biker-gear-world', legacy: false },
  { code: 'pgw', binding: 'DB_PGW', database: 'gaming-gear-world', legacy: false },
  { code: 'zgw', binding: 'DB_ZGW', database: 'pets-gear-world', legacy: false }
];
