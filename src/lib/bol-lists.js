// The ONE list of bol.com popular-product lists and searches (Manager 20 Nov 2026, lessons L205), used by both:
//  - the PC download: tools/bol-feed-download.ps1 -Step download -Standard (tools/bol-feed.mjs --standard), and
//  - the private Worker gear-world-bol-refresh (src/bol-refresh.js), which re-reads the same lists every day to refresh
//    price and stock of the bol.com products already on the sites (bol.com's terms, 3.6: prices at least daily).
// A change here changes both. The categories are in the order of the commission, highest first: a product (EAN) in two
// lists counts once, in the first. Each list gives at most BOL_MAX_PER_LIST products (pages of 50).
// tools/bol-feed-download.ps1 reads the names below with a pattern ({ id: '<digits>', name: '<text>' }): keep that form.
import { jobsOf } from './bol-catalog.js';

export const BOL_RETAILER = 'bol.com';
export const BOL_COUNTRY = 'NL';
export const BOL_LANGUAGE = 'nl';
export const BOL_MAX_PER_LIST = 1000;

export const BOL_CATEGORIES = [
  { id: '43646', name: 'Auto & Motor' },
  { id: '11764', name: 'Koken & Tafelen' },
  { id: '12001', name: 'Huishouden' },
  { id: '15270', name: 'Kamperen & Outdoor' },
  { id: '14648', name: 'Sport' },
  { id: '14035', name: 'Wonen' },
  { id: '13155', name: 'Klussen' },
  { id: '12974', name: 'Tuin' },
  { id: '12748', name: 'Dieren' },
  { id: '46673', name: 'Damesmode' },
  { id: '47024', name: 'Herenmode' },
  { id: '16947', name: 'Kindermode' }
];

export const BOL_SEARCHES = ['parfum', 'werkschoenen'];

// The jobs of the standard download / refresh, in this order: the 12 categories, then the 2 searches (no category).
export function standardJobs(country = BOL_COUNTRY) {
  return jobsOf({ categories: BOL_CATEGORIES.map(c => `${c.id}=${c.name}`), searches: BOL_SEARCHES, country });
}
