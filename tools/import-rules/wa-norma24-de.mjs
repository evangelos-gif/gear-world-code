// Import rules for NORMA24 DE (Awin advertiser 30917) — Priority A of «Λείπουν 25-11» (row 74), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: 19,467 rows of a German marketplace: furniture and home, garden, DIY, household, sport, food, pets, clothes, toys. Only its folders "Möbel & Einrichtung", "Haushalt" and "Beleuchtung"; at most 200 cards a subcategory.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEuShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEuShop({
  key: 'wa-norma24-de', advertiserId: 30917, retailer: 'NORMA24 DE', language: 'de',
  shop: shopOf('norma24.de'),
  minPrice: 5, maxPrice: 1500, maxPerSubcategory: 200,
  notPath: /Garten|Baumarkt|Lebensmittel|Haustier|Bekleidung|Sport|E-Mobilit|Spielwaren|Elektronik|Drogerie|Kategorie_alt/i,
  notPathWhy: 'a folder of the marketplace that is not home (garden, DIY, food, pets, clothes, toys, sport, electronics)',
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
