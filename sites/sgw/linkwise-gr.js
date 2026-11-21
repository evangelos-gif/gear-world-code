// Linkwise shops on Sporty Gear World (Greece and Cyprus, chat 7 and the owner 21 Nov 2026, lessons L209), each seen only
// where it delivers and only by visitors there, with its Greek names (deliversTo.languages "el", lessons L165). The
// programme number is in the comment; the shop is in sources.json ("network": "linkwise", "sections": "linkwise-gr") and
// placed by tools/import-rules/lib/linkwise-sections.mjs. The countries are those of tools/import-rules/lib/linkwise-programmes.mjs.
const retailers = {
  'Athlos Sport GR': ['GR', 'CY'], // 13806
  'Carpe Diem GR': ['GR'], // 13712
  'e-tennis GR': ['GR', 'CY'], // 13202
  'EMW GR': ['GR'], // 13905
  'Kalousos GR': ['GR'], // 13911
  'Mandellos Sports GR': ['GR', 'CY'], // 12687
  'Mybrand.shoes GR': ['GR'], // 11706
  'Proteinstar GR': ['GR'], // 13222
  'Rundome GR': ['GR'], // 13926
  'Siontis Athletics GR': ['GR', 'CY'], // 13884
  'Slamdunk GR': ['GR', 'CY'], // 13324
  'SportsPoint GR': ['GR', 'CY'], // 12194
  'The Lady GR': ['GR', 'CY'], // 12516
  'Vactive GR': ['GR'], // 13276
  'Vasiliki World GR': ['GR', 'CY'], // 14070
};
export const LINKWISE_GR = {
  retailers,
  languages: Object.fromEntries(Object.keys(retailers).map(n => [n, 'el']))
};
