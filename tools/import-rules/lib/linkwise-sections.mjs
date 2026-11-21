// Greek Linkwise shops on the new-engine sites (SGW, TGW, VGW, AGW, BGW, ZGW), chat 7 and the owner 21 Nov 2026, lessons
// L209. The sites' own rules (sites/<site>/category-rules.js) read English names only, and Linkwise feeds are Greek (names
// and the shop's category path, "Ανδρικά > Παπούτσια > Τρέξιμο"). sources.json "sections": "linkwise-gr" sends a row here
// (tools/tgw-import-plan.mjs): the shop's category path and the name, folded as in lib/linkwise.mjs (lower case, no accents,
// final sigma as sigma), pick the site's category and an English subcategory; the Greek name stays (the site shows these
// shops only in Greece and Cyprus, deliversTo with language "el", sites/<site>/linkwise-gr.js).
//  - The same never-lists as the older sites (L199): medicines and supplements, adult, smoking, drink, vouchers, weapons;
//    the shop category's food words do not count on Pets Gear World, which sells pet food.
//  - Fashion is not sport: lifestyle sneakers, sandals, flip-flops, boots, jeans, shirts, dresses, oversized or slogan
//    T-shirts, baby shoes and souvenirs (keyrings, stickers, mugs) stay out of Sporty Gear World. Beach swimwear too; a
//    swimsuit or goggles for swimming is water sports.
//  - Each site keeps only what it sells: a phone shop's gifts, a battery shop's forklift batteries, a car shop's clearance
//    corner ("Stock-Εκποίηση") stay out with the reason in the dry run.
import { gr, R, NEVER_NAME, NEVER_CAT, NEVER_SHOPS, displayName } from './linkwise.mjs';

// no(): the row is left out; miss(): nothing matched in this text (the whole category path is read next).
// gr() of lib/linkwise.mjs folds the final sigma before lower case, so an upper-case "ΜΠΑΤΑΡΙΕΣ" kept its "ς": every
// text here is folded once more after lower case.
const g = s => gr(s).replace(/ς/g, 'σ');
const no = reason => ({ ok: false, reason, hard: true });
const miss = reason => ({ ok: false, reason });
const yes = (slug, sub, name) => ({ ok: true, slug, sub, name });

// The kind of item, for the English subcategory (sports clothing and gear).
const ITEM = [
  [R('ποδοσφαιρικ\\S* παπουτσ|football boots|\\bfg\\b|\\bsg\\b|\\btf\\b|\\bag\\b|σχαρακι|τερφ'), 'Football boots'],
  [R('παπουτσ|\\bshoes?\\b|υποδησ|sneakers?|trainers?|spikes|καρφια'), 'Shoes'],
  [R('καλτσ|\\bsocks?\\b'), 'Socks'],
  [R('κολαν|leggings?|tights|κολλαν'), 'Leggings'],
  [R('μπουστακ|sports? bra|\\bbra\\b'), 'Sports bras'],
  [R('σορτσ|βερμουδ|shorts?'), 'Shorts'],
  [R('φορμα|φορμεσ|φορμασ|παντελον|pants|joggers?|tracksuits?'), 'Tracksuits & pants'],
  [R('φουτερ|hoodies?|ζακετ|μπουφαν|jackets?|αντιανεμ|αδιαβροχ'), 'Hoodies & jackets'],
  [R('t-?shirts?|μπλουζ|κοντομανικ|μακρυμανικ|αμανικ|\\btops?\\b|φανελ|jerseys?|unitards?|leotards?|κορμακ'), 'Tops & T-shirts'],
  [R('μαγιο|swimsuits?|swimwear'), 'Swimwear'],
  [R('καπελ|σκουφ|\\bcaps?\\b|περιλαιμ|headbands?|περικαρπ'), 'Caps & accessories'],
  [R('σακιδ|τσαντ|\\bbags?\\b|backpacks?|σακ βουαγιαζ'), 'Bags'],
  [R('μπαλα|μπαλεσ|\\bballs?\\b'), 'Balls'],
  [R('ρακετ|rackets?'), 'Rackets']
];
const itemOf = (t, fallback) => { for (const [re, s] of ITEM) if (re.test(t)) return s; return fallback; };

