// Linkwise shops (Greece and Cyprus) on the older sites (owner, 19 Nov 2026: "Linkwise in tonight's command so the Greek
// shop opens today", lessons L199). Linkwise approved our 13 sites and the Hub (Greece and Cyprus) on 19 Nov 2026 and 236
// programmes on 18 Nov (approvals file of chat 7). Its terms: products only from its Product feed tool, shown only where
// the shop delivers (Greece and/or Cyprus: deliversTo of each site, Greek names: languages "el"), and never Public,
// Sephora, e-shop.gr, AB Vasilopoulos or Kotsovolos (they do not accept comparison sites).
// The feeds are in Greek: category paths and names are read in Greek here (accents and final sigma folded), and each
// product gets a category and subcategory the site already has (live databases of 19 Nov 2026, lessons L56).
// A shop that sells for women, men and children (Spartoo, Modivo, Answear ...) can go to more than one site (the
// programme's `also`): the audience in the name or the shop's category path ("Γυναίκα > Παπούτσια", "ΠΑΙΔΙ > ΑΓΟΡΙ")
// picks the site.
// Each programme has its own module (tools/import-rules/lw-<programme>.mjs) for the import tools; the retailer name is the
// shop's own with " GR" (or " CY" for a Cyprus-only programme), so it never mixes with a shop of the same name elsewhere
// (La Redoute, Laura Ashley ...).
import { PROGRAMMES } from './linkwise-programmes.mjs';

export const NEVER_SHOPS = /\b(public|sephora|e-shop\.gr|ab vasilopoulos|ab βασιλοπουλος|kotsovolos|κωτσοβολος)\b/i;

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
// Lower case, no accents, final sigma as sigma: "Γυναικεία Φορέματα" -> "γυναικεια φορεματα".
export const gr = s => fold(s).toLowerCase().replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
// Patterns are written in plain Greek, in lower case, and folded the same way (the text is lower-cased before it is
// read). \b of JavaScript knows only Latin letters, so here a \b before a word is "no letter or digit before" and one
// after a word "no letter or digit after" (one lookaround each: the classifiers read about a million names a night).
const START = '(?<![\\p{L}\\p{N}])', END = '(?![\\p{L}\\p{N}])';
export const R = s => {
  const parts = fold(s).split('\\b');
  let out = parts[0];
  // A \b after a letter, a digit or the end of a group or repeat closes a word; anywhere else it opens one.
  for (let i = 1; i < parts.length; i++) out += (/[\p{L}\p{N})?*+\]}]$/u.test(out) ? END : START) + parts[i];
  return new RegExp(out, 'u');
};

// Never on the sites: medicines and supplements (pharmacies: only cosmetics), adult products, smoking, food and drink,
// services and vouchers, weapons. Read in the name (and the shop's category for food), so toy food, capsule toys,
// "unisex", the colour "chocolate" or a vitamin C cream are not caught.
const NEVER_NAME = R([
  'συμπληρωμα', 'συμπληρωματ', '\\b\\d+ ?(caps|tabs|softgels|vcaps|καψουλες|ταμπλετες|δισκια|φακελισκοι|αναβραζοντα)\\b', 'αναβραζοντ',
  'σιροπι', 'αναλγητ', 'αντιβιοτ', 'ομοιοπαθ', 'προβιοτικ', 'πρωτεϊν', 'πρωτεινη σε σκονη', '\\bwhey\\b', '\\bφαρμακ(ο|α|ων)\\b',
  'τεστ (εγκυμοσυν|ωορρηξ|covid|αντιγον)', 'προφυλακτικ', 'ερωτικ', 'δονητ', '\\bsex(y|ual)?\\b', 'φετιχ', 'bdsm', 'vibrator', 'dildo',
  'τσιγαρ', 'ναργιλ', '\\bvape', 'e-?liquid', 'ατμοποιητ', 'αλκοολουχ', '\\bκρασι', 'ουισκι', 'βοτκα', '\\bμπυρα\\b',
  'voucher', 'δωροεπιταγ', 'δωροκαρτ', 'gift ?card', 'κουπονι',
  'σουγια', 'μαχαιρι επιθεσ', '\\bοπλ(ο|α)\\b(?! νερου)', 'αεροβολ', 'ξιφος', 'σπαθι',
  'βρεφικ(ο|ου) γαλα', 'γαλα (σε σκονη|1ης|2ης|3ης)', 'θερμομετρ', 'πιεσομετρ', 'σακχαρομετρ', 'ταινιες μετρησ', 'ακουστικ(α|ο) βαρηκοι'
].join('|'));
const NEVER_CAT = R(['συμπληρωματα', 'βιταμινες', '\\bφαρμακα\\b', 'ερωτικ', 'sex shop', 'τσιγαρ', '\\bποτα\\b', 'τροφιμα(?!.*(δοχει|παιχνιδ|αποθηκ))',
  'super ?market', '\\bκαφεσ\\b', '\\bσνακ\\b'].join('|'));
const pick = (t, list) => { for (const [re, a, b] of list) if (re.test(t)) return [a, b]; return null; };
// In a name the product comes first ("Παγκάκι χαλωρίου με μαξιλάρι" is a bench, "Μπλουζάκι Calvin Klein Jeans" a top):
// the rule whose match starts earliest wins, the list order breaks a tie.
const pickFirst = (n, list) => {
  let best = null, at = Infinity;
  for (const [re, a, b] of list) { const m = re.exec(n); if (m && m.index < at) { best = [a, b]; at = m.index; } }
  return best;
};
// In a category path the last, most specific part counts first ("Γυναίκα > Παπούτσια > Μπότες").
const pickPath = (t, list) => {
  const parts = String(t || '').split('>').map(x => x.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) { const hit = pick(parts[i], list); if (hit) return hit; }
  return null;
};
// Brand names that are words of a product type ("Calvin Klein Jeans", "U.S. Polo Assn", "The Body Shop") are left out of
// the name before it is read.
const BRAND_WORDS = R('(calvin klein|tommy|versace|liu jo|pepe|guess|armani exchange|armani|levi\\S*|g-star|replay|karl lagerfeld|moschino|hugo|boss) jeans( couture)?|u\\.?s\\.? polo( assn\\.?)?|polo ralph lauren|the body shop|shoe the bear|\\bjeans couture');
const cleanName = n => n.replace(new RegExp(BRAND_WORDS.source, 'gu'), ' ');

// Who a product is for, from its name first, then from the shop's category path: 'kids', 'men', 'women', 'unisex' or ''.
const KIDS = R('\\bπαιδ(ι|ια|ικ\\S*)\\b|\\bκοριτσ|\\bαγορ(ι|ια|ακι|ακια|ιστικ\\S*)\\b|βρεφ|\\bμωρ(ο|ου|α)\\b|μπεμπε|\\bbaby|\\bkids?\\b|junior|\\bjr\\b|newborn|νηπι|\\bteen');
const MEN = R('\\bανδρ(ασ|εσ|ικ\\S*)\\b|\\bαντρ(ασ|εσ|ικ\\S*)\\b|\\bmen\\b|\\bmens\\b|\\bman\\b|\\bhomme\\b|\\bmale\\b');
const WOMEN = R('\\bγυναικ\\S*|\\bwom[ae]n\\b|\\blady\\b|\\bladies\\b|\\bfemme\\b');
const UNISEX = R('unisex');
export function audience(n, t = '') {
  for (const s of [n, t]) {
    if (!s) continue;
    if (KIDS.test(s)) return 'kids';
    const m = MEN.test(s), w = WOMEN.test(s);
    if (m && !w) return 'men';
    if (w && !m) return 'women';
    if ((m && w) || UNISEX.test(s)) return 'unisex';
  }
  return '';
}

