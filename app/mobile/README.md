# Gear World app (Android + iPhone)

Εφαρμογή Expo (React Native) που κάνει ό,τι και το gearworldhub.com. Ένας κώδικας για Android και iPhone.

| Τι | Από πού έρχεται |
|---|---|
| Λίστα worlds (νέα worlds εμφανίζονται μόνα τους) | `gearworldhub.com/api/registry` |
| Αναζήτηση σε όλα τα worlds | `gearworldhub.com/api/search` |
| Προϊόντα ενός world, κατηγορίες, ταξινόμηση | `<site>/api/products` |
| «Δες το στο κατάστημα» | `<site>/out/<id>` στον browser του κινητού (καταγραφή click + Awin) |
| Newsletter | `gearworldhub.com/api/subscribe` (ίδια συγκατάθεση με το Hub) |
| Νομικές σελίδες | `gearworldhub.com/privacy/`, `/terms/`, `/affiliate-disclosure/`, `/contact/` |
| Κείμενα 11 γλωσσών | `src/i18n/hub-strings.json` (από το Hub) και `src/i18n/app-strings.ts` |

Αποφάσεις v1: χωρίς Rewards και λογαριασμούς, χωρίς analytics, 11 γλώσσες, `com.gearworldhub.app`.
Φωνητική αναζήτηση: το μικρόφωνο του πληκτρολογίου. Αναζήτηση με κάμερα: σε επόμενη έκδοση.

Στον υπολογιστή: `tools/gw-app-dev.ps1` (αντιγράφει, εγκαθιστά, ξεκινά με QR για το Expo Go).

Έλεγχοι: `npm run typecheck`, `npm test`, `npx expo export --platform android|ios` (τρέχουν και στο CI).
