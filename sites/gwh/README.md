# Gear World Hub (gearworldhub.com)

Ο κώδικας του Hub (Cloudflare Worker `gear-world-hub`), **ακριβώς όπως τρέχει live** στις 24/10/2026.
Από εδώ και πέρα κάθε αλλαγή του Hub γίνεται σε αυτόν τον φάκελο και κρατιέται στο GitHub.

## Από πού ήρθε και πώς ελέγχθηκε
- Πηγή: ο φάκελος `C:\Users\vagge\gear-world-hub` στον υπολογιστή του ιδιοκτήτη, με το `tools/gwh-code-export.ps1` (μόνο ανάγνωση, 24/10/2026 12:59).
- Κάθε αρχείο εδώ έχει **το ίδιο sha256** με το αρχείο του υπολογιστή **και** με αυτό που σερβίρει σήμερα το gearworldhub.com.
- Το `worker.js` είναι ίδιο με τον Worker που τρέχει (σύγκριση με το source map του τελευταίου deploy).
- Τα αρχεία κρατιούνται byte-προς-byte, με τα ανάμεικτα τέλη γραμμών τους (`.gitattributes`: `sites/gwh/** -text`). Έτσι, ένα deploy από εδώ αλλάζει μόνο ό,τι αλλάξαμε σκόπιμα.

## Τι έχει
| Αρχείο | Τι είναι |
|---|---|
| `worker.js` | Ο Worker: `/api/health`, `/api/registry`, `/api/search` (αναζήτηση σε όλα τα sites, μετάφραση με Workers AI), `/api/classify` (σε ποιο site ανήκει ένα προϊόν), `/api/subscribe` (email στη D1). Όλα τα άλλα: αρχεία του `public/` |
| `mailerlite.js` | Email του Gear World (βήμα 5α, 2/11/2026): το `/api/subscribe` γράφει την εγγραφή πρώτα στη D1 (`hub_subscribers`, στήλη `ml_status`) και μετά τη στέλνει στο MailerLite· το cron (κάθε 10 λεπτά) ξαναστέλνει όσες μένουν «pending». Οι εγγραφές πριν από την αλλαγή είναι «hold» (βήμα 6). Κλειδί: μυστικό `MAILERLITE_API_KEY`. Εργαλείο: `tools/gwh-mailerlite.ps1` |
| `wrangler.toml.example` | Οι ρυθμίσεις του Worker χωρίς το ID της D1 (`run_worker_first`, bindings `ASSETS`, `gear_world_registry`, `AI`) |
| `public/` | Αρχική σελίδα, νομικές σελίδες (Privacy, Terms, Cookies, Affiliate disclosure, Contact), JS, CSS, εικόνες |
| `public-allowlist.txt` | Τα αρχεία που επιτρέπονται στο `public/` (μάθημα L04) |
| `schema.sql` | Η δομή της live D1 `gear-world-registry` (πίνακες και indexes, χωρίς γραμμές) |

Γραμμές στη D1 στις 24/10/2026: sites 9, categories 50, routing_rules 730, delivery_retailer_identities 24, delivery_retailer_aliases 48, delivery_country_policies 24, delivery_verification_queue 48, hub_subscribers 1, classification_log 0, feed_sources 0.

## Τι ΔΕΝ είναι εδώ, και γιατί
- **`wrangler.toml` με το ID της D1**: μένει μόνο στον υπολογιστή (το repo είναι δημόσιο).
- **4 παλιά αντίγραφα που είναι ακόμα δημοσιευμένα live** (μάθημα L04). Δεν κρατιούνται εδώ. Φεύγουν από το live **μόνο με έγκριση**, στο πρώτο deploy του Hub από το repo (`tools/gwh-photo.ps1 -Step live`, φράση `ΕΓΚΡΙΝΩ HUB PHOTO LIVE`): μετακινούνται στον φάκελο αντιγράφων ασφαλείας του υπολογιστή, δεν σβήνονται:
  - `/index-before-customer-homepage`
  - `/index-before-kgw-live`
  - `/index-before-wgw-live`
  - `/app-before-kgw-live.js`
- **`package.json` του υπολογιστή**: το αρχικό του npm («commonjs»), χωρίς καμία χρησιμότητα για το deploy. Δεν κρατιέται εδώ, γιατί μπερδεύει τους αυτόματους ελέγχους.
- **Τα άλλα αρχεία του φακέλου στον υπολογιστή** (scripts και SQL της εποχής του ChatGPT, αναφορές, `tools/`, `release-archive/`, `backups/`): δεν ανεβαίνουν στο Cloudflare και δεν χρειάζονται εδώ.
- **`robots.txt` και `sitemap.xml`**: δεν τα σερβίρει αυτός ο Worker (δεν υπάρχουν στο `public/`).