// ---------- Women's Gear World (WGW) ----------
const W_CLOTHES = [
  [R('φορεμα|φουστανι|\\bdress\\b'), 'Clothing', 'Dresses'],
  [R('ολοσωμ|\\bjumpsuit|σαλοπετ'), 'Clothing', 'Clothing'],
  [R('πιτζαμ|νυχτικ|\\bρομπ(α|εσ|ακι)\\b|loungewear|homewear'), 'Clothing', 'Nightwear'],
  [R('κολαν|leggings'), 'Clothing', 'Leggings'],
  [R('καλσον|καλτσον'), 'Clothing', 'Tights & Stockings'],
  [R('καλτσ'), 'Clothing', 'Socks'],
  [R('αθλητικ(ο|α) μπουστακ|sports bra'), 'Clothing', 'Sports Bras & Tops'],
  [R('σουτιεν|κιλοτ|στρινγκ|εσωρουχ|lingerie|\\bσλιπ|μπουστακ|\\bbra\\b'), 'Clothing', 'Underwear'],
  [R('μαγιο|bikini|μπικινι|\\bπαρεο|swimsuit'), 'Clothing', 'Clothing'],
  [R('\\bτζιν\\b|\\bjeans?\\b|denim'), 'Clothing', 'Jeans'],
  [R('φουστα'), 'Clothing', 'Skirts'],
  [R('σορτσ|βερμουδ|\\bshorts\\b'), 'Clothing', 'Shorts'],
  [R('παντελον|\\bchino|\\bcargo|jogger|\\bpants\\b|trousers'), 'Clothing', 'Trousers'],
  [R('κουκουλ|hoodie'), 'Clothing', 'Hoodies'],
  [R('φουτερ|sweatshirt'), 'Clothing', 'Sweatshirts'],
  [R('πλεκτ|πουλοβερ|ζακετα|cardigan|ζιβαγκο|\\bknit'), 'Clothing', 'Knitwear'],
  [R('μπουφαν|παλτο|καμπαρντιν|τζακετ|σακακ|blazer|γιλεκο|γουνα|πανωφορι|αδιαβροχο (μπουφαν|παλτο)|αντιανεμικ|\\bparka|\\btrench|\\bjacket|\\bcoat\\b'), 'Clothing', 'Jackets & Coats'],
  [R('t-shirt|t shirt|tshirt|κοντομανικ'), 'Clothing', 'T-Shirts'],
  [R('μπλουζ|πουκαμισ|\\bτοπ\\b|\\btop\\b|\\bcrop\\b|κορμακ|τουνικ|καφταν|\\bblouse|\\bshirt\\b'), 'Clothing', 'Tops & Blouses'],
  [R('κοστουμ|ταγιερ'), 'Clothing', 'Suits'],
  [R('φορμα\\b|φορμεσ\\b|αθλητικ(ο|α) σετ'), 'Clothing', 'Activewear']
];
const W_SHOES = [
  [R('παντοφλ|slipper'), 'Shoes', 'Slippers'],
  [R('\\bμποτ|μποτακ|γαλοτσ|\\bboots?\\b|αρβυλ'), 'Shoes', 'Boots'],
  [R('sneaker|αθλητικ(α|ο) παπουτσ|παπουτσια (τρεξιματοσ|running)|\\brunning\\b'), 'Shoes', 'Trainers'],
  [R('(πεδιλ|σανδαλ)\\S* με (ψηλο |λεπτο |χοντρο )?τακουν|\\bγοβ(α|εσ)\\b|τακουν(ι|ια)\\b(?! χωρισ)|\\bmules?\\b|\\bheels?\\b'), 'Shoes', 'Heels'],
  [R('πεδιλ|σανδαλ|σαγιοναρ|εσπαντριγ|flip ?flop|\\bslides?\\b|τσοκαρ'), 'Shoes', 'Sandals'],
  [R('παπουτσ|μπαλαριν|loafer|μοκασιν|\\boxford|\\bδετα\\b|\\bshoes?\\b'), 'Shoes', 'Shoes']
];
const JEWELLERY = cat => [
  [R('μανικετοκουμπ'), cat, cat === "Men's Jewellery" ? 'Cufflinks' : 'Jewellery'],
  [R('δαχτυλιδ|δακτυλιδ|\\bβερ(α|εσ)\\b(?! αλοη)|μονοπετρ|\\brings?\\b'), cat, 'Rings'],
  [R('σκουλαρικ|earring'), cat, 'Earrings'],
  [R('βραχιολ|ποδαρακ|bracelet'), cat, 'Bracelets'],
  [R('κολιε|αλυσιδ(α|ιτσα|εσ) (λαιμου|ασημ|χρυσ)|μενταγιον|\\bσταυρ(οσ|οι|ουδακι|ακι|ουσ)\\b|φυλαχτ|necklace|pendant|\\bγουρι'), cat, 'Necklaces'],
  [R('κοσμημα|κοσμηματ|jewel'), cat, 'Jewellery']
];
const W_ACCESSORIES = [
  [R('γυαλια ηλιου|sunglass'), 'Bags & Accessories', 'Sunglasses'],
  [R('σκελετ(οσ|οι) γυαλι|γυαλια ορασ|οπτικ(α|ο) γυαλ|eyeglass'), 'Bags & Accessories', 'Eyeglasses'],
  [R('πορτοφολ|καρτοθηκ|wallet|purse'), 'Bags & Accessories', 'Wallets & Purses'],
  [R('τσαντ|σακιδι|backpack|clutch|\\bbags?\\b|\\btote\\b|νεσεσερ'), 'Bags & Accessories', 'Bags'],
  [R('κασκολ|φουλαρ|μαντηλ|εσαρπ|\\bσαλι\\b|πασμιν|\\bscarf'), 'Bags & Accessories', 'Scarves'],
  [R('καπελ|σκουφ|\\bμπερε\\b|τραγιασκ|\\bhat\\b|beanie|\\bcap\\b'), 'Bags & Accessories', 'Hats'],
  [R('\\bγαντ(ια|ι)\\b|glove'), 'Bags & Accessories', 'Gloves'],
  [R('\\bζων(η|εσ)\\b|\\bbelt\\b'), 'Bags & Accessories', 'Belts'],
  [R('τσιμπιδακι μαλλ|κοκαλακ|\\bστεκα|λαστιχακι μαλλ|scrunch|hair clip|φουρκετ'), 'Bags & Accessories', 'Hair Accessories'],
  [R('ομπρελ|μπρελοκ|keyring'), 'Bags & Accessories', 'Accessories']
];
const BEAUTY = cat => [
  [R('σετ δωρου|gift set|κασετινα|σετ περιποιησ'), cat, 'Gift sets'],
  [R('\\bαρωμα|eau de|parfum|κολονια|\\bedp\\b|\\bedt\\b|body mist|perfume|αρωματικο νερο'), cat, 'Fragrance'],
  [R('αποτριχ|αποτριχωτικ|epilat|κερι αποτρ|ξυριστικη μηχανη|ξυραφ|\\brazor'), cat, 'Hair removal'],
  [R('πιστολακ|ισιωτικ|σεσουαρ|ψαλιδ(α|ι) μαλλ|μπουκλ(ιερ|ωτ)|hair dryer|straightener'), cat, 'Hair tools'],
  [R('\\bνυχι|βερνικι νυχ|gel polish|\\bnail|ημιμονιμο βερνικ|\\bτιπσ\\b'), cat, 'Nails'],
  [R('μακιγιαζ|μεικ απ|κραγιον|μασκαρα|foundation|πουδρα|σκιεσ ματιων|σκια ματιων|\\bρουζ\\b|\\blip(stick|s)?\\b|\\blip (balm|gloss|liner|oil|crayon|care|tint)|eyeliner|κονσιλερ|make ?-?up|blush|bronzer|highlighter|primer|μολυβι (για τα )?(ματια|ματιων|χειλη|χειλιων)|lipstick|gloss|φρυδι|mascara|\\blash|eyeshadow|concealer|\\bbrow'), cat, 'Make-up'],
  [R('σαμπουαν|μαλλι|conditioner|μαλακτικο μαλλ|βαφη μαλλ|\\bhair|λακ μαλλ'), cat, 'Hair care'],
  [R('πινελ|σφουγγαρακι μακιγ|καθρεφτακ|\\bbrush|beauty blender|ψηκτρ'), cat, 'Beauty tools'],
  [R('αφρολουτρ|τζελ (για )?ντουσ|σαπουν|σωματοσ|κρεμα σωματ|body lotion|body butter|αποσμητικ|scrub σωμ|λαδι σωμ|deodorant|shower|κρεμα χεριων'), cat, 'Bath & body'],
  [R('κρεμα|\\bορο(σ|υ)?\\b|serum|καθαρισμ|μασκα προσωπ|αντηλιακ|ματιων|προσωπ|tonic|τονωτικ|micellar|ενυδατ|αντιγηραντ|\\bspf|\\bskin|δερμα|αντιρυτιδ'), cat, 'Skincare']
];
const BEAUTY_CAT = R('καλλυντικ|ομορφι|περιποιησ|μακιγιαζ|αρωματα|beauty|personal care|cosmetic|make ?up|φαρμακει|parapharm|skin ?care|hair ?care');
const WATCH = R('ρολο(ι|για)\\b|\\bwatch(es)?\\b|smartwatch');
function fashion(t, n, { clothes, shoes, jewel, acc, beauty, watch, beautyFirst }) {
  const name = cleanName(n);
  if (WATCH.test(name) && !/λουρακι|μπρασελε|strap/.test(name)) return watch;
  const all = beautyFirst ? [...beauty, ...shoes, ...clothes, ...jewel, ...acc] : [...shoes, ...clothes, ...jewel, ...acc, ...beauty];
  // A beauty shop's product is beauty when its name says so anywhere ("... αδιάβροχη μάσκαρα" is not a raincoat).
  const hit = (beautyFirst && pickFirst(name, beauty)) || pickFirst(name, all) || pickPath(t, all);
  return hit || (WATCH.test(t) ? watch : null);
}
function wgw(t, n) {
  const a = audience(n, t);
  if (a === 'men') return { reject: "a men's product (Men's Gear World)" };
  if (a === 'kids') return { reject: "a children's product (Kids' Gear World)" };
  const hit = fashion(t, n, { clothes: W_CLOTHES, shoes: W_SHOES, jewel: JEWELLERY("Women's Jewellery"), acc: W_ACCESSORIES,
    beauty: BEAUTY('Beauty & Fragrances'), watch: ['Watches', 'Watches'], beautyFirst: BEAUTY_CAT.test(t) });
  return hit ? { site: 'wgw', siteCategory: hit[0], subcategory: hit[1] } : { reject: "not clearly a women's product of WGW" };
}