// ---- Sporty Gear World ----
const SGW_FASHION = R('μοδασ|lifestyle|casual|\\bsneakers?\\b|σαγιοναρ|σανδαλ|παντοφλ|πεδιλ|μποτ(εσ|ακια|α)\\b|μποτακ|τζιν\\b|jeans|πουλοβερ|πουκαμισ|φορεμα|φουστ|oversized|relaxed fit|bad bitch|τσαντακια ωμου|τσαντ(α|εσ) ωμου|χιαστι|μπρελοκ|αυτοκολλητ|κουπ(α|εσ)\\b|βρεφικ|μπεμπε|\\bμωρο|ζωνη(?! (γυμναστ|ανυψωσ|τρεξιμ|ιδρωτ))|πορτοφολ|(?<!αθλητικα )γυαλια ηλιου|ρολο(ι|για)(?!.*(gps|smart|τρεξιμ|garmin|polar|coros|suunto))|κοσμημ|αρωμα|καλλυντ');
const SGW_MEDICAL = R('βελονισμ|βελον(α|εσ)\\b|acupunct|gua sha|ρεφλεξολογ|επιπλα μασαζ|κρεβατ(ι|ια) μασαζ|θεραπει(α|εσ) εναλ|εναλ\\. θεραπ|ορθοπεδικ|νεπ\\b|γαζα|hypafix|αντισηπτ|επιθεμα');
const SGW = [
  [R('τενισ|tennis|padel|\\bπαντελ\\b|badminton|μπαντμιντον|πινγκ|ping ?pong|squash|αντικραδασμ|dampeners?|overgrips?|\\bgrips?\\b|beach ?tennis'), 'racket-sports'],
  [R('τρεξιμ|running|\\brun\\b|στιβ|marathon|μαραθων|trail|smartwatch|gps watch|garmin|polar|coros|suunto'), 'running'],
  [R('ποδοσφαιρ|football|soccer|futsal|fifa|μπασκετ|basket|\\bnba\\b|euroleague|βολει|volley|handball|χαντμπωλ|τερματοφυλακ|επικαλαμιδ|shin ?guards?|σφυριχτρ|διαιτητ|κωνοι|\\bκωνοσ\\b'), 'football-team-sports'],
  [R('κολυμβ|swimming|\\bswim\\b|γυαλακια|σκουφακι|πισιν|καταδυσ|diving|snorkel|\\bsurf|\\bsup\\b|καγιακ|kayak|wetsuit|σανιδα'), 'water-sports'],
  [R('\\bσκι\\b|\\bski\\b|snowboard|ορειβασ|trekking|hiking|πεζοπορ|αναρριχ|climbing|ισοθερμ|thermal|baselayer|κραν(η|οσ) σκι|μασκα σκι'), 'hiking-climbing-winter'],
  [R('ποδηλατ(ο|α|ου|ων|ικ(ο|α) κραν)|cycling|\\bmtb\\b|e-?bikes?|ηλεκτρικ(ο|α) ποδηλατ'), 'cycling'],
  [R('γυμναστ|fitness|\\bgym\\b|βαρακ|αλτηρ|dumbbells?|kettlebells?|αντιστασ|resistance|λαστιχ(ο|α) (ασκησ|γυμναστ)|loop band|yoga|γιογκα|pilates|πιλατεσ|crossfit|foam roller|ρολλερ|roller|μπαρ(α|εσ) γυμναστ|δισκ(οσ|οι|ουσ) (για μπαρεσ|βαρων)|στρωμα (γυμναστ|yoga)|κοιλιακ|ab roller|σχοινακι|jump rope|πολυοργαν|διαδρομ(οσ|οι) γυμναστ|στατικ(ο|α) ποδηλατ|ελλειπτικ|φυσικοθεραπ|αθλητιατρ|\\btapes?\\b|κινησιοταιν|kinesio|επιδεσμ|μασαζ|massage|stretch|διατασ|theraband|ιμαντ(α|εσ) ασκησ|compression|συμπιεσ|επιγονατιδ|περιαγκων|επιστραγαλ|γαντια γυμναστ|ζωνη γυμναστ'), 'fitness-gym'],
  [R('παγουρ|water bottles?|shakers?'), 'nutrition-hydration'],
  [R('αθλητικ|τεχνικ|dry ?fit|dri-?fit|\\bclimalite|\\bheat ?gear|προπονησ|training|activewear|sportswear|κολαν|leggings?|μπουστακ|sports? bra|φορμ(α|εσ|ασ)\\b|unitards?|leotards?|χορ(οσ|ου)\\b|dance'), 'sportswear-shoes-bags'],
  [R('καλτσ|\\bsocks?\\b|σακιδ|backpacks?|τσαντ(α|εσ) (γυμναστ|αθλητ|προπονησ)|σακ (γυμναστ|προπονησ)|πετσετ(α|εσ) (γυμναστ|θαλασσ|microfiber)|καπελ|σκουφ|\\bcaps?\\b|headbands?|περικαρπ'), 'sportswear-shoes-bags'],
  // A sports shop's own tops, hoodies, shorts and track pants (a fashion word above has already sent the rest away).
  [R('t-?shirts?|μπλουζ|κοντομανικ|μακρυμανικ|αμανικ|\\btops?\\b|φουτερ|hoodies?|ζακετ|μπουφαν|jackets?|αντιανεμ|σορτσ|βερμουδ|shorts?|παντελον|pants|joggers?'), 'sportswear-shoes-bags']
];
function sgw(t, all = t) {
  if (SGW_MEDICAL.test(t)) return no('therapy or medical item, not sport');
  if (SGW_FASHION.test(t)) return no("fashion or casual, not sport (Men's, Women's or Kids' Gear World)");
  if (R('μαγιο|swimwear|bikini|μπικινι').test(t) && !R('κολυμβ|swimming|\\bswim\\b|πισιν|προπονησ|training|αθλητικ').test(t)) return no('beach swimwear, not sport');
  // The kind of item from the whole path and the name ("Ανδρικά > Παπούτσια > Τρέξιμο": running shoes).
  for (const [re, slug] of SGW) if (re.test(t)) return yes(slug, itemOf(all, slug === 'fitness-gym' ? 'Equipment' : 'Accessories'));
  return miss('not sport, or the shop category says nothing');
}

