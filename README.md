# gear-world-code

[![checks](https://github.com/evangelos-gif/gear-world-code/actions/workflows/checks.yml/badge.svg)](https://github.com/evangelos-gif/gear-world-code/actions/workflows/checks.yml)

Κώδικας και εργαλεία για το δίκτυο **Gear World**: το Hub και τα sites CGW, MGW, WGW, KGW, HGW, GGW και το νέο TGW.

## Γιατί υπάρχει αυτό το repo
- **Μικρές εντολές:** τα scripts ζουν εδώ και η εντολή στο PowerShell είναι 3 γραμμές.
- **Δοκιμασμένα:** κάθε αλλαγή ελέγχεται αυτόματα σε Windows PowerShell 5.1 (το πράσινο σήμα «checks» πάνω).
- **Ιστορικό:** κάθε αλλαγή κρατιέται, οπότε μπορούμε να γυρίσουμε πίσω.
- **Ένα πρότυπο για όλα:** το TGW χτίζεται σωστά εδώ και μετά διορθώνει τα άλλα sites.

## Δομή
| Φάκελος | Τι έχει |
|---|---|
| `src/` | Κοινή «μηχανή» για όλα τα sites (Cloudflare Worker): σελίδες, headers, sitemap, `/out/` |
| `sites/tgw/` | Ό,τι είναι μόνο του TGW: ρυθμίσεις, migrations της D1, εικόνες, CSS, JS |
| `sites/agw/` | Car Gear World (κωδικός AGW, cargearworld.com): νέο site με δική του D1, όπως το TGW |
| `sites/vgw/` | Travel Gear World (κωδικός VGW, travelgearworld.com): νέο site με δική του D1, όπως το AGW, σε μπλε και πορτοκαλί (ασφαλή για δυσχρωματοψία) |
| `sites/sgw/` | Sporty Gear World (κωδικός SGW, sportygearworld.com): νέο site με δική του D1, όπως το VGW, με 10 αθλητικές κατηγορίες και χρώματα ασφαλή για δυσχρωματοψία. Μόνο προϊόντα από τα αθλητικά τμήματα των καταστημάτων (L65) |
| `tools/` | Εργαλεία για τον υπολογιστή (PowerShell) και ο έλεγχος ποιότητας `qa-gate.mjs` |
| `tests/` | Αυτόματοι έλεγχοι (τρέχουν σε κάθε αλλαγή) |
| `docs/LESSONS.md` | Τα λάθη του παρελθόντος και οι κανόνες που τα αποτρέπουν |
| `docs/TGW-PLAN.md` | Το πλάνο του Technology Gear World |
| `tgw/` | Πληροφορίες και, αργότερα, ο κώδικας του TGW |

## Εργαλεία
| Εργαλείο | Τι κάνει | Αλλάζει κάτι; |
|---|---|---|
| `tools/gw-site-snapshot.ps1` | Μαζεύει τον κώδικα και τη δομή της D1 ενός site σε μία αναφορά | 🟢 Όχι |
| `tools/tgw-import-plan.ps1` | Δείχνει ποια προϊόντα του feed θα έμπαιναν στο TGW και σε ποια κατηγορία | 🟢 Όχι |
| `tools/tgw-cloudflare.ps1` | Βήματα Cloudflare του TGW: έλεγχος, D1, δοκιμαστική διεύθυνση, φόρτωση προϊόντων, σύνδεση domain (launch) | 🟢 `check` όχι · 🔴 τα άλλα μόνο με `-Apply` και πληκτρολογημένη φράση έγκρισης |
| `tools/gwh-tgw-link.ps1` | Βάζει το TGW στο Gear World Hub: κάρτα στην αρχική (11 γλώσσες) και γραμμή στη λίστα sites της D1 του hub, για την αναζήτηση | 🟢 χωρίς `-Apply` μόνο ελέγχει · 🔴 με `-Apply` και `ΕΓΚΡΙΝΩ TGW HUB LINK`, με backup και σημείο επαναφοράς πρώτα |
| `tools/ggw-engine.ps1` | Το GGW στη νέα μηχανή (ίδια με του TGW), με την ίδια βάση: `check` (μόνο ανάγνωση), `preview` (ξεχωριστή δοκιμαστική διεύθυνση), `switch` (αλλαγή του live, με zip του παλιού κώδικα πρώτα), `update` | 🟢 `check` όχι · 🔴 τα άλλα μόνο με `-Apply` και `ΕΓΚΡΙΝΩ GGW PREVIEW` / `SWITCH` / `UPDATE`. Η βάση δεν αλλάζει ποτέ |
| `tools/mgw-engine.ps1` | Το ίδιο για το Men's Gear World: `check`, `preview`, `switch`, `update` | 🟢 `check` όχι · 🔴 τα άλλα μόνο με `-Apply` και `ΕΓΚΡΙΝΩ MGW PREVIEW` / `SWITCH` / `UPDATE`. Η βάση δεν αλλάζει ποτέ |
| `tools/wgw-engine.ps1` | Το ίδιο για το Women's Gear World: `check`, `preview`, `switch`, `update` | 🟢 `check` όχι · 🔴 τα άλλα μόνο με `-Apply` και `ΕΓΚΡΙΝΩ WGW PREVIEW` / `SWITCH` / `UPDATE`. Η βάση δεν αλλάζει ποτέ |
| `tools/kgw-engine.ps1` | Το ίδιο για το Kids' Gear World: `check`, `preview`, `switch`, `update` | 🟢 `check` όχι · 🔴 τα άλλα μόνο με `-Apply` και `ΕΓΚΡΙΝΩ KGW PREVIEW` / `SWITCH` / `UPDATE`. Η βάση δεν αλλάζει ποτέ |
| `tools/cgw-engine.ps1` | Το ίδιο για το Construction Gear World (Worker `construction-gear-uk`, D1 `construction-gear-customers`): `check`, `preview`, `switch`, `update`, `remove-preview`. Βρίσκει μόνο του τον φάκελο του παλιού site για το backup | 🟢 `check` όχι · 🔴 τα άλλα μόνο με `-Apply` και `ΕΓΚΡΙΝΩ CGW PREVIEW` / `SWITCH` / `UPDATE` / `REMOVE PREVIEW`. Η βάση δεν αλλάζει ποτέ |
| `tools/hgw-engine.ps1` | Το ίδιο για το Home Gear World: `check`, `preview`, `switch`, `update` | 🟢 `check` όχι · 🔴 τα άλλα μόνο με `-Apply` και `ΕΓΚΡΙΝΩ HGW PREVIEW` / `SWITCH` / `UPDATE`. Η βάση δεν αλλάζει ποτέ |
| `tools/awin-feed-inventory.ps1` | Διαβάζει τον φάκελο με τα feeds του Awin στο PC και δείχνει ανά κατάστημα: προϊόντα, απόθεμα, EAN, πόσο παλιό είναι το αρχείο, σε ποιο site ταιριάζει και αν το χρησιμοποιεί ήδη κάποιο site | 🟢 Όχι |
| `tools/gw-new-site-scan.ps1` | Ποιο νέο site να φτιάξουμε: μετράει δίπλα-δίπλα στα feeds του PC τα προϊόντα για Travel Gear World (βαλίτσες, τσάντες ταξιδιού, αξεσουάρ, camping) και Gaming Gear World (κονσόλες, παιχνίδια, χειριστήρια/VR, PC gaming, επιτραπέζια), ανά κατηγορία και κατάστημα, με τιμές, δείγματα και πόσα παίρνει ήδη το TGW. Αν το κλειδί του Awin είναι ήδη φυλαγμένο, δείχνει και πού είσαι μέλος. Δεν ζητάει και δεν φυλάει κλειδί | 🟢 Όχι |
| `tools/awin-feed-sample.ps1 -Advertiser <id>` | Διαβάζει το feed ενός καταστήματος από τον ίδιο φάκελο και δείχνει στήλες, όλες τις κατηγορίες με πλήθος, νομίσματα, απόθεμα και δείγματα προϊόντων, για να γραφτούν σωστά οι κανόνες εισαγωγής | 🟢 Όχι |
| `tools/awin-feed-source.ps1` | Βρίσκει από πού έρχονται τα feeds στον φάκελο: προγραμματισμένες εργασίες των Windows, scripts που τα κατεβάζουν, ημερομηνίες αρχείων. Κρύβει τα κλειδιά λήψης | 🟢 Όχι |
| `tools/awin-feed-download.ps1 -Advertiser 30645` | Κατεβάζει φρέσκα feeds του Awin για τα καταστήματα που διαλέγεις. Χωρίς `-Apply` δείχνει μόνο τη λίστα του Awin (μέλος, προϊόντα, ημερομηνίες). Με τη φράση `ΕΓΚΡΙΝΩ FEED DOWNLOAD`: λήψη, έλεγχος, το παλιό αντίγραφο στο `_old`. Το κλειδί φυλάγεται κρυπτογραφημένο στον υπολογιστή | 🔴 Μόνο αρχεία στον υπολογιστή, με έγκριση |
| `tools/legacy-import-plan.ps1 -Retailer coes` | Σχέδιο εισαγωγής νέου καταστήματος στα παλιά sites (MGW, WGW): ενώνει τα μεγέθη κάθε προϊόντος, αποφασίζει site και κατηγορία ή γιατί μένει έξω, και γράφει το SQL που θα έτρεχε μια εισαγωγή (δεν το εκτελεί). Κανόνες ανά κατάστημα στο `tools/import-rules/` | 🟢 Όχι |
| `tools/legacy-import.ps1 -Retailer coes -Site mgw` | Εισαγωγή νέου καταστήματος σε ΕΝΑ παλιό site (CGW, MGW, WGW, KGW, HGW ή GGW) από το σχέδιο. Χωρίς `-Apply` μόνο δείχνει. Με `-Apply` και τη φράση `ΕΓΚΡΙΝΩ COES MGW`: σημείο επαναφοράς, φόρτωση μόνο των προϊόντων του καταστήματος, έλεγχος, οδηγίες επαναφοράς. Δείχνει με ΠΡΟΣΟΧΗ υποκατηγορίες που δεν έχει το site και διορθώνει λάθος ονόματα υποκατηγοριών παλιότερων εισαγωγών, με αρχείο επαναφοράς (L56) | 🔴 Ναι, μόνο με έγκριση |
| `tools/gw-backup.ps1` | Αντίγραφο ασφαλείας ΟΛΟΥ του Gear World στον εξωτερικό δίσκο (`D:\GearWorldBackup`): οι φάκελοι του Gear World στον υπολογιστή, τα feeds του Awin, zip κάθε κλάδου του GitHub και κάθε βάση D1 (μόνο SELECT). Μόνο προσθήκη/ενημέρωση, τίποτα δεν σβήνεται στον δίσκο. Γράφει και `README-RESTORE.txt` | 🔴 γράφει μόνο στον δίσκο, με `-Apply` και `ΕΓΚΡΙΝΩ BACKUP D`. Κανένα site ή βάση δεν αλλάζει |
| `tools/legacy-refresh.ps1 -Pairs "reidl:cgw,tooled-up:cgw"` | Ανανέωση καταστημάτων που ΗΔΗ είναι σε παλιό site: τιμή, εικόνα και απόθεμα από τα feeds του υπολογιστή, μόνο όπου διαφέρουν, και απόκρυψη όσων δεν υπάρχουν πια στο feed (τα ήδη κρυμμένα μένουν κρυμμένα). Τιμή που αλλάζει πάνω από 3 φορές δεν αλλάζει, μόνο φαίνεται. Feed παλιότερο από 30 μέρες: τίποτα. Μετράει τις εγγραφές της D1 από τα ευρετήρια του πίνακα και μένει κάτω από το όριο (L49, L57). Χωρίς `-Apply` μόνο δείχνει. Με `-Apply` κάθε κατάστημα ζητά τη φράση του (π.χ. `ΕΓΚΡΙΝΩ REFRESH REIDL CGW`): σημείο επαναφοράς, αρχείο επαναφοράς με τις παλιές τιμές, έλεγχος | 🔴 Ναι, μόνο με έγκριση |
| `tools/legacy-cleanup.ps1 -Rules instock -Site mgw` (ή `-Rules finediam`: μία κάρτα ανά σχέδιο βέρας, ή `-Rules home-misfits -Site hgw`: κρύβει βέρες, πληκτρολόγια και τα μη καθαριστικά του Joybuy από το HGW) | Κρύβει προϊόντα που δεν πρέπει να φαίνονται σε ΕΝΑ παλιό site: μία κάρτα ανά προϊόν αντί για μία ανά μέγεθος/χρώμα, λουράκια/μεμβράνες/ανταλλακτικά smartwatch έξω από τα Watches, πολιτικά προϊόντα. Χωρίς `-Apply` μόνο μετράει. Με τη φράση `ΕΓΚΡΙΝΩ INSTOCK CLEANUP MGW`: λίστα και αρχείο επαναφοράς, σημείο επαναφοράς, απόκρυψη (δεν σβήνει) | 🔴 Ναι, μόνο με έγκριση |
| `tools/legacy-tidy.ps1 -Site mgw` | Τακτοποίηση σε ΕΝΑ παλιό site: τα ονόματα του InStock χωρίς το μέγεθος/χρώμα στο τέλος (η παλιά διεύθυνση πάει με 301 στη νέα), και απόκρυψη γυναικείων προϊόντων στο MGW / ανδρικών στο WGW. Χωρίς `-Apply` μόνο δείχνει. Με τη φράση `ΕΓΚΡΙΝΩ TIDY MGW`: αρχεία αλλαγής/επαναφοράς, σημείο επαναφοράς, αλλαγή με id | 🔴 Ναι, μόνο με έγκριση |
| `tools/legacy-cleanup.ps1 -Rules family -Site kgw` | KGW (site για γονείς): κρύβει φάρμακα, συμπληρώματα/βιταμίνες, ρούχα ενηλίκων και είδη για τη μητέρα. Παιχνίδια, μπιμπερό, πιπίλες, σαλιάρες μένουν. Φράση `ΕΓΚΡΙΝΩ FAMILY CLEANUP KGW` | 🔴 Ναι, μόνο με έγκριση |
| `tools/legacy-fix-names.ps1 -Site kgw` (ή `mgw`, `wgw`) | Διορθώνει ονόματα που χάλασε το tidy της 20/10 («KIDSÔÇÖ» αντί «KIDS’»): ξανά το όνομα του feed χωρίς μέγεθος/χρώμα, μόνο όταν όλα τα γράμματα και οι αριθμοί μένουν ίδια. Χωρίς `-Apply` δείχνει όλα τα πριν → μετά. Φράση `ΕΓΚΡΙΝΩ FIX NAMES KGW` | 🔴 Ναι, μόνο με έγκριση |
| `tools/group-site.ps1` | Η σελίδα της εταιρείας gearworldgroup.com για retailers και Awin (`sites/group`) | 🟢 `check` όχι · 🔴 `launch`/`update` μόνο με `-Apply` και `ΕΓΚΡΙΝΩ GROUP SITE` / `ΕΓΚΡΙΝΩ GROUP UPDATE` |
| `tools/theme-site.mjs` | Αντιγράφει τα κοινά αρχεία (script, εικονίδια, γραμματοσειρές, χρώματα του stylesheet) από το TGW σε άλλο site της μηχανής | Μόνο αρχεία του repo |
| `promos/promos.js` | Οι κωδικοί έκπτωσης και οι καμπάνιες των retailers (από τα email τους), με ημερομηνία λήξης και σε ποια sites φαίνονται | Αλλάζει τα sites μόνο μετά από ενημέρωση (deploy) με έγκριση |
| `tools/car-feed-scan.ps1` | Για το νέο Car Gear World: πόσα προϊόντα αυτοκινήτου έχει κάθε κατάστημα στα feeds του υπολογιστή, ανά κατηγορία, και (αν υπάρχει το κλειδί) ποια προγράμματα αυτοκινήτου του Awin έχεις ή μπορείς να κάνεις αίτηση | 🟢 Όχι |
| `tools/travel-feed-scan.ps1` | Για το νέο Travel Gear World (VGW): πόσα προϊόντα ταξιδιού (βαλίτσες, σακίδια, αξεσουάρ, camping, παραλία) έχει κάθε κατάστημα στα feeds του υπολογιστή, ανά κατηγορία, και (αν υπάρχει το κλειδί) ποια προγράμματα ταξιδιωτικού εξοπλισμού του Awin έχεις ή μπορείς να κάνεις αίτηση | 🟢 Όχι |
| `tools/sports-feed-scan.ps1` | Για το νέο Sporty Gear World (κωδικός SGW, sportygearworld.com): πόσα αθλητικά προϊόντα έχει κάθε κατάστημα σε όλους τους φακέλους με feeds του υπολογιστή (το νεότερο αντίγραφο κάθε feed), ανά προτεινόμενη κατηγορία, μαζί με αθλητικά παπούτσια και συμπληρώματα, πόσα ανήκουν σε άλλο Gear World (παιδικά, smartwatches, σχάρες αυτοκινήτου, πισίνες, camping, tech) ή είναι παπούτσια χωρίς αθλητική λέξη (απόφαση) και (αν υπάρχει το κλειδί) ποια αθλητικά προγράμματα του Awin έχεις ή μπορείς να κάνεις αίτηση | 🟢 Όχι |
| `tools/agw-import-plan.ps1` | Car Gear World: δείχνει ποια προϊόντα των feeds θα έμπαιναν στο AGW και σε ποια κατηγορία (σχέδιο δοκιμής, γράφει SQL χωρίς να το τρέχει) | 🟢 Όχι |
| `tools/agw-cloudflare.ps1` | Βήματα Cloudflare του Car Gear World: έλεγχος, D1, δοκιμαστική διεύθυνση, φόρτωση προϊόντων, σύνδεση cargearworld.com, ενημέρωση | 🟢 `check` όχι · 🔴 τα άλλα μόνο με `-Apply` και φράση `ΕΓΚΡΙΝΩ AGW ...` |
| `tools/vgw-import-plan.ps1` | Travel Gear World: δείχνει ποια προϊόντα των feeds θα έμπαιναν στο VGW και σε ποια κατηγορία (σχέδιο δοκιμής, γράφει SQL χωρίς να το τρέχει) | 🟢 Όχι |
| `tools/vgw-cloudflare.ps1` | Βήματα Cloudflare του Travel Gear World: έλεγχος, D1, δοκιμαστική διεύθυνση, φόρτωση προϊόντων, σύνδεση travelgearworld.com, ενημέρωση | 🟢 `check` όχι · 🔴 τα άλλα μόνο με `-Apply` και φράση `ΕΓΚΡΙΝΩ VGW ...` |
| `tools/sgw-import-plan.ps1` | Sporty Gear World: δείχνει ποια προϊόντα των feeds (από όλους τους φακέλους Awin του υπολογιστή) θα έμπαιναν στο SGW και σε ποια κατηγορία, και γιατί άλλα μένουν έξω (σχέδιο δοκιμής, γράφει SQL χωρίς να το τρέχει). `-Only 30645` για ένα κατάστημα | 🟢 Όχι |
| `tools/sgw-cloudflare.ps1` | Βήματα Cloudflare του Sporty Gear World: έλεγχος, D1, δοκιμαστική διεύθυνση (noindex), φόρτωση προϊόντων, σύνδεση sportygearworld.com, ενημέρωση. Σταματά πριν από το ημερήσιο όριο εγγραφών του δωρεάν πλάνου (L49) | 🟢 `check` όχι · 🔴 τα άλλα μόνο με `-Apply` και φράση `ΕΓΚΡΙΝΩ SGW ...` |
| `tools/gwh-agw-link.ps1` | Βάζει το Car Gear World στο Gear World Hub ως 8ο site (κάρτα στην αρχική σε 11 γλώσσες και γραμμή στη λίστα sites της D1 του hub), μετά το TGW | 🟢 χωρίς `-Apply` μόνο ελέγχει · 🔴 με `-Apply` και `ΕΓΚΡΙΝΩ AGW HUB LINK`, με backup και σημείο επαναφοράς πρώτα |
| `tools/gwh-vgw-link.ps1` | Βάζει το Travel Gear World στο Gear World Hub ως 9ο site (κάρτα στην αρχική σε 11 γλώσσες και γραμμή στη λίστα sites της D1 του hub), μετά το AGW | 🟢 χωρίς `-Apply` μόνο ελέγχει · 🔴 με `-Apply` και `ΕΓΚΡΙΝΩ VGW HUB LINK`, με backup και σημείο επαναφοράς πρώτα |
| `tools/gwh-sgw-link.ps1` | Βάζει το Sporty Gear World στο Gear World Hub ως 10ο site (κάρτα Sport σε 11 γλώσσες, ως φαρδιά κάρτα στην τελευταία σειρά όπου το hub δείχνει 3 ανά σειρά, και γραμμή στη λίστα sites της D1 του hub), μετά το VGW. Ελέγχει πρώτα την Cloudflare (1.1.1.1, L36). Δεν αλλάζει το worker.js του hub (αναζήτηση, αναζήτηση με φωτογραφία) ούτε τον Worker gwh-sitemap | 🟢 χωρίς `-Apply` μόνο ελέγχει · 🔴 με `-Apply` και `ΕΓΚΡΙΝΩ SGW HUB LINK`, με backup και σημείο επαναφοράς πρώτα |
| `tools/gw-run.ps1` | Κατεβάζει μία κλειδωμένη έκδοση του repo και τρέχει ένα εργαλείο από αυτήν | 🟢 Όχι (μόνο αρχεία στο %TEMP%) |
| `tools/qa-gate.mjs`, `tools/layout-check.mjs` | Έλεγχοι ποιότητας ενός site (τρέχουν και αυτόματα σε κάθε αλλαγή). Το layout check ελέγχει και σε άλλη γλώσσα και νόμισμα (`--lang de-DE --currency RUB`) | 🟢 Όχι |
| `tools/i18n-check.mjs` | Ανοίγει κάθε σελίδα σε κάθε μία από τις 10 γλώσσες και βρίσκει κείμενα χωρίς μετάφραση | 🟢 Όχι |

## Πώς τρέχει ένα εργαλείο
Το Claude δίνει πάντα 3 γραμμές σαν αυτές (με κλειδωμένη έκδοση του script):

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$f = "$env:TEMP\gw-tool.ps1"; Invoke-WebRequest -UseBasicParsing -OutFile $f -Uri 'https://raw.githubusercontent.com/evangelos-gif/gear-world-code/<έκδοση>/tools/<εργαλείο>.ps1'
powershell -NoProfile -ExecutionPolicy Bypass -File $f
```

## Κανόνες ασφαλείας
1. 🟢 **Μόνο ανάγνωση από προεπιλογή.** Κανένα εργαλείο δεν αλλάζει site, D1 ή deploy χωρίς `-Apply` **και** την ακριβή φράση έγκρισης (π.χ. `ΕΓΚΡΙΝΩ TGW D1`).
2. 🔴 **Backup πριν από κάθε αλλαγή**, με οδηγίες επαναφοράς.
3. **Ποτέ μυστικά στο repo.** Το repo είναι δημόσιο. Tokens, κωδικοί, `.dev.vars`, IDs του Cloudflare και δεδομένα Awin μένουν μόνο στον υπολογιστή. Ο αυτόματος έλεγχος σταματά κάθε αλλαγή που τα περιέχει.