// ---------- Men's Gear World (MGW) ----------
const M_CLOTHES = [
  [R('κοστουμ|\\bsuit\\b'), 'Clothing', 'Suits'],
  [R('πιτζαμ|\\bρομπ(α|εσ)\\b|loungewear'), 'Clothing', 'Nightwear'],
  [R('καλτσ'), 'Clothing', 'Socks'],
  [R('μποξερ|\\bσλιπ|εσωρουχ|φανελακι|\\bboxer|\\bbriefs?\\b|\\btrunks?\\b'), 'Clothing', 'Underwear'],
  [R('μαγιο|swim'), 'Clothing', 'Shorts'],
  [R('\\bτζιν\\b|\\bjeans?\\b|denim'), 'Clothing', 'Jeans'],
  [R('σορτσ|βερμουδ|\\bshorts\\b'), 'Clothing', 'Shorts'],
  [R('παντελον|\\bchino|\\bcargo|jogger|\\bφορμ(α|εσ)\\b|\\bpants\\b|trousers'), 'Clothing', 'Trousers'],
  [R('κουκουλ|hoodie'), 'Clothing', 'Hoodies'],
  [R('φουτερ|sweatshirt'), 'Clothing', 'Sweatshirts'],
  [R('πλεκτ|πουλοβερ|ζακετα|cardigan|ζιβαγκο|\\bknit'), 'Clothing', 'Knitwear'],
  [R('μπουφαν|παλτο|καμπαρντιν|τζακετ|σακακ|blazer|γιλεκο|αδιαβροχο (μπουφαν|παλτο)|αντιανεμικ|\\bparka|πανωφορι|\\bjacket|\\bcoat\\b|overshirt'), 'Clothing', 'Jackets'],
  [R('t-shirt|t shirt|tshirt|κοντομανικ|\\bpolo\\b'), 'Clothing', 'T-Shirts'],
  [R('πουκαμισ|υποκαμισ|\\bshirt\\b'), 'Clothing', 'Shirts'],
  [R('μπλουζ|φανελα'), 'Clothing', 'Clothing']
];
const M_SHOES = [
  [R('παντοφλ|slipper'), 'Shoes', 'Slippers'],
  [R('\\bμποτ|μποτακ|\\bboots?\\b|αρβυλ'), 'Shoes', 'Boots'],
  [R('πεδιλ|σανδαλ|σαγιοναρ|εσπαντριγ|\\bslides?\\b|τσοκαρ'), 'Shoes', 'Sandals'],
  [R('sneaker|αθλητικ(α|ο) παπουτσ|\\brunning\\b|trainer'), 'Shoes', 'Trainers'],
  [R('παπουτσ|loafer|μοκασιν|\\boxford|\\bδετα\\b|\\bderby\\b|\\bshoes?\\b'), 'Shoes', 'Shoes']
];
const M_ACCESSORIES = [
  [R('γραβατ|παπιγιον|\\btie\\b|bow ?tie'), 'Bags & Accessories', 'Ties'],
  [R('γυαλια ηλιου|sunglass'), 'Bags & Accessories', 'Sunglasses'],
  [R('σκελετ(οσ|οι) γυαλι|γυαλια ορασ|οπτικ(α|ο) γυαλ'), 'Bags & Accessories', 'Accessories'],
  [R('πορτοφολ|καρτοθηκ|wallet'), 'Bags & Accessories', 'Wallets & Purses'],
  [R('τσαντ|σακιδι|backpack|\\bbags?\\b|βαλιτσ|νεσεσερ'), 'Bags & Accessories', 'Bags'],
  [R('κασκολ|φουλαρ|\\bscarf'), 'Bags & Accessories', 'Scarves'],
  [R('καπελ|σκουφ|τραγιασκ|\\bhat\\b|beanie|\\bcap\\b'), 'Bags & Accessories', 'Hats'],
  [R('\\bγαντ(ια|ι)\\b|glove'), 'Bags & Accessories', 'Gloves'],
  [R('\\bζων(η|εσ)\\b|\\bbelt\\b|τιραντ'), 'Bags & Accessories', 'Belts'],
  [R('ομπρελ|μπρελοκ|keyring|μαντηλακι τσεπ|pocket square'), 'Bags & Accessories', 'Accessories']
];
const M_GROOMING = [
  [R('σετ δωρου|gift set|κασετινα'), 'Grooming & Fragrances', 'Gift sets'],
  [R('\\bαρωμα|eau de|parfum|κολονια|\\bedp\\b|\\bedt\\b|perfume'), 'Grooming & Fragrances', 'Fragrance'],
  [R('αποσμητικ|deodorant'), 'Grooming & Fragrances', 'Deodorant'],
  [R('γενει|μουσι|beard'), 'Grooming & Fragrances', 'Beard care'],
  [R('ξυρισ|aftershave|after shave|shaving|ξυραφ'), 'Grooming & Fragrances', 'Shaving'],
  [R('κουρευτικ|trimmer|clipper'), 'Grooming & Fragrances', 'Trimmers & clippers'],
  [R('σαμπουαν|μαλλι|\\bhair|πομαδ|\\bwax\\b|gel μαλλ'), 'Grooming & Fragrances', 'Hair care'],
  [R('κρεμα|προσωπ|ματιων|serum|\\bορο(σ|υ)?\\b|καθαρισμ|\\bskin|αντηλιακ'), 'Grooming & Fragrances', 'Skincare'],
  [R('αφρολουτρ|τζελ (για )?ντουσ|σαπουν|σωματοσ|shower'), 'Grooming & Fragrances', 'Grooming']
];
function mgw(t, n) {
  const a = audience(n, t);
  if (a === 'women') return { reject: "a women's product (Women's Gear World)" };
  if (a === 'kids') return { reject: "a children's product (Kids' Gear World)" };
  const hit = fashion(t, n, { clothes: M_CLOTHES, shoes: M_SHOES, jewel: JEWELLERY("Men's Jewellery"), acc: M_ACCESSORIES,
    beauty: M_GROOMING, watch: ['Watches', "Men's Watches"], beautyFirst: BEAUTY_CAT.test(t) });
  return hit ? { site: 'mgw', siteCategory: hit[0], subcategory: hit[1] } : { reject: "not clearly a men's product of MGW" };
}

