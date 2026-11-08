(() => {
  "use strict";

  const COPY = {
    "en-GB": {
      eyebrow: "WEEKLY DEALS",
      title: "Get the best deals from every Gear World.",
      description: "One email a week with prices we've checked, plus picks for Black Friday and Christmas. No spam.",
      emailLabel: "Email address",
      emailPlaceholder: "Your email address",
      button: "Sign up",
      consent: "I agree to receive Gear World deal emails (about once a week) and for Gear World to see whether I open and click them. I can unsubscribe at any time.",
      sending: "Signing up...",
      success: "Thanks. You're signed up for Gear World deal emails.",
      invalid: "Please enter a valid email address.",
      consentRequired: "Please tick the box to agree to receive Gear World deal emails.",
      error: "We could not complete your registration. Please try again.",
      tooMany: "Too many attempts. Please try again in an hour.",
      waitCheck: "Please wait for the security check to finish, then try again.",
      checkFailed: "The security check did not work. Please reload the page and try again.",
      full: "Sign-ups are full for today. Please try again tomorrow."
    },

    "el-GR": {
      eyebrow: "ΕΒΔΟΜΑΔΙΑΙΕΣ ΠΡΟΣΦΟΡΕΣ",
      title: "Οι καλύτερες προσφορές από κάθε Gear World.",
      description: "Ένα email την εβδομάδα με τιμές που έχουμε ελέγξει, και επιλογές για Black Friday και Χριστούγεννα. Χωρίς spam.",
      emailLabel: "Διεύθυνση email",
      emailPlaceholder: "Το email σας",
      button: "Εγγραφή",
      consent: "Συμφωνώ να λαμβάνω email προσφορών από το Gear World (περίπου μία φορά την εβδομάδα) και να βλέπει το Gear World αν τα ανοίγω και πατάω τα links τους. Μπορώ να διαγραφώ οποιαδήποτε στιγμή.",
      sending: "Γίνεται εγγραφή...",
      success: "Ευχαριστούμε. Γραφτήκατε στα email προσφορών του Gear World.",
      invalid: "Εισαγάγετε μια έγκυρη διεύθυνση email.",
      consentRequired: "Τσεκάρετε το κουτάκι για να συμφωνήσετε να λαμβάνετε email προσφορών από το Gear World.",
      error: "Η εγγραφή δεν ολοκληρώθηκε. Δοκιμάστε ξανά.",
      tooMany: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε μία ώρα.",
      waitCheck: "Περιμένετε να ολοκληρωθεί ο έλεγχος ασφαλείας και δοκιμάστε ξανά.",
      checkFailed: "Ο έλεγχος ασφαλείας απέτυχε. Ανανεώστε τη σελίδα και δοκιμάστε ξανά.",
      full: "Οι εγγραφές για σήμερα συμπληρώθηκαν. Δοκιμάστε ξανά αύριο."
    },

    "de-DE": {
      eyebrow: "WÖCHENTLICHE ANGEBOTE",
      title: "Die besten Angebote aus jeder Gear World.",
      description: "Eine E-Mail pro Woche mit geprüften Preisen, dazu Tipps für Black Friday und Weihnachten. Kein Spam.",
      emailLabel: "E-Mail-Adresse",
      emailPlaceholder: "Ihre E-Mail-Adresse",
      button: "Anmelden",
      consent: "Ich möchte Angebots-E-Mails von Gear World erhalten (etwa einmal pro Woche) und bin einverstanden, dass Gear World sieht, ob ich sie öffne und anklicke. Ich kann mich jederzeit abmelden.",
      sending: "Anmeldung läuft...",
      success: "Vielen Dank. Sie erhalten jetzt die Angebots-E-Mails von Gear World.",
      invalid: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      consentRequired: "Bitte setzen Sie das Häkchen, um den Angebots-E-Mails von Gear World zuzustimmen.",
      error: "Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.",
      tooMany: "Zu viele Versuche. Bitte versuchen Sie es in einer Stunde erneut.",
      waitCheck: "Bitte warten Sie, bis die Sicherheitsprüfung abgeschlossen ist, und versuchen Sie es dann erneut.",
      checkFailed: "Die Sicherheitsprüfung ist fehlgeschlagen. Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
      full: "Für heute sind keine Anmeldungen mehr möglich. Bitte versuchen Sie es morgen erneut."
    },

    "fr-FR": {
      eyebrow: "BONS PLANS DE LA SEMAINE",
      title: "Les meilleures offres de chaque Gear World.",
      description: "Un e-mail par semaine avec des prix vérifiés, plus notre sélection pour le Black Friday et Noël. Pas de spam.",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "Votre adresse e-mail",
      button: "S'inscrire",
      consent: "J'accepte de recevoir les e-mails d'offres de Gear World (environ une fois par semaine) et que Gear World voie si je les ouvre et clique dessus. Je peux me désinscrire à tout moment.",
      sending: "Inscription...",
      success: "Merci. Vous êtes inscrit aux e-mails d'offres de Gear World.",
      invalid: "Veuillez saisir une adresse e-mail valide.",
      consentRequired: "Cochez la case pour accepter de recevoir les e-mails d'offres de Gear World.",
      error: "L'inscription n'a pas pu être finalisée. Veuillez réessayer.",
      tooMany: "Trop de tentatives. Veuillez réessayer dans une heure.",
      waitCheck: "Veuillez attendre la fin de la vérification de sécurité, puis réessayer.",
      checkFailed: "La vérification de sécurité a échoué. Veuillez recharger la page et réessayer.",
      full: "Les inscriptions sont complètes pour aujourd'hui. Veuillez réessayer demain."
    },

    "it-IT": {
      eyebrow: "OFFERTE DELLA SETTIMANA",
      title: "Le migliori offerte da ogni Gear World.",
      description: "Un'email a settimana con prezzi verificati, più le nostre scelte per Black Friday e Natale. Niente spam.",
      emailLabel: "Indirizzo email",
      emailPlaceholder: "Il tuo indirizzo email",
      button: "Iscriviti",
      consent: "Accetto di ricevere le email di offerte di Gear World (circa una volta a settimana) e che Gear World veda se le apro e ci clicco. Posso annullare l'iscrizione in qualsiasi momento.",
      sending: "Iscrizione...",
      success: "Grazie. Sei iscritto alle email di offerte di Gear World.",
      invalid: "Inserisci un indirizzo email valido.",
      consentRequired: "Spunta la casella per accettare di ricevere le email di offerte di Gear World.",
      error: "Non è stato possibile completare l'iscrizione. Riprova.",
      tooMany: "Troppi tentativi. Riprova tra un'ora.",
      waitCheck: "Attendi la fine del controllo di sicurezza, poi riprova.",
      checkFailed: "Il controllo di sicurezza non è riuscito. Ricarica la pagina e riprova.",
      full: "Le iscrizioni di oggi sono esaurite. Riprova domani."
    },

    "es-ES": {
      eyebrow: "OFERTAS SEMANALES",
      title: "Las mejores ofertas de cada Gear World.",
      description: "Un correo a la semana con precios comprobados, además de nuestra selección para Black Friday y Navidad. Sin spam.",
      emailLabel: "Correo electrónico",
      emailPlaceholder: "Tu correo electrónico",
      button: "Registrarse",
      consent: "Acepto recibir correos de ofertas de Gear World (aproximadamente una vez por semana) y que Gear World vea si los abro y hago clic en ellos. Puedo darme de baja en cualquier momento.",
      sending: "Registrando...",
      success: "Gracias. Te has suscrito a los correos de ofertas de Gear World.",
      invalid: "Introduce una dirección de correo válida.",
      consentRequired: "Marca la casilla para aceptar recibir correos de ofertas de Gear World.",
      error: "No se pudo completar el registro. Inténtalo de nuevo.",
      tooMany: "Demasiados intentos. Inténtalo de nuevo dentro de una hora.",
      waitCheck: "Espera a que termine la comprobación de seguridad y vuelve a intentarlo.",
      checkFailed: "La comprobación de seguridad ha fallado. Recarga la página e inténtalo de nuevo.",
      full: "Las inscripciones de hoy están completas. Inténtalo de nuevo mañana."
    },

    "pt-PT": {
      eyebrow: "OFERTAS DA SEMANA",
      title: "As melhores ofertas de cada Gear World.",
      description: "Um email por semana com preços verificados, e as nossas escolhas para a Black Friday e o Natal. Sem spam.",
      emailLabel: "Endereço de email",
      emailPlaceholder: "O seu endereço de email",
      button: "Registar",
      consent: "Aceito receber emails de ofertas do Gear World (cerca de uma vez por semana) e que o Gear World veja se os abro e clico neles. Posso cancelar a subscrição a qualquer momento.",
      sending: "A registar...",
      success: "Obrigado. Subscreveu os emails de ofertas do Gear World.",
      invalid: "Introduza um endereço de email válido.",
      consentRequired: "Assinale a caixa para aceitar receber emails de ofertas do Gear World.",
      error: "Não foi possível concluir o registo. Tente novamente.",
      tooMany: "Demasiadas tentativas. Tente novamente dentro de uma hora.",
      waitCheck: "Aguarde até a verificação de segurança terminar e tente novamente.",
      checkFailed: "A verificação de segurança falhou. Recarregue a página e tente novamente.",
      full: "As inscrições de hoje estão completas. Tente novamente amanhã."
    },

    "nl-NL": {
      eyebrow: "WEKELIJKSE AANBIEDINGEN",
      title: "De beste aanbiedingen uit elke Gear World.",
      description: "Eén e-mail per week met gecontroleerde prijzen, plus onze keuzes voor Black Friday en Kerstmis. Geen spam.",
      emailLabel: "E-mailadres",
      emailPlaceholder: "Uw e-mailadres",
      button: "Aanmelden",
      consent: "Ik ga akkoord met aanbiedingsmails van Gear World (ongeveer één keer per week) en dat Gear World ziet of ik ze open en erop klik. Ik kan mij op elk moment afmelden.",
      sending: "Aanmelden...",
      success: "Bedankt. U bent aangemeld voor de aanbiedingsmails van Gear World.",
      invalid: "Vul een geldig e-mailadres in.",
      consentRequired: "Vink het vakje aan om akkoord te gaan met de aanbiedingsmails van Gear World.",
      error: "De registratie kon niet worden voltooid. Probeer het opnieuw.",
      tooMany: "Te veel pogingen. Probeer het over een uur opnieuw.",
      waitCheck: "Wacht tot de beveiligingscontrole klaar is en probeer het opnieuw.",
      checkFailed: "De beveiligingscontrole is mislukt. Laad de pagina opnieuw en probeer het nog eens.",
      full: "De aanmeldingen voor vandaag zijn vol. Probeer het morgen opnieuw."
    },

    "sq-AL": {
      eyebrow: "OFERTAT E JAVËS",
      title: "Ofertat më të mira nga çdo Gear World.",
      description: "Një email në javë me çmime të kontrolluara, plus zgjedhjet tona për Black Friday dhe Krishtlindje. Pa spam.",
      emailLabel: "Adresa e emailit",
      emailPlaceholder: "Emaili juaj",
      button: "Regjistrohu",
      consent: "Pranoj të marr email me oferta nga Gear World (rreth një herë në javë) dhe që Gear World të shohë nëse i hap dhe klikoj mbi to. Mund të çregjistrohem në çdo kohë.",
      sending: "Po regjistrohet...",
      success: "Faleminderit. U regjistruat për emailet me oferta të Gear World.",
      invalid: "Vendosni një adresë emaili të vlefshme.",
      consentRequired: "Shënoni kutinë për të pranuar emailet me oferta nga Gear World.",
      error: "Regjistrimi nuk u përfundua. Provoni përsëri.",
      tooMany: "Shumë përpjekje. Provoni përsëri pas një ore.",
      waitCheck: "Prisni që të përfundojë kontrolli i sigurisë dhe provoni përsëri.",
      checkFailed: "Kontrolli i sigurisë dështoi. Ringarkoni faqen dhe provoni përsëri.",
      full: "Regjistrimet për sot janë plotësuar. Provoni përsëri nesër."
    },

    "ro-RO": {
      eyebrow: "OFERTELE SĂPTĂMÂNII",
      title: "Cele mai bune oferte din fiecare Gear World.",
      description: "Un email pe săptămână cu prețuri verificate, plus selecțiile noastre pentru Black Friday și Crăciun. Fără spam.",
      emailLabel: "Adresă de email",
      emailPlaceholder: "Adresa dvs. de email",
      button: "Înscriere",
      consent: "Sunt de acord să primesc emailuri cu oferte Gear World (aproximativ o dată pe săptămână) și ca Gear World să vadă dacă le deschid și dau clic pe ele. Mă pot dezabona în orice moment.",
      sending: "Se înregistrează...",
      success: "Vă mulțumim. V-ați abonat la emailurile cu oferte Gear World.",
      invalid: "Introduceți o adresă de email validă.",
      consentRequired: "Bifați căsuța pentru a accepta emailurile cu oferte Gear World.",
      error: "Înscrierea nu a putut fi finalizată. Încercați din nou.",
      tooMany: "Prea multe încercări. Încercați din nou peste o oră.",
      waitCheck: "Așteptați să se termine verificarea de securitate, apoi încercați din nou.",
      checkFailed: "Verificarea de securitate a eșuat. Reîncărcați pagina și încercați din nou.",
      full: "Înscrierile pentru astăzi s-au încheiat. Încercați din nou mâine."
    },

    "ru-RU": {
      eyebrow: "ПРЕДЛОЖЕНИЯ НЕДЕЛИ",
      title: "Лучшие предложения из каждого Gear World.",
      description: "Одно письмо в неделю с проверенными ценами, а также подборки к Чёрной пятнице и Рождеству. Без спама.",
      emailLabel: "Адрес электронной почты",
      emailPlaceholder: "Ваш адрес электронной почты",
      button: "Подписаться",
      consent: "Я согласен получать письма с предложениями Gear World (примерно раз в неделю) и на то, что Gear World видит, открываю ли я их и перехожу ли по ссылкам. Я могу отписаться в любое время.",
      sending: "Подписка...",
      success: "Спасибо. Вы подписаны на письма с предложениями Gear World.",
      invalid: "Введите действительный адрес электронной почты.",
      consentRequired: "Отметьте флажок, чтобы согласиться получать письма с предложениями Gear World.",
      error: "Не удалось завершить подписку. Попробуйте ещё раз.",
      tooMany: "Слишком много попыток. Попробуйте ещё раз через час.",
      waitCheck: "Дождитесь окончания проверки безопасности и попробуйте ещё раз.",
      checkFailed: "Проверка безопасности не пройдена. Обновите страницу и попробуйте ещё раз.",
      full: "На сегодня запись закрыта. Попробуйте ещё раз завтра."
    }
  };

  function locale() {
    const selector = document.getElementById("gwhLanguage");
    const value = selector?.value || "en-GB";
    return COPY[value] ? value : "en-GB";
  }

  function copy() {
    return COPY[locale()] || COPY["en-GB"];
  }

  function applyTranslations() {
    const t = copy();

    document.querySelectorAll("[data-email-i18n]").forEach((el) => {
      const key = el.dataset.emailI18n;

      if (t[key]) {
        el.textContent = t[key];
      }
    });

    document.querySelectorAll("[data-email-placeholder]").forEach((el) => {
      const key = el.dataset.emailPlaceholder;

      if (t[key]) {
        el.setAttribute("placeholder", t[key]);
      }
    });
  }

  const form = document.getElementById("gwhEmailForm");
  const email = document.getElementById("gwhEmailInput");
  const consent = document.getElementById("gwhEmailConsent");
  const submit = document.getElementById("gwhEmailSubmit");
  const message = document.getElementById("gwhEmailMessage");

  function setMessage(text, state = "") {
    if (!message) return;

    message.textContent = text;
    message.dataset.state = state;
  }

  // GWH-TURNSTILE (security fixes F02, lessons L07, L106): Cloudflare Turnstile checks that a person fills in the form.
  // It loads only when the visitor starts using the form (nothing is loaded for anyone else). The sitekey (public) comes
  // from the Hub (/api/turnstile); the token goes with the sign-up and the Hub checks it with its secret key.
  const turnstileBox = document.getElementById("gwhEmailTurnstile");
  let turnstileState = "idle"; // idle, loading, ready, failed
  let turnstileWidget = null;

  function loadTurnstile() {
    if (turnstileState !== "idle" || !turnstileBox) return;
    turnstileState = "loading";
    fetch("/api/turnstile", { headers: { Accept: "application/json" } })
      .then((response) => response.json())
      .then((data) => {
        if (!data || !data.ok || !data.sitekey) throw new Error("not_ready");
        return new Promise((resolve, reject) => {
          window.gwhTurnstileReady = () => resolve(data.sitekey);
          const script = document.createElement("script");
          script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=gwhTurnstileReady";
          script.async = true;
          script.defer = true;
          script.onerror = () => reject(new Error("blocked"));
          document.head.appendChild(script);
        });
      })
      .then((sitekey) => {
        if (!window.turnstile) throw new Error("blocked");
        turnstileBox.style.marginTop = "12px";
        turnstileWidget = window.turnstile.render(turnstileBox, {
          sitekey,
          action: "hub-signup",
          size: turnstileBox.clientWidth >= 300 ? "flexible" : "compact"
        });
        turnstileState = "ready";
      })
      .catch(() => {
        turnstileState = "failed";
      });
  }

  function turnstileToken() {
    if (!window.turnstile || turnstileWidget === null) return "";
    return String(window.turnstile.getResponse(turnstileWidget) || "");
  }

  if (form && email && consent && submit) {
    form.addEventListener("focusin", loadTurnstile);
    form.addEventListener("pointerdown", loadTurnstile);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const t = copy();

      if (!email.checkValidity()) {
        setMessage(t.invalid, "error");
        email.focus();
        return;
      }

      if (!consent.checked) {
        setMessage(t.consentRequired, "error");
        consent.focus();
        return;
      }

      const token = turnstileToken();

      if (!token) {
        loadTurnstile();
        setMessage(turnstileState === "failed" ? t.checkFailed : t.waitCheck, "error");
        return;
      }

      const honeypot =
        form.querySelector('input[name="website"]');

      submit.disabled = true;
      submit.textContent = t.sending;
      setMessage("");

      try {
        const response = await fetch("/api/subscribe", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            email: email.value.trim(),
            locale: locale(),
            consent: true,
            consent_version: "2026-11-02",
            source: "hub",
            website: honeypot?.value || "",
            turnstile_token: token
          })
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          if (data?.error === "invalid_email") {
            throw new Error("invalid_email");
          }

          if (data?.error === "consent_required") {
            throw new Error("consent_required");
          }

          if (data?.error === "too_many") {
            throw new Error("too_many");
          }

          if (data?.error === "limit_day") {
            throw new Error("limit_day");
          }

          if (data?.error === "turnstile_failed" || data?.error === "turnstile_required") {
            throw new Error("turnstile_failed");
          }

          throw new Error("subscribe_failed");
        }

        form.reset();
        setMessage(t.success, "success");

        window.dispatchEvent(
          new CustomEvent(
            "gwh:email_signup_success",
            {
              detail: {
                locale: locale()
              }
            }
          )
        );

      } catch (error) {
        if (error.message === "invalid_email") {
          setMessage(t.invalid, "error");
        }
        else if (error.message === "consent_required") {
          setMessage(t.consentRequired, "error");
        }
        else if (error.message === "too_many") {
          setMessage(t.tooMany, "error");
        }
        else if (error.message === "limit_day") {
          setMessage(t.full, "error");
        }
        else if (error.message === "turnstile_failed") {
          setMessage(t.checkFailed, "error");
        }
        else {
          setMessage(t.error, "error");
        }
      }
      finally {
        submit.disabled = false;
        submit.textContent = copy().button;
        // A token can be used only once: a new check for the next try.
        if (window.turnstile && turnstileWidget !== null) {
          try { window.turnstile.reset(turnstileWidget); } catch (_) { /* ignore */ }
        }
      }
    });
  }

  window.addEventListener(
    "gwh-language-change",
    () => setTimeout(applyTranslations, 0)
  );

  const languageSelector =
    document.getElementById("gwhLanguage");

  if (languageSelector) {
    languageSelector.addEventListener(
      "change",
      () => setTimeout(applyTranslations, 0)
    );
  }

  applyTranslations();

})();