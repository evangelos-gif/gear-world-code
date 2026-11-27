// Priority A of the sheet «Λείπουν 25-11» on the six older sites (CGW GGW HGW KGW MGW WGW), chat 3, 27 Nov 2026 (lessons
// L234, L237): the shared parts of the rules files tools/import-rules/wa-*.mjs. One rules file per shop, its retailer name
// exactly the name of its delivery line in sites/_shared/wave-a.js (the cards show it, the line decides where it is seen).
// Feeds read on 27 Nov 2026 (downloads of 24-27 Nov).
//
// - The subcategories are the ones the site already has (L56, read from each site's database on 27 Nov 2026). Where the
//   site has none for a kind of product, a new one in the site's style: on HGW "Refrigerator", "Cooker", "Cooker Hood",
//   "Dishwasher" (Home Appliances), "Bathroom Furniture", "Shower", "Tap" (Bedding & Bath); on MGW "Eyeglasses" (as WGW);
//   on GGW "Wildlife cameras". The dry run lists them under ΠΡΟΣΟΧΗ (L56) and they are expected.
// - HGW: home products only. Garden and patio products, pets, toys, clothes, food, parts, filters, protection plans and
//   gift cards stay out (Garden Gear World and the other sites have their own shops for them).
// - No sale words on a card (L107): "FINAL SALE", "Sale", "Clearance" are cut from the names.
import { homePlace, homeName, notHome, headOf, trimTail, OUTDOOR } from './hgw-home.mjs';
import { daisyconPageField } from './daisycon-home.mjs';
import { pageKey } from './daisycon-shop.mjs';
import { homePlaceEu } from './home-eu.mjs';
import { W, clean, audience, shoeSub, menClothSub, womenClothSub, CHARACTER, TESTER } from './wave3-legacy.mjs';

export { clean, audience, shoeSub, menClothSub, womenClothSub, CHARACTER, TESTER, W };

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The shop's own pages: https and one of its hosts (www. optional).
export const shopOf = (...hosts) => new RegExp(`^https?://(www\\.)?(?:${hosts.map(esc).join('|')})/`, 'i');

// L107: no sale words on a card.
export function noSale(name) {
  return clean(name).replace(/\s*[-–|,(]*\s*\b(?:final\s+sale|on\s+sale|sale|clearance)\b\s*\)?\s*$/i, '').replace(/\s{2,}/g, ' ').trim();
}

// Not a product to list on any site.
export const SERVICE = W(['gift ?cards?', 'e-?gift', 'gift wrap(?:ping)?', 'protection plans?', 'order protection', 'package protection', 'shipping protection',
  'warranty', 'warranties', 'insurance', 'shipping', 'personali[sz]ation', 'upsell', 'test product', 'donation', 'support for ukraine', 'gutscheine?',
  'cadeaubon', 'cadeaukaart', 'versicherung', 'versand']);
// Spare parts and consumables of an appliance: not a home product of the site.
export const PART = W(['replacement', 'spare', 'spares', 'parts?', 'inner pot', 'rubber packing', 'gasket', 'filters?', 'pre-filter', 'filter screen',
  'collecting plates?', 'wire frame', 'adapter', 'adaptor', 'ersatzteil', 'ersatzfilter', 'filter', 'original-adapter', 'entkalkungspads']);

