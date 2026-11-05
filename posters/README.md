# Οι αφίσες A3 του Gear World

Εδώ μένει ο κώδικας κάθε τυπωμένης αφίσας, για να μη χαθεί ξανά (L95). Κάθε αφίσα είναι ένα `build.py`, που βγάζει
PDF για τύπωμα (A3 οριζόντιο, 420 × 297 mm), PNG για προβολή και ένα μεγάλο PNG για τον έλεγχο των QR.

| Φάκελος | Αφίσα | QR (δεν αλλάζουν ποτέ, L76) |
|---|---|---|
| `hub/` | «Μόνο Hub»: ένα μεγάλο QR του Hub πάνω στη Γη με χρυσές λεπτομέρειες και τα 13 Gear Worlds από κάτω (τυπώθηκε Νοε. 2026) | `utm_campaign=poster-hub`, `utm_content=hub` |
| `cgw/` | Construction Gear World (5/11/2026): ίδιο ύφος· πάνω και στο κέντρο το CGW με μεγάλο QR, κάτω η λωρίδα «GEAR WORLD ECOSYSTEM» με όλα τα sites της αρχικής του Hub και ένα μικρότερο QR του Hub | `poster-cgw` με `utm_content=cgw` και `utm_content=hub` |

## Κανόνες για κάθε νέα αφίσα

- Πρώτα το όνομα της αφίσας (`utm_campaign`) και κάθε νέο site στο `src/posters.js`, και ενημέρωση του μετρητή με
  `tools/poster-setup.ps1 -Step counter` (φράση «ΕΓΚΡΙΝΩ POSTER COUNTER»), πριν κολλήσει η αφίσα (L95). Το
  `tests/worker/posters.test.mjs` ελέγχει κάθε QR αυτού του φακέλου.
- Ήρωας το Gear World. Χωρίς τιμές, κωδικούς έκπτωσης ή Black Friday (η αφίσα μένει μήνες). Χωρίς λογότυπα ή
  φωτογραφίες καταστημάτων και μαρκών. Ποτέ «UK retailers». Κάθε όνομα με λέξεις.
- Χρώματα μόνο navy, μπλε, πορτοκαλί και χρυσό (λευκό μόνο πίσω από τα QR και στα γράμματα), ώστε να ξεχωρίζουν και
  χωρίς κόκκινο/πράσινο.
- Κάθε QR με λευκό περιθώριο τουλάχιστον 4 τετραγώνων γύρω του και τετράγωνα τουλάχιστον 1,1 mm.
- Πριν δοθεί για τύπωμα: `check.py` (κάθε QR διαβάζεται σωστά), κάθε διεύθυνση ανοίγει (με `curl`, που δεν μετράει
  ως σάρωση), μία δοκιμαστική σάρωση με `poster-test` που φαίνεται στη βάση και μετά σβήνεται με
  `tools/poster-setup.ps1 -Step test-cleanup` («ΕΓΚΡΙΝΩ POSTER CLEANUP»).
- Τύπωμα: «Πραγματικό μέγεθος» (100%), όχι «Προσαρμογή στη σελίδα»· ματ πλαστικοποίηση (η γυαλιστερή κάνει
  αντανάκλαση πάνω στο QR).

## Πώς χτίζεται (Linux, ή σε ένα session του Claude)

```
cd posters
npm ci                                   # η Γη: d3-geo, topojson-client, world-atlas (μόνο για τις αφίσες)
pip install -r requirements.txt          # qrcode, CairoSVG, OpenCV, ZXing, pypdf
python3 cgw/build.py                     # γράφει cgw/out/: PDF, preview.png, check.png, qr-boxes.json
python3 check.py cgw                     # διαβάζει κάθε QR πάνω στην αφίσα: RESULT: OK
```

Χρειάζονται οι γραμματοσειρές Inter και Inter Display. Το `earth.json` (η Γη) γίνεται μόνο του την πρώτη φορά με
`node earth.mjs <φάκελος>/earth.json 210 152 136 12 14`. Τα `out/` και `earth.json` δεν μπαίνουν στο repo.

Η αφίσα του Hub λέει «deals from UK shops», όπως τυπώθηκε· οι νεότερες αφίσες δεν γράφουν «UK».
