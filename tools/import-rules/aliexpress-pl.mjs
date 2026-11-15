// Import rules for AliExpress PL (Awin advertiser 12044, pl.aliexpress.com) on the six older sites: Women's, Men's,
// Kids', Home, Garden and Construction Gear World. Owner, 15 Nov 2026 (lessons L157): "open Poland" with it, ahead of the
// open-country rule. Feed facts (download of 15 Nov 2026): 22 feeds, 177,104 rows; feed 101519 is the Polish shop
// (163,094 rows in zloty = colours and sizes of 27,921 different products, Polish names, sections such as
// "Dom i ogród , Kuchnia, jadalnia i bar , Naczynia do picia"); the other 21 feeds are the English shop
// (www.aliexpress.com, yuan and dollars) and stay out by their link (not the Polish shop) and currency.
// Delivery: Poland only (sites' deliversTo 'AliExpress PL': ['PL']), so only the Poland view shows it, never the UK view
// or the all view (src/lib/visibility.js localOnlyRetailers).
// The sections of the Technology, Car, Biker, Sporty, Pets and Gaming sites wait for round 2 (their engines read only
// English names today): they are left out here with the site they belong to, so the report shows how many wait.
export const RULES = {
  key: 'aliexpress-pl',
  advertiserId: 12044,
  retailer: 'AliExpress PL',
  currency: 'PLN',
  // Only the Polish shop's product pages: "https://pl.aliexpress.com/item/1005006166388737.html?...".
  shop: /^https:\/\/pl\.aliexpress\.com\/item\/\d+\.html/i,
  sites: ['wgw', 'mgw', 'kgw', 'hgw', 'ggw', 'cgw'],
  // zl 10 is about GBP 2: below that the feed has single buttons, stickers and spare screws.
  maxPrice: 20000,
  minPrice: 10,
  // The link keeps AliExpress's own query (aff_fsk, src): Awin's tracking for this shop needs it.
  keepQuery: true
};

// One card per AliExpress product: the item number of its page (each colour and size is a row of its own).
export function productKey(get) {
  const m = /\/item\/(\d{6,20})\.html/i.exec(get('merchant_deep_link') || '');
  return m ? m[1] : '';
}

