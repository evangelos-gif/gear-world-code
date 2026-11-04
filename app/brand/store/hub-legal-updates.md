# Hub legal pages: changes the app needs (draft, 4 Nov 2026)

Approved by the owner with «ΕΓΚΡΙΝΩ HUB LEGAL PAGES» on 4 Nov 2026. These texts are for the chat that deploys the Hub
(Sites & Code). Deploy from the Hub code in `sites/gwh/public/` on the current Hub branch, never with the old
`tools/gwh-legal-pages.ps1`: that tool uploads the Hub folder from the PC and would undo newer Hub changes.
The links stay the same, so nothing changes in Google Play or App Store Connect.

Why: Google Play now links `https://gearworldhub.com/privacy/` as the app's "delete your data" page and
`https://gearworldhub.com/terms/` as the app's Terms of Service, and the app 1.0.1 adds photo (camera) search.

## 1. Privacy policy (`/privacy/`), section "The Gear World app"

Add after the "Voice search." paragraph:

> **Photo search.** If you tap the camera button, you choose to take a photo or pick one from your gallery. The app
> asks for camera permission only when you take a photo; the gallery opens with your phone's own photo picker, and the
> app sees only the photo you pick. The app makes the photo smaller on your phone and saves it again as a JPEG, which
> removes hidden details such as the location where it was taken. It is then sent once to the Hub and looked at by
> Cloudflare Workers AI, exactly like photo search on the Hub (see above). We do not store the photo. A temporary copy
> made while you take or pick the photo stays in the app's own cache on your phone until your phone clears it or you
> uninstall the app. You can turn camera access off at any time in your phone's settings.

Change the "Last updated" date to the deploy date.

## 2. Privacy policy (`/privacy/`), new section before "Your rights"

Heading with the anchor `id="delete-your-data"`:

> ## Delete your data
>
> The Gear World Hub and the Gear World app have no user accounts, so there is no account to delete.
>
> - **Deal emails:** tap "Unsubscribe" in any Gear World email to stop them at once. To also have your email address
>   deleted, email contact@gearworldhub.com from that address and ask us to delete it. We delete it, with the language,
>   date and place of sign-up kept with it, within one month.
> - **Searches, voice searches and photo searches:** we do not store them, so there is nothing to delete.
> - **On your phone:** the app's language setting and its copy of the list of Gear World sites are deleted when you
>   uninstall the app.
>
> The anonymous daily codes used for fair-use limits are not linked to you and are deleted after 2 days.

Open question for the owner before deploy: confirm "within one month" (the UK GDPR answer time) is a promise we can keep
for removing an address from the Hub member list and MailerLite.

## 3. Terms of use (`/terms/`)

- First paragraph: "These terms apply when you use gearworldhub.com **and the Gear World app for Android and iPhone**,
  operated by Gear World. By using the site **or the app** you accept them."
- Heading "Using the site" → "Using the site and the app", and the first sentence: "You may use the site **and the app**
  for personal, non-commercial purposes."
- Change the "Last updated" date to the deploy date.