## Χρήσιμο να ξέρεις
- Τα headers ασφαλείας του Hub (π.χ. `Permissions-Policy: camera=(self), microphone=(self)`, `X-Frame-Options`, HSTS) **δεν τα γράφει ο κώδικας**. Τα προσθέτει το Cloudflare από ρυθμίσεις του domain. Σε δοκιμαστική διεύθυνση `*.workers.dev` δεν υπάρχουν, άρα ο κώδικας πρέπει να τα στέλνει μόνος του όπου χρειάζονται.
- Το σχόλιο `GWH-FAIR-SEARCH` στο `worker.js` γράφει «lessons L41». Το σωστό μάθημα είναι το **L74**: στις 25/10/2026 οι αριθμοί των μαθημάτων του Hub έγιναν L56–L61, και στις 27/10/2026, όταν ο κλάδος του Hub ενώθηκε με τον κλάδο των sites (που είχε ήδη άλλα L56–L69), έγιναν **L70–L75**. Το σχόλιο διορθώθηκε στην έκδοση της μέτρησης αφισών (27/10/2026).
- Παρατηρήσεις για αργότερα (δεν άλλαξε τίποτα): η εικόνα `gwh-hero.png` είναι 2,8 MB (αργή στο κινητό), οι σελίδες στέλνουν `text/html` χωρίς `charset` (μάθημα L05), και ένα σχόλιο στο `worker.js` έχει χαλασμένους χαρακτήρες (`â€”`).

## Αναζήτηση με φωτογραφία (κουμπί κάμερας, Οκτώβριος 2026)
| Αρχείο | Τι κάνει |
|---|---|
| `photo-search.js` | `POST /api/photo-search`: δέχεται μόνο JPEG έως 1 MB, μετράει τα όρια (10 την ώρα ανά επισκέπτη, 150 την ημέρα συνολικά, αλλάζουν με `PHOTO_HOURLY_LIMIT` / `PHOTO_DAILY_LIMIT`), ρωτά μία φορά το `@cf/google/gemma-4-26b-a4b-it` (χωρίς «σκέψη») και επιστρέφει λέξεις, μάρκα και Gear World από τα ενεργά sites της D1. Η φωτογραφία δεν αποθηκεύεται και δεν γράφεται σε logs. Εδώ είναι και οι κανόνες της δοκιμαστικής διεύθυνσης (`GWH_PREVIEW = "1"`: noindex, χωρίς analytics, εγγραφή email κλειστή) |
| `worker.js` | Το παλιό `export default` λέγεται τώρα `hubCore`, και ένα νέο `export default` στο τέλος στέλνει το `/api/photo-search` στο `photo-search.js` και όλα τα άλλα στο `hubCore`, όπως πριν. Στο `/api/search` το Hub ρωτά το πολύ 6 sites τη φορά, και κάθε site έχει τα 4,5 δευτερόλεπτά του από τη στιγμή που ρωτιέται (`GWH-FAIR-SEARCH`, μάθημα L74). Η απάντηση μένει ίδια |
| `public/gear-world-camera.js` | Το κουμπί της κάμερας δίπλα στο μικρόφωνο, η σημείωση «Your photo is only used to find products and is not saved», μικρότερη φωτογραφία στον browser (1024 px, χωρίς EXIF/GPS), αποτελέσματα ανά site με το καλύτερο Gear World πρώτο. Όταν φαίνεται μάρκα, ψάχνει ταυτόχρονα με και χωρίς αυτήν: αν τα sites έχουν αρκετά προϊόντα της μάρκας (4 ή περισσότερα), δείχνει μόνο αυτά. Αν έχουν λίγα, δείχνει πρώτα αυτά και μετά τα άλλα παρόμοια (έως 8 ανά site). Αν δεν έχουν τη μάρκα, δείχνει τα παρόμοια. Το «We found» γράφει πρώτα τι είναι το προϊόν. 11 γλώσσες |
| `migrations/0001_photo_search_limits.sql` | 2 νέοι πίνακες για τα όρια: ανώνυμος κωδικός ανά ημέρα (όχι IP) και μετρητές. Σβήνονται μετά από 2 ημέρες |
| `live-baseline.txt` | Τα αρχεία που τρέχουν live τώρα, με το sha256 τους και το όνομα της έκδοσης (`# version:`). Το `tools/gwh-photo.ps1` ελέγχει ότι ο φάκελος του υπολογιστή και το live είναι ακόμα αυτή η έκδοση πριν από κάθε deploy. Ενημερώνεται μετά από κάθε live deploy |