// ---------- Kids' Gear World (KGW) ----------
const K_LIST = [
  [R('\\bπαν(α|εσ)\\b|πανακι βρακ|\\bnapp(y|ies)\\b|diaper'), 'Baby & Toddler', 'Nappies'],
  [R('μωρομαντηλ|baby wipes'), 'Baby & Toddler', 'Baby Wipes'],
  [R('μπιμπερο|\\bθηλ(η|εσ)\\b|baby bottle'), 'Baby & Toddler', 'Baby Bottles'],
  [R('πιπιλ|μασητικ|soother|teether'), 'Baby & Toddler', 'Baby Soothers'],
  [R('σαλιαρ|\\bbibs?\\b'), 'Baby & Toddler', 'Bibs'],
  [R('μπανιερ|μπανιο μωρου|βρεφικ(ο|α) αφρολ|baby bath'), 'Baby & Toddler', 'Baby Bathing'],
  [R('αλλαξιερ|changing'), 'Baby & Toddler', 'Changing Mats & Trays'],
  [R('μαρσιπ|baby carrier'), 'Baby & Toddler', 'Baby Carriers'],
  [R('\\bκουνι(α|εσ)\\b|λικνο|\\bcrib|cradle|παρκο μωρου'), 'Baby & Toddler', 'Cribs & Cradles'],
  [R('καροτσι μωρου|καροτσακι|καθισμα αυτοκ|stroller|\\bpram'), 'Baby & Toddler', 'Baby Pushchair & Pram Accessories'],
  [R('κουδουνιστρ|rattle'), 'Baby & Toddler', 'Rattles'],
  [R('\\blego\\b|τουβλακ|κατασκευ'), 'Toys & Games', 'Construction Set Toys'],
  [R('playmobil|playset'), 'Toys & Games', 'Dolls, Playsets & Toy Figures'],
  [R('barbie|κουκλ(α|εσ|ακι)|\\bdolls?\\b'), 'Toys & Games', 'Dolls'],
  [R('λουτριν|\\bplush|αρκουδακ'), 'Toys & Games', 'Stuffed Animals & Cuddly Toys'],
  [R('επιτραπεζ|board game'), 'Toys & Games', 'Board Games'],
  [R('\\bπαζλ\\b|puzzle'), 'Toys & Games', 'Jigsaw Puzzles'],
  [R('τηλεκατευθ|\\br/?c\\b|remote control'), 'Toys & Games', 'Remote Control Cars & Lorries'],
  [R('φιγουρ|\\bfigur'), 'Toys & Games', 'Action & Toy Figures'],
  [R('αυτοκινητακ|φορτηγακ|toy car|hot wheels|matchbox'), 'Toys & Games', 'Toy Cars'],
  [R('τρενο|τρενακ|σιδηροδρομ|\\btrains?\\b'), 'Toys & Games', 'Toy Trains & Train Sets'],
  [R('πλαστελιν|play-?doh|\\bslime\\b'), 'Toys & Games', 'Play Dough & Putty'],
  [R('καλλιτεχν|ζωγραφ|χειροτεχν|δημιουργικ|\\bcraft'), 'Toys & Games', 'Toy Craft Kits'],
  [R('εκπαιδευτ|\\bstem\\b|επιστημ|πειραμ'), 'Toys & Games', 'Educational Toys'],
  [R('μουσικ(ο|α) παιχν|κιθαρακ|αρμονι'), 'Toys & Games', 'Musical Toys'],
  [R('κουζινακ|play food|σετ τροφιμων'), 'Toys & Games', 'Toy Kitchens & Play Food'],
  [R('αεροπλαν'), 'Toys & Games', 'Toy Aeroplanes'],
  [R('νεροπιστολ|οπλο νερου|blaster|\\bnerf\\b'), 'Toys & Games', 'Toy Weapons & Gadgets'],
  [R('τραπουλ|παιχνιδι καρτων|card game|\\buno\\b'), 'Toys & Games', 'Card Games'],
  [R('μπαλον(ι|ια)'), 'Toys & Games', 'Balloon Kits'],
  [R('παιχνιδ|\\btoys?\\b'), 'Toys & Games', 'Toys & Games'],
  [R('βιβλι(ο|α)\\b'), 'Gifts for Kids', 'Print Books'],
  [R('βαπτιστικ|λαδοπαν|λαμπαδ(α|εσ) βαπτ'), 'Baby & Toddler', 'Baby & Toddler'],
  [R('παγουρ|θερμοσ φαγητ|θερμοδοχ|φαγητοδοχ|δοχει(ο|α) φαγητ|\\blunch'), 'School & Backpacks', 'Lunch Boxes & Bags'],
  [R('αναστημομετρ|φωτακι νυκτ|night light'), 'Bedroom & Home', 'Bedroom & Home'],
  [R('σχολικ(η|εσ) τσαντ|σακιδι|backpack'), 'School & Backpacks', 'School Bags'],
  [R('κασετιν|pencil case'), 'School & Backpacks', 'Pencil Cases'],
  [R('μαρκαδορ|ξυλομπογ|μπογι|τετραδι|γραφικ(η|α) υλ'), 'School & Backpacks', 'Stationery & Art Supplies'],
  [R('πατινι|scooter'), 'Sports & Outdoors', 'Riding Scooters'],
  [R('ποδηλατ|\\bbikes?\\b'), 'Sports & Outdoors', 'Bicycles'],
  [R('τραμπολιν'), 'Sports & Outdoors', 'Trampolines'],
  [R('\\bμποτ|μποτακ|γαλοτσ|\\bboots?\\b'), 'Shoes', 'Winter Boots'],
  [R('sneaker|αθλητικ(α|ο) παπουτσ|trainer'), 'Shoes', 'Trainers'],
  [R('παπουτσ|πεδιλ|σανδαλ|σαγιοναρ|παντοφλ|\\bshoes?\\b'), 'Shoes', 'Shoes'],
  [R('καλτσ'), 'Clothing', 'Socks'],
  [R('πιτζαμ|νυχτικ|\\bρομπ(α|ακι)\\b'), 'Clothing', 'Nightwear & Loungewear'],
  [R('φορεμα|φουστ|παντελον|μπλουζ|πουκαμισ|μπουφαν|ζακετ|φουτερ|κολαν|σορτσ|βερμουδ|ολοσωμ|\\bφορμ|μαγιο|t-shirt|κορμακ|φορμακ|εσωρουχ|σετ ρουχ|\\bρουχ'), 'Clothing', 'Clothing'],
  [R('ρολο(ι|για)\\b|\\bwatch'), 'Accessories', 'Kids Watches'],
  [R('καπελ|σκουφ|\\bγαντ|κασκολ|τσαντ|κοσμημ|σκουλαρ|βραχιολ|αξεσουαρ'), 'Accessories', 'Accessories'],
  [R('σεντον|παπλωμ|κουβερτ|μαξιλαρ|κουρτιν|\\bχαλ(ι|ακι)\\b|φωτιστικ|επιπλ|κρεβατ|ντουλαπ|κομοδιν|γραφει'), 'Bedroom & Home', 'Bedroom & Home']
];
function kgw(t, n) {
  const a = audience(n, t);
  if (a === 'men' || a === 'women') return { reject: 'an adult product' };
  const hit = pickFirst(cleanName(n), K_LIST) || pickPath(t, K_LIST);
  return hit ? { site: 'kgw', siteCategory: hit[0], subcategory: hit[1] } : { reject: "not clearly a children's product of KGW" };
}