// ---- Technology Gear World ----
const TGW = [
  // PC parts first: a PC case "with tempered glass" or a "Mesh" case is not a phone screen protector or a WiFi mesh (L211).
  [R('gehause|computer cases?|pc cases?|midi tower|κουτι(α)? (υπολογιστ|pc)|motherboards?|μητρικ(η|εσ) καρτ|graphics cards?|καρτ(α|εσ) γραφικων'), 'laptops-computing', 'PC components'],
  [R('ακουστικ|headphones?|earbuds?|earphones?|soundcore|ηχει(ο|α)|speakers?|soundbar|μικροφων'), 'audio', 'Headphones & speakers'],
  [R('θηκ(η|εσ) (κινητ|iphone|samsung|xiaomi|galaxy|redmi|huawei|pixel|oneplus|tablet|ipad)|θηκεσ\\b.*(iphone|samsung|xiaomi|galaxy|κινητ)|phone cases?|tempered ?glass|μεμβραν(η|εσ) οθονησ|screen protectors?|προστατευτικ(ο|η) οθονησ'), 'phones-smartwatches', 'Phone cases & screen protectors'],
  [R('apple watch|smartwatch|λουρακι|λουρακια|watch bands?|watch straps?|galaxy watch|amazfit|\\bfitbit'), 'phones-smartwatches', 'Smartwatch straps & accessories'],
  [R('κινητ(ο|α) τηλεφων|smartphones?|\\biphone \\d+\\b(?!.*(θηκ|case|glass|μεμβραν))'), 'phones-smartwatches', 'Phones'],
  [R('power ?banks?|φορητ(η|εσ) (τραπεζ|μπαταρ)|τραπεζα ενεργει|φορτιστ|chargers?|καλωδι(ο|α)|cables?|αντάπτορ|αντ(α|ά)πτορ|adapters?|\\bhubs?\\b|docking|magsafe|wireless charg|ασυρματ(η|οσ) φορτισ'), 'accessories-storage', 'Chargers, cables & power banks'],
  // Alarms and video door phones are home security, not a keyboard ("με πληκτρολόγιο") or a TV ("θυροτηλεόραση").
  [R('συναγερμ|σειρην(α|εσ)|alarm (system|kit)s?|θυροτηλε|βιντεοκουδουν|video doorbell'), 'smart-home-wifi', 'Smart home & security'],
  [R('\\bprinters?\\b|εκτυπωτ(ησ|εσ|η|ων)\\b|πολυμηχανημ|\\bscanners?\\b|drucker|multifunktionsgerat'), 'laptops-computing', 'Printers & scanners'],
  [R('laptop|ποντικ|\\bmouse\\b|πληκτρολογ|keyboards?|\\bssd\\b|σκληρ(οσ|οι) δισκ|usb stick|στικακι|memory card|καρτ(α|εσ) μνημησ|webcam|οθον(η|εσ) υπολογιστ|monitors?\\b'), 'laptops-computing', 'Computer accessories'],
  [R('gaming|gamepad|joystick|χειριστηρι(ο|α) (παιχνιδ|ps|xbox)|playstation|\\bps5\\b|nintendo|xbox'), 'gaming', 'Gaming accessories'],
  [R('καμερ(α|εσ) (ασφαλει|παρακολουθ|wifi|ip|κυνηγιου)|ip camera|security camera|\\bnvr\\b|\\bdvr\\b|cctv|συστημ(α|ατα) ασφαλει|smart plug|εξυπν(ο|η|α) (πριζ|λαμπ|σπιτ)|wifi (λαμπ|πριζ)|routers?\\b|\\bmesh\\b|range extender|ενισχυτ(ησ|η) wifi'), 'smart-home-wifi', 'Smart home & security'],
  [R('dash ?cam|action cam|καμερ(α|εσ) δρασ|drones?|gimbal|τριποδ|tripod|selfie'), 'cameras-drones', 'Cameras & accessories'],
  [R('τηλεορασ|projector|προβολε(α|ασ) (εικονασ|video)|tv box|android box|chromecast|fire tv'), 'tv-home-cinema', 'TV & streaming'],
  [R('mobile phone accessor|αξεσουαρ κινητ'), 'phones-smartwatches', 'Phone accessories'],
  [R('bluetooth|usb|led strip|gadgets?\\b.*(usb|bluetooth|wifi|led)'), 'accessories-storage', 'Gadgets & accessories']
];
// Not technology, wherever it sits in the shop: gifts, home, kitchen, bathroom, fashion, beauty, car items; also power
// tools and woodworking "routers" (L14: «Routers & Trimmers», a palm router, a «φρέζα»), electrical installation and
// heating cable, lamp bases and halogen bulbs, service and warranty packs, binoculars and telescopes, hearing aids,
// antiseptic sprayers, door bars (L211, the VNP, DealsShop, Vour.gr and Stark Stores dry runs).
const TGW_NOT = R('διακοσμητ|μαξιλαρ|κουπ(α|εσ)|ποτηρ|σερβιρισμ|μπρελοκ|καλτσ|t-?shirts?|μπλουζ|στάμπα|σταμπα|ρουχ|υποδησ|παπουτσ|ενδυση|αρωμα|perfume|eau de|γυαλια ηλιου|sunglasses|glasses|ρολο(ι|για)|watch (quartz|automatic)|quartz|κοσμημ|ειδη κουζιν|ειδη σπιτιου|οικιακ(οσ|ου|α|ων) εξοπλισμ|\\bμπανιο|κατοικιδ|επιτραπεζι(ο|α) παιχνιδ|κορνιζ|crossbody|γαντια|ανεμιστ\\S*( \\S+)? (usb|χειροσ|επιτραπεζ|οροφησ|δαπεδου|κολωνα|περιστρεφ)|επιτραπεζι(οσ|ο) ανεμιστ|ανεμιστηρακι|air cooler|μιξερ|πολυκοφτ|μπλεντερ|blender|κεφαλ(η|εσ) ντουσ|κατσαρολ|\\bσκευ(η|οσ)\\b|περιποιηση|ξυριστ|κουρευτ|μαλλιων|σεσουαρ|ισιωτικ|αντισηπτ|καθαρισμου προσωπου|βαρηκοι|ακοησ|hearing aid|δωρ(α|ο) για|χριστουγενν|παιχνιδ(ι|ια)(?! (ps|xbox|playstation))|ρακετ|θαλασσ|auto - moto|αυτοκινητ|μοτοσυκλετ|φακ(οσ|οι)\\b|φακοσ εκτακτ|routers & trimmers|palm router|φρεζ(α|εσ)\\b|πολυεργαλει|\\b(fein|einhell|ryobi|makita|dewalt|metabo|festool|hikoki|milwaukee)\\b|electrical wires|heating cables?|halogen|powerstar|\\bhqi\\b|care pack|service agreement|premium care|onsite (service|support)|next business day|extended warranty|επεκτασ(η|ησ) εγγυησ|κ(υ|ι)αλια|μονοκυαλ|τηλεσκοπ|μπαρ(α|εσ) ασφαλει');
// Lamps and lights are not Technology Gear World, unless smart (WiFi, Zigbee): desk lamps, lanterns, party and star
// lights, garlands, lamp-base adapters.
const TGW_LIGHT = R('φωτιστικ|γιρλαντ|φαναρ(ι|ια)\\b|πορτατιφ|λαμπ(α|εσ)\\b|ντουι|bulb adaptor|φωσ διακοπτ|αστεριων');
const TGW_SMART = R('εξυπν|smart|wi-?fi|zigbee|tuya|alexa|homekit');
// Printer toner, ink and ribbons are consumables, not Technology Gear World (L178, as the TechInn and PCHUB toner);
// the printer stays, also one that needs no ink («χωρίς μελάνι»).
const TGW_INK = R('toner|μελαν(ι|ια|ιων|οταινι)|μελανοδοχ|(ink|toner|printer|εκτυπωτ\\S*) cartridges?|cartridges? (εκτυπωτ|μελαν|toner|ink)|drum unit|printheads?|consumables for|printing accessories');
const TGW_INKLESS = R('χωρισ (μελαν|toner)|without ink|no ink|inkless|zero ink');
// Covert recording and cheating are never on the sites (chat 3, 21 Nov 2026, L211): spy and hidden cameras, hidden or
// voice-activated audio recorders, exam-cheating earpieces ("Smartcheater", "ψείρα"), fake cameras. The shop folder
// «Συσκευές Παρακολούθησης» mixes them with real CCTV: there only an NVR/DVR kit, an IP, security or trail camera stays.
const TGW_COVERT = R('\\bspy\\b|κρυφ(η|ο|α|εσ|οι|ων)\\b|κρυμμεν|hidden (camera|recorder)|smart ?cheater|cheat|ψειρ(α|εσ)\\b|\\bκοριο|μικροσκοπικ(ο|α) ακουστικ|καταγραφικ(ο|α) ηχου|voice recorder|ομοιωμα|ψευτικ(η|εσ|ο|α) καμερ|dummy|fake camera');
const TGW_WATCH_PATH = R('συσκευ(η|εσ) παρακολουθ');
const TGW_CCTV = R('\\bnvr\\b|\\bdvr\\b|cctv|καμερ(α|εσ) (ip|κυνηγιου|ασφαλει)|ip camera|security camera|\\bhc-\\d');
// t: the most specific folder and the name; all: the whole shop path and the name. What a product IS can sit higher in
// the path ("Διακοσμητικά > Πίνακες", "Οικιακός Εξοπλισμός > Μπάνιο"), so the never-lists read the whole path too (L211).
function tgw(t, all = t) {
  if (TGW_COVERT.test(all) || (TGW_WATCH_PATH.test(all) && !TGW_CCTV.test(t))) return no('spy or hidden camera, hidden recorder or cheating earpiece (never on the sites)');
  if (TGW_INK.test(all) && !TGW_INKLESS.test(all)) return no('printer toner or ink (consumables, not on Technology Gear World, L178)');
  const keep = R('apple watch|smartwatch|λουρακι');
  if ((TGW_NOT.test(t) && !keep.test(t)) || (TGW_NOT.test(all) && !keep.test(all))) return no('not a technology product (gift, home, fashion, beauty, tools or car item)');
  if (TGW_LIGHT.test(all) && !TGW_SMART.test(all)) return no('a lamp or light, not a smart one (not on Technology Gear World)');
  for (const [re, slug, sub] of TGW) if (re.test(t)) return yes(slug, sub);
  return miss('not a technology product, or the shop category says nothing');
}