Το Gear World το διαλέγει το μοντέλο από τα 9 ενεργά sites. Το `/api/classify` μένει δεύτερη γνώμη: ξέρει κατηγορίες μόνο για τα 6 παλιά sites (μάθημα L70).

## Ετικέτες της αναζήτησης (26/10/2026)
Το `app.js` ήξερε μόνο τα πρώτα 6 sites: στα αποτελέσματα του TGW, AGW, VGW και SGW έγραφε «GEAR WORLD», και το κείμενο αναμονής έλεγε «Searching CGW, MGW, WGW, KGW, HGW and GGW...» (μάθημα L01: ο κώδικας δεν γράφει λίστα sites με το χέρι).

| Αρχείο | Τι άλλαξε |
|---|---|
| `public/app.js` | Το `siteShortName()` δείχνει τον κωδικό του site όπως τον στέλνει το `/api/search` (3 γράμματα, με κεφαλαία): CGW … SGW, και κάθε νέο Gear World χωρίς αλλαγή κώδικα (`GWH-SHORT-NAMES`). Οτιδήποτε άλλο μένει «GEAR WORLD» |
| `public/translations.js` | `searchingWorlds`: «Searching all Gear Worlds...» και στις 11 γλώσσες |
| `public/index.html` | Νέο `?v=20261026-labels1` για τα 2 αρχεία (μάθημα L31) |

Πριν από αυτή την αλλαγή, το repo πήρε ξανά τα live αρχεία της κάρτας Sport (SGW, από το `tools/gwh-sgw-link.ps1`): `index.html`, `translations.js`, `hub-sgw.jpg`, και το `live-baseline.txt` έγινε «photo search v2 + Sport card».

Πάει live με το `tools/gwh-search-labels.ps1` (`-Step check`, μετά `-Step live -Apply` με τη φράση `ΕΓΚΡΙΝΩ HUB LABELS LIVE`). Έλεγχοι: `tests/worker/gwh-labels.test.mjs`.

## Biker Gear World στο Hub (31/10/2026)
| Αρχείο | Τι άλλαξε |
|---|---|
| `public/index.html` | 11η κάρτα «Motorbike & Scooter» (BGW, bikergearworld.com) μετά το Sport· «11 Gear Worlds» στα κείμενα· νέα `?v=20261031-bgw1` για `hub-v2.css`, `hub-v2.js`, `translations.js` (μάθημα L31) |
| `public/translations.js` | Τίτλος και κείμενο της κάρτας σε 11 γλώσσες (οι κάρτες μεταφράζονται με τη σειρά τους) |
| `public/hub-v2.js` | «11» αντί για «10» στα 6 κείμενα που λένε πόσα Gear Worlds έχουμε, σε 11 γλώσσες. Το μωσαϊκό των καμπανιών κρατά τις 10 πρώτες φωτογραφίες (5 x 2) |
| `public/hub-v2.css` | 11 κάρτες: στο κινητό 2 ανά σειρά και το Biker μόνο του στην τελευταία· από 980 px 6 + 5 (με 5 ανά σειρά το 11ο θα έμενε μόνο του) |
| `public/hub-bgw.jpg` | Η φωτογραφία της κάρτας (Pexels, `docs/IMAGE-CREDITS.md`) |

Πάει live με το `tools/gwh-hub-v2.ps1`: `-Step live` (`ΕΓΚΡΙΝΩ HUB LIVE`), `-Step register` (η γραμμή BGW στη D1 `gear-world-registry`, για να ψάχνει εκεί η αναζήτηση, `ΕΓΚΡΙΝΩ HUB BGW SEARCH`) και `-Step remove-preview` (`ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW`), στην ίδια επικόλληση. Live από 31/10/2026 11:58 (το `live-baseline.txt` ενημερώθηκε).

