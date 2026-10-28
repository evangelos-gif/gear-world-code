// Buying guides of Women's Gear World (/guides/), approved by the owner on 28 Oct 2026 (Docs "Gear World: Οδηγοί
// αγοράς"). Facts only from the shops' listings and the site's own prices: no "tested", no scores (lessons L82).
// Prices, stock and price per ml are read from the database when the page opens; `prices` is what each product cost
// when the guide was written, so the page can say when something has changed since.
// Whole sentences only, no link inside a sentence, so every language can translate them (lessons L24).

export default [
  {
    slug: 'perfume-gift-sets-under-30',
    title: 'Best perfume gift sets for her under £30',
    description: 'Six perfume gift sets under £30 compared on what is in the box, eau de parfum or eau de toilette, and price per ml at Bazta, Plusshop and Joybuy.',
    written: '2026-10-28',
    prices: {
      35672: 8.88, 31309: 8.88, 35388: 10.85, 33516: 11.35, 34224: 13.99, 33119: 14.99,
      34983: 14.59, 31794: 15.35, 35074: 28.99, 31827: 31.99, 28505: 29.0
    },
    lead: [
      'The lowest price per ml among the perfume gift sets under £30 we compare is the Lattafa Pride Eau de Parfum Discovery Mini Gift Set: five 20 ml bottles for £13.99, about 14p per ml. If you would rather give one named bottle, the Ghost Sweetheart 30 ml Eau de Parfum gift set is £29.00.'
    ],
    howWeChose: 'We have not tested or smelled these sets, and we do not score them. We picked six fragrance gift sets from the women\'s products we compare, on three facts: a known fragrance brand, what the set contains as the shop lists it (bottle size, number of bottles, eau de parfum or eau de toilette), and price, including price per ml where the sizes are listed. Every set was in stock when we checked. Three of the six are from Lattafa, the brand with the most fragrance gift sets under £30 in the shops we compare.',
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
            pros: 'the lowest price in this guide; the same price at Bazta and Plusshop; a 50 ml body wash in the box as well.',
            cons: 'the perfume is a 10 ml bottle, the smallest single bottle here; it is eau de toilette, a lower concentration than eau de parfum; 89p per ml.',
            forWho: 'a stocking filler or small extra under £10.',
            skip: 'anyone looking for a full-size bottle.'
          },
          {
            name: 'Baylis & Harding Royale Garden Fragrance Discovery Set', ids: [35388, 33516],
            pros: '75 ml in total, in five 15 ml bottles; 14.5p per ml; under £12 at both shops.',
            cons: 'the listing does not say if the bottles are eau de parfum, eau de toilette or body mist; it names one range (Rose, Poppy & Vanilla) but not the five scents.',
            forWho: 'someone who likes several small bottles to try or share.',
            skip: 'anyone who wants an eau de parfum.'
          },
          {
            name: 'Lattafa Pride Eau de Parfum Discovery Mini Gift Set', ids: [34224, 33119],
            pros: 'the lowest price per ml in this guide (14.0p); 100 ml of eau de parfum in five 20 ml bottles; £1 less at Bazta than at Plusshop.',
            cons: 'the listing does not name the five fragrances; a second set with the same name and a different barcode costs £14.99 at Bazta and £15.99 at Plusshop, so check which one you are buying.',
            forWho: 'someone who wants to try several fragrances.',
            skip: 'anyone buying for one favourite scent.'
          },
          {
            name: 'Lattafa Yara Collection Discovery Eau de Parfum Set', ids: [34983, 31794],
            pros: 'four eau de parfums from the Yara line; 5 ml bottles are travel size.',
            cons: '20 ml in total, 73p per ml, about five times the price per ml of set 3; the listing does not name the four.',
            forWho: 'someone who wants to try the Yara line before a full bottle.',
            skip: 'anyone who wants the most perfume for the money (set 3 has 100 ml for less).'
          },
          {
            name: 'Lattafa Yara & Yara Candy Anniversary Gift Set', ids: [35074, 31827],
            pros: 'two 100 ml bottles, 200 ml in total, the most perfume in this guide; 14.5p per ml.',
            cons: '£31.99 at Plusshop, over this guide\'s £30 budget, so only Bazta is under £30; the listing does not say eau de parfum or eau de toilette.',
            forWho: 'two full-size bottles in one gift.',
            skip: 'anyone who wants a small bottle or a set with body products.'
          },
          {
            name: 'Ghost Sweetheart Eau de Parfum 30ml Gift Set', ids: [28505],
            pros: 'one 30 ml eau de parfum from Ghost; in stock at Joybuy.',
            cons: '97p per ml, the highest in this guide; one shop only, so there is no second price to compare; the listing does not say what else is in the gift set.',
            forWho: 'one named bottle at the top of the budget.',
            skip: 'anyone who wants the most ml for the money.'
          }
        ]
      },
      {
        type: 'text',
        heading: 'Same set, different shops',
        paragraphs: [
          'Five of the six sets are sold by both Bazta and Plusshop, with the same barcode, and Bazta was cheaper or the same for all five. The biggest gap is the Yara & Yara Candy set: £28.99 at Bazta and £31.99 at Plusshop, a £3 difference. Delivery costs can change the total, so check the final price at checkout.'
        ]
      }
    ]
  }
];