// ---- Travel Gear World ----
function vgw(t) {
  if (R('παιδικ(εσ|η) βαλιτσ|βαλιτσ|luggage|suitcases?|trolley|καμπινασ').test(t) && !R('ζυγαρι|λουκετ|ετικετ|καλυμμ').test(t)) return yes('luggage-suitcases', 'Suitcases');
  if (R('σακιδ|backpacks?|σακ βουαγιαζ|duffel|τσαντ(α|εσ)|bags?|χιαστι').test(t)) return yes('travel-bags-backpacks', 'Travel bags & backpacks');
  if (R('σκιαστρ|ομπρελ(α|εσ) (θαλασσ|παραλι)|ομπρελεσ|πετσετ(α|εσ) (θαλασσ|παραλι)|πετσετεσ|ξαπλωστρ|sun lounger|beach|παραλι|θαλασσ').test(t)) return yes('beach-holiday', 'Beach');
  if (R('νεσεσερ|θηκ(η|εσ) καλλυντικ|toiletry|αξεσουαρ ταξιδ|travel accessor|ζυγαρι|λουκετ|ετικετ(α|εσ) αποσκευ|μαξιλαρ(ι|ακι) (ταξιδ|αυχεν)|πορτοφολ|wallets?|θηκ(η|εσ) διαβατηρ').test(t)) return yes('travel-accessories', 'Travel accessories');
  return miss('not a travel product');
}

