// Import rules for Leuchtmittel Verkauf DE (Daisycon programme 21938) — Priority A of «Λείπουν 25-11» (row 65), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 26 Nov 2026: 9,870 rows of lights, LED bulbs, LED strips and their accessories (SLV, ISOLED, LEDVANCE). Outdoor lights stay out (Garden Gear World); at most 300 cards a subcategory.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { daisyconEuShop } from './lib/wave-a.mjs';

const S = daisyconEuShop({
  key: 'wa-leuchtmittel-de', advertiserId: 21938, retailer: 'Leuchtmittel Verkauf DE', language: 'de',
  shopUrl: 'https://www.leuchtmittel-verkauf.de/',
  minPrice: 5, maxPrice: 1500, maxPerSubcategory: 300,
  notPath: /Outdoor/i, notPathWhy: 'outdoor light (Garden Gear World)',
  // A professional shop too: work, emergency, hall and grow lights and lamps of 100 W and more are not home lighting.
  notName: /Arbeitsleuchte|Wannenleuchte|Notlicht|Notleuchte|Hallen|High ?bay|Plantastar|Feuchtraum|Industrie|Leuchtenrahmen|Linearleuchte|Displayleuchte|\b[1-9]\d{2,3}\s?W\b/i,
  notNameWhy: 'professional light (work, emergency, hall, grow or 100 W and more)',
  pathOnly: true, pathOnlyWhy: 'not in a home lighting folder of the shop',
  pathPlaces: [[/Zubehör|Profile|Netzteil|Trafo|Steuerung/i, 'Lighting', 'Lighting Accessories'], [/LED-Lampen|Leuchtmittel|Halogen/i, 'Lighting', 'Light Bulb'],
    [/Pendelleuchten/i, 'Lighting', 'Pendant Light'], [/Tischleuchten/i, 'Lighting', 'Table Lamp'], [/Stehleuchten/i, 'Lighting', 'Floor Lamp'],
    [/Wandleuchten/i, 'Lighting', 'Wall Light'], [/Deckenleuchten|Wand- und Deckenleuchten|Einbauleuchten|Strahler|Spots/i, 'Lighting', 'Ceiling Light'], [/Stripes|Lichterketten/i, 'Lighting', 'Lighting Accessories']],
});
export const RULES = S.RULES;
export const field = S.field;
export const productKey = S.productKey;
export const displayName = S.displayName;
export const classify = S.classify;
