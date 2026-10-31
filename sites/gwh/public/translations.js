(() => {
  "use strict";

  const LOCALES = [
    "en-GB",
    "el-GR",
    "de-DE",
    "fr-FR",
    "it-IT",
    "es-ES",
    "pt-PT",
    "nl-NL",
    "sq-AL",
    "ro-RO",
    "ru-RU"
  ];

  const S = {
    languageLabel: ["Language","Γλώσσα","Sprache","Langue","Lingua","Idioma","Idioma","Taal","Gjuha","Limbă","Язык"],

    navWorlds: ["Gear Worlds","Gear Worlds","Gear Worlds","Gear Worlds","Gear Worlds","Gear Worlds","Gear Worlds","Gear Worlds","Gear Worlds","Gear Worlds","Gear Worlds"],
    navAbout: ["About","Σχετικά","Über uns","À propos","Chi siamo","Acerca de","Sobre","Over ons","Rreth nesh","Despre","О нас"],

    heroEyebrow: [
      "ONE HUB. EVERY GEAR WORLD.",
      "ΕΝΑ HUB. ΟΛΑ ΤΑ GEAR WORLDS.",
      "EIN HUB. ALLE GEAR WORLDS.",
      "UN HUB. TOUS LES GEAR WORLDS.",
      "UN HUB. TUTTI I GEAR WORLDS.",
      "UN HUB. TODOS LOS GEAR WORLDS.",
      "UM HUB. TODOS OS GEAR WORLDS.",
      "ÉÉN HUB. ALLE GEAR WORLDS.",
      "NJË HUB. TË GJITHA GEAR WORLDS.",
      "UN HUB. TOATE GEAR WORLDS.",
      "ОДИН ХАБ. ВСЕ GEAR WORLDS."
    ],
    heroTitle1: [
      "What are you",
      "Τι",
      "Wonach",
      "Que",
      "Cosa stai",
      "¿Qué estás",
      "O que",
      "Waar bent u",
      "Çfarë po",
      "Ce",
      "Что вы"
    ],
    heroTitle2: [
      "looking for?",
      "ψάχνετε;",
      "suchen Sie?",
      "recherchez-vous ?",
      "cercando?",
      "buscando?",
      "procura?",
      "naar op zoek?",
      "kërkoni?",
      "căutați?",
      "ищете?"
    ],
    heroDesc: [
      "Explore specialist shopping for work, style, family, home and garden.",
      "Ανακαλύψτε εξειδικευμένες αγορές για εργασία, στυλ, οικογένεια, σπίτι και κήπο.",
      "Entdecken Sie spezialisierte Shopping-Welten für Arbeit, Stil, Familie, Zuhause und Garten.",
      "Découvrez des univers d’achat spécialisés pour le travail, le style, la famille, la maison et le jardin.",
      "Scopri mondi dedicati agli acquisti per lavoro, stile, famiglia, casa e giardino.",
      "Descubre universos de compras especializados para trabajo, estilo, familia, hogar y jardín.",
      "Descubra mundos de compras especializados para trabalho, estilo, família, casa e jardim.",
      "Ontdek gespecialiseerde winkelwerelden voor werk, stijl, gezin, wonen en tuin.",
      "Zbuloni botë të specializuara blerjesh për punë, stil, familje, shtëpi dhe kopsht.",
      "Descoperiți lumi de cumpărături specializate pentru muncă, stil, familie, casă și grădină.",
      "Откройте специализированные магазины для работы, стиля, семьи, дома и сада."
    ],

    searchPlaceholder: [
      "Search products, brands or categories...",
      "Αναζήτηση προϊόντων, μαρκών ή κατηγοριών...",
      "Produkte, Marken oder Kategorien suchen...",
      "Rechercher des produits, marques ou catégories...",
      "Cerca prodotti, marchi o categorie...",
      "Buscar productos, marcas o categorías...",
      "Pesquisar produtos, marcas ou categorias...",
      "Zoek producten, merken of categorieën...",
      "Kërko produkte, marka ose kategori...",
      "Caută produse, branduri sau categorii...",
      "Поиск товаров, брендов или категорий..."
    ],

    searchButton: ["Search","Αναζήτηση","Suchen","Rechercher","Cerca","Buscar","Pesquisar","Zoeken","Kërko","Caută","Поиск"],
    exploreWorlds: ["Explore Gear Worlds","Εξερεύνηση Gear Worlds","Gear Worlds entdecken","Explorer les Gear Worlds","Esplora Gear Worlds","Explorar Gear Worlds","Explorar Gear Worlds","Ontdek Gear Worlds","Eksploro Gear Worlds","Explorează Gear Worlds","Открыть Gear Worlds"],

    construction: ["Construction","Κατασκευές","Bau","Construction","Edilizia","Construcción","Construção","Bouw","Ndërtim","Construcții","Строительство"],
    constructionSub: ["Tools · Workwear · PPE","Εργαλεία · Ρουχισμός εργασίας · PPE","Werkzeuge · Arbeitskleidung · PSA","Outils · Vêtements de travail · EPI","Utensili · Abbigliamento da lavoro · DPI","Herramientas · Ropa de trabajo · EPI","Ferramentas · Roupa de trabalho · EPI","Gereedschap · Werkkleding · PBM","Vegla · Veshje pune · PPE","Unelte · Îmbrăcăminte de lucru · EIP","Инструменты · Спецодежда · СИЗ"],

    men: ["Men's","Άνδρες","Herren","Homme","Uomo","Hombre","Homem","Heren","Burra","Bărbați","Мужское"],
    menSub: ["Style · Tech · Everyday","Στυλ · Τεχνολογία · Καθημερινά","Stil · Technik · Alltag","Style · Tech · Quotidien","Stile · Tech · Quotidiano","Estilo · Tecnología · Diario","Estilo · Tecnologia · Dia a dia","Stijl · Tech · Dagelijks","Stil · Teknologji · Përditshmëri","Stil · Tehnologie · Cotidian","Стиль · Технологии · На каждый день"],

    women: ["Women's","Γυναίκες","Damen","Femme","Donna","Mujer","Mulher","Dames","Gra","Femei","Женское"],
    womenSub: ["Fashion · Beauty · Lifestyle","Μόδα · Ομορφιά · Lifestyle","Mode · Beauty · Lifestyle","Mode · Beauté · Lifestyle","Moda · Bellezza · Lifestyle","Moda · Belleza · Estilo de vida","Moda · Beleza · Lifestyle","Mode · Beauty · Lifestyle","Modë · Bukuri · Lifestyle","Modă · Frumusețe · Lifestyle","Мода · Красота · Стиль жизни"],

    kids: ["Kids'","Παιδιά","Kinder","Enfants","Bambini","Niños","Crianças","Kinderen","Fëmijë","Copii","Детское"],
    kidsSub: ["Clothing · Toys · Tech","Ρούχα · Παιχνίδια · Τεχνολογία","Kleidung · Spielzeug · Technik","Vêtements · Jouets · Tech","Abbigliamento · Giochi · Tech","Ropa · Juguetes · Tecnología","Roupa · Brinquedos · Tecnologia","Kleding · Speelgoed · Tech","Veshje · Lodra · Teknologji","Îmbrăcăminte · Jucării · Tehnologie","Одежда · Игрушки · Технологии"],

    home: ["Home","Σπίτι","Zuhause","Maison","Casa","Hogar","Casa","Wonen","Shtëpi","Casă","Дом"],
    homeSub: ["Furniture · Decor · Living","Έπιπλα · Διακόσμηση · Σπίτι","Möbel · Deko · Wohnen","Meubles · Déco · Maison","Mobili · Decor · Casa","Muebles · Decoración · Hogar","Mobiliário · Decoração · Casa","Meubels · Decoratie · Wonen","Mobilje · Dekor · Shtëpi","Mobilier · Decor · Casă","Мебель · Декор · Дом"],

    garden: ["Garden","Κήπος","Garten","Jardin","Giardino","Jardín","Jardim","Tuin","Kopsht","Grădină","Сад"],
    gardenSub: ["Tools · Outdoor · Garden Living","Εργαλεία · Εξωτερικός χώρος · Κήπος","Werkzeuge · Outdoor · Gartenleben","Outils · Extérieur · Jardin","Utensili · Outdoor · Vita in giardino","Herramientas · Exterior · Jardín","Ferramentas · Exterior · Jardim","Gereedschap · Buiten · Tuinleven","Vegla · Ambient i jashtëm · Kopsht","Unelte · Exterior · Grădină","Инструменты · Улица · Сад"],

    sponsoredAria: ["Sponsored business opportunity","Χορηγούμενη επιχειρηματική ευκαιρία","Gesponserte Geschäftsmöglichkeit","Opportunité commerciale sponsorisée","Opportunità commerciale sponsorizzata","Oportunidad de negocio patrocinada","Oportunidade de negócio patrocinada","Gesponsorde zakelijke kans","Mundësi biznesi e sponsorizuar","Oportunitate de afaceri sponsorizată","Спонсируемая бизнес-возможность"],
    sponsoredPartner: ["Sponsored Partner","Χορηγούμενος συνεργάτης","Gesponserter Partner","Partenaire sponsorisé","Partner sponsorizzato","Socio patrocinado","Parceiro patrocinado","Gesponsorde partner","Partner i sponsorizuar","Partener sponsorizat","Спонсируемый партнёр"],
    sellingBusiness: ["Thinking of Selling Your Business?","Σκέφτεστε να πουλήσετε την επιχείρησή σας;","Möchten Sie Ihr Unternehmen verkaufen?","Vous envisagez de vendre votre entreprise ?","Stai pensando di vendere la tua attività?","¿Está pensando en vender su negocio?","Está a pensar vender o seu negócio?","Overweegt u uw bedrijf te verkopen?","Po mendoni të shisni biznesin tuaj?","Vă gândiți să vă vindeți afacerea?","Думаете о продаже бизнеса?"],
    sponsoredDesc: ["Reach global buyers with World Businesses for Sale. Plans from £395.","Προσεγγίστε αγοραστές παγκοσμίως με το World Businesses for Sale. Πακέτα από £395.","Erreichen Sie weltweite Käufer mit World Businesses for Sale. Tarife ab £395.","Touchez des acheteurs du monde entier avec World Businesses for Sale. Offres à partir de £395.","Raggiungi acquirenti in tutto il mondo con World Businesses for Sale. Piani da £395.","Llegue a compradores de todo el mundo con World Businesses for Sale. Planes desde £395.","Alcance compradores em todo o mundo com World Businesses for Sale. Planos desde £395.","Bereik wereldwijde kopers met World Businesses for Sale. Pakketten vanaf £395.","Arrini blerës globalë me World Businesses for Sale. Planet nga £395.","Ajungeți la cumpărători din întreaga lume cu World Businesses for Sale. Planuri de la £395.","Найдите покупателей по всему миру с World Businesses for Sale. Тарифы от £395."],
    sellBusiness: ["Sell Your Business","Πουλήστε την επιχείρησή σας","Unternehmen verkaufen","Vendre votre entreprise","Vendi la tua attività","Venda su negocio","Venda o seu negócio","Verkoop uw bedrijf","Shitni biznesin tuaj","Vindeți-vă afacerea","Продать бизнес"],

    network: ["GEAR WORLD NETWORK","ΔΙΚΤΥΟ GEAR WORLD","GEAR WORLD NETZWERK","RÉSEAU GEAR WORLD","RETE GEAR WORLD","RED GEAR WORLD","REDE GEAR WORLD","GEAR WORLD NETWERK","RRJETI GEAR WORLD","REȚEAUA GEAR WORLD","СЕТЬ GEAR WORLD"],
    centralHub: ["Central Hub","Κεντρικό Hub","Zentraler Hub","Hub central","Hub centrale","Hub central","Hub central","Centrale hub","Hub qendror","Hub central","Центральный хаб"],
    multiple: ["Multiple","Πολλαπλά","Mehrere","Plusieurs","Multipli","Múltiples","Vários","Meerdere","Shumë","Multiple","Несколько"],
    specialistWorlds: ["Specialist Worlds","Εξειδικευμένοι κόσμοι","Spezialisierte Welten","Univers spécialisés","Mondi specializzati","Mundos especializados","Mundos especializados","Gespecialiseerde werelden","Botë të specializuara","Universuri specializate","Специализированные миры"],
    global: ["Global","Παγκόσμια","Global","Mondial","Globale","Global","Global","Wereldwijd","Global","Global","Глобально"],
    shoppingDiscovery: ["Shopping Discovery","Ανακάλυψη αγορών","Shopping entdecken","Découverte shopping","Scoperta shopping","Descubrimiento de compras","Descoberta de compras","Shopping ontdekken","Zbulim blerjesh","Descoperire cumpărături","Поиск товаров"],

    explore: ["EXPLORE","ΕΞΕΡΕΥΝΗΣΤΕ","ENTDECKEN","EXPLORER","ESPLORA","EXPLORAR","EXPLORAR","ONTDEK","EKSPLORO","EXPLOREAZĂ","ИССЛЕДУЙТЕ"],
    shopInterest: ["Shop by Interest","Εξερεύνηση ανά ενδιαφέρον","Nach Interesse shoppen","Acheter par intérêt","Acquista per interesse","Comprar por interés","Comprar por interesse","Shop op interesse","Bli sipas interesit","Cumpără după interes","Покупки по интересам"],
    interestDesc: ["Jump straight into the gear and categories that interest you most.","Μεταβείτε απευθείας στα προϊόντα και τις κατηγορίες που σας ενδιαφέρουν περισσότερο.","Direkt zu den Produkten und Kategorien, die Sie am meisten interessieren.","Accédez directement aux produits et catégories qui vous intéressent le plus.","Vai direttamente ai prodotti e alle categorie che ti interessano di più.","Ve directamente a los productos y categorías que más te interesan.","Aceda diretamente aos produtos e categorias que mais lhe interessam.","Ga direct naar de producten en categorieën die u het meest interesseren.","Kaloni direkt te produktet dhe kategoritë që ju interesojnë më shumë.","Accesați direct produsele și categoriile care vă interesează cel mai mult.","Сразу переходите к интересующим вас товарам и категориям."],

    powerTools: ["Power Tools","Ηλεκτρικά εργαλεία","Elektrowerkzeuge","Outils électriques","Elettroutensili","Herramientas eléctricas","Ferramentas elétricas","Elektrisch gereedschap","Vegla elektrike","Scule electrice","Электроинструменты"],
    safetyBoots: ["Safety Boots","Μπότες ασφαλείας","Sicherheitsschuhe","Chaussures de sécurité","Scarpe antinfortunistiche","Botas de seguridad","Botas de segurança","Veiligheidsschoenen","Këpucë sigurie","Bocanci de protecție","Защитная обувь"],
    mensShoes: ["Men's Shoes","Ανδρικά παπούτσια","Herrenschuhe","Chaussures homme","Scarpe uomo","Zapatos de hombre","Calçado masculino","Herenschoenen","Këpucë për burra","Pantofi pentru bărbați","Мужская обувь"],
    mensWatches: ["Men's Watches","Ανδρικά ρολόγια","Herrenuhren","Montres homme","Orologi uomo","Relojes de hombre","Relógios masculinos","Herenhorloges","Ora për burra","Ceasuri pentru bărbați","Мужские часы"],
    womensBags: ["Women's Bags","Γυναικείες τσάντες","Damentaschen","Sacs femme","Borse donna","Bolsos de mujer","Malas femininas","Damestassen","Çanta për gra","Genți pentru femei","Женские сумки"],
    womensFashion: ["Women's Fashion","Γυναικεία μόδα","Damenmode","Mode femme","Moda donna","Moda femenina","Moda feminina","Damesmode","Modë për gra","Modă pentru femei","Женская мода"],

    whyEyebrow: ["WHY GEAR WORLD HUB","ΓΙΑΤΙ GEAR WORLD HUB","WARUM GEAR WORLD HUB","POURQUOI GEAR WORLD HUB","PERCHÉ GEAR WORLD HUB","POR QUÉ GEAR WORLD HUB","PORQUÊ GEAR WORLD HUB","WAAROM GEAR WORLD HUB","PSE GEAR WORLD HUB","DE CE GEAR WORLD HUB","ПОЧЕМУ GEAR WORLD HUB"],
    whyTitle: ["One hub. Multiple specialist worlds.","Ένα hub. Πολλαπλοί εξειδικευμένοι κόσμοι.","Ein Hub. Mehrere spezialisierte Welten.","Un hub. Plusieurs univers spécialisés.","Un hub. Più mondi specializzati.","Un hub. Varios mundos especializados.","Um hub. Vários mundos especializados.","Eén hub. Meerdere gespecialiseerde werelden.","Një hub. Shumë botë të specializuara.","Un hub. Mai multe universuri specializate.","Один хаб. Несколько специализированных миров."],
    whyDesc: ["Discover, search and move between specialist Gear World sites from one central place.","Ανακαλύψτε, αναζητήστε και μετακινηθείτε μεταξύ εξειδικευμένων Gear World sites από ένα κεντρικό σημείο.","Entdecken und durchsuchen Sie spezialisierte Gear World Sites von einem zentralen Ort aus.","Découvrez, recherchez et naviguez entre les sites Gear World spécialisés depuis un point central.","Scopri, cerca e passa tra i siti Gear World specializzati da un unico punto centrale.","Descubre, busca y navega entre sitios Gear World especializados desde un único lugar.","Descubra, pesquise e navegue entre sites Gear World especializados a partir de um único local.","Ontdek, zoek en navigeer tussen gespecialiseerde Gear World-sites vanuit één centrale plek.","Zbuloni, kërkoni dhe kaloni mes faqeve të specializuara Gear World nga një vend qendror.","Descoperiți, căutați și navigați între site-urile Gear World specializate dintr-un singur loc.","Открывайте, ищите и переходите между специализированными сайтами Gear World из одного центра."],

    oneHub: ["One Central Hub","Ένα κεντρικό Hub","Ein zentraler Hub","Un hub central","Un hub centrale","Un hub central","Um hub central","Eén centrale hub","Një hub qendror","Un hub central","Один центральный хаб"],
    oneHubDesc: ["Access Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel and Sporty Gear World from one starting point.","Πρόσβαση σε Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel και Sporty Gear World από ένα σημείο.","Greifen Sie von einem Ausgangspunkt auf Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel und Sporty Gear World zu.","Accédez à Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel et Sporty Gear World depuis un seul point.","Accedi a Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel e Sporty Gear World da un unico punto.","Acceda a Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel y Sporty Gear World desde un solo punto.","Aceda a Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel e Sporty Gear World a partir de um único ponto.","Open Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel en Sporty Gear World vanaf één startpunt.","Hyni në Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel dhe Sporty Gear World nga një pikë e vetme.","Accesați Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel și Sporty Gear World dintr-un singur punct.","Получайте доступ к Construction, Men's, Women's, Kids', Home, Garden, Technology, Car, Travel и Sporty Gear World из одной точки."],

    searchAcross: ["Search Across Worlds","Αναζήτηση σε όλους τους κόσμους","Welten durchsuchen","Rechercher dans les univers","Cerca tra i mondi","Buscar en los mundos","Pesquisar nos mundos","Zoek in werelden","Kërko në botë","Caută în universuri","Поиск по мирам"],
    searchAcrossDesc: ["Search products across the live Gear World catalogues from one place.","Αναζητήστε προϊόντα σε όλους τους live καταλόγους Gear World από ένα μέρος.","Durchsuchen Sie die Live-Gear-World-Kataloge von einem Ort aus.","Recherchez des produits dans les catalogues Gear World actifs depuis un seul endroit.","Cerca prodotti nei cataloghi Gear World live da un unico posto.","Busca productos en los catálogos Gear World activos desde un solo lugar.","Pesquise produtos nos catálogos Gear World ativos a partir de um só lugar.","Zoek producten in de live Gear World-catalogi vanaf één plek.","Kërkoni produkte në katalogët live Gear World nga një vend.","Căutați produse în cataloagele Gear World live dintr-un singur loc.","Ищите товары во всех активных каталогах Gear World из одного места."],

    growing: ["Growing Network","Αναπτυσσόμενο δίκτυο","Wachsendes Netzwerk","Réseau en croissance","Rete in crescita","Red en crecimiento","Rede em crescimento","Groeiend netwerk","Rrjet në rritje","Rețea în creștere","Растущая сеть"],
    growingDesc: ["Sporty Gear World is now live, expanding the Gear World network to ten specialist shopping worlds.","Το Sporty Gear World είναι πλέον live, επεκτείνοντας το δίκτυο Gear World σε δέκα εξειδικευμένους κόσμους αγορών.","Sporty Gear World ist jetzt live und erweitert das Gear World Netzwerk auf zehn spezialisierte Einkaufswelten.","Sporty Gear World est maintenant en ligne, portant le réseau Gear World à dix univers d’achat spécialisés.","Sporty Gear World è ora live, portando la rete Gear World a dieci mondi dello shopping specializzati.","Sporty Gear World ya está online, ampliando la red Gear World a diez mundos de compras especializados.","Sporty Gear World está agora online, expandindo a rede Gear World para dez mundos de compras especializados.","Sporty Gear World is nu live en breidt het Gear World-netwerk uit naar tien gespecialiseerde winkelwerelden.","Sporty Gear World tani është live, duke zgjeruar rrjetin Gear World në dhjetë botë të specializuara blerjesh.","Sporty Gear World este acum live, extinzând rețeaua Gear World la zece universuri specializate de cumpărături.","Sporty Gear World теперь работает, расширяя сеть Gear World до десяти специализированных торговых миров."],

    idea: ["THE IDEA","Η ΙΔΕΑ","DIE IDEE","L'IDÉE","L'IDEA","LA IDEA","A IDEIA","HET IDEE","IDEJA","IDEEA","ИДЕЯ"],
    aboutTitle: ["A connected shopping ecosystem.","Ένα συνδεδεμένο οικοσύστημα αγορών.","Ein vernetztes Shopping-Ökosystem.","Un écosystème d’achat connecté.","Un ecosistema di acquisti connesso.","Un ecosistema de compras conectado.","Um ecossistema de compras interligado.","Een verbonden winkelecosysteem.","Një ekosistem blerjesh i lidhur.","Un ecosistem de cumpărături interconectat.","Единая экосистема покупок."],
    aboutDesc: ["Gear World Hub brings specialist shopping sites together under one network. Each Gear World can focus on its own audience while the Hub makes the complete network easy to discover.","Το Gear World Hub ενώνει εξειδικευμένα sites αγορών σε ένα δίκτυο. Κάθε Gear World επικεντρώνεται στο δικό του κοινό, ενώ το Hub κάνει ολόκληρο το δίκτυο εύκολο στην ανακάλυψη.","Gear World Hub vereint spezialisierte Shopping-Sites in einem Netzwerk. Jede Gear World konzentriert sich auf ihre eigene Zielgruppe, während der Hub das gesamte Netzwerk leicht auffindbar macht.","Gear World Hub réunit des sites d’achat spécialisés au sein d'un même réseau. Chaque Gear World se concentre sur son propre public tandis que le Hub facilite la découverte de l'ensemble du réseau.","Gear World Hub riunisce siti specializzati per gli acquisti in un'unica rete. Ogni Gear World si concentra sul proprio pubblico mentre l'Hub rende semplice scoprire l'intera rete.","Gear World Hub reúne sitios de compras especializados en una sola red. Cada Gear World se centra en su propia audiencia mientras el Hub facilita descubrir toda la red.","Gear World Hub reúne sites de compras especializados numa só rede. Cada Gear World concentra-se no seu público enquanto o Hub facilita a descoberta de toda a rede.","Gear World Hub brengt gespecialiseerde winkelsites samen in één netwerk. Elke Gear World richt zich op zijn eigen publiek, terwijl de Hub het volledige netwerk makkelijk vindbaar maakt.","Gear World Hub bashkon faqe të specializuara blerjesh në një rrjet. Çdo Gear World fokusohet te audienca e vet ndërsa Hub-i e bën të gjithë rrjetin të lehtë për t'u zbuluar.","Gear World Hub reunește site-uri specializate de cumpărături într-o singură rețea. Fiecare Gear World se concentrează pe propriul public, iar Hub-ul face întreaga rețea ușor de descoperit.","Gear World Hub объединяет специализированные торговые сайты в одну сеть. Каждый Gear World ориентирован на свою аудиторию, а Хаб помогает легко находить всю сеть."],

    footerRights: ["Gear World. All rights reserved.","Gear World. Με επιφύλαξη παντός δικαιώματος.","Gear World. Alle Rechte vorbehalten.","Gear World. Tous droits réservés.","Gear World. Tutti i diritti riservati.","Gear World. Todos los derechos reservados.","Gear World. Todos os direitos reservados.","Gear World. Alle rechten voorbehouden.","Gear World. Të gjitha të drejtat e rezervuara.","Gear World. Toate drepturile rezervate.","Gear World. Все права защищены."],

    checkPrice: ["Check price","Δείτε τιμή","Preis prüfen","Voir le prix","Controlla il prezzo","Ver precio","Ver preço","Bekijk prijs","Shiko çmimin","Vezi prețul","Узнать цену"],
    min2: ["Please enter at least 2 characters.","Εισαγάγετε τουλάχιστον 2 χαρακτήρες.","Bitte geben Sie mindestens 2 Zeichen ein.","Veuillez saisir au moins 2 caractères.","Inserisci almeno 2 caratteri.","Introduce al menos 2 caracteres.","Introduza pelo menos 2 caracteres.","Voer minimaal 2 tekens in.","Vendosni të paktën 2 karaktere.","Introduceți cel puțin 2 caractere.","Введите не менее 2 символов."],

    searchingAll: ["Searching all Gear Worlds for \"{query}\"...","Αναζήτηση σε όλα τα Gear Worlds για \"{query}\"...","Alle Gear Worlds werden nach \"{query}\" durchsucht...","Recherche de \"{query}\" dans tous les Gear Worlds...","Ricerca di \"{query}\" in tutti i Gear Worlds...","Buscando \"{query}\" en todos los Gear Worlds...","A pesquisar \"{query}\" em todos os Gear Worlds...","Alle Gear Worlds doorzoeken naar \"{query}\"...","Po kërkohet \"{query}\" në të gjitha Gear Worlds...","Se caută \"{query}\" în toate Gear Worlds...","Поиск \"{query}\" во всех Gear Worlds..."],

    searchingWorlds: ["Searching all Gear Worlds...","Αναζήτηση σε όλα τα Gear Worlds...","Alle Gear Worlds werden durchsucht...","Recherche dans tous les Gear Worlds...","Ricerca in tutti i Gear Worlds...","Buscando en todos los Gear Worlds...","A pesquisar em todos os Gear Worlds...","Alle Gear Worlds doorzoeken...","Po kërkohet në të gjitha Gear Worlds...","Se caută în toate Gear Worlds...","Поиск во всех Gear Worlds..."],

    searchFailed: ["Search failed","Η αναζήτηση απέτυχε","Suche fehlgeschlagen","Échec de la recherche","Ricerca non riuscita","La búsqueda ha fallado","A pesquisa falhou","Zoeken mislukt","Kërkimi dështoi","Căutarea a eșuat","Ошибка поиска"],
    noProductsFor: ["No products found for \"{query}\".","Δεν βρέθηκαν προϊόντα για \"{query}\".","Keine Produkte für \"{query}\" gefunden.","Aucun produit trouvé pour \"{query}\".","Nessun prodotto trovato per \"{query}\".","No se encontraron productos para \"{query}\".","Não foram encontrados produtos para \"{query}\".","Geen producten gevonden voor \"{query}\".","Nuk u gjetën produkte për \"{query}\".","Nu s-au găsit produse pentru \"{query}\".","Товары по запросу \"{query}\" не найдены."],
    noProductsAcross: ["No products found across the live Gear Worlds.","Δεν βρέθηκαν προϊόντα στα live Gear Worlds.","Keine Produkte in den aktiven Gear Worlds gefunden.","Aucun produit trouvé dans les Gear Worlds actifs.","Nessun prodotto trovato nei Gear Worlds live.","No se encontraron productos en los Gear Worlds activos.","Não foram encontrados produtos nos Gear Worlds ativos.","Geen producten gevonden in de live Gear Worlds.","Nuk u gjetën produkte në Gear Worlds live.","Nu s-au găsit produse în Gear Worlds live.","В активных Gear Worlds товары не найдены."],
    productsFound: ["{count} products found across {worlds} active Gear World sites.","Βρέθηκαν {count} προϊόντα σε {worlds} ενεργά Gear World sites.","{count} Produkte auf {worlds} aktiven Gear World Sites gefunden.","{count} produits trouvés sur {worlds} sites Gear World actifs.","Trovati {count} prodotti su {worlds} siti Gear World attivi.","Se encontraron {count} productos en {worlds} sitios Gear World activos.","Foram encontrados {count} produtos em {worlds} sites Gear World ativos.","{count} producten gevonden op {worlds} actieve Gear World-sites.","U gjetën {count} produkte në {worlds} faqe aktive Gear World.","Au fost găsite {count} produse pe {worlds} site-uri Gear World active.","Найдено {count} товаров на {worlds} активных сайтах Gear World."]
  };

  Object.assign(S, {
    noImage: [
      "No image",
      "Χωρίς εικόνα",
      "Kein Bild",
      "Pas d'image",
      "Nessuna immagine",
      "Sin imagen",
      "Sem imagem",
      "Geen afbeelding",
      "Pa imazh",
      "Fără imagine",
      "Нет изображения"
    ],

    viewProduct: [
      "View Product",
      "Δείτε το προϊόν",
      "Produkt ansehen",
      "Voir le produit",
      "Vedi prodotto",
      "Ver producto",
      "Ver produto",
      "Bekijk product",
      "Shiko produktin",
      "Vezi produsul",
      "Посмотреть товар"
    ],

    showingResults: [
      "Showing {count} results for “{query}”",
      "Εμφανίζονται {count} αποτελέσματα για «{query}»",
      "{count} Ergebnisse für „{query}“",
      "{count} résultats pour « {query} »",
      "{count} risultati per “{query}”",
      "Mostrando {count} resultados para «{query}»",
      "A mostrar {count} resultados para “{query}”",
      "{count} resultaten voor “{query}”",
      "Po shfaqen {count} rezultate për “{query}”",
      "Se afișează {count} rezultate pentru „{query}”",
      "Показано {count} результатов по запросу «{query}»"
    ],

    searchUnavailable: [
      "Product search is temporarily unavailable.",
      "Η αναζήτηση προϊόντων δεν είναι προσωρινά διαθέσιμη.",
      "Die Produktsuche ist vorübergehend nicht verfügbar.",
      "La recherche de produits est temporairement indisponible.",
      "La ricerca dei prodotti è temporaneamente non disponibile.",
      "La búsqueda de productos no está disponible temporalmente.",
      "A pesquisa de produtos está temporariamente indisponível.",
      "Productzoeken is tijdelijk niet beschikbaar.",
      "Kërkimi i produkteve nuk është përkohësisht i disponueshëm.",
      "Căutarea produselor este temporar indisponibilă.",
      "Поиск товаров временно недоступен."
    ],

    loadError: [
      "We couldn't load product results. Please try again.",
      "Δεν ήταν δυνατή η φόρτωση των αποτελεσμάτων. Δοκιμάστε ξανά.",
      "Die Produktergebnisse konnten nicht geladen werden. Bitte versuchen Sie es erneut.",
      "Impossible de charger les résultats. Veuillez réessayer.",
      "Impossibile caricare i risultati. Riprova.",
      "No se pudieron cargar los resultados. Inténtelo de nuevo.",
      "Não foi possível carregar os resultados. Tente novamente.",
      "De resultaten konden niet worden geladen. Probeer opnieuw.",
      "Rezultatet nuk mund të ngarkoheshin. Provoni përsëri.",
      "Rezultatele nu au putut fi încărcate. Încercați din nou.",
      "Не удалось загрузить результаты. Попробуйте ещё раз."
    ],

    resultsAria: [
      "Product search results",
      "Αποτελέσματα αναζήτησης προϊόντων",
      "Produktsuchergebnisse",
      "Résultats de recherche de produits",
      "Risultati della ricerca prodotti",
      "Resultados de búsqueda de productos",
      "Resultados da pesquisa de produtos",
      "Productzoekresultaten",
      "Rezultatet e kërkimit të produkteve",
      "Rezultatele căutării produselor",
      "Результаты поиска товаров"
    ]
  });

  let currentLocale = localStorage.getItem("gwh-language");

  if (!LOCALES.includes(currentLocale)) {
    currentLocale = "en-GB";
  }

  const localeIndex = () => {
    const i = LOCALES.indexOf(currentLocale);
    return i >= 0 ? i : 0;
  };

  function tr(key, vars = {}) {
    const list = S[key];
    let value = Array.isArray(list)
      ? (list[localeIndex()] ?? list[0] ?? key)
      : key;

    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }

    return value;
  }

  function setText(selector, key) {
    const el = document.querySelector(selector);
    if (el) el.textContent = tr(key);
  }

  function applyLanguage(locale) {
    if (!LOCALES.includes(locale)) locale = "en-GB";

    currentLocale = locale;
    localStorage.setItem("gwh-language", locale);

    document.documentElement.lang = locale;

    const select = document.getElementById("gwhLanguage");
    if (select) {
      select.value = locale;
      select.setAttribute("aria-label", tr("languageLabel"));
    }

    document.title = "Gear World Hub";

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        `${tr("heroDesc")} Gear World Hub.`
      );
    }

    setText('.main-nav a[href="#worlds"]', "navWorlds");
    setText('.main-nav a[href="#about"]', "navAbout");

    setText(".hero-copy > .eyebrow", "heroEyebrow");

    const heroTitle = document.querySelector(".hero-copy h1");
    if (heroTitle) {
      heroTitle.innerHTML =
        `${tr("heroTitle1")} <span>${tr("heroTitle2")}</span>`;
    }

    setText(".hero-copy > p", "heroDesc");

    const input = document.getElementById("hubSearchInput");
    if (input) {
      input.placeholder = tr("searchPlaceholder");
      input.setAttribute("aria-label", tr("searchPlaceholder"));
    }

    setText('#hubSearch button[type="submit"]', "searchButton");

    const quick = document.querySelector(".gwh-quick-worlds");
    if (quick) quick.setAttribute("aria-label", tr("exploreWorlds"));

    const worldMap = {
      CGW: ["construction", "constructionSub"],
      MGW: ["men", "menSub"],
      WGW: ["women", "womenSub"],
      KGW: ["kids", "kidsSub"],
      HGW: ["home", "homeSub"],
      GGW: ["garden", "gardenSub"]
    };

    document.querySelectorAll(".gwh-quick-world").forEach(card => {
      const code = card.querySelector(".gwh-quick-code")?.textContent.trim();
      const keys = worldMap[code];

      if (!keys) return;

      const strong = card.querySelector("strong");
      const small = card.querySelector("small");

      if (strong) strong.textContent = tr(keys[0]);
      if (small) small.textContent = tr(keys[1]);
    });

    const sponsored = document.querySelector(".gwh-business-banner");
    if (sponsored) sponsored.setAttribute("aria-label", tr("sponsoredAria"));

    setText(".gwh-sponsored", "sponsoredPartner");
    setText(".gwh-business-copy strong", "sellingBusiness");
    setText(".gwh-business-copy p", "sponsoredDesc");

    const sellLink = document.querySelector(".gwh-business-link");
    if (sellLink) sellLink.textContent = `${tr("sellBusiness")} →`;

    setText(".hero-panel .panel-label", "network");

    const stats = document.querySelectorAll(".hero-panel .stat");

    if (stats[0]) {
      const span = stats[0].querySelector("span");
      if (span) span.textContent = tr("centralHub");
    }

    if (stats[1]) {
      const strong = stats[1].querySelector("strong");
      const span = stats[1].querySelector("span");
      if (strong) strong.textContent = tr("multiple");
      if (span) span.textContent = tr("specialistWorlds");
    }

    if (stats[2]) {
      const strong = stats[2].querySelector("strong");
      const span = stats[2].querySelector("span");
      if (strong) strong.textContent = tr("global");
      if (span) span.textContent = tr("shoppingDiscovery");
    }

    const interests = document.querySelector("#worlds");

    if (interests) {
      const heading = interests.querySelector(".section-heading");

      if (heading) {
        const eyebrow = heading.querySelector(".eyebrow");
        const h2 = heading.querySelector("h2");
        const p = heading.querySelector("p");

        if (eyebrow) eyebrow.textContent = tr("explore");
        if (h2) h2.textContent = tr("shopInterest");
        if (p) p.textContent = tr("interestDesc");
      }

      const keys = [
        "powerTools",
        "safetyBoots",
        "mensShoes",
        "mensWatches",
        "womensBags",
        "womensFashion"
      ];

      interests.querySelectorAll(".interest-card").forEach((card, index) => {
        const strong = card.querySelector("strong");
        if (strong && keys[index]) strong.textContent = tr(keys[index]);
      });
    }

    const why = document.querySelector(".why-hub-section");

    if (why) {
      const heading = why.querySelector(".section-heading");

      if (heading) {
        const eyebrow = heading.querySelector(".eyebrow");
        const h2 = heading.querySelector("h2");
        const p = heading.querySelector("p");

        if (eyebrow) eyebrow.textContent = tr("whyEyebrow");
        if (h2) h2.textContent = tr("whyTitle");
        if (p) p.textContent = tr("whyDesc");
      }

      const cards = why.querySelectorAll(".why-hub-card");

      if (cards[0]) {
        const h3 = cards[0].querySelector("h3");
        const p = cards[0].querySelector("p");
        if (h3) h3.textContent = tr("oneHub");
        if (p) p.textContent = tr("oneHubDesc");
      }

      if (cards[1]) {
        const h3 = cards[1].querySelector("h3");
        const p = cards[1].querySelector("p");
        if (h3) h3.textContent = tr("searchAcross");
        if (p) p.textContent = tr("searchAcrossDesc");
      }

      if (cards[2]) {
        const h3 = cards[2].querySelector("h3");
        const p = cards[2].querySelector("p");
        if (h3) h3.textContent = tr("growing");
        if (p) p.textContent = tr("growingDesc");
      }
    }

    const about = document.querySelector(".about-section");

    if (about) {
      const eyebrow = about.querySelector(".eyebrow");
      const h2 = about.querySelector("h2");
      const p = about.querySelector(".about-box > p");

      if (eyebrow) eyebrow.textContent = tr("idea");
      if (h2) h2.textContent = tr("aboutTitle");
      if (p) p.textContent = tr("aboutDesc");
    }

    const footerText = document.querySelector(".footer-inner > span");

    if (footerText) {
      const year = document.getElementById("year");
      const currentYear = year?.textContent || new Date().getFullYear();

      footerText.innerHTML =
        `&copy; <span id="year">${currentYear}</span> ${tr("footerRights")}`;
    }

    window.dispatchEvent(
      new CustomEvent("gwh-language-change", {
        detail: { locale }
      })
    );
  }

  window.GWH_t = tr;
  window.GWH_getLocale = () => currentLocale;
  window.GWH_applyLanguage = applyLanguage;

  const selector = document.getElementById("gwhLanguage");

  if (selector) {
    selector.addEventListener("change", event => {
      applyLanguage(event.target.value);
    });
  }

  applyLanguage(currentLocale);
})();

