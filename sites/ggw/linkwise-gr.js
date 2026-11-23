// Linkwise shops on this site (Greece and Cyprus, owner 19 Nov 2026, lessons L199), each seen only where it delivers and
// only by visitors there, with its Greek names (deliversTo.languages "el", lessons L165). The programme number is in the
// comment; its import rules are tools/import-rules/lw-<programme>.mjs. Each name is one value in the queries of the views
// that hide it (D1 allows 100 per query, lessons L193): tests/worker/linkwise-l199.test.mjs keeps every view under 600 (L202: the names are quoted text in the SQL).
const retailers = {
  'Uncle George GR': ['GR', 'CY'], // 14032
};
export const LINKWISE_GR = {
  retailers,
  languages: Object.fromEntries(Object.keys(retailers).map(n => [n, 'el']))
};
