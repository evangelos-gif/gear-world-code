// Gear World Hub - legal pages: footer year, the analytics choice on /cookies/ and, since lessons L176 (owner,
// 17 Nov 2026: the policies in the language of every country), the page in the visitor's language. The language: the
// visitor's own choice (gwh-language; English only with the mark gwh-language-chosen of the menu, L175), then the
// language of their country (<html data-country-lang>, from the Worker), then English. Only pages that ask for it
// (<html data-lg-i18n>). The texts are in /legal/i18n/<language>.json: each block of the page (heading, paragraph,
// list item, table cell, footer line) by its English HTML, and its translation with the same links and tags. A block
// without a translation stays in English; without JavaScript, or if the file does not load, the page is English.
(function () {
  "use strict";
  var LOCALES = ["en-GB", "el-GR", "de-DE", "fr-FR", "it-IT", "es-ES", "pt-PT", "nl-NL", "sq-AL", "ro-RO", "ru-RU"];
  var VERSION = "20261123-app1";
  var NOTE = "This is a translation. If it differs from the English text, the English text applies.";
  var BLOCKS = ".lg-crumbs a, .lg-crumbs > span:last-child, .lg-prose h1, .lg-prose h2, .lg-prose p, .lg-prose li, " +
    ".lg-prose th, .lg-prose td > span, .lg-legal a, .lg-footer p";
  // One choice for Google Analytics and Google Ads (lessons L93); the older key was analytics only.
  var KEY = "gwh_cookie_consent";
  var OLD_KEY = "gwh_analytics_consent";
  var dict = null;

  function t(text) { return dict && Object.prototype.hasOwnProperty.call(dict, text) ? dict[text] : text; }
  function norm(html) { return String(html).replace(/\s+/g, " ").trim(); }

  function wantedLanguage() {
    var lang = "";
    var chosen = false;
    try { lang = localStorage.getItem("gwh-language") || ""; chosen = localStorage.getItem("gwh-language-chosen") === "1"; } catch (e) { lang = ""; }
    if (LOCALES.indexOf(lang) < 0 || (lang === "en-GB" && !chosen)) {
      var byCountry = document.documentElement.getAttribute("data-country-lang") || "";
      lang = LOCALES.indexOf(byCountry) >= 0 ? byCountry : "en-GB";
    }
    return lang;
  }

  function translatePage(lang) {
    var els = document.querySelectorAll(BLOCKS);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.querySelector("button")) continue; // the reset button keeps its element and its click
      var key = norm(el.innerHTML);
      if (Object.prototype.hasOwnProperty.call(dict, key)) el.innerHTML = dict[key];
    }
    var cells = document.querySelectorAll(".lg-prose td[data-label]");
    for (var c = 0; c < cells.length; c++) cells[c].setAttribute("data-label", t(cells[c].getAttribute("data-label")));
    // The names of the two menus for screen readers ("Breadcrumb", "Legal").
    var navs = document.querySelectorAll("nav.lg-crumbs[aria-label], nav.lg-legal[aria-label]");
    for (var n = 0; n < navs.length; n++) navs[n].setAttribute("aria-label", t(navs[n].getAttribute("aria-label")));
    var parts = document.title.split(" | ");
    if (parts.length === 2) document.title = t(parts[0]) + " | " + parts[1];
    var h1 = document.querySelector(".lg-prose h1");
    if (h1 && t(NOTE) !== NOTE) {
      var note = document.createElement("p");
      note.className = "lg-updated lg-lang-note";
      note.textContent = t(NOTE);
      h1.parentNode.insertBefore(note, h1.nextSibling);
    }
    document.documentElement.lang = lang;
  }

  function legalBits() {
    var y = document.getElementById("lgYear");
    if (y) y.textContent = String(new Date().getFullYear());
    var status = document.getElementById("gwhAnalyticsStatus");
    var button = document.getElementById("gwhAnalyticsReset");
    if (!status || !button) return;
    function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function show() {
      var v = read();
      status.textContent = v === "granted" ? t("Your choice: Google cookies allowed (analytics and ad measurement).")
        : v === "denied" ? t("Your choice: Google cookies rejected.")
        : t("You have not made a choice yet. The Hub will ask you on the home page.");
    }
    function dropGaCookies() {
      var host = location.hostname.replace(/^www\./, "");
      document.cookie.split(";").forEach(function (c) {
        var name = c.split("=")[0].trim();
        if (!/^(_ga|_gcl_|_gac_)/.test(name)) return;
        ["", "; domain=" + host, "; domain=." + host].forEach(function (d) {
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
        });
      });
    }
    button.textContent = t("Reset my choice");
    button.hidden = false;
    button.addEventListener("click", function () {
      try { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); } catch (e) {}
      dropGaCookies();
      status.textContent = t("Your choice has been reset. The Hub will ask you again on the home page.");
    });
    show();
  }

  var lang = wantedLanguage();
  if (lang === "en-GB" || !document.documentElement.hasAttribute("data-lg-i18n") || typeof fetch !== "function") {
    legalBits();
    return;
  }
  fetch("/legal/i18n/" + lang + ".json?v=" + VERSION)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { if (d && typeof d === "object") { dict = d; translatePage(lang); } })
    .catch(function () { /* the page stays in English */ })
    .then(legalBits);
})();