## Bing Webmaster Tools (31/10/2026)
| Αρχείο | Τι άλλαξε |
|---|---|
| `public/robots.txt` | Το Hub έχει πια δικό του robots.txt (στο μοτίβο των sites): `Allow: /`, `Disallow: /api/`, `Sitemap: https://gearworldhub.com/sitemap.xml`. Από το L105 (8/11/2026) πρώτα `User-agent: SERankingBacklinksBot` με `Disallow: /`, όπως στα 13 sites. Το Cloudflare βάζει από πάνω τα δικά του Content Signals. Το sitemap το σερβίρει ακόμα ο Worker `gwh-sitemap`, που ΔΕΝ αλλάζει |
| `public/index.html` | Τίτλος «Gear World Hub – Gear, Gifts & Deals From Every Gear World», περιγραφή 151 χαρακτήρων, νέο `?v=20261101-seo1` για το `translations.js` (μετά την κάρτα Gaming) (μάθημα L31) |
| `public/translations.js` | Το `document.title` γράφει τον ίδιο τίτλο, και η περιγραφή είναι το νέο `metaDesc` σε 11 γλώσσες (120–160 χαρακτήρες, χωρίς αριθμό κόσμων) αντί για «heroDesc + Gear World Hub.» (≈85) |
| `public/terms/index.html`, `public/contact/index.html` | Περιγραφές 149 και 126 χαρακτήρων |
| `public/gearworldhub-indexnow-k7q4m9x2w5.txt` | Το κλειδί του IndexNow (δημόσιο εκ σχεδιασμού) |

Πάει live με το `tools/gwh-hub-v2.ps1` (`-Step live`, φράση `ΕΓΚΡΙΝΩ HUB LIVE`). Μετά το deploy το εργαλείο ελέγχει τίτλο, robots.txt και κλειδί, και στέλνει στο IndexNow τις σελίδες του live sitemap. Ξανά, χωρίς deploy: `-Step indexnow -Apply` (δεν αλλάζει τίποτα στο Hub). Το robots.txt δεν συγκρίνεται byte-προς-byte με το live, γιατί το Cloudflare του προσθέτει τα Content Signals. Έλεγχοι: `tests/worker/gwh-seo.test.mjs`.

## Χριστούγεννα από 1 Νοεμβρίου (1/11/2026)
Το βίντεο των Χριστουγέννων (το τζάκι, `seasonal/christmas.mp4`, φτιαγμένο με fal) παίζει στο hero του Hub από 1/11 έως 24/12 (πριν: από 2/12). Στις μέρες της Black Friday (20/11–1/12 για το 2026) δείχνεται εκείνη, όπως πριν. Το ίδιο ημερολόγιο έχουν και τα sites (`src/lib/seasons.js`, σελίδα κωδικών και προσφορών): το παίρνουν στο επόμενο update τους. `hub-v2.js?v=20261101-xmas1`.

## Οδηγοί δώρων (4/11/2026)
| Αρχείο | Τι είναι |
|---|---|
| `guides/guides.json` | Τα δεδομένα των 5 οδηγών: 58 προϊόντα, ομάδες (budget ή ηλικία), γιατί είναι καλό δώρο, τιμή, κατάστημα, φωτογραφία, link στη σελίδα του προϊόντος στο site. Τιμές από τις σελίδες των sites (GET, ποτέ `/out/`), έλεγχος 4/11/2026 |
| `public/guides/index.html` και `public/guides/<slug>/index.html` | Οι σελίδες, φτιαγμένες από το `node tools/gwh-guides.mjs build` (στατικές, χωρίς ερώτημα στη D1). Στα αγγλικά, όπως όλα τα κείμενα των sites |
| `public/guides/guides.css` | Η εμφάνισή τους, πάνω στο `legal/legal.css` (ίδια navy και χρυσό) |
| `public/index.html`, `hub-v2.js`, `hub-v2.css` | Κάτω από το «Βρες δώρο»: «Christmas gift guides» με 5 links (κείμενα σε 11 γλώσσες), νέο `?v=` (L31) |

Πριν από κάθε ανέβασμα: `node tools/gwh-guides.mjs check` (μόνο ανάγνωση). Στις 4/11 ένα από τα 58 προϊόντα (Joules Packaway Duffle, Stripe) είχε φύγει από το κατάστημα (404) και αντικαταστάθηκε, και 17 διευθύνσεις είχαν αλλάξει μετά από νέα εισαγωγή (μάθημα L94). Το sitemap το σερβίρει ο Worker `gwh-sitemap`, που δεν αλλάζει χωρίς να ρωτήσουμε. Στις 4/11 ο Evangelos είπε ναι: οι 6 σελίδες των οδηγών μπαίνουν με το `tools/gwh-sitemap.ps1` (κώδικας στο `sites/gwh-sitemap/`).

