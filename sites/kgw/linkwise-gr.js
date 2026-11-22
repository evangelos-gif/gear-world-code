// Linkwise shops on this site (Greece and Cyprus, owner 19 Nov 2026, lessons L199), each seen only where it delivers and
// only by visitors there, with its Greek names (deliversTo.languages "el", lessons L165). The programme number is in the
// comment; its import rules are tools/import-rules/lw-<programme>.mjs. Each name is one value in the queries of the views
// that hide it (D1 allows 100 per query, lessons L193): tests/worker/linkwise-l199.test.mjs keeps every view under 62.
const retailers = {
  'Agnotis GR': ['GR', 'CY'], // 11562
  'Answear GR': ['GR'], // 13797
  'Babykid GR': ['GR'], // 11036
  'Bla Bla Toys GR': ['GR'], // 13506
  'Camper GR': ['GR'], // 14114
  'Cilek GR': ['GR'], // 408
  'Dpam GR': ['GR', 'CY'], // 11949
  'Eleftheriou Online GR': ['GR'], // 11834
  'Energiers GR': ['GR'], // 11764
  'epapoutsia.gr GR': ['GR'], // 13604
  'Kiriakos Gofas Jewelry GR': ['GR', 'CY'], // 12401
  'Kosmima24 GR': ['GR'], // 10600
  'lulumelon GR': ['GR', 'CY'], // 13622
  'Mamouth GR': ['GR'], // 13779
  'Micro Scooters GR': ['GR'], // 13298
  'Minipini GR': ['GR'], // 14123
  'Modivo GR': ['GR'], // 13607
  'Moustakas Toys GR': ['GR'], // 10784
  'Notos GR': ['GR'], // 12471
  'NstNastasia GR': ['GR'], // 12023
  'Pitsiriki GR': ['GR'], // 12345
  'Politikos GR': ['GR', 'CY'], // 13649
  'Serafino Shoes GR': ['GR', 'CY'], // 13255
  'SimpleWear GR': ['GR'], // 11890
  'So and Jos GR': ['GR', 'CY'], // 14137
  'Spartoo GR': ['GR', 'CY'], // 399
  'Superpanes GR': ['GR'], // 12056
  'Toys.gr GR': ['GR'], // 11307
  'Z-mall GR': ['GR'], // 100
};
export const LINKWISE_GR = {
  retailers,
  languages: Object.fromEntries(Object.keys(retailers).map(n => [n, 'el']))
};
