(() => {
  "use strict";

  const MEASUREMENT_ID = "G-S65HL141VJ";
  const CONSENT_KEY = "gwh_analytics_consent";

  const COPY = {
    "en-GB": {
      text: "We use optional analytics to understand how visitors use Gear World Hub.",
      accept: "Allow analytics",
      reject: "Reject"
    },
    "el-GR": {
      text: "Χρησιμοποιούμε προαιρετικά analytics για να κατανοούμε πώς χρησιμοποιούν οι επισκέπτες το Gear World Hub.",
      accept: "Αποδοχή analytics",
      reject: "Απόρριψη"
    },
    "de-DE": {
      text: "Wir verwenden optionale Analysen, um zu verstehen, wie Besucher Gear World Hub nutzen.",
      accept: "Analytics erlauben",
      reject: "Ablehnen"
    },
    "fr-FR": {
      text: "Nous utilisons des analyses facultatives pour comprendre comment les visiteurs utilisent Gear World Hub.",
      accept: "Autoriser les analyses",
      reject: "Refuser"
    },
    "it-IT": {
      text: "Utilizziamo analisi facoltative per capire come i visitatori utilizzano Gear World Hub.",
      accept: "Consenti analisi",
      reject: "Rifiuta"
    },
    "es-ES": {
      text: "Utilizamos analítica opcional para entender cómo utilizan los visitantes Gear World Hub.",
      accept: "Permitir analítica",
      reject: "Rechazar"
    },
    "pt-PT": {
      text: "Utilizamos análises opcionais para compreender como os visitantes utilizam o Gear World Hub.",
      accept: "Permitir análises",
      reject: "Recusar"
    },
    "nl-NL": {
      text: "We gebruiken optionele analytics om te begrijpen hoe bezoekers Gear World Hub gebruiken.",
      accept: "Analytics toestaan",
      reject: "Weigeren"
    },
    "sq-AL": {
      text: "Përdorim analiza opsionale për të kuptuar se si vizitorët përdorin Gear World Hub.",
      accept: "Lejo analizat",
      reject: "Refuzo"
    },
    "ro-RO": {
      text: "Folosim analize opționale pentru a înțelege cum utilizează vizitatorii Gear World Hub.",
      accept: "Permiteți analiza",
      reject: "Respingeți"
    },
    "ru-RU": {
      text: "Мы используем необязательную аналитику, чтобы понимать, как посетители используют Gear World Hub.",
      accept: "Разрешить аналитику",
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

  function loadAnalytics() {
    if (window.gwhAnalyticsLoaded === true) {
      return;
    }

    window.gwhAnalyticsLoaded = true;

    window.gtag("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
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
  }

  function analyticsAllowed() {
    return (
      localStorage.getItem(CONSENT_KEY) === "granted" &&
      typeof window.gtag === "function"
    );
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

  const savedConsent =
    localStorage.getItem(CONSENT_KEY);

  if (savedConsent === "granted") {
    loadAnalytics();
  }
  else if (!savedConsent) {
    if (banner) {
      banner.hidden = false;
    }
  }

  if (accept) {
    accept.addEventListener("click", () => {
      localStorage.setItem(
        CONSENT_KEY,
        "granted"
      );

      loadAnalytics();

      if (banner) {
        banner.hidden = true;
      }
    });
  }

  if (reject) {
    reject.addEventListener("click", () => {
      const wasLoaded =
        window.gwhAnalyticsLoaded === true;

      localStorage.setItem(
        CONSENT_KEY,
        "denied"
      );

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

})();