Live από 4/11/2026 18:43 (commit 74f1905· το `live-baseline.txt` ενημερώθηκε· η δοκιμαστική διεύθυνση σβήστηκε την ίδια ώρα). Πήγε με το `tools/gwh-hub-v2.ps1`: `-Step preview` (`ΕΓΚΡΙΝΩ HUB GUIDES PREVIEW`), και μετά στην ίδια επικόλληση `-Step live` (`ΕΓΚΡΙΝΩ HUB GUIDES LIVE`) και `-Step remove-preview` (`ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW`). Έλεγχοι: `tests/worker/gwh-guides.test.mjs` και `tools/gwh-guides-page-check.mjs`.
Πάει με το `tools/gwh-hub-v2.ps1`: `-Step preview` (`ΕΓΚΡΙΝΩ HUB GUIDES PREVIEW`), και μετά στην ίδια επικόλληση `-Step live` (`ΕΓΚΡΙΝΩ HUB GUIDES LIVE`) και `-Step remove-preview` (`ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW`). Έλεγχοι: `tests/worker/gwh-guides.test.mjs` και `tools/gwh-guides-page-check.mjs`.

## Κατηγορίες των sites στο /api/registry (4/11/2026, πρόταση Α)
Το `/api/registry` δίνει σε κάθε site και το πεδίο `shop_categories`: τις κατηγορίες του μενού του (όνομα, slug, link `https://<site>/category/<slug>/`), από τα `sites/<code>/site.config.js`. Τις διαβάζει η εφαρμογή Gear World για τα κουμπιά κατηγοριών (και στα 7 νέα worlds, που δεν έχουν κατηγορίες στη D1).

- Γράφονται μέσα στο `worker.js`, ανάμεσα στις γραμμές `GWH-SHOP-CATEGORIES`, με το `node tools/gwh-shop-categories.mjs --write`. Το `--check` λέει αν είναι ίδιες με τις ρυθμίσεις των sites (το ελέγχει και το τεστ).
- Η D1 (`categories`), το πεδίο `categories` της απάντησης και το `/api/classify` **δεν** αλλάζουν, γιατί από εκεί περνούν οι εισαγωγές (μάθημα L70).
- Όταν αλλάξουν οι κατηγορίες ενός site, χρειάζεται `--write` και νέο ανέβασμα του Hub.
- Έλεγχοι: `tests/worker/gwh-shop-categories.test.mjs`.
- Live από 4/11/2026 19:37 (commit 8d5fa61, φράσεις `ΕΓΚΡΙΝΩ HUB REGISTRY PREVIEW` / `LIVE`· η δοκιμαστική διεύθυνση σβήστηκε στην ίδια εντολή). Στο live: 117 κατηγορίες στα 13 sites, όλα τα links 200, το `/api/classify` ίδιο με πριν.

## Διορθώσεις για το Google Ads (7/11/2026, μάθημα L101)
| Αρχείο | Τι άλλαξε |
|---|---|
| `public/about/index.html`, `public/about/about.js` | Νέα σελίδα `/about/` σε 11 γλώσσες: τι είναι το Gear World, «Run by Evangelos Kalogerakis, United Kingdom», ότι δεν πουλάμε, δεν παίρνουμε πληρωμές και δεν κάνουμε παραδόσεις, contact@gearworldhub.com |
| `public/index.html`, `public/translations.js`, `public/hub-v2.js` | Το «About» του μενού ανοίγει το `/about/`, φεύγει η κάρτα «Sell Your Business», «From retailers listed on Gear World» στις προσφορές, η χριστουγεννιάτικη διαφάνεια λέει «Gifts for everyone, from 13 Gear Worlds» |
| οι νομικές σελίδες και οι 6 σελίδες των οδηγών | Η γραμμή «Run by Evangelos Kalogerakis, United Kingdom · We don't sell products…» στο footer και link «About» |

Live από 7/11/2026 (commit f4c8c35· το `live-baseline.txt` ενημερώθηκε και τα 48 αρχεία της σελίδας ελέγχθηκαν με GET ότι είναι ίδια με το gearworldhub.com). Πήγε με το `tools/gwh-hub-v2.ps1`: `-Step preview` (`ΕΓΚΡΙΝΩ HUB ADS PREVIEW`), μετά `-Step live` (`ΕΓΚΡΙΝΩ HUB ADS LIVE`) και `-Step remove-preview` (`ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW`). Το `worker.js` δεν άλλαξε. Έλεγχοι: `tests/worker/ads-review.test.mjs` και `tools/gwh-hub-page-check.mjs`.

