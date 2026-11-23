// Linkwise shops on this site (Greece and Cyprus, owner 19 Nov 2026, lessons L199), each seen only where it delivers and
// only by visitors there, with its Greek names (deliversTo.languages "el", lessons L165). The programme number is in the
// comment; its import rules are tools/import-rules/lw-<programme>.mjs. Each name is one value in the queries of the views
// that hide it (D1 allows 100 per query, lessons L193): tests/worker/linkwise-l199.test.mjs keeps every view under 600 (L202: the names are quoted text in the SQL).
// Home Gear World shows them in Greece only: a Cyprus view would be its 11th page group (the limit is 10).
const retailers = {
  '24home.gr GR': ['GR'], // 11532
  'Agiovlasitishome GR': ['GR'], // 12557
  'Aithrio GR': ['GR'], // 12125
  'alleop GR': ['GR'], // 14091
  'Anesis Home GR': ['GR'], // 12218
  'Carpetlinen GR': ['GR'], // 12621
  'Cozy cotton GR': ['GR'], // 11839
  'Dendron GR': ['GR'], // 14011
  'designdrops GR': ['GR'], // 12180
  'DesignPlus GR': ['GR'], // 14027
  'Donedeals GR': ['GR'], // 10599
  'EasyU GR': ['GR'], // 12311
  'EFDECO GR': ['GR'], // 13815
  'Elektrostore24 GR': ['GR'], // 12504
  'esmarket GR': ['GR'], // 12569
  'EtherealHome GR': ['GR'], // 13195
  'Filinda GR': ['GR'], // 13088
  'Fillit GR': ['GR'], // 14138
  'HouseArt GR': ['GR'], // 12650
  'Inoxdesign GR': ['GR'], // 13908
  'Katoikein GR': ['GR'], // 11892
  'Kouzinika GR': ['GR'], // 12149
  'Laura Ashley GR': ['GR'], // 12420
  'MagicStore GR': ['GR'], // 12315
  'MARIL HOME GR': ['GR'], // 13809
  'Memorybox.gr GR': ['GR'], // 13486
  'Primato GR': ['GR'], // 12237
  'Spitishop GR': ['GR'], // 10814
  'Sticky GR': ['GR'], // 12563
  'UrbanHouse GR': ['GR'], // 11998
  'VidaXL.gr GR': ['GR'], // 14113
  'Vivento GR': ['GR'], // 13193
  'WAT Object GR': ['GR'], // 13584
};
export const LINKWISE_GR = {
  retailers,
  languages: Object.fromEntries(Object.keys(retailers).map(n => [n, 'el']))
};