// ---- Car Gear World ----
const AGW_NOT = R('stock-εκποιηση|εκποιηση|απλωστρ|κλαρκ|forklift|ελξεωσ|\\bups\\b|data center|φωτοβολταικ|solar|σκαφ(οσ|ουσ|ων)|boat|golf cart|αλκαλικ|alkaline|vrla|inverters?|μοτοσυκλετ|motorcycle|σκουτερ|scooter|ποδηλατ');
const AGW = [
  [R('λαμπ(α|εσ) εργασιασ|work lights?|φακ(οσ|οι) εργασ'), 'garage-tools-equipment', 'Work lights'],
  [R('μπαταρι(α|εσ) (αυτοκινητ|φορτηγ|εκκινησ)|car batter|start-?stop|\\bagm\\b|\\befb\\b|booster|εκκινητ|jump ?start|φορτιστ(ησ|εσ) μπαταρι|battery charg|οργαν(α|ο) μετρησ|πολυμετρ|tester|διαγνωστ|obd|πολ(οι|ουσ|ων) μπαταρι|ακροδεκτ'), 'diagnostics-battery', 'Batteries, chargers & testers'],
  [R('βασ(η|εισ) (στηριξ|κινητ|tablet)|phone holders?|βασεισ κινητων'), 'interior-comfort', 'Phone holders'],
  [R('ελαστικ|ζαντ|\\bτασ(ι|ια)\\b|tyres?|wheels?|τρομπ(α|εσ)|compressor|κομπρεσερ'), 'tyres-wheels', 'Tyres & wheels'],
  [R('λαδι(α)?\\b|λιπαντ|προσθετ(α|ο)\\b|ψυκτικ|αντιψυκτ|υγρ(ο|α) φρεν|φιλτρ|μακτρ|υαλοκαθαρ|αμορτισερ|γρυλ(οσ|οι) παραθυρ|ανταλλακτικ|service|αναλωσιμ|ανατρηση|αναρτηση|φρεν(α|ων)|ψυξησ|λαμπ(α|εσ)|led|φαναρ|καθρεφτ'), 'parts-maintenance', 'Parts & maintenance'],
  [R('καθαρισ|περιποιησ|γυαλιστ|κερ(ι|ια)\\b|wax|σαμπουαν αυτοκ|μικροιν|microfiber|πλυσιμ'), 'car-care-detailing', 'Car care & cleaning'],
  [R('εργαλει|tools?|κλειδ(ια|ι) (συσφιξ|γερμαν|καρυδ|πολυγων)|κατσαβιδ|καρυδακ|γρυλ(οσ|οι) (υδραυλ|ανυψωσ|αυτοκ)'), 'garage-tools-equipment', 'Garage tools & equipment'],
  [R('ηχοσυστημ|ραδιο|radio|ηχει(α|ο) αυτοκ|οθον(η|εσ) αυτοκ|carplay|android auto|bluetooth|dash ?cam|καμερ(α|εσ) (οπισθοπορ|αυτοκ)|αισθητηρ(ασ|εσ) παρκαρισ|gps|φορτιστ(ησ|εσ) αυτοκ|usb'), 'car-electronics', 'Car electronics'],
  [R('καμπινα|ανεση|εσωτερικ|πατακι|σκαφ(η|εσ) πορτμπαγκαζ|καλυμμ(α|ατα) καθισματ|τιμον|λεβιε|χειροφρεν|πενταλ|πομολ|διακοπτ|κελυφ(η|οσ) κλειδι|κλειδι(α)?\\b|τηλεχειριστηρ|οργανωτ|θηκ(η|εσ) κινητου|αρωματικ'), 'interior-comfort', 'Interior & comfort'],
  [R('κουκουλ(α|εσ) αυτοκ|καλυμμα αυτοκ|car covers?|μπαγκαζιερ|μπαρ(εσ)? οροφ|κοτσαδορ|ρυμουλκ|τουμπο|σχαρ(α|εσ) οροφ'), 'roof-towing-exterior', 'Covers, roof & towing'],
  [R('ασφαλει|τριγων|πυροσβεστ|φαρμακειο|αλυσιδ(α|εσ) χιονιου|χιονι|ξυστρ|γιλεκ(ο|α) ασφαλ|καλωδι(α|ο) εκκινησ'), 'safety-winter', 'Safety & winter'],
];
function agw(t) {
  if (AGW_NOT.test(t)) return no('not a car product (clearance, home, boat, forklift, solar or motorbike item)');
  for (const [re, slug, sub] of AGW) if (re.test(t)) return yes(slug, sub);
  if (R('auto - moto|αξεσουαρ οχηματ|αξεσουαρ αυτοκινητ|αυτοκινητ').test(t)) return yes('interior-comfort', 'Car accessories');
  return miss('not a car product, or the shop category says nothing');
}

