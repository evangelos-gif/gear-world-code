// Gear World Hub - /barcode/ (lessons L115, 10/11/2026): the numbers under a barcode, looked up exactly on every Gear
// World through /api/barcode, the same answer the Gear World app gets ("Scan barcode"). In the language the visitor chose
// on the Hub (localStorage "gwh-language", set by translations.js), the Hub's 11 languages. The words for the stock and
// the button are the sites' own ("View at <retailer>", "Check price and stock at the retailer"); the retailer and the
// barcode are never translated. Every card links to the product page on its own Gear World site (the Hub has no
// affiliate links, lessons L103), which says who sells it and has the button to the retailer. No model, no cookies.
(function () {
  "use strict";
  var LOCALES = ["en-GB","el-GR","de-DE","fr-FR","it-IT","es-ES","pt-PT","nl-NL","sq-AL","ro-RO","ru-RU"];
  var T = {
    home: ["Home","Αρχική","Startseite","Accueil","Home","Inicio","Início","Home","Kreu","Acasă","Главная"],
    title: ["Barcode search","Αναζήτηση με barcode","Barcode-Suche","Recherche par code-barres","Ricerca per codice a barre","Búsqueda por código de barras","Pesquisa por código de barras","Zoeken op barcode","Kërkim me barkod","Căutare după cod de bare","Поиск по штрихкоду"],
    lead: ["Type the numbers under a barcode (EAN, UPC or GTIN) to find that exact product on every Gear World.","Γράψτε τους αριθμούς κάτω από ένα barcode (EAN, UPC ή GTIN) για να βρείτε ακριβώς αυτό το προϊόν σε κάθε Gear World.","Geben Sie die Zahlen unter einem Barcode (EAN, UPC oder GTIN) ein, um genau dieses Produkt in jeder Gear World zu finden.","Saisissez les chiffres sous un code-barres (EAN, UPC ou GTIN) pour trouver ce produit précis dans chaque Gear World.","Scrivi i numeri sotto un codice a barre (EAN, UPC o GTIN) per trovare esattamente quel prodotto in ogni Gear World.","Escribe los números que hay bajo un código de barras (EAN, UPC o GTIN) para encontrar ese producto exacto en cada Gear World.","Escreva os números por baixo de um código de barras (EAN, UPC ou GTIN) para encontrar exatamente esse produto em cada Gear World.","Voer de cijfers onder een barcode (EAN, UPC of GTIN) in om precies dat product in elke Gear World te vinden.","Shkruani numrat nën një barkod (EAN, UPC ose GTIN) për të gjetur pikërisht atë produkt në çdo Gear World.","Introduceți cifrele de sub un cod de bare (EAN, UPC sau GTIN) pentru a găsi exact acel produs în fiecare Gear World.","Введите цифры под штрихкодом (EAN, UPC или GTIN), чтобы найти именно этот товар во всех Gear World."],
    label: ["Barcode number","Αριθμός barcode","Barcode-Nummer","Numéro du code-barres","Numero del codice a barre","Número del código de barras","Número do código de barras","Barcodenummer","Numri i barkodit","Numărul codului de bare","Номер штрихкода"],
    search: ["Search","Αναζήτηση","Suchen","Rechercher","Cerca","Buscar","Pesquisar","Zoeken","Kërko","Caută","Найти"],
    searching: ["Searching all Gear Worlds...","Αναζήτηση σε όλα τα Gear Worlds...","Alle Gear Worlds werden durchsucht...","Recherche dans tous les Gear Worlds...","Ricerca in tutti i Gear Worlds...","Buscando en todos los Gear Worlds...","A pesquisar em todos os Gear Worlds...","Alle Gear Worlds doorzoeken...","Po kërkohet në të gjitha Gear Worlds...","Se caută în toate Gear Worlds...","Поиск во всех Gear Worlds..."],
    found: ["{count} results for barcode {code}","{count} αποτελέσματα για το barcode {code}","{count} Ergebnisse für den Barcode {code}","{count} résultats pour le code-barres {code}","{count} risultati per il codice a barre {code}","{count} resultados para el código de barras {code}","{count} resultados para o código de barras {code}","{count} resultaten voor barcode {code}","{count} rezultate për barkodin {code}","{count} rezultate pentru codul de bare {code}","Результатов по штрихкоду {code}: {count}"],
    foundOne: ["1 result for barcode {code}","1 αποτέλεσμα για το barcode {code}","1 Ergebnis für den Barcode {code}","1 résultat pour le code-barres {code}","1 risultato per il codice a barre {code}","1 resultado para el código de barras {code}","1 resultado para o código de barras {code}","1 resultaat voor barcode {code}","1 rezultat për barkodin {code}","1 rezultat pentru codul de bare {code}","Результатов по штрихкоду {code}: 1"],
    none: ["No Gear World lists this barcode yet.","Κανένα Gear World δεν έχει ακόμα αυτό το barcode.","Noch keine Gear World führt diesen Barcode.","Aucune Gear World ne référence encore ce code-barres.","Nessun Gear World ha ancora questo codice a barre.","Ningún Gear World tiene todavía este código de barras.","Nenhuma Gear World tem ainda este código de barras.","Nog geen enkele Gear World heeft deze barcode.","Asnjë Gear World nuk e ka ende këtë barkod.","Niciun Gear World nu are încă acest cod de bare.","Этого штрихкода пока нет ни в одном Gear World."],
    invalid: ["This is not a valid barcode number. Check the 8, 12, 13 or 14 digits.","Αυτός δεν είναι έγκυρος αριθμός barcode. Ελέγξτε τα 8, 12, 13 ή 14 ψηφία.","Das ist keine gültige Barcode-Nummer. Prüfen Sie die 8, 12, 13 oder 14 Ziffern.","Ce n'est pas un numéro de code-barres valide. Vérifiez les 8, 12, 13 ou 14 chiffres.","Questo non è un numero di codice a barre valido. Controlla le 8, 12, 13 o 14 cifre.","Este no es un número de código de barras válido. Comprueba los 8, 12, 13 o 14 dígitos.","Este não é um número de código de barras válido. Confirme os 8, 12, 13 ou 14 dígitos.","Dit is geen geldig barcodenummer. Controleer de 8, 12, 13 of 14 cijfers.","Ky nuk është një numër i vlefshëm barkodi. Kontrolloni 8, 12, 13 ose 14 shifrat.","Acesta nu este un număr valid de cod de bare. Verificați cele 8, 12, 13 sau 14 cifre.","Это неверный номер штрихкода. Проверьте 8, 12, 13 или 14 цифр."],
    error: ["Something went wrong. Please try again.","Κάτι πήγε στραβά. Δοκιμάστε ξανά.","Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.","Une erreur s'est produite. Veuillez réessayer.","Qualcosa è andato storto. Riprova.","Algo ha salido mal. Inténtalo de nuevo.","Algo correu mal. Tente novamente.","Er ging iets mis. Probeer het opnieuw.","Diçka shkoi keq. Provoni përsëri.","Ceva nu a mers bine. Încercați din nou.","Что-то пошло не так. Попробуйте ещё раз."],
    partial: ["Some Gear Worlds did not answer in time, so the list may be incomplete.","Κάποια Gear Worlds δεν απάντησαν εγκαίρως, οπότε η λίστα μπορεί να μην είναι πλήρης.","Einige Gear Worlds haben nicht rechtzeitig geantwortet, die Liste ist daher vielleicht unvollständig.","Certains Gear Worlds n'ont pas répondu à temps : la liste peut être incomplète.","Alcuni Gear World non hanno risposto in tempo, quindi l'elenco potrebbe essere incompleto.","Algunos Gear Worlds no respondieron a tiempo, así que la lista puede estar incompleta.","Algumas Gear Worlds não responderam a tempo, por isso a lista pode estar incompleta.","Sommige Gear Worlds antwoordden niet op tijd, dus de lijst is misschien niet volledig.","Disa Gear Worlds nuk u përgjigjën në kohë, ndaj lista mund të jetë e paplotë.","Unele Gear Worlds nu au răspuns la timp, așa că lista poate fi incompletă.","Некоторые Gear World не ответили вовремя, поэтому список может быть неполным."],
    viewAt: ["View at {0}","Δείτε το στο {0}","Bei {0} ansehen","Voir chez {0}","Vedi su {0}","Ver en {0}","Ver na {0}","Bekijk bij {0}","Shiko te {0}","Vezi la {0}","Смотреть в {0}"],
    checkRetailer: ["Check price and stock at the retailer","Ελέγξτε τιμή και διαθεσιμότητα στο κατάστημα","Preis und Verfügbarkeit beim Händler prüfen","Vérifiez le prix et le stock chez le marchand","Controlla prezzo e disponibilità presso il negozio","Comprueba el precio y la disponibilidad en la tienda","Confirme o preço e o stock na loja","Controleer prijs en voorraad bij de winkel","Kontrolloni çmimin dhe gjendjen te dyqani","Verifică prețul și stocul la magazin","Проверьте цену и наличие в магазине"],
    outOfStock: ["Out of stock","Μη διαθέσιμο","Nicht auf Lager","Rupture de stock","Non disponibile","Agotado","Esgotado","Niet op voorraad","Jashtë gjendjes","Stoc epuizat","Нет в наличии"],
    inStock: ["In stock","Διαθέσιμο","Auf Lager","En stock","Disponibile","En stock","Em stock","Op voorraad","Në gjendje","În stoc","В наличии"],
    retailers: ["{0} retailers","{0} καταστήματα","{0} Händler","{0} marchands","{0} negozi","{0} tiendas","{0} lojas","{0} winkels","{0} dyqane","{0} magazine","Магазинов: {0}"],
    noImage: ["No image","Χωρίς εικόνα","Kein Bild","Pas d'image","Nessuna immagine","Sin imagen","Sem imagem","Geen afbeelding","Pa imazh","Fără imagine","Нет изображения"],
    countryBar: ["We're adding retailers for your country. Most retailers below deliver to the UK only. Check delivery before you buy.","Προσθέτουμε καταστήματα για τη χώρα σας. Τα περισσότερα καταστήματα πιο κάτω παραδίδουν μόνο στο Ηνωμένο Βασίλειο. Ελέγξτε την αποστολή πριν αγοράσετε.","Wir nehmen gerade Händler für Ihr Land auf. Die meisten Händler unten liefern nur ins Vereinigte Königreich. Prüfen Sie die Lieferung vor dem Kauf.","Nous ajoutons des marchands pour votre pays. La plupart des marchands ci-dessous ne livrent qu’au Royaume-Uni. Vérifiez la livraison avant d’acheter.","Stiamo aggiungendo negozi per il tuo paese. La maggior parte dei negozi qui sotto spedisce solo nel Regno Unito. Controlla la consegna prima di acquistare.","Estamos añadiendo tiendas para tu país. La mayoría de las tiendas de abajo solo envían al Reino Unido. Comprueba el envío antes de comprar.","Estamos a adicionar lojas para o seu país. A maioria das lojas abaixo só envia para o Reino Unido. Confirme a entrega antes de comprar.","We voegen winkels voor jouw land toe. De meeste winkels hieronder leveren alleen in het Verenigd Koninkrijk. Controleer de levering voordat je koopt.","Po shtojmë dyqane për vendin tuaj. Shumica e dyqaneve më poshtë dërgojnë vetëm në Mbretërinë e Bashkuar. Kontrolloni dërgesën para se të blini.","Adăugăm magazine pentru țara ta. Majoritatea magazinelor de mai jos livrează doar în Regatul Unit. Verifică livrarea înainte să cumperi.","Мы добавляем магазины для вашей страны. Большинство магазинов ниже доставляют только в Великобританию. Проверьте доставку перед покупкой."]
  };
  var lang = "en-GB";
  try { lang = localStorage.getItem("gwh-language") || "en-GB"; } catch (e) { lang = "en-GB"; }
  var li = LOCALES.indexOf(lang);
  if (li < 0) { li = 0; lang = "en-GB"; }
  function tx(key, vars) {
    var row = T[key] || [];
    var s = String(row[li] || row[0] || "");
    Object.keys(vars || {}).forEach(function (k) { s = s.split("{" + k + "}").join(String(vars[k])); });
    return s;
  }
  // The GS1 check digit (the same rules as the sites and the Hub): a wrong number is said here, without asking anyone.
  function normalizeGtin(value) {
    var digits = String(value == null ? "" : value).replace(/[\s-]/g, "");
    if (!/^\d+$/.test(digits) || [8, 12, 13, 14].indexOf(digits.length) < 0 || /^0+$/.test(digits)) return null;
    var sum = 0;
    var body = digits.slice(0, -1);
    for (var i = 0; i < body.length; i++) { var n = Number(body[body.length - 1 - i]); sum += i % 2 === 0 ? n * 3 : n; }
    return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]) ? digits : null;
  }
  function money(value, currency) {
    var n = Number(value);
    if (!isFinite(n)) return "";
    try { return new Intl.NumberFormat(lang, { style: "currency", currency: /^[A-Z]{3}$/.test(String(currency || "")) ? currency : "GBP" }).format(n); }
    catch (e) { return n.toFixed(2); }
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function card(p) {
    var url = String(p.product_url || "");
    if (!/^https:\/\/[a-z0-9.-]+\//.test(url)) return null;
    var c = el("article", "bc-card");
    var img = String(p.image_url || "");
    if (/^https:\/\//.test(img)) {
      var i = document.createElement("img");
      i.src = img; i.alt = String(p.product_name || ""); i.loading = "lazy"; i.width = 88; i.height = 88;
      c.appendChild(i);
    } else c.appendChild(el("div", "bc-noimg", tx("noImage")));
    var box = el("div", "");
    var world = el("div", "bc-world", String(p.site || "").toUpperCase() + (p.site_name ? " \u00b7 " + p.site_name : ""));
    world.setAttribute("translate", "no");
    box.appendChild(world);
    box.appendChild(el("div", "bc-name", String(p.product_name || "")));
    var meta = el("div", "bc-meta");
    var shown = [p.brand, p.retailer].filter(Boolean).join(" \u00b7 ");
    meta.textContent = shown;
    meta.setAttribute("translate", "no");
    box.appendChild(meta);
    box.appendChild(el("div", "bc-price", money(p.price, p.currency)));
    var stock = p.stock_status === "check_retailer" ? tx("checkRetailer") : p.stock_status === "out_of_stock" ? tx("outOfStock") : p.stock_status === "in_stock" ? tx("inStock") : "";
    if (Number(p.offers) > 1) stock = (stock ? stock + " \u00b7 " : "") + tx("retailers").split("{0}").join(String(Number(p.offers)));
    if (stock) box.appendChild(el("div", "bc-stock", stock));
    var a = el("a", "bc-view");
    a.href = url;
    var parts = tx("viewAt").split("{0}");
    a.appendChild(document.createTextNode(parts[0] || ""));
    var name = el("span", "", String(p.retailer || p.site_name || ""));
    name.setAttribute("translate", "no");
    a.appendChild(name);
    a.appendChild(document.createTextNode((parts[1] || "") + " \u2192"));
    box.appendChild(a);
    c.appendChild(box);
    return c;
  }
  function start() {
    var form = document.getElementById("bcForm");
    var input = document.getElementById("bcCode");
    var status = document.getElementById("bcStatus");
    var list = document.getElementById("bcResults");
    var note = document.getElementById("bcNote");
    if (!form || !input || !status || !list) return;
    if (li > 0) {
      document.documentElement.lang = lang;
      var els = document.querySelectorAll("[data-bc]");
      for (var n = 0; n < els.length; n++) { var k = els[n].getAttribute("data-bc"); if (k === "crumb") k = "title"; if (T[k]) els[n].textContent = tx(k); }
      document.title = tx("title") + " | Gear World Hub";
    }
    form.addEventListener("submit", function (ev) {
      if (!normalizeGtin(input.value)) { ev.preventDefault(); status.textContent = tx("invalid"); list.textContent = ""; }
    });
    var code = "";
    try { code = new URLSearchParams(location.search).get("code") || ""; } catch (e) { code = ""; }
    if (!code) return;
    input.value = code.slice(0, 20);
    var gtin = normalizeGtin(code);
    if (!gtin) { status.textContent = tx("invalid"); return; }
    if (typeof window.fetch !== "function") { status.textContent = tx("error"); return; }
    status.textContent = tx("searching");
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;
    fetch("/api/barcode?code=" + encodeURIComponent(gtin), { headers: { Accept: "application/json" }, signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        var d = res.data || {};
        if (res.status === 400) { status.textContent = tx("invalid"); return; }
        if (!d.ok) { status.textContent = tx("error"); return; }
        var cards = (Array.isArray(d.results) ? d.results : []).map(card).filter(Boolean);
        list.textContent = "";
        cards.forEach(function (c) { list.appendChild(c); });
        status.textContent = cards.length === 0 ? tx("none") : cards.length === 1 ? tx("foundOne", { code: gtin }) : tx("found", { count: cards.length, code: gtin });
        if (d.partial) status.textContent += " " + tx("partial");
        // Outside the UK (the sites already list only what delivers there, or the UK view): check delivery first.
        if (note && cards.length && d.deliver_to && d.deliver_to !== "GB") { note.textContent = tx("countryBar"); note.hidden = false; }
      })
      .catch(function () { if (timer) clearTimeout(timer); status.textContent = tx("error"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.GearWorldBarcode = { locales: LOCALES, strings: T, normalizeGtin: normalizeGtin };
})();
