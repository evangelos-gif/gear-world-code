// The words Yadore searches for each category, per market and site (lessons L232): at most 2 per category, the first one
// the most typical product of the category. Greek market first (the categories that are empty in the Greek view). The
// box shows only where the visitor's view has at most YADORE_MAX_OWN own products (src/lib/yadore.js), so a category
// that has Greek retailers (e.g. AGW tyres, which also has no words here: Manager, 25 Nov 2026) keeps its own list.
// Checked against the live API with the read-only tools/yadore.ps1 -Step plan (offers and stores per word).
export const YADORE_WORDS = Object.freeze({
  gr: Object.freeze({
    cgw: {
      'power-tools': ['δραπανοκατσάβιδο', 'γωνιακός τροχός'],
      'hand-tools': ['σετ εργαλείων', 'κατσαβίδια'],
      'safety-footwear': ['παπούτσια ασφαλείας'],
      workwear: ['ρούχα εργασίας', 'φόρμα εργασίας'],
      ppe: ['γάντια εργασίας', 'γυαλιά προστασίας'],
      'site-equipment': ['σκάλα αλουμινίου', 'καρότσι μεταφοράς']
    },
    ggw: {
      'garden-tools': ['εργαλεία κήπου'],
      'power-garden-tools': ['χλοοκοπτική μηχανή', 'θαμνοκοπτικό'],
      'garden-furniture-outdoor-living': ['έπιπλα κήπου', 'ξαπλώστρα'],
      'bbq-outdoor-cooking': ['ψησταριά', 'μπάρμπεκιου'],
      'garden-buildings-fencing-storage': ['αποθήκη κήπου', 'περίφραξη'],
      'watering-irrigation': ['λάστιχο ποτίσματος', 'ποτιστικό'],
      'plants-growing-garden-care': ['λίπασμα', 'γλάστρα'],
      'outdoor-lighting-garden-electrical': ['φωτιστικό κήπου', 'ηλιακό φωτιστικό']
    },
    hgw: {
      furniture: ['καναπές', 'τραπεζαρία'],
      'kitchen-dining': ['τηγάνι', 'σετ μαχαιροπίρουνα'],
      'home-appliances': ['ηλεκτρική σκούπα', 'καφετιέρα'],
      'bedding-bath': ['σεντόνια', 'πετσέτες μπάνιου'],
      'home-decor': ['καθρέπτης', 'διακοσμητικά σπιτιού'],
      lighting: ['φωτιστικό οροφής', 'πορτατίφ'],
      'storage-organisation': ['κουτιά αποθήκευσης', 'ραφιέρα'],
      'cleaning-laundry': ['σιδερωτήριο', 'απλώστρα'],
      'smart-home': ['έξυπνη λάμπα', 'κάμερα ασφαλείας wifi'],
      'home-office': ['καρέκλα γραφείου', 'γραφείο υπολογιστή']
    },
    kgw: {
      clothing: ['παιδικά ρούχα'],
      'baby-toddler': ['καρότσι μωρού', 'παιδικό κάθισμα αυτοκινήτου'],
      'toys-games': ['παιχνίδια lego', 'κούκλα'],
      'sports-outdoors': ['παιδικό ποδήλατο', 'τραμπολίνο'],
      'kids-tech': ['παιδικό smartwatch', 'παιδικό tablet'],
      'bedroom-home': ['παιδικό κρεβάτι', 'παιδική ντουλάπα'],
      accessories: ['παιδική τσάντα', 'παιδικό καπέλο'],
      shoes: ['παιδικά παπούτσια'],
      'gifts-for-kids': ['επιτραπέζια παιχνίδια', 'δώρα για παιδιά'],
      'school-backpacks': ['σχολική τσάντα', 'κασετίνα']
    },
    mgw: {
      clothing: ['ανδρικό μπουφάν', 'ανδρικό πουκάμισο'],
      watches: ['ανδρικό ρολόι'],
      jewellery: ['ανδρικό βραχιόλι'],
      shoes: ['ανδρικά παπούτσια'],
      'everyday-carry': ['πολυεργαλείο', 'ανδρικό πορτοφόλι'],
      'bags-accessories': ['ανδρική τσάντα', 'σακίδιο πλάτης'],
      'grooming-fragrances': ['ξυριστική μηχανή', 'ανδρικό άρωμα'],
      'gifts-for-him': ['δώρα για άνδρες']
    },
    wgw: {
      clothing: ['γυναικείο φόρεμα', 'γυναικείο μπουφάν'],
      watches: ['γυναικείο ρολόι'],
      jewellery: ['γυναικεία σκουλαρίκια', 'γυναικείο κολιέ'],
      shoes: ['γυναικεία παπούτσια'],
      'bags-accessories': ['γυναικεία τσάντα'],
      'beauty-fragrances': ['γυναικείο άρωμα', 'πιστολάκι μαλλιών'],
      'everyday-essentials': ['γυναικείο πορτοφόλι', 'ομπρέλα βροχής'],
      'gifts-for-her': ['δώρα για γυναίκες']
    },
    agw: {
      'garage-tools-equipment': ['γρύλος αυτοκινήτου', 'κομπρεσέρ αέρος'],
      'diagnostics-battery': ['φορτιστής μπαταρίας αυτοκινήτου', 'διαγνωστικό obd'],
      'parts-maintenance': ['λάδι κινητήρα', 'υαλοκαθαριστήρες'],
      'car-care-detailing': ['κερί αυτοκινήτου', 'καθαριστικό αυτοκινήτου'],
      'car-electronics': ['κάμερα αυτοκινήτου', 'βάση κινητού αυτοκινήτου'],
      'interior-comfort': ['πατάκια αυτοκινήτου', 'καλύμματα καθισμάτων αυτοκινήτου'],
      'roof-towing-exterior': ['μπαγκαζιέρα οροφής', 'μπάρες οροφής'],
      'ev-charging': ['φορτιστής ηλεκτρικού αυτοκινήτου'],
      'safety-winter': ['αλυσίδες χιονιού', 'τρίγωνο ασφαλείας']
    },
    bgw: {
      helmets: ['κράνος μηχανής'],
      'jackets-trousers': ['μπουφάν μηχανής'],
      'boots-gloves': ['γάντια μηχανής', 'μπότες μηχανής'],
      'parts-maintenance': ['λάδι μοτοσυκλέτας', 'μπαταρία μοτοσυκλέτας'],
      'luggage-security': ['βαλίτσα μηχανής', 'κλειδαριά δισκόφρενου'],
      electronics: ['ενδοεπικοινωνία κράνους', 'βάση κινητού μηχανής'],
      'electric-scooters': ['ηλεκτρικό πατίνι'],
      'kick-scooters': ['πατίνι'],
      'electric-motorbikes': ['ηλεκτρικό σκούτερ', 'ηλεκτρική μοτοσυκλέτα'],
      protection: ['προστατευτικά μηχανής', 'ανακλαστικό γιλέκο']
    },
    tgw: {
      'laptops-computing': ['laptop', 'mini pc'],
      'phones-smartwatches': ['smartphone', 'smartwatch'],
      audio: ['ακουστικά bluetooth', 'ηχείο bluetooth'],
      gaming: ['playstation 5', 'nintendo switch'],
      'cameras-drones': ['drone', 'action camera'],
      'tv-home-cinema': ['τηλεόραση 55', 'soundbar'],
      'smart-home-wifi': ['router wifi', 'έξυπνη πρίζα'],
      'accessories-storage': ['εξωτερικός σκληρός δίσκος', 'power bank']
    },
    vgw: {
      'luggage-suitcases': ['βαλίτσα καμπίνας', 'βαλίτσα'],
      'travel-bags-backpacks': ['σακίδιο ταξιδιού', 'σακ βουαγιάζ'],
      'travel-accessories': ['αντάπτορας ταξιδιού', 'μαξιλάρι ταξιδιού'],
      'comfort-sleep': ['μαξιλάρι αυχένα', 'μάσκα ύπνου'],
      'documents-security': ['θήκη διαβατηρίου', 'λουκέτο βαλίτσας'],
      'travel-tech': ['ζυγαριά αποσκευών', 'power bank'],
      'camping-outdoor': ['σκηνή camping', 'υπνόσακος'],
      'beach-holiday': ['πετσέτα θαλάσσης', 'ομπρέλα θαλάσσης']
    },
    sgw: {
      'fitness-gym': ['αλτήρες', 'διάδρομος γυμναστικής'],
      running: ['παπούτσια τρεξίματος'],
      cycling: ['ποδήλατο', 'κράνος ποδηλάτου'],
      'football-team-sports': ['μπάλα ποδοσφαίρου', 'παπούτσια ποδοσφαίρου'],
      'racket-sports': ['ρακέτα τένις', 'ρακέτα padel'],
      'water-sports': ['μάσκα κατάδυσης', 'μαγιό'],
      'hiking-climbing-winter': ['ορειβατικά παπούτσια', 'μπατόν πεζοπορίας'],
      'nutrition-hydration': ['πρωτεΐνη whey', 'παγούρι'],
      'sportswear-shoes-bags': ['αθλητικά παπούτσια', 'αθλητική τσάντα'],
      'golf-skate-more': ['skateboard', 'μπάλες γκολφ']
    },
    pgw: {
      'games-cards': ['παιχνίδι ps5', 'παιχνίδι nintendo switch'],
      controllers: ['χειριστήριο ps5', 'τιμονιέρα'],
      consoles: ['κονσόλα', 'playstation 5'],
      'pcs-laptops': ['gaming laptop', 'gaming pc'],
      monitors: ['gaming οθόνη', 'οθόνη 144hz'],
      'mice-keyboards': ['gaming ποντίκι', 'gaming πληκτρολόγιο'],
      headsets: ['gaming ακουστικά'],
      'chairs-desks': ['gaming καρέκλα', 'gaming γραφείο'],
      streaming: ['webcam', 'μικρόφωνο usb'],
      components: ['κάρτα γραφικών', 'ssd nvme']
    },
    zgw: {
      'beds-crates': ['κρεβάτι σκύλου', 'κλουβί μεταφοράς σκύλου'],
      walking: ['λουρί σκύλου', 'περιλαίμιο σκύλου'],
      toys: ['παιχνίδι σκύλου', 'παιχνίδι γάτας'],
      food: ['τροφή σκύλου', 'τροφή γάτας'],
      cats: ['ονυχοδρόμιο', 'άμμος γάτας'],
      grooming: ['βούρτσα σκύλου', 'σαμπουάν σκύλου'],
      feeding: ['μπολ σκύλου', 'αυτόματη ταΐστρα'],
      travel: ['τσάντα μεταφοράς σκύλου', 'κλουβί μεταφοράς γάτας'],
      'small-pets': ['ενυδρείο', 'κλουβί κουνελιού'],
      birds: ['κλουβί πουλιών', 'τροφή πουλιών'],
      horse: ['σέλα αλόγου', 'ιππασία']
    }
  })
});
