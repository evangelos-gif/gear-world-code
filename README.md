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
| `tools/awin-feed-inventory.ps1` | Διαβάζει τον φάκελο με τα feeds του Awin στο PC και δείχνει ανά κατάστημα: προϊόντα, απόθεμα, EAN, πόσο παλιό είναι το αρχείο, σε ποιο site ταιριάζει και αν το χρησιμοποιεί ήδη κάποιο site | 🟢 Όχι |
| `tools/awin-feed-sample.ps1 -Advertiser <id>` | Διαβάζει το feed ενός καταστήματος από τον ίδιο φάκελο και δείχνει στήλες, όλες τις κατηγορίες με πλήθος, νομίσματα, απόθεμα και δείγματα προϊόντων, για να γραφτούν σωστά οι κανόνες εισαγωγής | 🟢 Όχι |
| `tools/group-site.ps1` | Η σελίδα της εταιρείας gearworldgroup.com για retailers και Awin (`sites/group`) | 🟢 `check` όχι · 🔴 `launch`/`update` μόνο με `-Apply` και `ΕΓΚΡΙΝΩ GROUP SITE` / `ΕΓΚΡΙΝΩ GROUP UPDATE` |
| `tools/theme-site.mjs` | Αντιγράφει τα κοινά αρχεία (script, εικονίδια, γραμματοσειρές, χρώματα του stylesheet) από το TGW σε άλλο site της μηχανής | Μόνο αρχεία του repo |
| `promos/promos.js` | Οι κωδικοί έκπτωσης και οι καμπάνιες των retailers (από τα email τους), με ημερομηνία λήξης και σε ποια sites φαίνονται | Αλλάζει τα sites μόνο μετά από ενημέρωση (deploy) με έγκριση |
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
