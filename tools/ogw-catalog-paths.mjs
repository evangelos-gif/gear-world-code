// Stores whose Linkwise feed has no category names (owner, 24 Nov 2026, lessons L231): AB Vasilopoulos (12158) writes a
// number or "null" in merchant_category, so its catalogue takes the categories from the address of each product
// (https://www.ab.gr/el/eshop/<level 1>/<level 2>/.../p/<id>), with Greek names written for its slugs. A slug that is
// not in the list puts the product only in the level above it (a new level 1 slug: in «Άλλα»), never a made-up name.
export const PATH_CATEGORIES = {
  12158: {
    base: ['el', 'eshop'],
    names: {
      'Eidi-prosopikis-peripoiisis': ['Είδη προσωπικής περιποίησης', {
        'Andriki-peripoiisi': 'Ανδρική περιποίηση', 'Frontida-mallion': 'Φροντίδα μαλλιών', 'Frontida-somatos': 'Φροντίδα σώματος',
        'Gynaikeia-peripoiisi': 'Γυναικεία περιποίηση', 'Parafarmakeytika-Eidi': 'Παραφαρμακευτικά είδη',
        'Prosopiki-ygieini': 'Προσωπική υγιεινή', 'Stomatiki-ygieini': 'Στοματική υγιεινή'
      }],
      'Vasika-typopoiimena-trofima': ['Βασικά τυποποιημένα τρόφιμα', {
        'Aleyri-Simigdali': 'Αλεύρι & σιμιγδάλι', 'Delicatessen': 'Delicatessen', 'Diethnis-Koyzina': 'Διεθνής κουζίνα',
        'Eidi-zacharoplastikis': 'Είδη ζαχαροπλαστικής', 'Elaiolado-and-Elies': 'Ελαιόλαδο & ελιές', 'Konserves': 'Κονσέρβες',
        'Meigmata-gia-glyka': 'Μείγματα για γλυκά', 'Mpacharika-Alati': 'Μπαχαρικά & αλάτι', 'Ryzi-Ospria': 'Ρύζι & όσπρια',
        'Saltses-Dressings': 'Σάλτσες & dressings', 'Soypes-Zomoi-Kyvoi-Poyres': 'Σούπες, ζωμοί, κύβοι & πουρές',
        'Sporelaio-and-Mageirika-Lipi': 'Σπορέλαιο & μαγειρικά λίπη', 'Xydi-Lemoni': 'Ξύδι & λεμόνι', 'Zachari': 'Ζάχαρη',
        'Zymarika': 'Ζυμαρικά'
      }],
      'Katharistika-Chartika-and-eidi-spitioy': ['Καθαριστικά, χαρτικά & είδη σπιτιού', {
        'Aporrypantika-Piaton': 'Απορρυπαντικά πιάτων', 'Aporrypantika-Plyntirioy-Roychon': 'Απορρυπαντικά πλυντηρίου ρούχων',
        'Aporrypantika-gia-plysimo-sto-cheri': 'Απορρυπαντικά για πλύσιμο στο χέρι', 'Aposkliryntika-plyntirioy': 'Αποσκληρυντικά πλυντηρίου',
        'Aromatika-Keria': 'Αρωματικά & κεριά', 'Axesoyar-katharismoy': 'Αξεσουάρ καθαρισμού', 'Charti-oikiakis-chrisis': 'Χαρτί οικιακής χρήσης',
        'Dora-and-Paichnidia': 'Δώρα & παιχνίδια', 'Eidi-aytokinitoy': 'Είδη αυτοκινήτου', 'Eidi-oikiakis-chrisis': 'Είδη οικιακής χρήσης',
        'Eidi-sideromatos-Leyka-Eidi': 'Είδη σιδερώματος & λευκά είδη', 'Entomoapothitika-Entomoktona': 'Εντομοαπωθητικά & εντομοκτόνα',
        'Epochiaka-Eidi': 'Εποχιακά είδη', 'Fylaxi-roychon': 'Φύλαξη ρούχων', 'Grafiki-Yli-and-Analosima': 'Γραφική ύλη & αναλώσιμα',
        'Katharistika': 'Καθαριστικά', 'Leykantika-and-Enischytika-Plysimatos': 'Λευκαντικά & ενισχυτικά πλύσης',
        'Malaktika-roychon': 'Μαλακτικά ρούχων'
      }],
      'Proino-snacking-and-rofimata': ['Πρωινό, σνακ & ροφήματα', {
        'Dimitriaka': 'Δημητριακά', 'Kafes': 'Καφές', 'Kakao-Sokolata-rofima': 'Κακάο & σοκολάτα ρόφημα', 'Karameles': 'Καραμέλες',
        'Krakers': 'Κράκερ', 'Marmelades': 'Μαρμελάδες', 'Meli': 'Μέλι', 'Mpiskota': 'Μπισκότα',
        'Pralina-Fystikovoytyro-and-Tachini': 'Πραλίνα, φυστικοβούτυρο & ταχίνι', 'Snaks': 'Σνακ', 'Sokolates': 'Σοκολάτες',
        'Tsai-Afepsimata': 'Τσάι & αφεψήματα', 'Tsichles': 'Τσίχλες'
      }],
      'Kava-anapsyktika-nera-xiroi-karpoi': ['Κάβα, αναψυκτικά, νερά & ξηροί καρποί', {
        'Anapsyktika': 'Αναψυκτικά', 'Apoxiramena-froyta': 'Αποξηραμένα φρούτα', 'Chymoi-ektos-psygeioy': 'Χυμοί εκτός ψυγείου',
        'Krasia': 'Κρασιά', 'Mpyres': 'Μπύρες', 'Nera': 'Νερά', 'Pota': 'Ποτά', 'Xiroi-karpoi': 'Ξηροί καρποί'
      }],
      'Galaktokomika-Fytika-Rofimata-and-Eidi-Psygeioy': ['Γαλακτοκομικά, φυτικά ροφήματα & είδη ψυγείου', {
        'Ayga': 'Αυγά', 'Chymoi-psygeioy': 'Χυμοί ψυγείου', 'Freskes-zymes-Fylla-Magia': 'Φρέσκες ζύμες, φύλλα & μαγιά',
        'Gala-and-Fytika-Rofimata': 'Γάλα & φυτικά ροφήματα', 'Giaoyrtia': 'Γιαούρτια', 'Kremes-Glykismata': 'Κρέμες & γλυκίσματα',
        'Kremes-galaktos-and-santigy': 'Κρέμες γάλακτος & σαντιγί', 'Salates-Aloifes': 'Σαλάτες & αλοιφές',
        'Voytyro-Margarini': 'Βούτυρο & μαργαρίνη'
      }],
      'Artos-Zacharoplasteio': ['Άρτος & ζαχαροπλαστείο', {
        'Cakes-Danish-Donuts': 'Κέικ & ντόνατς', 'Chalvas': 'Χαλβάς', 'Fresko-psomi': 'Φρέσκο ψωμί', 'Fryganies': 'Φρυγανιές',
        'Koyloyria-almyra': 'Κουλούρια αλμυρά', 'Koyloyria-glyka': 'Κουλούρια γλυκά', 'Kritsinia-and-Croutons': 'Κριτσίνια & κρουτόν',
        'Kroyasan': 'Κρουασάν', 'Paradosiaka-Glyka': 'Παραδοσιακά γλυκά', 'Paximadia': 'Παξιμάδια', 'Psomi-toy-tost': 'Ψωμί του τοστ',
        'Tsoyrekia': 'Τσουρέκια'
      }],
      'Tyria-Fytika-Anapliromata-and-Allantika': ['Τυριά, φυτικά αναπληρώματα & αλλαντικά', {
        'Allantika': 'Αλλαντικά', 'Fytika-Anapliromata': 'Φυτικά αναπληρώματα', 'Tyria': 'Τυριά'
      }],
      'Katepsygmena-trofima': ['Κατεψυγμένα τρόφιμα', {
        'Katepsygmena-Etoima-Fagita': 'Κατεψυγμένα έτοιμα φαγητά', 'Katepsygmena-Psaria-and-Thalassina': 'Κατεψυγμένα ψάρια & θαλασσινά',
        'Katepsygmena-froyta-and-lachanika': 'Κατεψυγμένα φρούτα & λαχανικά',
        'Katepsygmenes-Pitses-and-Fylla-and-Pites': 'Κατεψυγμένες πίτσες, φύλλα & πίτες', 'Katepsygmeno-Kreas': 'Κατεψυγμένο κρέας',
        'Pagota': 'Παγωτά'
      }],
      'Ola-gia-to-moro': ['Όλα για το μωρό', {
        'Axesoyar-gia-to-moro': 'Αξεσουάρ για το μωρό', 'Moromantila': 'Μωρομάντηλα', 'Panes-Moroy': 'Πάνες μωρού',
        'Vrefikes-trofes': 'Βρεφικές τροφές', 'Vrefiki-Peripoiisi-Somatos': 'Βρεφική περιποίηση σώματος'
      }],
      'Gia-katoikidia': ['Για κατοικίδια', {
        'Alla-katoikidia': 'Άλλα κατοικίδια', 'Gia-gates': 'Για γάτες', 'Gia-skyloys': 'Για σκύλους', 'Ygieini-zoon': 'Υγιεινή ζώων'
      }],
      'Oporopoleio': ['Οπωροπωλείο', { 'Froyta': 'Φρούτα', 'Lachanika': 'Λαχανικά', 'Nopoi-xiroi-karpoi': 'Νωποί ξηροί καρποί' }],
      'Fresko-Kreas-and-Psaria': ['Φρέσκο κρέας & ψάρια', {
        'Choirino': 'Χοιρινό', 'Choirino-Mpoyti-Spala': 'Χοιρινό μπούτι & σπάλα', 'Etoimes-Lyseis-Kreopoleioy': 'Έτοιμες λύσεις κρεοπωλείου',
        'Freska-psaria-and-thalassina': 'Φρέσκα ψάρια & θαλασσινά', 'Kimas': 'Κιμάς', 'Kotopoylo': 'Κοτόπουλο', 'Kynigi': 'Κυνήγι',
        'Moschari': 'Μοσχάρι'
      }],
      'Etoima-Geymata': ['Έτοιμα γεύματα', {
        'Etoima-Geymata-Kreas-Zymarika-and-Soypes': 'Κρέας, ζυμαρικά & σούπες', 'Etoima-Geymata-Psaria-and-Thalassina': 'Ψάρια & θαλασσινά',
        'Etoima-Santoyits': 'Σάντουιτς', 'Etoimes-Salates': 'Σαλάτες'
      }],
      'Sympliromata-Diatrofis-and-Vitamines': ['Συμπληρώματα διατροφής & βιταμίνες', { 'Ygeia': 'Υγεία' }],
      'Healthy-Corner': ['Healthy Corner', { 'Choris-Laktozi': 'Χωρίς λακτόζη', 'Viologika-': 'Βιολογικά' }],
      'Vegan-Proionta': ['Vegan προϊόντα', {}]
    }
  }
};

// The levels of a product from its address: [level 1] or [level 1, level 2] with the names above; null when the
// address is not under the store's base path or its level 1 slug has no name (the caller puts it in «Άλλα»).
export function pathLevels(page, spec) {
  let parts;
  try { parts = new URL(page).pathname.split('/').filter(Boolean).map(p => decodeURIComponent(p)); } catch { return null; }
  if (!spec || parts.length < spec.base.length + 1 || spec.base.some((b, i) => parts[i] !== b)) return null;
  // Own keys only (review 25/11/2026: a slug such as "constructor" is not a category).
  const k1 = parts[spec.base.length];
  const top = Object.hasOwn(spec.names, k1) ? spec.names[k1] : null;
  if (!top) return null;
  const k2 = parts[spec.base.length + 1];
  const sub = k2 !== undefined && Object.hasOwn(top[1], k2) ? top[1][k2] : '';
  return sub ? [top[0], sub] : [top[0]];
}