// ---- Biker Gear World (bicycles and e-bikes are Sporty's, owner 29 Oct 2026) ----
function bgw(t) {
  if (R('ηλεκτρικ(ο|α) ποδηλατ|e-?bikes?|ποδηλατ').test(t)) return no('bicycle or e-bike (Sporty Gear World)');
  if (R('ζελατιν(α|εσ) (για )?κραν|visor').test(t)) return yes('helmets', 'Visors & helmet parts');
  if (R('κραν(οσ|η|ουσ)|helmets?|half face|full face|\\bjet\\b').test(t)) return yes('helmets', 'Helmets');
  if (R('ηλεκτρικ(ο|α) scooter|e-?scooters?|πατιν(ι|ια)').test(t)) return yes('electric-scooters', 'Electric scooters');
  if (R('ηλεκτρικ(α|ο) (μηχανακ|μοτοσυκλετ|για delivery)|super soco|cargo|μοτοσυκλετ(α|εσ) ηλεκτρ').test(t)) return yes('electric-motorbikes', 'Electric motorbikes');
  if (R('μπαγκαζιερ|top ?box|βαλιτσ(α|εσ) μοτο|σαμαρ|tank ?bag|λουκετ|αλυσιδ(α|εσ) ασφαλει|κλειδαρ').test(t)) return yes('luggage-security', 'Luggage & security');
  if (R('καλυμμ(α|ατα)|covers?|ομπρελ').test(t)) return yes('luggage-security', 'Covers');
  if (R('μπαταρι(α|εσ) μοτοσυκλετ|motorcycle batter|φορτιστ|chargers?|ελαστικ|σαμπρελ|tyres?|tubes?|μπαταρι').test(t)) return yes('parts-maintenance', 'Batteries, chargers & tyres');
  return miss('not a motorbike product');
}
// Motorbike batteries of a car-battery shop (ZAPS, Battery Park) on Biker Gear World.
function bgwBatteries(t) {
  if (R('μοτοσυκλετ|motorcycle|μοτο\\b|\\bmoto\\b|scooter|σκουτερ').test(t) && R('μπαταρι|batter').test(t)) return yes('parts-maintenance', 'Motorbike batteries');
  return no('not a motorbike battery (Car Gear World has the car ones)');
}

