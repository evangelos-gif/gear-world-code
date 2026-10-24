/* Gear World Voice Search V2 — shared progressive enhancement, no backend changes. */
(() => {
  "use strict";
  if (window.__gearWorldVoiceV2) return;
  window.__gearWorldVoiceV2 = true;

  function init() {
    const isHub = !!document.getElementById("hubSearchInput");
    const input = document.getElementById(isHub ? "hubSearchInput" : "productSearch");
    if (!input || input.dataset.gwVoiceV2) return;
    const form = isHub ? document.getElementById("hubSearch") : null;
    if (isHub && (!form || !form.contains(input) || typeof form.requestSubmit !== "function")) return;
    if (!isHub && !input.closest(".comparison-toolbar")) return;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return; // Graceful absence: search UI stays unchanged.

    const styleId = "gw-voice-v2-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .gw-voice-v2-wrap{display:inline-flex;align-items:center;flex:0 0 auto;position:relative;min-width:40px;}
        .gw-voice-v2-button{appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;
          width:40px!important;min-width:40px!important;height:40px!important;min-height:40px!important;padding:0!important;
          margin:0 6px!important;border:1px solid rgba(255,180,0,.65)!important;border-radius:10px!important;
          background:#172238!important;color:#ffbd18!important;font:inherit!important;line-height:1!important;cursor:pointer!important;
          box-shadow:none!important;flex:none!important;vertical-align:middle!important;}
        .gw-voice-v2-button:hover,.gw-voice-v2-button:focus-visible{background:#263854!important;outline:2px solid #ffc43d;outline-offset:2px;}
        .gw-voice-v2-button[aria-pressed="true"]{background:#6d1921!important;color:#fff!important;border-color:#e66!important;}
        .gw-voice-v2-button svg{display:block;width:19px;height:19px;pointer-events:none;}
        .gw-voice-v2-status{position:absolute;top:100%;left:0;z-index:20;font-size:12px;line-height:1.3;
          background:#121c2d;color:#fff;max-width:230px;min-width:150px;border-radius:5px;padding:4px 7px;
          box-shadow:0 4px 12px rgba(0,0,0,.2);display:none;}
        .gw-voice-v2-status:not(:empty){display:block;}
        @media(max-width:480px){.gw-voice-v2-button{width:36px!important;min-width:36px!important;height:36px!important;min-height:36px!important;margin:0 3px!important;}}
      `;
      document.head.appendChild(style);
    }

    const wrapper = document.createElement("span");
    wrapper.className = "gw-voice-v2-wrap";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gw-voice-v2-button";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Voice search");
    button.title = "Voice search";
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/></svg>';
    const status = document.createElement("span");
    status.className = "gw-voice-v2-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    wrapper.append(button, status);
    // Place next to the actual search input, never mutate document HTML or its head.
    input.insertAdjacentElement("afterend", wrapper);
    input.dataset.gwVoiceV2 = "true";

    let recognition = null;
    let active = false;
    let finished = false;
    const locale = () => document.documentElement.lang || navigator.language || "en-GB";
    const textFor = (en, el) => /^el(?:-|$)/i.test(locale()) ? el : en;
    const updateLabel = () => {
      const label = textFor("Voice search", "Φωνητική αναζήτηση");
      button.setAttribute("aria-label", label);
      button.title = label;
    };
    const show = (text) => { status.textContent = text; };
    const setActive = (v) => { active = v; button.setAttribute("aria-pressed", String(v)); };
    updateLabel();
    window.addEventListener("gwh-language-change", updateLabel);

    button.addEventListener("click", () => {
      if (active && recognition) {
        try { recognition.stop(); } catch (_) { /* ignore */ }
        return;
      }
      try {
        recognition = new Recognition();
        recognition.lang = locale();
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;
        finished = false;
        recognition.onstart = () => { setActive(true); show(textFor("Listening…", "Ακούω…")); };
        recognition.onresult = (event) => {
          if (finished) return;
          let transcript = "";
          for (let i = event.resultIndex || 0; i < event.results.length; i++) {
            if (event.results[i].isFinal && event.results[i][0]) transcript += " " + event.results[i][0].transcript;
          }
          transcript = transcript.trim();
          if (transcript.length < 2) return;
          finished = true;
          input.value = transcript;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          if (isHub) form.requestSubmit();
          show("");
        };
        recognition.onerror = (event) => {
          const message = event.error === "not-allowed" || event.error === "service-not-allowed"
            ? textFor("Microphone permission denied", "Δεν επιτράπηκε η πρόσβαση στο μικρόφωνο")
            : textFor("Voice recognition unavailable", "Η φωνητική αναγνώριση δεν είναι διαθέσιμη");
          show(message);
          setActive(false);
        };
        recognition.onend = () => {
          setActive(false);
          if (!finished && status.textContent === textFor("Listening…", "Ακούω…")) show("");
        };
        recognition.start();
      } catch (_) {
        setActive(false);
        show(textFor("Voice recognition unavailable", "Η φωνητική αναγνώριση δεν είναι διαθέσιμη"));
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