/* GWH-COMPACT-V2-TRANSLATIONS-START */

(() => {
  "use strict";

  const V2 = {
    "en-GB": {
      choose: "CHOOSE A WORLD",
      searchAll: "SEARCH ALL WORLDS",
      shop: "Shop →",

      titles: [
        "Tools & Workwear",
        "Men",
        "Women",
        "Kids & Teens",
        "Home",
        "Garden",
        "Technology",
        "Car",
        "Travel",
        "Sport",
        "Motorbike & Scooter"
      ],

      descriptions: [
        "Tools, workwear and site equipment.",
        "Clothing, footwear and accessories.",
        "Fashion, footwear and accessories.",
        "Clothing, footwear and everyday essentials.",
        "Furniture, lighting and home accessories.",
        "Garden tools and outdoor essentials.",
        "Laptops, phones, audio and gaming tech.",
        "Garage tools, parts, car care and dash cams.",
        "Luggage, travel bags, accessories and camping gear.",
        "Fitness, running, cycling, team sports and nutrition.",
        "Helmets, riding gear, parts, scooters and e-motorbikes."
      ],

      howLabel: "HOW IT WORKS",
      howTitle:
        "Choose a world. Browse products. Buy directly from the retailer.",

      steps: [
        "Choose a world",
        "Browse products",
        "Buy from the retailer"
      ],

      disclosure:
        "Purchases are completed directly on the retailer's website. Gear World may earn a commission from qualifying affiliate purchases at no extra cost to you."
    },

    "el-GR": {
      choose: "ΕΠΙΛΕΞΤΕ ΚΟΣΜΟ",
      searchAll: "ΑΝΑΖΗΤΗΣΗ ΣΕ ΟΛΟΥΣ ΤΟΥΣ ΚΟΣΜΟΥΣ",
      shop: "Εξερεύνηση →",

      titles: [
        "Εργαλεία & Ρούχα Εργασίας",
        "Άνδρες",
        "Γυναίκες",
        "Παιδιά & Έφηβοι",
        "Σπίτι",
        "Κήπος",
        "Τεχνολογία",
        "Αυτοκίνητο",
        "Ταξίδι",
        "Αθλητισμός",
        "Μηχανή & πατίνι"
      ],

      descriptions: [
        "Εργαλεία, ρούχα εργασίας και εξοπλισμός εργοταξίου.",
        "Ρούχα, παπούτσια και αξεσουάρ.",
        "Μόδα, παπούτσια και αξεσουάρ.",
        "Ρούχα, παπούτσια και καθημερινά είδη.",
        "Έπιπλα, φωτισμός και αξεσουάρ σπιτιού.",
        "Εργαλεία κήπου και είδη εξωτερικού χώρου.",
        "Laptop, κινητά, ήχος και gaming.",
        "Εργαλεία συνεργείου, ανταλλακτικά, περιποίηση και κάμερες.",
        "Βαλίτσες, τσάντες ταξιδιού, αξεσουάρ και εξοπλισμός camping.",
        "Γυμναστική, τρέξιμο, ποδήλατο, ομαδικά αθλήματα και διατροφή.",
        "Κράνη, ρούχα αναβάτη, ανταλλακτικά, πατίνια και ηλεκτρικές μηχανές."
      ],

      howLabel: "ΠΩΣ ΛΕΙΤΟΥΡΓΕΙ",
      howTitle:
        "Επιλέξτε έναν κόσμο. Περιηγηθείτε στα προϊόντα. Αγοράστε απευθείας από τα συνεργαζόμενα καταστήματα.",

      steps: [
        "Επιλέξτε έναν κόσμο",
        "Περιηγηθείτε στα προϊόντα",
        "Αγοράστε από τα συνεργαζόμενα καταστήματα"
      ],

      disclosure:
        "Οι αγορές ολοκληρώνονται απευθείας στις ιστοσελίδες των συνεργαζόμενων καταστημάτων. Το Gear World μπορεί να λαμβάνει προμήθεια από επιλέξιμες αγορές μέσω affiliate links, χωρίς επιπλέον κόστος για εσάς."
    },

    "de-DE": {
      choose: "WÄHLEN SIE EINE WELT",
      searchAll: "ALLE WELTEN DURCHSUCHEN",
      shop: "Einkaufen →",

      titles: [
        "Werkzeug & Arbeitskleidung",
        "Herren",
        "Damen",
        "Kinder & Teens",
        "Wohnen",
        "Garten",
        "Technik",
        "Auto",
        "Reisen",
        "Sport",
        "Motorrad & Roller"
      ],

      descriptions: [
        "Werkzeuge, Arbeitskleidung und Baustellenausrüstung.",
        "Kleidung, Schuhe und Accessoires.",
        "Mode, Schuhe und Accessoires.",
        "Kleidung, Schuhe und Alltagsartikel.",
        "Möbel, Beleuchtung und Wohnaccessoires.",
        "Gartenwerkzeuge und Outdoor-Zubehör.",
        "Laptops, Handys, Audio und Gaming.",
        "Werkstattwerkzeug, Teile, Autopflege und Dashcams.",
        "Koffer, Reisetaschen, Zubehör und Campingausrüstung.",
        "Fitness, Laufen, Radsport, Teamsport und Sporternährung.",
        "Helme, Motorradbekleidung, Teile, Roller und E-Motorräder."
      ],

      howLabel: "SO FUNKTIONIERT ES",
      howTitle:
        "Welt wählen. Produkte entdecken. Direkt beim Händler kaufen.",

      steps: [
        "Welt wählen",
        "Produkte entdecken",
        "Beim Händler kaufen"
      ],

      disclosure:
        "Der Kauf wird direkt auf der Website des Händlers abgeschlossen. Gear World kann für qualifizierte Käufe über Affiliate-Links eine Provision erhalten, ohne zusätzliche Kosten für Sie."
    },

    "fr-FR": {
      choose: "CHOISISSEZ UN UNIVERS",
      searchAll: "RECHERCHER DANS TOUS LES UNIVERS",
      shop: "Découvrir →",

      titles: [
        "Outils & vêtements de travail",
        "Hommes",
        "Femmes",
        "Enfants & ados",
        "Maison",
        "Jardin",
        "Technologie",
        "Auto",
        "Voyage",
        "Sport",
        "Moto & trottinette"
      ],

      descriptions: [
        "Outils, vêtements de travail et équipement de chantier.",
        "Vêtements, chaussures et accessoires.",
        "Mode, chaussures et accessoires.",
        "Vêtements, chaussures et essentiels du quotidien.",
        "Meubles, éclairage et accessoires pour la maison.",
        "Outils de jardin et essentiels pour l'extérieur.",
        "Ordinateurs portables, téléphones, audio et gaming.",
        "Outils de garage, pièces, entretien et dashcams.",
        "Valises, sacs de voyage, accessoires et matériel de camping.",
        "Fitness, course à pied, vélo, sports collectifs et nutrition.",
        "Casques, équipement moto, pièces, trottinettes et motos électriques."
      ],

      howLabel: "COMMENT ÇA MARCHE",
      howTitle:
        "Choisissez un univers. Parcourez les produits. Achetez directement chez le marchand.",

      steps: [
        "Choisissez un univers",
        "Parcourez les produits",
        "Achetez chez le marchand"
      ],

      disclosure:
        "Les achats sont finalisés directement sur le site du retailer. Gear World peut recevoir une commission sur les achats éligibles effectués via des liens affiliés, sans coût supplémentaire pour vous."
    },

    "it-IT": {
      choose: "SCEGLI UN MONDO",
      searchAll: "CERCA IN TUTTI I MONDI",
      shop: "Esplora →",

      titles: [
        "Utensili & abbigliamento da lavoro",
        "Uomo",
        "Donna",
        "Bambini & ragazzi",
        "Casa",
        "Giardino",
        "Tecnologia",
        "Auto",
        "Viaggio",
        "Sport",
        "Moto & monopattino"
      ],

      descriptions: [
        "Utensili, abbigliamento da lavoro e attrezzature da cantiere.",
        "Abbigliamento, calzature e accessori.",
        "Moda, calzature e accessori.",
        "Abbigliamento, calzature ed essenziali quotidiani.",
        "Mobili, illuminazione e accessori per la casa.",
        "Attrezzi da giardino ed essenziali per l'esterno.",
        "Laptop, smartphone, audio e gaming.",
        "Attrezzi da officina, ricambi, cura auto e dash cam.",
        "Valigie, borse da viaggio, accessori e attrezzatura da campeggio.",
        "Fitness, corsa, ciclismo, sport di squadra e nutrizione.",
        "Caschi, abbigliamento moto, ricambi, monopattini e moto elettriche."
      ],

      howLabel: "COME FUNZIONA",
      howTitle:
        "Scegli un mondo. Sfoglia i prodotti. Acquista direttamente dal rivenditore.",

      steps: [
        "Scegli un mondo",
        "Sfoglia i prodotti",
        "Acquista dal rivenditore"
      ],

      disclosure:
        "Gli acquisti vengono completati direttamente sul sito del retailer. Gear World può ricevere una commissione dagli acquisti idonei effettuati tramite link affiliati, senza costi aggiuntivi per te."
    },

    "es-ES": {
      choose: "ELIGE UN MUNDO",
      searchAll: "BUSCAR EN TODOS LOS MUNDOS",
      shop: "Explorar →",

      titles: [
        "Herramientas y ropa de trabajo",
        "Hombre",
        "Mujer",
        "Niños y adolescentes",
        "Hogar",
        "Jardín",
        "Tecnología",
        "Coche",
        "Viaje",
        "Deporte",
        "Moto y patinete"
      ],

      descriptions: [
        "Herramientas, ropa de trabajo y equipo de obra.",
        "Ropa, calzado y accesorios.",
        "Moda, calzado y accesorios.",
        "Ropa, calzado y artículos esenciales.",
        "Muebles, iluminación y accesorios para el hogar.",
        "Herramientas de jardín y esenciales de exterior.",
        "Portátiles, móviles, audio y gaming.",
        "Herramientas de taller, recambios, cuidado y cámaras.",
        "Maletas, bolsas de viaje, accesorios y equipo de camping.",
        "Fitness, running, ciclismo, deportes de equipo y nutrición.",
        "Cascos, equipación de moto, recambios, patinetes y motos eléctricas."
      ],

      howLabel: "CÓMO FUNCIONA",
      howTitle:
        "Elige un mundo. Explora productos. Compra directamente en la tienda.",

      steps: [
        "Elige un mundo",
        "Explora productos",
        "Compra en la tienda"
      ],

      disclosure:
        "Las compras se completan directamente en la web del retailer. Gear World puede recibir una comisión por compras válidas realizadas mediante enlaces de afiliado, sin coste adicional para ti."
    },

    "pt-PT": {
      choose: "ESCOLHA UM MUNDO",
      searchAll: "PESQUISAR EM TODOS OS MUNDOS",
      shop: "Explorar →",

      titles: [
        "Ferramentas e roupa de trabalho",
        "Homem",
        "Mulher",
        "Crianças e adolescentes",
        "Casa",
        "Jardim",
        "Tecnologia",
        "Automóvel",
        "Viagem",
        "Desporto",
        "Mota e trotinete"
      ],

      descriptions: [
        "Ferramentas, roupa de trabalho e equipamento de obra.",
        "Roupa, calçado e acessórios.",
        "Moda, calçado e acessórios.",
        "Roupa, calçado e essenciais do dia a dia.",
        "Mobiliário, iluminação e acessórios para casa.",
        "Ferramentas de jardim e essenciais para exterior.",
        "Portáteis, telemóveis, áudio e gaming.",
        "Ferramentas de oficina, peças, cuidado e câmaras.",
        "Malas, sacos de viagem, acessórios e equipamento de campismo.",
        "Fitness, corrida, ciclismo, desportos coletivos e nutrição.",
        "Capacetes, equipamento de mota, peças, trotinetes e motas elétricas."
      ],

      howLabel: "COMO FUNCIONA",
      howTitle:
        "Escolha um mundo. Explore produtos. Compre diretamente na loja.",

      steps: [
        "Escolha um mundo",
        "Explore produtos",
        "Compre na loja"
      ],

      disclosure:
        "As compras são concluídas diretamente no site do retailer. A Gear World pode receber uma comissão por compras elegíveis feitas através de links de afiliado, sem custo adicional para si."
    },

    "nl-NL": {
      choose: "KIES EEN WERELD",
      searchAll: "ZOEK IN ALLE WERELDEN",
      shop: "Bekijk →",

      titles: [
        "Gereedschap & werkkleding",
        "Heren",
        "Dames",
        "Kinderen & tieners",
        "Wonen",
        "Tuin",
        "Technologie",
        "Auto",
        "Reizen",
        "Sport",
        "Motor & step"
      ],

      descriptions: [
        "Gereedschap, werkkleding en bouwplaatsuitrusting.",
        "Kleding, schoenen en accessoires.",
        "Mode, schoenen en accessoires.",
        "Kleding, schoenen en dagelijkse benodigdheden.",
        "Meubels, verlichting en woonaccessoires.",
        "Tuingereedschap en outdoorbenodigdheden.",
        "Laptops, telefoons, audio en gaming.",
        "Garagegereedschap, onderdelen, autoverzorging en dashcams.",
        "Koffers, reistassen, accessoires en kampeeruitrusting.",
        "Fitness, hardlopen, fietsen, teamsporten en sportvoeding.",
        "Helmen, motorkleding, onderdelen, steps en elektrische motoren."
      ],

      howLabel: "HOE HET WERKT",
      howTitle:
        "Kies een wereld. Bekijk producten. Koop rechtstreeks bij de winkel.",

      steps: [
        "Kies een wereld",
        "Bekijk producten",
        "Koop bij de winkel"
      ],

      disclosure:
        "Aankopen worden rechtstreeks op de website van de retailer afgerond. Gear World kan commissie ontvangen op in aanmerking komende aankopen via affiliatelinks, zonder extra kosten voor u."
    },

    "sq-AL": {
      choose: "ZGJIDHNI NJË BOTË",
      searchAll: "KËRKONI NË TË GJITHA BOTËT",
      shop: "Shfleto →",

      titles: [
        "Vegla & veshje pune",
        "Burra",
        "Gra",
        "Fëmijë & adoleshentë",
        "Shtëpi",
        "Kopsht",
        "Teknologji",
        "Makina",
        "Udhëtim",
        "Sport",
        "Motor & patinë"
      ],

      descriptions: [
        "Vegla, veshje pune dhe pajisje kantieri.",
        "Veshje, këpucë dhe aksesorë.",
        "Modë, këpucë dhe aksesorë.",
        "Veshje, këpucë dhe artikuj të përditshëm.",
        "Mobilje, ndriçim dhe aksesorë shtëpie.",
        "Vegla kopshti dhe pajisje për ambiente të jashtme.",
        "Laptopë, telefona, audio dhe gaming.",
        "Vegla garazhi, pjesë, kujdes makine dhe kamera.",
        "Valixhe, çanta udhëtimi, aksesorë dhe pajisje kampingu.",
        "Fitnes, vrapim, çiklizëm, sporte ekipore dhe ushqyerje sportive.",
        "Helmeta, veshje motoristi, pjesë, patina dhe motoçikleta elektrike."
      ],

      howLabel: "SI FUNKSIONON",
      howTitle:
        "Zgjidhni një botë. Shfletoni produktet. Blini drejtpërdrejt te shitësi.",

      steps: [
        "Zgjidhni një botë",
        "Shfletoni produktet",
        "Blini te shitësi"
      ],

      disclosure:
        "Blerjet përfundojnë drejtpërdrejt në faqen e retailer-it. Gear World mund të marrë komision nga blerjet e kualifikuara përmes lidhjeve affiliate, pa kosto shtesë për ju."
    },

    "ro-RO": {
      choose: "ALEGEȚI O LUME",
      searchAll: "CĂUTAȚI ÎN TOATE LUMILE",
      shop: "Explorează →",

      titles: [
        "Unelte & îmbrăcăminte de lucru",
        "Bărbați",
        "Femei",
        "Copii & adolescenți",
        "Casă",
        "Grădină",
        "Tehnologie",
        "Auto",
        "Călătorii",
        "Sport",
        "Moto & trotinetă"
      ],

      descriptions: [
        "Unelte, îmbrăcăminte de lucru și echipamente de șantier.",
        "Îmbrăcăminte, încălțăminte și accesorii.",
        "Modă, încălțăminte și accesorii.",
        "Îmbrăcăminte, încălțăminte și articole esențiale.",
        "Mobilier, iluminat și accesorii pentru casă.",
        "Unelte de grădină și articole pentru exterior.",
        "Laptopuri, telefoane, audio și gaming.",
        "Scule de garaj, piese, îngrijire auto și camere.",
        "Valize, genți de călătorie, accesorii și echipament de camping.",
        "Fitness, alergare, ciclism, sporturi de echipă și nutriție.",
        "Căști, echipament moto, piese, trotinete și motociclete electrice."
      ],

      howLabel: "CUM FUNCȚIONEAZĂ",
      howTitle:
        "Alegeți o lume. Explorați produsele. Cumpărați direct de la comerciant.",

      steps: [
        "Alegeți o lume",
        "Explorați produsele",
        "Cumpărați de la comerciant"
      ],

      disclosure:
        "Achizițiile sunt finalizate direct pe site-ul retailerului. Gear World poate primi un comision pentru achizițiile eligibile realizate prin linkuri afiliate, fără costuri suplimentare pentru dvs."
    },

    "ru-RU": {
      choose: "ВЫБЕРИТЕ РАЗДЕЛ",
      searchAll: "ПОИСК ПО ВСЕМ РАЗДЕЛАМ",
      shop: "Смотреть →",

      titles: [
        "Инструменты и спецодежда",
        "Для мужчин",
        "Для женщин",
        "Детям и подросткам",
        "Дом",
        "Сад",
        "Технологии",
        "Авто",
        "Путешествия",
        "Спорт",
        "Мото и самокаты"
      ],

      descriptions: [
        "Инструменты, рабочая одежда и оборудование для стройки.",
        "Одежда, обувь и аксессуары.",
        "Мода, обувь и аксессуары.",
        "Одежда, обувь и товары на каждый день.",
        "Мебель, освещение и аксессуары для дома.",
        "Садовые инструменты и товары для улицы.",
        "Ноутбуки, телефоны, аудио и игры.",
        "Гаражный инструмент, запчасти, уход и видеорегистраторы.",
        "Чемоданы, дорожные сумки, аксессуары и снаряжение для кемпинга.",
        "Фитнес, бег, велоспорт, командные виды спорта и спортивное питание.",
        "Шлемы, мотоэкипировка, запчасти, самокаты и электромотоциклы."
      ],

      howLabel: "КАК ЭТО РАБОТАЕТ",
      howTitle:
        "Выберите раздел. Просмотрите товары. Купите напрямую у продавца.",

      steps: [
        "Выберите раздел",
        "Просмотрите товары",
        "Купите у продавца"
      ],

      disclosure:
        "Покупка оформляется непосредственно на сайте retailer. Gear World может получать комиссию за соответствующие покупки по партнерским ссылкам без дополнительных расходов для вас."
    }
  };


  function getLocale() {
    const select = document.getElementById("gwhLanguage");

    if (
      select &&
      Object.prototype.hasOwnProperty.call(V2, select.value)
    ) {
      return select.value;
    }

    return "en-GB";
  }


  function applyCompactV2Translations() {
    const body = document.body;

    if (
      !body ||
      body.dataset.gwhCompactV2 !== "true"
    ) {
      return;
    }

    const data = V2[getLocale()] || V2["en-GB"];

    const choose =
      document.querySelector(".gwh-choose-world-label");

    if (choose) {
      choose.textContent = data.choose;
    }


    const cards =
      document.querySelectorAll(".gwh-image-world");

    cards.forEach((card, index) => {
      const title =
        card.querySelector(".gwh-image-world-title");

      const description =
        card.querySelector(".gwh-image-world-description");

      const cta =
        card.querySelector(".gwh-image-world-cta");

      if (title && data.titles[index]) {
        title.textContent = data.titles[index];
      }

      if (description && data.descriptions[index]) {
        description.textContent =
          data.descriptions[index];
      }

      if (cta) {
        cta.textContent = data.shop;
      }

      if (data.titles[index]) {
        card.setAttribute(
          "aria-label",
          data.titles[index]
        );
      }
    });


    const searchAll =
      document.querySelector(
        ".gwh-secondary-search-label"
      );

    if (searchAll) {
      searchAll.textContent = data.searchAll;
    }


    const howLabel =
      document.querySelector(
        ".gwh-compact-how .eyebrow"
      );

    if (howLabel) {
      howLabel.textContent = data.howLabel;
    }


    const howTitle =
      document.querySelector(
        ".gwh-compact-how-heading h2"
      );

    if (howTitle) {
      howTitle.textContent = data.howTitle;
    }


    const steps =
      document.querySelectorAll(
        ".gwh-compact-how-grid > div > span"
      );

    steps.forEach((step, index) => {
      if (data.steps[index]) {
        step.textContent = data.steps[index];
      }
    });


    const disclosure =
      document.querySelector(
        ".gwh-compact-disclosure"
      );

    if (disclosure) {
      disclosure.textContent =
        data.disclosure;
    }
  }


  window.addEventListener(
    "gwh-language-change",
    () => {
      setTimeout(
        applyCompactV2Translations,
        0
      );
    }
  );


  const selector =
    document.getElementById("gwhLanguage");

  if (selector) {
    selector.addEventListener(
      "change",
      () => {
        setTimeout(
          applyCompactV2Translations,
          0
        );
      }
    );
  }


  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      applyCompactV2Translations,
      { once: true }
    );
  }
  else {
    applyCompactV2Translations();
  }

})();

/* GWH-COMPACT-V2-TRANSLATIONS-END */