// ---------------------------------------------------------------------------------------------------------------- HGW
const HA = 'Home Appliances', KD = 'Kitchen & Dining', BB = 'Bedding & Bath', LI = 'Lighting', HD = 'Home Decor', FU = 'Furniture';
const ST = 'Storage & Organisation', CL = 'Cleaning & Laundry';
// English names: these words are read before lib/hgw-home.mjs (which does not place appliances or kitchenware).
const HGW_FIRST = [
  // Kitchen words that name an appliance they go with ("Oven Mitts", "Microwave Safe Plates", "Appliance Cleaners").
  [KD, 'Cookware', W(['dutch ovens?', 'toaster oven pans?'])],
  [KD, 'Table Linen', W(['oven mitts?', 'oven gloves?', 'pot holders?', 'oven mitt & pot holder sets?'])],
  [KD, 'Kitchen Utensil', W(['oven rack grabbers?', 'rack grabbers?'])],
  [KD, 'Tableware', W(['microwave safe plates?'])],
  [CL, 'Cleaning Products', W(['appliance cleaners?', 'washer cleaners?', 'dishwasher cleaners?', 'cooktop cleaners?'])],
  // Appliances (Maytag, Whirlpool, CUCKOO, Airdog). "Hair dryer" is not a tumble dryer.
  [HA, 'Refrigerator', W(['refrigerators?', 'fridges?(?! magnets?)', 'freezers?', 'wine coolers?', 'wine cent(?:er|re)s?', 'beverage cent(?:er|re)s?', 'ice makers?'])],
  [HA, 'Dishwasher', W(['dishwashers?'])],
  [HA, 'Cooker Hood', W(['range hoods?', 'cooker hoods?', 'vent hoods?', 'hood vents?', 'hood liners?', '(?:under-cabinet|wall-mount|wall mount|island|chimney|convertible|insert) hoods?'])],
  [HA, 'Microwave', W(['microwaves?', 'microwave ovens?'])],
  [HA, 'Washing Machine', W(['(?<!wall )washers?', 'washing machines?', 'washer/dryer', 'laundry centers?'])],
  [HA, 'Tumble Dryer', W(['(?<!hair )dryers?'])],
  [HA, 'Cooker', W(['ranges?', 'cooktops?', 'wall ovens?', 'ovens?', 'stoves?', 'induction hobs?', 'hobs?'])],
  [HA, 'Air Purifier', W(['air purifiers?', 'air cleaners?'])],
  [HA, 'Dehumidifier', W(['dehumidifiers?'])],
  [HA, 'Small Appliances', W(['humidifiers?', 'rice cookers?', 'pressure cookers?', 'multi[- ]?cookers?', 'slow cookers?', 'dehydrators?', 'water purifiers?',
    'water dispensers?', 'hot water dispensers?', 'trash compactors?', 'food scales?', 'kitchen scales?', 'sous vide', 'yogurt makers?', 'bread makers?'])],
  [HA, 'Air Fryer', W(['air fryers?', 'air fryer ovens?'])],
  [HA, 'Blender', W(['blenders?', 'smoothie makers?'])],
  [HA, 'Kettle', W(['kettles?'])],
  [HA, 'Coffee Machine', W(['coffee makers?', 'coffee machines?', 'espresso machines?'])],
  [HA, 'Toaster', W(['toasters?'])],
  [HA, 'Vacuum Cleaner', W(['vacuums?', 'vacuum cleaners?'])],
  [HA, 'Fan', W(['ceiling fans?', 'tower fans?', 'desk fans?', 'pedestal fans?', 'fans?'])],
  [HA, 'Heater', W(['space heaters?', 'heaters?'])],
  // Bath
  [BB, 'Bathroom Furniture', W(['bathroom vanit(?:y|ies)', 'vanity sets?', 'sink vanit(?:y|ies)', 'sink base cabinets?', 'base cabinets?', 'linen cabinets?',
    'vanity with', 'double vanity', 'single vanity', 'vanity top', 'countertops?', 'medicine cabinets?'])],
  [BB, 'Bathroom Accessories', W(['bidets?', 'bidet seats?', 'toilet seats?'])],
  [BB, 'Duvet', W(['down blankets?', 'comforters?', 'down alternative comforters?'])],
  // Lighting words lib/hgw-home.mjs reads as something else
  [LI, 'Wall Light', W(['vanity lights?', 'bath bars?', 'bath vanity lights?', 'wall sconces?'])],
  [FU, 'Dressing Table', W(['vanity desks?', 'makeup vanit(?:y|ies)', 'make up vanit(?:y|ies)', 'vanity tables?', 'dressing vanit(?:y|ies)'])],
  // Kitchenware
  [KD, 'Frying Pan', W(['fry ?pans?', 'frying pans?', 'skillets?', 'griddles?', 'saut[eé] pans?'])],
  [KD, 'Cookware', W(['cookware sets?', 'cookware', 'saucepans?', 'stock ?pots?', 'dutch ovens?', 'casseroles?', 'woks?', 'baking (?:sheets?|pans?|dishes|trays?)', 'roasters?'])],
  [KD, 'Drinkware', W(['mugs?', 'tumblers?', 'travel mugs?', 'water bottles?', 'coffee cups?', 'tea cups?', 'teacups?'])],
  [KD, 'Glassware', W(['wine glass(?:es)?', 'champagne flutes?', 'pint glass(?:es)?', 'shot glass(?:es)?', 'drinking glass(?:es)?', 'glassware'])],
  [KD, 'Tableware', W(['(?:dinner|dessert|appetizer|salad|side|serving) plates?', 'plates?', 'platters?', '(?:cereal|soup|salad|serving|mixing|pasta) bowls?',
    'trivets?', 'coasters?', 'serving trays?', 'cake stands?', 'butter dish(?:es)?'])],
  [KD, 'Table Linen', W(['tablecloths?', 'table cloths?', 'placemats?', 'place mats?', 'napkins?', 'table runners?', 'aprons?', 'tea towels?', 'oven mitts?', 'pot holders?'])],
  [KD, 'Food Storage', W(['snack containers?', 'food containers?', 'storage containers?', 'canisters?', 'food storage', 'jars? with lids?'])],
  [KD, 'Chopping Board', W(['cutting boards?', 'chopping boards?', 'charcuterie boards?', 'cheese boards?'])],
  [KD, 'Kitchen Knives', W(['chef knives', "chef'?s knife", 'knife sets?', 'knife blocks?', 'kitchen knives'])],
  [KD, 'Kitchen Utensil', W(['spatulas?', 'whisks?', 'tongs', 'ladles?', 'utensils?', 'peelers?', 'graters?', 'colanders?', 'strainers?', 'can openers?'])],
  // Decor
  [HD, 'Wall Art', W(['world maps?', 'wall maps?', 'wall signs?', 'metal signs?'])],
  [HD, 'Fireplaces', W(['electric fireplaces?', 'fireplace inserts?', 'bioethanol fireplaces?'])]
];
// After lib/hgw-home.mjs: a word that names a place only when nothing else did.
const HGW_LAST = [
  [HD, 'Fireplaces', W(['fireplaces?'])],
  [ST, 'Storage Unit', W(['kitchen islands?', 'pantry', 'pantries', 'pantry cabinets?', 'kitchen cabinets?', 'kitchen cabinet sets?', 'cupboards?', 'armoires?'])],
  [FU, 'TV Unit', W(['entertainment cent(?:er|re)s?', 'media consoles?'])]
];
const HGW_NOT = W(['pets?(?! pro\\b)', 'dogs?', 'magnets?', 'disposers?', 'garbage disposals?', 'puppy', 'pet dryers?', 'mailbox(?:es)?', 'mail ?box(?:es)?', 'chicken coops?', 'coops?', 'catio', 'cat wheel', 'trailers?', 'awnings?', 'pergolas?', 'canopy', 'canopies',
  'sun shades?', 'roller shades?', 'bollards?', 'path lights?', 'landscape lights?', 'pillar lights?', 'post lights?', 'flood ?lights?', 'deck lights?',
  'well lights?', 'in-ground', 'step lights?', 'commercial', 'coin equipped', 'refurbished', 'led masks?', 'masks?', 'cigar', 'checkbook', 'patches',
  'burp cloths?', 'crib', 'bibs?', 'onesies?', 'leashes', 'collars?', 'massage chairs?', 'game tables?', 'poker', 'golf', 'flags?', 'tents?']);

