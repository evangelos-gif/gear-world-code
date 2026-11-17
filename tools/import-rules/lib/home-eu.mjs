// Home Gear World: where a product of a Dutch, German or French home shop goes (Daisycon, Wave 3, chat 9, 17 Nov 2026:
// La Redoute NL/DE, Dille & Kamille NL/FR, Miss Towels, WoodWick, Kerstland, Baobab Collection). Their feeds name the
// product and its folders in the shop's language ("Woontextiel|Beddengoed|Dekbedovertrekken", "Sofa, Sessel|Sofa|Ecksofa",
// "Maison et jardin|Linge|Linge de table|Nappes"), so the English words of lib/hgw-home.mjs never match.
// The place comes from the category path, deepest folder first (the same way as the Westwing rules); only when no folder
// says it, from the head of the name (before the first comma, " - " or "|"), and such products are listed under CHECK in
// the dry run. Generic words ("tafel", "Tisch", "table") are not a place: a folder "Arts de la table" is tableware. The subcategories are the ones HGW already
// has (lib/hgw-home.mjs and the Kitchen & Dining names of the HomeSpace and AliExpress PL rules).
// Dutch and German glue words together ("Verduisteringsgordijn", "Kinderbeddengoed", "Wohnzimmerteppich"): the LAST part
// of a word is what it is, so their lists are word ENDINGS (a "Rolgordijn" is a blind, listed before the curtain). French
// keeps words apart, so its list is whole words and phrases. Each language has its own list: "bank" is a sofa in Dutch and
// a bench in German, "tassen" bags in Dutch and cups in German, "horloge" a watch in Dutch and a clock in French.
// Yes list + no list (lessons L14): food, cards, books, toys, clothes, jewellery, beauty, garden and covers stay out.

const END = list => new RegExp('(?:^|[^\\p{L}\\d])[\\p{L}\\d-]*?(?:' + list.join('|') + ')(?=$|[^\\p{L}\\d])', 'iu');
const WORD = list => new RegExp('(?<![\\p{L}\\d])(?:' + list.join('|') + ')(?![\\p{L}\\d])', 'iu');

const HD = 'Home Decor', BB = 'Bedding & Bath', FU = 'Furniture', LI = 'Lighting', ST = 'Storage & Organisation', KD = 'Kitchen & Dining', HO = 'Home Office';

// Christmas is the start of a word in every language ("Kerstboomversiering", "Weihnachtskugel", "Décorations de Noël").
const CHRISTMAS = /(?<![\p{L}\d])(?:kerst|weihnacht|advent|noël|noel(?![\p{L}]))/iu;

