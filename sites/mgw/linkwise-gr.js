// Linkwise shops on this site (Greece and Cyprus, owner 19 Nov 2026, lessons L199), each seen only where it delivers and
// only by visitors there, with its Greek names (deliversTo.languages "el", lessons L165). The programme number is in the
// comment; its import rules are tools/import-rules/lw-<programme>.mjs. Each name is one value in the queries of the views
// that hide it (D1 allows 100 per query, lessons L193): tests/worker/linkwise-l199.test.mjs keeps every view under 62.
const retailers = {
  'Abadianakis GR': ['GR', 'CY'], // 12858
  'Answear GR': ['GR'], // 13797
  'BIGBLU GR': ['GR', 'CY'], // 13637
  'Blooza GR': ['GR'], // 11427
  'Camper GR': ['GR'], // 14114
  'CasualShoes GR': ['GR'], // 11565
  'Central GR': ['GR', 'CY'], // 13628
  'Classico GR': ['GR'], // 11757
  'Clodist GR': ['GR'], // 12338
  'epapoutsia.gr GR': ['GR'], // 13604
  'Gounas GR': ['GR', 'CY'], // 14088
  'Gruppo Mossialos GR': ['GR', 'CY'], // 13808
  'Hionidis GR': ['GR', 'CY'], // 12903
  'John-Andy GR': ['GR'], // 293
  'Kiriakos Gofas Jewelry GR': ['GR', 'CY'], // 12401
  'Kosmima24 GR': ['GR'], // 10600
  'Koutsoubidis GR': ['GR', 'CY'], // 13812
  'Markakis GR': ['GR'], // 12261
  'Modivo GR': ['GR'], // 13607
  'New Cult GR': ['GR'], // 11667
  'Notino GR': ['GR'], // 14094
  'Notos GR': ['GR'], // 12471
  'Parex GR': ['GR', 'CY'], // 12575
  'Politikos GR': ['GR', 'CY'], // 13649
  'Prince Oliver GR': ['GR', 'CY'], // 10553
  'Projectshops GR': ['GR', 'CY'], // 12954
  'Silenzio GR': ['GR', 'CY'], // 13625
  'SimpleWear GR': ['GR'], // 11890
  'Spartoo GR': ['GR', 'CY'], // 399
  'TOBROS GR': ['GR'], // 13700
  'Tsakiris Mallas GR': ['GR', 'CY'], // 11641
  'VARDA GR': ['GR', 'CY'], // 13974
  'Wizzy GR': ['GR', 'CY'], // 13631
  'XXXL Leo GR': ['GR'], // 14043
  'Z-mall GR': ['GR'], // 100
};
export const LINKWISE_GR = {
  retailers,
  languages: Object.fromEntries(Object.keys(retailers).map(n => [n, 'el']))
};