// ---------- Home Gear World (HGW) ----------
const H_LIST = [
  [R('σκελετ\\S* κρεβ|πλαισιο κρεβ|χωρ(\\.|ισ) στρωμα|bed frame'), 'Furniture', 'Bed Frame'],
  [R('ντουλαπι κρεβατ|κομοδιν|bedside'), 'Furniture', 'Bedside Table'],
  [R('επιπλο tv|επιπλο τηλεορασ|ντουλαπι tv|\\btv unit|εδρανο tv|συνθετο'), 'Furniture', 'TV Unit'],
  [R('επιστρωμ|ανωστρωμ|topper'), 'Bedding & Bath', 'Mattress Topper'],
  [R('καλυμμα στρωμ|προστατευτικ(ο|α) στρωμ'), 'Bedding & Bath', 'Mattress Protector'],
  [R('\\b(?<!χωρ\\.? |χωρισ )στρωμα\\b|\\bστρωματα\\b|mattress\\b'), 'Furniture', 'Mattress'],
  [R('σεντον'), 'Bedding & Bath', 'Bed Sheet'],
  [R('παπλωματοθηκ|σετ κρεβατ|λευκα ειδη κρεβατοκαμαρ'), 'Bedding & Bath', 'Bed Linen'],
  [R('παπλωμ|κουβερλι|duvet'), 'Bedding & Bath', 'Duvet'],
  [R('μαξιλαρ\\S* διακοσμ|διακοσμητικ\\S* μαξιλαρ|μαξιλαρ\\S* (καναπε|καρεκλ|εξωτερικου)|μαξιλαροθηκη διακοσμ|cushion'), 'Home Decor', 'Cushion'],
  [R('μαξιλαροθηκ|μαξιλαρι υπνου|μαξιλαρι ανατομ|\\bμαξιλαρ(ι|ια)\\b|pillow'), 'Bedding & Bath', 'Pillow'],
  [R('μπουρνουζ|bathrobe'), 'Bedding & Bath', 'Bathrobe'],
  [R('ταπετ(ο|α) μπανιου|πατακι μπανιου'), 'Bedding & Bath', 'Bath Mat'],
  [R('πετσετ(α|εσ) (κουζιν|φαγητ)'), 'Kitchen & Dining', 'Table Linen'],
  [R('πετσετ|\\btowels?\\b'), 'Bedding & Bath', 'Towel'],
  [R('αξεσουαρ μπανιου|σαπουνοθηκ|dispenser|ποτηρι μπανιου|κουρτινα μπανιου|πιγκαλ|θηκη οδοντοβ'), 'Bedding & Bath', 'Bathroom Accessories'],
  [R('ηλεκτρικ(ο|η|εσ) (κουβερτ|υποστρωμ)'), 'Bedding & Bath', 'Electric Blankets & Warmers'],
  [R('ριχταρ|κουβερτ|ζαπλουτ|\\bthrow\\b'), 'Home Decor', 'Throw'],
  [R('\\bχαλ(ι|ια)\\b|διαδρομοσ|\\brugs?\\b|carpet'), 'Home Decor', 'Rug'],
  [R('κουρτιν'), 'Home Decor', 'Curtain'],
  [R('\\bστορ(ι|ακι|ια)?\\b|περσιδ|\\bblinds?\\b'), 'Home Decor', 'Blinds'],
  [R('καθρεπτ|καθρεφτ|mirror'), 'Home Decor', 'Mirror'],
  [R('\\bβαζ(ο|α)\\b(?! κουζ)|\\bvase'), 'Home Decor', 'Vase'],
  [R('\\bκερι\\b|\\bκερια\\b|αρωματικ(ο|α) (χωρου|κερι)|αρωματιστη|diffuser|\\breed|θυμιατ|wax melt'), 'Home Decor', 'Home Fragrance'],
  [R('ρολο(ι|για) τοιχου|ξυπνητηρ|\\bclock'), 'Home Decor', 'Clock'],
  [R('\\bπινακ(ασ|εσ)\\b|καδρ|αφισ|κορνιζ|wall art|καμβα|αυτοκ[oο]λλητ|sticker'), 'Home Decor', 'Wall Art'],
  [R('χριστουγενν|στολιδ|φατνη|christmas|xmas'), 'Home Decor', 'Christmas'],
  [R('τεχνητ(ο|α) φυτ|τεχνητ(ο|α) λουλουδ|artificial'), 'Home Decor', 'Artificial Plants'],
  [R('ταινια led|led strip'), 'Lighting', 'Lighting Accessories'],
  [R('φωτιστικ\\S* οροφ|πλαφονιερ|\\bσποτ\\b|χωνευτ|ceiling'), 'Lighting', 'Ceiling Light'],
  [R('κρεμαστ\\S* φωτιστ|φωτιστικ\\S* κρεμαστ|pendant'), 'Lighting', 'Pendant Light'],
  [R('απλικ|φωτιστικ\\S* τοιχ|wall light'), 'Lighting', 'Wall Light'],
  [R('πολυελαι|chandelier'), 'Lighting', 'Chandelier'],
  [R('φωτιστικ\\S* δαπεδου|λαμπαδερ|floor lamp'), 'Lighting', 'Floor Lamp'],
  [R('αμπαζουρ|καπελο φωτιστ|lampshade'), 'Lighting', 'Lampshade'],
  [R('πορτατιφ|επιτραπεζι\\S* φωτιστ|table lamp'), 'Lighting', 'Table Lamp'],
  [R('λαμπτηρ|λαμπα led|\\bλαμπ(α|εσ)\\b|\\bbulbs?\\b'), 'Lighting', 'Light Bulb'],
  [R('φωτιστικ|\\blamps?\\b'), 'Lighting', 'Table Lamp'],
  [R('τραπεζομαντηλ|τραπεζοκαρε|τραβερσ|ραννερ|σουπλα|table linen|ποδι(α|εσ) κουζ'), 'Kitchen & Dining', 'Table Linen'],
  [R('μαχαιροπιρουν|\\bκουταλ|\\bπιρουν|cutlery'), 'Kitchen & Dining', 'Cutlery'],
  [R('μαχαιρ(ι|ια) κουζιν|μαχαιρ(ι|ια) chef|σετ μαχαιρ|\\bknife|\\bknives'), 'Kitchen & Dining', 'Kitchen Knives'],
  [R('τηγαν|γουοκ|\\bwok\\b|frying'), 'Kitchen & Dining', 'Frying Pan'],
  [R('κατσαρολ|χυτρ|γαστρ|ταψι|φορμα (κεικ|ψησ)|cookware|σωτεζ'), 'Kitchen & Dining', 'Cookware'],
  [R('σερβιτσ(ιο|ια) φαγητ|σετ πιατων'), 'Kitchen & Dining', 'Dinner Set'],
  [R('επιφανει(α|εσ) κοπ|ξυλ(ο|α) κοπ|chopping'), 'Kitchen & Dining', 'Chopping Board'],
  [R('δοχει(ο|α) (φαγητ|τροφιμ|αποθηκευσ)|φαγητοδοχ|τροφοδοχ|βαζ(ο|α) κουζ'), 'Kitchen & Dining', 'Food Storage'],
  [R('ποτηρ(ι|ια) (κρασ|νερου|σαμπαν|ουισκ|κοκτειλ)|ποτηρια\\b|κανατα|καραφ|\\bglass(es)?\\b'), 'Kitchen & Dining', 'Glassware'],
  [R('\\bκουπ(α|εσ)\\b|φλιτζαν|θερμοσ\\b|παγουρ|\\bmugs?\\b'), 'Kitchen & Dining', 'Drinkware'],
  [R('\\bπιατ(ο|α)\\b|πιατελ|σερβιτσ|\\bμπολ\\b|δισκο(σ|ι) σερβ|tableware'), 'Kitchen & Dining', 'Tableware'],
  [R('αξεσουαρ μπαρ|σεικερ|shaker'), 'Kitchen & Dining', 'Bar Accessories'],
  [R('ειδη κουζιν|σκευ(η|οσ) κουζ|εργαλει\\S* κουζ|σπατουλ|τριφτ|σουρωτηρ|μυλοσ (πιπερ|αλατ)|κοπτηρ|ζυγαρια κουζ|utensil'), 'Kitchen & Dining', 'Kitchen Utensil'],
  [R('σκουπα|vacuum'), 'Home Appliances', 'Vacuum Cleaner'],
  [R('βραστηρ|kettle'), 'Home Appliances', 'Kettle'],
  [R('καφετιερ|μηχανη (καφε|espresso)|coffee machine'), 'Home Appliances', 'Coffee Machine'],
  [R('air ?fryer|φριτεζ'), 'Home Appliances', 'Air Fryer'],
  [R('ανεμιστηρ|\\bfan\\b'), 'Home Appliances', 'Fan'],
  [R('θερμαστρ|καλοριφερ|θερμοπομπ|heater'), 'Home Appliances', 'Heater'],
  [R('αφυγραντ|dehumid'), 'Home Appliances', 'Dehumidifier'],
  [R('καθαριστη(σ|ρασ) αερα|air purifier'), 'Home Appliances', 'Air Purifier'],
  [R('μπλεντερ|μιξερ|πολυμιξερ|blender'), 'Home Appliances', 'Blender'],
  [R('τοστιερ|φρυγανιερ|toaster'), 'Home Appliances', 'Toaster'],
  [R('μουλτι?κουκερ|πολυκουζιν|κουζινομηχαν|food processor|πολυμηχαν'), 'Home Appliances', 'Food Processor'],
  [R('φουρνοσ μικροκυμ|microwave'), 'Home Appliances', 'Microwave'],
  [R('κλιματιστικ|air condition'), 'Home Appliances', 'Air Conditioner'],
  [R('στεγνωτηρ(ιο|ια) ρουχ|tumble'), 'Home Appliances', 'Tumble Dryer'],
  [R('πλυντηριο ρουχ|washing machine'), 'Home Appliances', 'Washing Machine'],
  [R('relax|ανακλιν\\S* πολυθρον|recliner'), 'Furniture', 'Recliner'],
  [R('σετ σαλονι|\\bκαναπ(εσ|εδεσ|ε)\\b|καναπεσ|\\bsofa'), 'Furniture', 'Sofa'],
  [R('πολυθρον|armchair|μπερζερ'), 'Furniture', 'Armchair'],
  [R('σετ τραπεζαρι|σετ μπαρ|τραπεζαρια με (καρεκλ|\\d)|dining set'), 'Furniture', 'Dining Set'],
  [R('τραπεζακι σαλονιου|τραπεζι σαλονιου|coffee table'), 'Furniture', 'Coffee Table'],
  [R('βοηθητικ\\S* τραπεζ|side table'), 'Furniture', 'Side Table'],
  [R('κονσολ(α|εσ)\\b|console'), 'Furniture', 'Console Table'],
  [R('τουαλετα (κρεβατοκ|μακιγ)|dressing table'), 'Furniture', 'Dressing Table'],
  [R('τραπεζαρι|τραπεζι|dining table'), 'Furniture', 'Dining Table'],
  [R('σκαμπ|bar stool'), 'Furniture', 'Bar Stool'],
  [R('καρεκλ\\S* γραφει|office chair|gaming chair'), 'Home Office', 'Office Chair'],
  [R('γραφει(ο|α)\\b|\\bdesk\\b'), 'Home Office', 'Office Desk'],
  [R('καρεκλ|\\bchairs?\\b'), 'Furniture', 'Dining Chair'],
  [R('κεφαλαρ|headboard'), 'Furniture', 'Headboard'],
  [R('κρεβατ'), 'Furniture', 'Bed Frame'],
  [R('ντουλαπ(α|εσ)\\b|wardrobe'), 'Furniture', 'Wardrobe'],
  [R('συρταριερ|chest of drawers'), 'Furniture', 'Chest Of Drawers'],
  [R('μπουφε|sideboard'), 'Furniture', 'Sideboard'],
  [R('βιβλιοθηκ|bookcase'), 'Furniture', 'Bookcase'],
  [R('\\bβιτριν(α|εσ)\\b|display cabinet'), 'Furniture', 'Display Cabinet'],
  [R('παγκακ|\\bπαγκοσ\\b|\\bbench'), 'Furniture', 'Bench'],
  [R('μπαουλ|υποποδ|\\bπουφ|footstool'), 'Furniture', 'Footstool'],
  [R('παπουτσοθηκ|shoe rack'), 'Storage & Organisation', 'Shoe Rack'],
  [R('καλογερ|κρεμαστρα (δαπεδου|τοιχου)|coat stand'), 'Storage & Organisation', 'Coat Stand'],
  [R('ρουχοκρεμαστρ(α|εσ) δαπεδου|clothes rail|σταντ ρουχων'), 'Storage & Organisation', 'Clothes Rail'],
  [R('ραφιερ|\\bραφ(ι|ια)\\b|shelving|\\bshelf'), 'Storage & Organisation', 'Shelving Unit'],
  [R('καλαθ(ι|ια) (απλυτ|ρουχ)|laundry'), 'Cleaning & Laundry', 'Laundry Basket'],
  [R('\\bκαλαθ|basket'), 'Storage & Organisation', 'Storage Basket'],
  [R('κουτι(α)? (αποθηκ|οργαν)|storage box|οργανωτ|organizer'), 'Storage & Organisation', 'Storage Box'],
  [R('πλυντηρ(ιου|ιο) πιατων|απορρυπαντικο πιατων|υγρο πιατων|dishwash'), 'Cleaning & Laundry', 'Dishwashing'],
  [R('μαλακτικ'), 'Cleaning & Laundry', 'Fabric Softener'],
  [R('απορρυπαντ|detergent'), 'Cleaning & Laundry', 'Laundry Detergent'],
  [R('σιδερωστρ'), 'Cleaning & Laundry', 'Ironing Board'],
  [R('\\bσιδερ(ο|α)\\b|ατμοσιδερ'), 'Cleaning & Laundry', 'Ironing & Clothes Care'],
  [R('απλωστρ|clothes airer'), 'Cleaning & Laundry', 'Clothes Airer'],
  [R('σφουγγαριστρ|κουβασ|\\bmop\\b'), 'Cleaning & Laundry', 'Mop'],
  [R('καδοσ|σακουλ(εσ)? σκουπ|\\bbin\\b'), 'Cleaning & Laundry', 'Bins & Bin Bags'],
  [R('σφουγγαρ(ι|ακι)|πανακι|πανι καθαρ|microfiber'), 'Cleaning & Laundry', 'Cloths & Sponges'],
  [R('καθαριστικ|cleaning'), 'Cleaning & Laundry', 'Cleaning Products'],
  [R('ειδη παρτι|\\bparty\\b|κονφετι'), 'Home Decor', 'Party Decorations'],
  [R('ραπτικ|κεντημα|πλεξιμο|βελονεσ πλεξ'), 'Home Decor', 'Craft & Sewing'],
  [R('διακοσμ|ομοιωμ|γλυπτ|figurine|ornament|κασπω|γλαστρ|κηροπηγ|αγαλματ'), 'Home Decor', 'Ornament']
];
const WEAR = R('\\bμπλουζ|t-shirt|φουτερ|\\bφορεμα|παντελον|παπουτσ|καλτσ|\\bmousepad');
const HOME_NOT = R('ρουχ|ενδυσ|παπουτσ|κοσμημ|καλλυντ|μακιγιαζ');
function hgw(t, n) {
  if (R('παιδικ\\S* (δωματ|επιπλ|κρεβατ)|βρεφικ\\S* (κουνι|προικα)|προικα μωρου').test(`${t} ${n}`)) return { reject: "a baby or children's room product (Kids' Gear World)" };
  if (HOME_NOT.test(t) && !/λευκα ειδη|σπιτι|κουζιν|μπανι|home/.test(t)) return { reject: 'not a home product' };
  if (WEAR.test(n)) return { reject: 'clothing, not a home product' };
  const hit = pickFirst(n, H_LIST) || pickPath(t, H_LIST);
  return hit ? { site: 'hgw', siteCategory: hit[0], subcategory: hit[1] } : { reject: 'not clearly a home product of HGW' };
}

