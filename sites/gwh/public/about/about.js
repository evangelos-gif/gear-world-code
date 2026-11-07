// Gear World Hub - /about/ in the language the visitor chose on the Hub (localStorage "gwh-language", set by
// translations.js). Google Ads review, 7/11/2026 (lessons L101). The English text is in the page itself.
(function () {
  "use strict";
  var LOCALES = ["en-GB", "el-GR", "de-DE", "fr-FR", "it-IT", "es-ES", "pt-PT", "nl-NL", "sq-AL", "ro-RO", "ru-RU"];
  var T = {
    home: ["Home", "Αρχική", "Startseite", "Accueil", "Home", "Inicio", "Início", "Home", "Kreu", "Acasă", "Главная"],
    crumb: ["About", "Σχετικά", "Über uns", "À propos", "Chi siamo", "Acerca de", "Sobre", "Over ons", "Rreth nesh", "Despre", "О нас"],
    title: ["About Gear World", "Σχετικά με το Gear World", "Über Gear World", "À propos de Gear World", "Chi è Gear World", "Acerca de Gear World", "Sobre a Gear World", "Over Gear World", "Rreth Gear World", "Despre Gear World", "О Gear World"],
    lead: [
      "Gear World is a product search and price-comparison network run by Evangelos Kalogerakis in England. We do not sell products, take payments or handle deliveries. Every product links to the retailer that sells it, and we may earn a commission through the Awin and CJ affiliate networks.",
      "Το Gear World είναι ένα δίκτυο αναζήτησης προϊόντων και σύγκρισης τιμών, που το διαχειρίζεται ο Evangelos Kalogerakis στην Αγγλία. Δεν πουλάμε προϊόντα, δεν δεχόμαστε πληρωμές και δεν κάνουμε παραδόσεις. Κάθε προϊόν οδηγεί στο κατάστημα που το πουλά, και μπορεί να κερδίσουμε προμήθεια μέσω των δικτύων συνεργατών Awin και CJ.",
      "Gear World ist ein Netzwerk für Produktsuche und Preisvergleich, betrieben von Evangelos Kalogerakis in England. Wir verkaufen keine Produkte, nehmen keine Zahlungen an und liefern nicht. Jedes Produkt verlinkt auf den Händler, der es verkauft, und wir erhalten möglicherweise eine Provision über die Affiliate-Netzwerke Awin und CJ.",
      "Gear World est un réseau de recherche de produits et de comparaison de prix géré par Evangelos Kalogerakis en Angleterre. Nous ne vendons pas de produits, n'encaissons pas de paiements et ne livrons pas. Chaque produit renvoie vers le marchand qui le vend, et nous pouvons percevoir une commission via les réseaux d'affiliation Awin et CJ.",
      "Gear World è una rete di ricerca prodotti e confronto prezzi gestita da Evangelos Kalogerakis in Inghilterra. Non vendiamo prodotti, non riceviamo pagamenti e non effettuiamo consegne. Ogni prodotto rimanda al negozio che lo vende, e possiamo ricevere una commissione tramite le reti di affiliazione Awin e CJ.",
      "Gear World es una red de búsqueda de productos y comparación de precios gestionada por Evangelos Kalogerakis en Inglaterra. No vendemos productos, no cobramos pagos ni hacemos envíos. Cada producto enlaza con la tienda que lo vende, y podemos ganar una comisión a través de las redes de afiliados Awin y CJ.",
      "A Gear World é uma rede de pesquisa de produtos e comparação de preços gerida por Evangelos Kalogerakis em Inglaterra. Não vendemos produtos, não recebemos pagamentos nem fazemos entregas. Cada produto leva à loja que o vende, e podemos receber uma comissão através das redes de afiliados Awin e CJ.",
      "Gear World is een netwerk voor productzoeken en prijsvergelijking, gerund door Evangelos Kalogerakis in Engeland. We verkopen geen producten, nemen geen betalingen aan en leveren niets. Elk product linkt naar de winkel die het verkoopt, en we kunnen een commissie verdienen via de affiliatenetwerken Awin en CJ.",
      "Gear World është një rrjet për kërkimin e produkteve dhe krahasimin e çmimeve, që drejtohet nga Evangelos Kalogerakis në Angli. Nuk shesim produkte, nuk marrim pagesa dhe nuk bëjmë dërgesa. Çdo produkt të çon te dyqani që e shet, dhe mund të fitojmë një komision përmes rrjeteve të bashkëpunimit Awin dhe CJ.",
      "Gear World este o rețea de căutare de produse și comparare a prețurilor, administrată de Evangelos Kalogerakis în Anglia. Nu vindem produse, nu încasăm plăți și nu facem livrări. Fiecare produs duce la magazinul care îl vinde, iar noi putem primi un comision prin rețelele de afiliere Awin și CJ.",
      "Gear World — сеть поиска товаров и сравнения цен, которой управляет Evangelos Kalogerakis в Англии. Мы не продаём товары, не принимаем платежи и не занимаемся доставкой. Каждый товар ведёт на сайт магазина, который его продаёт, и мы можем получать комиссию через партнёрские сети Awin и CJ."
    ],
    contact: ["Contact:", "Επικοινωνία:", "Kontakt:", "Contact :", "Contatti:", "Contacto:", "Contacto:", "Contact:", "Kontakt:", "Contact:", "Контакт:"]
  };
  var lang = "en-GB";
  try { lang = localStorage.getItem("gwh-language") || "en-GB"; } catch (e) { lang = "en-GB"; }
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
