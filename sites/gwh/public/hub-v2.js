/* Gear World Hub V2 ("Συνδυασμός", 27/10/2026): campaigns with arrows, photo button, gift finder, deals and the
   search dock of the phone. It only adds to the page: search, voice, camera, sign-up and consent keep their own
   scripts. Nothing moves, blinks or turns by itself: slides change only with the arrows (lessons L35: no red or
   green). Texts of the 11 languages are here; the older texts stay in translations.js. */
(() => {
  "use strict";

  const LOCALES = ["en-GB", "el-GR", "de-DE", "fr-FR", "it-IT", "es-ES", "pt-PT", "nl-NL", "sq-AL", "ro-RO", "ru-RU"];

  // One line per text, in the order of LOCALES. {name} is filled in by the page.
  const T = {
    lead: ["Type it, say it or take a photo. We search all 10 Gear Worlds at once.", "Γράψτε το, πείτε το ή φωτογραφίστε το. Ψάχνουμε σε όλα τα 10 Gear Worlds μαζί.", "Tippen, sprechen oder fotografieren. Wir durchsuchen alle 10 Gear Worlds auf einmal.", "Tapez-le, dites-le ou prenez-le en photo. Nous cherchons dans les 10 Gear Worlds à la fois.", "Scrivilo, dillo o fotografalo. Cerchiamo in tutti i 10 Gear Worlds insieme.", "Escríbelo, dilo o hazle una foto. Buscamos en los 10 Gear Worlds a la vez.", "Escreva, diga ou tire uma foto. Pesquisamos nos 10 Gear Worlds ao mesmo tempo.", "Typ het, zeg het of maak een foto. We zoeken in alle 10 Gear Worlds tegelijk.", "Shkruaje, thuaje ose bëji një foto. Kërkojmë në të 10 Gear Worlds njëherësh.", "Scrieți, spuneți sau faceți o fotografie. Căutăm în toate cele 10 Gear Worlds deodată.", "Напишите, скажите или сфотографируйте. Мы ищем сразу во всех 10 Gear Worlds."],
    photoBtn: ["Search with a photo", "Αναζήτηση με φωτογραφία", "Mit Foto suchen", "Rechercher par photo", "Cerca con una foto", "Buscar con una foto", "Pesquisar com uma foto", "Zoeken met een foto", "Kërko me foto", "Caută cu o fotografie", "Поиск по фото"],
    dockPhoto: ["Photo", "Φωτογραφία", "Foto", "Photo", "Foto", "Foto", "Foto", "Foto", "Foto", "Foto", "Фото"],
    popular: ["Popular:", "Δημοφιλή:", "Beliebt:", "Populaire :", "Più cercati:", "Populares:", "Populares:", "Populair:", "Të kërkuarat:", "Populare:", "Популярное:"],
    navDeals: ["Deals", "Προσφορές", "Angebote", "Offres", "Offerte", "Ofertas", "Ofertas", "Aanbiedingen", "Oferta", "Oferte", "Скидки"],
    navGifts: ["Gift finder", "Ιδέες δώρων", "Geschenkefinder", "Idées cadeaux", "Trova regali", "Buscador de regalos", "Encontrar presentes", "Cadeauzoeker", "Gjej dhuratë", "Găsește un cadou", "Подбор подарков"],
    campaigns: ["Campaigns", "Καμπάνιες", "Aktionen", "Campagnes", "Campagne", "Campañas", "Campanhas", "Acties", "Fushata", "Campanii", "Акции"],
    prev: ["Previous", "Προηγούμενο", "Zurück", "Précédent", "Precedente", "Anterior", "Anterior", "Vorige", "E mëparshmja", "Anterior", "Назад"],
    next: ["Next", "Επόμενο", "Weiter", "Suivant", "Successivo", "Siguiente", "Seguinte", "Volgende", "Tjetra", "Următor", "Далее"],
    slideAria: ["Campaign {n} of {total}", "Καμπάνια {n} από {total}", "Aktion {n} von {total}", "Campagne {n} sur {total}", "Campagna {n} di {total}", "Campaña {n} de {total}", "Campanha {n} de {total}", "Actie {n} van {total}", "Fushata {n} nga {total}", "Campania {n} din {total}", "Акция {n} из {total}"],
    bfEyebrow: ["27–30 NOVEMBER", "27–30 ΝΟΕΜΒΡΙΟΥ", "27.–30. NOVEMBER", "27–30 NOVEMBRE", "27–30 NOVEMBRE", "27–30 DE NOVIEMBRE", "27–30 DE NOVEMBRO", "27 T/M 30 NOVEMBER", "27–30 NËNTOR", "27–30 NOIEMBRIE", "27–30 НОЯБРЯ"],
    bfTitle: ["Black Friday across 10 Gear Worlds", "Black Friday σε 10 Gear Worlds", "Black Friday in 10 Gear Worlds", "Black Friday dans 10 Gear Worlds", "Black Friday in 10 Gear Worlds", "Black Friday en 10 Gear Worlds", "Black Friday em 10 Gear Worlds", "Black Friday in 10 Gear Worlds", "Black Friday në 10 Gear Worlds", "Black Friday în 10 Gear Worlds", "Чёрная пятница в 10 Gear Worlds"],
    bfText: ["The retailers' offers in one place, each with its end date.", "Οι προσφορές των καταστημάτων σε ένα μέρος, η καθεμία με την ημερομηνία λήξης της.", "Die Angebote der Händler an einem Ort, jedes mit Enddatum.", "Les offres des marchands au même endroit, chacune avec sa date de fin.", "Le offerte dei negozi in un unico posto, ognuna con la sua data di fine.", "Las ofertas de las tiendas en un solo lugar, cada una con su fecha de fin.", "As ofertas das lojas num só lugar, cada uma com a sua data de fim.", "De aanbiedingen van de winkels op één plek, elk met een einddatum.", "Ofertat e dyqaneve në një vend, secila me datën e mbarimit.", "Ofertele magazinelor într-un singur loc, fiecare cu data de încheiere.", "Предложения магазинов в одном месте, у каждого указан срок."],
    bfCta: ["See the deals", "Δείτε τις προσφορές", "Angebote ansehen", "Voir les offres", "Vedi le offerte", "Ver las ofertas", "Ver as ofertas", "Bekijk de aanbiedingen", "Shiko ofertat", "Vezi ofertele", "Смотреть предложения"],
    soonEyebrow: ["BLACK FRIDAY · 27 NOVEMBER", "BLACK FRIDAY · 27 ΝΟΕΜΒΡΙΟΥ", "BLACK FRIDAY · 27. NOVEMBER", "BLACK FRIDAY · 27 NOVEMBRE", "BLACK FRIDAY · 27 NOVEMBRE", "BLACK FRIDAY · 27 DE NOVIEMBRE", "BLACK FRIDAY · 27 DE NOVEMBRO", "BLACK FRIDAY · VANAF 27 NOVEMBER", "BLACK FRIDAY · 27 NËNTOR", "BLACK FRIDAY · 27 NOIEMBRIE", "ЧЁРНАЯ ПЯТНИЦА · 27 НОЯБРЯ"],
    soonTitle: ["Black Friday is coming", "Έρχεται η Black Friday", "Black Friday kommt bald", "Le Black Friday arrive", "Arriva il Black Friday", "Llega el Black Friday", "A Black Friday está a chegar", "Black Friday komt eraan", "Po vjen Black Friday", "Vine Black Friday", "Скоро Чёрная пятница"],
    soonText: ["Sign up and hear about the offers first.", "Εγγραφείτε και μάθετε πρώτοι τις προσφορές.", "Melden Sie sich an und erfahren Sie die Angebote zuerst.", "Inscrivez-vous et découvrez les offres en premier.", "Iscriviti e scopri per primo le offerte.", "Suscríbete y entérate de las ofertas antes que nadie.", "Inscreva-se e conheça as ofertas primeiro.", "Schrijf u in en hoor als eerste over de aanbiedingen.", "Regjistrohu dhe mëso i pari për ofertat.", "Abonați-vă și aflați primii despre oferte.", "Подпишитесь и узнавайте о предложениях первыми."],
    soonCta: ["Tell me first", "Θέλω να μάθω πρώτος", "Zuerst informieren", "Me prévenir", "Avvisami", "Avísame", "Avise-me", "Houd me op de hoogte", "Më njofto", "Anunță-mă", "Сообщить мне"],
    xmasEyebrow: ["CHRISTMAS", "ΧΡΙΣΤΟΥΓΕΝΝΑ", "WEIHNACHTEN", "NOËL", "NATALE", "NAVIDAD", "NATAL", "KERST", "KRISHTLINDJE", "CRĂCIUN", "РОЖДЕСТВО"],
    xmasTitle: ["Gifts for everyone, from 10 Gear Worlds", "Δώρα για όλους, από 10 Gear Worlds", "Geschenke für alle, aus 10 Gear Worlds", "Des cadeaux pour tous, dans 10 Gear Worlds", "Regali per tutti, da 10 Gear Worlds", "Regalos para todos, de 10 Gear Worlds", "Presentes para todos, de 10 Gear Worlds", "Cadeaus voor iedereen, uit 10 Gear Worlds", "Dhurata për të gjithë, nga 10 Gear Worlds", "Cadouri pentru toți, din 10 Gear Worlds", "Подарки для всех из 10 Gear Worlds"],
    xmasText: ["Ideas by person and budget.", "Ιδέες ανά άτομο και budget.", "Ideen nach Person und Budget.", "Des idées par personne et par budget.", "Idee per persona e budget.", "Ideas por persona y presupuesto.", "Ideias por pessoa e orçamento.", "Ideeën per persoon en budget.", "Ide sipas personit dhe buxhetit.", "Idei după persoană și buget.", "Идеи по получателю и бюджету."],
    xmasCta: ["Find a gift", "Βρείτε δώρο", "Geschenk finden", "Trouver un cadeau", "Trova un regalo", "Encontrar un regalo", "Encontrar um presente", "Vind een cadeau", "Gjej një dhuratë", "Găsește un cadou", "Найти подарок"],
    halloweenEyebrow: ["HALLOWEEN WEEK", "ΕΒΔΟΜΑΔΑ HALLOWEEN", "HALLOWEEN-WOCHE", "SEMAINE D'HALLOWEEN", "SETTIMANA DI HALLOWEEN", "SEMANA DE HALLOWEEN", "SEMANA DO HALLOWEEN", "HALLOWEENWEEK", "JAVA E HALLOWEEN", "SĂPTĂMÂNA DE HALLOWEEN", "НЕДЕЛЯ ХЭЛЛОУИНА"],
    halloweenTitle: ["Halloween offers in the Gear Worlds", "Προσφορές Halloween στα Gear Worlds", "Halloween-Angebote in den Gear Worlds", "Offres d'Halloween dans les Gear Worlds", "Offerte di Halloween nei Gear Worlds", "Ofertas de Halloween en los Gear Worlds", "Ofertas de Halloween nos Gear Worlds", "Halloween-aanbiedingen in de Gear Worlds", "Oferta Halloween në Gear Worlds", "Oferte de Halloween în Gear Worlds", "Предложения на Хэллоуин в Gear Worlds"],
    halloweenText: ["Discount codes from our retailers, each with its end date.", "Κωδικοί έκπτωσης από τα καταστήματά μας, ο καθένας με την ημερομηνία λήξης του.", "Rabattcodes unserer Händler, jeder mit Enddatum.", "Des codes de réduction de nos marchands, chacun avec sa date de fin.", "Codici sconto dei nostri negozi, ognuno con la sua data di fine.", "Códigos de descuento de nuestras tiendas, cada uno con su fecha de fin.", "Códigos de desconto das nossas lojas, cada um com a sua data de fim.", "Kortingscodes van onze winkels, elk met een einddatum.", "Kode zbritjeje nga dyqanet tona, secili me datën e mbarimit.", "Coduri de reducere de la magazinele noastre, fiecare cu data de încheiere.", "Промокоды наших магазинов, у каждого указан срок."],
    salesEyebrow: ["WINTER SALES", "ΧΕΙΜΕΡΙΝΕΣ ΕΚΠΤΩΣΕΙΣ", "WINTERSCHLUSSVERKAUF", "SOLDES D'HIVER", "SALDI INVERNALI", "REBAJAS DE INVIERNO", "SALDOS DE INVERNO", "WINTERUITVERKOOP", "ULJET E DIMRIT", "REDUCERI DE IARNĂ", "ЗИМНИЕ РАСПРОДАЖИ"],
    salesTitle: ["Boxing Day and January sales", "Εκπτώσεις μετά τα Χριστούγεννα σε 10 Gear Worlds", "Sale nach Weihnachten in 10 Gear Worlds", "Les soldes d'après Noël dans 10 Gear Worlds", "Saldi dopo Natale in 10 Gear Worlds", "Rebajas de después de Navidad en 10 Gear Worlds", "Saldos depois do Natal em 10 Gear Worlds", "Uitverkoop na Kerst in 10 Gear Worlds", "Ulje pas Krishtlindjeve në 10 Gear Worlds", "Reduceri după Crăciun în 10 Gear Worlds", "Распродажи после Рождества в 10 Gear Worlds"],
    fitnessEyebrow: ["JANUARY", "ΙΑΝΟΥΑΡΙΟΣ", "JANUAR", "JANVIER", "GENNAIO", "ENERO", "JANEIRO", "JANUARI", "JANAR", "IANUARIE", "ЯНВАРЬ"],
    fitnessTitle: ["New year, new routine", "Νέα χρονιά, νέα ρουτίνα", "Neues Jahr, neue Routine", "Nouvelle année, nouvelle routine", "Anno nuovo, nuova routine", "Año nuevo, nueva rutina", "Ano novo, nova rotina", "Nieuw jaar, nieuwe routine", "Vit i ri, rutinë e re", "An nou, rutină nouă", "Новый год — новые привычки"],
    fitnessText: ["Fitness, running and home gym, from Sporty Gear World.", "Γυμναστική, τρέξιμο και γυμναστήριο στο σπίτι, από το Sporty Gear World.", "Fitness, Laufen und Heimtraining von Sporty Gear World.", "Fitness, course et salle de sport à la maison, avec Sporty Gear World.", "Fitness, corsa e palestra in casa, da Sporty Gear World.", "Fitness, running y gimnasio en casa, en Sporty Gear World.", "Fitness, corrida e ginásio em casa, na Sporty Gear World.", "Fitness, hardlopen en thuis trainen, bij Sporty Gear World.", "Fitnes, vrapim dhe palestër në shtëpi, nga Sporty Gear World.", "Fitness, alergare și sală acasă, de la Sporty Gear World.", "Фитнес, бег и домашний спортзал от Sporty Gear World."],
    fitnessCta: ["Shop sport", "Δείτε τα αθλητικά", "Sport entdecken", "Voir le sport", "Vedi lo sport", "Ver deporte", "Ver desporto", "Bekijk sport", "Shiko sportin", "Vezi sport", "Смотреть спорт"],
    valEyebrow: ["VALENTINE'S DAY · 14 FEBRUARY", "ΑΓΙΟΣ ΒΑΛΕΝΤΙΝΟΣ · 14 ΦΕΒΡΟΥΑΡΙΟΥ", "VALENTINSTAG · 14. FEBRUAR", "SAINT-VALENTIN · 14 FÉVRIER", "SAN VALENTINO · 14 FEBBRAIO", "SAN VALENTÍN · 14 DE FEBRERO", "DIA DOS NAMORADOS · 14 DE FEVEREIRO", "VALENTIJNSDAG · 14 FEBRUARI", "SHËN VALENTINI · 14 SHKURT", "ZIUA ÎNDRĂGOSTIȚILOR · 14 FEBRUARIE", "ДЕНЬ СВЯТОГО ВАЛЕНТИНА · 14 ФЕВРАЛЯ"],
    valTitle: ["Gifts for him and for her", "Δώρα για εκείνον και για εκείνη", "Geschenke für ihn und für sie", "Des cadeaux pour lui et pour elle", "Regali per lui e per lei", "Regalos para él y para ella", "Presentes para ele e para ela", "Cadeaus voor hem en voor haar", "Dhurata për të dashurin dhe të dashurën", "Cadouri pentru el și pentru ea", "Подарки для него и для неё"],
    allEyebrow: ["10 GEAR WORLDS · ONE SEARCH", "10 GEAR WORLDS · ΜΙΑ ΑΝΑΖΗΤΗΣΗ", "10 GEAR WORLDS · EINE SUCHE", "10 GEAR WORLDS · UNE RECHERCHE", "10 GEAR WORLDS · UNA RICERCA", "10 GEAR WORLDS · UNA BÚSQUEDA", "10 GEAR WORLDS · UMA PESQUISA", "10 GEAR WORLDS · ÉÉN ZOEKOPDRACHT", "10 GEAR WORLDS · NJË KËRKIM", "10 GEAR WORLDS · O SINGURĂ CĂUTARE", "10 GEAR WORLDS · ОДИН ПОИСК"],
    allTitle: ["Ten specialist shops, one search", "Δέκα εξειδικευμένα καταστήματα, μία αναζήτηση", "Zehn Fachshops, eine Suche", "Dix boutiques spécialisées, une seule recherche", "Dieci negozi specializzati, una sola ricerca", "Diez tiendas especializadas, una sola búsqueda", "Dez lojas especializadas, uma só pesquisa", "Tien speciaalzaken, één zoekopdracht", "Dhjetë dyqane të specializuara, një kërkim", "Zece magazine de specialitate, o singură căutare", "Десять специализированных магазинов, один поиск"],
    allText: ["Choose a world or search them all at once.", "Διαλέξτε κόσμο ή ψάξτε σε όλους μαζί.", "Wählen Sie eine Welt oder durchsuchen Sie alle auf einmal.", "Choisissez un monde ou cherchez dans tous à la fois.", "Scegli un mondo o cerca in tutti insieme.", "Elige un mundo o busca en todos a la vez.", "Escolha um mundo ou pesquise em todos ao mesmo tempo.", "Kies een wereld of zoek in alle tegelijk.", "Zgjidh një botë ose kërko në të gjitha njëherësh.", "Alegeți o lume sau căutați în toate deodată.", "Выберите мир или ищите сразу во всех."],
    allCta: ["Choose a world", "Διαλέξτε κόσμο", "Welt wählen", "Choisir un monde", "Scegli un mondo", "Elegir un mundo", "Escolher um mundo", "Kies een wereld", "Zgjidh një botë", "Alege o lume", "Выбрать мир"],
    worldsSub: ["10 specialist worlds, one network", "10 εξειδικευμένοι κόσμοι, ένα δίκτυο", "10 Fachwelten, ein Netzwerk", "10 mondes spécialisés, un seul réseau", "10 mondi specializzati, una sola rete", "10 mundos especializados, una sola red", "10 mundos especializados, uma só rede", "10 gespecialiseerde werelden, één netwerk", "10 botë të specializuara, një rrjet", "10 lumi de specialitate, o singură rețea", "10 специализированных миров, одна сеть"],
    giftDesc: ["Who is it for, and how much do you want to spend? We search the right Gear Worlds.", "Για ποιον είναι και πόσα θέλετε να δώσετε; Ψάχνουμε στα σωστά Gear Worlds.", "Für wen ist es und wie viel möchten Sie ausgeben? Wir suchen in den passenden Gear Worlds.", "Pour qui, et quel budget ? Nous cherchons dans les bons Gear Worlds.", "Per chi è e quanto vuoi spendere? Cerchiamo nei Gear Worlds giusti.", "¿Para quién es y cuánto quieres gastar? Buscamos en los Gear Worlds adecuados.", "Para quem é e quanto quer gastar? Pesquisamos nos Gear Worlds certos.", "Voor wie is het en hoeveel wilt u uitgeven? Wij zoeken in de juiste Gear Worlds.", "Për kë është dhe sa dëshiron të shpenzosh? Kërkojmë në Gear Worlds e duhura.", "Pentru cine este și cât doriți să cheltuiți? Căutăm în Gear Worlds potrivite.", "Для кого подарок и сколько вы готовы потратить? Мы ищем в нужных Gear Worlds."],
    giftWho: ["For whom?", "Για ποιον;", "Für wen?", "Pour qui ?", "Per chi?", "¿Para quién?", "Para quem?", "Voor wie?", "Për kë?", "Pentru cine?", "Для кого?"],
    giftBudget: ["Up to how much?", "Μέχρι πόσο;", "Bis wie viel?", "Jusqu'à combien ?", "Fino a quanto?", "¿Hasta cuánto?", "Até quanto?", "Tot hoeveel?", "Deri në sa?", "Până la cât?", "До какой суммы?"],
    giftAny: ["Any price", "Οποιαδήποτε τιμή", "Jeder Preis", "Tous les prix", "Qualsiasi prezzo", "Cualquier precio", "Qualquer preço", "Elke prijs", "Çdo çmim", "Orice preț", "Любая цена"],
    giftUpTo: ["Up to {price}", "Έως {price}", "Bis {price}", "Jusqu'à {price}", "Fino a {price}", "Hasta {price}", "Até {price}", "Tot {price}", "Deri në {price}", "Până la {price}", "До {price}"],
    giftIdeas: ["Ideas:", "Ιδέες:", "Ideen:", "Idées :", "Idee:", "Ideas para regalar:", "Ideias:", "Ideeën:", "Ide:", "Idei:", "Идеи:"],
    giftGo: ["Show me ideas", "Δείξτε μου ιδέες", "Ideen zeigen", "Voir des idées", "Mostrami idee", "Muéstrame ideas", "Mostrar ideias", "Toon ideeën", "Më trego ide", "Arată-mi idei", "Показать идеи"],
    giftSearching: ["Looking for ideas...", "Ψάχνουμε ιδέες...", "Wir suchen Ideen...", "Recherche d'idées...", "Cerchiamo idee...", "Buscando ideas...", "A procurar ideias...", "Ideeën zoeken...", "Po kërkojmë ide...", "Căutăm idei...", "Ищем идеи..."],
    giftNone: ["Nothing found within this budget. Try another idea or a higher price.", "Δεν βρέθηκε κάτι σε αυτό το budget. Δοκιμάστε άλλη ιδέα ή μεγαλύτερη τιμή.", "In diesem Budget nichts gefunden. Probieren Sie eine andere Idee oder einen höheren Preis.", "Rien trouvé dans ce budget. Essayez une autre idée ou un prix plus élevé.", "Niente in questo budget. Prova un'altra idea o un prezzo più alto.", "No hay nada con este presupuesto. Prueba otra idea o un precio más alto.", "Nada encontrado neste orçamento. Experimente outra ideia ou um preço mais alto.", "Niets gevonden binnen dit budget. Probeer een ander idee of een hogere prijs.", "Nuk u gjet asgjë me këtë buxhet. Provo një ide tjetër ose një çmim më të lartë.", "Nu am găsit nimic în acest buget. Încercați altă idee sau un preț mai mare.", "В этом бюджете ничего не найдено. Попробуйте другую идею или цену повыше."],
    giftError: ["The gift finder is not available right now. Please try again in a moment.", "Η αναζήτηση δώρων δεν είναι διαθέσιμη τώρα. Δοκιμάστε ξανά σε λίγο.", "Der Geschenkefinder ist gerade nicht verfügbar. Bitte versuchen Sie es gleich noch einmal.", "La recherche de cadeaux n'est pas disponible pour le moment. Réessayez dans un instant.", "La ricerca regali non è disponibile ora. Riprova tra poco.", "El buscador de regalos no está disponible ahora. Inténtalo de nuevo en un momento.", "A pesquisa de presentes não está disponível agora. Tente novamente daqui a pouco.", "De cadeauzoeker is nu niet beschikbaar. Probeer het zo opnieuw.", "Kërkimi i dhuratave nuk është i disponueshëm tani. Provo përsëri pas pak.", "Căutarea de cadouri nu este disponibilă acum. Încercați din nou în curând.", "Подбор подарков сейчас недоступен. Попробуйте ещё раз чуть позже."],
    giftFound: ["{count} ideas · {idea} · {budget}", "{count} ιδέες · {idea} · {budget}", "{count} Ideen · {idea} · {budget}", "{count} idées · {idea} · {budget}", "{count} idee · {idea} · {budget}", "{count} ideas para regalar · {idea} · {budget}", "{count} ideias · {idea} · {budget}", "{count} ideeën · {idea} · {budget}", "{count} ide · {idea} · {budget}", "{count} idei · {idea} · {budget}", "Идей: {count} · {idea} · {budget}"],
    dealsTitle: ["This week's deals", "Προσφορές της εβδομάδας", "Angebote der Woche", "Les offres de la semaine", "Le offerte della settimana", "Ofertas de la semana", "Ofertas da semana", "Aanbiedingen van de week", "Ofertat e javës", "Ofertele săptămânii", "Предложения недели"],
    dealsSub: ["From Gear World retailers, each with its end date.", "Από τα καταστήματα των Gear Worlds, η καθεμία με ημερομηνία λήξης.", "Von den Händlern der Gear Worlds, jedes mit Enddatum.", "Des marchands des Gear Worlds, chacune avec sa date de fin.", "Dai negozi dei Gear Worlds, ognuna con la sua data di fine.", "De las tiendas de los Gear Worlds, cada una con su fecha de fin.", "Das lojas dos Gear Worlds, cada uma com a sua data de fim.", "Van de winkels van de Gear Worlds, elk met een einddatum.", "Nga dyqanet e Gear Worlds, secila me datën e mbarimit.", "De la magazinele Gear Worlds, fiecare cu data de încheiere.", "От магазинов Gear Worlds, у каждого указан срок."],
    dealCode: ["{off} off when you spend {min} or more", "{off} έκπτωση σε αγορές από {min}", "{off} Rabatt ab {min} Einkaufswert", "{off} de réduction dès {min} d'achat", "{off} di sconto su una spesa di almeno {min}", "{off} de descuento en compras desde {min}", "{off} de desconto em compras a partir de {min}", "{off} korting vanaf {min} besteding", "{off} zbritje për blerje nga {min}", "{off} reducere la cumpărături de minimum {min}", "Скидка {off} при покупке от {min}"],
    dealCodeNoMin: ["{off} off with a code", "{off} έκπτωση με κωδικό", "{off} Rabatt mit Code", "{off} de réduction avec un code", "{off} di sconto con un codice", "{off} de descuento con un código", "{off} de desconto com um código", "{off} korting met een code", "{off} zbritje me kod", "{off} reducere cu un cod", "Скидка {off} по коду"],
    dealUpTo: ["Up to {pct}% off", "Έως {pct}% έκπτωση", "Bis zu {pct}% Rabatt", "Jusqu'à {pct} % de réduction", "Fino al {pct}% di sconto", "Hasta un {pct}% de descuento", "Até {pct}% de desconto", "Tot {pct}% korting", "Deri në {pct}% zbritje", "Până la {pct}% reducere", "Скидки до {pct}%"],
    dealWithCode: ["With a code", "Με κωδικό", "Mit Code", "Avec un code", "Con un codice", "Con un código", "Com um código", "Met een code", "Me kod", "Cu un cod", "По коду"],
    dealSale: ["Sale", "Εκπτώσεις", "Aktion", "Soldes", "Saldi", "Rebajas", "Saldos", "Uitverkoop", "Ulje", "Reduceri", "Распродажа"],
    dealUntil: ["until {date}", "έως {date}", "bis {date}", "jusqu'au {date}", "fino al {date}", "hasta el {date}", "até {date}", "t/m {date}", "deri më {date}", "până la {date}", "до {date}"],
    dealCta: ["See the offer", "Δείτε την προσφορά", "Zum Angebot", "Voir l'offre", "Vedi l'offerta", "Ver la oferta", "Ver a oferta", "Bekijk de aanbieding", "Shiko ofertën", "Vezi oferta", "Смотреть предложение"],
    dock: ["Search all Gear Worlds", "Αναζήτηση σε όλα τα Gear Worlds", "Alle Gear Worlds durchsuchen", "Chercher dans tous les Gear Worlds", "Cerca in tutti i Gear Worlds", "Buscar en todos los Gear Worlds", "Pesquisar em todos os Gear Worlds", "Zoek in alle Gear Worlds", "Kërko në të gjitha Gear Worlds", "Caută în toate Gear Worlds", "Искать во всех Gear Worlds"],

    // Gift finder: who the gift is for (they answer "For whom?").
    whoHim: ["Him", "Εκείνον", "Ihn", "Lui", "Lui", "Él", "Ele", "Hem", "Burra", "El", "Ему"],
    whoHer: ["Her", "Εκείνη", "Sie", "Elle", "Lei", "Ella", "Ela", "Haar", "Gra", "Ea", "Ей"],
    whoKids: ["Kids", "Παιδιά", "Kinder", "Enfants", "Bambini", "Niños", "Crianças", "Kinderen", "Fëmijë", "Copii", "Детям"],
    whoHome: ["Home & garden", "Σπίτι & κήπο", "Haus & Garten", "Maison & jardin", "Casa e giardino", "Casa y jardín", "Casa e jardim", "Huis & tuin", "Shtëpi & kopsht", "Casă & grădină", "Для дома и сада"],
    whoTech: ["Tech lover", "Λάτρη της τεχνολογίας", "Technikfan", "Fan de tech", "Amante della tecnologia", "Fan de la tecnología", "Fã de tecnologia", "Techliefhebber", "Fans i teknologjisë", "Pasionat de tehnologie", "Любителю техники"],
    whoTravel: ["Traveller", "Ταξιδιώτη", "Reisende", "Voyageur", "Viaggiatore", "Viajero", "Viajante", "Reiziger", "Udhëtar", "Călător", "Путешественнику"],
    whoSport: ["Sporty type", "Αθλητικό τύπο", "Sportler", "Sportif", "Sportivo", "Deportista", "Desportista", "Sporter", "Sportist", "Sportiv", "Спортсмену"],
    whoDiy: ["DIY & car fan", "Μάστορα & οδηγό", "Heimwerker & Autofans", "Bricoleur & auto", "Fai da te e auto", "Bricolaje y coche", "Bricolage e carro", "Klusser & autofan", "Mjeshtër & makina", "Bricolaj & mașină", "Мастеру и автолюбителю"],

    // Gift ideas (the search itself is always in English: the sites' catalogues are in English).
    ideaWatch: ["Watch", "Ρολόι", "Uhr", "Montre", "Orologio", "Reloj", "Relógio", "Horloge", "Orë", "Ceas", "Часы"],
    ideaAftershave: ["Aftershave", "Λοσιόν ξυρίσματος", "Rasierwasser", "Après-rasage", "Dopobarba", "Loción para después del afeitado", "Loção pós-barba", "Aftershavelotion", "Locion pas rroje", "Loțiune după ras", "Лосьон после бритья"],
    ideaHeadphones: ["Headphones", "Ακουστικά", "Kopfhörer", "Casque audio", "Cuffie", "Auriculares", "Auscultadores", "Koptelefoon", "Kufje", "Căști", "Наушники"],
    ideaHandbag: ["Handbag", "Τσάντα", "Handtasche", "Sac à main", "Borsa", "Bolso", "Mala de mão", "Handtas", "Çantë dore", "Geantă", "Сумка"],
    ideaPerfume: ["Perfume", "Άρωμα", "Parfüm", "Parfum", "Profumo", "Perfume", "Perfume", "Parfum", "Parfum", "Parfum", "Парфюм"],
    ideaScarf: ["Scarf", "Κασκόλ", "Schal", "Écharpe", "Sciarpa", "Bufanda", "Cachecol", "Sjaal", "Shall", "Eșarfă", "Шарф"],
    ideaBackpack: ["Backpack", "Σακίδιο", "Rucksack", "Sac à dos", "Zaino", "Mochila", "Mochila", "Rugzak", "Çantë shpine", "Rucsac", "Рюкзак"],
    ideaTrainers: ["Trainers", "Αθλητικά παπούτσια", "Turnschuhe", "Baskets", "Scarpe da ginnastica", "Zapatillas", "Ténis", "Sneakers", "Atlete", "Adidași", "Кроссовки"],
    ideaPyjamas: ["Pyjamas", "Πιτζάμες", "Schlafanzug", "Pyjama", "Pigiama", "Pijama", "Pijama", "Pyjama", "Pizhame", "Pijama", "Пижама"],
    ideaLamp: ["Lamp", "Φωτιστικό", "Lampe", "Lampe", "Lampada", "Lámpara", "Candeeiro", "Lamp", "Llambë", "Lampă", "Лампа"],
    ideaCandle: ["Candle", "Κερί", "Kerze", "Bougie", "Candela", "Vela", "Vela", "Kaars", "Qiri", "Lumânare", "Свеча"],
    ideaPlanter: ["Planter", "Γλάστρα", "Pflanzkübel", "Jardinière", "Fioriera", "Macetero", "Floreira", "Plantenbak", "Vazo lulesh", "Jardinieră", "Кашпо"],
    ideaCharger: ["Charger", "Φορτιστής", "Ladegerät", "Chargeur", "Caricabatterie", "Cargador", "Carregador", "Oplader", "Karikues", "Încărcător", "Зарядное устройство"],
    ideaSpeaker: ["Speaker", "Ηχείο", "Lautsprecher", "Enceinte", "Altoparlante", "Altavoz", "Coluna", "Luidspreker", "Altoparlant", "Boxă", "Колонка"],
    ideaSuitcase: ["Suitcase", "Βαλίτσα", "Koffer", "Valise", "Valigia", "Maleta", "Mala de viagem", "Koffer", "Valixhe", "Valiză", "Чемодан"],
    ideaPackingCubes: ["Packing cubes", "Οργανωτές βαλίτσας", "Packwürfel", "Cubes de rangement", "Organizer da valigia", "Organizadores de maleta", "Organizadores de mala", "Bagage-organizers", "Organizues valixhe", "Organizatoare de bagaj", "Органайзеры для чемодана"],
    ideaYogaMat: ["Yoga mat", "Στρώμα γιόγκα", "Yogamatte", "Tapis de yoga", "Tappetino yoga", "Esterilla de yoga", "Tapete de ioga", "Yogamat", "Tapet joga", "Saltea de yoga", "Коврик для йоги"],
    ideaWaterBottle: ["Water bottle", "Παγούρι", "Trinkflasche", "Gourde", "Borraccia", "Botella de agua", "Garrafa de água", "Waterfles", "Shishe uji", "Sticlă de apă", "Бутылка для воды"],
    ideaDumbbells: ["Dumbbells", "Αλτήρες", "Hanteln", "Haltères", "Manubri", "Mancuernas", "Halteres", "Halters", "Pesha dore", "Gantere", "Гантели"],
    ideaDrill: ["Drill", "Δράπανο", "Bohrmaschine", "Perceuse", "Trapano", "Taladro", "Berbequim", "Boormachine", "Trapan", "Bormașină", "Дрель"],
    ideaWorkGloves: ["Work gloves", "Γάντια εργασίας", "Arbeitshandschuhe", "Gants de travail", "Guanti da lavoro", "Guantes de trabajo", "Luvas de trabalho", "Werkhandschoenen", "Doreza pune", "Mănuși de lucru", "Рабочие перчатки"],
    ideaDashCam: ["Dash cam", "Κάμερα αυτοκινήτου", "Dashcam", "Caméra embarquée", "Dashcam", "Cámara para coche", "Câmara para carro", "Dashcam", "Kamerë makine", "Cameră auto", "Видеорегистратор"]
  };

  // Texts that are the same word as in English on purpose (a name, or the same word in that language).
  const SAME_AS_ENGLISH = {
    dockPhoto: ["fr-FR"], ideaPerfume: ["es-ES", "pt-PT"], ideaLamp: ["nl-NL"]
  };

  // Campaign slides: shopping seasons only (the Hub is one complete shop for the customer: no "new site" slides, the
  // owner's wish of 27/10/2026). Each one shows only between its first and last day (UK time). Nothing turns by itself.
  // Deals slides go to the e-mail sign-up when no deal runs. Add the next seasons here, with their dates.
  const CAMPAIGNS = [
    { id: "halloween", start: "2026-10-20", end: "2026-10-31", art: "halloween", eyebrow: "halloweenEyebrow", title: "halloweenTitle", text: "halloweenText", cta: "bfCta", href: "#deals" },
    { id: "black-friday", start: "2026-11-27", end: "2026-11-30", art: "black-friday", eyebrow: "bfEyebrow", title: "bfTitle", text: "bfText", cta: "bfCta", href: "#deals" },
    { id: "black-friday-soon", start: "2026-11-13", end: "2026-11-26", art: "black-friday-soon", eyebrow: "soonEyebrow", title: "soonTitle", text: "soonText", cta: "soonCta", href: "#newsletter" },
    { id: "christmas", start: "2026-11-01", end: "2026-12-24", art: "christmas", eyebrow: "xmasEyebrow", title: "xmasTitle", text: "xmasText", cta: "xmasCta", href: "#gifts" },
    { id: "winter-sales", start: "2026-12-26", end: "2027-01-15", art: "winter-sales", eyebrow: "salesEyebrow", title: "salesTitle", text: "bfText", cta: "bfCta", href: "#deals" },
    { id: "new-year-fitness", start: "2027-01-01", end: "2027-01-31", art: "new-year-fitness", eyebrow: "fitnessEyebrow", title: "fitnessTitle", text: "fitnessText", cta: "fitnessCta", href: "https://sportygearworld.com/" },
    { id: "valentines-day", start: "2027-02-01", end: "2027-02-14", art: "valentines-day", eyebrow: "valEyebrow", title: "valTitle", text: "xmasText", cta: "xmasCta", href: "#gifts" }
  ];
  const FALLBACK_CAMPAIGN = { id: "all-worlds", start: "", end: "", art: "", eyebrow: "allEyebrow", title: "allTitle", text: "allText", cta: "allCta", href: "#worlds" };

  // Gift finder: each idea searches only the Gear Worlds that sell it (fewer requests, better matches).
  const GIFTS = [
    { id: "him", label: "whoHim", ideas: [["ideaWatch", "watch", ["mgw"]], ["ideaAftershave", "aftershave", ["mgw"]], ["ideaHeadphones", "headphones", ["tgw"]]] },
    { id: "her", label: "whoHer", ideas: [["ideaHandbag", "handbag", ["wgw"]], ["ideaPerfume", "perfume", ["wgw"]], ["ideaScarf", "scarf", ["wgw"]]] },
    { id: "kids", label: "whoKids", ideas: [["ideaBackpack", "backpack", ["kgw"]], ["ideaTrainers", "trainers", ["kgw"]], ["ideaPyjamas", "pyjamas", ["kgw"]]] },
    { id: "home", label: "whoHome", ideas: [["ideaLamp", "lamp", ["hgw"]], ["ideaCandle", "candle", ["hgw"]], ["ideaPlanter", "planter", ["ggw", "hgw"]]] },
    { id: "tech", label: "whoTech", ideas: [["ideaHeadphones", "headphones", ["tgw"]], ["ideaCharger", "charger", ["tgw"]], ["ideaSpeaker", "bluetooth speaker", ["tgw"]]] },
    { id: "travel", label: "whoTravel", ideas: [["ideaSuitcase", "suitcase", ["vgw"]], ["ideaBackpack", "travel backpack", ["vgw"]], ["ideaPackingCubes", "packing cubes", ["vgw"]]] },
    { id: "sport", label: "whoSport", ideas: [["ideaYogaMat", "yoga mat", ["sgw"]], ["ideaWaterBottle", "water bottle", ["sgw"]], ["ideaDumbbells", "dumbbell", ["sgw"]]] },
    { id: "diy", label: "whoDiy", ideas: [["ideaDrill", "drill", ["cgw"]], ["ideaWorkGloves", "work gloves", ["cgw"]], ["ideaDashCam", "dash cam", ["agw"]]] }
  ];
  const BUDGETS = [25, 50, 100, 0]; // 0 = any price
  const POPULAR = [["ideaDrill", "cordless drill"], ["ideaBackpack", "backpack"], ["ideaHeadphones", "headphones"], ["ideaDashCam", "dash cam"]];
  const DEALS_SHOWN = 4;

  const locale = () => {
    const l = (window.GWH_getLocale && window.GWH_getLocale()) || "en-GB";
    return LOCALES.includes(l) ? l : "en-GB";
  };

  function tx(key, vars) {
    const list = T[key];
    let value = list ? (list[LOCALES.indexOf(locale())] || list[0]) : key;
    if (vars) for (const name of Object.keys(vars)) value = value.split(`{${name}}`).join(String(vars[name]));
    return value;
  }

  // Today's date in the UK (YYYY-MM-DD): campaigns and deals start and end on UK days, like the sites (lessons L32).
  function ukToday(now) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now === undefined ? Date.now() : now));
  }

  const DAY = /^\d{4}-\d{2}-\d{2}$/;

  // On the test address only (*.workers.dev or this computer), ?gwh-date=2026-11-28 shows the slides of that day, so
  // the owner can see the Black Friday slide before 27/11. The live gearworldhub.com ignores it.
  function previewDay() {
    try {
      if (typeof location === "undefined" || !/(\.workers\.dev|^127\.0\.0\.1|^localhost)$/.test(location.hostname)) return "";
      const day = new URLSearchParams(location.search).get("gwh-date") || "";
      return DAY.test(day) ? day : "";
    } catch (_) {
      return "";
    }
  }

  function activeCampaigns(now) {
    const today = now === undefined && previewDay() ? previewDay() : ukToday(now);
    const list = CAMPAIGNS.filter(c => DAY.test(c.start) && DAY.test(c.end) && c.start <= today && today <= c.end);
    return list.length ? list : [FALLBACK_CAMPAIGN];
  }

  // Deals from hub-deals.json (made from promos/promos.js by tools/gwh-deals.mjs): only those that run today, codes
  // first (smaller minimum spend first), then sales (bigger saving first). Every link is a retailer page of a site.
  function activeDeals(deals, now) {
    const today = ukToday(now);
    return (Array.isArray(deals) ? deals : [])
      .filter(d => d && d.id && d.retailer && DAY.test(d.start || "") && DAY.test(d.end || "") && d.start <= today && today <= d.end)
      .filter(d => /^https:\/\/[a-z0-9.-]+\/discount-codes\/[a-z0-9-]+\/$/.test(String(d.link || "")))
      .filter(d => (d.kind === "code" ? Number(d.off) > 0 : Number(d.upTo) > 0))
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "code" ? -1 : 1) ||
        (a.kind === "code" ? (Number(a.minSpend) || 0) - (Number(b.minSpend) || 0) : (Number(b.upTo) || 0) - (Number(a.upTo) || 0)));
  }

  function giftSearchUrl(idea, budget) {
    const params = new URLSearchParams({ q: idea[1], worlds: idea[2].join(",") });
    if (budget > 0) params.set("max_price", String(budget));
    return `/api/search?${params.toString()}`;
  }

  // ---------- campaign pictures: drawn here (SVG), one idea per season, no photos of our sites. Things drop in ONCE
  // when the slide opens (about 2 seconds) and then stay still; nothing loops, and with "reduce motion" nothing moves.
  // Colours without red/green (L35): orange, amber, purple, blue, pink, white.
  const svgOpen = (id, top, bottom) => `<svg class="gwh2-art" viewBox="0 0 700 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="700" height="260" fill="url(#${id})"/>`;
  // a thing that drops in from above, once (cls: gwh2-drop = with a small bounce, gwh2-fall = softly, with fade-in)
  const once = (cls, delay, x, y, inner, scale) => `<g class="${cls} gwh2-d${delay}"><g transform="translate(${x} ${y})${scale ? ` scale(${scale})` : ""}">${inner}</g></g>`;
  const stars = (list, color) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color || "#ffffff"}" opacity=".75"/>`).join("");
  const spider = (len) => `<line x1="0" y1="${-len}" x2="0" y2="-8" stroke="#d9d2f5" stroke-width="1.5"/><g stroke="#e9e4ff" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M-4 -2 q-12 -12 -22 -6"/><path d="M-5 1 q-14 -3 -24 4"/><path d="M-5 4 q-12 5 -19 15"/><path d="M-3 6 q-8 9 -11 19"/><path d="M4 -2 q12 -12 22 -6"/><path d="M5 1 q14 -3 24 4"/><path d="M5 4 q12 5 19 15"/><path d="M3 6 q8 9 11 19"/></g><circle cy="-6" r="6" fill="#e9e4ff"/><ellipse cy="5" rx="9" ry="10" fill="#e9e4ff"/><circle cx="-2.5" cy="-7" r="1.6" fill="#3a1d5c"/><circle cx="2.5" cy="-7" r="1.6" fill="#3a1d5c"/>`;
  const ghost = `<path d="M-28 34 V-4 a28 28 0 0 1 56 0 V34 l-9 -9 l-9.5 9 l-9.5 -9 l-9.5 9 l-9.5 -9 Z" fill="#f4f1ff"/><ellipse cx="-10" cy="-2" rx="4.5" ry="6.5" fill="#2a1650"/><ellipse cx="10" cy="-2" rx="4.5" ry="6.5" fill="#2a1650"/><ellipse cy="14" rx="5" ry="6" fill="#2a1650"/>`;
  const pumpkin = `<rect x="-3.5" y="-36" width="7" height="12" rx="2.5" fill="#7a5230"/><ellipse rx="36" ry="27" fill="#ff8a1f"/><ellipse cx="-15" rx="15" ry="26" fill="#f27a10"/><ellipse cx="15" rx="15" ry="26" fill="#f27a10"/><ellipse rx="10" ry="27" fill="#ff9a3a"/><path d="M-17 -6 h10 l-5 -9 Z M7 -6 h10 l-5 -9 Z" fill="#ffd36b"/><path d="M-18 6 q18 16 36 0 q-18 7 -36 0 Z" fill="#ffd36b"/>`;
  const bat = `<path d="M0 0 q-6 -8 -16 -6 q4 3 3 7 q-6 -2 -11 2 q8 1 10 6 q8 -4 14 -2 q6 -2 14 2 q2 -5 10 -6 q-5 -4 -11 -2 q-1 -4 3 -7 q-10 -2 -16 6 Z" fill="#120a24"/>`;
  const tag = (fill, text) => `<path d="M0 0 h64 l20 21 l-20 21 h-64 a8 8 0 0 1 -8 -8 v-26 a8 8 0 0 1 8 -8 Z" fill="${fill}"/><circle cx="66" cy="21" r="4.5" fill="#0b1626"/><text x="28" y="31" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#06111f">${text}</text>`;
  const bag = (fill, handle) => `<path d="M-14 -40 q0 -18 14 -18 q14 0 14 18" fill="none" stroke="${handle}" stroke-width="5" stroke-linecap="round"/><path d="M-34 -42 h68 l6 62 h-80 Z" fill="${fill}"/><rect x="-40" y="14" width="80" height="6" fill="#000" opacity=".12"/>`;
  const heart = (fill) => `<path d="M0 10 C0 -4 -18 -6 -18 7 C-18 19 0 27 0 34 C0 27 18 19 18 7 C18 -6 0 -4 0 10 Z" fill="${fill}"/>`;
  const snow = (r) => `<g stroke="#ffffff" stroke-width="${r / 3}" stroke-linecap="round"><path d="M0 ${-r} V${r} M${-r} 0 H${r} M${-r * .7} ${-r * .7} L${r * .7} ${r * .7} M${-r * .7} ${r * .7} L${r * .7} ${-r * .7}"/></g>`;
  const giftBox = (box, ribbon) => `<rect x="-30" y="-24" width="60" height="48" rx="4" fill="${box}"/><rect x="-34" y="-34" width="68" height="14" rx="3" fill="${box}"/><rect x="-5" y="-34" width="10" height="58" fill="${ribbon}"/><path d="M0 -34 q-20 -18 -22 -4 q2 6 22 4 q20 2 22 -4 q-2 -14 -22 4" fill="${ribbon}"/>`;

  const ART = {
    halloween: svgOpen("gwh2ArtHw", "#140a2e", "#3d1e60") +
      stars([[60, 30, 1.6], [150, 60, 1.2], [230, 24, 1.8], [300, 70, 1.1], [610, 150, 1.3], [660, 40, 1.6], [420, 30, 1.2]]) +
      `<circle cx="520" cy="80" r="70" fill="#ffe08a" opacity=".12"/><circle cx="520" cy="80" r="44" fill="#ffe7a3"/><circle cx="506" cy="70" r="7" fill="#f2d58a"/><circle cx="534" cy="94" r="5" fill="#f2d58a"/>` +
      `<g transform="translate(470 60)">${bat}</g><g transform="translate(585 112) scale(.75)">${bat}</g>` +
      `<path d="M0 226 Q120 204 240 222 T480 220 T700 226 V260 H0 Z" fill="#0e0720"/>` +
      once("gwh2-fall", 2, 255, 128, ghost) + once("gwh2-fall", 4, 405, 150, ghost, ".75") +
      once("gwh2-drop", 1, 110, 74, spider(240)) + once("gwh2-drop", 3, 330, 52, spider(240), ".85") + once("gwh2-drop", 5, 625, 104, spider(260), ".9") +
      `<g transform="translate(175 214)">${pumpkin}</g><g transform="translate(555 220) scale(.72)">${pumpkin}</g><g transform="translate(250 228) scale(.5)">${pumpkin}</g></svg>`,
    "black-friday": svgOpen("gwh2ArtBf", "#05070c", "#161c2a") +
      `<polygon points="0,190 700,70 700,118 0,238" fill="#ffb400" opacity=".12"/>` +
      stars([[80, 40, 1.5], [200, 30, 1.2], [520, 36, 1.4], [640, 58, 1.2]], "#ffb400") +
      once("gwh2-fall", 1, 96, 40, tag("#ffb400", "%")) + once("gwh2-fall", 3, 520, 26, tag("#f5f7fb", "%"), ".85") + once("gwh2-fall", 5, 600, 120, tag("#6cb6ff", "%"), ".7") +
      once("gwh2-drop", 2, 270, 226, bag("#ffb400", "#ffd36b")) + once("gwh2-drop", 4, 360, 230, bag("#6cb6ff", "#cfe3ff"), ".9") + once("gwh2-drop", 6, 440, 232, bag("#f5f7fb", "#c9d3e3"), ".78") + `</svg>`,
    "black-friday-soon": svgOpen("gwh2ArtSoon", "#0b1430", "#1d2a58") +
      stars([[60, 50, 1.4], [640, 40, 1.6], [580, 210, 1.2], [110, 210, 1.2]], "#ffb400") +
      once("gwh2-drop", 1, 250, 40, `<rect x="0" y="0" width="130" height="150" rx="14" fill="#f5f7fb"/><rect x="0" y="0" width="130" height="40" rx="14" fill="#ffb400"/><rect x="0" y="26" width="130" height="14" fill="#ffb400"/><circle cx="34" cy="0" r="6" fill="#0b1626"/><circle cx="96" cy="0" r="6" fill="#0b1626"/><text x="65" y="122" text-anchor="middle" font-family="Arial, sans-serif" font-size="76" font-weight="900" fill="#0b1626">27</text>`) +
      once("gwh2-drop", 3, 420, 78, `<rect x="0" y="0" width="150" height="100" rx="10" fill="#6cb6ff"/><path d="M6 8 L75 58 L144 8" fill="none" stroke="#0b1430" stroke-width="6" stroke-linejoin="round"/>`) +
      once("gwh2-fall", 5, 120, 120, tag("#ffb400", "%"), ".8") + `</svg>`,
    christmas: svgOpen("gwh2ArtXmas", "#0c1a3a", "#1f4078") +
      stars([[70, 30, 1.4], [190, 50, 1.1], [560, 26, 1.5], [650, 70, 1.2]]) +
      `<path d="M0 222 Q175 200 350 214 T700 210 V260 H0 Z" fill="#e8f0ff"/>` +
      `<g transform="translate(350 40)"><path d="M0 0 L60 70 H34 L80 124 H50 L96 178 H-96 L-50 124 H-80 L-34 70 H-60 Z" fill="#cfe3ff"/><rect x="-12" y="178" width="24" height="18" fill="#7a5230"/><polygon points="0,-22 6,-6 22,-6 9,4 14,20 0,10 -14,20 -9,4 -22,-6 -6,-6" fill="#ffd36b"/><circle cx="-20" cy="96" r="7" fill="#ffb400"/><circle cx="26" cy="138" r="7" fill="#6cb6ff"/><circle cx="-42" cy="152" r="7" fill="#ffb400"/><circle cx="14" cy="64" r="6" fill="#6cb6ff"/><circle cx="50" cy="160" r="6" fill="#ffb400"/></g>` +
      once("gwh2-drop", 2, 205, 200, giftBox("#ffb400", "#0b57b5")) + once("gwh2-drop", 4, 500, 204, giftBox("#6cb6ff", "#ffb400"), ".85") +
      once("gwh2-fall", 1, 90, 90, snow(9)) + once("gwh2-fall", 3, 160, 150, snow(6)) + once("gwh2-fall", 5, 600, 110, snow(9)) + once("gwh2-fall", 2, 640, 180, snow(6)) + once("gwh2-fall", 4, 470, 60, snow(7)) + once("gwh2-fall", 6, 250, 70, snow(5)) + `</svg>`,
    "winter-sales": svgOpen("gwh2ArtSales", "#0e2a4a", "#1d4f82") +
      `<path d="M0 226 Q175 210 350 222 T700 218 V260 H0 Z" fill="#e8f0ff"/>` +
      once("gwh2-fall", 1, 100, 70, snow(10)) + once("gwh2-fall", 3, 610, 60, snow(12)) + once("gwh2-fall", 5, 220, 160, snow(7)) + once("gwh2-fall", 2, 520, 170, snow(7)) +
      once("gwh2-drop", 2, 270, 60, tag("#ffb400", "%")) + once("gwh2-drop", 4, 390, 104, tag("#f5f7fb", "%"), ".9") +
      once("gwh2-drop", 6, 350, 228, bag("#6cb6ff", "#cfe3ff"), ".85") + `</svg>`,
    "new-year-fitness": svgOpen("gwh2ArtFit", "#0b1626", "#163057") +
      once("gwh2-fall", 1, 80, 40, `<rect width="10" height="18" rx="2" fill="#ffb400" transform="rotate(20)"/>`) + once("gwh2-fall", 3, 160, 80, `<rect width="10" height="18" rx="2" fill="#6cb6ff" transform="rotate(-25)"/>`) + once("gwh2-fall", 2, 560, 50, `<rect width="10" height="18" rx="2" fill="#f5f7fb" transform="rotate(35)"/>`) + once("gwh2-fall", 5, 640, 110, `<rect width="10" height="18" rx="2" fill="#ffb400" transform="rotate(-10)"/>`) + once("gwh2-fall", 4, 470, 30, `<circle r="5" fill="#6cb6ff"/>`) + once("gwh2-fall", 6, 230, 34, `<circle r="5" fill="#ffb400"/>`) +
      once("gwh2-drop", 2, 190, 176, `<rect x="-70" y="-6" width="140" height="12" rx="6" fill="#c9d3e3"/><rect x="-70" y="-30" width="20" height="60" rx="5" fill="#ffb400"/><rect x="-92" y="-22" width="20" height="44" rx="5" fill="#ffb400"/><rect x="50" y="-30" width="20" height="60" rx="5" fill="#ffb400"/><rect x="72" y="-22" width="20" height="44" rx="5" fill="#ffb400"/>`) +
      once("gwh2-drop", 4, 470, 150, `<circle r="44" fill="none" stroke="#f5f7fb" stroke-width="8"/><rect x="-8" y="-62" width="16" height="12" rx="3" fill="#f5f7fb"/><path d="M0 0 V-28 M0 0 L20 12" stroke="#ffb400" stroke-width="6" stroke-linecap="round"/>`) +
      once("gwh2-drop", 6, 365, 228, `<path d="M-60 -10 q4 -28 30 -30 l10 14 q16 10 46 14 q30 4 34 18 v8 h-120 Z" fill="#6cb6ff"/><rect x="-62" y="2" width="124" height="10" rx="5" fill="#f5f7fb"/>`, ".8") + `</svg>`,
    "valentines-day": svgOpen("gwh2ArtVal", "#24082e", "#4f1446") +
      stars([[70, 40, 1.4], [620, 30, 1.6], [560, 200, 1.2]], "#ffd1e8") +
      once("gwh2-fall", 1, 110, 50, heart("#ff7ab6")) + once("gwh2-fall", 3, 200, 120, heart("#ffb400"), ".7") + once("gwh2-fall", 5, 560, 60, heart("#f5f7fb"), ".8") + once("gwh2-fall", 2, 630, 140, heart("#ff7ab6"), ".6") + once("gwh2-fall", 4, 470, 24, heart("#ffb400"), ".5") +
      once("gwh2-drop", 2, 300, 190, giftBox("#ff7ab6", "#f5f7fb")) + once("gwh2-drop", 4, 410, 150, `<rect x="0" y="0" width="120" height="80" rx="8" fill="#f5f7fb"/><path d="M4 6 L60 46 L116 6" fill="none" stroke="#4f1446" stroke-width="5" stroke-linejoin="round"/><g transform="translate(60 52) scale(.5)">${heart("#ff7ab6")}</g>`) + `</svg>`
  };
  // Between seasons: the 10 Gear Worlds side by side (their own pictures are right for "choose a world").
  const WORLD_PICTURES = ["cgw", "mgw", "wgw", "kgw", "hgw", "ggw", "tgw", "agw", "vgw", "sgw"];
  const mosaic = () => `<div class="gwh2-art gwh2-mosaic" aria-hidden="true">${WORLD_PICTURES.map(w => `<img src="/hub-${w}.jpg" alt="" width="700" height="420" loading="lazy" decoding="async">`).join("")}</div>`;
  const artFor = c => ART[c.art] || mosaic();

  window.GearWorldHubV2 = { art: ART, artFor, locales: LOCALES, strings: T, sameAsEnglish: SAME_AS_ENGLISH, campaigns: CAMPAIGNS, fallbackCampaign: FALLBACK_CAMPAIGN, gifts: GIFTS, budgets: BUDGETS, popular: POPULAR, activeCampaigns, activeDeals, giftSearchUrl, ukToday };

  // ------------------------------------------------------------ page
  const $ = (selector, root) => (root || document).querySelector(selector);

  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function money(amount, currency) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "";
    const whole = Math.round(n) === n;
    try {
      return new Intl.NumberFormat(locale(), { style: "currency", currency: String(currency || "GBP").toUpperCase(), minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(n);
    } catch (_) {
      return `£${whole ? n : n.toFixed(2)}`;
    }
  }

  function longDate(day) {
    try {
      return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date(`${day}T12:00:00Z`));
    } catch (_) {
      return day;
    }
  }

  const reduceMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const cameraButton = () => document.querySelector(".gw-photo-v1-button");

  function scrollToSearch() {
    const form = document.getElementById("hubSearch");
    if (!form) return;
    const top = form.getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion() ? "auto" : "smooth" });
  }

  function runSearch(query) {
    const form = document.getElementById("hubSearch");
    const input = document.getElementById("hubSearchInput");
    if (!form || !input) return;
    input.value = query;
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.dispatchEvent(new Event("submit", { cancelable: true }));
  }

  function applyTexts() {
    document.querySelectorAll("[data-gwh2]").forEach(el => { el.textContent = tx(el.getAttribute("data-gwh2")); });
    document.querySelectorAll("[data-gwh2-aria]").forEach(el => { el.setAttribute("aria-label", tx(el.getAttribute("data-gwh2-aria"))); });
  }

  // ---------- popular searches
  function renderPopular() {
    const box = document.getElementById("gwh2Popular");
    if (!box) return;
    box.innerHTML = POPULAR.map(([label, q]) => `<button type="button" class="gwh2-chip" data-q="${esc(q)}">${esc(tx(label))}</button>`).join("");
  }

  // ---------- campaigns
  let slide = 0;
  function renderCampaigns() {
    const box = document.getElementById("gwh2Campaigns");
    if (!box) return;
    const list = activeCampaigns();
    if (slide >= list.length) slide = 0;
    const c = list[slide];
    const external = /^https:\/\//.test(c.href);
    const title = c.title ? tx(c.title) : c.titleText;
    const many = list.length > 1;
    box.innerHTML = `
      <div class="gwh2-slide" data-campaign="${esc(c.id)}">
        ${artFor(c)}
        <div class="gwh2-slide-body">
          <span class="gwh2-eyebrow">${esc(tx(c.eyebrow))}</span>
          <strong class="gwh2-slide-title">${esc(title)}</strong>
          <span class="gwh2-slide-text">${esc(tx(c.text))}</span>
          <div class="gwh2-slide-foot">
            <a class="gwh2-btn" href="${esc(c.href)}"${external ? "" : ` data-gwh2-jump="${esc(c.href)}"`}>${esc(tx(c.cta))}</a>
            ${many ? `<div class="gwh2-slide-nav">
              <button type="button" class="gwh2-round" data-gwh2-slide="-1" aria-label="${esc(tx("prev"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
              <span class="gwh2-slide-count" aria-live="polite" aria-label="${esc(tx("slideAria", { n: slide + 1, total: list.length }))}">${slide + 1} / ${list.length}</span>
              <button type="button" class="gwh2-round" data-gwh2-slide="1" aria-label="${esc(tx("next"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
            </div>` : ""}
          </div>
        </div>
      </div>`;
  }

  // ---------- deals
  let deals = [];
  function renderDeals() {
    const section = document.getElementById("deals");
    const box = document.getElementById("gwh2Deals");
    if (!section || !box) return;
    const list = activeDeals(deals).slice(0, DEALS_SHOWN);
    section.hidden = list.length === 0;
    const navLink = document.querySelector('.main-nav a[href="#deals"]');
    if (navLink) navLink.hidden = list.length === 0;
    box.innerHTML = list.map(d => {
      const offer = d.kind === "code"
        ? (Number(d.minSpend) > 0 ? tx("dealCode", { off: money(d.off, d.currency), min: money(d.minSpend, d.currency) }) : tx("dealCodeNoMin", { off: money(d.off, d.currency) }))
        : tx("dealUpTo", { pct: Number(d.upTo) });
      const worlds = (Array.isArray(d.sites) ? d.sites : []).filter(s => /^[A-Z]{3}$/.test(s)).join(" · ");
      return `
        <a class="gwh2-deal" href="${esc(d.link)}">
          <span class="gwh2-deal-top"><span class="gwh2-deal-shop">${esc(d.retailer)}</span><span class="gwh2-deal-end">${esc(tx("dealUntil", { date: longDate(d.end) }))}</span></span>
          <strong class="gwh2-deal-offer">${esc(offer)}</strong>
          <span class="gwh2-deal-meta">${esc(d.kind === "code" ? tx("dealWithCode") : tx("dealSale"))} · ${esc(d.campaign || "")}</span>
          <span class="gwh2-deal-worlds">${esc(worlds)}</span>
          <span class="gwh2-deal-cta">${esc(tx("dealCta"))} →</span>
        </a>`;
    }).join("");
  }

  function loadDeals() {
    if (typeof window.fetch !== "function") return;
    fetch("/hub-deals.json", { headers: { Accept: "application/json" }, cache: "no-cache" })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { deals = data && Array.isArray(data.deals) ? data.deals : []; renderDeals(); })
      .catch(() => { deals = []; renderDeals(); });
  }

  // ---------- gift finder
  const gift = { who: 0, idea: 0, budget: 1, busy: false, last: null };

  function giftChip(attr, value, label, pressed) {
    return `<button type="button" class="gwh2-chip" ${attr}="${value}" aria-pressed="${pressed ? "true" : "false"}">${esc(label)}</button>`;
  }

  function budgetLabel(b) {
    return b > 0 ? tx("giftUpTo", { price: money(b, "GBP") }) : tx("giftAny");
  }

  function renderGift() {
    const who = document.getElementById("gwh2Who");
    const budget = document.getElementById("gwh2Budget");
    const ideas = document.getElementById("gwh2Ideas");
    if (!who || !budget || !ideas) return;
    who.innerHTML = GIFTS.map((g, i) => giftChip("data-gwh2-who", i, tx(g.label), i === gift.who)).join("");
    budget.innerHTML = BUDGETS.map((b, i) => giftChip("data-gwh2-budget", i, budgetLabel(b), i === gift.budget)).join("");
    ideas.innerHTML = GIFTS[gift.who].ideas.map((idea, i) => giftChip("data-gwh2-idea", i, tx(idea[0]), i === gift.idea)).join("");
    if (gift.last) showGiftResults(gift.last);
  }

  function productCard(p) {
    const url = /^https:\/\//.test(String(p.product_url || "")) ? p.product_url : "";
    if (!url) return "";
    const img = /^https:\/\//.test(String(p.image_url || ""))
      ? `<img class="gwh-search-image" src="${esc(p.image_url)}" alt="${esc(p.product_name)}" loading="lazy">`
      : `<div class="gwh-search-image-placeholder">${esc(window.GWH_t ? window.GWH_t("noImage") : "No image")}</div>`;
    const code = /^[a-z]{3}$/i.test(String(p.site || "")) ? String(p.site).toUpperCase() : "GEAR WORLD";
    const meta = [p.brand, p.retailer].filter(Boolean).map(esc).join(" · ");
    const view = window.GWH_t ? window.GWH_t("viewProduct") : "View product";
    return `
      <a class="gwh-search-item" href="${esc(url)}">
        ${img}
        <div class="gwh-search-details"><span class="gwh-search-source">${esc(code)}</span><div class="gwh-search-name">${esc(p.product_name)}</div><div class="gwh-search-meta">${meta}</div></div>
        <div class="gwh-search-price">${esc(money(p.price, p.currency))}<span class="gwh-search-view">${esc(view)} →</span></div>
      </a>`;
  }

  function showGiftResults(state) {
    const box = document.getElementById("gwh2GiftResults");
    if (!box) return;
    box.hidden = false;
    if (state.kind === "busy") { box.innerHTML = `<div class="gwh-search-loading">${esc(tx("giftSearching"))}</div>`; return; }
    if (state.kind === "error") { box.innerHTML = `<div class="gwh-search-error">${esc(tx("giftError"))}</div>`; return; }
    const cards = state.results.map(productCard).filter(Boolean).slice(0, 8);
    if (!cards.length) { box.innerHTML = `<div class="gwh-search-empty">${esc(tx("giftNone"))}</div>`; return; }
    const idea = GIFTS[state.who].ideas[state.idea];
    box.innerHTML = `<div class="gwh-search-summary">${esc(tx("giftFound", { count: cards.length, idea: tx(idea[0]), budget: budgetLabel(BUDGETS[state.budget]) }))}</div>${cards.join("")}`;
  }

  async function runGift() {
    if (gift.busy || typeof window.fetch !== "function") return;
    const idea = GIFTS[gift.who].ideas[gift.idea];
    const state = { who: gift.who, idea: gift.idea, budget: gift.budget };
    gift.busy = true;
    gift.last = { ...state, kind: "busy" };
    showGiftResults(gift.last);
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 20000) : null;
    try {
      const r = await fetch(giftSearchUrl(idea, BUDGETS[gift.budget]), { headers: { Accept: "application/json" }, signal: controller ? controller.signal : undefined });
      const data = r.ok ? await r.json() : null;
      if (!data || !data.ok) throw new Error("gift search failed");
      gift.last = { ...state, kind: "results", results: Array.isArray(data.results) ? data.results : [] };
    } catch (_) {
      gift.last = { ...state, kind: "error" };
    } finally {
      if (timer) clearTimeout(timer);
      gift.busy = false;
    }
    showGiftResults(gift.last);
  }

  // ---------- photo buttons (they press the camera button of gear-world-camera.js)
  function setupPhoto() {
    const big = document.getElementById("gwh2Photo");
    const dockPhoto = document.getElementById("gwh2DockPhoto");
    const show = () => {
      const ready = !!cameraButton();
      const form = document.getElementById("hubSearch");
      if (form) form.classList.toggle("gwh2-has-photo", ready);
      if (big) big.hidden = !ready;
      if (dockPhoto) dockPhoto.hidden = !ready;
      return ready;
    };
    if (!show()) {
      // The camera script may add its button a moment later; without it (old browser) the buttons stay hidden.
      const form = document.getElementById("hubSearch");
      if (form && typeof MutationObserver === "function") {
        const mo = new MutationObserver(() => { if (show()) mo.disconnect(); });
        mo.observe(form, { childList: true, subtree: true });
        setTimeout(() => mo.disconnect(), 10000);
      }
    }
    const press = () => { const b = cameraButton(); if (b && !b.disabled) b.click(); };
    if (big) big.addEventListener("click", press);
    if (dockPhoto) dockPhoto.addEventListener("click", () => { press(); scrollToSearch(); });
  }

  // ---------- phone dock: the search at the bottom when the search at the top is out of sight. It hides while the
  // cookie notice is open, while results are open, while the camera works and while someone types (keyboard open).
  function setupDock() {
    const dock = document.getElementById("gwh2Dock");
    const form = document.getElementById("hubSearch");
    if (!dock || !form || typeof IntersectionObserver !== "function") return;
    let searchInSight = true;
    const consent = document.getElementById("gwhAnalyticsConsent");
    const update = () => {
      const panel = document.getElementById("hubSearchResults");
      const cam = cameraButton();
      const active = document.activeElement;
      const typing = !!(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
      const blocked = (consent && !consent.hidden) || (panel && panel.classList.contains("is-open")) ||
        (cam && cam.getAttribute("aria-busy") === "true") || typing;
      const on = !searchInSight && !blocked;
      dock.hidden = !on;
      document.body.classList.toggle("gwh2-dock-on", on);
    };
    new IntersectionObserver(entries => {
      searchInSight = entries.some(e => e.isIntersecting);
      update();
    }).observe(form);
    if (typeof MutationObserver === "function") {
      const mo = new MutationObserver(update);
      if (consent) mo.observe(consent, { attributes: true, attributeFilter: ["hidden"] });
      mo.observe(form, { attributes: true, subtree: true, attributeFilter: ["class", "aria-busy"] });
    }
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", () => setTimeout(update, 0));
    const go = document.getElementById("gwh2DockSearch");
    if (go) go.addEventListener("click", () => {
      scrollToSearch();
      const input = document.getElementById("hubSearchInput");
      if (input) { try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); } }
    });
    update();
  }

  function onClick(event) {
    const t = event.target;
    if (!t || !t.closest) return;
    const chip = t.closest("#gwh2Popular [data-q]");
    if (chip) { runSearch(chip.getAttribute("data-q")); return; }
    const move = t.closest("[data-gwh2-slide]");
    if (move) {
      const n = activeCampaigns().length;
      slide = (slide + Number(move.getAttribute("data-gwh2-slide")) + n) % n;
      renderCampaigns();
      const again = document.querySelector(`[data-gwh2-slide="${move.getAttribute("data-gwh2-slide")}"]`);
      if (again) again.focus();
      return;
    }
    const jump = t.closest("[data-gwh2-jump]");
    if (jump) {
      // Black Friday without any deal running: the button goes to the e-mail sign-up instead.
      let target = jump.getAttribute("data-gwh2-jump");
      const deal = document.getElementById("deals");
      if (target === "#deals" && (!deal || deal.hidden)) target = "#newsletter";
      const el = document.querySelector(target);
      if (el) {
        event.preventDefault();
        el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
      }
      return;
    }
    const who = t.closest("[data-gwh2-who]");
    if (who) { gift.who = Number(who.getAttribute("data-gwh2-who")); gift.idea = 0; gift.last = null; renderGift(); hideGiftResults(); return; }
    const budget = t.closest("[data-gwh2-budget]");
    if (budget) { gift.budget = Number(budget.getAttribute("data-gwh2-budget")); renderGift(); if (gift.last && gift.last.kind !== "busy") runGift(); return; }
    const idea = t.closest("[data-gwh2-idea]");
    if (idea) { gift.idea = Number(idea.getAttribute("data-gwh2-idea")); renderGift(); runGift(); return; }
    if (t.closest("#gwh2GiftGo")) runGift();
  }

  function hideGiftResults() {
    const box = document.getElementById("gwh2GiftResults");
    if (box) { box.hidden = true; box.innerHTML = ""; }
  }

  function renderAll() {
    applyTexts();
    renderPopular();
    renderCampaigns();
    renderDeals();
    renderGift();
  }

  function init() {
    if (!document.body || !document.getElementById("gwh2Campaigns")) return;
    renderAll();
    loadDeals();
    setupPhoto();
    setupDock();
    document.addEventListener("click", onClick);
    window.addEventListener("gwh-language-change", () => setTimeout(renderAll, 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