const LISTS = {
  nl: {
    no: END(['eten', 'drinken', 'dranken', 'voeding', 'snoep', 'chocolade', 'koekjes', 'thee', 'kruidenthee', 'koffie', 'kruiden', 'specerijen', 'kaart', 'kaarten',
      'wenskaarten', 'boek', 'boeken', 'media', 'speelgoed', 'puzzel', 'puzzels', 'spellen', 'kleding', 'tas', 'tassen', 'sieraden', 'horloge', 'horloges', 'verzorging',
      'cosmetica', 'zeep', 'cadeaubon', 'cadeaukaart', 'zaden', 'zaad', 'tuinieren', 'tuin en gazon', 'buitenleven', 'buitenmeubelen', 'dieren', 'huisdieren',
      'schrijfwaren', 'papierwaren', 'stalen', 'staal', 'badjas', 'badjassen', 'pyjama']),
    cover: END(['bankhoes', 'bankhoezen', 'stoelhoes', 'stoelhoezen', 'fauteuilhoes', 'fauteuilhoezen', 'hockerhoes', 'meubelhoes', 'meubelhoezen', 'staal', 'stalen',
      'stofstaal', 'badjas', 'badjassen', 'pyjama', 'pyjamas']),
    places: [
      [ST, 'Shoe Rack', END(['schoenenkast', 'schoenenkasten', 'schoenenrek', 'schoenenrekken', 'schoenenbank'])],
      // Lighting
      [LI, 'Pendant Light', END(['hanglamp', 'hanglampen'])],
      [LI, 'Ceiling Light', END(['plafondlamp', 'plafondlampen', 'plafonnière', 'plafonnières', 'plafondverlichting', 'plafondspot', 'plafondspots'])],
      [LI, 'Floor Lamp', END(['vloerlamp', 'vloerlampen', 'staande lamp', 'staande lampen'])],
      [LI, 'Table Lamp', END(['tafellamp', 'tafellampen', 'bureaulamp', 'bureaulampen', 'nachtlamp', 'nachtlampen'])],
      [LI, 'Wall Light', END(['wandlamp', 'wandlampen', 'wandverlichting'])],
      [LI, 'Lampshade', END(['lampenkap', 'lampenkappen'])],
      // Bedding and bath ("badlaken" is a towel, before "laken")
      [BB, 'Bath Mat', END(['badmat', 'badmatten', 'douchemat', 'douchematten'])],
      [BB, 'Towel', END(['handdoek', 'handdoeken', 'badlaken', 'badlakens', 'washand', 'washanden', 'gastendoek', 'gastendoekjes', 'saunalaken'])],
      [BB, 'Bathroom Accessories', END(['badkameraccessoires', 'zeeppompje', 'zeeppompjes', 'zeepdispenser', 'toiletborstel', 'handdoekrek', 'handdoekhouder'])],
      [BB, 'Duvet', END(['overtrek', 'overtrekken', 'dekbed', 'dekbedden'])],
      [BB, 'Pillow', END(['sloop', 'slopen', 'hoofdkussen', 'hoofdkussens'])],
      [BB, 'Mattress Topper', END(['topper', 'toppers', 'matrasbeschermer', 'matrasbeschermers', 'molton', 'moltons'])],
      [BB, 'Bed Linen', END(['laken', 'lakens', 'beddengoed', 'sprei', 'spreien'])],
      // Furniture
      [FU, 'Footstool', END(['voetenbank', 'voetenbanken', 'poef', 'poefs', 'hocker', 'hockers'])],
      [FU, 'Bench', END(['eetbank', 'eetbanken', 'zitbank', 'zitbanken'])],
      [FU, 'Sofa', END(['slaapbank', 'slaapbanken', 'hoekbank', 'hoekbanken', 'zitsbank', 'zitsbanken', 'bank', 'banken', 'sofa', 'sofas', "sofa's", 'loveseat'])],
      [HO, 'Office Chair', END(['bureaustoel', 'bureaustoelen'])],
      [FU, 'Bar Stool', END(['barkruk', 'barkrukken', 'kruk', 'krukken'])],
      [FU, 'Armchair', END(['fauteuil', 'fauteuils'])],
      [FU, 'Dining Chair', END(['eetkamerstoel', 'eetkamerstoelen', 'eetstoel', 'eetstoelen', 'stoel', 'stoelen'])],
      [FU, 'Dining Table', END(['eettafel', 'eettafels'])],
      [FU, 'Coffee Table', END(['salontafel', 'salontafels'])],
      [FU, 'Side Table', END(['bijzettafel', 'bijzettafels'])],
      [FU, 'Console Table', END(['sidetable', 'sidetables', 'wandtafel', 'wandtafels'])],
      [FU, 'Dressing Table', END(['kaptafel', 'kaptafels'])],
      [HO, 'Office Desk', END(['bureau', 'bureaus'])],
      [FU, 'Sideboard', END(['dressoir', 'dressoirs'])],
      [FU, 'Chest Of Drawers', END(['ladekast', 'ladekasten', 'commode', 'commodes'])],
      [FU, 'Wardrobe', END(['kledingkast', 'kledingkasten', 'garderobekast', 'garderobekasten'])],
      [FU, 'Bedside Table', END(['nachtkast', 'nachtkasten', 'nachtkastje', 'nachtkastjes'])],
      [FU, 'Bookcase', END(['boekenkast', 'boekenkasten'])],
      [FU, 'Display Cabinet', END(['vitrinekast', 'vitrinekasten', 'vitrine', 'vitrines'])],
      [FU, 'TV Unit', END(['tv-meubel', 'tv-meubels', 'tv-kast', 'tv-kasten', 'tv meubel', 'tv meubels'])],
      [ST, 'Coat Stand', END(['kapstok', 'kapstokken'])],
      [ST, 'Shelving Unit', END(['wandplank', 'wandplanken', 'wandrek', 'wandrekken', 'stellingkast', 'stellingkasten'])],
      [ST, 'Storage Box', END(['opbergbox', 'opbergboxen', 'opbergdoos', 'opbergdozen', 'opbergkist', 'opbergkisten'])],
      [ST, 'Storage Basket', END(['mand', 'manden', 'mandje', 'mandjes'])],
      [ST, 'Storage Unit', END(['kast', 'kasten', 'opbergkast', 'opbergkasten'])],
      [FU, 'Headboard', END(['hoofdbord', 'hoofdborden'])],
      [FU, 'Mattress', END(['matras', 'matrassen'])],
      [FU, 'Bed Frame', END(['bed', 'bedden', 'boxspring', 'boxsprings', 'ledikant', 'ledikanten', 'bedframe', 'bedframes'])],
      // Kitchen and table ("tafelkleed" and "tafelloper" before the rug)
      [KD, 'Table Linen', END(['tafelkleed', 'tafelkleden', 'tafelloper', 'tafellopers', 'servet', 'servetten', 'placemat', 'placemats', 'theedoek', 'theedoeken',
        'glazendoek', 'glazendoeken', 'vaatdoek', 'vaatdoeken', 'keukendoek', 'keukendoeken', 'tafeltextiel', 'keukentextiel', 'tafellinnen', 'ovenwant', 'ovenwanten',
        'pannenlap', 'pannenlappen', 'schort', 'schorten'])],
      [KD, 'Glassware', END(['glas', 'glazen', 'drinkglas', 'drinkglazen', 'wijnglas', 'wijnglazen'])],
      [KD, 'Drinkware', END(['mok', 'mokken', 'mokje', 'mokjes', 'beker', 'bekers', 'kopje', 'kopjes', 'theepot', 'theepotten', 'theeglas', 'kan', 'kannen', 'karaf', 'karaffen'])],
      [KD, 'Tableware', END(['bord', 'borden', 'schaal', 'schalen', 'kom', 'kommen', 'kommetje', 'kommetjes', 'servies', 'dienblad', 'dienbladen', 'etagère', 'etagères',
        'schotel', 'schotels', 'onderzetter', 'onderzetters'])],
      [KD, 'Cookware', END(['pan', 'pannen', 'koekenpan', 'koekenpannen', 'braadpan', 'braadpannen', 'ovenschaal', 'ovenschalen', 'bakvorm', 'bakvormen', 'kookgerei'])],
      [KD, 'Kitchen Knives', END(['mes', 'messen', 'messenset'])],
      [KD, 'Kitchen Utensil', END(['keukengerei', 'keukenhulp', 'keukenhulpen', 'uitsteekvorm', 'uitsteekvormen', 'voorraadpot', 'voorraadpotten', 'voorraadbus',
        'voorraadbussen', 'weckpot', 'weckpotten', 'opbergen en bewaren', 'opbergen & bewaren'])],
      // Decor ("rolgordijn" is a blind, before the curtain)
      [HD, 'Blinds', END(['rolgordijn', 'rolgordijnen', 'vouwgordijn', 'vouwgordijnen', 'jaloezie', 'jaloezieën', 'plissé', 'plissés'])],
      [HD, 'Curtain', END(['gordijn', 'gordijnen', 'vitrage', 'vitrages', 'raamdecoratie'])],
      [HD, 'Mirror', END(['spiegel', 'spiegels'])],
      [HD, 'Rug', END(['vloerkleed', 'vloerkleden', 'tapijt', 'tapijten', 'karpet', 'karpetten', 'loper', 'lopers'])],
      [HD, 'Cushion', END(['sierkussen', 'sierkussens', 'kussenhoes', 'kussenhoezen', 'kussen', 'kussens', 'zitkussen', 'zitkussens'])],
      [HD, 'Throw', END(['plaid', 'plaids', 'deken', 'dekens', 'dekentje', 'dekentjes'])],
      [HD, 'Clock', END(['klok', 'klokken', 'wandklok', 'wandklokken'])],
      [HD, 'Vase', END(['vaas', 'vazen', 'vaasje', 'vaasjes'])],
      [HD, 'Home Fragrance', END(['kaars', 'kaarsen', 'geurkaars', 'geurkaarsen', 'geurstokjes', 'interieurparfum', 'interieurparfums', 'huisparfum', 'geurverspreider',
        'geurverspreiders', 'wasmelt', 'wasmelts', 'roomspray'])],
      [HD, 'Wall Art', END(['schilderij', 'schilderijen', 'poster', 'posters', 'wanddecoratie', 'canvas'])],
      [HD, 'Ornament', END(['kandelaar', 'kandelaars', 'kaarshouder', 'kaarshouders', 'windlicht', 'windlichten', 'lantaarn', 'lantaarns', 'theelichthouder',
        'theelichthouders', 'bloempot', 'bloempotten', 'plantenpot', 'plantenpotten', 'kunstplant', 'kunstplanten', 'kunstbloem', 'kunstbloemen', 'fotolijst', 'fotolijsten',
        'beeld', 'beelden', 'beeldje', 'beeldjes', 'decoratie', 'woonaccessoires', 'decoratieve accessoires'])],
      [LI, 'Table Lamp', END(['lamp', 'lampen'])]
    ]
  },
  de: {
    no: END(['lebensmittel', 'getränke', 'essen', 'süßigkeiten', 'schokolade', 'tee', 'kaffee', 'gewürze', 'karten', 'grußkarten', 'bücher', 'buch', 'spielzeug',
      'spiele', 'puzzle', 'bekleidung', 'schmuck', 'armbanduhren', 'kosmetik', 'körperpflege', 'pflege', 'gutschein', 'gutscheine', 'garten', 'gartenmöbel',
      'tierbedarf', 'haustiere', 'schreibwaren', 'muster', 'bezug', 'bezüge', 'husse', 'hussen', 'überzug', 'überzüge', 'bademantel', 'bademäntel', 'pyjama']),
    cover: END(['sofabezug', 'sofabezüge', 'sesselbezug', 'sesselbezüge', 'stuhlbezug', 'stuhlbezüge', 'hockerbezug', 'husse', 'hussen', 'stoffmuster', 'muster',
      'bademantel', 'bademäntel', 'pyjama', 'pyjamas']),
    // "Heimtextilien|Dekokissen, Kissenbezug|Kissenbezug" are cushion covers, "Bettwäsche|Kissenbezug" pillowcases.
    before: [[HD, 'Cushion', END(['dekokissen', 'zierkissen'])]],
    places: [
      [ST, 'Shoe Rack', END(['schuhschrank', 'schuhschränke', 'schuhregal', 'schuhregale', 'schuhbank', 'schuhbänke'])],
      [LI, 'Pendant Light', END(['pendelleuchte', 'pendelleuchten', 'hängeleuchte', 'hängeleuchten', 'hängelampe', 'hängelampen', 'pendellampe', 'pendellampen'])],
      [LI, 'Ceiling Light', END(['deckenleuchte', 'deckenleuchten', 'deckenlampe', 'deckenlampen'])],
      [LI, 'Floor Lamp', END(['stehleuchte', 'stehleuchten', 'stehlampe', 'stehlampen'])],
      [LI, 'Table Lamp', END(['tischleuchte', 'tischleuchten', 'tischlampe', 'tischlampen'])],
      [LI, 'Wall Light', END(['wandleuchte', 'wandleuchten', 'wandlampe', 'wandlampen'])],
      [LI, 'Lampshade', END(['lampenschirm', 'lampenschirme'])],
      [BB, 'Bath Mat', END(['badematte', 'badematten', 'badvorleger', 'duschmatte', 'duschmatten'])],
      [BB, 'Towel', END(['handtuch', 'handtücher', 'badetuch', 'badetücher', 'duschtuch', 'duschtücher', 'saunatuch', 'saunatücher', 'gästetuch', 'gästetücher', 'frottier'])],
      [BB, 'Pillow', END(['kissenbezug', 'kissenbezüge', 'kissenbezügen', 'kopfkissen', 'nackenrolle', 'nackenrollen', 'nackenkissen'])],
      [BB, 'Duvet', END(['bettbezug', 'bettbezüge', 'bettdecke', 'bettdecken', 'steppdecke', 'steppdecken', 'daunendecke', 'daunendecken'])],
      [BB, 'Mattress Topper', END(['topper', 'matratzenauflage', 'matratzenauflagen', 'matratzenschoner', 'unterbett'])],
      [BB, 'Bed Linen', END(['spannbettlaken', 'bettlaken', 'laken', 'bettwäsche', 'tagesdecke', 'tagesdecken', 'bettüberwurf', 'bettüberwürfe'])],
      [FU, 'Bar Stool', END(['barhocker', 'tresenhocker'])],
      [FU, 'Footstool', END(['hocker', 'pouf', 'poufs', 'puff', 'fußhocker', 'fußbank'])],
      [FU, 'Sofa', END(['schlafsofa', 'schlafsofas', 'klappsofa', 'klappsofas', 'schlafcouch', 'ecksofa', 'ecksofas', 'modulsofa', 'modulsofas', 'sofa', 'sofas', 'couch',
        'wohnlandschaft', 'wohnlandschaften'])],
      [FU, 'Armchair', END(['sessel', 'ohrensessel', 'relaxsessel', 'loungesessel'])],
      [HO, 'Office Chair', END(['bürostuhl', 'bürostühle', 'schreibtischstuhl', 'schreibtischstühle'])],
      [FU, 'Dining Chair', END(['stuhl', 'stühle', 'stühlen'])],
      [FU, 'Bench', END(['bank', 'bänke', 'sitzbank', 'sitzbänke'])],
      [FU, 'Bedside Table', END(['nachttisch', 'nachttische', 'nachtkonsole', 'nachtkonsolen', 'nachtschrank', 'nachtschränke'])],
      [FU, 'Dressing Table', END(['schminktisch', 'schminktische', 'frisiertisch', 'frisiertische'])],
      [HO, 'Office Desk', END(['schreibtisch', 'schreibtische'])],
      [FU, 'Dining Table', END(['esstisch', 'esstische'])],
      [FU, 'Coffee Table', END(['couchtisch', 'couchtische'])],
      [FU, 'Side Table', END(['beistelltisch', 'beistelltische'])],
      [FU, 'Console Table', END(['konsole', 'konsolen', 'konsolentisch', 'konsolentische', 'wandtisch'])],
      [FU, 'Sideboard', END(['sideboard', 'sideboards', 'anrichte', 'anrichten', 'highboard', 'highboards'])],
      [FU, 'Chest Of Drawers', END(['kommode', 'kommoden'])],
      [FU, 'Wardrobe', END(['kleiderschrank', 'kleiderschränke'])],
      [FU, 'Bookcase', END(['bücherregal', 'bücherregale', 'bücherschrank'])],
      [FU, 'Display Cabinet', END(['vitrine', 'vitrinen'])],
      [FU, 'TV Unit', END(['tv-möbel', 'tv-lowboard', 'tv-lowboards', 'lowboard', 'lowboards', 'tv-schrank', 'tv-bank'])],
      [ST, 'Coat Stand', END(['garderobe', 'garderoben', 'garderobenständer', 'kleiderständer', 'kleiderstange'])],
      [ST, 'Shelving Unit', END(['wandregal', 'wandregale', 'regal', 'regale', 'wandboard', 'wandboards'])],
      [ST, 'Storage Box', END(['aufbewahrungsbox', 'aufbewahrungsboxen', 'truhe', 'truhen'])],
      [ST, 'Storage Basket', END(['korb', 'körbe', 'aufbewahrungskorb', 'aufbewahrungskörbe'])],
      [ST, 'Storage Unit', END(['schrank', 'schränke'])],
      [FU, 'Headboard', END(['kopfteil', 'kopfteile', 'betthaupt'])],
      [FU, 'Mattress', END(['matratze', 'matratzen'])],
      [FU, 'Bed Frame', END(['bett', 'betten', 'bettgestell', 'bettgestelle', 'boxspringbett', 'boxspringbetten', 'polsterbett', 'polsterbetten'])],
      [KD, 'Table Linen', END(['tischdecke', 'tischdecken', 'tischläufer', 'serviette', 'servietten', 'tischset', 'tischsets', 'platzset', 'platzsets', 'geschirrtuch',
        'geschirrtücher', 'tischwäsche', 'schürze', 'schürzen', 'topflappen'])],
      [KD, 'Glassware', END(['glas', 'gläser', 'trinkglas', 'trinkgläser', 'weinglas', 'weingläser'])],
      [KD, 'Drinkware', END(['tasse', 'tassen', 'becher', 'kanne', 'kannen', 'teekanne', 'teekannen', 'karaffe', 'karaffen'])],
      [KD, 'Tableware', END(['teller', 'schale', 'schalen', 'schüssel', 'schüsseln', 'geschirr', 'tablett', 'tabletts', 'servierplatte', 'servierplatten', 'etagere', 'etageren',
        'untersetzer'])],
      [KD, 'Cookware', END(['topf', 'töpfe', 'pfanne', 'pfannen', 'auflaufform', 'auflaufformen', 'backform', 'backformen', 'kochgeschirr'])],
      [KD, 'Kitchen Knives', END(['messer', 'messerset'])],
      [KD, 'Kitchen Utensil', END(['küchenhelfer', 'vorratsdose', 'vorratsdosen', 'vorratsglas', 'vorratsgläser'])],
      [HD, 'Blinds', END(['rollo', 'rollos', 'jalousie', 'jalousien', 'plissee', 'plissees', 'raffrollo', 'raffrollos'])],
      [HD, 'Curtain', END(['vorhang', 'vorhänge', 'gardine', 'gardinen', 'vorhangschal', 'vorhangschals'])],
      [HD, 'Mirror', END(['spiegel'])],
      [HD, 'Rug', END(['teppich', 'teppiche', 'läufer', 'teppichläufer'])],
      [HD, 'Cushion', END(['kissen', 'kissenhülle', 'kissenhüllen', 'sitzkissen'])],
      [HD, 'Throw', END(['plaid', 'plaids', 'decke', 'decken', 'wohndecke', 'wohndecken', 'kuscheldecke', 'kuscheldecken'])],
      [HD, 'Clock', END(['wanduhr', 'wanduhren', 'tischuhr', 'tischuhren', 'standuhr', 'standuhren'])],
      [HD, 'Vase', END(['vase', 'vasen'])],
      [HD, 'Home Fragrance', END(['kerze', 'kerzen', 'duftkerze', 'duftkerzen', 'raumduft', 'raumdüfte', 'diffuser', 'duftstäbchen'])],
      [HD, 'Wall Art', END(['bild', 'bilder', 'wandbild', 'wandbilder', 'poster', 'gemälde', 'leinwandbild', 'leinwandbilder'])],
      [HD, 'Ornament', END(['kerzenhalter', 'kerzenständer', 'windlicht', 'windlichter', 'laterne', 'laternen', 'teelichthalter', 'übertopf', 'übertöpfe', 'blumentopf',
        'blumentöpfe', 'kunstpflanze', 'kunstpflanzen', 'kunstblume', 'kunstblumen', 'bilderrahmen', 'fotorahmen', 'deko', 'dekoration', 'dekofigur', 'dekofiguren',
        'skulptur', 'skulpturen', 'figur', 'figuren'])],
      [LI, 'Table Lamp', END(['leuchte', 'leuchten', 'lampe', 'lampen'])]
    ]
  },
  fr: {
    no: WORD(['épicerie', 'alimentation', 'thés?', 'tisanes?', 'cafés?', 'bonbons?', 'chocolats?', 'cartes?', 'livres?', 'jouets?', 'puzzles?', 'jeux', 'vêtements?',
      'bijoux', 'montres?', 'cosmétiques?', 'soins?', 'savons?', 'lotions?', 'gels? douche', 'crèmes?', 'cartes? cadeaux?', 'herbes', 'graines', 'épices',
      'jardin', 'animaux', 'papeterie', 'échantillons?', 'housses? de canapé', 'housses? de fauteuil', 'housses? de chaise', 'peignoirs?', 'pyjamas?']),
    cover: WORD(['housses? de canapé', 'housses? de fauteuil', 'housses? de chaise', 'housses? de pouf', 'échantillons?', 'peignoirs?', 'pyjamas?',
      'lotions?', 'savons?', 'gels? douche', 'crèmes?', 'eaux? de parfum', 'eaux? de toilette']),
    places: [
      [ST, 'Shoe Rack', WORD(['meubles? à chaussures', 'range-chaussures', 'étagères? à chaussures'])],
      [LI, 'Pendant Light', WORD(['suspensions?'])],
      [LI, 'Ceiling Light', WORD(['plafonniers?', 'plafonnières?'])],
      [LI, 'Floor Lamp', WORD(['lampadaires?'])],
      [LI, 'Table Lamp', WORD(['lampes? à poser', 'lampes? de chevet', 'lampes? de bureau', 'lampes? de table'])],
      [LI, 'Wall Light', WORD(['appliques?'])],
      [LI, 'Lampshade', WORD(['abat-jours?'])],
      [BB, 'Bath Mat', WORD(['tapis de bain', 'tapis de douche'])],
      [BB, 'Towel', WORD(['serviettes? de bain', 'draps? de bain', 'serviettes? de toilette', 'gants? de toilette', 'linge de bain', 'serviettes? invités?'])],
      [BB, 'Bathroom Accessories', WORD(['accessoires? (?:pour|de) (?:la )?salle de bains?', 'porte-savons?', 'distributeurs? de savon'])],
      [BB, 'Duvet', WORD(['housses? de couette', 'parures? de lit', 'couettes?'])],
      [BB, 'Pillow', WORD(["taies? d['’]oreillers?", 'oreillers?', 'traversins?'])],
      [BB, 'Mattress Topper', WORD(['surmatelas', 'protège-matelas', 'alèses?'])],
      [BB, 'Bed Linen', WORD(['draps? housses?', 'draps? plats?', 'draps?', 'couvre-lits?', 'boutis', 'jetés? de lit', 'linge de lit'])],
      [HO, 'Office Chair', WORD(['chaises? de bureau', 'fauteuils? de bureau'])],
      [FU, 'Sofa', WORD(['canapés?-lits?', 'canapés? convertibles?', 'banquettes?-lits?', 'clic-clacs?', 'canapés?', 'sofas?', 'méridiennes?'])],
      [FU, 'Armchair', WORD(['fauteuils?'])],
      [FU, 'Footstool', WORD(['poufs?', 'repose-pieds'])],
      [FU, 'Bar Stool', WORD(['tabourets? de bar', 'chaises? de bar', 'tabourets?'])],
      [FU, 'Dining Chair', WORD(['chaises?'])],
      [FU, 'Bench', WORD(['bancs?', 'banquettes?'])],
      [FU, 'Dining Table', WORD(['tables? à manger', 'tables? de repas', 'tables? de salle à manger'])],
      [FU, 'Coffee Table', WORD(['tables? basses?'])],
      [FU, 'Bedside Table', WORD(['tables? de chevet', 'chevets?'])],
      [FU, 'Side Table', WORD(["tables? d['’]appoint", 'bouts? de canapé', 'sellettes?'])],
      [FU, 'Console Table', WORD(['consoles?'])],
      [FU, 'Dressing Table', WORD(['coiffeuses?'])],
      [HO, 'Office Desk', WORD(['bureaux', 'bureau'])],
      [FU, 'Sideboard', WORD(['buffets?', 'bahuts?', 'enfilades?'])],
      [FU, 'Chest Of Drawers', WORD(['commodes?'])],
      [FU, 'Wardrobe', WORD(['armoires?', 'penderies?'])],
      [FU, 'Bookcase', WORD(['bibliothèques?'])],
      [FU, 'Display Cabinet', WORD(['vitrines?'])],
      [FU, 'TV Unit', WORD(['meubles? tv', 'meubles? télé'])],
      [ST, 'Shelving Unit', WORD(['étagères?'])],
      [ST, 'Coat Stand', WORD(['portemanteaux?', 'porte-manteaux?', 'patères?'])],
      [ST, 'Storage Box', WORD(['boîtes? de rangement', 'malles?', 'coffres?'])],
      [ST, 'Storage Basket', WORD(['paniers?', 'corbeilles?'])],
      [FU, 'Headboard', WORD(['têtes? de lit'])],
      [FU, 'Mattress', WORD(['matelas'])],
      [FU, 'Bed Frame', WORD(['lits?', 'sommiers?', 'cadres? de lit'])],
      [KD, 'Table Linen', WORD(['nappes?', 'chemins? de table', 'serviettes? de table', 'sets? de table', 'torchons?', 'linge de table', 'tabliers?', 'maniques?'])],
      [KD, 'Glassware', WORD(['verres?'])],
      [KD, 'Drinkware', WORD(['mugs?', 'tasses?', 'théières?', 'carafes?', 'cafetières?', 'pichets?'])],
      [KD, 'Tableware', WORD(['assiettes?', 'plats? de service', 'plats?', 'saladiers?', 'vaisselle', 'plateaux?', 'coupelles?', 'bols?', 'dessous de verre',
        'arts de la table'])],
      [KD, 'Cookware', WORD(['casseroles?', 'poêles?', 'cocottes?', 'faitouts?', 'moules?', 'plats? à four'])],
      [KD, 'Kitchen Knives', WORD(['couteaux?'])],
      [KD, 'Kitchen Utensil', WORD(['ustensiles?', 'accessoires? de cuisine', 'bocaux', 'bocal', 'boîtes? de conservation'])],
      [HD, 'Blinds', WORD(['stores?'])],
      [HD, 'Curtain', WORD(['rideaux?', 'voilages?'])],
      [HD, 'Mirror', WORD(['miroirs?'])],
      [HD, 'Rug', WORD(['tapis'])],
      [HD, 'Cushion', WORD(['housses? de coussins?', 'coussins?'])],
      [HD, 'Throw', WORD(['plaids?', 'couvertures?', 'jetés?'])],
      [HD, 'Clock', WORD(['horloges?', 'pendules?'])],
      [HD, 'Vase', WORD(['vases?'])],
      [HD, 'Home Fragrance', WORD(['bougies?', 'bougies? parfumées?', 'diffuseurs?', 'bâtons? de diffuseurs?', "parfums? d['’]intérieur", 'recharges?', 'fondants?'])],
      [HD, 'Wall Art', WORD(['tableaux?', 'affiches?', 'posters?', 'toiles?'])],
      [HD, 'Ornament', WORD(['bougeoirs?', 'photophores?', 'lanternes?', 'chandeliers?', 'pots? de fleurs?', 'cache-pots?', 'fleurs? artificielles?', 'plantes? artificielles?',
        'cadres?', 'cadres? photos?', 'décorations?', 'objets? déco', 'statues?', 'statuettes?', 'figurines?'])],
      [LI, 'Table Lamp', WORD(['lampes?'])]
    ]
  }
};