## Αναζήτηση και σύγκριση τιμών, όχι καταστήματα (μάθημα L102)
Ένας ανεξάρτητος έλεγχος μετά την ένσταση στο Google Ads βρήκε ακόμα λέξεις καταστήματος στο Hub.

| Αρχείο | Τι άλλαξε |
|---|---|
| `public/index.html` | «The idea»: «Independent product search and price comparison.» και ότι κάθε προϊόν δείχνει το κατάστημα που το πουλά (πριν: «A connected shopping ecosystem», «specialist shopping sites»). Οι 13 κάρτες γράφουν «Explore →» (πριν: «Shop →»). Νέο `?v=20261108-wording1` για `hub-v2.css`, `hub-v2.js`, `translations.js` (L31) |
| `public/translations.js` | Τα ίδια σε 11 γλώσσες (και «Entdecken →» αντί για «Einkaufen →»)· και τα παλιά κείμενα που δεν φαίνονται πια («Shopping Discovery», «Shop by Interest», «13 specialist shopping worlds»), γιατί η Google διαβάζει και τα scripts |
| `public/hub-v2.js` | «13 price-comparison sites, one search» (πριν: «13 specialist shops»), «Halloween across 13 Gear Worlds» και «Discount codes from retailers listed on Gear World» (πριν: «Halloween offers», «our retailers»), «See sport gear» (πριν: «Shop sport»), «Seasonal banner» αντί για «Seasonal offers», σε 11 γλώσσες |
| `public/hub-v2.css` | Φεύγουν οι κανόνες της κάρτας «Sell Your Business» (`.gwh-business-*`, `.gwh-sponsored`) |
| `public/privacy/index.html` | «a product search and price-comparison service for adults» (πριν: «a shopping directory») |

Το `worker.js` και η D1 δεν αλλάζουν. Πάει με το `tools/gwh-hub-v2.ps1`: `-Step preview` (`ΕΓΚΡΙΝΩ HUB WORDING PREVIEW`), και μετά στην ίδια επικόλληση `-Step live` (`ΕΓΚΡΙΝΩ HUB WORDING LIVE`) και `-Step remove-preview` (`ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW`). Μετά το live ενημερώνεται το `live-baseline.txt`. Έλεγχοι: `tests/worker/ads-wording.test.mjs` και `tools/gwh-hub-page-check.mjs`.

Το sitemap το σερβίρει ο Worker `gwh-sitemap` (`sites/gwh-sitemap/worker.js`, λίστα `PAGES`). Ο Evangelos είπε ναι στις 7/11/2026 να μπει και το `/about/`, μαζί με τις 6 σελίδες των οδηγών δώρων (ναι από 4/11): 13 σελίδες. Στις 7/11/2026 22:13 το live `https://gearworldhub.com/sitemap.xml` έχει ακόμα τις 6 σελίδες της 24/10 (sha256 `121319…4abf`, η έκδοση του `before-worker.js`). Ανεβαίνει με το `tools/gwh-sitemap.ps1` (`ΕΓΚΡΙΝΩ SITEMAP PREVIEW`, μετά `ΕΓΚΡΙΝΩ SITEMAP LIVE` και `ΕΓΚΡΙΝΩ SITEMAP REMOVE PREVIEW`).

## Καθάρισμα μετά την ένσταση (μάθημα L103)
Ένας πλήρης έλεγχος όλων των κειμένων σε 11 γλώσσες βρήκε ακόμα λέξεις συνεργασίας ή καταστήματος.