// { siteCategory, subcategory } or { reject } for an English home product of HGW.
export function hgwPlace(name, feedCategory = '') {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card, protection plan or service' };
  if (PART.test(n)) return { reject: 'spare part, filter or consumable' };
  if (HGW_NOT.test(n) || OUTDOOR.test(n) || /patio|outdoor|garden|lawn|landscape/i.test(String(feedCategory || '').replace(/home\s*(?:&|and)\s*garden/gi, ''))) return { reject: 'garden, outdoor, pet or not a home product of HGW' };
  // The head first ("Kitchen Cabinet Set with Range Hood Opening" is a cabinet), then lib/hgw-home.mjs, then the whole name.
  const head = headOf(trimTail(n));
  for (const [cat, sub, re] of HGW_FIRST) if (re.test(head)) return { siteCategory: cat, subcategory: sub };
  if (notHome(n)) return { reject: 'not a home product' };
  const p = homePlace(n);
  if (p) return p;
  for (const [cat, sub, re] of HGW_FIRST) if (re.test(n)) return { siteCategory: cat, subcategory: sub };
  for (const [cat, sub, re] of HGW_LAST) if (re.test(n)) return { siteCategory: cat, subcategory: sub };
  // The feed's own folder ("Nightstands", "Home & Garden > Lighting > Lamps") as a last word, read like a name.
  const last = String(feedCategory || '').split(/\s*[>|]\s*/).filter(Boolean).pop() || '';
  if (last) {
    for (const [cat, sub, re] of HGW_FIRST) if (re.test(last)) return { siteCategory: cat, subcategory: sub, doubt: true };
    const q = homePlace(last);
    if (q) return { ...q, doubt: true };
  }
  return { reject: 'no home place for this name' };
}
export const hgwName = name => noSale(homeName(clean(name)));

