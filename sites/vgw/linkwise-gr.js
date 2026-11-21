// Linkwise shops on Travel Gear World (Greece and Cyprus, chat 7 and the owner 21 Nov 2026, lessons L209), each seen only
// where it delivers and only by visitors there, with its Greek names (deliversTo.languages "el", lessons L165). The
// programme number is in the comment; the shop is in sources.json ("network": "linkwise", "sections": "linkwise-gr") and
// placed by tools/import-rules/lib/linkwise-sections.mjs. The countries are those of tools/import-rules/lib/linkwise-programmes.mjs.
const retailers = {
  'Samsonite GR': ['GR'], // 12705
  'Terra Nation GR': ['GR'], // 12870
};
export const LINKWISE_GR = {
  retailers,
  languages: Object.fromEntries(Object.keys(retailers).map(n => [n, 'el']))
};
