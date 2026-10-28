// Buying guides of Construction Gear World (/guides/), approved by the owner on 28 Oct 2026 (Docs "Gear World:
// Οδηγοί αγοράς"). Facts only from the shops' listings, the brands' own pages and the site's own prices: no
// "tested", no scores (lessons L82). Prices and stock are read from the database when the page opens; `prices` is
// what each product cost when the guide was written, so the page can say when something has changed since.
// Whole sentences only, no link inside a sentence, so every language can translate them (lessons L24).

const MAKITA_XGT = 'https://www.makitatools.com/company/press-releases/2019/makita-offers-vision-of-cordless-future-with-expanded-lxt-and-new-xgt';
const DEWALT_FLEXVOLT = 'https://www.dewalt.ie/en-ie/product/dcb546-xj/54v-xr-flexvolt-6ah-battery';

export default [
  {
    slug: 'makita-vs-dewalt',
    title: 'Makita vs DeWalt: which 18V cordless system should you buy?',
    description: 'Makita LXT or DeWalt XR? Twin kits, impact drivers and batteries from both brands compared on what is in the box and price at Tooled Up and My Tool Shed.',
    written: '2026-10-28',
    prices: { 875: 259.95, 29689: 259.95, 1008: 329.95, 33217: 329.95, 856: 79.95, 23577: 79.95, 1603: 99.99, 37527: 99.99, 26479: 49.95, 37328: 59.95 },
    lead: [
      'If you already own 18V batteries from one of the two brands, stay with that brand, because a battery only fits tools from its own brand.',
      'If you are starting from zero, the DeWalt twin kit we compare was £70 cheaper on 28 Oct: the DeWalt DCK266P2 is £259.95 and the Makita DLX2180TJ is £329.95. Both are a brushless combi drill and impact driver with two 5 Ah batteries, a charger and a case.'
    ],
    howWeChose: 'We have not tested these tools, and we do not score them. We picked three like-for-like pairs from the Makita and DeWalt tools sold by Tooled Up and My Tool Shed: a twin kit, an impact driver without battery, and a spare battery. We compared them on facts the shops list (what is in the box, voltage, battery size, torque where listed) and on price. Every product was in stock when we checked.',
    blocks: [
      {
        type: 'table',
        heading: 'The difference at a glance',
        head: ['', { text: 'Makita', keep: true }, { text: 'DeWalt', keep: true }],
        rows: [
          ['18V range', 'LXT', 'XR'],
          ['Batteries fit', 'Makita 18V LXT tools', 'DeWalt 18V XR tools'],
          ['Higher-voltage range',
            { text: '40V Max XGT, a separate system with its own batteries and chargers', source: { name: 'Makita', url: MAKITA_XGT } },
            { text: '54V FLEXVOLT; DeWalt says its FLEXVOLT batteries also fit 18V XR tools', source: { name: 'DeWalt', url: DEWALT_FLEXVOLT } }],
          ['Twin kit, 2 × 5 Ah', { lowest: [1008, 33217] }, { lowest: [875, 29689] }],
          ['Impact driver, no battery', { lowest: [1603, 37527] }, { lowest: [856, 23577] }],
          ['Spare 18V battery', { lowest: [37328], text: '(5 Ah)' }, { lowest: [26479], text: '(4 Ah)' }]
        ]
      },
      {
        type: 'offers',
        heading: 'The six products we picked',
        columns: ['Product', 'Type', 'Specs (as the shop lists them)'],
        shops: ['My Tool Shed', 'Tooled Up'],
        rows: [
          { name: 'DeWalt DCK266P2 Twin Kit', cells: ['Twin kit', '18 V XR; brushless combi drill + impact driver; 2 × 5 Ah, charger, ToughSystem case'], offers: { 'My Tool Shed': 29689, 'Tooled Up': 875 } },
          { name: 'Makita DLX2180TJ Twin Kit', cells: ['Twin kit', '18 V LXT; brushless combi drill + impact driver; 2 × 5 Ah, charger, case'], offers: { 'My Tool Shed': 33217, 'Tooled Up': 1008 } },
          { name: 'DeWalt DCF887 Impact Driver', cells: ['Impact driver, no battery', '18 V XR; brushless; 205 Nm'], offers: { 'My Tool Shed': 23577, 'Tooled Up': 856 } },
          { name: 'Makita DTD157 Impact Driver', cells: ['Impact driver, no battery', '18 V LXT; brushless; 140 Nm; 3,000 rpm'], offers: { 'My Tool Shed': 37527, 'Tooled Up': 1603 } },
          { name: 'DeWalt DCB182 Battery', cells: ['Battery', '18 V XR; 4 Ah; Li-ion'], offers: { 'My Tool Shed': 26479 } },
          { name: 'Makita BL1850B Battery', cells: ['Battery', '18 V LXT; 5 Ah; Li-ion'], offers: { 'My Tool Shed': 37328 } }
        ],
        notes: ['An empty cell means that shop does not sell the product in the stores we compare.']
      },
      {
        type: 'picks',
        heading: 'Twin kits',
        items: [
          {
            name: 'DeWalt DCK266P2 18V XR Brushless Combi Drill and Impact Driver Kit', ids: [875, 29689],
            pros: '£70 less than the Makita kit with the same contents; two brushless tools, two 5 Ah batteries, a charger and a ToughSystem case; the same price at both shops.',
            cons: 'the shops do not list torque, speed or weight for the two tools in this kit.',
            forWho: 'anyone starting a cordless set from zero who wants a drill and a driver.',
            skip: 'anyone who already owns Makita LXT batteries.'
          },
          {
            name: 'Makita DLX2180TJ 18V LXT Brushless Combi Drill and Impact Driver Kit', ids: [1008, 33217],
            pros: 'two brushless tools, two 5 Ah batteries, a charger and a case; the same price at both shops; the batteries also fit the Makita impact driver and battery below.',
            cons: '£70 more than the DeWalt kit; the shops do not list torque, speed or weight for the two tools.',
            forWho: 'anyone who has chosen the Makita LXT range, or already has LXT tools.',
            skip: 'anyone starting from zero who wants the lowest price for a twin kit.'
          }
        ]
      },
      {
        type: 'picks',
        heading: 'Impact drivers, no battery',
        start: 3,
        items: [
          {
            name: 'DeWalt DCF887 18V XR Brushless Impact Driver', ids: [856, 23577],
            pros: 'the lowest price of the six; 205 Nm listed, the higher of the two drivers; the same price at both shops.',
            cons: 'no battery, no charger and no case.',
            forWho: 'owners of DeWalt 18V XR or FLEXVOLT batteries.',
            skip: 'anyone with no DeWalt batteries (the twin kit is the cheaper way in).'
          },
          {
            name: 'Makita DTD157 18V LXT Brushless Impact Driver', ids: [1603, 37527],
            pros: 'brushless; 3,000 rpm and 140 Nm listed; the same price at both shops.',
            cons: '£20 more than the DCF887, with lower listed torque (140 Nm against 205 Nm); no battery, no charger and no case.',
            forWho: 'owners of Makita 18V LXT batteries.',
            skip: 'anyone with no Makita batteries.'
          }
        ]
      },
      {
        type: 'picks',
        heading: 'Spare batteries',
        start: 5,
        items: [
          {
            name: 'DeWalt DCB182 18V XR 4 Ah Battery', ids: [26479],
            pros: '£10 less than the Makita battery; fits DeWalt 18V XR tools.',
            cons: '4 Ah, 1 Ah less than the Makita battery; about £12.49 per Ah against about £11.99; one shop only (My Tool Shed), so there is no second price to compare.',
            forWho: 'a second battery for a DeWalt 18V XR kit.',
            skip: 'anyone who wants the longest run time per battery.'
          },
          {
            name: 'Makita BL1850B 18V LXT 5 Ah Battery', ids: [37328],
            pros: '5 Ah, the bigger of the two batteries; the lower price per Ah (about £11.99); fits Makita 18V LXT tools.',
            cons: '£10 more than the DeWalt battery; one shop only (My Tool Shed).',
            forWho: 'a second battery for a Makita LXT kit.',
            skip: 'DeWalt owners; it does not fit their tools.'
          }
        ]
      },
      {
        type: 'text',
        heading: 'Same product, different shops',
        paragraphs: [
          'The four tools above are sold by both My Tool Shed and Tooled Up, with the same barcode, and on 28 Oct the two shops showed the same price for all four. The two batteries are sold by My Tool Shed only. Delivery costs can change the total, so check the final price at checkout.'
        ]
      }
    ]
  }
];