export const LANGUAGES = Object.keys(LISTS);

// "Woontextiel|Beddengoed|Dekbedovertrekken > Woontextiel" -> ['Dekbedovertrekken', 'Beddengoed', 'Woontextiel'] (deepest first).
// The part after ">" is the feed's top folder again, or a short copy of the last one: it is read last.
export function pathParts(feedCategory) {
  const [path, ...rest] = String(feedCategory || '').split('>');
  const parts = path.split('|').map(s => s.trim()).filter(Boolean).reverse();
  for (const r of rest) for (const x of r.split('|').map(s => s.trim()).filter(Boolean)) if (!parts.includes(x)) parts.push(x);
  return parts;
}

function placeIn(text, L) {
  if (CHRISTMAS.test(text)) return { siteCategory: HD, subcategory: 'Christmas' };
  for (const [cat, sub, re] of L.places) if (re.test(text)) return { siteCategory: cat, subcategory: sub };
  return null;
}

// The head of a name: "Kan, porselein, 1,1 liter" -> "Kan"; "Baobab Collection - Bougie Parfumée Sand Siloli" -> the part
// after the brand; "Glendon kerstguirlande | groen | 180cm" -> "Glendon kerstguirlande".
export function headOf(name, brand = '') {
  let n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  if (brand && n.toLowerCase().startsWith(brand.toLowerCase() + ' - ')) n = n.slice(brand.length + 3);
  return (n.split(/\s*[|,]\s*|\s+-\s+/)[0] || n).trim();
}

