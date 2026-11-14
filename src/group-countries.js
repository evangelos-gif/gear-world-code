// Where the group page shows countries (lessons L130): every country the sites' deliversTo can name (src/lib/delivery.js),
// by continent. A retailer that delivers worldwide counts in every country, and also on the "worldwide" line.
// In a file of its own so tools/group-map-build.mjs reads it without the map it builds (src/group-map.js, lessons L152).
export const CONTINENTS = [
  ['Europe', ['GB', 'IE', 'FR', 'DE', 'AT', 'CH', 'NL', 'BE', 'LU', 'IT', 'ES', 'PT', 'GR', 'CY', 'MT', 'PL', 'CZ', 'SK', 'HU',
    'RO', 'BG', 'HR', 'SI', 'AL', 'DK', 'SE', 'NO', 'FI', 'IS', 'LI', 'EE', 'LV', 'LT']],
  ['North America', ['US', 'CA', 'MX']],
  ['Asia', ['JP']],
  ['Oceania', ['AU', 'NZ']]
];
export const COUNTRY_CODES = CONTINENTS.flatMap(([, list]) => list);
