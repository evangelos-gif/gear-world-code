# Gear World email

`weekly_deals.py` φτιάχνει το HTML του εβδομαδιαίου email με deals (MailerLite, ομάδα «Gear World subscribers»).
Το τρέχει η προγραμματισμένη εργασία «Gear World weekly deals email» κάθε Πέμπτη: διαλέγει προϊόντα από τα sites,
ελέγχει τιμή και απόθεμα στη σελίδα του προϊόντος, γράφει ένα `week.json` (όπως το `example-week.json`) και φτιάχνει
ΠΡΟΧΕΙΡΗ καμπάνια στο MailerLite. Ποτέ δεν στέλνει: ο ιδιοκτήτης πατά «Schedule» για τις 19:00 (απόφαση 3/11/2026).

Η ταχυδρομική διεύθυνση του footer δεν είναι στο repo: η εργασία τη διαβάζει από το email καλωσορίσματος στο MailerLite.
