# Οι αφίσες A3 του Gear World

Εδώ μένει ο κώδικας κάθε τυπωμένης αφίσας, για να μη χαθεί ξανά (L95). Κάθε αφίσα είναι ένα `build.py`, που βγάζει
PDF για τύπωμα (A3 οριζόντιο, 420 × 297 mm), PNG για προβολή και ένα μεγάλο PNG για τον έλεγχο των QR.

| Φάκελος | Αφίσα | QR (δεν αλλάζουν ποτέ, L76) |
|---|---|---|
| `hub/` | «Μόνο Hub»: ένα μεγάλο QR του Hub πάνω στη Γη με χρυσές λεπτομέρειες και τα 13 Gear Worlds από κάτω (τυπώθηκε Νοε. 2026) | `utm_campaign=poster-hub`, `utm_content=hub` |
| `cgw/` | Construction Gear World (5/11/2026), A3 **κάθετο** (297 × 420 mm), όπως το παράδειγμα του ιδιοκτήτη: κεφαλίδα με το λογότυπο του CGW, η φωτογραφία του ίδιου του site με το «SCAN ME», 4 λόγοι δεξιά, κινητό με το αληθινό site (`phone-screen.jpg`), οι κατηγορίες και η μπάρα «Part of Gear World Hub». Χρώματα του CGW (σκούρο και κεχριμπαρί). Χωρίς λογότυπα ή ονόματα μαρκών | `poster-cgw`, `utm_content=cgw` |
| `cgw-earth/` | Προσχέδιο 1 του CGW (5/11/2026, δεν διαλέχτηκε): στο ύφος της αφίσας του Hub, με τη λωρίδα «GEAR WORLD ECOSYSTEM» και μικρό QR του Hub | `poster-cgw` με `utm_content=cgw` και `hub` |

## Κανόνες για κάθε νέα αφίσα

- Πρώτα το όνομα της αφίσας (`utm_campaign`) και κάθε νέο site στο `src/posters.js`, και ενημέρωση του μετρητή με
  `tools/poster-setup.ps1 -Step counter` (φράση «ΕΓΚΡΙΝΩ POSTER COUNTER»), πριν κολλήσει η αφίσα (L95). Το
  `tests/worker/posters.test.mjs` ελέγχει κάθε QR αυτού του φακέλου.
- Ήρωας το Gear World. Χωρίς τιμές, κωδικούς έκπτωσης ή Black Friday (η αφίσα μένει μήνες). Χωρίς λογότυπα ή
  φωτογραφίες καταστημάτων και μαρκών. Ποτέ «UK retailers». Κάθε όνομα με λέξεις.
- Χρώματα που ξεχωρίζουν και χωρίς κόκκινο/πράσινο: navy, μπλε, πορτοκαλί, χρυσό, ή τα χρώματα του ίδιου του site
  (CGW: σκούρο #1d1b17 και κεχριμπαρί #ffc21a). Λευκό πίσω από τα QR.
- Κάθε QR με λευκό περιθώριο τουλάχιστον 4 τετραγώνων γύρω του και τετράγωνα τουλάχιστον 1,1 mm.
- Πριν δοθεί για τύπωμα: `check.py` (κάθε QR διαβάζεται σωστά), κάθε διεύθυνση ανοίγει (με `curl`, που δεν μετράει
  ως σάρωση), μία δοκιμαστική σάρωση με `poster-test` που φαίνεται στη βάση και μετά σβήνεται με
  `tools/poster-setup.ps1 -Step test-cleanup` («ΕΓΚΡΙΝΩ POSTER CLEANUP»).
- Τύπωμα: «Πραγματικό μέγεθος» (100%), όχι «Προσαρμογή στη σελίδα»· ματ πλαστικοποίηση (η γυαλιστερή κάνει
  αντανάκλαση πάνω στο QR).

## Πώς χτίζεται (Linux, ή σε ένα session του Claude)

```
cd posters
npm ci                                   # η Γη (d3-geo, topojson-client, world-atlas) και η γραμματοσειρά Barlow Condensed
pip install -r requirements.txt          # qrcode, CairoSVG, Pillow, OpenCV, ZXing, pypdf, fontTools
python3 fonts.py                         # βάζει την Barlow Condensed (SIL OFL) για τον χρήστη
python3 cgw/build.py                     # γράφει cgw/out/: PDF, preview.png, check.png, qr-boxes.json
python3 check.py cgw                     # διαβάζει κάθε QR πάνω στην αφίσα: RESULT: OK
```

Χρειάζονται και οι γραμματοσειρές Inter και Inter Display. Η αφίσα του CGW παίρνει τη φωτογραφία από το
`sites/cgw/public/assets/img/hero-1774.webp` (δες `docs/IMAGE-CREDITS.md`). Το `earth.json` (η Γη) γίνεται μόνο του την πρώτη φορά με
`node earth.mjs <φάκελος>/earth.json 210 152 136 12 14`. Τα `out/` και `earth.json` δεν μπαίνουν στο repo.

Η αφίσα του Hub λέει «deals from UK shops», όπως τυπώθηκε· οι νεότερες αφίσες δεν γράφουν «UK».