// German and Dutch names: the lib/home-eu.mjs lists plus the compound words of these shops (their LAST part is what it
// is: "Heißluftfritteuse" is an air fryer, "Espressobecher" a cup). Read before lib/home-eu.mjs, on the head of the name.
const END = list => new RegExp('(?:^|[^\\p{L}\\d])[\\p{L}\\d-]*?(?:' + list.join('|') + ')(?=$|[^\\p{L}\\d])', 'iu');
const EU_FIRST = {
  de: [
    [HD, 'Fireplaces', END(['kamin', 'kamine', 'tischkamin', 'elektrokamin', 'wasserdampfkamin', 'ethanolkamin', 'feuerstelle', 'brenner', 'brennkammer', 'kamineinsatz'])],
    [HA, 'Air Fryer', END(['fritteuse', 'heißluftfritteuse', 'heissluftfritteuse'])],
    [HA, 'Kettle', END(['wasserkocher'])],
    [HA, 'Air Purifier', END(['luftreiniger'])],
    [HA, 'Dehumidifier', END(['luftentfeuchter', 'entfeuchter'])],
    [HA, 'Small Appliances', END(['luftbefeuchter', 'dörrautomat', 'dörrgerät', 'reiskocher', 'rice cooker', 'ernährungswaage', 'küchenwaage', 'multikocher', 'schnellkochtopf'])],
    [HA, 'Vacuum Cleaner', END(['staubsauger', 'akku-staubsauger', 'saugroboter'])],
    [HA, 'Fan', END(['ventilator', 'turmventilator', 'deckenventilator'])],
    [HA, 'Heater', END(['heizlüfter', 'heizgerät', 'heizstrahler', 'radiator'])],
    [HA, 'Coffee Machine', END(['kaffeemaschine', 'kaffeevollautomat', 'espressomaschine'])],
    [HA, 'Refrigerator', END(['kühlschrank', 'weinkühlschrank', 'weinklimaschrank'])],
    [KD, 'Bar Accessories', END(['korkenzieher', 'weinpumpe', 'champagnerkühler', 'weinkühler', 'flaschenkühler', 'dekanter', 'karaffe', 'flaschenöffner', 'ausgießer',
      'weinthermometer', 'champagner-fresh', 'flaschenverschluss', 'getränkewanne', 'kühler'])],
    [ST, 'Storage Rack', END(['weinregal', 'weinregale', 'flaschenregal', 'weinregal-würfel'])],
    [ST, 'Shelving Unit', END(['regalmodul', 'regal', 'regale', 'wandregal'])],
    [KD, 'Tableware', END(['eierbecher', 'untersetzer', 'glasuntersetzer', 'teller', 'schale', 'schüssel', 'servierset', 'servierplatte', 'tablett'])],
    [KD, 'Drinkware', END(['tasse', 'tassen', 'becher', 'espressobecher', 'kaffeebecher', 'trinkflasche', 'thermobecher'])],
    [KD, 'Glassware', END(['gläser', 'weinglas', 'trinkglas', 'trinkgläser', 'sektglas'])],
    [KD, 'Food Storage', END(['brotdose', 'vorratsdose', 'frischhaltedeckel', 'deckel', 'dose', 'dosen', 'lunchbox', 'frischhaltefolie'])],
    [KD, 'Frying Pan', END(['pfanne', 'bratpfanne', 'grillpfanne'])],
    [KD, 'Cookware', END(['topf', 'kochtopf', 'überkochschutz', 'dampfgarer', 'auflaufform', 'backform', 'backblech'])],
    [KD, 'Kitchen Utensil', END(['zange', 'gourmetzange', 'grillzange', 'wender', 'designwender', 'pfannenwender', 'spatel', 'teigschaber', 'teigkarte', 'schneebesen',
      'kelle', 'schöpfkelle', 'schaumlöffel', 'kochlöffel', 'löffel', 'reibe', 'sieb', 'schäler', 'gewürzmühle', 'mühle', 'trichter', 'pinsel', 'backpinsel',
      'grillset', 'küchenhelfer', 'topflappen', 'ofenhandschuh', 'messbecher', 'flaschenbürsten set', 'utensilienhalter', 'abtropfmatte', 'backmatte'])],
    [CL, 'Cleaning Brush', END(['bürste', 'bürsten', 'flaschenbürste', 'spülbürste'])],
    [CL, 'Cloths & Sponges', END(['mikrofasertuch', 'putztuch', 'putztücher', 'spültuch', 'reinigungstuch', 'schwamm', 'schwämme'])],
    [CL, 'Cleaning Products', END(['reiniger', 'reinigungs-set', 'reinigungsset', 'geruchstop', 'geruchsstop', 'geruchskiller', 'geruchsneutralisierer', 'entkalker',
      'profipflege', 'pflegemittel', 'aktivschaum-reiniger', 'abflussreiniger', 'konzentrat', 'mischflasche', 'sprühflasche', 'spülmittel', 'waschmittel', 'weichspüler'])],
    [BB, 'Bed Sheet', END(['betttuch', 'betttücher', 'spannbetttuch', 'spannbetttücher', 'bettlaken', 'spannbettlaken', 'laken'])],
    [BB, 'Bed Linen', END(['bettwäsche', 'bettbezug', 'bettbezüge', 'bettgarnitur'])],
    [BB, 'Pillow', END(['kissenbezug', 'kissenbezüge', 'kopfkissenbezug'])],
    [HD, 'Rug', END(['fussmatte', 'fußmatte', 'fussmatten', 'fußmatten', 'schmutzfangmatte', 'antirutschmatte', 'teppich', 'türmatte'])],
    [HD, 'Wall Art', END(['blechschild', 'wandschild', 'poster', 'wandbild', 'leinwandbild'])],
    [HD, 'Artificial Plants', END(['kunstpflanze', 'kunstpflanzen', 'kunstbaum', 'kunstblume', 'kunstblumen', 'palme', 'zweig', 'zweige', 'ranke', 'girlande',
      'bougainvillea', 'goldregenbaum', 'busch', 'gras', 'gräser', 'beerenkranz', 'kranz'])],
    [HD, 'Party Decorations', END(['halloween', 'kürbis'])],
    [LI, 'Lighting Accessories', END(['zubehör', 'aufbauprofil', 'einbauprofil', 'profil', 'abdeckung', 'einbauring', 'einbauringe', 'netzteil', 'trafo',
      'transformator', 'dimmer', 'controller', 'steckverbinder', 'verbinder', 'endkappe', 'endkappen', 'diffusor', 'cover', 'schiene', 'stromschiene', 'adapter'])],
    [LI, 'Light Bulb', END(['leuchtmittel', 'led-lampe', 'glühbirne', 'birne', 'retrofit', 'led-röhre', 'röhre'])],
    [LI, 'Ceiling Light', END(['einbauleuchte', 'einbauleuchten', 'downlight', 'deckenaufbauleuchte', 'deckenleuchte', 'panel', 'led-panel', 'spot', 'strahler',
      'led-stripe', 'led-stripes', 'led stripe', 'lichtband'])]
  ],
  nl: [
    [HD, 'Fireplaces', END(['haard', 'haarden', 'tafelhaard', 'gashaard', 'sfeerhaard', 'wandhaard', 'inbouwhaard', 'bioethanolhaard', 'brander', 'branders',
      'haardinzet', 'vuurschaal', 'room divider'])],
    [BB, 'Bathroom Furniture', END(['badmeubel', 'badkamermeubel', 'onderkast', 'kolomkast', 'hoge kast', 'wastafelonderkast', 'spiegelkast', 'wastafel', 'fontein'])],
    [BB, 'Tap', END(['kraan', 'kranen', 'mengkraan', 'thermostaatkraan', 'wastafelkraan', 'badkraan', 'keukenkraan'])],
    [BB, 'Shower', END(['douche', 'douchebak', 'douchegoot', 'douchewand', 'douchecabine', 'douchedeur', 'hoofddouche', 'regendouche', 'handdouche', 'douchearm',
      'doucheslang', 'glijstangset', 'douchekop', 'inloopdouche', 'douchesysteem', 'opbouwset', 'inbouwset'])],
    [BB, 'Bathroom Accessories', END(['handdouchehouder', 'zeepdispenser', 'zeephouder', 'toiletrolhouder', 'handdoekhouder', 'handdoekrek', 'badgreep', 'planchet',
      'closetborstel', 'toiletborstel', 'haak', 'badkameraccessoires', 'sifon', 'afvoer', 'plug'])],
    [LI, 'Lighting Accessories', END(['dimmer', 'trafo', 'driver', 'connector', 'koppelstuk', 'spanningsrail', 'rail', 'railsysteem', 'voeding', 'afstandsbediening', 'kap'])],
    [LI, 'Light Bulb', END(['led lamp', 'ledlamp', 'lichtbron', 'lichtbronnen', 'gloeilamp', 'filamentlamp', 'led-lampen', 'led strip'])],
    [LI, 'Ceiling Light', END(['plafondlamp', 'plafonnière', 'plafondverlichting', 'railspot', 'spot', 'spots', 'inbouwspot', 'opbouwspot'])],
    [LI, 'Wall Light', END(['wandlamp', 'wandverlichting', 'muurlamp'])],
    [LI, 'Table Lamp', END(['tafellamp', 'bureaulamp', 'leeslamp'])],
    [LI, 'Floor Lamp', END(['vloerlamp', 'staande lamp'])],
    [LI, 'Pendant Light', END(['hanglamp', 'hanglampen', 'pendellamp'])],
    [KD, 'Kitchen Utensil', END(['grillhandschoen', 'ovenwant', 'pannenlap'])]
  ]
};
const EU_NOT = END(['beschermhoes', 'hoes', 'abdeckhaube', 'schutzhülle', 'socken', 'zaubersocken', 'kugelschreiber', 'schlüsselanhänger', 'anhänger', 'grußkarte',
  'buch', 'spielzeug', 'lebensmittel', 'enteiser', 'auto', 'podestverkleidung', 'molton', 'bühnenmolton', 'vorhang mgs', 'bodenstecker', 'sockel', 'kamer', 'woning',
  'appartement', 'huis te huur', 'brieföffner', 'notizbuch', 'magnet', 'tasche', 'rucksack']);