// ---- Pets Gear World ----
function zgw(t) {
  if (R('φαρμακ|αντιπαρασιτ|ψυλλ|τσιμπουρ|σκουληκ|αμπουλ(α|εσ)|pipettes?|κολαρ(ο|α) (αντιπαρασ|ψυλλ)|κτηνιατρ|θεραπευτικ').test(t)) return no('veterinary medicine or treatment');
  if (R('ψαρι|ψαρια|ενυδρει|aquari').test(t)) return no('fish and aquariums (not in the sections of Pets Gear World yet)');
  if (R('γατ(α|ασ|εσ|ουλ)|\\bcats?\\b|kitten').test(t)) return yes('cats', R('τροφ|κονσερβ|σνακ|λιχουδ|παστ(α|εσ)').test(t) ? 'Cat food' : R('αμμο|τουαλετ').test(t) ? 'Litter & toilets' : 'Cat supplies');
  if (R('πτην|πουλι|παπαγαλ|καναρ|birds?').test(t)) return yes('birds', 'Bird supplies');
  if (R('τρωκτικ|κουνελ|χαμστερ|ινδικ(ο|α) χοιριδ|rabbits?|hamsters?|guinea').test(t)) return yes('small-pets', 'Small pet supplies');
  if (R('αλογ|ιππ|horse').test(t)) return yes('horse', 'Horse care');
  if (R('τροφ|κονσερβ|σνακ|λιχουδ|κοκκαλ|μπισκοτ|food|treats?').test(t)) return yes('food', R('σνακ|λιχουδ|κοκκαλ|μπισκοτ|treats?').test(t) ? 'Dog treats' : 'Dog food');
  if (R('μπολ|ταιστρ|ποτιστρ|δοχει(ο|α) αποθηκ|bowls?|feeders?').test(t)) return yes('feeding', 'Bowls & feeders');
  if (R('κρεβατ|κουβερτ|στρωμα|μαξιλαρ|σπιτακι|κλουβ(ι|ια)|beds?|crates?').test(t) && !R('μεταφορ').test(t)) return yes('beds-crates', 'Beds & crates');
  if (R('ταξιδ|μεταφορ|carriers?|ζωνη ασφαλει').test(t)) return yes('travel', 'Travel & carriers');
  if (R('λουρ(ι|ια)|περιλαιμ|οδηγ(οσ|οι)|σαμαρακ|harness|leads?|collars?|ρουχ(α|ακια)|μπουφαν').test(t)) return yes('walking', 'Collars, leads & coats');
  if (R('παιχνιδ|toys?|μπαλακ|κοκκαλο παιχνιδ').test(t)) return yes('toys', 'Toys');
  if (R('περιποιησ|υγιειν|χτεν|βουρτσ|σαμπουαν|καθαριστικ|ατμοποιητ|πανα|σακουλακ|grooming|shampoo').test(t)) return yes('grooming', 'Grooming & hygiene');
  return miss('not matched to a Pets Gear World section');
}

