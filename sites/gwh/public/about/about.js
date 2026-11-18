// Gear World Hub - /about/ in the language the visitor chose on the Hub (localStorage "gwh-language", set by
// translations.js). Google Ads review, 7/11/2026 (lessons L101). The English text is in the page itself.
// Owner's decision, 7/11/2026: "Run by Evangelos Kalogerakis, United Kingdom" and the email, no address.
(function () {
  "use strict";
  var LOCALES = ["en-GB", "el-GR", "de-DE", "fr-FR", "it-IT", "es-ES", "pt-PT", "nl-NL", "sq-AL", "ro-RO", "ru-RU"];
  var T = {
    home: ["Home", "Αρχική", "Startseite", "Accueil", "Home", "Inicio", "Início", "Home", "Kreu", "Acasă", "Главная"],
    crumb: ["About", "Σχετικά", "Über uns", "À propos", "Chi siamo", "Acerca de", "Sobre", "Over ons", "Rreth nesh", "Despre", "О нас"],
    title: ["About Gear World", "Σχετικά με το Gear World", "Über Gear World", "À propos de Gear World", "Chi è Gear World", "Acerca de Gear World", "Sobre a Gear World", "Over Gear World", "Rreth Gear World", "Despre Gear World", "О Gear World"],
    lead: [
      "Gear World is a network of independent product search and price-comparison sites from the same publisher. We do not sell products, take payments or handle deliveries. Every product links to the retailer that sells it, and we may earn a commission through the Awin and CJ affiliate networks, and through Sovrn Commerce for the \"Featured pick\" card on the Hub.",
      "Το Gear World είναι ένα δίκτυο ανεξάρτητων sites αναζήτησης προϊόντων και σύγκρισης τιμών του ίδιου εκδότη. Δεν πουλάμε προϊόντα, δεν δεχόμαστε πληρωμές και δεν κάνουμε παραδόσεις. Κάθε προϊόν οδηγεί στο κατάστημα που το πουλά, και μπορεί να κερδίσουμε προμήθεια μέσω των δικτύων affiliate Awin και CJ, και μέσω του Sovrn Commerce για την κάρτα «Προτεινόμενο προϊόν» του Hub.",
      "Gear World ist ein Netzwerk unabhängiger Seiten für Produktsuche und Preisvergleich desselben Herausgebers. Wir verkaufen keine Produkte, nehmen keine Zahlungen an und liefern nicht. Jedes Produkt verlinkt auf den Händler, der es verkauft, und wir erhalten möglicherweise eine Provision über die Affiliate-Netzwerke Awin und CJ sowie über Sovrn Commerce für die Karte „Empfohlenes Produkt“ im Hub.",
      "Gear World est un réseau de sites indépendants de recherche de produits et de comparaison de prix, du même éditeur. Nous ne vendons pas de produits, n'encaissons pas de paiements et ne livrons pas. Chaque produit renvoie vers le marchand qui le vend, et nous pouvons percevoir une commission via les réseaux d'affiliation Awin et CJ, et via Sovrn Commerce pour la carte « Produit à la une » du Hub.",
      "Gear World è una rete di siti indipendenti di ricerca prodotti e confronto prezzi dello stesso editore. Non vendiamo prodotti, non riceviamo pagamenti e non effettuiamo consegne. Ogni prodotto rimanda al negozio che lo vende, e possiamo ricevere una commissione tramite le reti di affiliazione Awin e CJ, e tramite Sovrn Commerce per la scheda «Prodotto in evidenza» dell'Hub.",
      "Gear World es una red de sitios independientes de búsqueda de productos y comparación de precios del mismo editor. No vendemos productos, no aceptamos pagos ni hacemos envíos. Cada producto enlaza con la tienda que lo vende, y podemos ganar una comisión a través de las redes de afiliados Awin y CJ, y a través de Sovrn Commerce para la tarjeta «Producto destacado» del Hub.",
      "A Gear World é uma rede de sites independentes de pesquisa de produtos e comparação de preços do mesmo editor. Não vendemos produtos, não recebemos pagamentos nem fazemos entregas. Cada produto leva à loja que o vende, e podemos receber uma comissão através das redes de afiliados Awin e CJ, e através da Sovrn Commerce para o cartão «Produto em destaque» do Hub.",
      "Gear World is een netwerk van onafhankelijke sites voor productzoeken en prijsvergelijking van dezelfde uitgever. We verkopen geen producten, nemen geen betalingen aan en leveren niets. Elk product linkt naar de winkel die het verkoopt, en we kunnen een commissie verdienen via de affiliatenetwerken Awin en CJ, en via Sovrn Commerce voor de kaart ‘Uitgelicht product’ op de Hub.",
      "Gear World është një rrjet faqesh të pavarura për kërkimin e produkteve dhe krahasimin e çmimeve, nga i njëjti botues. Nuk shesim produkte, nuk marrim pagesa dhe nuk bëjmë dërgesa. Çdo produkt të çon te dyqani që e shet, dhe mund të fitojmë një komision përmes rrjeteve të afiliimit Awin dhe CJ, dhe përmes Sovrn Commerce për kartën «Produkt i zgjedhur» në Hub.",
      "Gear World este o rețea de site-uri independente de căutare de produse și comparare a prețurilor, ale aceluiași editor. Nu vindem produse, nu încasăm plăți și nu facem livrări. Fiecare produs duce la magazinul care îl vinde, iar noi putem primi un comision prin rețelele de afiliere Awin și CJ, și prin Sovrn Commerce pentru cardul „Produs recomandat” de pe Hub.",
      "Gear World — сеть независимых сайтов поиска товаров и сравнения цен одного издателя. Мы не продаём товары, не принимаем платежи и не занимаемся доставкой. Каждый товар ведёт на сайт магазина, который его продаёт, и мы можем получать комиссию через партнёрские сети Awin и CJ, а также через Sovrn Commerce — по ссылке в карточке «Рекомендуемый товар» в Hub."
    ],
    run: ["Run by Evangelos Kalogerakis, United Kingdom", "Διαχείριση: Evangelos Kalogerakis, Ηνωμένο Βασίλειο", "Betrieben von Evangelos Kalogerakis, Vereinigtes Königreich", "Géré par Evangelos Kalogerakis, Royaume-Uni", "Gestito da Evangelos Kalogerakis, Regno Unito", "Gestionado por Evangelos Kalogerakis, Reino Unido", "Gerido por Evangelos Kalogerakis, Reino Unido", "Gerund door Evangelos Kalogerakis, Verenigd Koninkrijk", "Drejtohet nga Evangelos Kalogerakis, Mbretëria e Bashkuar", "Administrat de Evangelos Kalogerakis, Regatul Unit", "Управляет Evangelos Kalogerakis, Великобритания"],
    contact: ["Contact:", "Επικοινωνία:", "Kontakt:", "Contact :", "Contatti:", "Contacto:", "Contacto:", "Contact:", "Kontakt:", "Contact:", "Контакт:"]
  };
  // The visitor's own choice, then the language of their country (L175, <html data-country-lang> from the Worker),
  // then English; a saved English counts as a choice only with the mark of the menu (see translations.js).
  var lang = "";
  var chosen = false;
  try { lang = localStorage.getItem("gwh-language") || ""; chosen = localStorage.getItem("gwh-language-chosen") === "1"; } catch (e) { lang = ""; }
  if (LOCALES.indexOf(lang) < 0 || (lang === "en-GB" && !chosen)) {
    var byCountry = document.documentElement.getAttribute("data-country-lang") || "";
    lang = LOCALES.indexOf(byCountry) >= 0 ? byCountry : "en-GB";
  }
  var i = LOCALES.indexOf(lang);
  if (i <= 0) return;
  document.documentElement.lang = lang;
  var els = document.querySelectorAll("[data-about]");
  for (var n = 0; n < els.length; n++) {
    var row = T[els[n].getAttribute("data-about")];
    if (row && row[i]) els[n].textContent = row[i];
  }
  if (T.title[i]) document.title = T.title[i] + " | Gear World Hub";
})();
