// Buying guides of Women's Gear World (/guides/), approved by the owner on 28 Oct 2026 (Docs "Gear World: Οδηγοί
// αγοράς"). Facts only from the shops' listings and the site's own prices: no "tested", no scores (lessons L82).
// Prices, stock and price per ml are read from the database when the page opens; `prices` is what each product cost
// when the guide was written, so the page can say when something has changed since.
// Whole sentences only, no link inside a sentence, so every language can translate them (lessons L24).
// Lessons L107 (9 Nov 2026): the words never quote a price, a difference in price or a price per ml; those come only
// from the database, in the tables and cards, so they are never out of date.

export default [
  {
    slug: 'perfume-gift-sets-under-30',
    title: 'Best perfume gift sets for her',
    description: 'Six perfume gift sets compared on what is in the box, eau de parfum or eau de toilette, and price per ml at Bazta, Plusshop and Joybuy.',
    written: '2026-10-28',
    prices: {
      35672: 8.88, 31309: 8.88, 35388: 10.85, 33516: 11.35, 34224: 13.99, 33119: 14.99,
      34983: 14.59, 31794: 15.35, 35074: 28.99, 31827: 31.99, 28505: 29.0
    },
    lead: [
      'The table below works out the price per ml of each set from today\'s lowest price. If you would rather give one named bottle, look at the Ghost Sweetheart 30 ml Eau de Parfum gift set.'
    ],
    howWeChose: 'We have not tested or smelled these sets, and we do not score them. We picked six fragrance gift sets from the women\'s products we compare, on three facts: a known fragrance brand, what the set contains as the shop lists it (bottle size, number of bottles, eau de parfum or eau de toilette), and price, including price per ml where the sizes are listed. Every set was in stock when we checked. Three of the six are from Lattafa.',
    blocks: [
      {
        type: 'offers',
        heading: 'Compare the six sets',
        columns: ['Gift set', 'In the box (as the shop lists it)', 'Type', 'Price per ml'],
        shops: ['Bazta', 'Plusshop', 'Joybuy'],
        perUnit: 'ml',
        rows: [
          { name: 'Ted Baker Woman Gift Box', cells: ['10 ml perfume + 50 ml body wash', 'Eau de toilette'], units: 10, offers: { Bazta: 35672, Plusshop: 31309 } },
          { name: 'Baylis & Harding Royale Garden Fragrance Discovery Set', cells: ['5 × 15 ml (75 ml)', 'Not listed'], units: 75, offers: { Bazta: 35388, Plusshop: 33516 } },
          { name: 'Lattafa Pride Eau de Parfum Discovery Mini Gift Set', cells: ['5 × 20 ml (100 ml)', 'Eau de parfum'], units: 100, offers: { Bazta: 34224, Plusshop: 33119 } },
          { name: 'Lattafa Yara Collection Discovery Eau de Parfum Set', cells: ['4 × 5 ml (20 ml)', 'Eau de parfum'], units: 20, offers: { Bazta: 34983, Plusshop: 31794 } },
          { name: 'Lattafa Yara & Yara Candy Anniversary Gift Set', cells: ['2 × 100 ml (200 ml)', 'Not listed'], units: 200, offers: { Bazta: 35074, Plusshop: 31827 } },
          { name: 'Ghost Sweetheart Eau de Parfum 30ml Gift Set', cells: ['30 ml perfume, other items not listed', 'Eau de parfum'], units: 30, offers: { Joybuy: 28505 } }
        ],
        notes: [
          'Price per ml uses the lowest price and the perfume only (not body wash).',
          'An empty cell means that shop does not sell the set in the stores we compare.'
        ]
      },
      {
        type: 'picks',
        heading: 'The six sets, one by one',
        items: [
          {
            name: 'Ted Baker Woman Gift Box', ids: [35672, 31309],
            pros: 'a 50 ml body wash in the box as well.',
            cons: 'the perfume is a 10 ml bottle, the smallest single bottle here; it is eau de toilette, a lower concentration than eau de parfum.',
            forWho: 'a stocking filler or small extra.',
            skip: 'anyone looking for a full-size bottle.'
          },
          {
            name: 'Baylis & Harding Royale Garden Fragrance Discovery Set', ids: [35388, 33516],
            pros: '75 ml in total, in five 15 ml bottles.',
            cons: 'the listing does not say if the bottles are eau de parfum, eau de toilette or body mist; it names one range (Rose, Poppy & Vanilla) but not the five scents.',
            forWho: 'someone who likes several small bottles to try or share.',
            skip: 'anyone who wants an eau de parfum.'
          },
          {
            name: 'Lattafa Pride Eau de Parfum Discovery Mini Gift Set', ids: [34224, 33119],
            pros: '100 ml of eau de parfum in five 20 ml bottles.',
            cons: 'the listing does not name the five fragrances; a second set with the same name has a different barcode, so check which one you are buying.',
            forWho: 'someone who wants to try several fragrances.',
            skip: 'anyone buying for one favourite scent.'
          },
          {
            name: 'Lattafa Yara Collection Discovery Eau de Parfum Set', ids: [34983, 31794],
            pros: 'four eau de parfums from the Yara line; 5 ml bottles are travel size.',
            cons: '20 ml in total; the listing does not name the four.',
            forWho: 'someone who wants to try the Yara line before a full bottle.',
            skip: 'anyone looking for a full-size bottle.'
          },
          {
            name: 'Lattafa Yara & Yara Candy Anniversary Gift Set', ids: [35074, 31827],
            pros: 'two 100 ml bottles, 200 ml in total, the most perfume in this guide.',
            cons: 'the listing does not say eau de parfum or eau de toilette.',
            forWho: 'two full-size bottles in one gift.',
            skip: 'anyone who wants a small bottle or a set with body products.'
          },
          {
            name: 'Ghost Sweetheart Eau de Parfum 30ml Gift Set', ids: [28505],
            pros: 'one 30 ml eau de parfum from Ghost; in stock at Joybuy.',
            cons: 'one shop only, so there is no second price to compare; the listing does not say what else is in the gift set.',
            forWho: 'someone who would rather give one named bottle.',
            skip: 'anyone who wants several fragrances to try.'
          }
        ]
      },
      {
        type: 'text',
        heading: 'Same set, different shops',
        paragraphs: [
          'Five of the six sets are sold by both Bazta and Plusshop, with the same barcode, so the table shows the price at each shop. Delivery costs can change the total, so check the final price at checkout.'
        ]
      }
    ]
  }
];