// { siteCategory, subcategory } or { reject } for a German or Dutch product of HGW. `cut` drops the shop's tail ("| Bioethanol-kamin-shop.de").
export function hgwEuPlace({ name, feedCategory = '', lang, brand = '' }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n) || SERVICE.test(feedCategory)) return { reject: 'gift card, voucher or service' };
  if (PART.test(n)) return { reject: 'spare part, filter or consumable' };
  const head = (n.split(/\s*\|\s*|,\s+|\s+[-–]\s+/)[0] || n).trim();
  if (EU_NOT.test(head)) return { reject: 'not a home product of HGW (cover, socks, pens, stage fabric ...)' };
  if (/garten|outdoor|außen|aussen|buiten|tuin(?!\w)/i.test(head)) return { reject: 'garden or outdoor (Garden Gear World)' };
  for (const [cat, sub, re] of EU_FIRST[lang] || []) if (re.test(head)) return { siteCategory: cat, subcategory: sub };
  const p = homePlaceEu({ name: n, feedCategory, lang, brand });
  if (!p.reject) return p;
  // The whole name (not only its head) as a last word: "LEDVANCE Dekorplatte Pendelleuchte E27".
  for (const [cat, sub, re] of EU_FIRST[lang] || []) if (re.test(n)) return { siteCategory: cat, subcategory: sub, doubt: true };
  return p;
}