| Αρχείο | Τι άλλαξε |
|---|---|
| `public/affiliate-disclosure/index.html` | «On the Hub»: τα links του Hub πάνε μόνο σε σελίδες των Gear World sites· το Hub δεν έχει affiliate links ούτε πληρωμένες θέσεις (πριν: «Some links, such as partner banners, are affiliate links»). «Last updated: 7 November 2026» |
| `public/privacy/index.html` | «The Hub itself has no affiliate links; the links to retailers on those sites go through the Awin affiliate network» (πριν: «and partner links on the Hub»). «Last updated: 7 November 2026» (η αλλαγή του L102 δεν είχε αλλάξει την ημερομηνία) |
| `public/terms/index.html` | «operated by Gear World (run by Evangelos Kalogerakis, United Kingdom)», όπως στα sites. «Last updated: 7 November 2026» |
| `public/contact/index.html` | «business enquiries from retailers and affiliate networks» (πριν: «partnership enquiries») |
| `public/hub-v2.js` | Οι διαφάνειες προσφορών (Halloween, Black Friday, χειμώνας) λένε «The retailers' offers…» / «See the deals» μόνο όταν το `hub-deals.json` έχει κωδικό που τρέχει σήμερα· αλλιώς, και όσο φορτώνει η λίστα, «Sign up and hear about the offers first.» / «Tell me first» προς την εγγραφή (`campaignView`). Το ίδιο το κουμπί του βίντεο της Black Friday. Η χειμερινή διαφάνεια: «26 DECEMBER – 15 JANUARY», «After Christmas across 13 Gear Worlds» (πριν: «Sales … in 13 Gear Worlds» στις 10 γλώσσες). «Chaussures de sport» αντί για «Baskets». Το όνομα του καταστήματος στις προσφορές `translate="no"`, κλάση `gwh2-deal-retailer` |
| `public/translations.js` | Ελληνικά «Αγοράστε απευθείας από το κατάστημα» (πριν: «από τα συνεργαζόμενα καταστήματα»), γαλλικά «couchages» (πριν: «paniers»), «retailer» μεταφρασμένο σε 7 γλώσσες, κλειδιά χωρίς «shop» (`explore`, `comparisonLabel`, `browseInterest`) |
| `public/hub-v2.css`, `public/index.html` | Η κλάση `gwh2-deal-retailer`· νέο `?v=20261108-cleanup1` (L31)· το σχόλιο της σελίδας χωρίς «partner» |
| `guides/guides.json`, `tools/gwh-guides.mjs` και οι 5 οδηγοί | «retailer» αντί για «shop», «which shows the retailer that sells it», χωρίς «Pretend shopping». Οι τιμές ξαναελέγχθηκαν στις 7/11/2026 (`node tools/gwh-guides.mjs check`, 58/58 ίδιες) |
| `public/styles.css` | Δεν το φορτώνει η σελίδα από τις 27/10, αλλά σερβίρεται: φεύγουν οι κανόνες `.gwh-business-*` και τα σχόλια «shop». Δεν σβήνεται, γιατί το `gwh-hub-v2.ps1` δεν σβήνει αρχεία από τον φάκελο του υπολογιστή (θα έμενε live) και τα tests των παλιών εργαλείων το περιμένουν |

Το `worker.js` και η D1 δεν αλλάζουν. Πάει με το `tools/gwh-hub-v2.ps1`: `-Step preview` (`ΕΓΚΡΙΝΩ HUB CLEANUP PREVIEW`), και μετά στην ίδια επικόλληση `-Step live` (`ΕΓΚΡΙΝΩ HUB CLEANUP LIVE`) και `-Step remove-preview` (`ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW`). Μετά το live ενημερώνεται το `live-baseline.txt`. Έλεγχοι: `tests/worker/ads-cleanup.test.mjs` και `tools/gwh-hub-page-check.mjs`.

## robots.txt: SERankingBacklinksBot (8/11/2026, μάθημα L105)

Ένα SEO bot, ο SERankingBacklinksBot, άνοιγε περίπου 1.000 σελίδες προϊόντων την ώρα στο cargearworld.com (6–8/11/2026) και δεν φέρνει επισκέπτες. Το `public/robots.txt` αρχίζει πια με `User-agent: SERankingBacklinksBot` και `Disallow: /`· από κάτω οι ίδιες γραμμές όπως ήταν. Το ίδιο και στα 13 sites (`src/seo.js`).

Αλλάζει μόνο το `public/robots.txt`· το `worker.js` και η D1 δεν αλλάζουν. Η δοκιμαστική διεύθυνση απαντά πάντα στο robots.txt με το δικό της `Disallow: /`, άρα ένα preview δεν δείχνει αυτή την αλλαγή και δεν χρειάζεται (το `-Step live` δεν ζητά preview). Πάει με το `tools/gwh-hub-v2.ps1`: `-Step live` (`ΕΓΚΡΙΝΩ HUB ROBOTS LIVE`) και στην ίδια επικόλληση `-Step remove-preview` (`ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW`· χωρίς δοκιμαστικό Worker λέει «δεν υπάρχει ήδη» και δεν αλλάζει τίποτα). Μετά το deploy ο έλεγχος διαβάζει το live robots.txt: τη γραμμή Sitemap και τις δύο γραμμές του SERankingBacklinksBot. Μετά το live ενημερώνεται το `live-baseline.txt`. Έλεγχοι: `tests/worker/robots.test.mjs`.