// { siteCategory, subcategory } or { reject } for a product of a home shop in language `lang` (nl, de, fr).
// The path decides first (deepest folder first): a folder that is not a home product ends it (null).
export function homePlaceEu({ name, feedCategory = '', lang, brand = '' }) {
  const L = LISTS[lang];
  if (!L) throw new Error(`home-eu: no word list for language "${lang}"`);
  const head = headOf(name, brand);
  // A cover, a fabric sample, a bathrobe or a body lotion is never a home product, whatever its folder says.
  if (L.cover.test(head)) return { reject: 'not a home product of HGW (a cover, sample, bathrobe or body care)' };
  // A word of the whole path that settles it ("Heimtextilien|Dekokissen, Kissenbezug|Kissenbezug" are cushion covers).
  for (const [cat, sub, re] of L.before || []) if (re.test(feedCategory)) return { siteCategory: cat, subcategory: sub };
  // A Christmas word in the head of the name wins ("Glendon kerstguirlande" in "Seizoens- en feestdagdecoratie").
  if (CHRISTMAS.test(head)) return { siteCategory: HD, subcategory: 'Christmas' };
  // Every folder is read for a place first, deepest first, and only then for a "no" word: one folder can carry a stray word
  // ("Huis en tuin|Linnengoed|Handdoeken|Badhandboeken" has "boeken", books, in a typo of the towel folder).
  const parts = pathParts(feedCategory);
  for (const part of parts) { const p = placeIn(part, L); if (p) return p; }
  if (parts.some(part => L.no.test(part))) return { reject: 'not a home product of HGW (food, cards, books, toys, clothes, garden ...)' };
  // No folder says it: the head of the name, listed under CHECK in the dry run.
  if (L.no.test(head)) return { reject: 'not a home product of HGW (food, cards, books, toys, clothes, garden ...)' };
  const p = placeIn(head, L);
  return p ? { ...p, doubt: true } : { reject: 'not a home product of HGW, or not sure where it goes' };
}
