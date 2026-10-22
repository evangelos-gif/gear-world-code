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
Φωνητική αναζήτηση: κουμπί μικροφώνου μέσα στο κουτί αναζήτησης (expo-speech-recognition, στη γλώσσα της εφαρμογής, μέσω της υπηρεσίας ομιλίας του κινητού· η εφαρμογή δεν κρατά ηχογραφήσεις). Δουλεύει μόνο στο APK/build, όχι στο Expo Go (εκεί το κουμπί κρύβεται). Αναζήτηση με κάμερα: σε επόμενη έκδοση.

Στον υπολογιστή: `tools/gw-app-dev.ps1` (αντιγράφει, εγκαθιστά, ξεκινά με QR για το Expo Go). Με `-BuildApk` και τη φράση `ΕΓΚΡΙΝΩ GEAR WORLD APP BUILD` ξεκινά δοκιμαστικό APK στο EAS (προφίλ preview, χωρίς αποστολή σε store). Με `-BuildIos` και τη φράση `ΕΓΚΡΙΝΩ GEAR WORLD IOS TESTFLIGHT` φτιάχνει το iPhone build (προφίλ production) και το ανεβάζει στο TestFlight (ιδιωτικές δοκιμές, όχι δημόσιο App Store)· η σύνδεση Apple και ο κωδικός 2FA γράφονται μόνο στο παράθυρο.

Έλεγχοι: `npm run typecheck`, `npm test`, `npx expo export --platform android|ios` (τρέχουν και στο CI).