const ROUTE = { sgw, tgw, vgw, agw, bgw, zgw };
export const LINKWISE_SECTION_SITES = Object.keys(ROUTE);

// label: the site (SGW, TGW, ...); source: its sources.json entry ("sectionsFor": "bgw-batteries" keeps only motorbike
// batteries of a car-battery shop; "onlyPath": a pattern the shop's category path must match).
export function linkwiseSection(label, name, feedCategory, source = null) {
  const site = String(label || '').toLowerCase();
  const route = source && source.sectionsFor === 'bgw-batteries' ? bgwBatteries : ROUTE[site];
  if (!route) return no(`no Greek sections for ${label}`);
  const n = g(displayName(name));
  if (!n) return no('no product name');
  if (NEVER_SHOPS.test(n)) return no('never on the sites (Linkwise terms)');
  const c = g(feedCategory);
  // "onlyPath" (sources.json): a shop of many departments (DealsShop) gives only those of this site.
  if (source && source.onlyPath && !R(source.onlyPath).test(c)) return no(`shop category of another department (${source.retailer || 'shop'})`);
  if (NEVER_NAME.test(n)) return no('medicine, supplement, adult, smoking, drink, voucher or weapon');
  if (site !== 'zgw' && NEVER_CAT.test(c)) return no('shop category of medicines, adult, smoking, food or drink');
  // The most specific part of the shop's category path (its last part) with the name first: "Αξεσουάρ Κινητών & Smartwatches >
  // Φορτιστές & Καλώδια" is a charger, not a smartwatch strap. When that matches nothing, the whole path with the name.
  const last = c.split(/\s*(?:>|\/|,)\s*/).filter(Boolean).pop() || '';
  const whole = `${c} | ${n}`;
  let r = route(`${last} | ${n}`, whole);
  if (!r.ok && !r.hard) r = route(whole, whole);
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ...r, name: displayName(name) };
}
