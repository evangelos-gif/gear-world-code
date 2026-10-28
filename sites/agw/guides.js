// Buying guides of Car Gear World (/guides/), approved by the owner on 28 Oct 2026 (Docs "Gear World: Οδηγοί
// αγοράς"). Facts only from the shops' listings and the site's own prices: no "tested", no scores (lessons L82).
// Prices and stock are read from the database when the page opens; `prices` is what each product cost when the
// guide was written, so the page can say when something has changed since.
// Whole sentences only, no link inside a sentence, so every language can translate them (lessons L24).

export default [
  {
    slug: 'battery-charger-or-jump-starter',
    title: 'Battery charger or jump starter? Which one your car needs this winter',
    description: 'Battery charger or jump starter: what each one does, and six products from Sealey, Draper and AstroAI compared on amps, engine size and price.',
    written: '2026-10-28',
    prices: {
      6391: 26.95, 2965: 26.95, 6500: 37.95, 3074: 37.95, 4948: 39.95, 1522: 39.95,
      8895: 31.99, 6586: 68.95, 3160: 68.95, 6787: 91.95, 3361: 91.95
    },
    lead: [
      'Buy a battery charger if the car is parked near a mains socket and the battery runs down slowly; buy a jump starter if you need to start the car wherever it stops. A charger refills the battery over hours; a jump starter starts the engine in seconds from its own battery, but it does not recharge the car\'s battery. In the shops we compare, smart chargers start at £26.95 and jump starter packs at £31.99.'
    ],
    howWeChose: 'We have not tested these products, and we do not score them. From the 116 battery chargers and 112 jump starters we compare, we picked three of each from known brands, on facts the shops list: amps, battery types and voltage for chargers; peak amps, engine size, weight and size for jump starters; and price. Every product was in stock when we checked.',
    blocks: [
      {
        type: 'table',
        heading: 'The difference at a glance',
        head: ['', 'Battery charger', 'Jump starter'],
        rows: [
          ['What it does', 'Recharges the car battery', 'Starts the engine from its own battery'],
          ['Power it needs', 'A mains socket', 'None at the roadside; the pack is recharged later'],
          ['How long', 'Hours, depending on amps and battery size', 'Seconds for each start'],
          ['Recharges the car battery', 'Yes', 'No'],
          ['Can stay connected', 'The smart chargers below say yes (maintenance mode)', 'No'],
          ['From (our shops)', { lowest: [6391, 2965, 6500, 3074, 4948, 1522] }, { lowest: [8895, 6586, 3160, 6787, 3361] }]
        ]
      },
      {
        type: 'offers',
        heading: 'The six products we picked',
        columns: ['Product', 'Type', 'Specs (as the shop lists them)'],
        shops: ['My Tool Shed', 'Tooled Up', 'Joybuy'],
        rows: [
          { name: 'Sealey 100HF Compact Auto Smart 1amp', cells: ['Charger', '1 A; 6 V and 12 V; lead acid, EFB, AGM/GEL'], offers: { 'My Tool Shed': 6391, 'Tooled Up': 2965 } },
          { name: 'Draper BC14 Smart Charger and Battery Maintainer', cells: ['Charger', '4 A; 6 V and 12 V; lead acid and 12 V lithium; winter mode to −20 °C'], offers: { 'My Tool Shed': 6500, 'Tooled Up': 3074 } },
          { name: 'Sealey SBC6 Battery Charger and Maintainer', cells: ['Charger', '6 A; 12 V only; batteries 40–100 Ah; 1 m cable'], offers: { 'My Tool Shed': 4948, 'Tooled Up': 1522 } },
          { name: 'AstroAI S8 Jump Starter', cells: ['Jump starter', '1,500 A peak; petrol engines up to 6.0 L, diesel up to 3.0 L; 0.43 kg'], offers: { Joybuy: 8895 } },
          { name: 'Sealey RS600 Roadstart Lithium-Ion Jump Starter', cells: ['Jump starter', '600 A peak, 300 A cranking; about 4 L petrol or 2.5 L diesel; 0.36 kg'], offers: { 'My Tool Shed': 6586, 'Tooled Up': 3160 } },
          { name: 'Draper GT1200 Lithium Jump Starter', cells: ['Jump starter', '1,200 A peak, 600 A cranking; petrol up to 6 L, diesel up to 4 L; 489 g'], offers: { 'My Tool Shed': 6787, 'Tooled Up': 3361 } }
        ],
        notes: ['An empty cell means that shop does not sell the product in the stores we compare.']
      },
      {
        type: 'picks',
        heading: 'Battery chargers',
        items: [
          {
            name: 'Sealey 100HF Compact Auto Smart 1amp Battery Charger', ids: [6391, 2965],
            pros: 'the lowest price of the six; the same price at both shops; 6 V and 12 V; lead acid, EFB and AGM/GEL (stop/start) batteries; switches to float mode so it does not overcharge.',
            cons: '1 A, the lowest output here: a flat 60 Ah battery needs roughly 60 hours at 1 A (battery Ah ÷ charger A); no lithium batteries listed.',
            forWho: 'keeping a car, classic or motorbike battery topped up while it is parked for weeks.',
            skip: 'anyone who needs a flat battery recharged overnight.'
          },
          {
            name: 'Draper BC14 Smart Charger and Battery Maintainer', ids: [6500, 3074],
            pros: '4 A, four times the 100HF; 6 V and 12 V lead acid plus 12 V lithium; a winter mode down to −20 °C; a 12 V power-supply mode that keeps radio and computer settings while the battery is out.',
            cons: '£11 more than the 100HF; 2 A less than the SBC6 for £2 less.',
            forWho: 'a garage with different batteries, such as a car, a motorbike and a 12 V lithium battery.',
            skip: 'anyone charging only 12 V car batteries who wants the most amps for the money (see the SBC6).'
          },
          {
            name: 'Sealey SBC6 Battery Charger and Maintainer', ids: [4948, 1522],
            pros: '6 A, the most of the three chargers; 3-stage charging with zero-volt recovery for fully flat batteries; lead acid, GEL, AGM/EFB and leisure batteries; 2-year guarantee.',
            cons: '12 V only, no 6 V; listed for batteries from 40 to 100 Ah; a 1 m cable, so the charger has to sit close to the battery.',
            forWho: 'recharging a typical 12 V car battery faster than a 1 A or 4 A charger.',
            skip: 'owners of 6 V batteries, such as some classic cars and motorbikes.'
          }
        ]
      },
      {
        type: 'picks',
        heading: 'Jump starters',
        start: 4,
        items: [
          {
            name: 'AstroAI S8 Jump Starter', ids: [8895],
            pros: 'the lowest-price jump starter here; 1,500 A peak; listed for petrol engines up to 6.0 L and diesel up to 3.0 L; 0.43 kg; also a power bank with two USB outputs and a torch.',
            cons: 'one shop only (Joybuy), so there is no second price to compare; the listing gives peak amps but not cranking amps.',
            forWho: 'a light pack for the glovebox of an average car.',
            skip: 'owners of diesel engines above 3.0 L.'
          },
          {
            name: 'Sealey RS600 Roadstart Lithium-Ion Jump Starter', ids: [6586, 3160],
            pros: 'the lightest and smallest here, 0.36 kg and 85 × 27 × 140 mm; IP66 dust and water rating; 300 A cranking listed; a USB outlet and a torch.',
            cons: '600 A peak, the lowest here; listed for an average 4 L petrol or 2.5 L diesel engine; £37 more than the AstroAI S8, which lists a higher peak.',
            forWho: 'smaller petrol and diesel cars, kept in the glovebox.',
            skip: 'owners of larger diesels and vans.'
          },
          {
            name: 'Draper GT1200 Lithium Jump Starter, Powerbank and Torch', ids: [6787, 3361],
            pros: '1,200 A peak and 600 A cranking, the highest cranking figure listed here; petrol engines up to 6 L, diesel up to 4 L; a colour LCD that shows the charge.',
            cons: 'the highest price of the six; 489 g and 176 × 83 × 32 mm, heavier and bigger than the RS600.',
            forWho: 'larger cars and light vans with a diesel engine up to 4 L.',
            skip: 'owners of small cars, where the RS600 or S8 is listed for the engine size.'
          }
        ]
      },
      {
        type: 'text',
        heading: 'Same product, different shops',
        paragraphs: [
          'Five of the six products are sold by both My Tool Shed and Tooled Up, with the same barcode, and on 28 Oct the two shops had the same price for all five. The difference can be delivery, so check the final price at checkout.'
        ]
      }
    ]
  }
];