// ---------------------------------------------------------------------------------------------------------- clothes
const BAGS = W(['bags?', 'handbags?', 'totes?', 'tote bags?', 'clutch(?:es)?', 'purses?', 'pouch(?:es)?', 'crossbody', 'shoulder bags?', 'backpacks?', 'wallets?']);
const SCARF = W(['scarf', 'scarves', 'shawls?', 'pashminas?', 'stoles?', 'snoods?', 'silk wraps?', 'cashmere wraps?', 'travel wraps?', 'pashmina and silk wraps?']);
const HAT = W(['hats?', 'caps?(?! sleeves?)', 'beanies?', 'toques?', 'berets?', 'headbands?', 'snapbacks?']);
const GLOVE = W(['gloves?', 'mittens?']);
const BELT = W(['belts?']);
const SHOE = W(['shoes?', 'sneakers?', 'trainers?', 'boots?', 'booties', 'sandals?', 'heels?', 'pumps', 'mules?', 'loafers?', 'oxfords?', 'derby', 'brogues?',
  'slippers?', 'slides?', 'flats', 'ballerinas?', 'espadrilles?', 'clogs?', 'wedges?', 'stilettos?', 'chukkas?', 'lace[- ]ups?', 'monk straps?', 'slip[- ]ons?',
  'moccasins?', 'kitten heel', 'platforms?']);
const JEWEL = [['Earrings', W(['earrings?', 'studs?', 'hoops?', 'ear cuffs?'])], ['Necklaces', W(['necklaces?', 'pendants?', 'chokers?', 'chains?'])],
  ['Bracelets', W(['bracelets?', 'bangles?', 'cuffs?', 'anklets?'])], ['Rings', W(['rings?'])]];
const UNDER = W(['bras?', 'bralettes?', 'panty', 'panties', 'briefs?', 'thongs?', 'hipsters?', 'boyshorts?', 'bikini panty', 'shapewear', 'cinchers?', 'shapers?',
  'half slips?', 'full slips?', 'camisoles?', 'underwear', 'bodysuits? shaper', 'body shaper', 'shaping', 'boxer briefs?', 'boxers?', 'trunks?', 'undershirts?', 'lingerie', 'garters?']);
const SLEEP = W(['pajamas?', 'pyjamas?', 'sleep shirts?', 'sleepshirts?', 'sleepwear', 'nightgowns?', 'nightshirts?', 'chemises?', 'robes?', 'loungewear', 'lounge sets?',
  'sleep sets?', 'pj sets?']);
const SWIM = W(['swimsuits?', 'bikinis?', 'bikini sets?', 'bikini tops?', 'bikini bottoms?', 'one[- ]piece', 'swimwear', 'swim trunks?', 'tankinis?', 'cover[- ]ups?']);
const SOCK = W(['socks?', 'no shows?', 'crews? socks?', 'hosiery']);
const TIGHT = W(['tights', 'pantyhose', 'stockings?', 'thigh highs?']);
const EXPLICIT = W(['gangbang', 'f\\*?ck\\w*', 'fuck\\w*', 'sh[i*]t', 'porn\\w*', 'sex', 'sexy', 'nsfw', 'nude', 'naked', 'boobs?', 'tits?', 'cock', 'dick',
  'pussy', 'stoner', 'weed', '420', 'cannabis', 'marijuana', 'drugs?', 'satan\\w*', 'kill\\w*', 'bitch\\w*', 'ass', 'booty', 'bdsm', 'fetish', 'harness']);
export const COSTUME = W(['costumes?', 'cosplay', 'halloween', 'roleplay', 'role play', 'nurse', 'cop', 'police', 'military', 'army', 'pirate', 'masks?']);

