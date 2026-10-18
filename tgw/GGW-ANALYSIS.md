# Ανάλυση GGW (18/10/2026): τι κρατάμε για το TGW

Πηγή: στιγμιότυπο `gw-site-snapshot v1` του φακέλου garden-gear-world (μόνο ανάγνωση) και έλεγχος του live site.

## Κρατάμε (δουλεύει σωστά)
- **D1 `products`** με αναζήτηση FTS5 (triggers για insert, update, delete) και μοναδικό κλειδί `(retailer, merchant_product_id)` για ασφαλή ανανέωση.
- **`/out/<id>`**: ο server κάνει redirect στο link του Awin και γράφει το click στον πίνακα `affiliate_clicks`.
- **Ερωτήματα D1 μόνο με `bind()`**. Η ταξινόμηση έρχεται από σταθερή λίστα, όχι από τον χρήστη.
- **Σελίδα προϊόντος από τον server**, με canonical slug και 301 προς τη σωστή διεύθυνση.
- **Sitemap index** με προϊόντα σε κομμάτια των 10.000.
- **Turnstile** στη φόρμα, με έλεγχο στον server.
- **www → χωρίς www** με 301.

## Αλλάζουμε
| Θέμα | Σήμερα στο GGW | Στο TGW |
|---|---|---|
| Κουμπί αγοράς | Η σελίδα προϊόντος δεν έχει link προς το κατάστημα | Εμφανές κουμπί προς `/out/<id>` (L20) |
| Σελίδα προϊόντος | Arial, χωρίς header/footer, χωρίς analytics, `no-store` cache | Πλήρες template, νομικά links, analytics, cache 5 λεπτών |
| Κατηγορίες | Αντίγραφο της αρχικής + JavaScript, canonical στην αρχική | Δική τους σελίδα από τον server, στο sitemap (L10) |
| Ονόματα και domain | Γραμμένα 8+ φορές μέσα στον κώδικα, «Home Gear Product» στο meta | Ένα αρχείο ρυθμίσεων (L01) |
| Headers | Χωρίς headers ασφαλείας | Charset και headers ασφαλείας σε κάθε απάντηση (L05, L06) |
| GTIN | Μόνο έλεγχος 13 ψηφίων | Και έλεγχος ψηφίου ελέγχου (L12) |
| Καταγραφή clicks | Δύο δρόμοι (`/out/` και `/api/track-click`): πιθανή διπλομέτρηση | Μόνο `/out/` |
| Μετάφραση αναζήτησης μέσω Hub | Κλειδωμένη σε συγκεκριμένη παλιά έκδοση του Hub | Τρέχουσα έκδοση του Hub, με όριο χρόνου |
| Φόρμα Rewards | Ζητά «trade», λέει αν ένα email υπάρχει ήδη, χωρίς όριο αιτήσεων | Χωρίς «trade», ουδέτερο μήνυμα, όριο αιτήσεων (L07, L17) |
| Admin token | `HGW_ADMIN_TOKEN` (όνομα άλλου site) | Γενικό όνομα, σύγκριση σταθερού χρόνου |
| Πίνακας products | Δεν έχει πότε το είδαμε τελευταία φορά στο feed | Στήλες `last_seen_at`, `gtin_valid`, `was_price`, `category_slug` |

## Πετάμε
- Την αρχική των 457 KB (42 μπλοκ `<style>`, 15 inline scripts): νέα templates με ένα CSS και ένα JS (L02).
- Τα 9 `index-before-*.html` και τις εικόνες KGW/HGW από το `public/` (L04, T37).
- Τα 60+ αρχεία-μπαλώματα του φακέλου.

## Βάση δεδομένων (σημερινή δομή)
`products`, `products_fts` (FTS5), `affiliate_clicks`, `customers`, με indexes σε `is_active`, `site_category`, `retailer` και `clicked_at`.
