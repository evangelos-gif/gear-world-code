// Linkwise shops on Car Gear World (Greece and Cyprus, chat 7 and the owner 21 Nov 2026, lessons L209), each seen only
// where it delivers and only by visitors there, with its Greek names (deliversTo.languages "el", lessons L165). The
// programme number is in the comment; the shop is in sources.json ("network": "linkwise", "sections": "linkwise-gr") and
// placed by tools/import-rules/lib/linkwise-sections.mjs. The countries are those of tools/import-rules/lib/linkwise-programmes.mjs.
const retailers = {
  'Autodoc GR': ['GR'], // 13862
  'Battery Park GR': ['GR'], // 11476
  'DealsShop GR': ['GR'], // 11791
  'SavelTrade GR': ['GR', 'CY'], // 302
  'ZAPS Batteries GR': ['GR', 'CY'], // 14020
};
export const LINKWISE_GR = {
  retailers,
  languages: Object.fromEntries(Object.keys(retailers).map(n => [n, 'el']))
};