// Women's Gear World: clothes, shoes, bags and accessories of a women's shop. `text` may add the feed's category.
export function wgwFashion(name, text = '') {
  const n = noSale(name);
  const t = `${n} ${text}`;
  if (SOCK.test(n) && !/sock boots?|socks? sneakers?/i.test(n)) return { siteCategory: 'Clothing', subcategory: 'Socks' };
  if (TIGHT.test(n)) return { siteCategory: 'Clothing', subcategory: 'Tights & Stockings' };
  if (/\bbras?\b|bralettes?|panties|shapewear/i.test(n)) return { siteCategory: 'Clothing', subcategory: 'Underwear' };
  if (SHOE.test(n) || /\bshoes\b/i.test(text)) return { siteCategory: 'Shoes', subcategory: shoeSub(n, 'wgw') };
  if (BAGS.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: /wallets?|purses?/i.test(n) && !/handbag/i.test(n) ? 'Wallets & Purses' : 'Bags' };
  if (SLEEP.test(n)) return { siteCategory: 'Clothing', subcategory: 'Nightwear' };
  if (SWIM.test(n) || /swimwear/i.test(text)) return { siteCategory: 'Clothing', subcategory: 'Clothing' };
  if (UNDER.test(n)) return { siteCategory: 'Clothing', subcategory: 'Underwear' };
  if (TIGHT.test(n)) return { siteCategory: 'Clothing', subcategory: 'Tights & Stockings' };
  if (SOCK.test(n)) return { siteCategory: 'Clothing', subcategory: 'Socks' };
  if (/corsets?|bustiers?|bodysuits?|crop tops?|halter/i.test(n)) return { siteCategory: 'Clothing', subcategory: 'Tops & Blouses' };
  if (/gowns?/i.test(n)) return { siteCategory: 'Clothing', subcategory: 'Dresses' };
  if (/capes?|ponchos?|kimonos?|shrugs?|boleros?/i.test(n)) return { siteCategory: 'Clothing', subcategory: 'Jackets & Coats' };
  const sub = womenClothSub(t, null);
  if (sub) return { siteCategory: 'Clothing', subcategory: sub };
  if (SCARF.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: 'Scarves' };
  if (GLOVE.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: 'Gloves' };
  if (HAT.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: 'Hats' };
  if (BELT.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: 'Belts' };
  for (const [sub2, re] of JEWEL) if (re.test(n)) return { siteCategory: "Women's Jewellery", subcategory: sub2 };
  return null;
}

// Men's Gear World.
export function mgwFashion(name, text = '') {
  const n = noSale(name);
  const t = `${n} ${text}`;
  if (SOCK.test(n) && !/sock boots?|socks? sneakers?/i.test(n)) return { siteCategory: 'Clothing', subcategory: 'Socks' };
  if (/\b(boxer briefs?|boxers?|briefs?|trunks?|undershirts?|underwear)\b/i.test(n)) return { siteCategory: 'Clothing', subcategory: 'Underwear' };
  if (SHOE.test(n) || /\bshoes\b/i.test(text)) return { siteCategory: 'Shoes', subcategory: shoeSub(n, 'mgw') };
  if (/cufflinks?/i.test(n)) return { siteCategory: "Men's Jewellery", subcategory: 'Cufflinks' };
  if (/\bties?\b|bow ?ties?|pocket squares?|neckties?|signature borders?/i.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: 'Ties' };
  if (BAGS.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: /wallets?/i.test(n) ? 'Wallets & Purses' : 'Bags' };
  if (SCARF.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: 'Scarves' };
  if (GLOVE.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: 'Gloves' };
  if (HAT.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: 'Hats' };
  if (BELT.test(n)) return { siteCategory: 'Bags & Accessories', subcategory: 'Belts' };
  if (SOCK.test(n)) return { siteCategory: 'Clothing', subcategory: 'Socks' };
  if (/scrubs?|scrub tops?|scrub pants?/i.test(n)) return { siteCategory: 'Clothing', subcategory: 'Clothing' };
  if (/\b(boxer briefs?|boxers?|briefs?|trunks?|undershirts?|underwear)\b/i.test(n)) return { siteCategory: 'Clothing', subcategory: 'Underwear' };
  const sub = menClothSub(t, null);
  if (sub) return { siteCategory: 'Clothing', subcategory: sub };
  return null;
}

// -------------------------------------------------------------------------------------------------------- rules files
// The RULES object of a shop (the planner reads key, network, advertiserId, retailer, currency, shop, sites, prices).
export function rulesOf(o) {
  const R = { key: o.key, advertiserId: o.advertiserId, retailer: o.retailer, currency: o.currency, shop: o.shop, sites: o.sites,
    minPrice: o.minPrice ?? 5, maxPrice: o.maxPrice ?? 2000, maxPerSubcategory: o.maxPerSubcategory ?? 400 };
  if (o.network) R.network = o.network;
  for (const k of ['commonVariantName', 'joinSameName', 'joinSameNameAcrossFeeds', 'keepQuery', 'pageLink', 'maxPerSubcategoryIn']) if (o[k] !== undefined) R[k] = o[k];
  return Object.freeze(R);
}

