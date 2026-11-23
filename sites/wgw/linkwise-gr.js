// Linkwise shops on this site (Greece and Cyprus, owner 19 Nov 2026, lessons L199), each seen only where it delivers and
// only by visitors there, with its Greek names (deliversTo.languages "el", lessons L165). The programme number is in the
// comment; its import rules are tools/import-rules/lw-<programme>.mjs. Each name is one value in the queries of the views
// that hide it (D1 allows 100 per query, lessons L193): tests/worker/linkwise-l199.test.mjs keeps every view under 600 (L202: the names are quoted text in the SQL).
const retailers = {
  'Accessoire GR': ['GR'], // 13208
  'ALE GR': ['GR'], // 12723
  'All About Beauty GR': ['GR', 'CY'], // 14151
  'AMMA GR': ['GR', 'CY'], // 13283
  'AmorAmor GR': ['GR'], // 11920
  'Anatomic Footwear GR': ['GR'], // 12606
  'Anna Raxevsky GR': ['GR', 'CY'], // 13306
  'Answear GR': ['GR'], // 13797
  'Aroma City GR': ['GR', 'CY'], // 13527
  'Aroma Oneirou GR': ['GR'], // 13746
  'Asimenio GR': ['GR'], // 12306
  'attrattivo GR': ['GR'], // 12321
  'AVGERINOS GR': ['GR', 'CY'], // 13670
  'AXNARI FASHION GR': ['GR', 'CY'], // 13686
  'Babylon Fashion GR': ['GR'], // 12761
  'Be Queen Pro GR': ['GR'], // 13292
  'BeFashion GR': ['GR'], // 12323
  'Bettinastores GR': ['GR'], // 12549
  'Bionike GR': ['GR', 'CY'], // 14067
  'Camper GR': ['GR'], // 14114
  'Carelife GR': ['GR'], // 13781
  'Celestino GR': ['GR'], // 11593
  'Cherrybox GR': ['GR', 'CY'], // 11676
  'Closet22 GR': ['GR', 'CY'], // 13664
  'COSSELIE GR': ['GR', 'CY'], // 13886
  'Cuoro GR': ['GR', 'CY'], // 13953
  'Dazzle GR': ['GR', 'CY'], // 14174
  'DRESS UP GR': ['GR', 'CY'], // 13752
  'Dust and Cream GR': ['GR'], // 13333
  'e-kellys GR': ['GR', 'CY'], // 13166
  'E-string GR': ['GR', 'CY'], // 11355
  'Eccentrico GR': ['GR', 'CY'], // 13432
  'Eleftheriou Online GR': ['GR'], // 11834
  'EMC Skin Care GR': ['GR'], // 13990
  'Envie Shoes GR': ['GR'], // 11983
  'Enzzo GR': ['GR', 'CY'], // 13962
  'epapoutsia.gr GR': ['GR'], // 13604
  'Filinda GR': ['GR', 'CY'], // 13088
  'Finetsato GR': ['GR'], // 13914
  'Fitrakis Shoes GR': ['GR'], // 13878
  'FunkyBuddha GR': ['GR'], // 12011
  'Galerie de beaute GR': ['GR'], // 12425
  'Gatsas Jewellery GR': ['GR'], // 14085
  'Gerovital GR': ['GR', 'CY'], // 12746
  'Go Glam GR': ['GR', 'CY'], // 13999
  'Gruppo Mossialos GR': ['GR', 'CY'], // 13808
  'Handmade my day GR': ['GR'], // 12115
  'Happy Sizes GR': ['GR'], // 11714
  'Hawkins GR': ['GR', 'CY'], // 13640
  'Hotstyle GR': ['GR'], // 11782
  'Inizio GR': ['GR', 'CY'], // 13189
  'iQueens GR': ['GR'], // 14111
  'Issue Fashion GR': ['GR', 'CY'], // 12695
  'IzyShoes GR': ['GR', 'CY'], // 11442
  'Joanna Misseli GR': ['GR', 'CY'], // 13198
  'Kiriakos Gofas Jewelry GR': ['GR', 'CY'], // 12401
  'Kosmima24 GR': ['GR'], // 10600
  'Kostis Jewellery GR': ['GR', 'CY'], // 12653
  'KYANA GR': ['GR'], // 13331
  'L ADIOPIS GR': ['GR', 'CY'], // 13910
  'La Redoute GR': ['GR', 'CY'], // 23
  'Letif GR': ['GR'], // 10818
  'Lingerie Center GR': ['GR', 'CY'], // 381
  'Living Cruelty Free GR': ['GR', 'CY'], // 13361
  'LYmola GR': ['GR', 'CY'], // 12987
  'Marie Raxevsky GR': ['GR', 'CY'], // 13535
  'mat fashion GR': ['GR', 'CY'], // 11999
  'Migato GR': ['GR', 'CY'], // 12802
  'Modivo GR': ['GR'], // 13607
  'Morena Spain GR': ['GR', 'CY'], // 13613
  'Mustshoes GR': ['GR'], // 435
  'Myaroma.gr GR': ['GR'], // 13100
  'Natural Click GR': ['GR', 'CY'], // 13240
  'Notino GR': ['GR'], // 14094
  'Notos GR': ['GR'], // 12471
  'Off The Peg by Global Influence GR': ['GR'], // 14161
  'Onlineshoes.gr GR': ['GR', 'CY'], // 13002
  'Orogenio GR': ['GR', 'CY'], // 13371
  'Parabita GR': ['GR'], // 164
  'Paraxenies GR': ['GR'], // 438
  'PELION Natural Luxury GR': ['GR', 'CY'], // 14035
  'Perfect Dress GR': ['GR'], // 12137
  'Pharm24 GR': ['GR'], // 11388
  'Pharmacy Onlineshop GR': ['GR'], // 11609
  'PieDini GR': ['GR'], // 13083
  'Pinguino GR': ['GR'], // 13365
  'Pink Woman GR': ['GR'], // 11708
  'Politikos GR': ['GR', 'CY'], // 13649
  'Potrefashion GR': ['GR', 'CY'], // 12573
  'Projectshops GR': ['GR', 'CY'], // 12954
  'Pure Natural GR': ['GR'], // 13695
  'Quickgel GR': ['GR', 'CY'], // 13210
  'Rodanos GR': ['GR'], // 14135
  'Sante Shoes GR': ['GR'], // 12972
  'SimpleWear GR': ['GR'], // 11890
  'Sou GR': ['GR'], // 13274
  'Spartoo GR': ['GR', 'CY'], // 399
  'Stan and Stefan GR': ['GR', 'CY'], // 13758
  'Stradivarius GR': ['GR'], // 13754
  'Tataropoulos GR': ['GR'], // 13659
  'The Body Shop GR': ['GR'], // 11742
  'The Fashion Project GR': ['GR', 'CY'], // 13012
  'Theodoras Jewellery GR': ['GR'], // 10483
  'Theros Jewels GR': ['GR', 'CY'], // 13513
  'ToRouxo.gr GR': ['GR'], // 11432
  'Tsakiris Mallas GR': ['GR', 'CY'], // 11641
  'TWIG GR': ['GR'], // 14021
  'Tzimas Cosmetics GR': ['GR', 'CY'], // 13136
  'Vamp Lingerie GR': ['GR', 'CY'], // 13728
  'Verorama GR': ['GR'], // 11815
  'W7 Makeup GR': ['GR', 'CY'], // 14076
  'YOUTH LAB. GR': ['GR', 'CY'], // 11537
  'Z-mall GR': ['GR'], // 100
  'ZABOO.GR GR': ['GR'], // 13794
  'Zebras and Libras GR': ['GR', 'CY'], // 14041
  'Zeta Curves GR': ['GR', 'CY'], // 13562
  'Zizel GR': ['GR', 'CY'], // 361
  'Zoniou GR': ['GR'], // 12844
};
export const LINKWISE_GR = {
  retailers,
  languages: Object.fromEntries(Object.keys(retailers).map(n => [n, 'el']))
};