// ---------- Garden Gear World (GGW) ----------
const G_LIST = [
  [R('αλυσοπριον'), 'Power Garden Tools', 'Chainsaws & Accessories'],
  [R('χορτοκοπτ|μεσινεζ|θαμνοκοπτ'), 'Power Garden Tools', 'Grass Trimmers'],
  [R('μπορντουροψαλιδ(α|ο) (ηλεκτρ|μπαταρ|βενζ)|hedge trimmer'), 'Power Garden Tools', 'Hedge Trimmers'],
  [R('φυσητηρ'), 'Power Garden Tools', 'Garden Blowers'],
  [R('χλοοκοπτ'), 'Power Garden Tools', 'Lawnmowers & Accessories'],
  [R('κλαδευτηρ'), 'Garden Tools', 'Secateurs'],
  [R('πριονι (κλαδ|κηπ)|κλαδοπριον'), 'Garden Tools', 'Pruning Saws'],
  [R('μπορντουροψαλιδ|ψαλιδ(α|ι) κηπ'), 'Garden Tools', 'Garden Shears'],
  [R('τσουγκραν'), 'Garden Tools', 'Rakes'],
  [R('\\bτσαπ(α|ι|ακι)\\b'), 'Garden Tools', 'Hoes'],
  [R('φτυαρακι|σκαλιστ'), 'Garden Tools', 'Hand Forks & Trowels'],
  [R('φτυαρ'), 'Garden Tools', 'Spades'],
  [R('καροτσ(ι|ια) (κηπ|μεταφ|οικοδ)'), 'Garden Tools', 'Wheelbarrows'],
  [R('εργαλει(α|ο) κηπ'), 'Garden Tools', 'Other Garden Accessories'],
  [R('λαστιχο ποτισμ|μανικ(ι|α) ποτισμ|λαστιχο κηπου'), 'Watering & Irrigation', 'Hose Pipes'],
  [R('καρουλι (ποτισ|λαστιχ)|τυλικτ(η|ησ) λαστιχ'), 'Watering & Irrigation', 'Hose Reels & Storage'],
  [R('πιστολ(ι|ακι) ποτισμ|εκτοξευτ'), 'Watering & Irrigation', 'Spray Nozzles & Guns'],
  [R('ψεκαστηρ'), 'Watering & Irrigation', 'Pressure Sprayers & Accessories'],
  [R('μπεκ (ποτισ|κηπ)|sprinkler'), 'Watering & Irrigation', 'Garden Sprinklers'],
  [R('ταχυσυνδεσμ|ρακορ'), 'Watering & Irrigation', 'Hose Adaptors & Connectors'],
  [R('σταλακτ|αρδευσ|ποτιστικ(ο|α) συστ'), 'Watering & Irrigation', 'Irrigation Systems'],
  [R('ποτιστηρ'), 'Watering & Irrigation', 'Watering Accessories'],
  [R('γλαστρ|ζαρντινιερ|planter'), 'Plants, Growing & Garden Care', 'Pots & planters'],
  [R('\\bσπορ(οι|οσ|ουσ|ων)\\b|βολβ'), 'Plants, Growing & Garden Care', 'Seeds & bulbs'],
  [R('λιπασμ'), 'Plants, Growing & Garden Care', 'Plant feed'],
  [R('\\bχωμα\\b|τυρφη|υποστρωμα φυτ'), 'Plants, Growing & Garden Care', 'Growing media'],
  [R('ξαπλωστρ'), 'Garden Furniture & Outdoor Living', 'Loungers'],
  [R('ομπρελα (κηπ|παραλ|βεραντ)|κιοσκι|\\bτεντ(α|εσ)\\b|gazebo'), 'Garden Furniture & Outdoor Living', 'Parasols, gazebos & shade'],
  [R('\\bαιωρ(α|εσ)\\b|κουνια κηπ'), 'Garden Furniture & Outdoor Living', 'Hammocks & swing seats'],
  [R('(καρεκλ|πολυθρον|παγκ)\\S* (κηπ|εξωτ|βεραντ|μπαλκον)'), 'Garden Furniture & Outdoor Living', 'Chairs & benches'],
  [R('τραπεζ\\S* (κηπ|εξωτ|βεραντ|μπαλκον)'), 'Garden Furniture & Outdoor Living', 'Tables'],
  [R('επιπλ(α|ο) (κηπ|εξωτ|βεραντ)'), 'Garden Furniture & Outdoor Living', 'Garden furniture'],
  [R('ψησταρ|μπαρμπεκιου|\\bbbq\\b'), 'BBQ & Outdoor Cooking', 'BBQs'],
  [R('\\bσχαρ(α|εσ)\\b|εργαλει(α|ο) ψησ|λαβιδα ψησ'), 'BBQ & Outdoor Cooking', 'BBQ accessories'],
  [R('ηλιακ(ο|α|η|εσ) (φωτ|λαμπ|φανα)'), 'Outdoor Lighting & Garden Electrical', 'Solar lights'],
  [R('φωτοσειρ|λαμπακια'), 'Outdoor Lighting & Garden Electrical', 'String & festoon lights'],
  [R('προβολε'), 'Outdoor Lighting & Garden Electrical', 'Floodlights & security lights'],
  [R('φαναρ'), 'Outdoor Lighting & Garden Electrical', 'Lanterns'],
  [R('φωτιστικ\\S* (κηπ|εξωτ)'), 'Outdoor Lighting & Garden Electrical', 'Outdoor lights'],
  [R('αποθηκ(η|εσ|ευτικ\\S*) κηπ|μπαουλ(ο|α) (κηπ|εξωτ)'), 'Garden Buildings, Fencing & Storage', 'Garden storage'],
  [R('περιφραξ|καφασωτ|καλαμωτ|συρματοπλεγ'), 'Garden Buildings, Fencing & Storage', 'Fencing & screening']
];
function ggw(t, n) {
  const hit = pickFirst(n, G_LIST) || pickPath(t, G_LIST);
  return hit ? { site: 'ggw', siteCategory: hit[0], subcategory: hit[1] } : { reject: 'not clearly a garden product of GGW' };
}

