// Linkwise shops on this site (Greece and Cyprus, owner 19 Nov 2026, lessons L199), each seen only where it delivers and
// only by visitors there, with its Greek names (deliversTo.languages "el", lessons L165). The programme number is in the
// comment; its import rules are tools/import-rules/lw-<programme>.mjs. Each name is one value in the queries of the views
// that hide it (D1 allows 100 per query, lessons L193): tests/worker/linkwise-l199.test.mjs keeps every view under 62.
const retailers = {
  'AmorAmor GR': ['GR'], // 11920
  'Anna Raxevsky GR': ['GR', 'CY'], // 13306
  'Answear GR': ['GR'], // 13797
  'Aroma Oneirou GR': ['GR'], // 13746
  'Camper GR': ['GR'], // 14114
  'Celestino GR': ['GR'], // 11593
  'DRESS UP GR': ['GR', 'CY'], // 13752
  'Eleftheriou Online GR': ['GR'], // 11834
  'epapoutsia.gr GR': ['GR'], // 13604
  'Galerie de beaute GR': ['GR'], // 12425
  'Gruppo Mossialos GR': ['GR', 'CY'], // 13808
  'iQueens GR': ['GR'], // 14111
  'Kiriakos Gofas Jewelry GR': ['GR', 'CY'], // 12401
  'Kosmima24 GR': ['GR'], // 10600
  'La Redoute GR': ['GR', 'CY'], // 23
  'Modivo GR': ['GR'], // 13607
  'Notino GR': ['GR'], // 14094
  'Notos GR': ['GR'], // 12471
  'Orogenio GR': ['GR', 'CY'], // 13371
  'Pharm24 GR': ['GR'], // 11388
  'Pharmacy Onlineshop GR': ['GR'], // 11609
  'Politikos GR': ['GR', 'CY'], // 13649
  'Projectshops GR': ['GR', 'CY'], // 12954
  'SimpleWear GR': ['GR'], // 11890
  'Spartoo GR': ['GR', 'CY'], // 399
  'Stan and Stefan GR': ['GR', 'CY'], // 13758
  'The Fashion Project GR': ['GR', 'CY'], // 13012
  'Tsakiris Mallas GR': ['GR', 'CY'], // 11641
  'Verorama GR': ['GR'], // 11815
  'Z-mall GR': ['GR'], // 100
  'Zizel GR': ['GR', 'CY'], // 361
  'Zoniou GR': ['GR'], // 12844
};
export const LINKWISE_GR = {
  retailers,
  languages: Object.fromEntries(Object.keys(retailers).map(n => [n, 'el']))
};