// An English HGW shop: rules, card name and place from hgwPlace (opts.before: the shop's own words first).
export function hgwEnShop(o) {
  const RULES = rulesOf({ sites: ['hgw'], ...o });
  const displayName = name => {
    let n = hgwName(name);
    if (o.cut) n = n.replace(o.cut, '').trim();
    return n;
  };
  function classify({ name, feedCategory = '' }) {
    const n = displayName(name);
    if (!n) return { reject: 'no name' };
    if (o.only && !o.only.test(`${n} ${feedCategory}`)) return { reject: o.onlyWhy || 'not what this shop is listed for' };
    for (const [cat, sub, re] of o.before || []) if (re.test(n)) return { site: 'hgw', siteCategory: cat, subcategory: sub, name: n };
    const p = hgwPlace(n, feedCategory);
    if (p.reject) return p;
    return { site: 'hgw', siteCategory: p.siteCategory, subcategory: p.subcategory, name: n, ...(p.doubt ? { doubt: true } : {}) };
  }
  return { RULES, displayName, classify };
}


// The place of a German or Dutch product of one shop: its rejects first, then the shop's own folders (o.pathPlaces:
// [regex of the feed category, category, subcategory]), then hgwEuPlace, then the shop's fallback (o.fallback, a shop that
// sells only one kind of product, listed under CHECK).
function euClassify(o, n, feedCategory) {
  if (!n) return { reject: 'no name' };
  if (o.notPath && o.notPath.test(feedCategory)) return { reject: o.notPathWhy || 'a folder of this shop that is not a home product' };
  if (o.notName && o.notName.test(n)) return { reject: o.notNameWhy || 'not a home product of HGW' };
  const head = (n.split(/\s*\|\s*|,\s+|\s+[-–]\s+/)[0] || n).trim();
  if (SERVICE.test(n) || SERVICE.test(feedCategory)) return { reject: 'gift card, voucher or service' };
  if (PART.test(n)) return { reject: 'spare part, filter or consumable' };
  if (EU_NOT.test(head)) return { reject: 'not a home product of HGW (cover, socks, pens, stage fabric ...)' };
  for (const [re, cat, sub] of o.pathPlaces || []) if (re.test(feedCategory)) return { site: 'hgw', siteCategory: cat, subcategory: sub, name: n };
  if (o.pathOnly) return { reject: o.pathOnlyWhy || 'not in a folder this shop is listed for' };
  const p = hgwEuPlace({ name: n, feedCategory: o.path === false ? '' : feedCategory, lang: o.language, brand: o.brand || '' });
  if (!p.reject) return { site: 'hgw', siteCategory: p.siteCategory, subcategory: p.subcategory, name: n, ...(p.doubt ? { doubt: true } : {}) };
  if (o.fallback && !/garden/.test(p.reject)) return { site: 'hgw', siteCategory: o.fallback[0], subcategory: o.fallback[1], name: n, doubt: true };
  return p;
}

// A German or Dutch HGW shop on Awin (the Daisycon ones use lib/daisycon-home.mjs with hgwEuPlace).
export function hgwEuShop(o) {
  const RULES = rulesOf({ sites: ['hgw'], currency: 'EUR', ...o });
  const displayName = name => {
    let n = noSale(clean(name));
    if (o.cut) n = n.replace(o.cut, '').trim();
    if (o.brand && n.toLowerCase().startsWith(o.brand.toLowerCase() + ' ')) n = n.slice(o.brand.length + 1).trim();
    return n;
  };
  const classify = ({ name, feedCategory = '' }) => euClassify(o, displayName(name), feedCategory);
  return { RULES, displayName, classify };
}

// A German or Dutch HGW shop on Daisycon: the page from the link's "dl" (lib/daisycon-home.mjs), one card per page, the
// place from hgwEuPlace. o.shopUrl: the shop's address (the host of its product photos in the feed, 27 Nov 2026).
export function daisyconEuShop(o) {
  const host = new URL(o.shopUrl).host.replace(/^www\./, '');
  const RULES = rulesOf({ network: 'daisycon', currency: 'EUR', sites: ['hgw'], shop: shopOf(host), joinSameNameAcrossFeeds: true, ...o });
  const displayName = name => {
    let n = noSale(clean(name));
    if (o.cut) n = n.replace(o.cut, '').trim();
    if (o.brand && n.toLowerCase().startsWith(o.brand.toLowerCase() + ' ')) n = n.slice(o.brand.length + 1).trim();
    if (o.brand && n.toLowerCase().startsWith(o.brand.toLowerCase() + ' ')) n = n.slice(o.brand.length + 1).trim();
    return n.replace(/[\s.|]+$/, '').trim();
  };
  const classify = ({ name, feedCategory = '' }) => euClassify(o, displayName(name), feedCategory);
  return { RULES, field: daisyconPageField(o.shopUrl, o.advertiserId), productKey: pageKey, displayName, classify };
}