const BY_SITE = { wgw, mgw, kgw, hgw, ggw };
export const LEGACY_SITES = Object.keys(BY_SITE);

export const programme = id => PROGRAMMES.find(p => p.id === Number(id)) || null;
// The sites of a programme: its own and, for a shop that sells for everyone, the ones in `also`.
export const programmeSites = p => [p.site, ...(p.also || []).filter(s => s !== p.site)];
// "Spartoo" -> "Spartoo GR"; a Cyprus-only programme -> "<name> CY" ("Answear CY" stays "Answear CY").
export const retailerName = p => `${String(p.name).replace(/\s+(GR|CY)$/i, '').trim()} ${p.cc.length === 1 && p.cc[0] === 'CY' ? 'CY' : 'GR'}`;
// Names: the feed's own, with HTML entities and doubled spaces cleaned.
export const displayName = name => String(name || '').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/\s{2,}/g, ' ').trim();

// CJ's click hosts: some shops send the Linkwise click on through CJ, so the page in the feed is a CJ link with the shop's
// page in url=.
const CJ_CLICK = /^(www\.)?(anrdoezrs\.net|dpbolvw\.net|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|emjcd\.com|qksrv\.net)$/i;
export function shopPageOf(link) {
  let x;
  try { x = new URL(String(link || '')); } catch { return ''; }
  if (CJ_CLICK.test(x.hostname)) {
    const inner = x.searchParams.get('url') || '';
    try { x = new URL(inner); } catch { return ''; }
  }
  if (!/^https?:$/.test(x.protocol)) return '';
  // OpenCart and other shops name the product in the query (index.php?route=product/product&product_id=12041).
  const id = /[?&]((?:product_)?id|pid|products_id|item)=[^&]+/i.exec(x.search);
  return `${x.origin}${x.pathname}${id ? `?${id[0].slice(1)}` : ''}`;
}
// One card per shop page (the sizes of one product are rows with the same page); the product id when there is no page.
export const productKey = get => shopPageOf(get('merchant_deep_link')) || get('merchant_product_id') || get('aw_product_id');