// Long marketplace names ("2szt Uniwersalne, przeciwmgielne, przeciwodblaskowe, ... Akcesoria do szyb samochodowych"):
// the card keeps about the first 110 characters, cut at a word.
export function displayName(name) {
  const n = String(name || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
    // Stock notes at the start of a name ("Dostępne w magazynie: ...", "W magazynie FuRyu ..."): the card says that itself.
    .replace(/^(?:autentyczne,\s*)?(?:dostępne (?:w magazynie|od ręki)|w magazynie)[\s:.,–-]*/i, '');
  if (n.length <= 110) return n;
  const cut = n.slice(0, 110);
  const at = cut.lastIndexOf(' ');
  return (at > 60 ? cut.slice(0, at) : cut).replace(/[\s,;:/\-–]+$/, '');
}

export function displayBrand() {
  return 'AliExpress';
}

// Never on the sites, whatever the section: adult products, smoking, weapons, medical and dental.
export const NEVER = /(?<![a-ząćęłńóśźż])(seks[\wąćęłńóśźż]*|sex[\wąćęłńóśźż]*|erotycz[\wąćęłńóśźż]*|wibrator[\wąćęłńóśźż]*|dildo[\wąćęłńóśźż]*|bdsm|fetysz[\wąćęłńóśźż]*|e-?papieros[\wąćęłńóśźż]*|waporyzator[\wąćęłńóśźż]*|fajk[\wąćęłńóśźż]* wodn[\wąćęłńóśźż]*|shisha|kastet[\wąćęłńóśźż]*|kusz[ae]|broń|amunicj[\wąćęłńóśźż]*|kaburs?[\wąćęłńóśźż]*|lekarstw[\wąćęłńóśźż]*|suplement[\wąćęłńóśźż]*|tatuaż[\wąćęłńóśźż]*|soczewk[\wąćęłńóśźż]* kontaktow[\wąćęłńóśźż]*|katan[aye]|miecz[ae]?|maczet[\wąćęłńóśźż]*|sztylet[\wąćęłńóśźż]*|proc[aęy]|polowa[\wąćęłńóśźż]*|myśliwsk[\wąćęłńóśźż]*|nóż (?:składany|taktyczny|bojowy|myśliwski|survival[\wąćęłńóśźż]*)|noże (?:składane|taktyczne|bojowe|myśliwskie))(?![a-ząćęłńóśźż])/i;
// Kids' Gear World: no figures made for adult collectors (bunny-suit and swimsuit girls, "18+", the makers known for them).
const NOT_FOR_KIDS = /(?<![a-z])(bicute|bunn(?:y|ies)|króliczk\w*|bikini|kąpielow\w*|18\+|r-?18|ecchi|hentai|waifu|oppai|nag[aiy]|lingerie|bieliz\w*|bishoujo|dorosł\w*|native|skytube|vertex|alphamax|orchid seed|daiki|insight|b'full|binding|freeing|rocket boy|q-six|hobby sakura|union creative|dakimakur\w*)(?![a-z])/i;
const WOMEN = /damsk|dla kobiet|kobiec|dziewczyn/i;
const MEN = /męsk|mesk|dla mężczyzn|dla mezczyzn|chłopięc/i;

// Anime girl figures and big scale statues (1/4 to 1/8) are collectors' pieces; "dla dziewczynek" (for girls) is not.
const ADULT_STATUE = /anime\s+girl|girl\s+figur|figurk\w* (?:anime )?dziewczyny|dziewczyna anime|statuetk|(?:figurk|figur|statue|model)[^,]{0,40}(?<!\d)1\/[4-8](?!\d)|(?<!\d)1\/[4-8](?!\d)[^,]{0,40}(?:figurk|figur|statue)/i;
const R = (site, siteCategory, subcategory) => ({ site, siteCategory, subcategory });
// Indoor lights: the kind the name says first ("Lampa wisząca LED ..." in "Lampy stojące" is a pendant light), then the
// feed's section.
function indoorLight(p, n) {
  if (/żyrandol/i.test(n)) return R('hgw', 'Lighting', 'Chandelier');
  if (/wisząc/i.test(n)) return R('hgw', 'Lighting', 'Pendant Light');
  if (/kinkiet|ścienn/i.test(n)) return R('hgw', 'Lighting', 'Wall Light');
  if (/plafon|sufitow/i.test(n)) return R('hgw', 'Lighting', 'Ceiling Light');
  if (/stojąc|podłogow/i.test(n)) return R('hgw', 'Lighting', 'Floor Lamp');
  if (/stołow|biurkow|nocn|lampk/i.test(n)) return R('hgw', 'Lighting', 'Table Lamp');
  if (/Wentylatory/i.test(p) || /wentylator/i.test(n)) return R('hgw', 'Home Appliances', 'Fan');
  if (/Lampy wiszące/i.test(p)) return R('hgw', 'Lighting', 'Pendant Light');
  if (/Lampy ścienne/i.test(p)) return R('hgw', 'Lighting', 'Wall Light');
  if (/Żyrandole/i.test(p)) return R('hgw', 'Lighting', 'Chandelier');
  if (/Lampy stojące/i.test(p)) return R('hgw', 'Lighting', 'Floor Lamp');
  if (/Lampy biurkowe|Lampki nocne|Lampy podszafkowe|Oświetlenie do ekranów/i.test(p)) return R('hgw', 'Lighting', 'Table Lamp');
  return R('hgw', 'Lighting', 'Ceiling Light');
}
const LATER = site => ({ reject: `round 2: ${site} (its import engine reads English names only today)` });
const OUT = why => ({ reject: why });

// By the name (Polish words), for sections that mix things.
function byName(n, pairs, fallback) {
  for (const [re, out] of pairs) if (re.test(n)) return out;
  return fallback;
}

const FURNITURE = [
  [/stolik/i, R('hgw', 'Furniture', 'Coffee Table')], [/sofa|kanap/i, R('hgw', 'Furniture', 'Sofa')],
  [/fotel/i, R('hgw', 'Furniture', 'Armchair')], [/krzes[łl]/i, R('hgw', 'Furniture', 'Dining Chair')],
  [/rega[łl]|półk|polk/i, R('hgw', 'Furniture', 'Bookcase')], [/komod/i, R('hgw', 'Furniture', 'Chest Of Drawers')],
  [/szaf(?!k)/i, R('hgw', 'Furniture', 'Wardrobe')], [/szafk/i, R('hgw', 'Furniture', 'Sideboard')],
  [/łóżk|lozk|rama łóżka/i, R('hgw', 'Furniture', 'Bed Frame')], [/materac/i, R('hgw', 'Furniture', 'Mattress')],
  [/hoker|stołek barowy|stolek barowy/i, R('hgw', 'Furniture', 'Bar Stool')], [/toaletk/i, R('hgw', 'Furniture', 'Dressing Table')],
  [/ławk|lawk/i, R('hgw', 'Furniture', 'Bench')], [/podnóż|podnoz|puf/i, R('hgw', 'Furniture', 'Footstool')],
  [/stół|stol /i, R('hgw', 'Furniture', 'Dining Table')]
];
const SMART = [
  [/kamer/i, R('hgw', 'Smart Home', 'Wifi Camera')], [/gniazd/i, R('hgw', 'Smart Home', 'Smart Socket')],
  [/wtycz/i, R('hgw', 'Smart Home', 'Smart Plug')], [/czujnik/i, R('hgw', 'Smart Home', 'Smart Sensor')],
  [/zamek|zamk/i, R('hgw', 'Smart Home', 'Smart Lock')], [/dzwonek|wideodomofon|domofon/i, R('hgw', 'Smart Home', 'Video Doorbell')],
  [/termostat/i, R('hgw', 'Smart Home', 'Smart Thermostat')], [/żarówk|zarowk/i, R('hgw', 'Smart Home', 'Smart Bulb')]
];

// Sections in order: "<first> > <second> > <third>" of merchant_category ("A , B , C" in the feed). First match wins.
const SECTIONS = [
  // Round 2 (the newer engines).
  [/^Motoryzacja/i, () => LATER('Car Gear World')],
  [/^Sprzęty i akcesoria motocyklowe/i, () => LATER('Biker Gear World')],
  [/^(Elektronika użytkowa > Gry)/i, () => LATER('Gaming Gear World')],
  [/^(Elektronika użytkowa|Akcesoria do telefonów|Komputer i biuro|Telefony i telekomunikacja|Podzespoły elektroniczne)/i, () => LATER('Technology Gear World')],
  [/^Sport i rozrywka|^Buty, odzież i akcesoria sportowe/i, () => LATER('Sporty Gear World')],
  [/^Dom i ogród > Produkty dla zwierząt/i, () => LATER('Pets Gear World')],

  // Women's Gear World: jewellery, beauty, accessories, underwear, watches.
  [/^Biżuteria i akcesoria > Tworzenie biżuterii/i, () => OUT('jewellery making supplies')],
  [/^Biżuteria i akcesoria > .* > (Koraliki|Beads|Breloczki)/i, () => OUT('beads and key rings, not jewellery')],
  [/^Biżuteria i akcesoria/i, (p, n) => {
    const men = MEN.test(n) && !WOMEN.test(n);
    if (/Kolczyki/i.test(p)) return men ? R('mgw', "Men's Jewellery", 'Jewellery') : R('wgw', "Women's Jewellery", 'Earrings');
    if (/Naszyjnik|Wisiork|Łańcuch/i.test(p)) return men ? R('mgw', "Men's Jewellery", 'Necklaces') : R('wgw', "Women's Jewellery", 'Necklaces');
    if (/Bransolet/i.test(p)) return men ? R('mgw', "Men's Jewellery", 'Bracelets') : R('wgw', "Women's Jewellery", 'Bracelets');
    if (/Pierścion/i.test(p)) return men ? R('mgw', "Men's Jewellery", 'Jewellery') : R('wgw', "Women's Jewellery", 'Rings');
    return men ? R('mgw', "Men's Jewellery", 'Jewellery') : R('wgw', "Women's Jewellery", 'Jewellery');
  }],
  [/^Uroda i zdrowie > (Zdrowie|Materiały dentystyczne|Higiena jamy ustnej|Tatuaże|Materiały rehabilitacyjne|Masaż|Papier higieniczny)/i, () => OUT('health, dental, tattoo or massage products')],
  [/^Uroda i zdrowie > Makijaż > (Pędzle|Narzędzia)/i, () => R('wgw', 'Beauty & Fragrances', 'Beauty tools')],
  [/^Uroda i zdrowie > Makijaż/i, () => R('wgw', 'Beauty & Fragrances', 'Make-up')],
  [/^Uroda i zdrowie > Zdobienie paznokci/i, () => R('wgw', 'Beauty & Fragrances', 'Nails')],
  [/^Uroda i zdrowie > Pielęgnacja skóry > Olejki eteryczne/i, () => R('hgw', 'Home Decor', 'Home Fragrance')],
  [/^Uroda i zdrowie > Pielęgnacja skóry/i, () => R('wgw', 'Beauty & Fragrances', 'Skincare')],
  [/^Uroda i zdrowie > Pielęgnacja i stylizacja włosów > (Narzędzia|Urządzenia)/i, () => R('wgw', 'Beauty & Fragrances', 'Hair tools')],
  [/^Uroda i zdrowie > Pielęgnacja i stylizacja włosów/i, () => R('wgw', 'Beauty & Fragrances', 'Hair care')],
  [/^Uroda i zdrowie > (Narzędzie do pielęgnacji skóry|Sprzęt kosmetyczny)/i, () => R('wgw', 'Beauty & Fragrances', 'Beauty tools')],
  [/^Uroda i zdrowie > Golenie i depilacja/i, (p, n) => (WOMEN.test(n) ? R('wgw', 'Beauty & Fragrances', 'Hair removal') : R('mgw', 'Grooming & Fragrances', 'Shaving'))],
  [/^Uroda i zdrowie > Kąpiel i Prysznic/i, () => R('wgw', 'Beauty & Fragrances', 'Bath & body')],
  [/^Uroda i zdrowie > Perfumy/i, (p, n) => (MEN.test(n) && !WOMEN.test(n) ? R('mgw', 'Grooming & Fragrances', 'Fragrance') : R('wgw', 'Beauty & Fragrances', 'Fragrance'))],
  [/^Uroda i zdrowie/i, () => OUT('beauty section without a place on Women\'s Gear World')],
  [/^Akcesoria odzieżowe > Okulary i akcesoria > (Okulary przeciwsłoneczne|Modne okulary)/i, (p, n) => (MEN.test(n) && !WOMEN.test(n) ? R('mgw', 'Bags & Accessories', 'Sunglasses') : R('wgw', 'Bags & Accessories', 'Sunglasses'))],
  [/^Akcesoria odzieżowe > Okulary/i, () => OUT('reading glasses, lenses and frames (medical)')],
  [/^Akcesoria odzieżowe > .*/i, (p, n) => (/^maska|maska na twarz|maski/i.test(n) ? OUT('masks') : null)],
  [/^Akcesoria odzieżowe > Czapki/i, (p, n) => (MEN.test(n) && !WOMEN.test(n) ? R('mgw', 'Bags & Accessories', 'Hats') : R('wgw', 'Bags & Accessories', 'Hats'))],
  [/^Akcesoria odzieżowe > Pasy/i, (p, n) => (WOMEN.test(n) ? R('wgw', 'Bags & Accessories', 'Belts') : R('mgw', 'Bags & Accessories', 'Belts'))],
  [/^Akcesoria odzieżowe > Nowe nakrycia głowy/i, () => R('wgw', 'Bags & Accessories', 'Accessories')],
  [/^Akcesoria odzieżowe > (Nowy szalik|Zestawy szalików)/i, () => R('wgw', 'Bags & Accessories', 'Scarves')],
  [/^Akcesoria odzieżowe > Rękawiczki/i, (p, n) => (MEN.test(n) && !WOMEN.test(n) ? R('mgw', 'Bags & Accessories', 'Gloves') : R('wgw', 'Bags & Accessories', 'Gloves'))],
  [/^Akcesoria odzieżowe/i, () => OUT('sewing and fabric supplies, masks')],
  [/^Bielizna > Damska odzież nocna > Seksowna/i, () => OUT('adult nightwear')],
  [/^Bielizna > Damska odzież nocna/i, () => R('wgw', 'Clothing', 'Nightwear')],
  [/^Bielizna > Damskie skarpetki/i, () => R('wgw', 'Clothing', 'Socks')],
  [/^Bielizna > Skarpetki męskie/i, () => R('mgw', 'Clothing', 'Socks')],
  [/^Bielizna > Męska/i, () => R('mgw', 'Clothing', 'Underwear')],
  [/^Bielizna/i, (p, n) => (MEN.test(n) && !WOMEN.test(n) ? R('mgw', 'Clothing', 'Underwear') : R('wgw', 'Clothing', 'Underwear'))],
  [/^Zegarki > Zegarki damskie/i, () => R('wgw', 'Watches', 'Watches')],
  [/^Zegarki > Zegarki dla dzieci/i, () => R('kgw', 'Accessories', 'Kids Watches')],
  [/^Zegarki > Akcesoria do zegarków > (Paski|Pudełka|Łącznik|Koperty)/i, () => R('mgw', 'Bags & Accessories', 'Accessories')],
  [/^Zegarki > Akcesoria/i, () => OUT('watch repair tools, chargers and screen covers')],
  [/^Zegarki/i, (p, n) => (WOMEN.test(n) && !MEN.test(n) ? R('wgw', 'Watches', 'Watches') : R('mgw', 'Watches', "Men's Watches"))],
  [/^Buty > Akcesoria do butów/i, () => OUT('insoles and laces')],
  // Small sections of clothes, shoes and bags: by who they are for.
  [/^Odzież damska/i, () => R('wgw', 'Clothing', 'Clothing')],
  [/^Odzież męska/i, () => R('mgw', 'Clothing', 'Clothing')],
  [/^Buty/i, (p, n) => (MEN.test(n) && !WOMEN.test(n) ? R('mgw', 'Shoes', 'Shoes') : R('wgw', 'Shoes', 'Shoes'))],
  [/^Walizki i torby > .*(Walizk|Bagaż)/i, () => OUT('luggage waits for Travel Gear World (round 2)')],
  [/^Walizki i torby/i, (p, n) => (MEN.test(n) && !WOMEN.test(n) ? R('mgw', 'Bags & Accessories', 'Bags') : R('wgw', 'Bags & Accessories', 'Bags'))],

  // Kids' Gear World: toys, baby, school.
  [/^Zabawki i hobby > (Hobby i kolekcjonerstwo|Towary ACG)/i, () => OUT('collectors\' items and anime goods, not toys')],
  [/^Zabawki i hobby > Figurki/i, () => R('kgw', 'Toys & Games', 'Action & Toy Figures')],
  [/^Zabawki i hobby > Zabawki zdalnie sterowane/i, () => R('kgw', 'Toys & Games', 'Remote Control Cars & Lorries')],
  [/^Zabawki i hobby > Zabawki do budowania/i, () => R('kgw', 'Toys & Games', 'Construction Set Toys')],
  [/^Zabawki i hobby > Modele i pojazdy/i, () => R('kgw', 'Toys & Games', 'Toy Cars')],
  [/^Zabawki i hobby > Pluszaki/i, () => R('kgw', 'Toys & Games', 'Stuffed Animals & Cuddly Toys')],
  [/^Zabawki i hobby > Zabawki antystresowe/i, () => R('kgw', 'Toys & Games', 'Activity Toys')],
  [/^Zabawki i hobby > Zabawy na świeżym powietrzu/i, () => R('kgw', 'Sports & Outdoors', 'Outdoor Games')],
  [/^Zabawki i hobby > Nauka i edukacja/i, () => R('kgw', 'Toys & Games', 'Educational Toys')],
  [/^Zabawki i hobby > Lalki/i, () => R('kgw', 'Toys & Games', 'Dolls')],
  [/^Zabawki i hobby/i, () => R('kgw', 'Toys & Games', 'Toys & Games')],
  [/^Mamy i dzieci > Ciąża/i, () => OUT('pregnancy supplements')],
  [/^Mamy i dzieci > Ubrania/i, () => R('kgw', 'Clothing', 'Clothing')],
  [/^Mamy i dzieci > Akcesoria dla dzieci/i, () => R('kgw', 'Accessories', 'Accessories')],
  [/^Mamy i dzieci > Pielęgnacja/i, () => OUT('baby health care (medical)')],
  [/^Mamy i dzieci > Aktywności/i, () => R('kgw', 'Baby & Toddler', 'Nappy Bags')],
  [/^Mamy i dzieci > Bezpieczeństwo/i, (p, n) => (/dzieci|dziec|niemowl/i.test(n) ? R('kgw', 'Baby & Toddler', 'Baby Safety') : OUT('not a child safety product (garage and car guards)'))],
  [/^Mamy i dzieci > Karmienie/i, () => R('kgw', 'Baby & Toddler', 'Nursing & Feeding')],
  [/^Mamy i dzieci > Sterylizacja/i, () => R('kgw', 'Baby & Toddler', 'Bottle Warmers & Sterilisers')],
  [/^Mamy i dzieci > Wózki/i, () => R('kgw', 'Baby & Toddler', 'Baby Pushchair & Pram Accessories')],
  [/^Mamy i dzieci > Foteliki/i, () => R('kgw', 'Baby & Toddler', 'Baby & Toddler Car Seat Accessories')],
  [/^Mamy i dzieci > Obuwie/i, () => R('kgw', 'Shoes', 'Shoes')],
  [/^Mamy i dzieci/i, () => R('kgw', 'Baby & Toddler', 'Baby & Toddler')],
  [/^Meble > Meble dla dzieci/i, () => R('kgw', 'Bedroom & Home', 'Bedroom & Home')],
  [/^Artykuły biurowe i szkolne > Akcesoria i organizery/i, () => R('hgw', 'Storage & Organisation', 'Drawer Organizer')],
  [/^Artykuły biurowe i szkolne/i, () => R('kgw', 'School & Backpacks', 'Stationery & Art Supplies')],
  [/^Nowości i specjalne zastosowanie/i, () => OUT('costumes and stage wear')],

  // Home Gear World.
  [/^Dom i ogród > Kuchnia, jadalnia i bar > Grill/i, () => R('ggw', 'BBQ & Outdoor Cooking', 'BBQ accessories')],
  [/^Dom i ogród > Kuchnia, jadalnia i bar > (Naczynia do picia|Zestawy do herbaty|Naczynia kuchenne próżniowe)/i, () => R('hgw', 'Kitchen & Dining', 'Drinkware')],
  [/^Dom i ogród > Kuchnia, jadalnia i bar > Noże/i, () => R('hgw', 'Kitchen & Dining', 'Kitchen Knives')],
  [/^Dom i ogród > Kuchnia, jadalnia i bar > (Zastawa|Dekoracje i akcesoria stołowe)/i, () => R('hgw', 'Kitchen & Dining', 'Tableware')],
  [/^Dom i ogród > Kuchnia, jadalnia i bar > (Naczynia do pieczenia|naczynia kuchenne)/i, () => R('hgw', 'Kitchen & Dining', 'Cookware')],
  [/^Dom i ogród > Kuchnia, jadalnia i bar > Akcesoria barowe/i, () => R('hgw', 'Kitchen & Dining', 'Bar Accessories')],
  [/^Dom i ogród > Kuchnia, jadalnia i bar > Domowe warzenie/i, () => OUT('home brewing')],
  [/^Dom i ogród > Kuchnia/i, () => R('hgw', 'Kitchen & Dining', 'Kitchen Utensil')],
  [/^Dom i ogród > Dekoracje do domu > (Kryształowa ziemia|Flagi|Parawany)/i, () => OUT('water beads, flags and room dividers')],
  [/^Dom i ogród > Dekoracje do domu > Zegary/i, () => R('hgw', 'Home Decor', 'Clock')],
  [/^Dom i ogród > Dekoracje do domu > (Naklejki|Sztuka malowania|Folie|Tablice)/i, () => R('hgw', 'Home Decor', 'Wall Art')],
  [/^Dom i ogród > Dekoracje do domu > Lustra/i, () => R('hgw', 'Home Decor', 'Mirror')],
  [/^Dom i ogród > Dekoracje do domu > Wazony/i, () => R('hgw', 'Home Decor', 'Vase')],
  [/^Dom i ogród > Dekoracje do domu > (Świece|Produkcja zapachów)/i, () => R('hgw', 'Home Decor', 'Home Fragrance')],
  [/^Dom i ogród > Dekoracje do domu/i, () => R('hgw', 'Home Decor', 'Ornament')],
  [/^Dom i ogród > Przechowywanie.* > Haki/i, () => R('hgw', 'Storage & Organisation', 'Storage Rack')],
  [/^Dom i ogród > Przechowywanie.* > Przechowywanie odzieży/i, () => R('hgw', 'Storage & Organisation', 'Clothes Rail')],
  [/^Dom i ogród > Przechowywanie/i, () => R('hgw', 'Storage & Organisation', 'Storage Box')],
  [/^Dom i ogród > Tekstylia domowe > (Poduszka|Poszewka na poduszkę)/i, () => R('hgw', 'Home Decor', 'Cushion')],
  [/^Dom i ogród > Tekstylia domowe > (Dywan|Mata)/i, () => R('hgw', 'Home Decor', 'Rug')],
  [/^Dom i ogród > Tekstylia domowe > Zasłony/i, () => R('hgw', 'Home Decor', 'Curtain')],
  [/^Dom i ogród > Tekstylia domowe > (Koc|Narzut|Noszone koce|Pokrowce$)/i, () => R('hgw', 'Home Decor', 'Throw')],
  [/^Dom i ogród > Tekstylia domowe > Obrusy/i, () => R('hgw', 'Kitchen & Dining', 'Table Linen')],
  [/^Dom i ogród > Tekstylia domowe > (Prześcieradła|Zestaw prześcieradeł)/i, () => R('hgw', 'Bedding & Bath', 'Bed Sheet')],
  [/^Dom i ogród > Tekstylia domowe > Ręcznik/i, () => R('hgw', 'Bedding & Bath', 'Towel')],
  [/^Dom i ogród > Tekstylia domowe > Kołdry/i, () => R('hgw', 'Bedding & Bath', 'Duvet')],
  [/^Dom i ogród > Tekstylia domowe > Pokrowce na materace/i, () => R('hgw', 'Bedding & Bath', 'Mattress Protector')],
  [/^Dom i ogród > Tekstylia domowe > (Zestaw pościeli|Poszwa|Zestaw poszewki)/i, () => R('hgw', 'Bedding & Bath', 'Bed Linen')],
  [/^Dom i ogród > Tekstylia domowe > Pokrowce/i, () => R('hgw', 'Home Decor', 'Throw')],
  [/^Dom i ogród > Tekstylia domowe/i, () => OUT('mosquito nets and other textiles')],
  [/^Dom i ogród > Artykuły gospodarstwa domowego > Narzędzia i akcesoria do sprzątania/i, () => R('hgw', 'Cleaning & Laundry', 'Cleaning Brush')],
  [/^Dom i ogród > Artykuły gospodarstwa domowego > Produkty łazienkowe/i, () => R('hgw', 'Bedding & Bath', 'Bathroom Accessories')],
  [/^Dom i ogród > Artykuły gospodarstwa domowego > (Chemikalia|Jednorazowe)/i, () => R('hgw', 'Cleaning & Laundry', 'Cleaning Products')],
  [/^Dom i ogród > Artykuły gospodarstwa domowego > Produkty do prania/i, () => R('hgw', 'Cleaning & Laundry', 'Ironing & Clothes Care')],
  [/^Dom i ogród > Artykuły gospodarstwa domowego > Pokrowce/i, () => R('hgw', 'Storage & Organisation', 'Storage Box')],
  [/^Dom i ogród > Artykuły gospodarstwa domowego/i, () => OUT('lighters, warmers, umbrellas and thermometers')],
  [/^Dom i ogród > Artykuły świąteczne i imprezowe > Boże Narodzenie/i, () => R('hgw', 'Home Decor', 'Christmas')],
  [/^Dom i ogród > Artykuły świąteczne i imprezowe > Sztuczne dekoracje/i, () => R('hgw', 'Home Decor', 'Ornament')],
  [/^Dom i ogród > Artykuły świąteczne/i, () => OUT('party supplies')],
  [/^Dom i ogród > Sztuka, rzemiosło i szycie/i, () => OUT('craft and sewing supplies')],
  [/^Dom i ogród > Artykuły ogrodnicze > Zasłona/i, () => R('ggw', 'Garden Furniture & Outdoor Living', 'Parasols, gazebos & shade')],
  [/^Dom i ogród > Artykuły ogrodnicze > Podlewanie/i, () => R('ggw', 'Watering & Irrigation', 'Irrigation Systems')],
  [/^Dom i ogród > Artykuły ogrodnicze > Wsparcie i pielęgnacja/i, () => R('ggw', 'Plants, Growing & Garden Care', 'Growing')],
  [/^Dom i ogród > Artykuły ogrodnicze > Ogrzewanie i chłodzenie/i, () => R('ggw', 'Garden Furniture & Outdoor Living', 'Fire pits & heaters')],
  [/^Dom i ogród > Artykuły ogrodnicze > Doniczki/i, () => R('ggw', 'Plants, Growing & Garden Care', 'Pots & planters')],
  [/^Dom i ogród > Artykuły ogrodnicze > (Budynki ogrodowe|Kompostowniki)/i, () => R('ggw', 'Garden Buildings, Fencing & Storage', 'Garden storage')],
  [/^Dom i ogród > Artykuły ogrodnicze > Materiały do pielęgnacji krajobrazu/i, () => R('ggw', 'Garden Buildings, Fencing & Storage', 'Decking & landscaping')],
  [/^Dom i ogród > Artykuły ogrodnicze > Szklarnie/i, () => R('ggw', 'Garden Buildings, Fencing & Storage', 'Greenhouses')],
  [/^Dom i ogród > Artykuły ogrodnicze > Artykuły do .*wózków/i, () => R('ggw', 'Garden Tools', 'Wheelbarrows')],
  [/^Dom i ogród > Artykuły ogrodnicze > Ogrodnictwo wewnętrzne/i, () => R('ggw', 'Plants, Growing & Garden Care', 'Hydroponics')],
  [/^Dom i ogród > Artykuły ogrodnicze > Akcesoria do ogrodu/i, () => R('ggw', 'Garden Tools', 'Other Garden Accessories')],
  [/^Dom i ogród > Artykuły ogrodnicze/i, () => OUT('garden ornaments, pest control, bee keeping, letter boxes, hot tubs')],
  [/^Dom i ogród/i, () => OUT('home section without a place on Home Gear World')],
  [/^Światła i oświetlenie > Oświetlenie wewnętrzne/i, (p, n) => indoorLight(p, n)],
  [/^Światła i oświetlenie > (Oświetlenie LED|Żarówki)/i, () => R('hgw', 'Lighting', 'Light Bulb')],
  [/^Światła i oświetlenie > Lampki nocne/i, () => R('hgw', 'Lighting', 'Table Lamp')],
  [/^Światła i oświetlenie > Oświetlenie świąteczne/i, () => R('ggw', 'Outdoor Lighting & Garden Electrical', 'String & festoon lights')],
  [/^Światła i oświetlenie > Oświetlenie zewnętrzne > Lampki choinkowe/i, () => R('ggw', 'Outdoor Lighting & Garden Electrical', 'String & festoon lights')],
  [/^Światła i oświetlenie > Oświetlenie zewnętrzne > Lampy solarne/i, () => R('ggw', 'Outdoor Lighting & Garden Electrical', 'Solar lights')],
  [/^Światła i oświetlenie > Oświetlenie zewnętrzne > (Reflektory|Lampy uliczne|Zewnętrzne LED)/i, () => R('ggw', 'Outdoor Lighting & Garden Electrical', 'Floodlights & security lights')],
  [/^Światła i oświetlenie > Oświetlenie zewnętrzne > (Lampy podziemne|Zewnętrzne lampy podłogowe)/i, () => R('ggw', 'Outdoor Lighting & Garden Electrical', 'Path & spike lights')],
  [/^Światła i oświetlenie > Oświetlenie zewnętrzne > Lampy na komary/i, () => OUT('insect lamps')],
  [/^Światła i oświetlenie > Oświetlenie zewnętrzne/i, () => R('ggw', 'Outdoor Lighting & Garden Electrical', 'Outdoor lights')],
  [/^Światła i oświetlenie > Oświetlenie przenośne/i, () => R('cgw', 'Site Equipment', 'Lighting')],
  [/^Światła i oświetlenie/i, () => OUT('stage, shop and spare lighting parts')],
  [/^Sprzęt AGD > Sprzęt do czyszczenia > Odkurzacze parowe/i, () => R('hgw', 'Cleaning & Laundry', 'Steam Cleaner')],
  [/^Sprzęt AGD > Sprzęt do czyszczenia > Elektryczne mopy/i, () => R('hgw', 'Cleaning & Laundry', 'Mop')],
  [/^Sprzęt AGD > Sprzęt do czyszczenia > Środek/i, () => R('hgw', 'Cleaning & Laundry', 'Cleaning Products')],
  [/^Sprzęt AGD > Sprzęt do czyszczenia > (Odkurz|Robot)/i, () => R('hgw', 'Home Appliances', 'Vacuum Cleaner')],
  [/^Sprzęt AGD > AGD drobne Części zamienne > Części\/materiały eksploatacyjne do odkurzaczy/i, () => R('hgw', 'Cleaning & Laundry', 'Vacuum Accessories')],
  [/^Sprzęt AGD > Urządzenia do pielęgnacji osobistej > Suszarki/i, () => R('wgw', 'Beauty & Fragrances', 'Hair tools')],
  [/^Sprzęt AGD > Urządzenia do pielęgnacji osobistej > Maszynki do strzyżenia/i, () => R('mgw', 'Grooming & Fragrances', 'Trimmers & clippers')],
  [/^Sprzęt AGD > Urządzenia do pielęgnacji osobistej > Elektryczne golarki/i, () => R('mgw', 'Grooming & Fragrances', 'Shaving')],
  [/^Sprzęt AGD > Urządzenia do pielęgnacji osobistej > Depilacja/i, () => R('wgw', 'Beauty & Fragrances', 'Hair removal')],
  [/^Sprzęt AGD > Urządzenia do pielęgnacji osobistej > Dozowniki mydła/i, () => R('hgw', 'Bedding & Bath', 'Bathroom Accessories')],
  [/^Sprzęt AGD > Sprzęt AGD > Frytkownice/i, () => R('hgw', 'Home Appliances', 'Air Fryer')],
  [/^Sprzęt AGD > Sprzęt AGD > Mielarki/i, () => R('hgw', 'Home Appliances', 'Food Processor')],
  [/^Sprzęt AGD > Sprzęt AGD > (Blendery|Miksery|Sokowirówki)/i, () => R('hgw', 'Home Appliances', 'Blender')],
  [/^Sprzęt AGD > Sprzęt AGD > (Ekspres|Młynki do kawy|Spieniacz)/i, () => R('hgw', 'Home Appliances', 'Coffee Machine')],
  [/^Sprzęt AGD > Sprzęt AGD > Czajniki/i, () => R('hgw', 'Home Appliances', 'Kettle')],
  [/^Sprzęt AGD > Sprzęt AGD > Klimatyzatory/i, (p, n) => byName(n, [[/osuszacz/i, R('hgw', 'Home Appliances', 'Dehumidifier')], [/oczyszczacz/i, R('hgw', 'Home Appliances', 'Air Purifier')],
    [/wentylator/i, R('hgw', 'Home Appliances', 'Fan')]], R('hgw', 'Home Appliances', 'Air Conditioner'))],
  [/^Sprzęt AGD/i, () => OUT('heaters, spare parts and other appliances without a place on Home Gear World')],
  [/^Meble > Meble domowe/i, (p, n) => byName(n, FURNITURE, OUT('furniture type not clear from the name'))],
  [/^Meble > Meble biurowe > (Krzesła|Fotele)/i, () => R('hgw', 'Home Office', 'Office Chair')],
  [/^Meble > Meble biurowe/i, () => R('hgw', 'Home Office', 'Computer Desk')],
  [/^Meble > Meble ogrodowe > Stoły/i, () => R('ggw', 'Garden Furniture & Outdoor Living', 'Tables')],
  [/^Meble > Meble ogrodowe > Sofy/i, () => R('ggw', 'Garden Furniture & Outdoor Living', 'Lounge & corner sets')],
  [/^Meble > Meble ogrodowe > (Fotele wiszące|Hamaki)/i, () => R('ggw', 'Garden Furniture & Outdoor Living', 'Hammocks & swing seats')],
  [/^Meble > Meble ogrodowe > Krzesła/i, () => R('ggw', 'Garden Furniture & Outdoor Living', 'Chairs & benches')],
  [/^Meble > Meble ogrodowe > Półki na rośliny/i, () => R('ggw', 'Plants, Growing & Garden Care', 'Pots & planters')],
  [/^Meble > Meble ogrodowe/i, () => R('ggw', 'Garden Furniture & Outdoor Living', 'Garden furniture')],
  [/^Meble/i, () => OUT('furniture legs, frames and shop furniture')],
  [/^Ulepszanie domu > System inteligencji domowej/i, (p, n) => byName(n, SMART, R('hgw', 'Smart Home', 'Smart Home Accessories'))],
  [/^Ulepszanie domu > Wyposażenie łazienkowe/i, () => R('hgw', 'Bedding & Bath', 'Bathroom Accessories')],
  [/^Ulepszanie domu > Ogrzewanie, chłodzenie/i, (p, n) => byName(n, [[/wentylator/i, R('hgw', 'Home Appliances', 'Fan')], [/osuszacz/i, R('hgw', 'Home Appliances', 'Dehumidifier')],
    [/oczyszczacz/i, R('hgw', 'Home Appliances', 'Air Purifier')]], OUT('heating and ventilation parts'))],
  [/^Ulepszanie domu > Wyposażenie kuchenne/i, () => R('cgw', 'Hand Tools', 'Plumbing Tools')],
  [/^Bezpieczeństwo i ochrona > Nadzór wideo/i, () => R('hgw', 'Smart Home', 'Security Camera')],
  [/^Bezpieczeństwo i ochrona > Automatyka dostępu/i, (p, n) => (/dzwonek|domofon/i.test(n) ? R('hgw', 'Smart Home', 'Video Doorbell') : R('hgw', 'Smart Home', 'Smart Lock'))],
  [/^Bezpieczeństwo i ochrona/i, () => R('cgw', 'PPE', 'PPE')],

  // Construction Gear World: tools and building.
  [/^Ulepszanie domu > Wyposażenie elektryczne/i, () => R('cgw', 'Site Equipment', 'Site Equipment')],
  [/^Ulepszanie domu > Hydraulika/i, () => R('cgw', 'Hand Tools', 'Plumbing Tools')],
  [/^Ulepszanie domu > Akcesoria malarskie/i, () => R('cgw', 'Hand Tools', 'Painting & Decorating')],
  [/^Ulepszanie domu/i, () => R('cgw', 'Hand Tools', 'DIY')],
  [/^Narzędzia wspomagające > Narzędzia ogrodowe > Elektryczne narzędzia ogrodowe/i, () => R('ggw', 'Power Garden Tools', 'Outdoor Power Tools')],
  [/^Narzędzia wspomagające > Narzędzia ogrodowe > Narzędzia do czyszczenia/i, () => R('ggw', 'Watering & Irrigation', 'Pressure Sprayers & Accessories')],
  [/^Narzędzia wspomagające > Narzędzia ogrodowe > Elektryczne konewki/i, () => R('ggw', 'Watering & Irrigation', 'Watering Accessories')],
  [/^Narzędzia wspomagające > Narzędzia ogrodowe/i, () => R('ggw', 'Garden Tools', 'Other Garden Accessories')],
  [/^Narzędzia wspomagające > (Kosze|Sprzęt i materiały spawalnicze|Części|Wiertła|Narzędzia ścierne)/i, () => R('cgw', 'Power Tools', 'Power Tools')],
  [/^Narzędzia wspomagające > Opakowania na narzędzia/i, () => R('cgw', 'Site Equipment', 'Storage & Site Containers')],
  [/^Narzędzia wspomagające/i, () => R('cgw', 'Hand Tools', 'Hand Tools')]
];

export function classify({ name, feedCategory = '' }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (NEVER.test(n)) return { reject: 'adult, smoking, weapon or medical product' };
  // " , " (a space on both sides) separates the levels; a comma inside a level has none before it ("Kuchnia, jadalnia i bar").
  const parts = String(feedCategory || '').split(/\s+,\s+/).map(s => s.trim()).filter(Boolean);
  const path = parts.slice(0, 3).join(' > ');
  if (!path) return { reject: 'no section in the feed' };
  for (const [re, fn] of SECTIONS) {
    if (!re.test(path)) continue;
    const out = fn(path, n);
    if (!out) continue;
    if (out.site === 'kgw' && (NOT_FOR_KIDS.test(n) || ADULT_STATUE.test(n))) return { reject: 'made for adult collectors, not for Kids\' Gear World' };
    if (out.site === 'kgw' && /kaset|taśma muzyczna|album muzyczn|music (?:tape|record|cd)/i.test(n)) return { reject: 'music merchandise, not toys' };
    return out;
  }
  return { reject: `section without a place on the sites (${parts[0]})` };
}
