# Technology Gear World (TGW): πλάνο

Domain: **technologygearworld.com** (Cloudflare).
Στόχος: το καλύτερο site του δικτύου, που μετά γίνεται πρότυπο για τη διόρθωση των άλλων 6.

Σήμανση: 🟢 μόνο ανάγνωση ή δουλειά μέσα στο repo · 🔴 αλλαγή σε Cloudflare/D1/deploy, γίνεται **μόνο** με τη φράση έγκρισης.

## Φάση 0: Εργαλεία (σήμερα)
- 🟢 Repo `gear-world-code` με αυτόματους ελέγχους σε Windows PowerShell 5.1.
- 🟢 `docs/LESSONS.md`: τα λάθη του παρελθόντος γίνονται κανόνες.

## Φάση 1: Ανάλυση
- 🟢 Στιγμιότυπο του κώδικα του GGW (`tools/gw-site-snapshot.ps1`): worker.js, ρυθμίσεις, δομή D1.
- 🟢 Έλεγχος του live GGW και των άλλων sites (headers, SEO, μέγεθος σελίδων).
- 🟢 Αιτήσεις σε UK tech retailers στο Awin (Currys, Laptops Direct, Back Market UK, AO, Currys Partmaster).

## Φάση 2: Καθαρό πρότυπο (μόνο στο repo) ✅ 18/10
- 🟢 Ένα αρχείο ρυθμίσεων ανά site: `sites/tgw/site.config.js`.
- 🟢 Κοινή μηχανή σε μικρά κομμάτια (`src/`): σελίδες, API, sitemap, `/out/` clicks, headers.
- 🟢 Ένα CSS, ένα JS, σελίδες που φτιάχνει ο server. Αρχική ~35 KB αντί για 457 KB.
- 🟢 QA gate (`tools/qa-gate.mjs`): ελέγχει τους κανόνες του `LESSONS.md` σε κάθε αλλαγή (675 έλεγχοι, όλοι πράσινοι με δοκιμαστικά προϊόντα).
- 🟢 Content-Security-Policy ενεργή από την πρώτη μέρα: το TGW δεν έχει inline κώδικα, οπότε δεν χρειάζεται φάση Report-Only.

## Φάση 3: Προϊόντα (σε εξέλιξη)
- 🟢 Κανόνες κατηγοριών: `sites/tgw/category-rules.js` (λίστα «όχι» για εργαλεία, ανταλλακτικά αυτοκινήτου, ρούχα κ.λπ. και κανόνες ανά κατηγορία).
- 🟢 Πηγές: `sites/tgw/sources.json` (σήμερα: Joybuy UK).
- 🟢 Σχέδιο import (dry run): `tools/tgw-import-plan.ps1` διαβάζει το feed στον υπολογιστή και γράφει αναφορά και SQL που **δεν** εκτελείται.
- 🟢 Ρύθμιση των κανόνων με βάση την πραγματική αναφορά.

## Εμφάνιση ✅ 18/10
- Ίδιο ύφος με τα άλλα sites: φωτογραφία στο hero, φωτογραφίες στις κατηγορίες, χρυσοί τίτλοι, μπάρα Gear World Hub.
- Φωτογραφίες Pexels (άδεια για εμπορική χρήση): `docs/IMAGE-CREDITS.md`.

## Φάση 4: Cloudflare (με έγκριση)
- 🔴 Νέα D1 `technology-gear-world` με migrations → `ΕΓΚΡΙΝΩ TGW D1`
- 🔴 Νέος Worker μόνο σε δοκιμαστική διεύθυνση workers.dev → `ΕΓΚΡΙΝΩ TGW PREVIEW`
- 🔴 Import προϊόντων στη D1 του TGW → `ΕΓΚΡΙΝΩ TGW IMPORT`

## Φάση 5: Έλεγχος πριν το launch
- 🟢 Όλο το QA gate πράσινο.
- 🟢 Δοκιμαστικό click μέσω Awin για κάθε retailer, με επιβεβαίωση στο Awin.

## Φάση 6: Launch (με έγκριση)
- 🔴 Σύνδεση του technologygearworld.com → `ΕΓΚΡΙΝΩ TGW DOMAIN`
- 🔴 Link από το Hub → `ΕΓΚΡΙΝΩ TGW HUB LINK`
- 🟢 Search Console, sitemap, social.

## Φάση 7: Τα άλλα 6 sites
- 🟢 Το ίδιο QA gate τρέχει στα CGW, MGW, WGW, KGW, HGW, GGW και βγάζει λίστα διορθώσεων.
- 🔴 Διορθώσεις ένα-ένα site, με backup και φράση έγκρισης για το καθένα.