// The Greek classifier of a programme's sites: { name, feedCategory, awinCategory } -> { site, siteCategory, subcategory,
// name } or { reject }. With several sites, the audience picks the site (children -> KGW, men -> MGW, women -> WGW);
// a product for nobody in particular stays on the programme's own site.
export function classifierFor(sites) {
  const list = Array.isArray(sites) ? sites : [sites];
  for (const s of list) if (!BY_SITE[s]) throw new Error(`no Greek classifier for ${s}`);
  const own = list[0];
  const bySite = { kids: 'kgw', men: 'mgw', women: 'wgw' };
  return function classify({ name, feedCategory = '', awinCategory = '' }) {
    const n = gr(name);
    const t = gr(`${feedCategory} ${awinCategory}`);
    if (!n) return { reject: 'no name' };
    if (NEVER_NAME.test(n) || NEVER_CAT.test(t)) return { reject: 'medicine, supplement, adult, smoking, food or service' };
    let target = own;
    if (list.length > 1) {
      const want = bySite[audience(n, t)];
      if (want && list.includes(want)) target = want;
    }
    const c = BY_SITE[target](t, n);
    return c.reject ? c : { ...c, name: displayName(name) };
  };
}

// The rules of one programme. Async: it reads each site's config and refuses a programme whose retailer is not limited
// there to Greece and/or Cyprus with Greek names (deliversTo.retailers and deliversTo.languages "el"), so a Greek shop
// can never reach the UK view or any other country (Linkwise's terms, lessons L199).
export async function linkwiseRules(id) {
  const p = programme(id);
  if (!p) throw new Error(`unknown Linkwise programme ${id}`);
  const sites = programmeSites(p);
  for (const s of sites) if (!BY_SITE[s]) throw new Error(`Linkwise programme ${id} is for ${s}, not an older site`);
  if (NEVER_SHOPS.test(p.name)) throw new Error(`Linkwise programme ${id} (${p.name}) never goes on the sites`);
  const retailer = retailerName(p);
  for (const s of sites) {
    const mod = await import(new URL(`../../../sites/${s}/site.config.js`, import.meta.url).href);
    const cfg = (mod.default || {}).deliversTo || {};
    const where = (cfg.retailers || {})[retailer];
    const lang = (cfg.languages || {})[retailer];
    if (!Array.isArray(where) || !where.length || where.some(c => !p.cc.includes(c)) || lang !== 'el') {
      throw new Error(`Linkwise programme ${id}: ${retailer} is not limited to ${p.cc.join('/')} with Greek names on ${s} (deliversTo)`);
    }
  }
  const RULES = {
    key: `lw-${p.id}`,
    network: 'linkwise',
    advertiserId: p.id,
    retailer,
    currency: 'EUR',
    // Any https page: the Linkwise tracking link of our affiliate code is what is checked (tools/network-links.mjs).
    // Some shops send the click on through CJ (Answear, Notino, VidaXL ...), so the page is not always the shop's.
    shop: /^https:\/\//i,
    sites,
    minPrice: 3,
    maxPrice: 5000,
    language: 'el',
    countries: p.cc
  };
  return { RULES, classify: classifierFor(sites), displayName, productKey };
}
