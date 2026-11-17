// Import rules for TSAR BOMBA (Awin advertiser 109230 "TSAR BOMBA Watches", tsarbomba.com, US dollars) on Men's Gear
// World and Women's Gear World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 10
// feeds, one per country and language (euros, pesos, francs; German, Italian, Dutch, Portuguese names); only the dollar
// rows (English names, 528 rows) go in, the rest is left out by the currency check. Automatic, skeleton and quartz men's
// watches; a few women's ones go to WGW. Shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'tsarbomba-us',
  advertiserId: 109230,
  retailer: 'TSAR BOMBA',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?tsarbomba\.com\//i,
  sites: ['mgw', 'wgw'],
  maxPrice: 3000,
  minPrice: 50,
  commonVariantName: true
};

export function displayBrand() { return 'TSAR BOMBA'; }

export function classify({ name, awinCategory = '' }) {
  const n = clean(name).replace(/\s*\(Ship(?:s|ped)? from (?:the )?US\)\s*/gi, ' ').trim();
  if (!n) return { reject: 'no name' };
  if (/\b(uhr|herrenuhr|damenuhr|automatik|skelett|orologi\w*|horloge|rel[oó]gio|reloj|montre|herren|heren|uomo|homme|masculino|serie elemental|série)\b/i.test(n)) return { reject: 'name in another language' };
  if (/strap only|band only|bezel only|gift ?card|box only|warranty/i.test(n)) return { reject: 'strap, bezel or service' };
  const card = /tsar bomba/i.test(n) ? n : `TSAR BOMBA ${n}`;
  if (/women/i.test(`${n} ${awinCategory}`)) return { site: 'wgw', siteCategory: 'Watches', subcategory: 'Watches', name: card };
  return { site: 'mgw', siteCategory: 'Watches', subcategory: "Men's Watches", name: card };
}
