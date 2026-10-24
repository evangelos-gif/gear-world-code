/* Gear World Hub - photo search V1 (camera button), October 2026.
   Progressive enhancement like gear-world-voice-v2.js: it adds a camera button next to the search box and a short
   privacy note under it, without changing the page HTML.
   The photo is made smaller on this device (max 1024 px JPEG), which also removes hidden details such as GPS,
   is sent once to /api/photo-search and is never stored. The words found go into the search box, where the
   visitor sees them and can change them. The results come from /api/search, grouped by Gear World site. */
(() => {
  "use strict";
  if (window.__gearWorldPhotoV1) return;
  window.__gearWorldPhotoV1 = true;

  const VERSION = "photo-v1";
  const MAX_SIDE = 1024;
  const MAX_BYTES = 1024 * 1024;
  const LOCALES = ["en-GB", "el-GR", "de-DE", "fr-FR", "it-IT", "es-ES", "pt-PT", "nl-NL", "sq-AL", "ro-RO", "ru-RU"];

  // One line per text, in the order of LOCALES (the same order as translations.js).
  const S = {
    button: [
      "Search with a photo", "Αναζήτηση με φωτογραφία", "Mit einem Foto suchen", "Rechercher avec une photo",
      "Cerca con una foto", "Buscar con una foto", "Pesquisar com uma fotografia", "Zoeken met een foto",
      "Kërko me një foto", "Caută cu o fotografie", "Поиск по фото"
    ],
    note: [
      "Your photo is only used to find products and is not saved",
      "Η φωτογραφία σας χρησιμοποιείται μόνο για να βρεθούν προϊόντα και δεν αποθηκεύεται",
      "Ihr Foto wird nur zur Produktsuche verwendet und nicht gespeichert",
      "Votre photo sert uniquement à trouver des produits et n'est pas enregistrée",
      "La tua foto viene usata solo per trovare prodotti e non viene salvata",
      "Tu foto solo se usa para encontrar productos y no se guarda",
      "A sua fotografia só é usada para encontrar produtos e não é guardada",
      "Je foto wordt alleen gebruikt om producten te vinden en wordt niet opgeslagen",
      "Fotoja juaj përdoret vetëm për të gjetur produkte dhe nuk ruhet",
      "Fotografia dvs. este folosită doar pentru a găsi produse și nu este salvată",
      "Ваше фото используется только для поиска товаров и не сохраняется"
    ],
    gallery: [
      "or choose a photo from your gallery", "ή επιλέξτε φωτογραφία από τη συλλογή σας", "oder ein Foto aus Ihrer Galerie wählen",
      "ou choisissez une photo dans votre galerie", "oppure scegli una foto dalla galleria", "o elige una foto de tu galería",
      "ou escolha uma fotografia da sua galeria", "of kies een foto uit je galerij", "ose zgjidhni një foto nga galeria juaj",
      "sau alegeți o fotografie din galerie", "или выберите фото из галереи"
    ],
    looking: [
      "Looking at your photo…", "Εξετάζουμε τη φωτογραφία σας…", "Wir sehen uns Ihr Foto an…", "Analyse de votre photo…",
      "Stiamo guardando la tua foto…", "Estamos mirando tu foto…", "A analisar a sua fotografia…", "We bekijken je foto…",
      "Po e shohim foton tuaj…", "Analizăm fotografia dvs.…", "Смотрим на ваше фото…"
    ],
    found: [
      "We found: {words}", "Βρήκαμε: {words}", "Erkannt: {words}", "Nous avons trouvé : {words}", "Abbiamo trovato: {words}",
      "Hemos encontrado: {words}", "Encontrámos: {words}", "We vonden: {words}", "Gjetëm: {words}", "Am găsit: {words}",
      "Мы нашли: {words}"
    ],
    brand: [
      "Brand: {brand}", "Μάρκα: {brand}", "Marke: {brand}", "Marque : {brand}", "Marca: {brand}", "Marca: {brand}",
      "Marca: {brand}", "Merk: {brand}", "Marka: {brand}", "Marcă: {brand}", "Бренд: {brand}"
    ],
    best: [
      "Best match", "Ταιριάζει περισσότερο", "Beste Übereinstimmung", "Meilleure correspondance", "Corrispondenza migliore",
      "Mejor coincidencia", "Melhor correspondência", "Beste match", "Përputhja më e mirë", "Cea mai bună potrivire",
      "Лучшее совпадение"
    ],
    bestMatch: [
      "Best match: {world}", "Ταιριάζει περισσότερο: {world}", "Passt am besten: {world}", "Meilleure correspondance : {world}",
      "Corrispondenza migliore: {world}", "Mejor coincidencia: {world}", "Melhor correspondência: {world}",
      "Beste match: {world}", "Përputhja më e mirë: {world}", "Cea mai bună potrivire: {world}", "Лучшее совпадение: {world}"
    ],
    editHint: [
      "Not right? Change the words in the search box and search again.",
      "Δεν είναι σωστό; Αλλάξτε τις λέξεις στο πεδίο αναζήτησης και ψάξτε ξανά.",
      "Nicht richtig? Ändern Sie die Wörter im Suchfeld und suchen Sie erneut.",
      "Ce n'est pas ça ? Modifiez les mots dans le champ de recherche et relancez la recherche.",
      "Non è giusto? Cambia le parole nella casella di ricerca e cerca di nuovo.",
      "¿No es correcto? Cambia las palabras en el cuadro de búsqueda y vuelve a buscar.",
      "Não está certo? Altere as palavras na caixa de pesquisa e pesquise novamente.",
      "Klopt het niet? Pas de woorden in het zoekvak aan en zoek opnieuw.",
      "Nuk është e saktë? Ndryshoni fjalët në kutinë e kërkimit dhe kërkoni përsëri.",
      "Nu este corect? Schimbați cuvintele din caseta de căutare și căutați din nou.",
      "Не то? Измените слова в поле поиска и выполните поиск снова."
    ],
    noProduct: [
      "We could not see a product in this photo. Try a closer photo of just the product.",
      "Δεν είδαμε προϊόν σε αυτή τη φωτογραφία. Δοκιμάστε μια πιο κοντινή φωτογραφία μόνο του προϊόντος.",
      "Auf diesem Foto haben wir kein Produkt erkannt. Versuchen Sie eine Nahaufnahme nur des Produkts.",
      "Nous n'avons pas vu de produit sur cette photo. Essayez une photo plus rapprochée du produit seul.",
      "Non abbiamo visto un prodotto in questa foto. Prova una foto più ravvicinata del solo prodotto.",
      "No hemos visto ningún producto en esta foto. Prueba con una foto más cercana solo del producto.",
      "Não vimos nenhum produto nesta fotografia. Experimente uma fotografia mais próxima só do produto.",
      "We zagen geen product op deze foto. Probeer een foto van dichterbij van alleen het product.",
      "Nuk pamë asnjë produkt në këtë foto. Provoni një foto më nga afër vetëm të produktit.",
      "Nu am văzut niciun produs în această fotografie. Încercați o fotografie mai de aproape doar cu produsul.",
      "Мы не нашли товар на этом фото. Попробуйте снять только товар крупным планом."
    ],
    limitHour: [
      "You have done many photo searches in the last hour. Please try again later or type your search.",
      "Κάνατε πολλές αναζητήσεις με φωτογραφία την τελευταία ώρα. Δοκιμάστε ξανά αργότερα ή γράψτε την αναζήτησή σας.",
      "Sie haben in der letzten Stunde viele Fotosuchen durchgeführt. Bitte versuchen Sie es später erneut oder geben Sie Ihre Suche ein.",
      "Vous avez fait beaucoup de recherches par photo au cours de la dernière heure. Réessayez plus tard ou saisissez votre recherche.",
      "Hai fatto molte ricerche con foto nell'ultima ora. Riprova più tardi o scrivi la tua ricerca.",
      "Has hecho muchas búsquedas con foto en la última hora. Inténtalo más tarde o escribe tu búsqueda.",
      "Fez muitas pesquisas com fotografia na última hora. Tente mais tarde ou escreva a sua pesquisa.",
      "Je hebt het afgelopen uur veel fotozoekopdrachten gedaan. Probeer het later opnieuw of typ je zoekopdracht.",
      "Keni bërë shumë kërkime me foto në orën e fundit. Provoni përsëri më vonë ose shkruani kërkimin tuaj.",
      "Ați făcut multe căutări cu fotografii în ultima oră. Încercați din nou mai târziu sau scrieți căutarea.",
      "За последний час вы выполнили много поисков по фото. Попробуйте позже или введите запрос текстом."
    ],
    limitDay: [
      "Photo search has reached today's limit. Please try again tomorrow or type your search.",
      "Η αναζήτηση με φωτογραφία έφτασε το όριο της ημέρας. Δοκιμάστε ξανά αύριο ή γράψτε την αναζήτησή σας.",
      "Die Fotosuche hat das heutige Limit erreicht. Bitte versuchen Sie es morgen erneut oder geben Sie Ihre Suche ein.",
      "La recherche par photo a atteint sa limite du jour. Réessayez demain ou saisissez votre recherche.",
      "La ricerca con foto ha raggiunto il limite di oggi. Riprova domani o scrivi la tua ricerca.",
      "La búsqueda con foto ha alcanzado el límite de hoy. Inténtalo mañana o escribe tu búsqueda.",
      "A pesquisa com fotografia atingiu o limite de hoje. Tente amanhã ou escreva a sua pesquisa.",
      "Zoeken met een foto heeft de limiet van vandaag bereikt. Probeer het morgen opnieuw of typ je zoekopdracht.",
      "Kërkimi me foto arriti kufirin e sotëm. Provoni përsëri nesër ose shkruani kërkimin tuaj.",
      "Căutarea cu fotografii a atins limita de azi. Încercați din nou mâine sau scrieți căutarea.",
      "Поиск по фото достиг дневного лимита. Попробуйте завтра или введите запрос текстом."
    ],
    tooBig: [
      "This photo is too large. Please try another photo.", "Η φωτογραφία είναι πολύ μεγάλη. Δοκιμάστε μια άλλη φωτογραφία.",
      "Dieses Foto ist zu groß. Bitte versuchen Sie ein anderes Foto.", "Cette photo est trop grande. Essayez une autre photo.",
      "Questa foto è troppo grande. Prova con un'altra foto.", "Esta foto es demasiado grande. Prueba con otra foto.",
      "Esta fotografia é demasiado grande. Experimente outra fotografia.", "Deze foto is te groot. Probeer een andere foto.",
      "Kjo foto është shumë e madhe. Provoni një foto tjetër.", "Această fotografie este prea mare. Încercați altă fotografie.",
      "Это фото слишком большое. Попробуйте другое фото."
    ],
    notPhoto: [
      "We could not read this file. Please use a JPG or PNG photo.",
      "Δεν μπορέσαμε να διαβάσουμε αυτό το αρχείο. Χρησιμοποιήστε φωτογραφία JPG ή PNG.",
      "Diese Datei konnten wir nicht lesen. Bitte verwenden Sie ein JPG- oder PNG-Foto.",
      "Nous n'avons pas pu lire ce fichier. Utilisez une photo JPG ou PNG.",
      "Non siamo riusciti a leggere questo file. Usa una foto JPG o PNG.",
      "No hemos podido leer este archivo. Usa una foto JPG o PNG.",
      "Não conseguimos ler este ficheiro. Use uma fotografia JPG ou PNG.",
      "We konden dit bestand niet lezen. Gebruik een JPG- of PNG-foto.",
      "Nuk mundëm ta lexojmë këtë skedar. Përdorni një foto JPG ose PNG.",
      "Nu am putut citi acest fișier. Folosiți o fotografie JPG sau PNG.",
      "Не удалось прочитать этот файл. Используйте фото в формате JPG или PNG."
    ],
    unavailable: [
      "Photo search is not available right now. Please type your search.",
      "Η αναζήτηση με φωτογραφία δεν είναι διαθέσιμη αυτή τη στιγμή. Γράψτε την αναζήτησή σας.",
      "Die Fotosuche ist gerade nicht verfügbar. Bitte geben Sie Ihre Suche ein.",
      "La recherche par photo n'est pas disponible pour le moment. Saisissez votre recherche.",
      "La ricerca con foto non è disponibile al momento. Scrivi la tua ricerca.",
      "La búsqueda con foto no está disponible ahora mismo. Escribe tu búsqueda.",
      "A pesquisa com fotografia não está disponível de momento. Escreva a sua pesquisa.",
      "Zoeken met een foto is nu niet beschikbaar. Typ je zoekopdracht.",
      "Kërkimi me foto nuk është i disponueshëm tani. Shkruani kërkimin tuaj.",
      "Căutarea cu fotografii nu este disponibilă acum. Scrieți căutarea.",
      "Поиск по фото сейчас недоступен. Введите запрос текстом."
    ],
    seeAll: [
      "See all on {site}", "Δείτε όλα στο {site}", "Alle auf {site} ansehen", "Tout voir sur {site}", "Vedi tutti su {site}",
      "Ver todo en {site}", "Ver tudo em {site}", "Alles bekijken op {site}", "Shikoni të gjitha në {site}", "Vezi tot pe {site}",
      "Смотреть всё на {site}"
    ]
  };

  // For the automatic checks (every text in all 11 languages) and for support.
  window.GearWorldPhotoSearch = { version: VERSION, locales: LOCALES.slice(), strings: S };

  function locale() {
    const raw = String((window.GWH_getLocale && window.GWH_getLocale()) || document.documentElement.lang || "en-GB");
    if (LOCALES.includes(raw)) return raw;
    const short = raw.slice(0, 2).toLowerCase();
    return LOCALES.find(l => l.slice(0, 2) === short) || "en-GB";
  }

  function tx(key, vars) {
    const list = S[key];
    let value = list ? (list[LOCALES.indexOf(locale())] || list[0]) : key;
    for (const [name, replacement] of Object.entries(vars || {})) value = value.split(`{${name}}`).join(String(replacement));
    return value;
  }

  // Texts the Hub already has in its 11 languages (translations.js).
  function hubText(key, vars, fallback) {
    if (typeof window.GWH_t === "function") {
      const value = window.GWH_t(key, vars || {});
      if (value && value !== key) return value;
    }
    return fallback;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function safeHttps(url) {
    const text = String(url || "");
    return /^https:\/\/[a-z0-9.-]+(\/|$)/i.test(text) ? text : "";
  }

  function formatPrice(price, currency) {
    const amount = Number(price);
    const code = String(currency || "GBP").toUpperCase();
    if (!Number.isFinite(amount)) return hubText("checkPrice", {}, "Check price");
    try {
      return new Intl.NumberFormat(locale(), { style: "currency", currency: code }).format(amount);
    } catch (_) {
      return `${amount.toFixed(2)} ${code}`;
    }
  }

  async function fetchWithTimeout(url, options, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
      clearTimeout(timer);
    }
  }

  function canvasBlob(canvas, quality) {
    return new Promise(resolve => {
      try { canvas.toBlob(blob => resolve(blob), "image/jpeg", quality); } catch (_) { resolve(null); }
    });
  }

  // Makes the photo smaller (max 1024 px) and saves it again as JPEG: the new file has no hidden details (EXIF, GPS).
  async function shrink(file) {
    let source = null;
    let width = 0;
    let height = 0;
    let objectUrl = "";
    if (typeof window.createImageBitmap === "function") {
      try {
        source = await window.createImageBitmap(file, { imageOrientation: "from-image" });
        width = source.width;
        height = source.height;
      } catch (_) {
        source = null;
      }
    }
    if (!source) {
      objectUrl = URL.createObjectURL(file);
      try {
        source = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("decode"));
          img.src = objectUrl;
        });
        width = source.naturalWidth;
        height = source.naturalHeight;
      } catch (_) {
        URL.revokeObjectURL(objectUrl);
        return null;
      }
    }
    try {
      if (!width || !height) return null;
      const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      let blob = await canvasBlob(canvas, 0.82);
      if (blob && blob.size > MAX_BYTES) blob = await canvasBlob(canvas, 0.6);
      return blob;
    } finally {
      if (source && typeof source.close === "function") source.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  const CAMERA_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2.2l1.4-2h6.8l1.4 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.6"/></svg>';

  // Blue and orange only (never red with green), lesson L35. Buttons at least 40 px (L21).
  const STYLE = `
    .gw-photo-v1-wrap{display:inline-flex;align-items:center;flex:0 0 auto;position:relative;min-width:40px;}
    .gw-photo-v1-button{appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;
      width:40px!important;min-width:40px!important;height:40px!important;min-height:40px!important;padding:0!important;
      margin:0 6px 0 0!important;border:1px solid rgba(255,180,0,.65)!important;border-radius:10px!important;
      background:#172238!important;color:#ffbd18!important;font:inherit!important;line-height:1!important;cursor:pointer!important;
      box-shadow:none!important;flex:none!important;vertical-align:middle!important;}
    .gw-photo-v1-button:hover,.gw-photo-v1-button:focus-visible{background:#263854!important;outline:2px solid #ffc43d;outline-offset:2px;}
    .gw-photo-v1-button[aria-busy="true"]{border-color:#4da3ff!important;color:#4da3ff!important;cursor:progress!important;}
    .gw-photo-v1-button[aria-busy="true"] svg{animation:gwPhotoPulse 1s ease-in-out infinite;}
    @keyframes gwPhotoPulse{50%{opacity:.35;}}
    @media (prefers-reduced-motion:reduce){.gw-photo-v1-button[aria-busy="true"] svg{animation:none;}}
    .gw-photo-v1-button svg{display:block;width:20px;height:20px;pointer-events:none;}
    .gw-photo-v1-input{display:none!important;}
    .gwh-photo-note{margin:8px 2px 0;color:#a9b8cc;font-size:12px;line-height:1.45;}
    .gwh-photo-gallery{appearance:none;background:none;border:0;padding:0;margin:0;color:#ffbd18;text-decoration:underline;
      font:inherit;cursor:pointer;min-height:24px;}
    .gwh-photo-summary{line-height:1.45;}
    .gwh-photo-found{color:#111827;font-size:14px;font-weight:800;}
    .gwh-photo-meta{color:#41506a;font-weight:700;margin-top:3px;}
    .gwh-photo-hint{color:#41506a;font-weight:600;margin-top:5px;}
    .gwh-photo-group-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:11px 15px;background:#eef4fb;
      border-bottom:1px solid #d9e1ea;color:#0d1b2a;font-size:13px;}
    .gwh-photo-group.is-best .gwh-photo-group-head{background:#fff4dc;border-left:4px solid #e68a00;}
    .gwh-photo-badge{display:inline-block;padding:2px 7px;border-radius:5px;background:#0d1b2a;color:#ffbd18;font-size:11px;font-weight:900;}
    .gwh-photo-count{color:#41506a;font-weight:700;}
    .gwh-photo-see-all{margin-left:auto;color:#0b57b5;font-weight:800;text-decoration:underline;font-size:12px;}
    @media(max-width:480px){.gw-photo-v1-button{margin:0 3px 0 0!important;}.gwh-photo-see-all{margin-left:0;flex-basis:100%;}}
  `;

  function init() {
    const form = document.getElementById("hubSearch");
    const input = document.getElementById("hubSearchInput");
    const message = document.getElementById("searchMessage");
    if (!form || !input || input.dataset.gwPhotoV1) return;
    if (typeof window.fetch !== "function" || typeof window.AbortController !== "function") return;
    const probe = document.createElement("canvas");
    if (!probe.getContext || typeof probe.toBlob !== "function") return; // No photo search without canvas: the page stays as it was.
    input.dataset.gwPhotoV1 = "true";

    if (!document.getElementById("gw-photo-v1-style")) {
      const style = document.createElement("style");
      style.id = "gw-photo-v1-style";
      style.textContent = STYLE;
      document.head.appendChild(style);
    }

    const touch = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    const makeInput = (camera) => {
      const el = document.createElement("input");
      el.type = "file";
      el.accept = "image/*";
      if (camera) el.setAttribute("capture", "environment");
      el.className = "gw-photo-v1-input";
      el.hidden = true;
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
      return el;
    };
    const cameraInput = makeInput(true);
    const pickInput = makeInput(false);

    const wrap = document.createElement("span");
    wrap.className = "gw-photo-v1-wrap";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gw-photo-v1-button";
    button.setAttribute("aria-busy", "false");
    button.innerHTML = CAMERA_ICON;
    wrap.appendChild(button);
    const voice = form.querySelector(".gw-voice-v2-wrap");
    (voice || input).insertAdjacentElement("afterend", wrap);

    const note = document.createElement("p");
    note.className = "gwh-photo-note";
    const noteText = document.createElement("span");
    note.appendChild(noteText);
    let galleryButton = null;
    if (touch) {
      galleryButton = document.createElement("button");
      galleryButton.type = "button";
      galleryButton.className = "gwh-photo-gallery";
      note.append(" · ", galleryButton);
    }
    form.insertAdjacentElement("afterend", note);

    const updateTexts = () => {
      const label = tx("button");
      button.setAttribute("aria-label", label);
      button.title = label;
      noteText.textContent = tx("note");
      if (galleryButton) galleryButton.textContent = tx("gallery");
    };
    updateTexts();
    window.addEventListener("gwh-language-change", () => setTimeout(updateTexts, 0));

    let busy = false;
    const panel = () => document.getElementById("hubSearchResults");
    const say = (text) => { if (message) message.textContent = text; };
    const setBusy = (value) => {
      busy = value;
      button.setAttribute("aria-busy", String(value));
      button.disabled = value;
    };
    const track = (result, world, results) => {
      // Only the outcome: never the photo and never the words found in it.
      try {
        window.dispatchEvent(new CustomEvent("gwh:photo_search", {
          detail: { result, world: String(world || "").toLowerCase(), results: Number(results || 0) }
        }));
      } catch (_) { /* ignore */ }
    };
    const showPanel = (html) => {
      const box = panel();
      if (!box) return;
      box.innerHTML = html;
      box.classList.add("is-open");
    };
    const stop = (text, result) => {
      say(text);
      showPanel(`<div class="gwh-search-empty">${esc(text)}</div>`);
      track(result);
    };

    async function searchAll(query) {
      try {
        const response = await fetchWithTimeout(`/api/search?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } }, 20000);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data || !data.ok) return null;
        return Array.isArray(data.results) ? data.results : [];
      } catch (_) {
        return null;
      }
    }

    // Second opinion for the Gear World, only when the model did not choose one.
    async function classify(answer) {
      try {
        const params = new URLSearchParams({
          product_name: answer.product || answer.query,
          description: (answer.keywords || []).join(" "),
          brand: answer.brand || ""
        });
        const response = await fetchWithTimeout(`/api/classify?${params}`, { headers: { Accept: "application/json" } }, 8000);
        const data = await response.json();
        const r = data && data.ok && data.result;
        if (r && Number(r.confidence) >= 85 && r.site_key) {
          return { key: String(r.site_key), name: String(r.site_name || r.site_key), domain: String(r.domain || "") };
        }
      } catch (_) { /* the order then follows the number of results */ }
      return null;
    }

    function productHtml(product) {
      const href = safeHttps(product.product_url) || "#";
      const imageUrl = String(product.image_url || "");
      const image = /^https?:\/\//i.test(imageUrl)
        ? `<img class="gwh-search-image" src="${esc(imageUrl)}" alt="${esc(product.product_name)}" loading="lazy">`
        : `<div class="gwh-search-image-placeholder">${esc(hubText("noImage", {}, "No image"))}</div>`;
      const meta = [product.brand, product.retailer].filter(Boolean).map(esc).join(" · ");
      return `<a class="gwh-search-item" href="${esc(href)}">${image}` +
        `<div class="gwh-search-details"><span class="gwh-search-source">${esc(String(product.site || "").toUpperCase())}</span>` +
        `<div class="gwh-search-name">${esc(product.product_name)}</div><div class="gwh-search-meta">${meta}</div></div>` +
        `<div class="gwh-search-price">${esc(formatPrice(product.price, product.currency))}` +
        `<span class="gwh-search-view">${esc(hubText("viewProduct", {}, "View Product"))} →</span></div></a>`;
    }

    function render(answer, best, query, results) {
      const bestKey = String((best && best.key) || "").toLowerCase();
      const groups = new Map();
      for (const product of results) {
        const key = String(product.site || "").toLowerCase();
        if (!groups.has(key)) {
          groups.set(key, { key, name: String(product.site_name || key.toUpperCase()), base: safeHttps(product.site_url), items: [] });
        }
        groups.get(key).items.push(product);
      }
      const ordered = Array.from(groups.values())
        .sort((a, b) => (Number(b.key === bestKey) - Number(a.key === bestKey)) || (b.items.length - a.items.length));
      const words = (answer.keywords && answer.keywords.length ? answer.keywords : [answer.product || query]).join(" · ");
      let html = '<div class="gwh-search-summary gwh-photo-summary">' +
        `<div class="gwh-photo-found">${esc(tx("found", { words }))}</div>` +
        (answer.brand ? `<div class="gwh-photo-meta">${esc(tx("brand", { brand: answer.brand }))}</div>` : "") +
        (best && best.name ? `<div class="gwh-photo-meta">${esc(tx("bestMatch", { world: best.name }))}</div>` : "") +
        `<div class="gwh-photo-hint">${esc(tx("editHint"))}</div></div>`;
      if (!results.length) {
        html += `<div class="gwh-search-empty">${esc(hubText("noProductsAcross", {}, "No products found across the live Gear Worlds."))}</div>`;
      }
      for (const group of ordered) {
        const isBest = group.key === bestKey;
        const seeAll = group.base
          ? `<a class="gwh-photo-see-all" href="${esc(group.base + "/?search=" + encodeURIComponent(query))}">${esc(tx("seeAll", { site: group.name }))} →</a>`
          : "";
        html += `<div class="gwh-photo-group${isBest ? " is-best" : ""}" data-site="${esc(group.key)}">` +
          '<div class="gwh-photo-group-head">' +
          (isBest ? `<span class="gwh-photo-badge">${esc(tx("best"))}</span>` : "") +
          `<strong>${esc(group.name)}</strong> <span class="gwh-photo-count">(${group.items.length})</span>${seeAll}</div>` +
          group.items.map(productHtml).join("") + "</div>";
      }
      showPanel(html);
      say(results.length
        ? hubText("productsFound", { count: results.length, worlds: groups.size }, `${results.length} products found across ${groups.size} active Gear World sites.`)
        : hubText("noProductsFor", { query }, `No products found for "${query}".`));
    }

    async function run(file) {
      setBusy(true);
      say(tx("looking"));
      showPanel(`<div class="gwh-search-loading">${esc(tx("looking"))}</div>`);
      try {
        if (file.type && !/^image\//i.test(file.type)) { stop(tx("notPhoto"), "not_photo"); return; }
        const blob = await shrink(file);
        if (!blob) { stop(tx("notPhoto"), "not_photo"); return; }
        if (blob.size > MAX_BYTES) { stop(tx("tooBig"), "too_large"); return; }
        const response = await fetchWithTimeout("/api/photo-search", {
          method: "POST",
          headers: { "Content-Type": "image/jpeg", Accept: "application/json" },
          body: blob
        }, 35000);
        let data = null;
        try { data = await response.json(); } catch (_) { data = null; }
        if (response.status === 429) {
          const day = !!(data && data.error === "limit_day");
          stop(tx(day ? "limitDay" : "limitHour"), day ? "limit_day" : "limit_hour");
          return;
        }
        if (response.status === 413) { stop(tx("tooBig"), "too_large"); return; }
        if (response.status === 400 || response.status === 415) { stop(tx("notPhoto"), "not_photo"); return; }
        if (!response.ok || !data || !data.ok) { stop(tx("unavailable"), "error"); return; }
        if (!data.found || !data.query) { stop(tx("noProduct"), "no_product"); return; }

        input.value = data.query;
        const best = data.world || await classify(data);
        say(hubText("searchingAll", { query: data.query }, `Searching all Gear Worlds for "${data.query}"...`));
        let query = data.query;
        let results = await searchAll(query);
        if (results && !results.length && data.product && data.product.toLowerCase() !== query.toLowerCase()) {
          const second = await searchAll(data.product);
          if (second && second.length) { results = second; query = data.product; input.value = query; }
        }
        if (!results) { stop(hubText("loadError", {}, "We couldn't load product results. Please try again."), "error"); return; }
        render(data, best, query, results);
        track(results.length ? "ok" : "no_results", best && best.key, results.length);
      } catch (_) {
        stop(tx("unavailable"), "error");
      } finally {
        setBusy(false);
      }
    }

    button.addEventListener("click", () => { if (!busy) (touch ? cameraInput : pickInput).click(); });
    if (galleryButton) galleryButton.addEventListener("click", () => { if (!busy) pickInput.click(); });
    for (const el of [cameraInput, pickInput]) {
      el.addEventListener("change", () => {
        const file = el.files && el.files[0];
        el.value = "";
        if (file) run(file);
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