## Διορθώσεις ασφαλείας (8/11/2026, μάθημα L106)

- **Turnstile στις εγγραφές email (F02).** Η φόρμα του Hub φορτώνει το Turnstile μόνο όταν κάποιος αρχίσει να τη χρησιμοποιεί (`email-signup.js`, η sitekey από το `/api/turnstile`). Το Hub ελέγχει με το Siteverify κάθε token: το δικό του (φόρμα `hub-signup`) και των 13 sites (`deal-updates`, μέσω του `/internal/subscribe`), με το secret key του σωστού widget (`TURNSTILE_SECRET_KEY` για το Hub και 9 sites, `TURNSTILE_SECRET_KEY_2` για Sporty, Biker, Gaming, Pets) και το σωστό hostname. Από φυλλομετρητή (με Origin) χωρίς token: 403. Στη δοκιμαστική διεύθυνση (`GWH_PREVIEW=1`) τα δημόσια κλειδιά δοκιμής του Cloudflare. Το `status` μένει `active` (το double opt-in είναι μεταγενέστερη απόφαση).
- **Ημερήσια όρια (F02, F03).** Όλο το δίκτυο μαζί, σε γραμμές `network:<όνομα>` του υπάρχοντος πίνακα `subscribe_usage` (κανένας νέος πίνακας· τις σβήνει το cron μετά από 48 ώρες): 50 εγγραφές τη μέρα (`SUBSCRIBE_DAILY_LIMIT`, δωρεάν MailerLite: 250 συνδρομητές), από αυτές 10 χωρίς token (`SUBSCRIBE_APP_DAILY_LIMIT`, η εφαρμογή δεν έχει ακόμα widget), 2.000 κλήσεις μοντέλων μετάφρασης (`TRANSLATE_DAILY_LIMIT`, Hub και sites μαζί μέσω του `/internal/ai-slot`). Γεμάτη μέρα: «Sign-ups are full for today…» (429), ή αναζήτηση χωρίς μετάφραση.
- **Μεταφράσεις (F03).** Κάθε μετάφραση κρατιέται 1 μέρα ανά κανονικοποιημένο όρο (Cache API)· όχι μοντέλο για bots· όταν το Hub έχει ήδη μεταφράσει, ρωτά τα sites με `translate=0` και `User-Agent: GearWorldHub/1.0`, ώστε να μη μεταφράσουν ξανά.
- **Headers (F08, F11).** Ο Worker βάζει `charset=utf-8` σε κάθε κείμενο και πλήρη `Content-Security-Policy-Report-Only` στις σελίδες HTML (αναφορές στο `/api/csp-report`, στα logs, με τα email κρυμμένα). Δεν στέλνει HSTS: το στέλνει ο κανόνας της ζώνης, και δύο τιμές θα διαφωνούσαν. Η ενεργή πολιτική της ζώνης (`frame-ancestors 'self'; base-uri 'self'; object-src 'none'`) μένει όπως είναι· η πλήρης γίνεται ενεργή μόνο όταν οι αναφορές δείξουν ότι δεν μπλοκάρει τίποτα.
- **Μόνο στο domain (F04).** `workers_dev = false` και `preview_urls = false` στο `wrangler.toml` (χωρίς routes στο αρχείο, το wrangler ξανάνοιγε το workers.dev σε κάθε deploy). Μόνο ο `gear-world-hub-preview` έχει workers.dev.

Σειρά: `tools/gw-security-fixes.ps1 -Step turnstile` (κλειδιά), `-Step preview` του `gwh-hub-v2.ps1` (`ΕΓΚΡΙΝΩ HUB SECURITY PREVIEW`), τα 13 sites (`ads-fixes-sites.ps1 -Step apply`), μετά το Hub (`ΕΓΚΡΙΝΩ HUB SECURITY LIVE`) και στην ίδια επικόλληση `-Step remove-preview`. Το live του Hub σταματά αν λείπουν τα κλειδιά (exit 16) ή αν τα sites δεν έχουν ακόμα το νέο «Get deal updates» (exit 17), γιατί το νέο Hub δεν δέχεται εγγραφή site χωρίς token. Έλεγχοι: `tests/worker/security-fixes.test.mjs`.
