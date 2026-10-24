(() => {
  "use strict";

  const COPY = {
    "en-GB": {
      eyebrow: "STAY CONNECTED",
      title: "Stay connected with Gear World.",
      description: "Get updates about new Gear Worlds, products and network news.",
      emailLabel: "Email address",
      emailPlaceholder: "Your email address",
      button: "Sign up",
      consent: "I agree to receive Gear World email updates and understand that I can unsubscribe at any time.",
      sending: "Signing up...",
      success: "Thanks. Your email has been registered for Gear World updates.",
      invalid: "Please enter a valid email address.",
      consentRequired: "Please confirm that you agree to receive Gear World email updates.",
      error: "We could not complete your registration. Please try again."
    },

    "el-GR": {
      eyebrow: "ΜΕΙΝΕΤΕ ΣΥΝΔΕΔΕΜΕΝΟΙ",
      title: "Μείνετε συνδεδεμένοι με το Gear World.",
      description: "Λάβετε νέα για νέα Gear Worlds, προϊόντα και ενημερώσεις του δικτύου.",
      emailLabel: "Διεύθυνση email",
      emailPlaceholder: "Το email σας",
      button: "Εγγραφή",
      consent: "Συμφωνώ να λαμβάνω ενημερώσεις μέσω email από το Gear World και γνωρίζω ότι μπορώ να διαγραφώ οποιαδήποτε στιγμή.",
      sending: "Γίνεται εγγραφή...",
      success: "Ευχαριστούμε. Το email σας καταχωρήθηκε για ενημερώσεις από το Gear World.",
      invalid: "Εισαγάγετε μια έγκυρη διεύθυνση email.",
      consentRequired: "Επιβεβαιώστε ότι συμφωνείτε να λαμβάνετε ενημερώσεις από το Gear World.",
      error: "Η εγγραφή δεν ολοκληρώθηκε. Δοκιμάστε ξανά."
    },

    "de-DE": {
      eyebrow: "BLEIBEN SIE INFORMIERT",
      title: "Bleiben Sie mit Gear World verbunden.",
      description: "Erhalten Sie Neuigkeiten zu neuen Gear Worlds, Produkten und dem Netzwerk.",
      emailLabel: "E-Mail-Adresse",
      emailPlaceholder: "Ihre E-Mail-Adresse",
      button: "Anmelden",
      consent: "Ich möchte E-Mail-Updates von Gear World erhalten und kann mich jederzeit abmelden.",
      sending: "Anmeldung läuft...",
      success: "Vielen Dank. Ihre E-Mail-Adresse wurde für Gear World Updates registriert.",
      invalid: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      consentRequired: "Bitte bestätigen Sie, dass Sie Gear World Updates erhalten möchten.",
      error: "Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut."
    },

    "fr-FR": {
      eyebrow: "RESTEZ INFORMÉ",
      title: "Restez connecté à Gear World.",
      description: "Recevez les nouveautés sur les Gear Worlds, les produits et le réseau.",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "Votre adresse e-mail",
      button: "S'inscrire",
      consent: "J'accepte de recevoir les actualités Gear World par e-mail et je peux me désinscrire à tout moment.",
      sending: "Inscription...",
      success: "Merci. Votre adresse e-mail est inscrite aux actualités Gear World.",
      invalid: "Veuillez saisir une adresse e-mail valide.",
      consentRequired: "Veuillez confirmer que vous acceptez de recevoir les actualités Gear World.",
      error: "L'inscription n'a pas pu être finalisée. Veuillez réessayer."
    },

    "it-IT": {
      eyebrow: "RESTA AGGIORNATO",
      title: "Resta connesso con Gear World.",
      description: "Ricevi novità sui nuovi Gear Worlds, prodotti e aggiornamenti della rete.",
      emailLabel: "Indirizzo email",
      emailPlaceholder: "Il tuo indirizzo email",
      button: "Iscriviti",
      consent: "Accetto di ricevere aggiornamenti Gear World via email e posso annullare l'iscrizione in qualsiasi momento.",
      sending: "Iscrizione...",
      success: "Grazie. La tua email è stata registrata per gli aggiornamenti Gear World.",
      invalid: "Inserisci un indirizzo email valido.",
      consentRequired: "Conferma di voler ricevere gli aggiornamenti Gear World.",
      error: "Non è stato possibile completare l'iscrizione. Riprova."
    },

    "es-ES": {
      eyebrow: "MANTENTE INFORMADO",
      title: "Mantente conectado con Gear World.",
      description: "Recibe novedades sobre nuevos Gear Worlds, productos y noticias de la red.",
      emailLabel: "Correo electrónico",
      emailPlaceholder: "Tu correo electrónico",
      button: "Registrarse",
      consent: "Acepto recibir actualizaciones de Gear World por correo electrónico y puedo darme de baja en cualquier momento.",
      sending: "Registrando...",
      success: "Gracias. Tu correo se ha registrado para recibir novedades de Gear World.",
      invalid: "Introduce una dirección de correo válida.",
      consentRequired: "Confirma que aceptas recibir actualizaciones de Gear World.",
      error: "No se pudo completar el registro. Inténtalo de nuevo."
    },

    "pt-PT": {
      eyebrow: "MANTENHA-SE INFORMADO",
      title: "Mantenha-se ligado ao Gear World.",
      description: "Receba novidades sobre novos Gear Worlds, produtos e atualizações da rede.",
      emailLabel: "Endereço de email",
      emailPlaceholder: "O seu endereço de email",
      button: "Registar",
      consent: "Aceito receber atualizações do Gear World por email e posso cancelar a subscrição a qualquer momento.",
      sending: "A registar...",
      success: "Obrigado. O seu email foi registado para receber atualizações do Gear World.",
      invalid: "Introduza um endereço de email válido.",
      consentRequired: "Confirme que aceita receber atualizações do Gear World.",
      error: "Não foi possível concluir o registo. Tente novamente."
    },

    "nl-NL": {
      eyebrow: "BLIJF OP DE HOOGTE",
      title: "Blijf verbonden met Gear World.",
      description: "Ontvang nieuws over nieuwe Gear Worlds, producten en netwerkupdates.",
      emailLabel: "E-mailadres",
      emailPlaceholder: "Uw e-mailadres",
      button: "Aanmelden",
      consent: "Ik ga akkoord met e-mailupdates van Gear World en kan mij op elk moment afmelden.",
      sending: "Aanmelden...",
      success: "Bedankt. Uw e-mailadres is geregistreerd voor Gear World-updates.",
      invalid: "Vul een geldig e-mailadres in.",
      consentRequired: "Bevestig dat u Gear World-updates wilt ontvangen.",
      error: "De registratie kon niet worden voltooid. Probeer het opnieuw."
    },

    "sq-AL": {
      eyebrow: "QËNDRONI TË INFORMUAR",
      title: "Qëndroni të lidhur me Gear World.",
      description: "Merrni lajme për Gear Worlds të reja, produkte dhe përditësime të rrjetit.",
      emailLabel: "Adresa e emailit",
      emailPlaceholder: "Emaili juaj",
      button: "Regjistrohu",
      consent: "Pranoj të marr përditësime me email nga Gear World dhe mund të çregjistrohem në çdo kohë.",
      sending: "Po regjistrohet...",
      success: "Faleminderit. Emaili juaj u regjistrua për përditësimet e Gear World.",
      invalid: "Vendosni një adresë emaili të vlefshme.",
      consentRequired: "Konfirmoni se pranoni të merrni përditësime nga Gear World.",
      error: "Regjistrimi nuk u përfundua. Provoni përsëri."
    },

    "ro-RO": {
      eyebrow: "RĂMÂNEȚI INFORMAT",
      title: "Rămâneți la curent cu Gear World.",
      description: "Primiți noutăți despre noile Gear Worlds, produse și actualizări ale rețelei.",
      emailLabel: "Adresă de email",
      emailPlaceholder: "Adresa dvs. de email",
      button: "Înscriere",
      consent: "Sunt de acord să primesc actualizări Gear World prin email și mă pot dezabona în orice moment.",
      sending: "Se înregistrează...",
      success: "Vă mulțumim. Emailul dvs. a fost înregistrat pentru actualizările Gear World.",
      invalid: "Introduceți o adresă de email validă.",
      consentRequired: "Confirmați că sunteți de acord să primiți actualizări Gear World.",
      error: "Înscrierea nu a putut fi finalizată. Încercați din nou."
    },

    "ru-RU": {
      eyebrow: "ОСТАВАЙТЕСЬ В КУРСЕ",
      title: "Оставайтесь на связи с Gear World.",
      description: "Получайте новости о новых Gear Worlds, товарах и обновлениях сети.",
      emailLabel: "Адрес электронной почты",
      emailPlaceholder: "Ваш адрес электронной почты",
      button: "Подписаться",
      consent: "Я согласен получать обновления Gear World по электронной почте и могу отписаться в любое время.",
      sending: "Подписка...",
      success: "Спасибо. Ваш адрес зарегистрирован для получения обновлений Gear World.",
      invalid: "Введите действительный адрес электронной почты.",
      consentRequired: "Подтвердите согласие на получение обновлений Gear World.",
      error: "Не удалось завершить подписку. Попробуйте ещё раз."
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

  if (form && email && consent && submit) {
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
            website: honeypot?.value || ""
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
        else {
          setMessage(t.error, "error");
        }
      }
      finally {
        submit.disabled = false;
        submit.textContent = copy().button;
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