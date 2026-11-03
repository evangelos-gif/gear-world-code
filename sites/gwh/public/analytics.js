(() => {
  "use strict";

  const MEASUREMENT_ID = "G-S65HL141VJ";
  // Google Ads (lessons L93): loaded only after "Allow", like Google Analytics. Remarketing stays off.
  const ADS_ID = "AW-18554591090";
  // The label of the "outbound_click" conversion (Google Ads > Goals > Conversions). Empty: nothing is sent.
  const ADS_LABEL = "Y2PgCP3X0bEdEPKuwo9F";
  const SITE_DOMAINS = [
    "constructiongearworld.com", "mensgearworld.com", "womensgearworld.com", "kidsgearworld.com",
    "homegearworld.com", "gardengearworld.com", "sportygearworld.com", "technologygearworld.com",
    "cargearworld.com", "travelgearworld.com", "bikergearworld.com", "gaminggearworld.com", "petsgearworld.com"
  ];
  const LIVE = /^(www\.)?gearworldhub\.com$/.test(window.location.hostname);
  // One choice for analytics and ads. The older key (analytics only, before 3/11/2026) still allows analytics
  // until the visitor answers the new question.
  const CONSENT_KEY = "gwh_cookie_consent";
  const OLD_KEY = "gwh_analytics_consent";

  const COPY = {
    "en-GB": {
      text: "We use optional Google cookies for analytics and to see which of our ads bring visitors to Gear World Hub. They are set only if you allow them.",
      accept: "Allow",
      reject: "Reject"
    },
    "el-GR": {
      text: "Χρησιμοποιούμε προαιρετικά cookies της Google για στατιστικά και για να βλέπουμε ποιες διαφημίσεις μας φέρνουν επισκέπτες στο Gear World Hub. Μπαίνουν μόνο αν το επιτρέψετε.",
      accept: "Αποδοχή",
      reject: "Απόρριψη"
    },
    "de-DE": {
      text: "Wir verwenden optionale Google-Cookies für Analysen und um zu sehen, welche unserer Anzeigen Besucher zu Gear World Hub bringen. Sie werden nur gesetzt, wenn Sie es erlauben.",
      accept: "Erlauben",
      reject: "Ablehnen"
    },
    "fr-FR": {
      text: "Nous utilisons des cookies Google facultatifs pour les statistiques et pour savoir lesquelles de nos publicités amènent des visiteurs sur Gear World Hub. Ils ne sont déposés que si vous l'acceptez.",
      accept: "Accepter",
      reject: "Refuser"
    },
    "it-IT": {
      text: "Usiamo cookie Google facoltativi per le statistiche e per vedere quali dei nostri annunci portano visitatori su Gear World Hub. Vengono impostati solo se lo consenti.",
      accept: "Consenti",
      reject: "Rifiuta"
    },
    "es-ES": {
      text: "Usamos cookies opcionales de Google para estadísticas y para ver qué anuncios nuestros traen visitantes a Gear World Hub. Solo se instalan si lo permite.",
      accept: "Permitir",
      reject: "Rechazar"
    },
    "pt-PT": {
      text: "Usamos cookies opcionais da Google para estatísticas e para ver quais dos nossos anúncios trazem visitantes ao Gear World Hub. Só são colocados se o permitir.",
      accept: "Permitir",
      reject: "Recusar"
    },
    "nl-NL": {
      text: "We gebruiken optionele cookies van Google voor statistieken en om te zien welke van onze advertenties bezoekers naar Gear World Hub brengen. Ze worden alleen geplaatst als u dat toestaat.",
      accept: "Toestaan",
      reject: "Weigeren"
    },
    "sq-AL": {
      text: "Përdorim cookies opsionale të Google për statistika dhe për të parë cilat nga reklamat tona sjellin vizitorë në Gear World Hub. Vendosen vetëm nëse i lejoni.",
      accept: "Lejo",
      reject: "Refuzo"
    },
    "ro-RO": {
      text: "Folosim cookie-uri Google opționale pentru statistici și pentru a vedea care dintre reclamele noastre aduc vizitatori pe Gear World Hub. Sunt setate doar dacă le permiteți.",
      accept: "Permiteți",
      reject: "Respingeți"
    },
    "ru-RU": {
      text: "Мы используем необязательные файлы cookie Google для статистики и чтобы видеть, какая наша реклама приводит посетителей на Gear World Hub. Они устанавливаются, только если вы это разрешите.",
      accept: "Разрешить",
      reject: "Отклонить"
    }
  };

  window.dataLayer = window.dataLayer || [];

  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  // Default is always denied.
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });

  function locale() {
    const selector = document.getElementById("gwhLanguage");
    const value = selector?.value || "en-GB";
    return COPY[value] ? value : "en-GB";
  }

  // withAds: false only for a visitor who allowed analytics before ads were asked about (OLD_KEY).
  function loadAnalytics(withAds) {
    if (window.gwhAnalyticsLoaded === true) {
      return;
    }

    window.gwhAnalyticsLoaded = true;
    window.gwhAdsLoaded = withAds === true;

    window.gtag("consent", "update", {
      analytics_storage: "granted",
      ad_storage: withAds === true ? "granted" : "denied",
      ad_user_data: withAds === true ? "granted" : "denied",
      ad_personalization: "denied"
    });

    const script = document.createElement("script");
    script.async = true;
    script.src =
      "https://www.googletagmanager.com/gtag/js?id=" +
      encodeURIComponent(MEASUREMENT_ID);

    document.head.appendChild(script);

    window.gtag("js", new Date());

    window.gtag("config", MEASUREMENT_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });

    if (withAds === true) {
      window.gtag("config", ADS_ID, {
        allow_ad_personalization_signals: false,
        linker: { domains: SITE_DOMAINS }
      });
    }
  }

  function saved(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function analyticsAllowed() {
    return window.gwhAnalyticsLoaded === true && typeof window.gtag === "function";
  }

  function trafficContext() {
    const params = new URLSearchParams(window.location.search);

    let referrerHost = "";

    try {
      referrerHost = document.referrer
        ? new URL(document.referrer).hostname
        : "";
    }
    catch (_) {}

    return {
      language: locale(),
      referrer_host: referrerHost || "(direct)",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || ""
    };
  }

  function track(name, params = {}) {
    if (!analyticsAllowed()) {
      return;
    }

    window.gtag(
      "event",
      name,
      Object.assign({}, trafficContext(), params)
    );
  }

  // ----------------------------------------------------------
  // Consent banner
  // ----------------------------------------------------------

  const banner =
    document.getElementById("gwhAnalyticsConsent");

  const text =
    document.getElementById("gwhAnalyticsConsentText");

  const accept =
    document.getElementById("gwhAnalyticsAccept");

  const reject =
    document.getElementById("gwhAnalyticsReject");

  function translateBanner() {
    const t = COPY[locale()] || COPY["en-GB"];

    if (text) text.textContent = t.text;
    if (accept) accept.textContent = t.accept;
    if (reject) reject.textContent = t.reject;
  }

  const savedConsent = saved(CONSENT_KEY);

  if (savedConsent === "granted") {
    loadAnalytics(true);
  }
  else if (savedConsent !== "denied") {
    // Analytics allowed before 3/11/2026: kept, and the banner asks again (now also about ads).
    if (saved(OLD_KEY) === "granted") {
      loadAnalytics(false);
    }

    if (banner) {
      banner.hidden = false;
    }
  }

  if (accept) {
    accept.addEventListener("click", () => {
      save(CONSENT_KEY, "granted");

      const analyticsOnly =
        window.gwhAnalyticsLoaded === true && window.gwhAdsLoaded !== true;

      if (banner) {
        banner.hidden = true;
      }

      // A page that has analytics only cannot add ads to the same tag setup cleanly: start a fresh page.
      if (analyticsOnly) {
        window.location.reload();
        return;
      }

      loadAnalytics(true);
    });
  }

  if (reject) {
    reject.addEventListener("click", () => {
      const wasLoaded =
        window.gwhAnalyticsLoaded === true;

      save(CONSENT_KEY, "denied");
      try { localStorage.removeItem(OLD_KEY); } catch (_) {}

      // The Google cookies of this site go too (_ga, _gcl_).
      const host = window.location.hostname.replace(/^www\./, "");
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0].trim();
        if (!/^(_ga|_gcl_|_gac_)/.test(name)) return;
        ["", "; domain=" + host, "; domain=." + host].forEach((d) => {
          document.cookie = name + "=; Max-Age=0; path=/" + d;
        });
      });

      window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });

      if (banner) {
        banner.hidden = true;
      }

      if (wasLoaded) {
        window.location.reload();
      }
    });
  }

  translateBanner();

  window.addEventListener(
    "gwh-language-change",
    () => setTimeout(translateBanner, 0)
  );

  document
    .getElementById("gwhLanguage")
    ?.addEventListener(
      "change",
      () => setTimeout(translateBanner, 0)
    );


  // ----------------------------------------------------------
  // WORLD SELECTION
  // ----------------------------------------------------------

  document.addEventListener("click", (event) => {
    const world =
      event.target.closest(
        ".gwh-image-world[data-world]"
      );

    if (!world) return;

    let destination = "";

    try {
      destination =
        new URL(world.href).hostname;
    }
    catch (_) {}

    track("select_world", {
      world: world.dataset.world || "",
      destination_host: destination
    });
  });


  // ----------------------------------------------------------
  // HUB SEARCH
  // ----------------------------------------------------------

  document
    .getElementById("hubSearch")
    ?.addEventListener("submit", () => {
      const input =
        document.getElementById("hubSearchInput");

      const query =
        String(input?.value || "").trim();

      if (query.length < 2) {
        return;
      }

      track("search", {
        search_term: query,
        search_scope: "all_gear_worlds"
      });
    });


  // ----------------------------------------------------------
  // SUCCESSFUL EMAIL SIGNUP
  // No email address is ever sent to GA4.
  // ----------------------------------------------------------

  window.addEventListener(
    "gwh:email_signup_success",
    () => {
      track("email_signup", {
        signup_location: "hub_homepage"
      });
    }
  );


  // ----------------------------------------------------------
  // PHOTO SEARCH (camera button, gear-world-camera.js)
  // Only the outcome is sent: never the photo and never the
  // words found in it.
  // ----------------------------------------------------------

  window.addEventListener(
    "gwh:photo_search",
    (event) => {
      const detail = (event && event.detail) || {};

      track("photo_search", {
        photo_result: String(detail.result || "").slice(0, 20),
        photo_world: String(detail.world || "").slice(0, 5),
        results_count: Number(detail.results || 0)
      });
    }
  );

  // ----------------------------------------------------------
  // GOOGLE ADS (lessons L93)
  // A click from the Hub to a Gear World site (a product, a deal, a
  // world) counts as the conversion "outbound_click", only after
  // "Allow", only on gearworldhub.com and only with the label.
  // utm_source / utm_campaign of this visit go with the link, so the
  // site passes them to Awin with the click (clickref2 / clickref3).
  // ----------------------------------------------------------

  const cleanUtm = (v) => {
    const t = String(v || "").trim().slice(0, 40);
    return /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(t) ? t : "";
  };

  const landing = new URLSearchParams(window.location.search);
  const visitUtm = {
    utm_source: cleanUtm(landing.get("utm_source")),
    utm_campaign: cleanUtm(landing.get("utm_campaign"))
  };

  function siteLink(node) {
    const a = node && node.closest ? node.closest("a[href]") : null;
    if (!a) return null;
    let url;
    try { url = new URL(a.href, window.location.href); } catch (_) { return null; }
    const host = url.hostname.replace(/^www\./, "");
    if (SITE_DOMAINS.indexOf(host) < 0) return null;
    return { a, url };
  }

  function onSiteClick(event) {
    if (event.type === "auxclick" && event.button !== 1) return;
    const link = siteLink(event.target);
    if (!link) return;

    let changed = false;
    ["utm_source", "utm_campaign"].forEach((k) => {
      if (visitUtm[k] && !link.url.searchParams.has(k)) {
        link.url.searchParams.set(k, visitUtm[k]);
        changed = true;
      }
    });
    if (changed) link.a.href = link.url.toString();

    if (window.gwhAdsLoaded === true && ADS_LABEL && LIVE) {
      window.gtag("event", "conversion", {
        send_to: ADS_ID + "/" + ADS_LABEL,
        transport_type: "beacon"
      });
    }
  }

  document.addEventListener("click", onSiteClick, true);
  document.addEventListener("auxclick", onSiteClick, true);

})();
